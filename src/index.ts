import {Awaitable, Context, h, Schema, Service} from 'koishi'
import OpenAI from 'openai';

export const name = 'openai'

let bind: AITools

export interface ConfigModel {
  model: string
  prompt: string
  clear: string
}

export interface Config {
  url: string
  token: string
  retouch: ConfigModel
  ask: ConfigModel
  zip: number,
  debug: boolean
  direct:boolean
}

export const Config: Schema<Config> = Schema.object({
  url: Schema.string().description('API地址').default('http://localhost:11434/v1'),
  token: Schema.string().description('认证 Token'),
  debug: Schema.boolean().description('调试模式').default(false),
  direct: Schema.boolean().description('直通模式（原样输出）').default(false),
  retouch: Schema.object({
    model: Schema.string().description('模型名称').default('gemma2:9b'),
    prompt: Schema.string().description('提示词')
      .role('textarea', {rows: [2, 4]})
      .default("将输入内容转为以雌小鬼猫娘的口吻"),
    clear: Schema.string().description('清理内容,仅在需要时使用').default(''),
  }).description("润色配置"),
  ask: Schema.object({
    model: Schema.string().description('模型名称').default('gemma2:9b'),
    prompt: Schema.string().description('提示词')
      .role('textarea', {rows: [2, 4]})
      .default("请站在比较专业的角度回复"),
    clear: Schema.string().description('清理内容,仅在需要时使用').default(''),
  }).description("提问配置"),
  zip: Schema.number().description('折叠大小').default(30)
})


export function apply(ctx: Context, config: Config) {
  ctx.plugin(AITools, config);
  ctx.command('openai.ask.set-model <message>', {
    authority: 4
  }).action(function (_, message: string) {
    const msg = `提问模型已由 ${config.ask.model} 临时切换到 ${message}`;
    config.ask.model = message
    return msg
  })
  ctx.command('openai.retouch.set-model <message>', {
    authority: 4
  }).action(function (_, message: string) {
    const msg = `润色模型已由 ${config.retouch.model} 临时切换到 ${message}`;
    config.retouch.model = message
    return msg
  })
  ctx.command('openai.ask <message>', {
    authority: 4
  }).action(async function (c, message: string) {
    ctx.logger.info("收到消息", message);
    const rel = await bind.ask(message);
    if (rel.length > config.zip){
      return `<message forward>
   <message><author id="${c.session.userId}" name="${c.session.username}"/>${message}</message>
   <message><author id="${c.session.bot.user.id}"/>${rel}</message>
</message>`
    }else {
      return h('at',{id:c.session.userId}) + rel
    }
  })
}

export class AITools extends Service {
  private cfg: Config
  private openAIClient: OpenAI

  constructor(ctx: Context, config: Config) {
    super(ctx, 'ai')
    this.cfg = config
  }

  protected start(): Awaitable<void> {
    bind = this
    this.openAIClient = new OpenAI({
      baseURL: this.cfg.url,
      apiKey: this.cfg.token,
    })
    return super.start();
  }

  protected stop(): Awaitable<void> {
    this.openAIClient = null;
    bind = null
    return super.stop();
  }

  async ask(src: string) {
    if (this.cfg.direct) {
      return src
    }
    let result = await this.openAIClient.chat.completions.create({
      model: this.cfg.ask.model,
      messages: [{
        role: 'system', content: this.cfg.ask.prompt,
      }, {
        role: 'user',
        content: src,
      }],
      stream: false,
    })
    let rel = result.choices[0].message.content.replaceAll(new RegExp(
      this.cfg.ask.clear,
      "g",
    ), '')

    if (this.cfg.debug) {
      this.ctx.logger.info(JSON.stringify(result, null, 2))
      rel = rel + `\n\n模型: ${this.cfg.ask.model}\n消耗 tokens: ${result.usage.total_tokens}\n`
    }
    return rel;
  }

  async retouch(src: string, ...args: string[]) {
    if (this.cfg.direct) {
      for (let index = 0; index < args.length; index++) {
        src = src.replaceAll(`{${index}}`, args[index])
      }
      return src
    }
    let result = await this.openAIClient.chat.completions.create({
      model: this.cfg.retouch.model,
      messages: [{
        role: 'system', content: this.cfg.retouch.prompt,
      }, {
        role: 'user',
        content: src,
      }],
      stream: false,
    })

    let rel = result.choices[0].message.content
      .replaceAll(new RegExp(
        this.cfg.retouch.clear,
        "g",
      ), '')
    for (let index = 0; index < args.length; index++) {
      rel = rel.replaceAll(`{${index}}`, args[index])
    }
    if (this.cfg.debug) {
      this.ctx.logger.info(JSON.stringify(result, null, 2))
      rel = rel + `\n\n原文: ${src}\n模型: ${this.cfg.retouch.model}\n消耗 tokens: ${result.usage.total_tokens}\n`
    }
    return rel;
  }
}

declare module 'koishi' {
  interface Context {
    ai: AITools
  }
}
