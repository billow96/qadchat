import {
  ANTHROPIC_BASE_URL,
  Anthropic,
  ApiPath,
  ServiceProvider,
  ModelProvider,
} from "@/app/constant";
import { prettyObject } from "@/app/utils/format";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "./auth";
import { cloudflareAIGatewayUrl } from "@/app/utils/cloudflare";

const ALLOWD_PATH = new Set([Anthropic.ChatPath, Anthropic.ChatPath1]);

export async function handle(
  req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  console.log("[Anthropic Route] params ", params);

  if (req.method === "OPTIONS") {
    return NextResponse.json({ body: "OK" }, { status: 200 });
  }

  const subpath = params.path.join("/");

  if (!ALLOWD_PATH.has(subpath)) {
    console.log("[Anthropic Route] forbidden path ", subpath);
    return NextResponse.json(
      {
        error: true,
        msg: "you are not allowed to request " + subpath,
      },
      {
        status: 403,
      },
    );
  }

  const authResult = await auth(req, ModelProvider.Claude);
  if (authResult.error) {
    return NextResponse.json(authResult, {
      status: 401,
    });
  }

  try {
    const response = await request(
      req,
      authResult.useServerConfig,
      subpath,
      authResult.runtimeConfig?.apiKey,
      authResult.runtimeConfig?.baseUrl,
    );
    return response;
  } catch (e) {
    console.error("[Anthropic] ", e);
    return NextResponse.json(prettyObject(e));
  }
}

async function request(
  req: NextRequest,
  useServerConfig?: boolean,
  subpath?: string,
  serverApiKey?: string,
  serverBaseUrl?: string,
) {
  const controller = new AbortController();

  let authHeaderName = "x-api-key";
  let authValue = "";

  // 解析自定义服务商配置（如有）
  const configHeader = req.headers.get("x-custom-provider-config");
  let customEndpoint = req.headers.get("x-custom-provider-endpoint") || "";
  let customApiKey = req.headers.get("x-custom-provider-api-key") || "";
  if (!customEndpoint && configHeader) {
    try {
      const decoded = atob(configHeader);
      const uint8Array = new Uint8Array(
        decoded.split("").map((c) => c.charCodeAt(0)),
      );
      const json = new TextDecoder().decode(uint8Array);
      const cfg = JSON.parse(json || "{}");
      customEndpoint = cfg?.endpoint || customEndpoint;
      customApiKey = cfg?.apiKey || customApiKey;
    } catch {}
  }

  if (useServerConfig) {
    authValue = serverApiKey || "";
  } else {
    authValue =
      req.headers.get(authHeaderName) ||
      req.headers.get("Authorization")?.replaceAll("Bearer ", "").trim() ||
      "";
  }

  // 计算路径：优先使用路由参数传入的 subpath，其次从 URL 中截取
  let path =
    subpath ?? `${req.nextUrl.pathname}`.replaceAll(ApiPath.Anthropic, "");
  if (!subpath && path.startsWith("/api/custom_")) {
    const idx = path.indexOf("/anthropic/");
    if (idx >= 0) {
      path = path.slice(idx + "/anthropic/".length);
    }
  }

  let baseUrl = customEndpoint
    ? customEndpoint
    : useServerConfig
    ? serverBaseUrl || ANTHROPIC_BASE_URL
    : ANTHROPIC_BASE_URL;

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

  // try rebuild url, when using cloudflare ai gateway in server
  if (!path.startsWith("/")) {
    path = "/" + path;
  }
  const fetchUrl = cloudflareAIGatewayUrl(`${baseUrl}${path}`);

  const fetchOptions: RequestInit = {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "anthropic-dangerous-direct-browser-access": "true",
      [authHeaderName]: authValue,
      "anthropic-version":
        req.headers.get("anthropic-version") || Anthropic.Vision,
    },
    method: req.method,
    body: req.body,
    redirect: "manual",
    // @ts-ignore
    duplex: "half",
    signal: controller.signal,
  };

  // 纯前端应用，不限制模型使用，由用户API密钥权限决定
  // console.log("[Anthropic request]", fetchOptions.headers, req.method);
  try {
    const res = await fetch(fetchUrl, fetchOptions);

    // console.log(
    //   "[Anthropic response]",
    //   res.status,
    //   "   ",
    //   res.headers,
    //   res.url,
    // );
    // to prevent browser prompt for credentials
    const newHeaders = new Headers(res.headers);
    newHeaders.delete("www-authenticate");
    // to disable nginx buffering
    newHeaders.set("X-Accel-Buffering", "no");

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: newHeaders,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export const runtime = "nodejs";
