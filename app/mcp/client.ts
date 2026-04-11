import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { MCPClientLogger } from "./logger";
import { ListToolsResponse, McpRequestMessage, ServerConfig } from "./types";
import { createMCPClient } from "./transport-factory";
import { z } from "zod";

const logger = new MCPClientLogger();

export async function createClient(
  id: string,
  config: ServerConfig,
): Promise<Client> {
  logger.info(`Creating client for ${id}...`);

  // SDK 的 client.connect(transport) 已负责标准 initialize 握手，并维护
  // streamable HTTP 所需的 session id。这里如果再次手动 initialize，
  // 某些上游会直接返回 “Server already initialized”，导致后续工具加载失败。
  const client = await createMCPClient(id, config);
  logger.info(`Client ${id} connected and initialized by SDK transport`);
  return client;
}

export async function removeClient(client: Client) {
  logger.info(`Removing client...`);
  await client.close();
}

export async function listTools(client: Client): Promise<ListToolsResponse> {
  return client.listTools();
}

export async function executeRequest(
  client: Client,
  request: McpRequestMessage,
): Promise<any> {
  // 使用类型断言避免复杂的类型推断
  return (client as any).request(request, z.object({}).passthrough());
}
