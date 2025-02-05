import {Awaitable, Context, Schema, Service} from 'koishi'

export const name = 'openai'


export interface Retouch {
  prompt: string
  replace: string
}

export interface Config {
  url: string
  token: string
  model: string
  retouch: Retouch
}

export const Config: Schema<Config> = Schema.object({
  url: Schema.string().description('API地址').default('http://localhost:11434/v1'),
  token: Schema.string().description('认证 Token'),
  model: Schema.string().description('模型名称').default('gemma2:9b'),
  retouch: Schema.object({
    prompt: Schema.string().description('提示词').role('textarea', { rows: [2, 4] }).default("以猫娘的形式回复"),
    replace: Schema.string().description('替换内容,仅在需要时使用').default(''),
  }).description("润色配置")
})

export function apply(ctx: Context, config: Config) {
  ctx.plugin(AITools,config)
}

export class AITools extends Service {

  constructor(ctx: Context,config: Config) {
    super(ctx, 'ai')
    ctx.logger.info(JSON.stringify(config))
  }

  protected start(): Awaitable<void> {
    this.ctx.logger.info('Starting...')
    return super.start();
  }

  protected stop(): Awaitable<void> {
    this.ctx.logger.info('Stopping...')
    return super.stop();

  }
}
declare module 'koishi' {
  interface Context {
    ai: AITools
  }
}
