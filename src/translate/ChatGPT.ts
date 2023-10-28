import OpenAI from "openai";

export async function ChatGPTParse(prompt: string, apiKey: string, baseURL: string, model: string): Promise<string> {
  if (apiKey == '' || apiKey == undefined) {
    throw new Error(`ChatGPT API Key为空`);
  }
  console.log(`ChatGPT翻译开始`)
  const openai = new OpenAI({
    baseURL: baseURL,
    apiKey: apiKey,
  });
  let response = ''
  const chatCompletion = await openai.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: model,
  });
  response += chatCompletion.choices[0].message.content
  if (response == '') {
    throw new Error(`ChatGPT翻译失败`);
  }
  if (chatCompletion.choices[0].finish_reason == 'length') {
    response += '\n...'
  }
  return response;
}