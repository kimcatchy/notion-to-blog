import { NotionToMarkdown } from 'notion-to-md';
import { notion } from './client.js';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import { finished } from 'stream/promises';
import type { PropertyValue } from './types.js';
import { throttledMap } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_IMAGE_DIR = path.resolve(__dirname, '../../astro/src/assets/notion');
const BASE_IMAGE_DIR = process.env.IMAGE_DIR || DEFAULT_IMAGE_DIR;

interface ImageToDownload {
  url: string;
  filename: string;
}

/**
 * Encapsulates the conversion logic for a single page to avoid state bleeding in parallel runs
 */
export class PageConverter {
  private n2m: NotionToMarkdown;
  private usedImages = new Set<string>();
  private pendingDownloads: ImageToDownload[] = [];

  constructor(private imagePrefix: string) {
    this.n2m = new NotionToMarkdown({ notionClient: notion });
    this.setupTransformers();
  }

  private setupTransformers() {
    this.n2m.setCustomTransformer('image', async (block: any) => {
      const { image } = block;
      if (!image) return false;

      const imageUrl = image.type === 'file' ? image.file.url : image.external.url;
      const caption = image.caption?.length > 0 ? image.caption[0].plain_text : '';
      
      let ext = '.png';
      try {
        const urlObj = new URL(imageUrl);
        const match = urlObj.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg)/i);
        if (match) ext = match[0];
      } catch {}

      const filename = `${block.id}${ext}`;
      this.usedImages.add(filename);
      this.pendingDownloads.push({ url: imageUrl, filename });

      return `![${caption}](../../assets/notion/${this.imagePrefix}/${filename})`;
    });

    this.n2m.setCustomTransformer('bookmark', async (block: any) => {
      const { bookmark } = block;
      if (!bookmark || !bookmark.url) return false;
      const url = bookmark.url;
      const caption = bookmark.caption?.length > 0 ? bookmark.caption[0].plain_text : url;
      return `[${caption}](${url})`;
    });
  }

  /**
   * Process all images for this page in parallel (throttled)
   */
  private async processImages(): Promise<void> {
    const targetDir = path.resolve(BASE_IMAGE_DIR, this.imagePrefix);
    await fs.mkdir(targetDir, { recursive: true });

    // Download new images
    await throttledMap(this.pendingDownloads, async (img) => {
      const fullPath = path.resolve(targetDir, img.filename);
      try {
        await fs.access(fullPath); // Skip if exists
      } catch {
        const response = await fetch(img.url);
        if (response.ok && response.body) {
          const fileStream = createWriteStream(fullPath);
          await finished(Readable.fromWeb(response.body as any).pipe(fileStream));
        }
      }
    }, 2); // Internal image download concurrency

    // Cleanup orphaned images
    try {
      const files = await fs.readdir(targetDir);
      await Promise.all(
        files.map(file => {
          if (!this.usedImages.has(file)) {
            return fs.rm(path.resolve(targetDir, file), { force: true });
          }
          return Promise.resolve();
        })
      );
    } catch {}
  }

  async convert(pageId: string, properties: Record<string, PropertyValue>): Promise<string> {
    const mdblocks = await this.n2m.pageToMarkdown(pageId);
    const mdString = this.n2m.toMarkdownString(mdblocks);

    let frontmatter = `---\n`;
    for (const [key, value] of Object.entries(properties)) {
      if (value === null || value === undefined) continue;
      if (Array.isArray(value)) {
        const items = value.map(item => `"${item.replace(/"/g, '\\"')}"`).join(', ');
        frontmatter += `${key}: [${items}]\n`;
      } else if (typeof value === 'boolean' || typeof value === 'number') {
        frontmatter += `${key}: ${value}\n`;
      } else if (key === 'pubDate' || key === 'updatedDate') {
        frontmatter += `${key}: ${value}\n`;
      } else {
        frontmatter += `${key}: "${String(value).replace(/"/g, '\\"')}"\n`;
      }
    }
    frontmatter += `---\n\n`;

    const content = frontmatter + mdString.parent;
    
    // Execute image processing (download & cleanup) before returning
    await this.processImages();
    
    return content;
  }
}

/**
 * Shared logic for file and Notion status management
 */
export const Manager = {
  async findFileById(targetDir: string, id: number): Promise<string | null> {
    try {
      const files = await fs.readdir(targetDir);
      for (const file of files) {
        if (!file.endsWith('.md')) continue;
        const content = await fs.readFile(path.resolve(targetDir, file), 'utf8');
        if (content.includes(`id: ${id}\n`)) return file;
      }
    } catch {}
    return null;
  },

  async deletePost(filename: string, targetDir: string, imagePrefix: string): Promise<void> {
    await fs.rm(path.resolve(targetDir, filename), { force: true });
    await fs.rm(path.resolve(BASE_IMAGE_DIR, imagePrefix), { recursive: true, force: true });
  },

  async savePost(filename: string, content: string, targetDir: string): Promise<void> {
    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(path.resolve(targetDir, filename), content, 'utf8');
  },

  async updateStatus(pageId: string, status: string): Promise<void> {
    await notion.pages.update({
      page_id: pageId,
      properties: { status: { select: { name: status } } }
    });
  }
};

export function getPropertyValue(property: any): PropertyValue {
  if (!property) return null;
  switch (property.type) {
    case 'title': return property.title.map((t: any) => t.plain_text).join('');
    case 'rich_text': return property.rich_text.map((t: any) => t.plain_text).join('');
    case 'multi_select': return property.multi_select.map((opt: any) => opt.name);
    case 'select': return property.select ? property.select.name : null;
    case 'checkbox': return property.checkbox;
    case 'created_time': return property.created_time;
    case 'last_edited_time': return property.last_edited_time;
    case 'url': return property.url;
    case 'unique_id': return property.unique_id ? property.unique_id.number : null;
    default: return null;
  }
}
