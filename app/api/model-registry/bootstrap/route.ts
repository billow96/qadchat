import { NextResponse } from "next/server";
import { getModelRegistry } from "@/app/server/model-registry";

export async function POST() {
  try {
    void getModelRegistry("openrouter", {
      trigger: "startup",
    });

    return NextResponse.json({
      error: false,
      message: "bootstrap triggered",
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
