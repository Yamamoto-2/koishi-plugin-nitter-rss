import moment from 'moment';
import cheerio from 'cheerio';

//移除HTML标签
export function removeHTMLTags(inputText: string): string {
  // 使用Cheerio加载HTML文本
  const $ = cheerio.load(inputText);

  // 获取纯文本内容
  const plainText = $.text();

  return plainText;
}

//时间文本转时间戳
export function parseTimestamp(timestampText: string): number | null {
  // 尝试解析 'MMM D, YYYY · h:mm A UTC' 格式的时间文本
  const parsedTimestamp1 = moment(timestampText, 'MMM D, YYYY · h:mm A UTC', 'en');
  
  // 尝试解析 'ddd, DD MMM YYYY HH:mm:ss GMT' 格式的时间文本
  const parsedTimestamp2 = moment(timestampText, 'ddd, DD MMM YYYY HH:mm:ss GMT', 'en');

  // 如果其中一个解析成功，则返回时间戳
  if (parsedTimestamp1.isValid()) {
    return parsedTimestamp1.valueOf();
  } else if (parsedTimestamp2.isValid()) {
    return parsedTimestamp2.valueOf();
  } else {
    console.error('Invalid timestamp:', timestampText);
    return null;
  }
}

//时间戳转本地时间文本
export function formatLocalTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN');
}


export function cleanText(inputText: string): string {
  //清除所有行的左侧空格
  const lines = inputText.split('\n');
  const cleanedLines = lines.map(line => line.trim());
  //开头的所有\n改为''
  while (cleanedLines[0] == '') {
    cleanedLines.shift();
  }
  //组合
  let cleanedText = cleanedLines.join('\n');
  //如果有连续超过2个空行，改为2个'\n'。
  cleanedText = cleanedText.replace(/\n{3,}/g, '\n\n');
  return cleanedText;
}

export interface LinkInfo {
  isTwitterLink: boolean;
  account: string | null;
  id: string | null;
}

//解析Twitter链接
export async function parseTwitterLink(link: string): Promise<LinkInfo> {
  try {
    const isTwitterLink = link.includes('twitter.com') || link.includes('nitter.cz');
    let account: string | null = null;
    let id: string | null = null;

    if (isTwitterLink) {
      const parts = link.split('/');
      if (parts.length >= 4) {
        account = parts[3];
      }

      const tweetIdMatch = link.match(/\/status\/(\d+)/);
      if (tweetIdMatch) {
        id = tweetIdMatch[1];
      }
    }

    return { isTwitterLink, account, id };
  } catch (error) {
    console.error('Error parsing Twitter link:', error);
    return { isTwitterLink: false, account: null, id: null };
  }
}

export default parseTwitterLink;