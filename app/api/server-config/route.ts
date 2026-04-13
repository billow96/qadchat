import { NextRequest, NextResponse } from "next/server";
import {
  getAccessControlStatus,
  getGroupBootstrap,
  resolveGroupByAccessCode,
} from "@/app/server/access-groups";
import {
  getCurrentAccessGroup,
  setAccessGroupSession,
} from "@/app/server/access-session";

// 获取服务器端配置的API端点（需要访问码验证）
async function handle(req: NextRequest) {
  try {
    const { accessCode } = await req.json();
    const controlStatus = await getAccessControlStatus();

    if (!controlStatus.hasServerAccessCode) {
      return NextResponse.json({
        error: false,
        config: null,
        bootstrap: null,
      });
    }

    const accessCodeGroup = accessCode
      ? await resolveGroupByAccessCode(accessCode)
      : null;
    const group = accessCodeGroup || (await getCurrentAccessGroup());

    if (accessCodeGroup) {
      setAccessGroupSession(accessCodeGroup.id);
    }

    if (!group) {
      return NextResponse.json(
        {
          error: true,
          message: "访问码错误",
        },
        { status: 401 },
      );
    }

    const bootstrap = getGroupBootstrap(group);
    const config = Object.fromEntries(
      Object.entries(bootstrap.serverProviders).map(([provider, state]) => [
        provider,
        {
          apiKey: state.hasApiKey ? "__SERVER_CONFIGURED__" : "",
          baseUrl: state.hasBaseUrl ? `/api/${provider}` : "",
        },
      ]),
    );

    return NextResponse.json({
      error: false,
      config,
      bootstrap,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: true,
        message: "请求格式错误",
      },
      { status: 400 },
    );
  }
}

export const POST = handle;
export const runtime = "nodejs";
