import { Context, Schema, h, Session, Channel } from 'koishi'
import { parseLinkInfo } from './parseLinkInfo'
import { parseTwitterLink, formatLocalTime } from './utils'
import { getTwitterList, RSSItem } from './RSS'
export const name = 'nitter-rss'

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

// 配置字段
export const Config = Schema.intersect([
  Schema.object({
    translateType: Schema.union(['不翻译',/* '翻译API', */'gradio-chatbot', 'ChatGPT']).default('不翻译').description('翻译类型'),
    screenshot: Schema.boolean().default(true).description('是否在发送消息时发送截图'),
    sendImage: Schema.boolean().default(false).description('是否在发送消息时单独发送推文内所有图片素材'),
    sendLink: Schema.boolean().default(true).description('是否在发送消息时发送推文链接'),
    sendNewTweetAlert: Schema.boolean().default(false).description('是否在发现新推文时发送消息提醒，以避免转发失败时毫无消息'),
    timeInterval: Schema.number().role('slider').min(5).max(240).step(1).default(5).description('每次检测新推文时间间隔，单位为分钟'),
    sendingInterval: Schema.number().role('slider').min(5).max(240).step(1).default(20).description('每次转发推文的时间间隔，单位为秒。如果你使用ChatGPT翻译且ChatGPT API为免费版本，则一分钟只能请求3次API，请设置至少20秒以避免翻译失败'),
    translateTimeout: Schema.number().role('slider').min(5).max(240).step(1).default(60).description('获取翻译等待的超时时间，单位为秒'),
    skipRetweet: Schema.boolean().default(true).description('是否跳过转推'),
    text2image: Schema.boolean().default(false).description('是否将翻译等文本内容转为图片发送，避免文字过多触发一些平台的风控限制'),
  }).description('基础配置'),

  Schema.union([
    //gradio-chatbot
    Schema.object({
      translateType: Schema.const('gradio-chatbot').required(),
      //选择模型
      GradioChatBotModule: Schema.union([
        Schema.const('0').description('ChatGPT	https://huggingface.co/spaces/yizhangliu/chatGPT').hidden(true),
        Schema.const('1').description('GPT Free	(https://huggingface.co/spaces/justest/gpt4free)'),
        Schema.const('2').description('Llama2 Spaces(不推荐)  (https://huggingface.co/spaces/ysharma/Explore_llamav2_with_TGI)'),
        Schema.const('3').description('MosaicML MPT-30B-Chat  	(https://huggingface.co/spaces/mosaicml/mpt-30b-chat)'),
        Schema.const('4').description('Falcon Chat  (https://huggingface.co/spaces/HuggingFaceH4/falcon-chat)'),
        Schema.const('5').description('Star Chat  (https://huggingface.co/spaces/HuggingFaceH4/starchat-playground)'),
        Schema.const('6').description('ChatGLM2(不推荐)    (https://huggingface.co/spaces/mikeee/chatglm2-6b-4bit)'),
        Schema.const('7').description('ChatGLM(不推荐)   	(https://huggingface.co/spaces/multimodalart/ChatGLM-6B)'),
        Schema.const('8').description('Vicuna (https://chat.lmsys.org/)'),
        Schema.const('9').description('通义千问 7B  	(https://huggingface.co/spaces/mikeee/qwen-7b-chat)'),
        Schema.const('10').description('通义千问  (https://modelscope.cn/studios/qwen/Qwen-7B-Chat-Demo/summary)'),
        Schema.const('11').description('ChatGLM2(不推荐)   (https://modelscope.cn/studios/AI-ModelScope/ChatGLM6B-unofficial/summary)'),
        Schema.const('12').description('姜子牙V1.1(不推荐)  	(https://modelscope.cn/studios/Fengshenbang/Ziya_LLaMA_13B_v1_online/summary)'),
        Schema.const('13').description('达魔院(不推荐)   (https://modelscope.cn/studios/damo/role_play_chat/summary)'),
      ]).role('radio').description('AI模型选择'),
      //提示词
      GradioChatBotPrompt: Schema.string().description('gradio-chatbot用提示词，将被放在内容前面').default('请帮我将推文内容翻译成简体中文。所有疑似专有名词，人名，曲名与书名等的内容请保留原文，带有#的关键词请不要翻译。你的回答将被直接输入数据库，请不要提供翻译结果以外的任何内容。以下是需要翻译的内容:\n'),
    }).description('gradio-chatbot配置'),

    //ChatGPT
    Schema.object({
      translateType: Schema.const('ChatGPT').required(),
      //apiUrl
      ChatGPTBaseUrl: Schema.string().description('ChatGPT API Url, 必填').default('https://api.openai.com/v1'),
      //apiKey
      ChatGPTKey: Schema.string().description('ChatGPT API Key, 必填').default(''),
      //选择模型
      ChatGPTModule: Schema.union([
        Schema.const('gpt-3.5-turbo').description('gpt-3.5-turbo'),
        Schema.const('gpt-4').description('gpt-4'),
      ]).role('radio').description('ChatGPT模型选择，必选，只有付费账号支持gpt4'),
      //提示词
      ChatGPTPrompt: Schema.string().description('ChatGPT用提示词，将被放在内容前面').default('请帮我将推文内容翻译成简体中文。所有疑似专有名词，人名，曲名与书名等的内容请保留原文，带有#的关键词请不要翻译。你的回答将被直接输入数据库，请不要提供翻译结果以外的任何内容。以下是需要翻译的内容:\n'),
    }).description('ChatGPT配置'),
    Schema.object({}),
  ]),
])

