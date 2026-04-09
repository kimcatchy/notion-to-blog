# Burrow Notion Sync

This repository provides a service to synchronize content from Notion databases to the Astro-based Burrow blog. It features a complete state machine for handling publishing, updating, and deleting posts.

## Status Workflow

The sync script operates on a `status` column rather than a simple checkbox, allowing for precise control:

- **Writing**: The post is ignored.
- **Ready**: The script detects the post, downloads images, generates a `.md` file in the Astro repository, and updates the Notion status to **Updated**.
- **Updated**: The post is ignored (already synced). If you want to sync changes, change it back to **Ready**.
- **ToBeDeleted**: The script detects the post, deletes its `.md` file and all associated images from the Astro repository, and updates the Notion status to **Deleted**.
- **Deleted**: The post is ignored.

## Setup Guide

### 1. Database Schema Requirements

Your databases MUST have the following columns with the exact property types:

#### Blog Database
| Property Name | Type | Req | Description |
| :--- | :--- | :---: | :--- |
| `title` | Title | ✅ | The post title |
| `status` | Select | ✅ | `Writing`, `Ready`, `Updated`, `ToBeDeleted`, `Deleted` |
| `id` | Unique ID | ✅ | Tracking ID for stable file management |
| `date` | Created time | ✅ | Publication date |
| `slug` | Rich text | ⚠️ | URL slug (defaults to title if empty) |
| `description` | Rich text | - | Short summary |
| `category` | Select | - | Single category (defaults to 'Uncategorized') |
| `tags` | Multi-select | - | Multiple tags |
| `pinned` | Checkbox | - | Pin to top of list |
| `update` | Last edited time | - | Modification date |

#### Projects Database
| Property Name | Type | Req | Description |
| :--- | :--- | :---: | :--- |
| `title` | Title | ✅ | The project title |
| `status` | Select | ✅ | `Writing`, `Ready`, `Updated`, `ToBeDeleted`, `Deleted` |
| `id` | Unique ID | ✅ | Tracking ID |
| `date` | Created time | ✅ | Publication date |
| `slug` | Rich text | ⚠️ | URL slug (defaults to title if empty) |
| `description` | Rich text | - | Short summary |
| `techstack` | Multi-select | - | Technologies used |
| `repo` | URL | - | GitHub/GitLab link |
| `live` | URL | - | Live demo link |
| `pinned` | Checkbox | - | Pin to top of list |
| `update` | Last edited time | - | Modification date |

> **Req Key:** ✅ Required, ⚠️ Recommended (for clean URLs), - Optional

### 2. API Key & Token Generation Guide

#### 🔗 Notion API Key (Internal Integration Secret)
1. Go to [Notion My Integrations](https://www.notion.so/my-integrations).
2. Click **+ New integration**.
3. Name your integration (e.g., "Burrow Sync") and select the correct workspace.
4. Go to the **Secrets** tab and copy the **Internal Integration Secret**.
5. **Crucial:** In your Notion database page, click the `...` menu (top right) > **Connect to** > search for and select your integration name. Without this step, the API cannot access your database.

#### 🐙 GitHub Personal Access Token (PAT)
1. Go to your GitHub **[Fine-grained personal access tokens](https://github.com/settings/tokens?type=beta)** or [Tokens (classic)](https://github.com/settings/tokens).
2. Click **Generate new token**.
3. **Permissions:**
   - **Fine-grained:** Select your blog repository and grant **Read and Write** access to **Contents**.
   - **Classic:** Select the `repo` scope.
4. Generate the token and copy it immediately. (You won't be able to see it again).

#### 🆔 Finding your Database ID
1. Open your Notion database in the browser.
2. Click **Share** (top right) and then **Copy link**.
3. The link will look like this: `https://www.notion.so/12341234123412341234123412341234?v=...`
4. The **Database ID** is the **32-character string** between the last slash (`/`) and the question mark (`?`). In the example above, it is `12341234123412341234123412341234`.

### 3. GitHub Actions Integration

To automate synchronization via GitHub Actions, configure the following **Secrets** and **Variables** in your repository settings:

#### Repository Secrets (`Settings > Secrets and variables > Actions > Secrets`)
- `NOTION_API_KEY`: Your Notion Internal Integration Secret.
- `GITTOKEN`: A GitHub Personal Access Token (PAT) with `repo` permissions to push changes to your blog repository.

#### Repository Variables (`Settings > Secrets and variables > Actions > Variables`)
- `NOTION_BLOG_DB_ID`: The 32-character ID of your Blog database.
- `NOTION_PROJECTS_DB_ID`: The 32-character ID of your Projects database.
- `BLOG_REPO`: The full name of your blog repository (e.g., `username/blog-repo`).
- `GIT_USER_NAME`: The name used for sync commits (e.g., `github-actions[bot]`).
- `GIT_USER_EMAIL`: The email used for sync commits (e.g., `41898282+github-actions[bot]@users.noreply.github.com`).

## 🛠️ Path Customization

The sync service uses environment variables to determine where to save your Markdown files and images. This allows it to work seamlessly in both local environments and GitHub Actions.

### 📍 Key Environment Variables
If your blog repository structure is different, or you want to change the target folders, modify these variables in your `.env` (Local) or GitHub Action YAML (CI):

- `BLOG_DIR`: Destination for blog post `.md` files.
- `PROJECTS_DIR`: Destination for project `.md` files.
- `IMAGE_DIR`: Root folder for localized Notion images.

### 🖥️ Local vs. 🤖 GitHub Actions
| Variable | Local Default | GitHub Actions Default (Example) |
| :--- | :--- | :--- |
| `BLOG_DIR` | `../../astro/src/content/blog` | `./blog-repo/src/content/blog` |
| `PROJECTS_DIR` | `../../astro/src/content/project` | `./blog-repo/src/content/project` |
| `IMAGE_DIR` | `../../astro/src/assets/notion` | `./blog-repo/src/assets/notion` |

> **Warning for Developers:** The Markdown image link generated by the script is hardcoded as `../../assets/notion/`. If you change the `IMAGE_DIR` to a folder other than `assets/notion`, you **must** also update the return string in `notion/src/markdown-converter.ts`:
> ```typescript
> // notion/src/markdown-converter.ts
> return `![${caption}](../../assets/notion/${this.imagePrefix}/${filename})`;
> ```

## Usage Guide

### 📂 Method A: Local Synchronization
Use this method for manual syncs during development.

1. Create a `.env` file in the `notion/` directory based on `.env.example`.
2. Fill in `NOTION_API_KEY`, `NOTION_BLOG_DB_ID`, and `NOTION_PROJECTS_DB_ID`.
3. Run the sync command:
```bash
npm install
npm run sync
```

### 🤖 Method B: GitHub Actions (Automated)
Once configured, the sync runs automatically based on the schedule defined in `.github/workflows/sync-to-blog.yml`.

- **Scheduled**: Runs daily at midnight (UTC) by default.
- **Manual Trigger**: 
  1. Go to your repository on GitHub.
  2. Click the **Actions** tab.
  3. Select **Sync Notion to Blog** from the left sidebar.
  4. Click **Run workflow**.
