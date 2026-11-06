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
const rateLimitEnvSchema = z.object({
  RATE_LIMIT_SALT: z.string().min(32),
});

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

export function parseRateLimitEnv(source: EnvSource = process.env): z.infer<typeof rateLimitEnvSchema> {
  return parseEnv(rateLimitEnvSchema, source);
}
