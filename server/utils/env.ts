import { z } from "zod";

// One schema per concern, so DB-only scripts don't need the API keys
const dbEnvSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
});

// 32 lowercase hex characters. The shared secret is only for user auth, which we don't use
const lastfmEnvSchema = z.object({
  LASTFM_API_KEY: z.string().regex(/^[0-9a-f]{32}$/),
});

// Salt for hashing client IPs in rate limiting; long enough not to be guessed
const rateLimitEnvSchema = z
  .object({
    RATE_LIMIT_SALT: z.string().min(32),
    // Set by Vercel, whose proxy overwrites x-forwarded-for
    VERCEL: z.string().optional(),
  })
  .transform(({ RATE_LIMIT_SALT, VERCEL }) => ({ RATE_LIMIT_SALT, trustProxy: VERCEL === "1" }));

// Optional: without a key, recommendation reasons fall back to "Similar to …". Empty counts as unset
const llmEnvSchema = z
  .object({
    ANTHROPIC_API_KEY: z
      .string()
      .optional()
      .transform((v) => v || undefined)
      .pipe(z.string().startsWith("sk-ant-").optional()),
  })
  .transform(({ ANTHROPIC_API_KEY }) => ({ apiKey: ANTHROPIC_API_KEY ?? null }));

export type DbEnv = z.infer<typeof dbEnvSchema>;
export type LastfmEnv = z.infer<typeof lastfmEnvSchema>;

type EnvSource = Record<string, string | undefined>;

function parseEnv<T extends z.ZodType>(schema: T, source: EnvSource): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    // Names only, never values: the message may be logged and values may be secrets
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

export function parseLlmEnv(source: EnvSource = process.env): z.output<typeof llmEnvSchema> {
  return parseEnv(llmEnvSchema, source);
}

export function parseRateLimitEnv(source: EnvSource = process.env): z.output<typeof rateLimitEnvSchema> {
  return parseEnv(rateLimitEnvSchema, source);
}
