import { NextRequest, NextResponse } from "next/server";
import { OPENAI_BASE_URL, ServiceProvider } from "../constant";
import { cloudflareAIGatewayUrl } from "../utils/cloudflare";
import { getModelProvider } from "../utils/model";
import type { ProviderRuntimeConfig } from "../server/provider-runtime";

export async function requestOpenai(
  req: NextRequest,
  useServerConfig?: boolean,
  subpath?: string,
  runtimeConfig?: ProviderRuntimeConfig | null,
) {
  const controller = new AbortController();

  var authValue,
    authHeaderName = "";

  // 解析自定义服务商配置（如有）
  let customEndpoint = req.headers.get("x-custom-provider-endpoint") || "";
  let customApiKey = req.headers.get("x-custom-provider-api-key") || "";
  const customConfigHeader = req.headers.get("x-custom-provider-config");
  if (!customEndpoint && customConfigHeader) {
    try {
      const decoded = atob(customConfigHeader);
      const uint8Array = new Uint8Array(
        decoded.split("").map((c) => c.charCodeAt(0)),
      );
      const json = new TextDecoder().decode(uint8Array);
      const cfg = JSON.parse(json || "{}");
      customEndpoint = cfg?.endpoint || customEndpoint;
      customApiKey = cfg?.apiKey || customApiKey;
    } catch {}
  }

  // 如果使用服务器配置，使用服务器端的API密钥
  if (useServerConfig) {
    authValue = `Bearer ${runtimeConfig?.apiKey || ""}`;
    authHeaderName = "Authorization";
  } else {
    authValue = req.headers.get("Authorization") ?? "";
    authHeaderName = "Authorization";
  }

  // 计算请求路径：优先使用路由参数传入的 subpath，其次从 URL 中截取
  let path =
    subpath ?? `${req.nextUrl.pathname}`.replaceAll("/api/openai/", "");
  // 当通过自定义服务商转发时，URL 可能类似 /api/custom_xxx/openai/...
  if (!subpath && path.startsWith("/api/custom_")) {
    const idx = path.indexOf("/openai/");
    if (idx >= 0) {
      path = path.slice(idx + "/openai/".length);
    }
  }

  let baseUrl = customEndpoint
    ? customEndpoint
    : useServerConfig
    ? runtimeConfig?.baseUrl || OPENAI_BASE_URL
    : OPENAI_BASE_URL;

  if (!baseUrl.startsWith("http")) {
    baseUrl = `https://${baseUrl}`;
  }

  if (baseUrl.endsWith("/")) {
    baseUrl = baseUrl.slice(0, -1);
  }

  console.log("[Proxy] ", path);
  console.log("[Base Url]", baseUrl);

  const timeoutId = setTimeout(
    () => {
      controller.abort();
    },
    10 * 60 * 1000,
  );

  const fetchUrl = cloudflareAIGatewayUrl(`${baseUrl}/${path}`);
  console.log("fetchUrl", fetchUrl);
  const fetchOptions: RequestInit = {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      [authHeaderName]: authValue,
    },
    method: req.method,
    body: req.body,
    // to fix #2485: https://stackoverflow.com/questions/55920957/cloudflare-worker-typeerror-one-time-use-body
    redirect: "manual",
    // @ts-ignore
    duplex: "half",
    signal: controller.signal,
  };

  // 纯前端应用，不限制模型使用，由用户API密钥权限决定

  try {
    const res = await fetch(fetchUrl, fetchOptions);

    // to prevent browser prompt for credentials
    const newHeaders = new Headers(res.headers);
    newHeaders.delete("www-authenticate");
    // to disable nginx buffering
    newHeaders.set("X-Accel-Buffering", "no");

    // 纯前端应用，删除组织ID相关头部
    newHeaders.delete("OpenAI-Organization");

    // The latest version of the OpenAI API forced the content-encoding to be "br" in json response
    // So if the streaming is disabled, we need to remove the content-encoding header
    // Because Vercel uses gzip to compress the response, if we don't remove the content-encoding header
    // The browser will try to decode the response with brotli and fail
    newHeaders.delete("content-encoding");

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: newHeaders,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
