import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";

import styles from "./settings.module.scss";

import AddIcon from "../icons/add.svg";
import EditIcon from "../icons/edit.svg";
import ConnectionIcon from "../icons/connection.svg";
import DownIcon from "../icons/down.svg";
import RestartIcon from "../icons/reload.svg";
import DeleteIcon from "../icons/delete.svg";
import PlayIcon from "../icons/play.svg";
import StopIcon from "../icons/pause.svg";

import Locale from "../locales";
import { IconButton } from "./button";
import { Input, List, ListItem, Modal, showConfirm, showToast } from "./ui-lib";
import { useAppConfig } from "../store";
import {
  addMcpServer,
  diagnoseMcpConnection,
  getClientTools,
  getClientsStatus,
  getMcpConfigFromFile,
  pauseMcpServer,
  removeMcpServer,
  restartAllClients,
  resumeMcpServer,
  testMcpConnection,
} from "../mcp/actions";
import { getMcpDisplayName } from "../mcp/display";
import type {
  ListToolsResponse,
  McpConfigData,
  ServerConfig,
  ServerStatus,
  ServerStatusResponse,
} from "../mcp/types";

type ServerFormState = {
  id: string;
  name: string;
  description: string;
  baseUrl: string;
  headers: string;
  longRunning: boolean;
  timeout: number;
};

type ModalState =
  | { type: "hidden" }
  | { type: "add" }
  | { type: "edit"; serverId: string }
  | { type: "import" }
  | { type: "test"; serverName: string; payload: any };

const DEFAULT_FORM_STATE: ServerFormState = {
  id: "",
  name: "",
  description: "",
  baseUrl: "",
  headers: "",
  longRunning: true,
  timeout: 600,
};

function parseHeaders(input: string): Record<string, string> | undefined {
  const trimmed = (input || "").trim();
  if (!trimmed) return undefined;

  try {
    const maybeJson = JSON.parse(trimmed);
    if (maybeJson && typeof maybeJson === "object") {
      return maybeJson as Record<string, string>;
    }
  } catch {}

  const headers: Record<string, string> = {};
  trimmed
    .split(/\n|\r/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const match = line.match(/^(.*?)[=:]\s*(.*)$/);
      if (match) {
        headers[match[1].trim()] = match[2].trim();
      }
    });

  return Object.keys(headers).length > 0 ? headers : undefined;
}