interface twitterAccount {
  account: string
  translate: boolean
}

// 为 Channel 添加字段
declare module 'koishi' {
  interface Channel {
    twitterAccounts: twitterAccount[]
  }
}

// apply主函数
export function apply(ctx: Context, config: Config) {
  ctx.model.extend("channel",
    {
      'twitterAccounts': { type: 'json', initial: [] }
    }
  );
  console.log(config)
  //获取所有需要转发的账号
  function getAllAccounts(channels: Channel[]): twitterAccount[] {
    const accounts = [];
    channels.forEach(channel => {
      if (channel.twitterAccounts) {
        channel.twitterAccounts.forEach(account => {
          if (!accounts.some(item => item.account === account.account)) {
            accounts.push({
              account: account.account,
              translate: account.translate
            });
          } else {
            //如果已经存在，且translate为true，则改为true
            const existingAccount = accounts.find(item => item.account === account.account);
            if (account.translate) {
              existingAccount.translate = true;
            }
          }
        });
      }
    });
    return accounts;
  }

  let accountsLastUpdateTimeList = {};
  //获取时间范围内的所有推文:
  async function getRecentTweets(accounts: twitterAccount[]): Promise<{ rss: RSSItem; translate: boolean }[]> {
    const time = new Date();
    const allTweets: Array<{ rss: RSSItem, translate: boolean }> = [];
    for (const account of accounts) {
      let afterTime: number;
      if (!accountsLastUpdateTimeList[account.account]) {
        afterTime = time.getTime() - config.timeInterval * 60 * 1000;
        accountsLastUpdateTimeList[account.account] = afterTime;
      }
      else {
        afterTime = accountsLastUpdateTimeList[account.account];
      }
      try {
        const tweets = await getTwitterList(ctx, account.account);
        for (const tweet of tweets) {
          const tweetTime = tweet.pubDate
          const isExist = allTweets.some(item => item.rss.link === tweet.link);
          if (!isExist && tweetTime > afterTime) {
            allTweets.push({ rss: tweet, translate: account.translate });
          }
          accountsLastUpdateTimeList[account.account] = Math.max(tweetTime, accountsLastUpdateTimeList[account.account]);
        }
      } catch (error) {
        console.log(error);
      }
    }
    return allTweets.sort((a, b) => new Date(b.rss.pubDate).getTime() - new Date(a.rss.pubDate).getTime());
  }

  //发送消息
  async function sendMessages(tweets: Array<{ rss: RSSItem, translate: boolean }>, channels: Channel[], ctx: Context, config: Config) {
    for (const tweet of tweets) {
      //跳过转推
      if (tweet.rss.isRetweet && config.skipRetweet) {
        continue;
      }

      const parsedTwitterLink = await parseTwitterLink(tweet.rss.link);
      const tempAccount = parsedTwitterLink.account;
      const messageContent = await parseLinkInfo(ctx, parsedTwitterLink, config, tweet.translate);
      for (const channel of channels) {
        const botId = `${channel.platform}:${channel.assignee}`;
        if (channel.twitterAccounts && channel.twitterAccounts.some(account => account.account === tempAccount)) {
          if (config.sendNewTweetAlert) {
            ctx.bots[botId].sendMessage(channel.id, `发现新推文推文:\n${tempAccount}\n${tweet.rss.link}`);
          }
          console.log(`正在发送消息: ${tweet.rss.link}至${botId}`);
          ctx.bots[`${channel.platform}:${channel.assignee}`].sendMessage(channel.id, messageContent);
          await new Promise(resolve => {
            console.log(`正在等待${config.sendingInterval}秒`);
            setTimeout(() => resolve(''), config.sendingInterval * 1000);
          });
        }
      }
    }
  }

  let intervaling = false;
  //循环
  async function interval() {
    const time = new Date();
    console.log(`正在循环${formatLocalTime(time.getTime())}`);
    if (intervaling) {
      return;
    }
    intervaling = true;
    const channels = await ctx.database.get('channel', {});
    const accounts = getAllAccounts(channels);
    const recentTweets = await getRecentTweets(accounts);
    await sendMessages(recentTweets, channels, ctx, config);
    intervaling = false;
    console.log(`循环结束`)
  }
  ctx.setInterval(interval, config.timeInterval * 60 * 1000);
  ctx.command('开始循环', 'nitter-rss: 测试用，立刻开始转发轮询').action(async ({ session }) => {
    if (intervaling) {
      session.send(`开始循环`);
    }
    else {
      session.send(`正在循环中`);
    }
    await interval();
    session.send(`循环结束`);
  }
  )

  // 添加account到channel
  ctx.command('订阅添加 <account>', '订阅新的推特账号')
    .channelFields(['twitterAccounts'])
    .alias('订阅', '订阅推特', '添加订阅')
    .example('订阅添加 LinusTech  订阅LinusTech的推特')
    .action(async ({ session }, account) => {

      //判断是否是channel
      if (session.channel?.twitterAccounts == undefined) {
        session.send(`此命令只能在channel(群聊)中使用`);
        return;
      }
      //判断是否已经添加过
      for (let i = 0; i < session.channel.twitterAccounts.length; i++) {
        if (session.channel.twitterAccounts[i].account == account) {
          session.send(`此账号已经添加过了`);
          return;
        }
      }
      //判断账号是否存在
      try {
        await getTwitterList(ctx, account);
      } catch (e) {
        console.log(e);
        session.send(`此账号不存在`);
        return;
      }
      //添加
      session.channel.twitterAccounts.push({ account: account, translate: config.translateType != '不翻译' });
      session.send(`添加成功`);
    })

  //查询当前channel的account
  ctx.command('订阅查询', 'nitter-rss: 查询当前channel的订阅的推特账号')
    .channelFields(['twitterAccounts'])
    .alias('订阅列表', '查询订阅')
    .action(async ({ session }) => {

      //判断是否是channel
      if (session.channel?.twitterAccounts == undefined) {
        session.send(`此命令只能在channel(群聊)中使用`);
        return;
      }

      //查询
      let finalText = `当前channel订阅的推特账号有:\n`;
      for (let i = 0; i < session.channel.twitterAccounts.length; i++) {
        finalText += `${i + 1}: ${session.channel.twitterAccounts[i].account}: ${session.channel.twitterAccounts[i].translate ? '翻译' : '不翻译'} \n`;
      }
      session.send(finalText);
    })

  //删除channel的account
  ctx.command('订阅删除 <account>', 'nitter-rss: 删除当前channel的订阅的推特账号')
    .channelFields(['twitterAccounts'])
    .alias('删除订阅', '删除订阅推特', '取消订阅', '取消订阅推特')
    .example('订阅删除 LinusTech  删除LinusTech的订阅推特')

    .action(async ({ session }, account) => {

      //判断是否是channel
      if (session.channel?.twitterAccounts == undefined) {
        session.send(`此命令只能在channel(群聊)中使用`);
        return;
      }

      //删除
      for (let i = 0; i < session.channel.twitterAccounts.length; i++) {
        if (session.channel.twitterAccounts[i].account == account) {
          session.channel.twitterAccounts.splice(i, 1);
          session.send(`删除成功`);
          return;
        }
      }
      session.send(`未找到此账号`);
    })

  //调整channel的account的翻译状态为翻译
  ctx.command('订阅修改翻译 <account>', 'nitter-rss: 调整当前channel的订阅的推特账号的翻译状态为翻译')
    .channelFields(['twitterAccounts'])
    .alias('翻译订阅', '订阅翻译')
    .example('订阅修改翻译 LinusTech  调整LinusTech的订阅推特的翻译状态为翻译')
    .action(async ({ session }, account) => {

      //判断是否是channel
      if (session.channel?.twitterAccounts == undefined) {
        session.send(`此命令只能在channel(群聊)中使用`);
        return;
      }

      //调整
      for (let i = 0; i < session.channel.twitterAccounts.length; i++) {
        if (session.channel.twitterAccounts[i].account == account) {
          session.channel.twitterAccounts[i].translate = true;
          session.send(`调整成功`);
          return;
        }
      }
      session.send(`未找到此账号`);
    })

  //调整channel的account的翻译状态为不翻译
  ctx.command('订阅修改不翻译 <account>', 'nitter-rss: 调整当前channel的订阅的推特账号的翻译状态为不翻译')
    .channelFields(['twitterAccounts'])
    .alias('不翻译订阅', '订阅不翻译')
    .example('订阅修改不翻译 LinusTech  调整LinusTech的订阅推特的翻译状态为不翻译')
    .action(async ({ session }, account) => {

      //判断是否是channel
      if (session.channel?.twitterAccounts == undefined) {
        session.send(`此命令只能在channel(群聊)中使用`);
        return;
      }

      //调整
      for (let i = 0; i < session.channel.twitterAccounts.length; i++) {
        if (session.channel.twitterAccounts[i].account == account) {
          session.channel.twitterAccounts[i].translate = false;
          session.send(`调整成功`);
          return;
        }
      }
      session.send(`未找到此账号`);
    })


  // 通过account获得近期推文列表
  ctx.command('推文列表 <account>', 'nitter-rss: 获取指定account的近期4条推文')
    .channelFields(['twitterAccounts'])
    .alias('twitter-list', '推文列表', 'twitter列表', 't-l')
    .example('推文列表 LinusTech  获取LinusTech的近期4条推文')
    .action(async ({ session }, account) => {
      console.log(`正在处理推文列表: ${account}`);
      let result: RSSItem[]
      try {
        result = await getTwitterList(ctx, account);
      } catch (e) {
        console.log(e);
        session.send(`获取推文列表失败:${e.message}`);
        return;
      }
      let finalText = '';
      for (let i = 0; i < 4; i++) {
        //创建临时文本，如果result.title超过20个字符，则截断，后面换成...
        let tempText = result[i].title;
        if (tempText.length > 20) {
          tempText = tempText.substring(0, 20) + '...';
        }
        finalText += `${i + 1}: ${formatLocalTime(result[i].pubDate)}\n${tempText}\n${result[i].link}\n\n`;
      }
      session.send(finalText);
    })

  // 通过链接获得推文内容
  ctx.command('获取推文 <link>', 'nitter-rss: 获取推文内容')
    .alias('twitter', '推文', 'twitter内容', 't')
    .option('forceUpdate', '-f', { fallback: false })
    .example('获取推文 https://twitter.com/LinusTech/status/1716561166288453951 获取链接的推文内容\ntwitter https://nitter.cz/LinusTech/status/1716561166288453951  获取链接的推文内容\ntwitter https://nitter.cz/LinusTech/status/1716561166288453951 -f  获取链接的推文内容，强制重新翻译')
    .action(async ({ session, options }, link, forceTranslate) => {
      console.log(`正在处理链接: ${link}`);
      const parsedTwitterLink = await parseTwitterLink(link);
      if (!parsedTwitterLink.isTwitterLink) {
        session.send(`链接格式不正确`);
        return;
      }
      session.send(`正在处理`);
      return (await parseLinkInfo(ctx, parsedTwitterLink, config, config.translateType != '不翻译', options.forceUpdate));
    });
}


