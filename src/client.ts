import { Client } from '@notionhq/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file from the root of the notion workspace
dotenv.config({ path: path.resolve(__dirname, '../.env') });

if (!process.env.NOTION_API_KEY) {
  console.error("❌ Missing NOTION_API_KEY in .env");
  process.exit(1);
}

export const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});
