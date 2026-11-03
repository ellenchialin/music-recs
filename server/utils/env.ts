import { z } from "zod";

// 依用途分開驗證：只用到 DB 的指令不必先設好 Last.fm、Anthropic 的 key
const dbEnvSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
});

export type DbEnv = z.infer<typeof dbEnvSchema>;

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
