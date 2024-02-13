import { Context, Logger } from 'koishi'
import { createDirIfNonExist } from './downloader'
// import * as fs from 'fs';
const logger = new Logger('nitter-rss-parseLinkInfo');
import { LinkInfo } from './utils';
// const fs = require('fs').promises;
import * as fs from 'fs'; 
// import { Context } from 'vm';

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
    "Kotoha_hkll",
]

let pos: string[] = []

export async function savetodailycolumn(parsedTwitterLink: LinkInfo, cImage: Buffer): Promise<void> {
    if (hwID.includes(parsedTwitterLink.account)){
        if (!pos.includes(parsedTwitterLink.account)) pos.push(parsedTwitterLink.account);
        // 获取当天日期
        const currentDate = new Date();
        const formattedDate:string = getDate(currentDate)
        // 创建日期/ID路径
        createDirIfNonExist(`./data/hw-daily-column/${formattedDate}`);
        // 存照片
        fs.writeFile(`./data/hw-daily-column/${formattedDate}/${parsedTwitterLink.account}_${parsedTwitterLink.id}_concatImage.png`, cImage, function (err) {
            if (err) {
                logger.success("concatImage error.");
            }
            logger.success("concatImage saved.");
        });
    }
}


export async function generateheader(ctx:Context, date: string): Promise<void> {
    // const folderMap: Map<string, string[]> = await getdatefilesmap(date)
    // 填写markdown类容
    // let markdowncontent: string = `#${date}\n`
    // ![](./line.png)
    // for (const [key, values] of folderMap) {
    //     await getHeader(ctx, key, date)
    //     markdowncontent +=   `###${key}\n`
    //     for (const value of values) {
    //         markdowncontent += `![](${value})\n`
    //     }
    // fs.writeFileSync(`./data/hw-daily-column/${date}/${date}.md`, markdowncontent);
    // for (const value of pos) {
    //     await getHeader(ctx, value, date)
    // }
    logger.info(pos)
    pos = []
}
// helper
export function getDate(currentDate: Date):string{
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1; 
    const date = currentDate.getDate();
    return `${year}-${month < 10 ? '0' + month : month}-${date < 10 ? '0' + date : date}`;
}

// async function getdatefilesmap(date:string): Promise<Map<string, string[]>> {
//     const dailyPath = `./data/hw-daily-column/${date}`;
//     const folderMap = new Map<string, string[]>();

//     try {
//         const files = await fs.promises.readdir(dailyPath, { withFileTypes: true });

//         for (const file of files) {
//             if (file.isDirectory()) {
//                 const imagePath = `./data/hw-daily-column/${date}/${file.name}`;
//                 const imageFiles = await fs.promises.readdir(imagePath, { withFileTypes: true });

//                 const imagePaths = imageFiles
//                     .filter(f => !f.isDirectory()) 
//                     .map(f => `./${file.name}/${f.name}`);

//                 folderMap.set(file.name, imagePaths);
//             }
//         }
//     } catch (e) {
//         logger.success('hw 读取文件夹时发生错误:', e);
//     }
    
//     return folderMap;
// }

export async function getHeader(ctx:Context, account:string, date: string): Promise<void> {
    const url = `https://nitter.lanterne-rouge.info/${account}`;
    const page = await ctx.puppeteer.page();
    await page.setViewport({ width: 480, height: 4000 });
    await page.goto(url);
    createDirIfNonExist(`./data/hw-daily-column/${date}`);
    let screenshotData: Buffer
    let elementSelector = 'body > div > div > div.profile-banner'
    let elementHandle = await page.$(elementSelector);
    if (elementHandle) {
        screenshotData = await elementHandle.screenshot() as unknown as Buffer;
    } else {
        throw new Error(`Element "${elementSelector}" not found.`);
    }
    fs.writeFile(`./data/hw-daily-column/${date}/${account}_profile-banner.png`, screenshotData, function (err) {
        if (err) {
            return console.error(err);
        }
        logger.success("header screenshot saved.");
    });
    
    elementSelector = 'body > div.container > div > div.profile-tab.sticky > div > div.profile-card-info'
    elementHandle = await page.$(elementSelector);
    if (elementHandle) {
        screenshotData = await elementHandle.screenshot() as unknown as Buffer;
    } else {
        throw new Error(`Element "${elementSelector}" not found.`);
    }
    fs.writeFile(`./data/hw-daily-column/${date}/${account}_profile-tab.png`, screenshotData, function (err) {
        if (err) {
            return console.error(err);
        }
        logger.success("profile screenshot saved.");
    });

}