function stringifyHeaders(headers?: Record<string, string>) {
  if (!headers || Object.keys(headers).length === 0) return "";
  return Object.entries(headers)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function createFormState(
  serverId?: string,
  server?: ServerConfig,
): ServerFormState {
  if (!serverId || !server) {
    return { ...DEFAULT_FORM_STATE };
  }

  const timeout = Number(server.timeout ?? 600);
  const longRunning = timeout >= 600;

  return {
    id: serverId,
    name: server.name || getMcpDisplayName(serverId),
    description: server.description || "",
    baseUrl: server.baseUrl || "",
    headers: stringifyHeaders(server.headers),
    longRunning,
    timeout: timeout > 0 ? timeout : 600,
  };
}

function getToolEnabledCount(
  tools: ListToolsResponse | null | undefined,
  disabledTools: string[],
) {
  const allTools = tools?.tools ?? [];
  return allTools.filter(
    (tool) => tool.name && !disabledTools.includes(tool.name),
  ).length;
}

function getStatusLabel(status: ServerStatus) {
  const map = Locale.Settings.Mcp.Status as Record<ServerStatus, string>;
  return map[status] || map.undefined;
}

function getModalFieldId(field: string) {
  return `mcp-form-${field}`;
}

function sanitizeDomId(input: string) {
  return input.replace(/[^a-zA-Z0-9_-]/g, "-");
}

export function MCPSettings() {
  const appConfig = useAppConfig();
  const [config, setConfig] = useState<McpConfigData>({ mcpServers: {} });
  const [clientStatuses, setClientStatuses] = useState<
    Record<string, ServerStatusResponse>
  >({});
  const [toolMap, setToolMap] = useState<
    Record<string, ListToolsResponse | null>
  >({});
  const [expandedServers, setExpandedServers] = useState<
    Record<string, boolean>
  >({});
  const [searchText, setSearchText] = useState("");
  const [modalState, setModalState] = useState<ModalState>({ type: "hidden" });
  const [formState, setFormState] =
    useState<ServerFormState>(DEFAULT_FORM_STATE);
  const [importJson, setImportJson] = useState("");
  const [loadingStates, setLoadingStates] = useState<Record<string, string>>(
    {},
  );

  const refreshBaseState = async () => {
    const [mcpConfig, statuses] = await Promise.all([
      getMcpConfigFromFile(),
      getClientsStatus(),
    ]);
    setConfig(mcpConfig);
    setClientStatuses(statuses);
    setExpandedServers((prev) => {
      const nextExpanded: Record<string, boolean> = {};
      Object.keys(mcpConfig.mcpServers).forEach((serverId) => {
        nextExpanded[serverId] = prev[serverId] ?? false;
      });
      return nextExpanded;
    });
  };

  const refreshTools = async () => {
    const serverIds = Object.keys(config.mcpServers);
    if (serverIds.length === 0) {
      setToolMap({});
      return;
    }

    const entries = await Promise.all(
      serverIds.map(async (serverId) => {
        try {
          const tools = await getClientTools(serverId);
          return [serverId, tools] as const;
        } catch {
          return [serverId, null] as const;
        }
      }),
    );

    setToolMap((prev) => {
      const next = { ...prev };
      entries.forEach(([serverId, tools]) => {
        next[serverId] = tools;
      });
      return next;
    });
  };

  useEffect(() => {
    void refreshBaseState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void refreshTools();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.mcpServers]);

  useEffect(() => {
    const timer = setInterval(() => {
      void getClientsStatus()
        .then(setClientStatuses)
        .catch(() => {});
    }, 1500);

    return () => clearInterval(timer);
  }, []);

  const setLoading = (key: string, message?: string) => {
    setLoadingStates((prev) => {
      if (!message) {
        const { [key]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: message };
    });
  };

  const serverIds = Object.keys(config.mcpServers);
  const filteredServerIds = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) return serverIds;

    return serverIds.filter((serverId) => {
      const server = config.mcpServers[serverId];
      const toolText = (toolMap[serverId]?.tools ?? [])
        .map((tool) => `${tool.name || ""} ${tool.description || ""}`)
        .join(" ");
      return [
        serverId,
        server.name,
        server.description,
        server.baseUrl,
        toolText,
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }, [config.mcpServers, searchText, serverIds, toolMap]);

  const handleOpenAddModal = () => {
    setFormState({ ...DEFAULT_FORM_STATE });
    setModalState({ type: "add" });
  };

  const handleOpenEditModal = (serverId: string) => {
    setFormState(createFormState(serverId, config.mcpServers[serverId]));
    setModalState({ type: "edit", serverId });
  };

  const handleSaveServer = async () => {
    if (!formState.id.trim() || !formState.baseUrl.trim()) {
      showToast(Locale.Settings.Mcp.Toast.SaveFailed);
      return;
    }

    const existingServer =
      modalState.type === "edit"
        ? config.mcpServers[modalState.serverId]
        : undefined;

    const serverConfig: ServerConfig = {
      type: "streamableHttp",
      baseUrl: formState.baseUrl.trim(),
      headers: parseHeaders(formState.headers),
      timeout: Math.max(
        1,
        formState.longRunning
          ? Math.max(600, formState.timeout)
          : formState.timeout,
      ),
      status: existingServer?.status || "active",
      name: formState.name.trim() || formState.id.trim(),
      description: formState.description.trim(),
    };

    const loadingKey =
      modalState.type === "edit" ? modalState.serverId : formState.id.trim();

    try {
      setLoading(loadingKey, "saving");
      await addMcpServer(formState.id.trim(), serverConfig);
      await refreshBaseState();
      await refreshTools();
      setModalState({ type: "hidden" });
      showToast(
        modalState.type === "edit"
          ? Locale.Settings.Mcp.Toast.Updated
          : Locale.Settings.Mcp.Toast.Added,
      );
    } catch {
      showToast(Locale.Settings.Mcp.Toast.SaveFailed);
    } finally {
      setLoading(loadingKey);
    }
  };

  const handleImport = async () => {
    try {
      const payload = JSON.parse(importJson);
      const servers = (payload?.mcpServers ??
        payload?.servers ??
        payload) as Record<string, any>;
      if (!servers || typeof servers !== "object") {
        throw new Error("invalid");
      }

      setLoading("import", "importing");
      for (const [serverId, rawConfig] of Object.entries(servers)) {
        const rawType = String(rawConfig?.type || "streamableHttp")
          .trim()
          .toLowerCase();
        const isStreamable = [
          "streamablehttp",
          "streamable_http",
          "streamable-http",
        ].includes(rawType);
        if (!isStreamable) continue;

        const nextConfig: ServerConfig = {
          type: "streamableHttp",
          baseUrl: rawConfig.baseUrl || rawConfig.url,
          headers: rawConfig.headers,
          timeout: Math.max(1, Number(rawConfig.timeout ?? 600)),
          status: rawConfig.status || "active",
          name: rawConfig.name || serverId,
          description: rawConfig.description || "",
        };

        if (!nextConfig.baseUrl) continue;
        await addMcpServer(serverId, nextConfig);
      }

      await refreshBaseState();
      await refreshTools();
      setImportJson("");
      setModalState({ type: "hidden" });
      showToast(Locale.Settings.Mcp.Toast.Imported);
    } catch {
      showToast(Locale.Settings.Mcp.Toast.ImportFailed);
    } finally {
      setLoading("import");
    }
  };

  const handleToggleService = (serverId: string, enabled: boolean) => {
    appConfig.update((config) => {
      config.mcpEnabledClients = {
        ...(config.mcpEnabledClients || {}),
        [serverId]: enabled,
      };
    });
  };

  const handleToggleTool = (
    serverId: string,
    toolName: string,
    enabled: boolean,
  ) => {
    appConfig.update((config) => {
      const disabledToolsByClient = { ...(config.mcpDisabledTools || {}) };
      const disabledTools = new Set(disabledToolsByClient[serverId] || []);

      if (enabled) {
        disabledTools.delete(toolName);
      } else {
        disabledTools.add(toolName);
      }

      if (disabledTools.size === 0) {
        delete disabledToolsByClient[serverId];
      } else {
        disabledToolsByClient[serverId] = Array.from(disabledTools);
      }

      config.mcpDisabledTools = disabledToolsByClient;
    });
  };

  const handlePauseServer = async (serverId: string) => {
    try {
      setLoading(serverId, "pausing");
      await pauseMcpServer(serverId);
      await refreshBaseState();
      showToast(Locale.Settings.Mcp.Toast.Paused);
    } catch {
      showToast(Locale.Settings.Mcp.Toast.TestFailed);
    } finally {
      setLoading(serverId);
    }
  };

  const handleResumeServer = async (serverId: string) => {
    try {
      setLoading(serverId, "starting");
      await resumeMcpServer(serverId);
      await refreshBaseState();
      await refreshTools();
      showToast(Locale.Settings.Mcp.Toast.Resumed);
    } catch {
      showToast(Locale.Settings.Mcp.Toast.TestFailed);
    } finally {
      setLoading(serverId);
    }
  };

  const handleDeleteServer = async (serverId: string) => {
    const serverName =
      config.mcpServers[serverId]?.name || getMcpDisplayName(serverId);
    const confirmed = await showConfirm(
      Locale.Settings.Mcp.Modal.DeleteConfirm(serverName),
    );
    if (!confirmed) return;

    try {
      setLoading(serverId, "deleting");
      await removeMcpServer(serverId);
      appConfig.update((config) => {
        const nextClients = { ...(config.mcpEnabledClients || {}) };
        const nextTools = { ...(config.mcpDisabledTools || {}) };
        delete nextClients[serverId];
        delete nextTools[serverId];
        config.mcpEnabledClients = nextClients;
        config.mcpDisabledTools = nextTools;
      });
      await refreshBaseState();
      await refreshTools();
      showToast(Locale.Settings.Mcp.Toast.Deleted);
    } finally {
      setLoading(serverId);
    }
  };

  const handleRestartAll = async () => {
    try {
      setLoading("all", "restarting");
      await restartAllClients();
      await refreshBaseState();
      await refreshTools();
      showToast(Locale.Settings.Mcp.Toast.Restarted);
    } catch {
      showToast(Locale.Settings.Mcp.Toast.TestFailed);
    } finally {
      setLoading("all");
    }
  };

  const handleTestServer = async (serverId: string) => {
    const serverName =
      config.mcpServers[serverId]?.name || getMcpDisplayName(serverId);
    try {
      setLoading(serverId, "testing");
      const basic = await testMcpConnection(serverId);
      if (basic.status >= 400 && basic.status < 500) {
        const diag = await diagnoseMcpConnection(serverId);
        setModalState({
          type: "test",
          serverName,
          payload: { basic, diag },
        });
      } else {
        setModalState({
          type: "test",
          serverName,
          payload: basic,
        });
      }
    } catch (error) {
      setModalState({
        type: "test",
        serverName,
        payload: { error: String(error) },
      });
      showToast(Locale.Settings.Mcp.Toast.TestFailed);
    } finally {
      setLoading(serverId);
    }
  };

  return (
    <div className={styles["mcp-settings"]}>
      <div className={styles["mcp-settings-hero"]}>
        <div>
          <div className={styles["mcp-settings-title"]}>
            {Locale.Settings.Mcp.Title}
          </div>
          <div className={styles["mcp-settings-subtitle"]}>
            {Locale.Settings.Mcp.SubTitle}
          </div>
        </div>
        <div className={styles["mcp-settings-actions"]}>
          <IconButton
            icon={<RestartIcon />}
            text={Locale.Settings.Mcp.Actions.RestartAll}
            onClick={handleRestartAll}
            bordered
          />
          <IconButton
            icon={<AddIcon />}
            text={Locale.Settings.Mcp.Actions.Import}
            onClick={() => setModalState({ type: "import" })}
            bordered
          />
          <IconButton
            icon={<AddIcon />}
            text={Locale.Settings.Mcp.Actions.Add}
            onClick={handleOpenAddModal}
            type="primary"
            bordered
          />
        </div>
      </div>

      <div className={styles["mcp-settings-grid"]}>
        <div className={styles["mcp-settings-main"]}>
          <div className={styles["mcp-global-card"]}>
            <div className={styles["mcp-global-copy"]}>
              <div className={styles["mcp-global-title"]}>
                {Locale.Settings.Mcp.Global.Title}
              </div>
              <div className={styles["mcp-global-desc"]}>
                {Locale.Settings.Mcp.Global.SubTitle}
              </div>
            </div>
            <div className={styles["provider-toggle"]}>
              <input
                id="mcp-global-enabled"
                type="checkbox"
                name="mcp-global-enabled"
                className={styles["provider-checkbox"]}
                aria-label={Locale.Settings.Mcp.Global.Title}
                checked={appConfig.mcpEnabled}
                onChange={(e) => {
                  const checked = e.currentTarget.checked;
                  appConfig.update((config) => {
                    config.mcpEnabled = checked;
                  });
                }}
              />
            </div>
          </div>

          <div className={styles["mcp-search-row"]}>
            <input
              type="text"
              id="mcp-search-input"
              name="mcp-search-input"
              aria-label={Locale.Settings.Mcp.SearchPlaceholder}
              className={styles["mcp-search-input"]}
              value={searchText}
              onChange={(e) => setSearchText(e.currentTarget.value)}
              placeholder={Locale.Settings.Mcp.SearchPlaceholder}
            />
          </div>

          {filteredServerIds.length === 0 ? (
            <div className={styles["mcp-empty-state"]}>
              <div className={styles["mcp-empty-title"]}>
                {serverIds.length === 0
                  ? Locale.Settings.Mcp.Empty
                  : Locale.Settings.Mcp.SearchPlaceholder}
              </div>
              <div className={styles["mcp-empty-desc"]}>
                {Locale.Settings.Mcp.EmptyDescription}
              </div>
            </div>
          ) : (
            <div
              className={clsx(
                styles["mcp-service-list"],
                styles["provider-cards"],
              )}
            >
              {filteredServerIds.map((serverId) => {
                const server = config.mcpServers[serverId];
                const tools = toolMap[serverId];
                const toolList = tools?.tools ?? [];
                const disabledTools =
                  appConfig.mcpDisabledTools?.[serverId] ?? [];
                const enabledToolCount = getToolEnabledCount(
                  tools,
                  disabledTools,
                );
                const isServiceEnabled =
                  appConfig.mcpEnabledClients?.[serverId] ?? true;
                const status = clientStatuses[serverId]?.status || "undefined";
                const statusLabel = getStatusLabel(status);
                const isExpanded = expandedServers[serverId] ?? false;
                const loadingState = loadingStates[serverId];

                return (
                  <div
                    key={serverId}
                    className={clsx(styles["mcp-service-card"], {
                      [styles["provider-card"]]: true,
                      [styles["mcp-service-card-active"]]: isServiceEnabled,
                      [styles["provider-card-active"]]: isServiceEnabled,
                      [styles["mcp-service-card-expanded"]]: isExpanded,
                    })}
                  >
                    <div
                      className={clsx(
                        styles["mcp-service-header"],
                        styles["provider-card-header"],
                      )}
                      onClick={() =>
                        setExpandedServers((prev) => ({
                          ...prev,
                          [serverId]: !isExpanded,
                        }))
                      }
                    >
                      <div
                        className={clsx(
                          styles["mcp-service-meta"],
                          styles["provider-info"],
                        )}
                      >
                        <div
                          className={clsx(
                            styles["mcp-service-icon"],
                            styles["provider-icon"],
                          )}
                        >
                          <ConnectionIcon />
                        </div>
                        <div className={styles["mcp-service-copy"]}>
                          <div
                            className={clsx(
                              styles["mcp-service-topline"],
                              styles["provider-name-container"],
                            )}
                          >
                            <h3
                              className={clsx(
                                styles["mcp-service-name"],
                                styles["provider-name"],
                              )}
                            >
                              {server.name || getMcpDisplayName(serverId)}
                            </h3>
                            <span
                              className={clsx(
                                styles["mcp-status-badge"],
                                styles[`mcp-status-${status}`],
                              )}
                            >
                              {statusLabel}
                            </span>
                            {loadingState && (
                              <span className={styles["mcp-status-loading"]}>
                                {loadingState}
                              </span>
                            )}
                          </div>
                          <p
                            className={clsx(
                              styles["mcp-service-desc"],
                              styles["provider-description"],
                            )}
                          >
                            {server.description ||
                              Locale.Settings.Mcp.NoDescription}
                          </p>
                        </div>
                      </div>

                      <div
                        className={clsx(
                          styles["mcp-service-controls"],
                          styles["provider-controls"],
                        )}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className={styles["provider-toggle"]}>
                          <input
                            id={`mcp-service-enabled-${sanitizeDomId(
                              serverId,
                            )}`}
                            type="checkbox"
                            name={`mcp-service-enabled-${serverId}`}
                            className={styles["provider-checkbox"]}
                            aria-label={`${
                              server.name || getMcpDisplayName(serverId)
                            } ${Locale.Settings.Mcp.Global.Title}`}
                            checked={isServiceEnabled}
                            onChange={(e) =>
                              handleToggleService(
                                serverId,
                                e.currentTarget.checked,
                              )
                            }
                          />
                        </div>
                        <button
                          className={clsx(styles["collapse-button"], {
                            [styles.collapsed]: !isExpanded,
                          })}
                          onClick={() =>
                            setExpandedServers((prev) => ({
                              ...prev,
                              [serverId]: !isExpanded,
                            }))
                          }
                        >
                          <DownIcon />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div
                        className={clsx(
                          styles["mcp-service-body"],
                          styles["provider-config"],
                          styles["expanded"],
                        )}
                      >
                        <div className={styles["mcp-service-toolbar"]}>
                          <IconButton
                            icon={<EditIcon />}
                            text={Locale.Settings.Mcp.Actions.Edit}
                            bordered
                            onClick={() => handleOpenEditModal(serverId)}
                          />
                          <IconButton
                            icon={<ConnectionIcon />}
                            text={Locale.Settings.Mcp.Actions.Test}
                            bordered
                            onClick={() => handleTestServer(serverId)}
                          />
                          {status === "paused" ? (
                            <IconButton
                              icon={<PlayIcon />}
                              text={Locale.Settings.Mcp.Actions.Start}
                              bordered
                              onClick={() => handleResumeServer(serverId)}
                            />
                          ) : (
                            <IconButton
                              icon={<StopIcon />}
                              text={Locale.Settings.Mcp.Actions.Stop}
                              bordered
                              onClick={() => handlePauseServer(serverId)}
                            />
                          )}
                          <IconButton
                            icon={<DeleteIcon />}
                            text={Locale.Settings.Mcp.Actions.Delete}
                            bordered
                            type="danger"
                            onClick={() => handleDeleteServer(serverId)}
                          />
                        </div>

                        <List>
                          <ListItem
                            title={Locale.Settings.Mcp.Form.BaseUrl.Title}
                            subTitle={Locale.Settings.Mcp.Form.BaseUrl.SubTitle}
                          >
                            <div className={styles["mcp-inline-value"]}>
                              {server.baseUrl}
                            </div>
                          </ListItem>
                          <ListItem
                            title={Locale.Settings.Mcp.Form.Timeout.Title}
                            subTitle={Locale.Settings.Mcp.Form.Timeout.SubTitle}
                          >
                            <div className={styles["mcp-inline-value"]}>
                              {server.timeout || 600}s
                            </div>
                          </ListItem>
                          <ListItem
                            title={Locale.Settings.Mcp.Tools}
                            subTitle={Locale.Settings.Mcp.EmptyDescription}
                          >
                            <div className={styles["mcp-inline-value"]}>
                              {Locale.Settings.Mcp.ToolsCount(
                                toolList.length,
                                enabledToolCount,
                              )}
                            </div>
                          </ListItem>

                          {toolList.length === 0 ? (
                            <ListItem
                              title={Locale.Settings.Mcp.Empty}
                              subTitle={Locale.Settings.Mcp.EmptyDescription}
                            >
                              <span className={styles["mcp-empty-inline"]}>
                                {Locale.Settings.Mcp.EmptyDescription}
                              </span>
                            </ListItem>
                          ) : (
                            toolList.map((tool) => {
                              const toolName = tool.name || "";
                              const enabled =
                                !!toolName && !disabledTools.includes(toolName);
                              const argCount = Object.keys(
                                (tool.inputSchema as any)?.properties || {},
                              ).length;

                              return (
                                <ListItem
                                  key={toolName}
                                  title={toolName}
                                  subTitle={
                                    tool.description ||
                                    Locale.Settings.Mcp.NoDescription
                                  }
                                >
                                  <div className={styles["mcp-tool-actions"]}>
                                    <div className={styles["mcp-tool-badges"]}>
                                      <span
                                        className={clsx(
                                          styles["mcp-tool-state"],
                                          enabled
                                            ? styles["mcp-tool-state-enabled"]
                                            : styles["mcp-tool-state-disabled"],
                                        )}
                                      >
                                        {enabled
                                          ? Locale.Settings.Mcp.Enabled
                                          : Locale.Settings.Mcp.Disabled}
                                      </span>
                                      <span className={styles["mcp-tool-args"]}>
                                        {argCount} args
                                      </span>
                                    </div>
                                    <div className={styles["provider-toggle"]}>
                                      <input
                                        id={`mcp-tool-enabled-${sanitizeDomId(
                                          `${serverId}-${toolName || "tool"}`,
                                        )}`}
                                        type="checkbox"
                                        name={`mcp-tool-enabled-${serverId}-${
                                          toolName || "tool"
                                        }`}
                                        className={styles["provider-checkbox"]}
                                        aria-label={`${
                                          toolName || Locale.Settings.Mcp.Tools
                                        } ${
                                          enabled
                                            ? Locale.Settings.Mcp.Enabled
                                            : Locale.Settings.Mcp.Disabled
                                        }`}
                                        checked={enabled}
                                        onChange={(e) =>
                                          handleToggleTool(
                                            serverId,
                                            toolName,
                                            e.currentTarget.checked,
                                          )
                                        }
                                      />
                                    </div>
                                  </div>
                                </ListItem>
                              );
                            })
                          )}
                        </List>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {(modalState.type === "add" || modalState.type === "edit") && (
        <div className="modal-mask">
          <Modal
            title={
              modalState.type === "edit"
                ? Locale.Settings.Mcp.Modal.EditTitle
                : Locale.Settings.Mcp.Modal.AddTitle
            }
            onClose={() => setModalState({ type: "hidden" })}
            actions={[
              <IconButton
                key="cancel"
                text={Locale.UI.Cancel}
                onClick={() => setModalState({ type: "hidden" })}
                bordered
              />,
              <IconButton
                key="save"
                text={Locale.UI.Confirm}
                type="primary"
                onClick={handleSaveServer}
                bordered
              />,
            ]}
          >
            <List>
              <ListItem
                title={Locale.Settings.Mcp.Form.Id.Title}
                subTitle={Locale.Settings.Mcp.Form.Id.SubTitle}
                className={styles["mcp-form-item"]}
              >
                <input
                  id={getModalFieldId("id")}
                  name="mcp-service-id"
                  aria-label={Locale.Settings.Mcp.Form.Id.Title}
                  type="text"
                  value={formState.id}
                  disabled={modalState.type === "edit"}
                  onChange={(e) => {
                    const value = e.currentTarget.value.trim();
                    setFormState((prev) => ({
                      ...prev,
                      id: value,
                    }));
                  }}
                  placeholder={Locale.Settings.Mcp.Form.Id.Placeholder}
                />
              </ListItem>
              <ListItem
                title={Locale.Settings.Mcp.Form.Name.Title}
                subTitle={Locale.Settings.Mcp.Form.Name.SubTitle}
                className={styles["mcp-form-item"]}
              >
                <input
                  id={getModalFieldId("name")}
                  name="mcp-service-name"
                  aria-label={Locale.Settings.Mcp.Form.Name.Title}
                  type="text"
                  value={formState.name}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setFormState((prev) => ({
                      ...prev,
                      name: value,
                    }));
                  }}
                  placeholder={Locale.Settings.Mcp.Form.Name.Placeholder}
                />
              </ListItem>
              <ListItem
                title={Locale.Settings.Mcp.Form.Description.Title}
                subTitle={Locale.Settings.Mcp.Form.Description.SubTitle}
                className={styles["mcp-form-item"]}
              >
                <input
                  id={getModalFieldId("description")}
                  name="mcp-service-description"
                  aria-label={Locale.Settings.Mcp.Form.Description.Title}
                  type="text"
                  value={formState.description}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setFormState((prev) => ({
                      ...prev,
                      description: value,
                    }));
                  }}
                  placeholder={Locale.Settings.Mcp.Form.Description.Placeholder}
                />
              </ListItem>
              <ListItem
                title={Locale.Settings.Mcp.Form.Type.Title}
                subTitle={Locale.Settings.Mcp.Form.Type.SubTitle}
                className={styles["mcp-form-item"]}
              >
                <input
                  id={getModalFieldId("type")}
                  name="mcp-service-type"
                  aria-label={Locale.Settings.Mcp.Form.Type.Title}
                  type="text"
                  value="streamableHttp"
                  disabled
                />
              </ListItem>
              <ListItem
                title={Locale.Settings.Mcp.Form.BaseUrl.Title}
                subTitle={Locale.Settings.Mcp.Form.BaseUrl.SubTitle}
                className={styles["mcp-form-item"]}
              >
                <input
                  id={getModalFieldId("base-url")}
                  name="mcp-service-base-url"
                  aria-label={Locale.Settings.Mcp.Form.BaseUrl.Title}
                  type="text"
                  value={formState.baseUrl}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setFormState((prev) => ({
                      ...prev,
                      baseUrl: value,
                    }));
                  }}
                  placeholder={Locale.Settings.Mcp.Form.BaseUrl.Placeholder}
                />
              </ListItem>
              <ListItem
                title={Locale.Settings.Mcp.Form.Headers.Title}
                subTitle={Locale.Settings.Mcp.Form.Headers.SubTitle}
                className={styles["mcp-form-item"]}
              >
                <Input
                  id={getModalFieldId("headers")}
                  name="mcp-service-headers"
                  aria-label={Locale.Settings.Mcp.Form.Headers.Title}
                  rows={5}
                  className={styles["mcp-plain-textarea"]}
                  value={formState.headers}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setFormState((prev) => ({
                      ...prev,
                      headers: value,
                    }));
                  }}
                  placeholder={Locale.Settings.Mcp.Form.Headers.Placeholder}
                />
              </ListItem>
              <ListItem
                title={Locale.Settings.Mcp.Form.LongRunning.Title}
                subTitle={Locale.Settings.Mcp.Form.LongRunning.SubTitle}
                className={styles["mcp-form-item"]}
              >
                <input
                  type="checkbox"
                  id={getModalFieldId("long-running")}
                  name="mcp-service-long-running"
                  aria-label={Locale.Settings.Mcp.Form.LongRunning.Title}
                  checked={formState.longRunning}
                  onChange={(e) => {
                    const checked = e.currentTarget.checked;
                    setFormState((prev) => ({
                      ...prev,
                      longRunning: checked,
                      timeout: checked
                        ? Math.max(600, prev.timeout)
                        : prev.timeout,
                    }));
                  }}
                />
              </ListItem>
              <ListItem
                title={Locale.Settings.Mcp.Form.Timeout.Title}
                subTitle={Locale.Settings.Mcp.Form.Timeout.SubTitle}
                className={styles["mcp-form-item"]}
              >
                <input
                  type="number"
                  id={getModalFieldId("timeout")}
                  name="mcp-service-timeout"
                  aria-label={Locale.Settings.Mcp.Form.Timeout.Title}
                  min={1}
                  max={3600}
                  value={formState.timeout}
                  onChange={(e) => {
                    const value = Number(e.currentTarget.value) || 1;
                    setFormState((prev) => ({
                      ...prev,
                      timeout: value,
                    }));
                  }}
                />
              </ListItem>
            </List>
          </Modal>
        </div>
      )}

      {modalState.type === "import" && (
        <div className="modal-mask">
          <Modal
            title={Locale.Settings.Mcp.Modal.ImportTitle}
            onClose={() => setModalState({ type: "hidden" })}
            actions={[
              <IconButton
                key="cancel"
                text={Locale.UI.Cancel}
                onClick={() => setModalState({ type: "hidden" })}
                bordered
              />,
              <IconButton
                key="import"
                text={Locale.UI.Confirm}
                type="primary"
                onClick={handleImport}
                bordered
              />,
            ]}
          >
            <List>
              <ListItem
                title={Locale.Settings.Mcp.Form.Import.Title}
                subTitle={Locale.Settings.Mcp.Form.Import.SubTitle}
                className={styles["mcp-form-item"]}
              >
                <Input
                  id="mcp-import-json"
                  name="mcp-import-json"
                  aria-label={Locale.Settings.Mcp.Form.Import.Title}
                  rows={16}
                  className={styles["mcp-plain-textarea"]}
                  value={importJson}
                  onChange={(e) => setImportJson(e.currentTarget.value)}
                  placeholder={Locale.Settings.Mcp.Form.Import.Placeholder}
                />
              </ListItem>
            </List>
          </Modal>
        </div>
      )}

      {modalState.type === "test" && (
        <div className="modal-mask">
          <Modal
            title={Locale.Settings.Mcp.Modal.TestTitle(modalState.serverName)}
            onClose={() => setModalState({ type: "hidden" })}
            actions={[
              <IconButton
                key="close"
                text={Locale.UI.Close}
                onClick={() => setModalState({ type: "hidden" })}
                bordered
              />,
            ]}
          >
            <pre className={styles["mcp-test-output"]}>
              {JSON.stringify(modalState.payload, null, 2)}
            </pre>
          </Modal>
        </div>
      )}
    </div>
  );
}
