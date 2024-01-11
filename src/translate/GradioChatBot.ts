import { Context } from 'koishi';
import { GradioChatBot } from 'gradio-chatbot';

export async function GradioChatBotParse(ctx: Context, content: string, config: any) {
    ctx.logger(`正在使用ID: ${config.GradioChatBotModule} 模型`);
    const bot = new GradioChatBot(config.GradioChatBotModule);
    ctx.logger(`AI翻译开始`);

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
            ctx.logger(`AI翻译失败，正在重试(${retry}/${maxRetry})`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    throw new Error(`AI翻译失败`);
}
