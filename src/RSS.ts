import axios from 'axios';
import { parseString } from 'xml2js';
import { removeHTMLTags, parseTimestamp } from './utils';

export interface RSSItem {
    title: string;
    link: string;
    pubDate: number;
    guid: string;
    description: string;
}


export async function getTwitterList(account: string): Promise<RSSItem[]> {
    const url = `https://nitter.cz/${account}/rss`
    try {
        const response = await axios.get(url, { responseType: 'text' });

        if (response.status === 200) {
            const xml = response.data;

            const parsedXml = await new Promise((resolve, reject) => {
                parseString(xml, { explicitArray: false }, (error, result) => {
                    if (error) {
                        console.error('Error parsing XML:', error);
                        reject(error);
                    } else {
                        if (result.rss.channel.item) {
                            console.log(`RSS解析成功: ${account}`);
                            //把所有item的pubDate转化为时间戳，并且按照时间戳排序
                            result.rss.channel.item.forEach((item) => {
                                item.pubDate = parseTimestamp(item.pubDate);
                                item.description = removeHTMLTags(item.description);
                                item.title = removeHTMLTags(item.title);
                            });
                            result.rss.channel.item.sort((a: RSSItem, b: RSSItem) => {
                                return b.pubDate - a.pubDate;
                            });
                            resolve(result.rss.channel.item);
                        } else {
                            console.error('Error parsing XML:', error);
                            reject(new Error(`RSS解析失败: ${account}`));
                        }
                    }
                });
            });

            return parsedXml as RSSItem[];
        } else {
            console.error('XML file not found:', url);
            throw new Error('用户不存在'); // 手动抛出自定义错误
        }
    } catch (error) {
        if (error.response?.status === 404) {
            console.error('XML file not found:', url);
            throw new Error('用户不存在'); // 手动抛出自定义错误
        } else {
            throw new Error(`Failed to download XML: ${error}`);
        }
    }
}