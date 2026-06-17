import { Context, Logger, Schema, SessionStorageSnapshot, Storage } from 'yumeri';
import fs from 'fs/promises';
import path from 'path';

const logger = new Logger('storage-file');

export interface StorageFileConfig {
  path: string;
}

export const config: Schema<StorageFileConfig> = Schema.object({
  path: Schema.string('存储文件路径').default('./data/storage.json'),
});

type StorageFileData = Record<string, SessionStorageSnapshot>;

class FileStorage implements Storage<SessionStorageSnapshot> {
  private filePath: string;
  private queue: Promise<void> = Promise.resolve();

  constructor(filePath: string) {
    this.filePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  }

  async get(key: string): Promise<SessionStorageSnapshot | undefined> {
    const data = await this.read();
    return data[key];
  }

  async set(key: string, value: SessionStorageSnapshot): Promise<void> {
    await this.withLock(async () => {
      const data = await this.read();
      data[key] = value;
      await this.write(data);
    });
  }

  async delete(key: string): Promise<void> {
    await this.withLock(async () => {
      const data = await this.read();
      delete data[key];
      await this.write(data);
    });
  }

  async clear(): Promise<void> {
    await this.withLock(async () => {
      await this.write({});
    });
  }

  private async withLock(task: () => Promise<void>): Promise<void> {
    const next = this.queue.then(task, task);
    this.queue = next.catch(() => {});
    await next;
  }

  private async read(): Promise<StorageFileData> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      if (!content.trim()) return {};
      return JSON.parse(content) as StorageFileData;
    } catch (error: any) {
      if (error?.code === 'ENOENT') return {};
      throw error;
    }
  }

  private async write(data: StorageFileData): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    await fs.rename(tempPath, this.filePath);
  }
}

export function apply(ctx: Context, pluginConfig: StorageFileConfig) {
  const storage = new FileStorage(pluginConfig.path);
  ctx.setStorage(storage);
  logger.info(`Session storage file: ${pluginConfig.path}`);
}
