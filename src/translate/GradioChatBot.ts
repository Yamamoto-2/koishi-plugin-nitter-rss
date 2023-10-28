import { GradioChatBot } from 'gradio-chatbot';

export async function GradioChatBotParse(content: string, config: any) {
    console.log(`正在使用ID: ${config.GradioChatBotModule} 模型`);
    const bot = new GradioChatBot(config.GradioChatBotModule);
    console.log(`AI翻译开始`);

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
            console.log(`AI翻译失败，正在重试(${retry}/${maxRetry})`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    throw new Error(`AI翻译失败`);
}
