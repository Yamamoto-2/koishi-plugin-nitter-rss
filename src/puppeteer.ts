import { Context, Logger } from 'koishi'
import { } from 'koishi-plugin-puppeteer'
import * as fs from 'fs'
import * as cheerio from 'cheerio'
import { createDirIfNonExist, download } from './downloader'
import { parseTimestamp, formatLocalTime, cleanText } from './utils'

const logger = new Logger('nitter-rss-puppeteer')

export interface LinkDetail {
    extractedContent: string;
    fullname: string;
    timestamp: number,
    timeText: string;
    screenshot: Buffer;
    images: Buffer[];
}

export async function capturehtml(ctx: Context, account: string, id: string, getScreenshot: boolean, sendImage: boolean, width: number): Promise<LinkDetail> {
    //创建目录
    createDirIfNonExist(`./data/cache/nitter-rss/${account}/status/`);
    //如果文件已经存在，使用缓存
    if (fs.existsSync(`./data/cache/nitter-rss/${account}/status/${id}_screenshot.png`) && fs.existsSync(`./data/cache/nitter-rss/${account}/status/${id}_webpage.html`) && fs.existsSync(`./data/cache/nitter-rss/${account}/status/${id}_content.txt`)) {
        const screenshotData = fs.readFileSync(`./data/cache/nitter-rss/${account}/status/${id}_screenshot.png`);
        const html = fs.readFileSync(`./data/cache/nitter-rss/${account}/status/${id}_webpage.html`).toString();
        const $ = cheerio.load(html);
        const fullname = $('#m > div > div > div:nth-child(1) > div > div > div > a.fullname').text();//获取用户名
        const time_org = $('#m > div > div > p').text();//获取时间
        const timestamp = parseTimestamp(time_org);//获取时间戳
        const timeText = formatLocalTime(timestamp);//获取本地时间
        const extractedContent = fs.readFileSync(`./data/cache/nitter-rss/${account}/status/${id}_content.txt`).toString();//获取内容
        //尝试获取图片
        let images = [];
        let imageId = 0;
        if (sendImage) {
            images = await getImageFromHtml(ctx, $, account, id);
        }
        return { extractedContent: cleanText(extractedContent), fullname, timestamp, timeText, screenshot: screenshotData, images };
    }
    else {//如果文件不存在，获取网页
        const url = `https://nitter.cz/${account}/status/${id}`;//网页地址

        const page = await ctx.puppeteer.page();
        if (width) {
            await page.setViewport({ width, height: 4000 });
        }
        await page.goto(url);

        // 检测是否需要跳过检测
        const isSkip = await page.evaluate(() => {
            const form = document.querySelector('form#reqform');
            return form && form.querySelector('input[type="submit"]');
        });
        // 模拟点击跳过检测
        if (isSkip) {
            // 模拟点击跳过检测
            try {
                await page.click('form#reqform input[type="submit"]')
            }
            catch (e) {
                logger.error(e)
            }
        }

        // 刷新页面,等待页面加载完成
        await page.goto(url, { 'waitUntil': 'domcontentloaded' });

        //检测是否跳goto成功
        if (page.url() != url) {
            throw new Error(`Failed to load page: ${url}, instead loaded: ${page.url()}`);
        }

        // 删除网页内容函数
        async function removeSelectorContent(selector: string) {
            await page.evaluate((selector) => {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) {
                    element.remove();
                }
            }, selector);
        }

        // 删除网页内容
        const removeSelectors = [
            'body > nav',
            '#r',
            '#m > div > div > div:nth-child(1) > div > div > span']
        for (const selector of removeSelectors) {
            await removeSelectorContent(selector);
        }

        // 获取网页截图
        let screenshotData: Buffer;
        if (getScreenshot) {
            let elementSelector = 'body > div > div > div.main-thread'
            const elementHandle = await page.$(elementSelector);
            if (elementHandle) {
                screenshotData = await elementHandle.screenshot() as unknown as Buffer;
            } else {
                throw new Error(`Element "${elementSelector}" not found.`);
            }
            fs.writeFile(`./data/cache/nitter-rss/${account}/status/${id}_screenshot.png`, screenshotData, function (err) {
                if (err) {
                    return console.error(err);
                }
                logger.success("webpage screenshot saved.");
            });
        }

        //保存网页
        const html = await page.content(); // 获取网页的HTML内容
        fs.writeFileSync(`./data/cache/nitter-rss/${account}/status/${id}_webpage.html`, html);//保存网页
        logger.success("webpage html saved.");

        // 使用cheerio解析HTML
        const $ = cheerio.load(html);
        const fullname = $('#m > div > div > div:nth-child(1) > div > div > div > a.fullname').text();//获取用户名
        const time_org = $('#m > div > div > p').text();//获取时间
        const timestamp = parseTimestamp(time_org);//获取时间戳
        const timeText = formatLocalTime(timestamp);//获取本地时间

        //移除多余的内容
        $('.tweet-header').remove();//顶部信息
        $('.tweet-name-row').remove();//转发顶部信息
        $('.tweet-published').remove();//发布时间
        $('.tweet-stats').remove();//转发数等信息
        $('.inner-nav').remove();//导航栏
        $('.replies').remove();//回复

        // 提取指定元素的内容
        const extractedContent = $('body > div > div > div.main-thread').text();
        fs.writeFileSync(`./data/cache/nitter-rss/${account}/status/${id}_content.txt`, extractedContent);//保存内容
        let images = [];
        if (sendImage) {
            images = await getImageFromHtml(ctx, $, account, id);
        }
        return { extractedContent: cleanText(extractedContent), fullname, timestamp, timeText, screenshot: screenshotData, images };
    }
}

async function getImageFromHtml(ctx, $: cheerio.CheerioAPI, account: string, id: string) {
    //移除多余的内容

    // 保存网页的所有图片
    let imageUrls = [];

    // 保存所有原图
    $('.still-image').each((index, element) => {
        const linkUrl = $(element).attr('href');
        if (linkUrl) {
            imageUrls.push(linkUrl);
        }
    });

    // 如果没有原图，尝试获取所有图片素材
    if (imageUrls.length == 0) {

        $('.tweet-header').remove();//顶部信息
        $('.tweet-name-row').remove();//转发顶部信息
        $('.tweet-published').remove();//发布时间
        $('.tweet-stats').remove();//转发数等信息
        $('.inner-nav').remove();//导航栏
        $('.replies').remove();//回复
        $('img').each((index, element) => {
            const imageUrl = $(element).attr('src');
            if (imageUrl) {
                imageUrls.push(imageUrl);
            }
        });
    }
    let imageId = 0;
    let images = [];

    for (const imageUrl of imageUrls) {
        try {
            let imageBuffer: Buffer
            if (fs.existsSync(`./data/cache/nitter-rss/${account}/status/${id}_images_${imageId}.png`)) {
                imageBuffer = fs.readFileSync(`./data/cache/nitter-rss/${account}/status/${id}_images_${imageId}.png`);
            }
            else {
                imageBuffer = await download(ctx, `https://nitter.cz${imageUrl}`, `./data/cache/nitter-rss/${account}/status/`, `${id}_images_${imageId}.png`)
            }
            // 下载图片并保存到文件
            images.push(imageBuffer);
            imageId++;
        }
        catch (e) {
            logger.error(e)
        }
    }
    return images;
}

