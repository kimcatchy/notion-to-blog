import { fetchAndSyncBlog } from './fetch-blog.js';
import { fetchAndSyncProjects } from './fetch-projects.js';

async function main(): Promise<void> {
  console.log("🌟 Starting Notion Synchronization (TypeScript)...");
  try {
    await fetchAndSyncBlog();
    await fetchAndSyncProjects();
    console.log("🎉 Synchronization complete.");
  } catch (error: any) {
    console.error("❌ Synchronization failed:", error.message);
    process.exit(1);
  }
}

main();
