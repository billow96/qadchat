import { getModelCapabilitiesWithCustomConfig } from "../config/model-capabilities";
import { executeMcpAction, getAllTools } from "./actions";
import type { ListToolsResponse } from "./types";

export type NativeToolProvider = "openai" | "anthropic" | "gemini" | "none";

export type NativeToolDefinition = {
  name: string;
  description?: string;
  parameters: Record<string, any>;
  clientId: string;
  originalName: string;
};

export type NativeToolSet = {
  provider: NativeToolProvider;
  tools: any[];
  funcs: Record<string, (args: Record<string, unknown>) => Promise<any>>;
  metadata: Record<string, NativeToolDefinition>;
};

type McpToolRecord = NonNullable<ListToolsResponse["tools"]>[number];

const TOOL_NAME_PREFIX = "mcp__";
const NAME_REPLACEMENTS = /[^a-zA-Z0-9_]/g;

function toPascalCase(input: string) {
  return input
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function toCamelCase(input: string) {
  const pascal = toPascalCase(input);
  return pascal ? pascal.charAt(0).toLowerCase() + pascal.slice(1) : "";
}

function sanitizeToolName(clientId: string, toolName: string) {
  const providerPart = toCamelCase(clientId) || "mcp";
  const toolPart = toCamelCase(toolName) || "tool";
  return `${TOOL_NAME_PREFIX}${providerPart}__${toolPart}`.replace(
    NAME_REPLACEMENTS,
    "_",
  );
}

function normalizeParameters(schema: any) {
  if (schema && typeof schema === "object") {
    return schema;
  }
  return {
    type: "object",
    properties: {},
    additionalProperties: true,
  };
}

function createToolExecutor(
  clientId: string,
  originalName: string,
): (args: Record<string, unknown>) => Promise<any> {
  return async (args: Record<string, unknown>) => {
    return executeMcpAction(clientId, {
      method: "tools/call",
      params: {
        name: originalName,
        arguments: args,
      },
    });
  };
}

function toOpenAITool(tool: NativeToolDefinition) {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description || "",
      parameters: tool.parameters,
    },
  };
}

function toAnthropicTool(tool: NativeToolDefinition) {
  return {
    name: tool.name,
    description: tool.description || "",
    input_schema: tool.parameters,
  };
}

function toGeminiFunctionDeclaration(tool: NativeToolDefinition) {
  return {
    name: tool.name,
    description: tool.description || "",
    parametersJsonSchema: tool.parameters,
  };
}

function convertMcpTool(
  clientId: string,
  tool: McpToolRecord,
): NativeToolDefinition | null {
  if (!tool?.name) return null;
  return {
    name: sanitizeToolName(clientId, tool.name),
    description: tool.description,
    parameters: normalizeParameters(tool.inputSchema),
    clientId,
    originalName: tool.name,
  };
}

export async function getEnabledMcpNativeTools(
  modelName: string,
  mcpEnabled: boolean = false,
  enabledClients?: Record<string, boolean>,
  provider: NativeToolProvider = "openai",
): Promise<NativeToolSet> {
  const capabilities = getModelCapabilitiesWithCustomConfig(modelName);
  if (!mcpEnabled || !capabilities.tools || provider === "none") {
    return {
      provider,
      tools: [],
      funcs: {},
      metadata: {},
    };
  }

  const allTools = await getAllTools();
  const definitions: NativeToolDefinition[] = [];
  const funcs: NativeToolSet["funcs"] = {};
  const metadata: NativeToolSet["metadata"] = {};

  for (const entry of allTools) {
    if (!entry.tools?.tools?.length) continue;
    if (enabledClients && enabledClients[entry.clientId] === false) continue;

    for (const rawTool of entry.tools.tools) {
      const nativeTool = convertMcpTool(entry.clientId, rawTool);
      if (!nativeTool) continue;

      definitions.push(nativeTool);
      funcs[nativeTool.name] = createToolExecutor(
        nativeTool.clientId,
        nativeTool.originalName,
      );
      metadata[nativeTool.name] = nativeTool;
    }
  }

  let tools: any[] = [];
  switch (provider) {
    case "openai":
      tools = definitions.map(toOpenAITool);
      break;
    case "anthropic":
      tools = definitions.map(toAnthropicTool);
      break;
    case "gemini":
      tools =
        definitions.length > 0
          ? [
              {
                functionDeclarations: definitions.map(
                  toGeminiFunctionDeclaration,
                ),
              },
            ]
          : [];
      break;
    default:
      tools = [];
      break;
  }

  return {
    provider,
    tools,
    funcs,
    metadata,
  };
}

export function getToolClientIdByName(
  metadata: Record<string, NativeToolDefinition>,
  toolName: string,
) {
  return metadata[toolName]?.clientId || "";
}

export function getOriginalToolNameByName(
  metadata: Record<string, NativeToolDefinition>,
  toolName: string,
) {
  return metadata[toolName]?.originalName || toolName;
}
