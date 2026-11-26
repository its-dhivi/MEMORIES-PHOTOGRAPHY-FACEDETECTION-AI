import { z } from 'zod';
export const publicEnvironmentSchema = z.object({ NEXT_PUBLIC_API_URL: z.url() });
export type PublicEnvironment = z.infer<typeof publicEnvironmentSchema>;
