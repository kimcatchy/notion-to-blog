export type PostStatus = 'Writing' | 'Ready' | 'Updated' | 'ToBeDeleted' | 'Deleted';

export interface BaseFrontmatter {
  id: number;
  title: string;
  description: string;
  pubDate: string; // Mapped from 'date'
  updatedDate: string | null; // Mapped from 'update'
  pinned: boolean;
}

export interface BlogFrontmatter extends BaseFrontmatter {
  category: string;
  tags: string[];
}

export interface ProjectFrontmatter extends BaseFrontmatter {
  techStack: string[];
  link?: string;
  repository?: string;
}

export type PropertyValue =
  | string
  | string[]
  | boolean
  | number
  | null;
