"use client";
import { createPersistStore } from "../utils/store";
import { StoreKey } from "../constant";
import type { ServerConfig, McpConfigData } from "../mcp/types";

export type McpStoreState = {
  userServers: Record<string, ServerConfig>;
  groupServers: Record<string, ServerConfig>;
  activeGroupId: string;
};

export const useMcpStore = createPersistStore(
  {
    userServers: {} as Record<string, ServerConfig>,
    groupServers: {} as Record<string, ServerConfig>,
    activeGroupId: "",
  },
  (set, get) => ({}) as any,
  {
    name: StoreKey.Mcp,
    version: 1,
  },
);

// Helper functions
export function getMcpConfigFromStore(): McpConfigData {
  const state = useMcpStore.getState();
  return {
    mcpServers: {
      ...(state.groupServers || {}),
      ...(state.userServers || {}),
    },
  };
}

export function setMcpServer(id: string, config: ServerConfig) {
  const prev = useMcpStore.getState().userServers || {};
  useMcpStore.setState({ userServers: { ...prev, [id]: config } });
}

export function removeMcpServer(id: string) {
  const next = { ...useMcpStore.getState().userServers };
  delete next[id];
  useMcpStore.setState({ userServers: next });
}

export function setGroupMcpServers(
  groupId: string,
  servers: Record<string, ServerConfig>,
) {
  useMcpStore.setState({
    activeGroupId: groupId,
    groupServers: { ...servers },
  });
}

export function clearGroupMcpServers() {
  useMcpStore.setState({
    activeGroupId: "",
    groupServers: {},
  });
}
