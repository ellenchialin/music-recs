import { mountSuspended, registerEndpoint } from "@nuxt/test-utils/runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DescribePage from "./describe.vue";

// h3's readBody resolves to a different h3 major here than the event registerEndpoint passes in,
// so read the request body stream directly
const readJson = <T>(event: unknown) => new Response((event as { _requestBody: ReadableStream })._requestBody).json() as Promise<T>;

// Fake agent, streamed like the real one. The description picks the run: "running" finds Pond and
// GUM; "off", "limit", "failed", "timeout" and "nothing" end that way; "slow" waits for the gate
const sse = (event: string, data: object) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
let sent: string[] = [];
let gate: Promise<void> | null = null;
registerEndpoint("/api/describe", {
  method: "POST",
  handler: async (event) => {
    const { description } = await readJson<{ description: string }>(event);
    sent.push(description);
    if (description === "slow") await gate;
    for (const why of ["off", "limit", "failed", "timeout", "nothing"]) {
      if (description === why) return sse("stopped", { why });
    }
    const step = { id: "t1", label: "Finding artists like Tame Impala" };
    return (
      sse("step", { ...step, status: "running" }) +
      sse("step", { ...step, status: "done", summary: "3 found" }) +
      sse("step", { id: "t2", label: "Looking up Broken Band", status: "failed" }) +
      sse("suggestion", { artists: [{ name: "Pond", why: "Same psych sound, faster." }, { name: "GUM", why: "Loose, sunny grooves." }] }) +
      sse("done", {})
    );
  },
});

type Page = Awaited<ReturnType<typeof mountSuspended<typeof DescribePage>>>;
const mounted: Page[] = [];
beforeEach(() => {
  sent = [];
  gate = null;
  localStorage.clear();
  useSeedsStore().seeds = [];
  useState("describe-now").value = false;
});
afterEach(() => {
  mounted.splice(0).forEach((page) => page.unmount());
});
const open = async (route = "/describe?q=Like%20Tame%20Impala%2C%20but%20for%20running") => {
  const page = await mountSuspended(DescribePage, { route });
  mounted.push(page);
  return page;
};
const button = (page: Page, text: string) => page.findAll("button").find((b) => b.text() === text);
const run = async (page: Page, description: string) => {
  await page.get("textarea").setValue(description);
  await button(page, "Find artists")!.trigger("click");
};
const steps = (page: Page) =>
  page.findAll('[data-testid="agent-step"]').map((s) => [s.get('[data-testid="step-label"]').text(), s.find('[data-testid="step-detail"]').text()]);

describe("describe page", () => {
  it("shows the description from the link, and waits to be asked", async () => {
    const page = await open();

    expect(page.get("h1").text()).toBe("What are you in the mood for?");
    expect((page.get("textarea").element as HTMLTextAreaElement).value).toBe("Like Tame Impala, but for running");
    await new Promise((r) => setTimeout(r, 50));
    // A reload or a shared link shouldn't spend an AI run by itself
    expect(sent).toEqual([]);
  });

  it("starts at once when the visitor came from the home page", async () => {
    useState("describe-now").value = true;

    await open();

    await vi.waitFor(() => expect(sent).toEqual(["Like Tame Impala, but for running"]));
    expect(useState("describe-now").value).toBe(false);
  });

  it("shows each lookup and how it went", async () => {
    const page = await open();

    await run(page, "running");

    await vi.waitFor(() =>
      expect(steps(page)).toEqual([
        ["Finding artists like Tame Impala", "3 found"],
        ["Looking up Broken Band", "Couldn't look this up"],
      ]),
    );
  });

  it("puts the suggested artists up as editable picks, and recommends from them", async () => {
    const page = await open();
    await run(page, "running");

    await vi.waitFor(() => expect(useSeedsStore().seeds).toEqual(["Pond", "GUM"]));
    expect(page.text()).toContain("Start from these artists");
    expect(page.text()).toContain("Same psych sound, faster.");
    await page.get('button[aria-label="Remove GUM"]').trigger("click");
    expect(useSeedsStore().seeds).toEqual(["Pond"]);
    // Reviewing, not searching: adding artists by name is the home page's "By artist"
    expect(page.find('input[role="combobox"]').exists()).toBe(false);

    await button(page, "Recommend")!.trigger("click");

    await vi.waitFor(() => expect(useRouter().currentRoute.value).toMatchObject({ path: "/recommendations", query: { seed: ["Pond"] } }));
  });

  it("asks to keep one artist when every pick was removed", async () => {
    const page = await open();
    await run(page, "running");
    await vi.waitFor(() => expect(useSeedsStore().seeds).toHaveLength(2));

    await page.get('button[aria-label="Remove Pond"]').trigger("click");
    await page.get('button[aria-label="Remove GUM"]').trigger("click");

    expect(button(page, "Recommend")!.attributes("disabled")).toBeDefined();
    expect(page.text()).toContain("Keep at least one artist");
  });

  it.each([
    ["off", "isn't available right now"],
    ["limit", "That's all the searching for today"],
    ["timeout", "That took too long"],
    ["failed", "Something went wrong"],
    ["nothing", "Couldn't find artists for that"],
  ])("says what happened when the run ends with %s", async (why, message) => {
    const page = await open();

    await run(page, why);

    await vi.waitFor(() => expect(page.get('[role="alert"]').text()).toContain(message));
    expect(button(page, "Find artists")!.attributes("disabled")).toBeUndefined();
  });

  it("offers to pick artists by name when describing isn't available", async () => {
    const page = await open();
    await run(page, "off");

    await vi.waitFor(() => expect(page.find('[role="alert"]').exists()).toBe(true));
    expect(page.get('[role="alert"] a').attributes("href")).toBe("/");
  });

  it("can be stopped while it searches", async () => {
    let release = () => {};
    gate = new Promise((resolve) => (release = resolve));
    const page = await open();
    await run(page, "slow");
    await vi.waitFor(() => expect(button(page, "Stop")).toBeDefined());

    await button(page, "Stop")!.trigger("click");

    await vi.waitFor(() => expect(page.get('[role="alert"]').text()).toContain("Stopped"));
    expect(button(page, "Find artists")).toBeDefined();
    release();
  });

  it("links home in the breadcrumb", async () => {
    const page = await open();
    const crumbs = page.findAll('nav[aria-label="Breadcrumb"] li').map((li) => li.text().replace("›", "").trim());
    expect(crumbs).toEqual(["Home", "By vibe"]);
  });
});
