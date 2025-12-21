import { Context, Logger, Schema } from 'yumeri';
import { ProxyAgent } from 'proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { HttpProxyAgent } from 'http-proxy-agent';

const logger = new Logger("proxy-agent");

export const usage = `为 Yumeri 启动的 Node.js 进程设置全局 HTTP/SOCKS5 代理。`;

export interface ProxyAgentConfig {
  proxyUrl: string;
}

export const config: Schema<ProxyAgentConfig> = Schema.object({
  proxyUrl: Schema.string('代理 URL (例如 http://localhost:8080 或 socks5://localhost:1080)').default("http://localhost:8080").required(),
});

let originalHttpAgent: any;
let originalHttpsAgent: any;

export async function apply(ctx: Context, config: ProxyAgentConfig) {
  const { proxyUrl } = config;

  if (!proxyUrl) {
    logger.error('Proxy URL is not configured.');
    return;
  }

  // 保存原始 agent
  originalHttpAgent = require('http').globalAgent;
  originalHttpsAgent = require('https').globalAgent;

  // 创建 HTTP/HTTPS 代理 agent
  const httpAgent = new HttpProxyAgent(proxyUrl);
  const httpsAgent = new HttpsProxyAgent(proxyUrl);

  // 用 httpAgent/httpsAgent 创建 ProxyAgent
  const agent = new ProxyAgent({ httpAgent, httpsAgent });

  // 设置全局 agent
  require('http').globalAgent = agent;
  require('https').globalAgent = agent;

  logger.info(`Global proxy agent set to: ${proxyUrl}`);
}

export async function disable(ctx: Context) {
  if (originalHttpAgent) require('http').globalAgent = originalHttpAgent;
  if (originalHttpsAgent) require('https').globalAgent = originalHttpsAgent;
  logger.info('Global proxy agent has been removed.');
}
