import { NextResponse } from "next/server";
import { getModelRegistry } from "@/app/server/model-registry";

export async function GET(
  req: Request,
  { params }: { params: { provider: string } },
) {
  try {
    if (params.provider !== "openrouter") {
      return NextResponse.json(
        { error: true, message: `Unsupported provider: ${params.provider}` },
        { status: 400 },
      );
    }

    const forceRefresh = new URL(req.url).searchParams.get("refresh") === "1";

    const registry = await getModelRegistry("openrouter", {
      forceRefresh,
      trigger: "access",
    });

    return NextResponse.json({
      error: false,
      provider: registry.provider,
      fetchedAt: registry.fetchedAt,
      models: Object.values(registry.models),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: true,
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
