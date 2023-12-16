import { Context } from 'koishi'
import * as path from 'path';
import * as fs from 'fs';

const errUrl: string[] = [];

export async function download(ctx: Context, url: string, directory?: string, fileName?: string, cacheTime = 0): Promise<Buffer> {
  if (directory != undefined && fileName != undefined) {
    createDirIfNonExist(directory);
  }
  try {
    if (errUrl.includes(url)) {
      throw new Error("downloadFile: errUrl.includes(url)");
    }

    const fileExists = directory && fileName && fs.existsSync(path.join(directory, fileName));
    if (fileExists && cacheTime > 0) {
      const cacheFilePath = path.join(directory, `${fileName}`);
      const cacheStat = fs.statSync(cacheFilePath);
      const currentTime = new Date().getTime();
      const lastModifiedTime = new Date(cacheStat.mtime).getTime();
      const elapsedTime = currentTime - lastModifiedTime;
      if (elapsedTime < cacheTime * 1000) {
        const cachedData = fs.readFileSync(cacheFilePath);
        console.log(`Using cached data for "${url}"`);
        return cachedData;
      }
    }

    const lastModifiedTime = getLastModifiedTime(directory, fileName);
    const headers = lastModifiedTime ? { 'If-Modified-Since': lastModifiedTime.toUTCString() } : {};
    const response = await ctx.http.axios(url, { headers, responseType: 'arraybuffer' });

    if (response.status === 304 && directory && fileName) {
      const cacheFilePath = path.join(directory, `${fileName}`);
      const cachedData = fs.readFileSync(cacheFilePath);
      console.log(`Using cached data for "${url}"`);
      return cachedData;
    }

    const fileBuffer = Buffer.from(response.data, 'binary');

    if (directory && fileName) {
      fs.writeFileSync(path.join(directory, fileName), fileBuffer);
    }
    console.log(`Downloaded file from "${url}"`);
    return fileBuffer;
  } catch (e) {
    errUrl.push(url);
    if (url.includes('.png')) {
      throw e;
    } else {
      throw new Error(`Failed to download file from "${url}". Error: ${e.message}`);
    }
  }
}

export function createDirIfNonExist(filepath: string) {
  if (!fs.existsSync(filepath)) {
    console.log('creating ' + filepath);
    try {
      fs.mkdirSync(filepath, { recursive: true });
    } catch (err) {
      console.log(`creating ${filepath} failed`, err);
    }
  }
}

function getLastModifiedTime(directory?: string, fileName?: string): Date | null {
  if (directory && fileName && fs.existsSync(path.join(directory, fileName))) {
    const cacheFilePath = path.join(directory, `${fileName}`);
    const cacheStat = fs.statSync(cacheFilePath);
    return cacheStat.mtime;
  }
  return null;
}
