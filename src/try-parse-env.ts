import dotenv from 'dotenv';
import type { ZodObject, ZodRawShape } from 'zod';
import { ZodError } from 'zod';

dotenv.config();
export default function tryParseEnv<T extends ZodRawShape>(
  EnvSchema: ZodObject<T>,
  buildEnv: Record<string, string | undefined> = process.env,
) {
  try {
    EnvSchema.parse(buildEnv);
  } catch (error) {
    if (error instanceof ZodError) {
      let message = 'Missing required values in .env:\n';
      error.issues.forEach((issue) => {
        message += `${String(issue.path[0])}\n`;
      });
      const e = new Error(message);
      e.stack = '';
      throw e;
    } else {
      console.error(error);
    }
  }
}
