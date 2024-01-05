import { h, Context } from 'koishi';
import { capturehtml, LinkDetail } from './puppeteer';
import { LinkInfo } from './utils';
import { GradioChatBotParse } from './translate/GradioChatBot'
import { ChatGPTParse } from './translate/ChatGPT'
import { Text2Image } from './text2image'
import * as fs from 'fs';
import * as path from 'path';
interface Config {
    translateType: string
    screenshot: boolean
    sendImage: boolean
    sendLink: boolean
    sendNewTweetAlert: boolean
    GradioChatBotModule: string
    GradioChatBotPrompt: string
    ChatGPTKey: string
    ChatGPTModule: string
    ChatGPTPrompt: string
    ChatGPTBaseUrl: string
    timeInterval: number
    sendingInterval: number
    translateTimeout: number
    skipRetweet: boolean
    text2image: boolean
}

export async function parseLinkInfo(ctx: Context, parsedTwitterLink: LinkInfo, config: Config, translate: boolean, forceTranslate: boolean = false): Promise<Array<string | h>> {
    let finalText = '';
    let content: LinkDetail;

    // 获取推文内容
    try {
        content = await capturehtml(ctx, parsedTwitterLink.account, parsedTwitterLink.id, config.screenshot, config.sendImage, 480);
        finalText += content.fullname + '\n' + content.timeText;
    } catch (e) {
        console.log(e)
        return ([`获取推文内容失败`]);
    }

    // 翻译
    const translationPromise = new Promise(async (resolve, reject) => {
        const translateTextPath = `./data/cache/nitter-rss/${parsedTwitterLink.account}/status/${parsedTwitterLink.id}_translate.txt`
        try {
            let parsedText = '';
            if (fs.existsSync(translateTextPath) && !forceTranslate) {
                console.log('使用翻译文本缓存');
                parsedText = fs.readFileSync(translateTextPath, 'utf8'); // 确保正确读取文件内容
            }
            else if (config.translateType === 'gradio-chatbot') {
                parsedText = await GradioChatBotParse(`${config.GradioChatBotPrompt}\n${content.extractedContent}`, config);
                fs.writeFileSync(translateTextPath, parsedText);
            }
            // ChatGPT
            else if (config.translateType === 'ChatGPT') {
                parsedText = await ChatGPTParse(`${config.ChatGPTPrompt}\n${content.extractedContent}`, config.ChatGPTKey, config.ChatGPTBaseUrl, config.ChatGPTModule);
                fs.writeFileSync(translateTextPath, parsedText);
            }
            // 不翻译
            else {
                parsedText = content.extractedContent;
            }
            resolve(parsedText);
        } catch (e) {
            reject(e);
        }
    });

    // 定义一个超时标志
    let isTimeout = false;

    // 设置超时 Promise
    const timeoutPromise = new Promise((resolve, reject) => {
        setTimeout(() => {
            isTimeout = true; // 设置超时标志
            reject(new Error('翻译超时'));
        }, config.translateTimeout * 1000); // 超时时间
    });

    //如果 content.extractedContent 只有空格和换行符，直接返回
    if (content.extractedContent.replace(/\s/g, '') == '') {
        finalText += `\n`;
    }
    else if (translate) {
        try {
            const parsedText = await Promise.race([translationPromise, timeoutPromise]) as string;
            if (!isTimeout) {
                finalText += `\n翻译结果:\n${parsedText}`;
            }
        } catch (e) {
            if (!isTimeout) { // 如果不是因为超时导致的错误
                console.log(e);
                finalText += `\n翻译失败:${e.message}\n原文:\n${content.extractedContent}`;
            }
        }
    }
    else {
        finalText += `\n原文:\n${content.extractedContent}`;
    }
    let final: Array<string | h> = []
    if (config.text2image) {
        const text2imagePath = `./data/cache/nitter-rss/${parsedTwitterLink.account}/status/${parsedTwitterLink.id}_translate.png`
        const ImageOptions = {
            text: finalText,
            width: 480,
            backgroundColor: '#161616',
            fontSize: 16,
            font: `Helvetica, Arial, sans-serif`,
            color: '#ffffff',
            padding: 15,
        }
        // 如果已经有图片
        let text2imageBuffer: Buffer
        if (fs.existsSync(text2imagePath) && !forceTranslate) {
            console.log('使用翻译图片缓存')
            text2imageBuffer = fs.readFileSync(text2imagePath)
        } else {
            text2imageBuffer = fs.readFileSync(await Text2Image(ctx, ImageOptions, text2imagePath))
        }
        const concatImagesBuffer = await concatImages(ctx, [text2imageBuffer, content.screenshot])
        final = [h.image(concatImagesBuffer, 'image/png')]
    } else {
        final = [finalText, h.image(content.screenshot, 'image/png')];
    }
    if (content.images.length > 0) {
        for (let i = 0; i < content.images.length; i++) {
            final.push(h.image(content.images[i], 'image/png'));
        }
    }
    if (config.sendLink) {
        final.push(`https://twitter.com/${parsedTwitterLink.account}/status/${parsedTwitterLink.id}`);
    }
    // 发送消息
    console.log(`处理完成${parsedTwitterLink.account}/status/${parsedTwitterLink.id}`);
    return final;
}

const concatImages = async (ctx: Context, imageBuffers: Buffer[]): Promise<Buffer> => {
    const page = await ctx.puppeteer.page();

    // 创建一个包含所有图片的HTML内容
    const imagesHtml = imageBuffers.map((buffer, index) => {
        const base64Image = buffer.toString('base64');
        return `<img src="data:image/png;base64,${base64Image}" style="width: 100%; margin: 0; padding: 0; border: none; display: block;">`;
    }).join('');

    // 设置页面的HTML内容
    await page.setContent(`
    <style>
      * {
        margin: 0;
        padding: 0;
      }
      body {
        margin: 0;
        padding: 0;
        background: transparent;
        width: 100vw;
      }
    </style>
    <div style="width: 100%; background: transparent;">
      ${imagesHtml}
    </div>
  `, { waitUntil: 'load' });

    // 等待所有图片加载完成
    await page.evaluate(() => new Promise<void>((resolve) => {
        let images = document.querySelectorAll('img');
        let loaded = images.length;
        images.forEach((image) => {
            if (image.complete) {
                loaded--;
            } else {
                image.addEventListener('load', () => {
                    loaded--;
                    if (loaded === 0) resolve();
                });
            }
        });
        if (loaded === 0) resolve();
    }));

    // 设置一个非常高的高度以确保所有内容被包括
    await page.setViewport({
        width: 600, // 假设所有图片都有600px宽
        height: 10000, // 临时设置一个足够大的值
        deviceScaleFactor: 1,
    });

    // 选择包含所有图片的div元素
    const element = await page.$('div');

    // 对选定的元素进行截图，Puppeteer将自动裁剪
    const screenshotBuffer = await element.screenshot({
        omitBackground: true // 确保背景透明
    });

    return screenshotBuffer;
};