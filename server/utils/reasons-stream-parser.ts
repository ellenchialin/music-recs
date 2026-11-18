// Claude streams the reasons as JSON text, {"reasons":[{"artist":…,"reason":…},…]}, a few
// characters at a time. This hands out each entry of the array as soon as its closing brace
// arrives, so the page can show one reason while the next is still being written.
// Only brackets outside strings count, so a "}" inside a reason doesn't end the entry

// Depth of an entry's own braces: the answer object is 1, its array 2, an entry 3
const ENTRY_DEPTH = 3;

export function createReasonsParser() {
  let text = "";
  let scanned = 0;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let entryStart = -1;

  return {
    push(chunk: string): unknown[] {
      text += chunk;
      const entries: unknown[] = [];
      for (; scanned < text.length; scanned++) {
        const char = text[scanned];
        if (inString) {
          if (escaped) escaped = false;
          else if (char === "\\") escaped = true;
          else if (char === '"') inString = false;
          continue;
        }
        if (char === '"') inString = true;
        else if (char === "{" || char === "[") {
          depth++;
          if (depth === ENTRY_DEPTH && char === "{") entryStart = scanned;
        } else if (char === "}" || char === "]") {
          if (depth === ENTRY_DEPTH && char === "}" && entryStart >= 0) {
            entries.push(JSON.parse(text.slice(entryStart, scanned + 1)));
            entryStart = -1;
          }
          depth--;
        }
      }
      return entries;
    },
  };
}
