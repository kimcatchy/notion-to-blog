import { notion } from './client.js';
import { getPropertyValue, PageConverter, Manager } from './markdown-converter.js';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ProjectFrontmatter, PostStatus } from './types.js';
import { throttledMap, slugify } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_PROJECTS_DIR = path.resolve(__dirname, '../../astro/src/content/project');
const PROJECTS_DIR = process.env.PROJECTS_DIR || DEFAULT_PROJECTS_DIR;

export async function fetchAndSyncProjects(): Promise<void> {
  const databaseId = process.env.NOTION_PROJECTS_DB_ID;
  if (!databaseId) return;

  console.log("🚀 Fetching Projects...");
  const response = await notion.databases.query({
    database_id: databaseId,
    filter: {
      or: [
        { property: 'status', select: { equals: 'Ready' } },
        { property: 'status', select: { equals: 'ToBeDeleted' } }
      ]
    },
  });

  const pages = response.results;
  console.log(`✅ Found ${pages.length} projects to process.`);

  await throttledMap(pages, async (page: any) => {
    const props = page.properties;
    const id = getPropertyValue(props['id']) as number;
    const title = getPropertyValue(props['title']) as string || 'Untitled';
    const status = getPropertyValue(props['status']) as PostStatus;
    const rawSlug = getPropertyValue(props['slug']) as string || title;

    if (!id) return;

    const filename = `${slugify(rawSlug)}.md`;
    const imagePrefix = `project-${id}`;
    const oldFilename = await Manager.findFileById(PROJECTS_DIR, id);

    if (status === 'ToBeDeleted') {
      console.log(`  - 🗑️ Deleting project: ${title}`);
      if (oldFilename) await Manager.deletePost(oldFilename, PROJECTS_DIR, imagePrefix);
      await Manager.updateStatus(page.id, 'Deleted');
      return;
    }

    if (status === 'Ready') {
      console.log(`  - ✍️ Syncing project: ${title}`);
      if (oldFilename && oldFilename !== filename) {
        await Manager.deletePost(oldFilename, PROJECTS_DIR, imagePrefix);
      }

      const converter = new PageConverter(imagePrefix);
      const frontmatter: ProjectFrontmatter = {
        id, title,
        description: getPropertyValue(props['description']) as string || '',
        pubDate: getPropertyValue(props['date']) as string,
        updatedDate: getPropertyValue(props['update']) as string | null,
        techStack: getPropertyValue(props['techstack']) as string[] || [],
        link: getPropertyValue(props['live']) as string | undefined,
        repository: getPropertyValue(props['repo']) as string | undefined,
        pinned: getPropertyValue(props['pinned']) as boolean || false,
      };

      const mdContent = await converter.convert(page.id, frontmatter as any);
      await Manager.savePost(filename, mdContent, PROJECTS_DIR);
      await Manager.updateStatus(page.id, 'Updated');
    }
  }, 2);
}
