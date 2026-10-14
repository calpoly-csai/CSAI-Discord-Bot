import { promises as fsPromises } from 'fs';
import https from 'https';
import path from 'path';

type ReadmeCacheMeta = {
  sourceUrl: string;
  etag?: string;
  lastModified?: string;
  fetchedAt: string;
};

type ReadmeSourceOptions = {
  url: string;
  cacheDir: string;
  timeoutMs?: number;
};

type RemoteReadmeResult =
  | {
      status: 'ok';
      content: string;
      etag?: string;
      lastModified?: string;
    }
  | {
      status: 'not-modified';
    };

export type ReadmeSourceResult = {
  content: string;
  status: 'downloaded' | 'not-modified' | 'stale-cache';
  cachePath: string;
  metaPath: string;
  message: string;
};

const DEFAULT_TIMEOUT_MS = 15000;
const README_FILENAME = 'README.md';
const META_FILENAME = 'meta.json';

async function readJsonIfPresent<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fsPromises.readFile(filePath, 'utf8');
    return JSON.parse(content) as T;
  } catch (error: any) {
    if (error?.code === 'ENOENT') return null;
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

async function readTextIfPresent(filePath: string): Promise<string | null> {
  try {
    return await fsPromises.readFile(filePath, 'utf8');
  } catch (error: any) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

function getHeaderValue(
  value: string | string[] | number | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  if (typeof value === 'number') return String(value);
  return value;
}

function requestReadme(
  url: string,
  meta: ReadmeCacheMeta | null,
  timeoutMs: number,
  redirectsRemaining = 3,
): Promise<RemoteReadmeResult> {
  const headers: Record<string, string> = {
    Accept: 'text/markdown,text/plain,*/*',
    'User-Agent': 'csai-discord-bot-readme-cache',
  };

  if (meta?.etag) headers['If-None-Match'] = meta.etag;
  if (meta?.lastModified) headers['If-Modified-Since'] = meta.lastModified;

  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'GET', headers }, (res) => {
      const statusCode = res.statusCode ?? 0;

      if (
        [301, 302, 303, 307, 308].includes(statusCode) &&
        res.headers.location &&
        redirectsRemaining > 0
      ) {
        res.resume();
        const nextUrl = new URL(res.headers.location, url).toString();
        requestReadme(nextUrl, meta, timeoutMs, redirectsRemaining - 1)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (statusCode === 304) {
        res.resume();
        resolve({ status: 'not-modified' });
        return;
      }

      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');

        if (statusCode < 200 || statusCode >= 300) {
          reject(
            new Error(
              `README fetch failed with HTTP ${statusCode}: ${body.slice(0, 200)}`,
            ),
          );
          return;
        }

        if (!body.trim()) {
          reject(new Error('README fetch returned an empty response.'));
          return;
        }

        resolve({
          status: 'ok',
          content: body,
          etag: getHeaderValue(res.headers.etag),
          lastModified: getHeaderValue(res.headers['last-modified']),
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`README fetch timed out after ${timeoutMs}ms.`));
    });
    req.end();
  });
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function getCachedReadme(
  options: ReadmeSourceOptions,
): Promise<ReadmeSourceResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const cachePath = path.join(options.cacheDir, README_FILENAME);
  const metaPath = path.join(options.cacheDir, META_FILENAME);
  const savedMeta = await readJsonIfPresent<ReadmeCacheMeta>(metaPath);
  const cachedMeta = savedMeta?.sourceUrl === options.url ? savedMeta : null;

  try {
    let remote = await requestReadme(options.url, cachedMeta, timeoutMs);

    if (remote.status === 'not-modified') {
      const cachedContent = await readTextIfPresent(cachePath);

      if (cachedContent) {
        return {
          content: cachedContent,
          status: 'not-modified',
          cachePath,
          metaPath,
          message: `README unchanged; using cached copy from ${cachePath}.`,
        };
      }

      remote = await requestReadme(options.url, null, timeoutMs);
    }

    if (remote.status === 'not-modified') {
      throw new Error('GitHub returned 304 but no cached README exists.');
    }

    await fsPromises.mkdir(options.cacheDir, { recursive: true });
    await fsPromises.writeFile(cachePath, remote.content, 'utf8');
    await fsPromises.writeFile(
      metaPath,
      `${JSON.stringify(
        {
          sourceUrl: options.url,
          etag: remote.etag,
          lastModified: remote.lastModified,
          fetchedAt: new Date().toISOString(),
        } satisfies ReadmeCacheMeta,
        null,
        2,
      )}\n`,
      'utf8',
    );

    return {
      content: remote.content,
      status: 'downloaded',
      cachePath,
      metaPath,
      message: `Downloaded README and updated cache at ${cachePath}.`,
    };
  } catch (error) {
    const cachedContent = await readTextIfPresent(cachePath);

    if (cachedContent) {
      return {
        content: cachedContent,
        status: 'stale-cache',
        cachePath,
        metaPath,
        message: `README fetch failed (${describeError(error)}); using stale cache from ${cachePath}.`,
      };
    }

    throw new Error(
      `README fetch failed and no cache exists at ${cachePath}: ${describeError(error)}`,
    );
  }
}
