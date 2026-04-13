import { NextResponse } from "next/server";
import {
  getAccessControlStatus,
  getGroupBootstrap,
  loadAccessGroups,
} from "@/app/server/access-groups";
import { getCurrentAccessGroup } from "@/app/server/access-session";

async function getServerConfig() {
  const controlStatus = await getAccessControlStatus();
  const currentGroup = await getCurrentAccessGroup();
  const bootstrap = currentGroup ? getGroupBootstrap(currentGroup) : null;
  const { groups, legacyGroup } = await loadAccessGroups();
  const fallbackBootstrap = groups[0]
    ? getGroupBootstrap(groups[0])
    : legacyGroup
    ? getGroupBootstrap(legacyGroup)
    : null;

  return {
    hideUserApiKey: false,
    disableGPT4: false,
    hideBalanceQuery: false,
    disableFastLink: false,
    customModels: "",
    defaultModel: bootstrap?.defaultModel || "",
    visionModels: "",
    hasServerAccessCode: controlStatus.hasServerAccessCode,
    hasServerProviderConfig:
      bootstrap?.hasServerProviderConfig ||
      fallbackBootstrap?.hasServerProviderConfig ||
      false,
    serverProviders: bootstrap?.serverProviders ||
      fallbackBootstrap?.serverProviders || {
        openai: { hasApiKey: false, hasBaseUrl: false },
        google: { hasApiKey: false, hasBaseUrl: false },
        anthropic: { hasApiKey: false, hasBaseUrl: false },
        bytedance: { hasApiKey: false, hasBaseUrl: false },
        alibaba: { hasApiKey: false, hasBaseUrl: false },
        moonshot: { hasApiKey: false, hasBaseUrl: false },
        deepseek: { hasApiKey: false, hasBaseUrl: false },
        xai: { hasApiKey: false, hasBaseUrl: false },
        siliconflow: { hasApiKey: false, hasBaseUrl: false },
      },
    accessMode: controlStatus.hasAccessGroupsConfig ? "group" : "legacy",
    hasAccessGroupsConfig: controlStatus.hasAccessGroupsConfig,
    currentGroupId: bootstrap?.groupId || "",
    currentGroupName: bootstrap?.groupName || "",
    groupBootstrap: bootstrap,
  };
}

async function handle() {
  return NextResponse.json(await getServerConfig());
}

export const GET = handle;
export const POST = handle;

export const runtime = "nodejs";
