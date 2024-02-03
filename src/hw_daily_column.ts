import {Logger } from 'koishi'
import { createDirIfNonExist } from './downloader'
const logger = new Logger('nitter-rss-parseLinkInfo');
import { LinkInfo } from './utils';
const fs = require('fs').promises;

// for honeywork only
const hwID: string[] = [
    "HoneyWorks_828",
    "HoneyWorks_Game",
    "mona_4_24",
    "takanenofficial",
    "Karennaivory",
    "CHiCOxxx_tweet",
    "HaKoniwalily",
    "FT4_official",
    "LIP_LIP_222",
    "HoneyWorksMovie",
    "Hanon_moco",
    "Kotoha_ktnh",
    "_Gom_",
    "yamako2626",
    "shito_stereo",
    "Touka_moru04",
    "dolce5_official",
    "mogelatte",
    "aiceclass",
    "Hanon_moco_sub",
    "Karennaivory",

]

export async function savetodailycolumn(parsedTwitterLink: LinkInfo, cImage: Buffer): Promise<void> {
    if (hwID.includes(parsedTwitterLink.account)){
        // 获取当天日期
        const currentDate = new Date();
        const formattedDate:string = getDate(currentDate)
        // 创建日期/ID路径
        createDirIfNonExist(`./data/hw-daily-column/${formattedDate}/${parsedTwitterLink.account}`);
        // 存照片
        fs.writeFile(`./data/hw-daily-column/${formattedDate}/${parsedTwitterLink.account}/${parsedTwitterLink.id}_concatImage.png`, cImage, function (err) {
            if (err) {
                logger.success("concatImage error.");
            }
            logger.success("concatImage saved.");
        });
    }
}


export async function generatemarkdownfile(date: string): Promise<void> {
    const folderMap: Map<string, string[]> = await getdatefilesmap(date)
    // 填写markdown类容
    let markdowncontent: string = `#${date}\n`
    // ![](./line.png)
    for (const [key, values] of folderMap) {
        markdowncontent +=   `###${key}\n`
        for (const value of values) {
            markdowncontent += `![](${value})\n`
        }
    }
    fs.writeFile(`./data/hw-daily-column/${date}/${date}.md`, markdowncontent, function (err) {
        if (err) {
            logger.success("markdowncontent  error.");
        }
        logger.success("markdowncontent saved.");
    });
}
// helper
export function getDate(currentDate: Date):string{
    const month = currentDate.getMonth() + 1; 
    const date = currentDate.getDate();
    return `${month < 10 ? '0' + month : month}-${date < 10 ? '0' + date : date}`;
}


async function getdatefilesmap(date:string): Promise<Map<string, string[]>> {
    const dailyPath = `./data/hw-daily-column/${date}`;
    const folderMap = new Map<string, string[]>();
    try {
        const files = await fs.readdir(dailyPath, { withFileTypes: true });
        for (const file of files) {
            if (file.isDirectory()) {
                const imagePath = `./data/hw-daily-column/${date}/${file.name}`;
                const imageFiles = await fs.readdir(imagePath, { withFileTypes: true });
                const imagePaths = imageFiles
                .filter(f => !f.isDirectory()) 
                .map(f => `/${file.name}/${f.name}`); 
                folderMap.set(file.name, imagePaths);
            }
        }
    } catch (e) {
        logger.success('hw 读取文件夹时发生错误:');
    }
    return folderMap;
}

