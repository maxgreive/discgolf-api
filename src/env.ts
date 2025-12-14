import { z } from 'zod';
import tryParseEnv from './try-parse-env';

const EnvSchema = z.object({
  NODE_ENV: z.string(),
  ALLOWED_ORIGIN: z.string(),
  BAGTAG_ENDPOINT: z.string(),
  CACHE_EXPIRY: z.string(),
  DISCORD_CHANNEL_ID: z.string(),
  DISCORD_WEBHOOK_URL: z.string(),
  METRIX_URL: z.string(),
  OFFICIAL_URL: z.string(),
  RATING_URL: z.string(),
  STRIPE_SECRET_KEY: z.string(),
  STRIPE_WEBHOOK_SECRET: z.string(),
  TOURNAMENTS_API_SECRET: z.string(),
  TOURNAMENTS_API_TOKEN: z.string(),
  PORT: z.string().optional(),
  NEW_PRODUCT_DAYS: z.string().optional(),
  REDIS_URL: z.string(),
});

export type EnvSchema = z.infer<typeof EnvSchema>;

tryParseEnv(EnvSchema);

export default EnvSchema.parse(process.env);
