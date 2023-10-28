import { h } from 'koishi';
import { capturehtml, LinkDetail } from './puppeteer';
import { LinkInfo } from './utils';
import { GradioChatBotParse } from './translate/GradioChatBot'
import { ChatGPTParse } from './translate/ChatGPT'
import * as fs from 'fs';
interface Config {
    translateType: string
    screenshot: boolean
    sendImage: boolean
    GradioChatBotModule: string
    GradioChatBotPrompt: string
    ChatGPTKey: string
    ChatGPTModule: string
    ChatGPTPrompt: string
    ChatGPTBaseUrl: string
}

export async function parseLinkInfo(parsedTwitterLink: LinkInfo, config: Config, translate: boolean): Promise<Array<string | h>> {
    let finalText = '';
    let content: LinkDetail;

    // 获取推文内容
    try {
        content = await capturehtml(parsedTwitterLink.account, parsedTwitterLink.id, config.screenshot, config.sendImage, 480);
        finalText += content.fullname + '\n' + content.timeText;
    } catch (e) {
        return ([`获取推文内容失败`]);
    }

    // 翻译
    const translationPromise = new Promise(async (resolve, reject) => {
        try {

            let parsedText = '';
            // gradio-chatbot
            if (config.translateType === 'gradio-chatbot') {
                parsedText = await GradioChatBotParse(`${config.GradioChatBotPrompt}\n${content.extractedContent}`, config);
            }
            // ChatGPT
            else if (config.translateType === 'ChatGPT') {
                parsedText = await ChatGPTParse(`${config.ChatGPTPrompt}\n${content.extractedContent}`, config.ChatGPTKey, config.ChatGPTBaseUrl, config.ChatGPTModule);
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

    // 使用Promise.race来设置超时
    const timeoutPromise = new Promise((resolve, reject) => {
        setTimeout(() => {
            reject(new Error('翻译超时'));
        }, 60000); // 60秒超时时间
    });

    //如果 content.extractedContent 只有空格和换行符，直接返回
    if (content.extractedContent.replace(/\s/g, '') == '') {
        finalText += `\n`;
    }
    else if (translate) {
        //如果已经有翻译
        if (fs.existsSync(`./data/cache/nitter-rss/${parsedTwitterLink.account}/status/${parsedTwitterLink.id}_translate.txt`)) {
            finalText += `\n翻译结果:\n${fs.readFileSync(`./data/cache/nitter-rss/${parsedTwitterLink.account}/status/${parsedTwitterLink.id}_translate.txt`).toString()}`;
        }
        else {
            // 等待翻译结果或超时
            try {
                const parsedText = await Promise.race([translationPromise, timeoutPromise]);
                finalText += `\n翻译结果:\n${parsedText}`;
                fs.writeFileSync(`./data/cache/nitter-rss/${parsedTwitterLink.account}/status/${parsedTwitterLink.id}_translate.txt`, parsedText as string);
            } catch (e) {
                console.log(e);
                finalText += `翻译失败:${e.message}\n原文:\n${content.extractedContent}`;
            }
        }
    }
    else {
        finalText += `\n原文:\n${content.extractedContent}`;
    }


    let final = [finalText, h.image(content.screenshot, 'image/png')];
    if (content.images.length > 0) {
        for (let i = 0; i < content.images.length; i++) {
            final.push(h.image(content.images[i], 'image/png'));
        }
    }
    final.push(`https://twitter.com/${parsedTwitterLink.account}/status/${parsedTwitterLink.id}`);
    // 发送消息
    console.log(`处理完成${parsedTwitterLink.account}/status/${parsedTwitterLink.id}`);
    return final;
}