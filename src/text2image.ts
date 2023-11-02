import { Context } from 'koishi';

interface ImageOptions {
    text: string;
    width: number;
    backgroundColor: string;
    fontSize: number;
    font: string;
    color: string;
    padding: number; // 添加了padding作为文字周围的空白
}

export async function Text2Image(ctx: Context, options: ImageOptions, path: string) {
    const formattedText = options.text.replace(/\n/g, '<br>');
    const page = await ctx.puppeteer.page();

    // 设置视图大小
    await page.setViewport({
        width: options.width + 2 * options.padding, // 宽度加上左右padding
        height: options.fontSize * 2 + 2 * options.padding, // 高度为字体大小的两倍加上上下padding
        deviceScaleFactor: 1,
    });

    // 设置自定义HTML内容
    await page.setContent(`
    <div style="
      background: ${options.backgroundColor};
      width: ${options.width - 100}px;
      font-size: ${options.fontSize}px;
      color: ${options.color};
      font-family: ${options.font};
      text-align: left;
      line-height: ${options.fontSize * 1.5}px;
      padding-left: 70px;
      padding-right: 30px;
      padding-top: ${options.padding}px;
      word-break: break-word;
    ">
      ${formattedText}
    </div>
  `);

    // 选择器用于截图的元素
    const element = await page.$('div');

    // 如果元素存在，对其进行截图
    if (element) {
        await element.screenshot({
            path: path // 保存的图片路径和文件名
        });
    }
    return (path)
};