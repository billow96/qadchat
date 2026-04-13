import { useMcpStore } from "../store/mcp";

const GROUP_PREFIX = "group:";

export function stripGroupPrefix(clientId?: string) {
  if (!clientId) return "mcp";
  if (!clientId.startsWith(GROUP_PREFIX)) return clientId;

  const parts = clientId.split(":");
  return parts.length >= 3 ? parts.slice(2).join(":") || clientId : clientId;
}

export function getMcpDisplayName(clientId?: string) {
  if (!clientId) return "mcp";

  const state = useMcpStore.getState();
  const config =
    state.groupServers?.[clientId] || state.userServers?.[clientId];

  return config?.name || stripGroupPrefix(clientId);
}
