import { Context, Logger } from 'koishi'
import { GradioChatBot } from 'gradio-chatbot';

const logger = new Logger('nitter-rss-gradio-chatbot');

export async function GradioChatBotParse(content: string, config: any) {
    logger.info(`正在使用ID: ${config.GradioChatBotModule} 模型`);
    const bot = new GradioChatBot(config.GradioChatBotModule);
    logger.info(`AI翻译开始`);

    const maxRetry = 3;
    let retry = 0;

    while (retry < maxRetry) {
        try {
            const result = await bot.chat(`${content}`);
            if (result == '') {
                throw new Error(`AI翻译失败`);
            }
            return result;
        } catch (e) {
            retry++;
            logger.warn(`AI翻译失败，正在重试(${retry}/${maxRetry})`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    throw new Error(`AI翻译失败`);
}
