import { Context, Logger, Schema } from 'yumeri';
import { ProxyAgent } from 'proxy-agent';
import * as http from 'http';
import * as https from 'https';

const logger = new Logger("proxy-agent");

export const usage = `简单、直接地为 Node.js 进程设置全局 HTTP/SOCKS 代理。`;

export interface ProxyAgentConfig {
  proxyUrl: string;
}

export const config: Schema<ProxyAgentConfig> = Schema.object({
  proxyUrl: Schema.string('代理地址 (支持 http/https/socks5)')
    .default("http://127.0.0.1:7890")
    .required(),
});

let originalHttpAgent: any = http.globalAgent;
let originalHttpsAgent: any = https.globalAgent;

export async function apply(ctx: Context, cfg: ProxyAgentConfig) {
  const { proxyUrl } = cfg;

  try {
    const agent = new ProxyAgent({ getProxyForUrl: () => proxyUrl });
    (http as any).globalAgent = agent;
    (https as any).globalAgent = agent;

    logger.info(`已开启全局代理: ${proxyUrl}`);
  } catch (err) {
    logger.error(`代理设置失败: ${(err as Error).message}`);
  }
}

export async function disable(ctx: Context) {
  // 恢复原始 Agent
  (http as any).globalAgent = originalHttpAgent;
  (https as any).globalAgent = originalHttpsAgent;
  logger.info('已关闭全局代理并恢复默认设置。');
}
