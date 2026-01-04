import { Context, Logger, Schema } from 'yumeri';
import { ProxyAgent } from 'proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { HttpProxyAgent } from 'http-proxy-agent';
import * as http from 'http';
import * as https from 'https';

const logger = new Logger("proxy-agent");

export const usage = `为 Yumeri 启动的 Node.js 进程设置全局 HTTP/SOCKS5 代理。`;

export interface ProxyAgentConfig {
  proxyUrl: string;
}

export const config: Schema<ProxyAgentConfig> = Schema.object({
  proxyUrl: Schema.string('代理 URL (例如 http://localhost:8080 或 socks5://localhost:1080)').default("http://localhost:8080").required(),
});

let restoreHttp: (() => void) | null = null;
let restoreHttps: (() => void) | null = null;

function wrapModuleWithAgent(
  mod: typeof http | typeof https,
  agent: any
): () => void {
  const originalRequest = mod.request;
  const originalGet = mod.get;

  mod.request = function patchedRequest(
    options: any,
    ...rest: any[]
  ): any {
    const normalized =
      typeof options === 'string' || options instanceof URL
        ? { ...new URL(options as any) }
        : { ...options };

    if (!normalized.agent) {
      normalized.agent = agent;
    }

    return (originalRequest as any).call(mod, normalized, ...rest);
  } as any;

  mod.get = function patchedGet(
    options: any,
    ...rest: any[]
  ): any {
    const req = (mod.request as any)(options, ...rest);
    req.end();
    return req;
  } as any;

  return () => {
    mod.request = originalRequest as any;
    mod.get = originalGet as any;
  };
}

export async function apply(ctx: Context, config: ProxyAgentConfig) {
  const { proxyUrl } = config;

  if (!proxyUrl) {
    logger.error('Proxy URL is not configured.');
    return;
  }

  // 创建 HTTP/HTTPS 代理 agent
  const httpAgent = new HttpProxyAgent(proxyUrl);
  const httpsAgent = new HttpsProxyAgent(proxyUrl);

  // 用 httpAgent/httpsAgent 创建 ProxyAgent
  const agent = new ProxyAgent({ httpAgent, httpsAgent });

  // 为 http/https 请求默认注入代理（避免直接写 globalAgent 只读报错）
  restoreHttp = wrapModuleWithAgent(http, agent);
  restoreHttps = wrapModuleWithAgent(https, agent);

  logger.info(`Global proxy agent set to: ${proxyUrl}`);
}

export async function disable(ctx: Context) {
  if (restoreHttp) {
    restoreHttp();
    restoreHttp = null;
  }
  if (restoreHttps) {
    restoreHttps();
    restoreHttps = null;
  }
  logger.info('Global proxy agent has been removed.');
}
