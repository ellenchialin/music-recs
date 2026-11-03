import { z } from "zod";

// 依用途分開驗證：只用到 DB 的指令不必先設好 Last.fm、Anthropic 的 key
const dbEnvSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
});

// Last.fm 的 API key 是 32 個小寫十六進位字元；shared secret 只有登入才用，這裡不需要
const lastfmEnvSchema = z.object({
  LASTFM_API_KEY: z.string().regex(/^[0-9a-f]{32}$/),
});

export type DbEnv = z.infer<typeof dbEnvSchema>;
export type LastfmEnv = z.infer<typeof lastfmEnvSchema>;

type EnvSource = Record<string, string | undefined>;

function parseEnv<T extends z.ZodType>(schema: T, source: EnvSource): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    // 只列欄位名稱，不印值：錯誤訊息可能進 log，值可能是密鑰
    const fields = result.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid environment variables: ${fields}. See .env.example.`);
  }
  return result.data;
}

export function parseDbEnv(source: EnvSource = process.env): DbEnv {
  return parseEnv(dbEnvSchema, source);
}

export function parseLastfmEnv(source: EnvSource = process.env): LastfmEnv {
  return parseEnv(lastfmEnvSchema, source);
}
