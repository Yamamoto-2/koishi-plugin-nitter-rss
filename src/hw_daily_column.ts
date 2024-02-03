import {Logger } from 'koishi'
import { createDirIfNonExist } from './downloader'
import * as fs from 'fs';
const logger = new Logger('nitter-rss-parseLinkInfo');
import { LinkInfo } from './utils';

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
        const month = currentDate.getMonth() + 1; 
        const date = currentDate.getDate();
        const formattedDate = `${month < 10 ? '0' + month : month}-${date < 10 ? '0' + date : date}`;
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
function isImageFile(fileName: string): boolean {
    return /\.(jpg|jpeg|png|gif)$/.test(fileName.toLowerCase());
}

async function getdatefilesmap(date:string): Promise<Map<string, string[]>>{
    const dailyPath = `./data/hw-daily-column/${date}`
    const folderMap = new Map<string, string[]>();
    // 获取日期文件夹里的所有发过推的id，并将图片的路径保存下来
    try{
        fs.readdir(dailyPath, { withFileTypes: true }, (files) => {        
            files.forEach(async (filename) => {
                if (filename.isDirectory()) {
                    let imageFiles: string[] = [];
                    // 查找图片文件路径
                    const temp = await fs.readdir(`./data/hw-daily-column/${date}/${filename}`, { withFileTypes: true });
                    for (const file of temp){
                        if (file.isFile() && isImageFile(file.name)) {
                            // 如果是图片文件，添加到列表
                            imageFiles.push(`./data/hw-daily-column/${date}/${filename}/${file.name}`);
                        }
                    }
                    folderMap.set(filename,imageFiles)
                }
            });
        });
    } catch (e){
        logger.info('hw 读取文件夹时发生错误:', e);
    }
    return folderMap
}
    

