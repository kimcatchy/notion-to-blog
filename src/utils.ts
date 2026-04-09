/**
 * Run multiple promises in parallel with a limit on concurrency.
 */
export async function throttledMap<T, R>(
  items: T[],
  handler: (item: T) => Promise<R>,
  concurrency: number = 3
): Promise<R[]> {
  const results: R[] = [];
  const activePromises: Promise<void>[] = [];

  for (const item of items) {
    const p = handler(item).then((res) => {
      results.push(res);
      activePromises.splice(activePromises.indexOf(p), 1);
    });
    activePromises.push(p);

    if (activePromises.length >= concurrency) {
      await Promise.race(activePromises);
    }
  }

  await Promise.all(activePromises);
  return results;
}

/**
 * Small utility to clean up strings for filenames/slugs
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
