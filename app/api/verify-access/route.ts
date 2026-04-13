import { NextRequest, NextResponse } from "next/server";
import {
  getAccessControlStatus,
  getGroupBootstrap,
  resolveGroupByAccessCode,
} from "@/app/server/access-groups";
import {
  clearAccessGroupSession,
  setAccessGroupSession,
} from "@/app/server/access-session";

// 验证访问码的API端点
async function handle(req: NextRequest) {
  try {
    const { accessCode } = await req.json();
    const controlStatus = await getAccessControlStatus();

    // 如果没有设置服务器端访问码，则不需要验证
    if (!controlStatus.hasServerAccessCode) {
      clearAccessGroupSession();
      return NextResponse.json({
        valid: true,
        message: "访问码验证已禁用",
        bootstrap: null,
      });
    }

    const group = await resolveGroupByAccessCode(accessCode || "");
    const isValid = !!group;

    if (group) {
      setAccessGroupSession(group.id);
    } else {
      clearAccessGroupSession();
    }

    return NextResponse.json({
      valid: isValid,
      message: isValid ? "访问码验证成功" : "访问码错误",
      bootstrap: group ? getGroupBootstrap(group) : null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        valid: false,
        message: "验证请求格式错误",
      },
      { status: 400 },
    );
  }
}

export const POST = handle;
export const runtime = "nodejs";
