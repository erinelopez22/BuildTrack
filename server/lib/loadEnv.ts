// Loads local env files for CLI scripts (drizzle-kit, seed, local API).
// On Vercel the real environment variables are already present and these files are absent.
import { config } from 'dotenv';

config({ path: '.env.local' });
config({ path: '.env' });
