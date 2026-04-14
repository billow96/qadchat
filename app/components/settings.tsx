import { useState, useEffect, useMemo } from "react";

import styles from "./settings.module.scss";

import ResetIcon from "../icons/reload.svg";
import AddIcon from "../icons/add.svg";
import CloseIcon from "../icons/close.svg";
import CopyIcon from "../icons/copy.svg";
import ClearIcon from "../icons/clear.svg";
import LoadingIcon from "../icons/three-dots.svg";
import EditIcon from "../icons/edit.svg";
import FireIcon from "../icons/fire.svg";
import EyeIcon from "../icons/eye.svg";
import DownloadIcon from "../icons/download.svg";
import UploadIcon from "../icons/upload.svg";
import ConfigIcon from "../icons/config.svg";
import ConfirmIcon from "../icons/confirm.svg";
import DownIcon from "../icons/down.svg";

import ConnectionIcon from "../icons/connection.svg";
import CloudSuccessIcon from "../icons/cloud-success.svg";
import CloudFailIcon from "../icons/cloud-fail.svg";
import { trackSettingsPageGuideToCPaymentClick } from "../utils/auth-settings-events";
import {
  Input,
  List,
  ListItem,
  Modal,
  PasswordInput,
  Popover,
  Select,
  showConfirm,
  showToast,
} from "./ui-lib";
import { ModelConfigList } from "./model-config";
import { ProviderIcon } from "./provider-icon";
import { ModelCapabilityIcons } from "./model-capability-icons";
import { getModelCapabilitiesWithCustomConfig } from "../config/model-capabilities";
import { normalizeProviderName } from "../client/api";
import { getModelCompressThreshold } from "../config/model-context-tokens";

import { IconButton } from "./button";
import {
  SubmitKey,
  useChatStore,
  Theme,
  useUpdateStore,
  useAccessStore,
  useAppConfig,
  CustomProviderType,
} from "../store";

import Locale, {
  AllLangs,
  ALL_LANG_OPTIONS,
  changeLang,
  getLang,
} from "../locales";
import { copyToClipboard, clientUpdate, semverCompare } from "../utils";
import { groupBy } from "lodash-es";
import Link from "next/link";
import {
  Anthropic,
  ByteDance,
  Alibaba,
  Moonshot,
  XAI,
  Google,
  GoogleSafetySettingsThreshold,
  OPENAI_BASE_URL,
  Path,
  RELEASE_URL,
  STORAGE_KEY,
  ServiceProvider,
  SlotID,
  UPDATE_URL,
  SAAS_CHAT_URL,
  DeepSeek,
  SiliconFlow,
} from "../constant";
import { Prompt, SearchService, usePromptStore } from "../store/prompt";
import { ErrorBoundary } from "./error";
import { InputRange } from "./input-range";
import { useLocation, useNavigate } from "react-router-dom";
import { Avatar, AvatarPicker } from "./emoji";
import { getClientConfig } from "../config/client";
import { useSyncStore } from "../store/sync";
import { nanoid } from "nanoid";
import { useMaskStore } from "../store/mask";
import { ProviderType } from "../utils/cloud";
import { TTSConfigList } from "./tts-config";
import { RealtimeConfigList } from "./realtime-chat/realtime-config";
import { ModelManager } from "./model-manager";
import { useAllModels } from "../utils/hooks";
import { getModelProvider } from "../utils/model";
import { useEnabledModels } from "../utils/hooks";
import { MCPSettings } from "./mcp-settings";

// 设置页面的分类枚举
enum SettingsTab {
  General = "general",
  Sync = "sync",
  Mcp = "mcp",
  Mask = "mask",
  Prompt = "prompt",
  ModelService = "model-service",
  ModelConfig = "model-config",
  Voice = "voice",
}

// 自定义服务商添加弹窗组件
interface AddCustomProviderModalProps {
  onClose: () => void;
  onAdd: (provider: {
    name: string;
    type: CustomProviderType;
    apiKey: string;
    endpoint?: string;
    enabled: boolean;
  }) => void;
}

function AddCustomProviderModal({
  onClose,
  onAdd,
}: AddCustomProviderModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    type: "openai" as CustomProviderType,
    apiKey: "",
    endpoint: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const accessStore = useAccessStore();

  const providerTypeOptions = [
    {
      value: "openai",
      label: "OpenAI",
      description: Locale.Settings.Access.CustomProvider.Modal.Type.OpenAI,
    },
    {
      value: "google",
      label: "Google",
      description: Locale.Settings.Access.CustomProvider.Modal.Type.Google,
    },
    {
      value: "anthropic",
      label: "Anthropic",
      description: Locale.Settings.Access.CustomProvider.Modal.Type.Anthropic,
    },
  ];

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name =
        Locale.Settings.Access.CustomProvider.Modal.Name.Required;
    } else if (!accessStore.isCustomProviderNameUnique(formData.name.trim())) {
      newErrors.name = Locale.Settings.Access.CustomProvider.Modal.Name.Unique;
    }

    if (!formData.apiKey.trim()) {
      newErrors.apiKey =
        Locale.Settings.Access.CustomProvider.Modal.ApiKey.Required;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onAdd({
        name: formData.name.trim(),
        type: formData.type,
        apiKey: formData.apiKey.trim(),
        endpoint: formData.endpoint.trim() || undefined,
        enabled: true,
      });
    }
  };

  return (
    <div className="modal-mask">
      <div className={styles["modal-container"]}>
        <div className={styles["modal-header"]}>
          <div className={styles["modal-title"]}>
            {Locale.Settings.Access.CustomProvider.Modal.Title}
          </div>
          <button className={styles["modal-close-button"]} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles["modal-content"]}>
          <div className={styles["form-group"]}>
            <label>
              {Locale.Settings.Access.CustomProvider.Modal.Name.Title} *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder={
                Locale.Settings.Access.CustomProvider.Modal.Name.Placeholder
              }
              className={errors.name ? styles["error"] : ""}
            />
            {errors.name && (
              <div className={styles["error-message"]}>{errors.name}</div>
            )}
          </div>

          <div className={styles["form-group"]}>
            <label>
              {Locale.Settings.Access.CustomProvider.Modal.Type.Title} *
            </label>
            <select
              value={formData.type}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  type: e.target.value as CustomProviderType,
                })
              }
            >
              {providerTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} - {option.description}
                </option>
              ))}
            </select>
          </div>

          <div className={styles["form-group"]}>
            <label>
              {Locale.Settings.Access.CustomProvider.Modal.ApiKey.Title} *
            </label>
            <input
              type="password"
              value={formData.apiKey}
              onChange={(e) =>
                setFormData({ ...formData, apiKey: e.target.value })
              }
              placeholder={
                Locale.Settings.Access.CustomProvider.Modal.ApiKey.Placeholder
              }
              className={errors.apiKey ? styles["error"] : ""}
            />
            {errors.apiKey && (
              <div className={styles["error-message"]}>{errors.apiKey}</div>
            )}
          </div>

          <div className={styles["form-group"]}>
            <label>
              {Locale.Settings.Access.CustomProvider.Modal.Endpoint.Title}{" "}
              {Locale.Settings.Access.CustomProvider.Modal.Endpoint.Optional}
            </label>
            <input
              type="text"
              value={formData.endpoint}
              onChange={(e) =>
                setFormData({ ...formData, endpoint: e.target.value })
              }
              placeholder={
                Locale.Settings.Access.CustomProvider.Modal.Endpoint.Placeholder
              }
            />
          </div>
        </div>

        <div className={styles["modal-footer"]}>
          <button className={styles["cancel-button"]} onClick={onClose}>
            {Locale.Settings.Access.CustomProvider.Modal.Cancel}
          </button>
          <button className={styles["confirm-button"]} onClick={handleSubmit}>
            {Locale.Settings.Access.CustomProvider.Modal.Confirm}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditPromptModal(props: { id: string; onClose: () => void }) {
  const promptStore = usePromptStore();
  const prompt = promptStore.get(props.id);

  return prompt ? (
    <div className="modal-mask">
      <Modal
        title={Locale.Settings.Prompt.EditModal.Title}
        onClose={props.onClose}
        actions={[
          <IconButton
            key=""
            onClick={props.onClose}
            text={Locale.UI.Confirm}
            bordered
          />,
        ]}
      >
        <div className={styles["edit-prompt-modal"]}>
          <input
            type="text"
            value={prompt.title}
            readOnly={!prompt.isUser}
            className={styles["edit-prompt-title"]}
            onInput={(e) =>
              promptStore.updatePrompt(
                props.id,
                (prompt) => (prompt.title = e.currentTarget.value),
              )
            }
          ></input>
          <Input
            value={prompt.content}
            readOnly={!prompt.isUser}
            className={styles["edit-prompt-content"]}
            rows={10}
            onInput={(e) =>
              promptStore.updatePrompt(
                props.id,
                (prompt) => (prompt.content = e.currentTarget.value),
              )
            }
          ></Input>
        </div>
      </Modal>
    </div>
  ) : null;
}

function UserPromptModal(props: { onClose?: () => void }) {
  const promptStore = usePromptStore();
  const userPrompts = promptStore.getUserPrompts();
  const builtinPrompts = SearchService.builtinPrompts;
  const allPrompts = userPrompts.concat(builtinPrompts);
  const [searchInput, setSearchInput] = useState("");
  const [searchPrompts, setSearchPrompts] = useState<Prompt[]>([]);
  const prompts = searchInput.length > 0 ? searchPrompts : allPrompts;

  const [editingPromptId, setEditingPromptId] = useState<string>();

  useEffect(() => {
    if (searchInput.length > 0) {
      const searchResult = SearchService.search(searchInput);
      setSearchPrompts(searchResult);
    } else {
      setSearchPrompts([]);
    }
  }, [searchInput]);

  return (
    <div className="modal-mask">
      <Modal
        title={Locale.Settings.Prompt.Modal.Title}
        onClose={() => props.onClose?.()}
        actions={[
          <IconButton
            key="add"
            onClick={() => {
              const promptId = promptStore.add({
                id: nanoid(),
                createdAt: Date.now(),
                title: "Empty Prompt",
                content: "Empty Prompt Content",
              });
              setEditingPromptId(promptId);
            }}
            icon={<AddIcon />}
            bordered
            text={Locale.Settings.Prompt.Modal.Add}
          />,
        ]}
      >
        <div className={styles["user-prompt-modal"]}>
          <input
            type="text"
            className={styles["user-prompt-search"]}
            placeholder={Locale.Settings.Prompt.Modal.Search}
            value={searchInput}
            onInput={(e) => setSearchInput(e.currentTarget.value)}
          ></input>

          <div className={styles["user-prompt-list"]}>
            {prompts.map((v, _) => (
              <div className={styles["user-prompt-item"]} key={v.id ?? v.title}>
                <div className={styles["user-prompt-header"]}>
                  <div className={styles["user-prompt-title"]}>{v.title}</div>
                  <div className={styles["user-prompt-content"] + " one-line"}>
                    {v.content}
                  </div>
                </div>

                <div className={styles["user-prompt-buttons"]}>
                  {v.isUser && (
                    <IconButton
                      icon={<ClearIcon />}
                      className={styles["user-prompt-button"]}
                      onClick={() => promptStore.remove(v.id!)}
                    />
                  )}
                  {v.isUser ? (
                    <IconButton
                      icon={<EditIcon />}
                      className={styles["user-prompt-button"]}
                      onClick={() => setEditingPromptId(v.id)}
                    />
                  ) : (
                    <IconButton
                      icon={<EyeIcon />}
                      className={styles["user-prompt-button"]}
                      onClick={() => setEditingPromptId(v.id)}
                    />
                  )}
                  <IconButton
                    icon={<CopyIcon />}
                    className={styles["user-prompt-button"]}
                    onClick={() => copyToClipboard(v.content)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {editingPromptId !== undefined && (
        <EditPromptModal
          id={editingPromptId!}
          onClose={() => setEditingPromptId(undefined)}
        />
      )}
    </div>
  );
}

function DangerItems() {
  const chatStore = useChatStore();
  const appConfig = useAppConfig();

  return (
    <List>
      <ListItem
        title={Locale.Settings.Danger.Reset.Title}
        subTitle={Locale.Settings.Danger.Reset.SubTitle}
      >
        <IconButton
          aria={Locale.Settings.Danger.Reset.Title}
          text={Locale.Settings.Danger.Reset.Action}
          onClick={async () => {
            if (await showConfirm(Locale.Settings.Danger.Reset.Confirm)) {
              appConfig.reset();
            }
          }}
          type="danger"
        />
      </ListItem>
      <ListItem
        title={Locale.Settings.Danger.Clear.Title}
        subTitle={Locale.Settings.Danger.Clear.SubTitle}
      >
        <IconButton
          aria={Locale.Settings.Danger.Clear.Title}
          text={Locale.Settings.Danger.Clear.Action}
          onClick={async () => {
            if (await showConfirm(Locale.Settings.Danger.Clear.Confirm)) {
              chatStore.clearAllData();
            }
          }}
          type="danger"
        />
      </ListItem>
    </List>
  );
}

function CheckButton() {
  const syncStore = useSyncStore();

  const couldCheck = useMemo(() => {
    return syncStore.cloudSync();
  }, [syncStore]);

  const [checkState, setCheckState] = useState<
    "none" | "checking" | "success" | "failed"
  >("none");

  async function check() {
    setCheckState("checking");
    const valid = await syncStore.check();
    setCheckState(valid ? "success" : "failed");
    if (valid) {
      showToast(Locale.UI.Success ?? "可用性检查通过");
    } else {
      showToast(Locale.Settings.Sync.Fail ?? "可用性检查失败");
    }
  }

  if (!couldCheck) return null;

  return (
    <IconButton
      text={Locale.Settings.Sync.Config.Modal.Check}
      bordered
      onClick={check}
      icon={
        checkState === "none" ? (
          <ConnectionIcon />
        ) : checkState === "checking" ? (
          <LoadingIcon />
        ) : checkState === "success" ? (
          <CloudSuccessIcon />
        ) : checkState === "failed" ? (
          <CloudFailIcon />
        ) : (
          <ConnectionIcon />
        )
      }
    ></IconButton>
  );
}

function SyncConfigModal(props: { onClose?: () => void }) {
  const syncStore = useSyncStore();

  return (
    <div className="modal-mask">
      <Modal
        title={Locale.Settings.Sync.Config.Modal.Title}
        onClose={() => props.onClose?.()}
        actions={[
          <CheckButton key="check" />,
          <IconButton
            key="confirm"
            onClick={props.onClose}
            icon={<ConfirmIcon />}
            bordered
            text={Locale.UI.Confirm}
          />,
        ]}
      >
        <List>
          <ListItem
            title={Locale.Settings.Sync.Config.SyncType.Title}
            subTitle={Locale.Settings.Sync.Config.SyncType.SubTitle}
          >
            <select
              value={syncStore.provider}
              onChange={(e) => {
                syncStore.update(
                  (config) =>
                    (config.provider = e.target.value as ProviderType),
                );
              }}
            >
              {Object.entries(ProviderType).map(([k, v]) => (
                <option value={v} key={k}>
                  {k}
                </option>
              ))}
            </select>
          </ListItem>

          <ListItem
            title={Locale.Settings.Sync.Config.Proxy.Title}
            subTitle={Locale.Settings.Sync.Config.Proxy.SubTitle}
          >
            <input
              type="checkbox"
              checked={syncStore.useProxy}
              onChange={(e) => {
                syncStore.update(
                  (config) => (config.useProxy = e.currentTarget.checked),
                );
              }}
            ></input>
          </ListItem>
          {syncStore.useProxy ? (
            <ListItem
              title={Locale.Settings.Sync.Config.ProxyUrl.Title}
              subTitle={Locale.Settings.Sync.Config.ProxyUrl.SubTitle}
            >
              <input
                type="text"
                value={syncStore.proxyUrl}
                onChange={(e) => {
                  syncStore.update(
                    (config) => (config.proxyUrl = e.currentTarget.value),
                  );
                }}
              ></input>
            </ListItem>
          ) : null}
        </List>

        {syncStore.provider === ProviderType.WebDAV && (
          <>
            <List>
              <ListItem title={Locale.Settings.Sync.Config.WebDav.Endpoint}>
                <input
                  type="text"
                  value={syncStore.webdav.endpoint}
                  onChange={(e) => {
                    syncStore.update(
                      (config) =>
                        (config.webdav.endpoint = e.currentTarget.value),
                    );
                  }}
                ></input>
              </ListItem>

              <ListItem title={Locale.Settings.Sync.Config.WebDav.UserName}>
                <input
                  type="text"
                  value={syncStore.webdav.username}
                  onChange={(e) => {
                    syncStore.update(
                      (config) =>
                        (config.webdav.username = e.currentTarget.value),
                    );
                  }}
                ></input>
              </ListItem>
              <ListItem title={Locale.Settings.Sync.Config.WebDav.Password}>
                <PasswordInput
                  value={syncStore.webdav.password}
                  onChange={(e) => {
                    syncStore.update(
                      (config) =>
                        (config.webdav.password = e.currentTarget.value),
                    );
                  }}
                ></PasswordInput>
              </ListItem>
            </List>
          </>
        )}

        {syncStore.provider === ProviderType.UpStash && (
          <List>
            <ListItem title={Locale.Settings.Sync.Config.UpStash.Endpoint}>
              <input
                type="text"
                value={syncStore.upstash.endpoint}
                onChange={(e) => {
                  syncStore.update(
                    (config) =>
                      (config.upstash.endpoint = e.currentTarget.value),
                  );
                }}
              ></input>
            </ListItem>

            <ListItem title={Locale.Settings.Sync.Config.UpStash.UserName}>
              <input
                type="text"
                value={syncStore.upstash.username}
                placeholder={STORAGE_KEY}
                onChange={(e) => {
                  syncStore.update(
                    (config) =>
                      (config.upstash.username = e.currentTarget.value),
                  );
                }}
              ></input>
            </ListItem>
            <ListItem title={Locale.Settings.Sync.Config.UpStash.Password}>
              <PasswordInput
                value={syncStore.upstash.apiKey}
                onChange={(e) => {
                  syncStore.update(
                    (config) => (config.upstash.apiKey = e.currentTarget.value),
                  );
                }}
              ></PasswordInput>
            </ListItem>
          </List>
        )}
      </Modal>
    </div>
  );
}

function SyncItems() {
  const syncStore = useSyncStore();
  const chatStore = useChatStore();
  const promptStore = usePromptStore();
  const maskStore = useMaskStore();
  const couldSync = useMemo(() => {
    return syncStore.cloudSync();
  }, [syncStore]);

  const [showSyncConfigModal, setShowSyncConfigModal] = useState(false);

  const stateOverview = useMemo(() => {
    const sessions = chatStore.sessions;
    const messageCount = sessions.reduce((p, c) => p + c.messages.length, 0);

    return {
      chat: sessions.length,
      message: messageCount,
      prompt: Object.keys(promptStore.prompts).length,
      mask: Object.keys(maskStore.masks).length,
    };
  }, [chatStore.sessions, maskStore.masks, promptStore.prompts]);

  return (
    <>
      <List>
        <ListItem
          title={Locale.Settings.Sync.CloudState}
          subTitle={
            syncStore.lastProvider
              ? `${new Date(syncStore.lastSyncTime).toLocaleString()} [${
                  syncStore.lastProvider
                }]`
              : Locale.Settings.Sync.NotSyncYet
          }
        >
          <div style={{ display: "flex" }}>
            <IconButton
              aria={Locale.Settings.Sync.CloudState + Locale.UI.Config}
              icon={<ConfigIcon />}
              text={Locale.UI.Config}
              onClick={() => {
                setShowSyncConfigModal(true);
              }}
            />
            {couldSync && (
              <IconButton
                icon={<ResetIcon />}
                text={Locale.UI.Sync}
                onClick={async () => {
                  try {
                    await syncStore.sync();
                    showToast(Locale.Settings.Sync.Success);
                  } catch (e) {
                    showToast(Locale.Settings.Sync.Fail);
                    console.error("[Sync]", e);
                  }
                }}
              />
            )}
          </div>
        </ListItem>

        <ListItem
          title={Locale.Settings.Sync.LocalState}
          subTitle={Locale.Settings.Sync.Overview(stateOverview)}
        >
          <div style={{ display: "flex" }}>
            <IconButton
              aria={Locale.Settings.Sync.LocalState + Locale.UI.Export}
              icon={<UploadIcon />}
              text={Locale.UI.Export}
              onClick={() => {
                syncStore.export();
              }}
            />
            <IconButton
              aria={Locale.Settings.Sync.LocalState + Locale.UI.Import}
              icon={<DownloadIcon />}
              text={Locale.UI.Import}
              onClick={() => {
                syncStore.import();
              }}
            />
          </div>
        </ListItem>
      </List>

      {showSyncConfigModal && (
        <SyncConfigModal onClose={() => setShowSyncConfigModal(false)} />
      )}
    </>
  );
}

export function Settings() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [currentTab, setCurrentTab] = useState<SettingsTab>(
    SettingsTab.General,
  );
  const config = useAppConfig();
  const updateConfig = config.update;

  const updateStore = useUpdateStore();
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const currentVersion = updateStore.formatVersion(updateStore.version);
  const remoteId = updateStore.formatVersion(updateStore.remoteVersion);
  const hasNewVersion = semverCompare(currentVersion, remoteId) === -1;
  const updateUrl = getClientConfig()?.isApp ? RELEASE_URL : UPDATE_URL;

  function checkUpdate(force = false) {
    setCheckingUpdate(true);
    updateStore.getLatestVersion(force).then(() => {
      setCheckingUpdate(false);
    });
  }

  const accessStore = useAccessStore();

  // 确保访问存储状态是最新的
  useEffect(() => {
    accessStore.fetch();
  }, [accessStore]);

  useEffect(() => {
    if (location.pathname === Path.McpMarket) {
      setCurrentTab(SettingsTab.Mcp);
    }
  }, [location.pathname]);

  const enabledAccessControl = useMemo(
    () => accessStore.enabledAccessControl(),
    [accessStore],
  );

  const promptStore = usePromptStore();
  const builtinCount = SearchService.count.builtin;
  const customCount = promptStore.getUserPrompts().length ?? 0;
  const [shouldShowPromptModal, setShowPromptModal] = useState(false);
  const [showModelManager, setShowModelManager] = useState(false);
  const [currentProvider, setCurrentProvider] = useState<
    ServiceProvider | string | null
  >(null);
  const [showAddCustomProvider, setShowAddCustomProvider] = useState(false);
  const [collapsedProviders, setCollapsedProviders] = useState<
    Record<ServiceProvider, boolean>
  >({
    [ServiceProvider.OpenAI]: true, // 默认全部折叠
    [ServiceProvider.Google]: true,
    [ServiceProvider.Anthropic]: true,
    [ServiceProvider.ByteDance]: true,
    [ServiceProvider.Alibaba]: true,
    [ServiceProvider.Moonshot]: true,
    [ServiceProvider.XAI]: true,
    [ServiceProvider.DeepSeek]: true,
    [ServiceProvider.SiliconFlow]: true,
  });

  // 自定义服务商的折叠状态 - 默认全部折叠
  const [collapsedCustomProviders, setCollapsedCustomProviders] = useState<
    Record<string, boolean>
  >(() => {
    const initialState: Record<string, boolean> = {};
    accessStore.customProviders.forEach((provider) => {
      initialState[provider.id] = true; // 默认折叠
    });
    return initialState;
  });

  // 当自定义服务商列表变化时，更新折叠状态
  useEffect(() => {
    setCollapsedCustomProviders((prev) => {
      const newState = { ...prev };
      accessStore.customProviders.forEach((provider) => {
        if (!(provider.id in newState)) {
          newState[provider.id] = true; // 新添加的服务商默认折叠
        }
      });
      return newState;
    });
  }, [accessStore.customProviders]);

  useEffect(() => {
    // checks per minutes
    checkUpdate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const keydownEvent = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        navigate(Path.Home);
      }
    };
    if (clientConfig?.isApp) {
      // Force to set custom endpoint to true if it's app
      accessStore.update((state) => {
        state.useCustomConfig = true;
      });
    }
    document.addEventListener("keydown", keydownEvent);
    return () => {
      document.removeEventListener("keydown", keydownEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clientConfig = useMemo(() => getClientConfig(), []);
  const showAccessCode = enabledAccessControl && !clientConfig?.isApp;

  const accessCodeComponent = showAccessCode && (
    <ListItem
      title={Locale.Settings.Access.AccessCode.Title}
      subTitle={Locale.Settings.Access.AccessCode.SubTitle}
    >
      <PasswordInput
        value={accessStore.accessCode}
        type="text"
        placeholder={Locale.Settings.Access.AccessCode.Placeholder}
        onChange={(e) => {
          accessStore.updateAccessCode(e.currentTarget.value);
        }}
      />
    </ListItem>
  );

  const useCustomConfigComponent = // Conditionally render the following ListItem based on clientConfig.isApp
    !clientConfig?.isApp && ( // only show if isApp is false
      <ListItem
        title={Locale.Settings.Access.CustomEndpoint.Title}
        subTitle={Locale.Settings.Access.CustomEndpoint.SubTitle}
      >
        <input
          aria-label={Locale.Settings.Access.CustomEndpoint.Title}
          type="checkbox"
          checked={accessStore.useCustomConfig}
          onChange={(e) =>
            accessStore.update(
              (access) => (access.useCustomConfig = e.currentTarget.checked),
            )
          }
        ></input>
      </ListItem>
    );

  const openAIConfigComponent = (
    <>
      <ListItem
        title={Locale.Settings.Access.OpenAI.Endpoint.Title}
        subTitle={
          <span className={styles["long-text-wrap"]}>
            {Locale.Settings.Access.OpenAI.Endpoint.SubTitle}
          </span>
        }
      >
        <input
          aria-label={Locale.Settings.Access.OpenAI.Endpoint.Title}
          type="text"
          value={accessStore.openaiUrl}
          placeholder={OPENAI_BASE_URL}
          onChange={(e) =>
            accessStore.update(
              (access) => (access.openaiUrl = e.currentTarget.value),
            )
          }
        ></input>
      </ListItem>
      <ListItem
        title={Locale.Settings.Access.OpenAI.ApiKey.Title}
        subTitle={Locale.Settings.Access.OpenAI.ApiKey.SubTitle}
      >
        <PasswordInput
          aria-label={Locale.Settings.Access.OpenAI.ApiKey.Title}
          value={accessStore.openaiApiKey}
          type="text"
          placeholder={Locale.Settings.Access.OpenAI.ApiKey.Placeholder}
          onChange={(e) => {
            accessStore.update(
              (access) => (access.openaiApiKey = e.currentTarget.value),
            );
          }}
        />
      </ListItem>
    </>
  );

  const googleConfigComponent = (
    <>
      <ListItem
        title={Locale.Settings.Access.Google.Endpoint.Title}
        subTitle={
          <span className={styles["long-text-wrap"]}>
            {Locale.Settings.Access.Google.Endpoint.SubTitle +
              Google.ExampleEndpoint}
          </span>
        }
      >
        <input
          aria-label={Locale.Settings.Access.Google.Endpoint.Title}
          type="text"
          value={accessStore.googleUrl}
          placeholder={Google.ExampleEndpoint}
          onChange={(e) =>
            accessStore.update(
              (access) => (access.googleUrl = e.currentTarget.value),
            )
          }
        ></input>
      </ListItem>
      <ListItem
        title={Locale.Settings.Access.Google.ApiKey.Title}
        subTitle={Locale.Settings.Access.Google.ApiKey.SubTitle}
      >
        <PasswordInput
          aria-label={Locale.Settings.Access.Google.ApiKey.Title}
          value={accessStore.googleApiKey}
          type="text"
          placeholder={Locale.Settings.Access.Google.ApiKey.Placeholder}
          onChange={(e) => {
            accessStore.update(
              (access) => (access.googleApiKey = e.currentTarget.value),
            );
          }}
        />
      </ListItem>
      <ListItem
        title={Locale.Settings.Access.Google.ApiVersion.Title}
        subTitle={Locale.Settings.Access.Google.ApiVersion.SubTitle}
      >
        <input
          aria-label={Locale.Settings.Access.Google.ApiVersion.Title}
          type="text"
          value={accessStore.googleApiVersion}
          placeholder="2023-08-01-preview"
          onChange={(e) =>
            accessStore.update(
              (access) => (access.googleApiVersion = e.currentTarget.value),
            )
          }
        ></input>
      </ListItem>
    </>
  );

  const anthropicConfigComponent = (
    <>
      <ListItem
        title={Locale.Settings.Access.Anthropic.Endpoint.Title}
        subTitle={
          <span className={styles["long-text-wrap"]}>
            {Locale.Settings.Access.Anthropic.Endpoint.SubTitle +
              Anthropic.ExampleEndpoint}
          </span>
        }
      >
        <input
          aria-label={Locale.Settings.Access.Anthropic.Endpoint.Title}
          type="text"
          value={accessStore.anthropicUrl}
          placeholder={Anthropic.ExampleEndpoint}
          onChange={(e) =>
            accessStore.update(
              (access) => (access.anthropicUrl = e.currentTarget.value),
            )
          }
        ></input>
      </ListItem>
      <ListItem
        title={Locale.Settings.Access.Anthropic.ApiKey.Title}
        subTitle={Locale.Settings.Access.Anthropic.ApiKey.SubTitle}
      >
        <PasswordInput
          aria-label={Locale.Settings.Access.Anthropic.ApiKey.Title}
          value={accessStore.anthropicApiKey}
          type="text"
          placeholder={Locale.Settings.Access.Anthropic.ApiKey.Placeholder}
          onChange={(e) => {
            accessStore.update(
              (access) => (access.anthropicApiKey = e.currentTarget.value),
            );
          }}
        />
      </ListItem>
      <ListItem
        title={Locale.Settings.Access.Anthropic.ApiVerion.Title}
        subTitle={Locale.Settings.Access.Anthropic.ApiVerion.SubTitle}
      >
        <input
          aria-label={Locale.Settings.Access.Anthropic.ApiVerion.Title}
          type="text"
          value={accessStore.anthropicApiVersion}
          placeholder={Anthropic.Vision}
          onChange={(e) =>
            accessStore.update(
              (access) => (access.anthropicApiVersion = e.currentTarget.value),
            )
          }
        ></input>
      </ListItem>
    </>
  );

  const byteDanceConfigComponent = (
    <>
      <ListItem
        title={Locale.Settings.Access.ByteDance.Endpoint.Title}
        subTitle={
          <span className={styles["long-text-wrap"]}>
            {Locale.Settings.Access.ByteDance.Endpoint.SubTitle +
              ByteDance.ExampleEndpoint}
          </span>
        }
      >
        <input
          aria-label={Locale.Settings.Access.ByteDance.Endpoint.Title}
          type="text"
          value={accessStore.bytedanceUrl}
          placeholder={ByteDance.ExampleEndpoint}
          onChange={(e) =>
            accessStore.update(
              (access) => (access.bytedanceUrl = e.currentTarget.value),
            )
          }
        ></input>
      </ListItem>
      <ListItem
        title={Locale.Settings.Access.ByteDance.ApiKey.Title}
        subTitle={Locale.Settings.Access.ByteDance.ApiKey.SubTitle}
      >
        <PasswordInput
          aria-label={Locale.Settings.Access.ByteDance.ApiKey.Title}
          value={accessStore.bytedanceApiKey}
          type="text"
          placeholder={Locale.Settings.Access.ByteDance.ApiKey.Placeholder}
          onChange={(e) => {
            accessStore.update(
              (access) => (access.bytedanceApiKey = e.currentTarget.value),
            );
          }}
        />
      </ListItem>
    </>
  );

  const alibabaConfigComponent = (
    <>
      <ListItem
        title={Locale.Settings.Access.Alibaba.Endpoint.Title}
        subTitle={
          <span className={styles["long-text-wrap"]}>
            {Locale.Settings.Access.Alibaba.Endpoint.SubTitle +
              Alibaba.ExampleEndpoint}
          </span>
        }
      >
        <input
          aria-label={Locale.Settings.Access.Alibaba.Endpoint.Title}
          type="text"
          value={accessStore.alibabaUrl}
          placeholder={Alibaba.ExampleEndpoint}
          onChange={(e) =>
            accessStore.update(
              (access) => (access.alibabaUrl = e.currentTarget.value),
            )
          }
        ></input>
      </ListItem>
      <ListItem
        title={Locale.Settings.Access.Alibaba.ApiKey.Title}
        subTitle={Locale.Settings.Access.Alibaba.ApiKey.SubTitle}
      >
        <PasswordInput
          aria-label={Locale.Settings.Access.Alibaba.ApiKey.Title}
          value={accessStore.alibabaApiKey}
          type="text"
          placeholder={Locale.Settings.Access.Alibaba.ApiKey.Placeholder}
          onChange={(e) => {
            accessStore.update(
              (access) => (access.alibabaApiKey = e.currentTarget.value),
            );
          }}
        />
      </ListItem>
    </>
  );

  const moonshotConfigComponent = (
    <>
      <ListItem
        title={Locale.Settings.Access.Moonshot.Endpoint.Title}
        subTitle={
          <span className={styles["long-text-wrap"]}>
            {Locale.Settings.Access.Moonshot.Endpoint.SubTitle +
              Moonshot.ExampleEndpoint}
          </span>
        }
      >
        <input
          aria-label={Locale.Settings.Access.Moonshot.Endpoint.Title}
          type="text"
          value={accessStore.moonshotUrl}
          placeholder={Moonshot.ExampleEndpoint}
          onChange={(e) =>
            accessStore.update(
              (access) => (access.moonshotUrl = e.currentTarget.value),
            )
          }
        ></input>
      </ListItem>
      <ListItem
        title={Locale.Settings.Access.Moonshot.ApiKey.Title}
        subTitle={Locale.Settings.Access.Moonshot.ApiKey.SubTitle}
      >
        <PasswordInput
          aria-label={Locale.Settings.Access.Moonshot.ApiKey.Title}
          value={accessStore.moonshotApiKey}
          type="text"
          placeholder={Locale.Settings.Access.Moonshot.ApiKey.Placeholder}
          onChange={(e) => {
            accessStore.update(
              (access) => (access.moonshotApiKey = e.currentTarget.value),
            );
          }}
        />
      </ListItem>
    </>
  );

  const deepseekConfigComponent = (
    <>
      <ListItem
        title={Locale.Settings.Access.DeepSeek.Endpoint.Title}
        subTitle={
          <span className={styles["long-text-wrap"]}>
            {Locale.Settings.Access.DeepSeek.Endpoint.SubTitle +
              DeepSeek.ExampleEndpoint}
          </span>
        }
      >
        <input
          aria-label={Locale.Settings.Access.DeepSeek.Endpoint.Title}
          type="text"
          value={accessStore.deepseekUrl}
          placeholder={DeepSeek.ExampleEndpoint}
          onChange={(e) =>
            accessStore.update(
              (access) => (access.deepseekUrl = e.currentTarget.value),
            )
          }
        ></input>
      </ListItem>
      <ListItem
        title={Locale.Settings.Access.DeepSeek.ApiKey.Title}
        subTitle={Locale.Settings.Access.DeepSeek.ApiKey.SubTitle}
      >
        <PasswordInput
          aria-label={Locale.Settings.Access.DeepSeek.ApiKey.Title}
          value={accessStore.deepseekApiKey}
          type="text"
          placeholder={Locale.Settings.Access.DeepSeek.ApiKey.Placeholder}
          onChange={(e) => {
            accessStore.update(
              (access) => (access.deepseekApiKey = e.currentTarget.value),
            );
          }}
        />
      </ListItem>
    </>
  );

  const XAIConfigComponent = (
    <>
      <ListItem
        title={Locale.Settings.Access.XAI.Endpoint.Title}
        subTitle={
          <span className={styles["long-text-wrap"]}>
            {Locale.Settings.Access.XAI.Endpoint.SubTitle + XAI.ExampleEndpoint}
          </span>
        }
      >
        <input
          aria-label={Locale.Settings.Access.XAI.Endpoint.Title}
          type="text"
          value={accessStore.xaiUrl}
          placeholder={XAI.ExampleEndpoint}
          onChange={(e) =>
            accessStore.update(
              (access) => (access.xaiUrl = e.currentTarget.value),
            )
          }
        ></input>
      </ListItem>
      <ListItem
        title={Locale.Settings.Access.XAI.ApiKey.Title}
        subTitle={Locale.Settings.Access.XAI.ApiKey.SubTitle}
      >
        <PasswordInput
          aria-label={Locale.Settings.Access.XAI.ApiKey.Title}
          value={accessStore.xaiApiKey}
          type="text"
          placeholder={Locale.Settings.Access.XAI.ApiKey.Placeholder}
          onChange={(e) => {
            accessStore.update(
              (access) => (access.xaiApiKey = e.currentTarget.value),
            );
          }}
        />
      </ListItem>
    </>
  );

  const siliconflowConfigComponent = (
    <>
      <ListItem
        title={Locale.Settings.Access.SiliconFlow.Endpoint.Title}
        subTitle={
          <span className={styles["long-text-wrap"]}>
            {Locale.Settings.Access.SiliconFlow.Endpoint.SubTitle +
              SiliconFlow.ExampleEndpoint}
          </span>
        }
      >
        <input
          aria-label={Locale.Settings.Access.SiliconFlow.Endpoint.Title}
          type="text"
          value={accessStore.siliconflowUrl}
          placeholder={SiliconFlow.ExampleEndpoint}
          onChange={(e) =>
            accessStore.update(
              (access) => (access.siliconflowUrl = e.currentTarget.value),
            )
          }
        ></input>
      </ListItem>
      <ListItem
        title={Locale.Settings.Access.SiliconFlow.ApiKey.Title}
        subTitle={Locale.Settings.Access.SiliconFlow.ApiKey.SubTitle}
      >
        <PasswordInput
          aria-label={Locale.Settings.Access.SiliconFlow.ApiKey.Title}
          value={accessStore.siliconflowApiKey}
          type="text"
          placeholder={Locale.Settings.Access.SiliconFlow.ApiKey.Placeholder}
          onChange={(e) => {
            accessStore.update(
              (access) => (access.siliconflowApiKey = e.currentTarget.value),
            );
          }}
        />
      </ListItem>
    </>
  );

  // 分页标签配置
  const tabConfig = [
    {
      key: SettingsTab.General,
      label: Locale.Settings.Tab.General,
      icon: "⚙️",
    },
    { key: SettingsTab.Sync, label: Locale.Settings.Tab.Sync, icon: "☁️" },
    { key: SettingsTab.Mcp, label: Locale.Settings.Tab.Mcp, icon: "🧩" },
    { key: SettingsTab.Mask, label: Locale.Settings.Tab.Mask, icon: "🎭" },
    { key: SettingsTab.Prompt, label: Locale.Settings.Tab.Prompt, icon: "💬" },
    {
      key: SettingsTab.ModelService,
      label: Locale.Settings.Tab.ModelService,
      icon: "🔧",
    },
    {
      key: SettingsTab.ModelConfig,
      label: Locale.Settings.Tab.ModelConfig,
      icon: "🤖",
    },
    { key: SettingsTab.Voice, label: Locale.Settings.Tab.Voice, icon: "🔊" },
  ];

  // 渲染分页内容
  const renderTabContent = () => {
    switch (currentTab) {
      case SettingsTab.General:
        return renderGeneralSettings();
      case SettingsTab.Sync:
        return renderSyncSettings();
      case SettingsTab.Mcp:
        return <MCPSettings />;
      case SettingsTab.Mask:
        return renderMaskSettings();
      case SettingsTab.Prompt:
        return renderPromptSettings();
      case SettingsTab.ModelService:
        return renderModelServiceSettings();
      case SettingsTab.ModelConfig:
        return renderModelConfigSettings();
      case SettingsTab.Voice:
        return renderVoiceSettings();
      default:
        return renderGeneralSettings();
    }
  };

  // 通用配置
  const renderGeneralSettings = () => (
    <>
      <List>
        <ListItem title={Locale.Settings.Avatar}>
          <Popover
            onClose={() => setShowEmojiPicker(false)}
            content={
              <AvatarPicker
                onEmojiClick={(avatar: string) => {
                  updateConfig((config) => (config.avatar = avatar));
                  setShowEmojiPicker(false);
                }}
              />
            }
            open={showEmojiPicker}
          >
            <div
              aria-label={Locale.Settings.Avatar}
              tabIndex={0}
              className={styles.avatar}
              onClick={() => {
                setShowEmojiPicker(!showEmojiPicker);
              }}
            >
              <Avatar avatar={config.avatar} />
            </div>
          </Popover>
        </ListItem>

        <ListItem
          title={Locale.Settings.Update.Version(currentVersion ?? "unknown")}
          subTitle={
            checkingUpdate
              ? Locale.Settings.Update.IsChecking
              : hasNewVersion
              ? Locale.Settings.Update.FoundUpdate(remoteId ?? "ERROR")
              : Locale.Settings.Update.IsLatest
          }
        >
          {checkingUpdate ? (
            <LoadingIcon />
          ) : hasNewVersion ? (
            clientConfig?.isApp ? (
              <IconButton
                icon={<ResetIcon></ResetIcon>}
                text={Locale.Settings.Update.GoToUpdate}
                onClick={() => clientUpdate()}
              />
            ) : (
              <Link href={updateUrl} target="_blank" className="link">
                {Locale.Settings.Update.GoToUpdate}
              </Link>
            )
          ) : (
            <IconButton
              icon={<ResetIcon></ResetIcon>}
              text={Locale.Settings.Update.CheckUpdate}
              onClick={() => checkUpdate(true)}
            />
          )}
        </ListItem>

        <ListItem title={Locale.Settings.SendKey}>
          <Select
            aria-label={Locale.Settings.SendKey}
            value={config.submitKey}
            onChange={(e) => {
              updateConfig(
                (config) =>
                  (config.submitKey = e.target.value as any as SubmitKey),
              );
            }}
          >
            {Object.values(SubmitKey).map((v) => (
              <option value={v} key={v}>
                {v}
              </option>
            ))}
          </Select>
        </ListItem>

        <ListItem title={Locale.Settings.Theme}>
          <Select
            aria-label={Locale.Settings.Theme}
            value={config.theme}
            onChange={(e) => {
              updateConfig(
                (config) => (config.theme = e.target.value as any as Theme),
              );
            }}
          >
            {Object.values(Theme).map((v) => (
              <option value={v} key={v}>
                {v}
              </option>
            ))}
          </Select>
        </ListItem>

        <ListItem title={Locale.Settings.Lang.Name}>
          <Select
            aria-label={Locale.Settings.Lang.Name}
            value={getLang()}
            onChange={(e) => {
              changeLang(e.target.value as any);
            }}
          >
            {AllLangs.map((lang) => (
              <option value={lang} key={lang}>
                {ALL_LANG_OPTIONS[lang]}
              </option>
            ))}
          </Select>
        </ListItem>

        <ListItem
          title={Locale.Settings.FontSize.Title}
          subTitle={Locale.Settings.FontSize.SubTitle}
        >
          <InputRange
            aria={Locale.Settings.FontSize.Title}
            title={`${config.fontSize ?? 14}px`}
            value={config.fontSize}
            min="12"
            max="40"
            step="1"
            onChange={(e) =>
              updateConfig(
                (config) =>
                  (config.fontSize = Number.parseInt(e.currentTarget.value)),
              )
            }
          ></InputRange>
        </ListItem>

        <ListItem
          title={Locale.Settings.FontFamily.Title}
          subTitle={Locale.Settings.FontFamily.SubTitle}
        >
          <input
            aria-label={Locale.Settings.FontFamily.Title}
            type="text"
            value={config.fontFamily}
            placeholder={Locale.Settings.FontFamily.Placeholder}
            onChange={(e) =>
              updateConfig(
                (config) => (config.fontFamily = e.currentTarget.value),
              )
            }
          ></input>
        </ListItem>

        <ListItem
          title={Locale.Settings.AutoGenerateTitle.Title}
          subTitle={Locale.Settings.AutoGenerateTitle.SubTitle}
        >
          <input
            aria-label={Locale.Settings.AutoGenerateTitle.Title}
            type="checkbox"
            checked={config.enableAutoGenerateTitle}
            onChange={(e) =>
              updateConfig(
                (config) =>
                  (config.enableAutoGenerateTitle = e.currentTarget.checked),
              )
            }
          ></input>
        </ListItem>

        <ListItem
          title={Locale.Settings.SendPreviewBubble.Title}
          subTitle={Locale.Settings.SendPreviewBubble.SubTitle}
        >
          <input
            aria-label={Locale.Settings.SendPreviewBubble.Title}
            type="checkbox"
            checked={config.sendPreviewBubble}
            onChange={(e) =>
              updateConfig(
                (config) =>
                  (config.sendPreviewBubble = e.currentTarget.checked),
              )
            }
          ></input>
        </ListItem>

        <ListItem
          title={Locale.Mask.Config.Artifacts.Title}
          subTitle={Locale.Mask.Config.Artifacts.SubTitle}
        >
          <input
            aria-label={Locale.Mask.Config.Artifacts.Title}
            type="checkbox"
            checked={config.enableArtifacts}
            onChange={(e) =>
              updateConfig(
                (config) => (config.enableArtifacts = e.currentTarget.checked),
              )
            }
          ></input>
        </ListItem>

        <ListItem
          title={Locale.Mask.Config.CodeFold.Title}
          subTitle={Locale.Mask.Config.CodeFold.SubTitle}
        >
          <input
            aria-label={Locale.Mask.Config.CodeFold.Title}
            type="checkbox"
            checked={config.enableCodeFold}
            data-testid="enable-code-fold-checkbox"
            onChange={(e) =>
              updateConfig(
                (config) => (config.enableCodeFold = e.currentTarget.checked),
              )
            }
          ></input>
        </ListItem>

        {/* 旧的通用访问码配置项已移除，仅保留模型服务配置页的访问码输入框 */}
      </List>
      <DangerItems />
    </>
  );

  // 云同步设置
  const renderSyncSettings = () => <SyncItems />;

  // 助手设置
  const renderMaskSettings = () => (
    <List>
      <ListItem
        title={Locale.Settings.Mask.ModelIcon.Title}
        subTitle={Locale.Settings.Mask.ModelIcon.SubTitle}
      >
        <input
          aria-label={Locale.Settings.Mask.ModelIcon.Title}
          type="checkbox"
          checked={config.useModelIconAsAvatar}
          onChange={(e) =>
            updateConfig(
              (config) =>
                (config.useModelIconAsAvatar = e.currentTarget.checked),
            )
          }
        ></input>
      </ListItem>
    </List>
  );

  // 提示词设置
  const renderPromptSettings = () => (
    <>
      <List>
        <ListItem
          title={Locale.Settings.Prompt.Disable.Title}
          subTitle={Locale.Settings.Prompt.Disable.SubTitle}
        >
          <input
            aria-label={Locale.Settings.Prompt.Disable.Title}
            type="checkbox"
            checked={config.disablePromptHint}
            onChange={(e) =>
              updateConfig(
                (config) =>
                  (config.disablePromptHint = e.currentTarget.checked),
              )
            }
          ></input>
        </ListItem>

        <ListItem
          title={Locale.Settings.Prompt.List}
          subTitle={Locale.Settings.Prompt.ListCount(builtinCount, customCount)}
        >
          <IconButton
            aria={Locale.Settings.Prompt.List + Locale.Settings.Prompt.Edit}
            icon={<EditIcon />}
            text={Locale.Settings.Prompt.Edit}
            onClick={() => setShowPromptModal(true)}
          />
        </ListItem>
      </List>
      {shouldShowPromptModal && (
        <UserPromptModal onClose={() => setShowPromptModal(false)} />
      )}
    </>
  );

  // 创建自定义服务商配置组件
  const createCustomProviderConfigComponent = (customProvider: any) => {
    const typeLabels = {
      openai: "OpenAI",
      google: "Google",
      anthropic: "Anthropic",
    };

    return (
      <>
        <ListItem
          title={Locale.Settings.Access.CustomProvider.Config.Type}
          subTitle={`${Locale.Settings.Access.CustomProvider.Config.BasedOn} ${
            typeLabels[customProvider.type as keyof typeof typeLabels]
          } API`}
        >
          <span>
            {typeLabels[customProvider.type as keyof typeof typeLabels]}
          </span>
        </ListItem>

        <ListItem
          title={Locale.Settings.Access.CustomProvider.Modal.ApiKey.Title}
          subTitle={
            Locale.Settings.Access.CustomProvider.Config.ApiKeyDescription
          }
        >
          <PasswordInput
            value={customProvider.apiKey}
            type="text"
            placeholder={
              Locale.Settings.Access.CustomProvider.Modal.ApiKey.Placeholder
            }
            onChange={(e) => {
              accessStore.updateCustomProvider(customProvider.id, {
                apiKey: e.currentTarget.value,
              });
            }}
          />
        </ListItem>

        {customProvider.endpoint && (
          <ListItem
            title={Locale.Settings.Access.CustomProvider.Modal.Endpoint.Title}
            subTitle={
              Locale.Settings.Access.CustomProvider.Config.EndpointDescription
            }
          >
            <input
              type="text"
              value={customProvider.endpoint}
              placeholder={
                Locale.Settings.Access.CustomProvider.Config.EndpointPlaceholder
              }
              onChange={(e) => {
                accessStore.updateCustomProvider(customProvider.id, {
                  endpoint: e.currentTarget.value,
                });
              }}
            />
          </ListItem>
        )}

        <ListItem
          title={Locale.Settings.Access.CustomProvider.Config.Delete.Title}
          subTitle={
            Locale.Settings.Access.CustomProvider.Config.Delete.SubTitle
          }
        >
          <IconButton
            icon={<ClearIcon />}
            text={Locale.Settings.Access.CustomProvider.Config.Delete.Button}
            type="danger"
            onClick={() => {
              if (
                confirm(
                  `${Locale.Settings.Access.CustomProvider.Config.Delete.Confirm} "${customProvider.name}" ${Locale.Settings.Access.CustomProvider.Config.Delete.ConfirmSuffix}`,
                )
              ) {
                accessStore.removeCustomProvider(customProvider.id);
              }
            }}
          />
        </ListItem>
      </>
    );
  };

  // 服务提供商配置（包含自定义服务商）
  const builtinProviderConfigs = [
    {
      provider: ServiceProvider.OpenAI,
      name: "OpenAI",
      description: Locale.Settings.Access.Provider.Description.OpenAI,
      configComponent: openAIConfigComponent,
      isCustom: false,
    },

    {
      provider: ServiceProvider.Google,
      name: "Google",
      description: Locale.Settings.Access.Provider.Description.Google,
      configComponent: googleConfigComponent,
      isCustom: false,
    },
    {
      provider: ServiceProvider.Anthropic,
      name: "Anthropic",
      description: Locale.Settings.Access.Provider.Description.Anthropic,
      configComponent: anthropicConfigComponent,
      isCustom: false,
    },
    {
      provider: ServiceProvider.ByteDance,
      name: Locale.Settings.Access.Provider.Name.ByteDance,
      description: Locale.Settings.Access.Provider.Description.ByteDance,
      configComponent: byteDanceConfigComponent,
      isCustom: false,
    },
    {
      provider: ServiceProvider.Alibaba,
      name: Locale.Settings.Access.Provider.Name.Alibaba,
      description: Locale.Settings.Access.Provider.Description.Alibaba,
      configComponent: alibabaConfigComponent,
      isCustom: false,
    },
    {
      provider: ServiceProvider.Moonshot,
      name: Locale.Settings.Access.Provider.Name.Moonshot,
      description: Locale.Settings.Access.Provider.Description.Moonshot,
      configComponent: moonshotConfigComponent,
      isCustom: false,
    },
    {
      provider: ServiceProvider.DeepSeek,
      name: "DeepSeek",
      description: Locale.Settings.Access.Provider.Description.DeepSeek,
      configComponent: deepseekConfigComponent,
      isCustom: false,
    },
    {
      provider: ServiceProvider.XAI,
      name: "xAI",
      description: Locale.Settings.Access.Provider.Description.XAI,
      configComponent: XAIConfigComponent,
      isCustom: false,
    },
    {
      provider: ServiceProvider.SiliconFlow,
      name: "SiliconFlow",
      description: Locale.Settings.Access.Provider.Description.SiliconFlow,
      configComponent: siliconflowConfigComponent,
      isCustom: false,
    },
  ];

  // 合并内置服务商和自定义服务商
  const customProviderConfigs = accessStore.customProviders.map(
    (customProvider) => ({
      provider: customProvider.id as any, // 使用自定义ID作为provider
      name: customProvider.name,
      description: `${
        Locale.Settings.Access.Provider.Description.Custom
      } ${customProvider.type.toUpperCase()} ${
        Locale.Settings.Access.Provider.Terms.Provider
      }`,
      configComponent: createCustomProviderConfigComponent(customProvider),
      isCustom: true,
    }),
  );

  const providerConfigs = [...builtinProviderConfigs, ...customProviderConfigs];

  // 模型服务设置
  const renderModelServiceSettings = () => (
    <>
      <List id={SlotID.CustomModel}>{accessCodeComponent}</List>

      {!accessStore.hideUserApiKey && (
        <div className={styles["provider-cards"]}>
          {providerConfigs.map((config) => {
            // 对于自定义服务商，使用不同的启用状态逻辑
            const isEnabled = config.isCustom
              ? accessStore.customProviders.find(
                  (p) => p.id === config.provider,
                )?.enabled || false
              : accessStore.enabledProviders?.[
                  config.provider as ServiceProvider
                ] || false;
            const isCollapsed = config.isCustom
              ? collapsedCustomProviders[config.provider as string] ?? true // 自定义服务商默认折叠
              : collapsedProviders[config.provider as ServiceProvider] || false;

            // 服务器环境变量是否对该服务商已配置
            const isServerConfigured = (() => {
              if (config.isCustom) return false;
              const sp = accessStore.serverProviders;
              switch (config.provider as ServiceProvider) {
                case ServiceProvider.OpenAI:
                  return !!sp.openai?.hasApiKey;
                case ServiceProvider.Google:
                  return !!sp.google?.hasApiKey;
                case ServiceProvider.Anthropic:
                  return !!sp.anthropic?.hasApiKey;

                case ServiceProvider.ByteDance:
                  return !!sp.bytedance?.hasApiKey;
                case ServiceProvider.Alibaba:
                  return !!sp.alibaba?.hasApiKey;
                case ServiceProvider.Moonshot:
                  return !!sp.moonshot?.hasApiKey;
                case ServiceProvider.DeepSeek:
                  return !!sp.deepseek?.hasApiKey;
                case ServiceProvider.XAI:
                  return !!sp.xai?.hasApiKey;
                case ServiceProvider.SiliconFlow:
                  return !!sp.siliconflow?.hasApiKey;
                default:
                  return false;
              }
            })();

            return (
              <div
                key={config.provider}
                className={`${styles["provider-card"]} ${
                  isEnabled ? styles["provider-card-active"] : ""
                }`}
              >
                <div
                  className={styles["provider-card-header"]}
                  onClick={() => {
                    if (isEnabled) {
                      if (config.isCustom) {
                        // 自定义服务商折叠逻辑
                        setCollapsedCustomProviders((prev) => ({
                          ...prev,
                          [config.provider as string]:
                            !prev[config.provider as string],
                        }));
                      } else {
                        // 内置服务商折叠逻辑
                        setCollapsedProviders((prev) => ({
                          ...prev,
                          [config.provider as ServiceProvider]:
                            !prev[config.provider as ServiceProvider],
                        }));
                      }
                    }
                  }}
                >
                  <div className={styles["provider-info"]}>
                    <span className={styles["provider-icon"]}>
                      <ProviderIcon
                        provider={config.provider}
                        size={24}
                        customProviderType={
                          config.isCustom
                            ? accessStore.customProviders.find(
                                (p) => p.id === config.provider,
                              )?.type
                            : undefined
                        }
                      />
                    </span>
                    <div>
                      <div className={styles["provider-name-container"]}>
                        <h3 className={styles["provider-name"]}>
                          {config.name}
                        </h3>
                        {isServerConfigured && (
                          <span
                            className={styles["provider-badge-server"]}
                            title={
                              "Server configured via environment variables"
                            }
                          >
                            SERVER
                          </span>
                        )}
                        {isEnabled && (
                          <span className={styles["provider-badge"]}>
                            {Locale.Settings.Access.Provider.Status.Enabled}
                          </span>
                        )}
                      </div>
                      <p className={styles["provider-description"]}>
                        {config.description}
                      </p>
                    </div>
                  </div>
                  <div className={styles["provider-controls"]}>
                    <div className={styles["provider-toggle"]}>
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={(e) => {
                          e.stopPropagation();
                          if (config.isCustom) {
                            // 自定义服务商的启用状态处理
                            accessStore.updateCustomProvider(config.provider, {
                              enabled: e.target.checked,
                            });
                          } else {
                            // 内置服务商的启用状态处理
                            accessStore.update((access) => {
                              if (!access.enabledProviders) {
                                access.enabledProviders = {
                                  [ServiceProvider.OpenAI]: false,
                                  [ServiceProvider.Google]: false,
                                  [ServiceProvider.Anthropic]: false,
                                  [ServiceProvider.ByteDance]: false,
                                  [ServiceProvider.Alibaba]: false,
                                  [ServiceProvider.Moonshot]: false,
                                  [ServiceProvider.XAI]: false,
                                  [ServiceProvider.DeepSeek]: false,
                                  [ServiceProvider.SiliconFlow]: false,
                                } as Record<ServiceProvider, boolean>;
                              }
                              access.enabledProviders[
                                config.provider as ServiceProvider
                              ] = e.target.checked;
                            });
                          }
                        }}
                        className={styles["provider-checkbox"]}
                      />
                    </div>
                    {isEnabled && (
                      <button
                        className={`${styles["collapse-button"]} ${
                          isCollapsed ? styles["collapsed"] : ""
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (config.isCustom) {
                            // 自定义服务商折叠逻辑
                            setCollapsedCustomProviders((prev) => ({
                              ...prev,
                              [config.provider as string]:
                                !prev[config.provider as string],
                            }));
                          } else {
                            // 内置服务商折叠逻辑
                            setCollapsedProviders((prev) => ({
                              ...prev,
                              [config.provider as ServiceProvider]:
                                !prev[config.provider as ServiceProvider],
                            }));
                          }
                        }}
                      >
                        <DownIcon />
                      </button>
                    )}
                  </div>
                </div>

                {isEnabled && (
                  <div
                    className={`${styles["provider-config"]} ${
                      isCollapsed ? styles["collapsed"] : styles["expanded"]
                    }`}
                  >
                    <List>
                      {config.configComponent}

                      {/* 启用模型列表 - 支持所有服务商 */}
                      <ListItem
                        title={Locale.Settings.Access.Provider.Models.Title}
                        subTitle={
                          Locale.Settings.Access.Provider.Models.SubTitle
                        }
                      >
                        <div className={styles["enabled-models"]}>
                          <div className={styles["model-list"]}>
                            {(
                              accessStore.enabledModels?.[config.provider] || []
                            ).length > 0 ? (
                              <div className={styles["model-tags"]}>
                                {(
                                  accessStore.enabledModels?.[
                                    config.provider
                                  ] || []
                                ).map((modelName: string) => (
                                  <span
                                    key={modelName}
                                    className={styles["model-tag"]}
                                  >
                                    <span
                                      className={styles["model-name"]}
                                      title={modelName}
                                    >
                                      <span
                                        className={styles["model-name-inner"]}
                                      >
                                        {modelName}
                                      </span>
                                    </span>
                                    <ModelCapabilityIcons
                                      capabilities={getModelCapabilitiesWithCustomConfig(
                                        modelName,
                                      )}
                                      size={12}
                                      colorful={false}
                                    />
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className={styles["no-models"]}>
                                {
                                  Locale.Settings.Access.Provider.Models
                                    .NoModels
                                }
                              </span>
                            )}
                          </div>
                          <button
                            className={styles["manage-button"]}
                            onClick={() => {
                              setCurrentProvider(config.provider);
                              setShowModelManager(true);
                            }}
                          >
                            {Locale.Settings.Access.Provider.Models.Manage}
                          </button>
                        </div>
                      </ListItem>
                    </List>
                  </div>
                )}
              </div>
            );
          })}

          {/* 添加自定义服务商按钮 */}
          <div className={styles["add-custom-provider"]}>
            <button
              className={styles["add-custom-provider-button"]}
              onClick={() => setShowAddCustomProvider(true)}
            >
              <span className={styles["add-icon"]}>+</span>
              <div className={styles["add-text"]}>
                <h3>{Locale.Settings.Access.CustomProvider.Add.Title}</h3>
                <p>{Locale.Settings.Access.CustomProvider.Add.Description}</p>
              </div>
            </button>
          </div>
        </div>
      )}
    </>
  );

  // 准备分组模型数据 - 基于启用的提供商和模型
  //const allModels = useAllModels();

  // 只显示已启用服务商的已启用模型
  /*  const availableModels = useMemo(() => {
    const enabledProviders = accessStore.enabledProviders || {};
    const enabledModels = accessStore.enabledModels || {};

    return allModels.filter((model) => {
      const providerId = model.provider?.id;
      const providerName = model.provider?.providerName;

      if (!providerId || !providerName) return false;

      // 检查是否是自定义服务商
      const isCustomProvider = providerId.startsWith("custom_");
      const customProvider = isCustomProvider
        ? accessStore.customProviders.find((p) => p.id === providerId)
        : null;

      // 对于内置服务商，检查是否启用
      // 对于自定义服务商，检查是否存在且启用
      const isProviderEnabled = isCustomProvider
        ? customProvider && customProvider.enabled
        : enabledProviders[providerName as ServiceProvider];

      if (!isProviderEnabled) return false;

      // 检查模型是否在启用列表中
      const providerEnabledModels =
        enabledModels[isCustomProvider ? providerId : providerName] || [];

      // 只有明确配置了可用模型的提供商才显示，且只显示已配置的模型
      return (
        providerEnabledModels.length > 0 &&
        providerEnabledModels.includes(model.name)
      );
    });
  }, [
    allModels,
    accessStore.enabledProviders,
    accessStore.enabledModels,
    accessStore.customProviders,
  ]);*/
  // 临时解决方案
  const availableModels = useEnabledModels();

  const groupModels = groupBy(availableModels, (model) => {
    const isCustomProvider = model.provider?.id?.startsWith("custom_");
    if (isCustomProvider) {
      const customProvider = accessStore.customProviders.find(
        (p) => p.id === model.provider?.id,
      );
      return customProvider?.name || model.provider?.providerName;
    }
    return model.provider?.providerName;
  });

  // 模型配置设置
  const renderModelConfigSettings = () => {
    // 构建当前选中模型的value，需要与option的value格式一致
    const currentModelValue = (() => {
      const currentModel = config.modelConfig.model;
      const currentProviderName = config.modelConfig.providerName;

      // 查找匹配的模型，确保value格式一致
      for (const providerGroup of Object.values(groupModels)) {
        for (const model of providerGroup) {
          if (model.name === currentModel) {
            const modelProviderId =
              model.provider?.id || model.provider?.providerName;
            const normalizedCurrentProvider = normalizeProviderName(
              currentProviderName as string,
            );
            const normalizedModelProvider = normalizeProviderName(
              modelProviderId as string,
            );

            if (normalizedCurrentProvider === normalizedModelProvider) {
              return `${model.name}@${modelProviderId}`;
            }
          }
        }
      }

      // 如果没找到匹配的，使用原始格式
      return `${currentModel}@${currentProviderName}`;
    })();

    return (
      <List>
        <ListItem title={Locale.Settings.Model}>
          <Select
            className={styles["select-default-model"]}
            aria-label={Locale.Settings.Model}
            value={currentModelValue}
            align="left"
            onChange={(e) => {
              const [model, providerName] = getModelProvider(
                e.currentTarget.value,
              );
              config.update((config) => {
                config.modelConfig.model = model as any;
                // 保留原始 provider 标识（支持 custom_ 前缀），避免丢失自定义服务商
                config.modelConfig.providerName = providerName! as any;
                // 根据新模型自动更新压缩阈值
                const autoThreshold = getModelCompressThreshold(model);
                config.modelConfig.compressMessageLengthThreshold =
                  autoThreshold;
              });
            }}
          >
            {Object.keys(groupModels).map((providerName, index) => (
              <optgroup label={providerName} key={index}>
                {groupModels[providerName].map((v, i) => (
                  <option
                    value={`${v.name}@${
                      v.provider?.id || v.provider?.providerName
                    }`}
                    key={i}
                  >
                    {v.displayName}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </ListItem>
        <ModelConfigList
          modelConfig={config.modelConfig}
          updateConfig={(updater) => {
            const modelConfig = { ...config.modelConfig };
            updater(modelConfig);
            config.update((config) => (config.modelConfig = modelConfig));
          }}
          showModelSelector={false}
          enableMultiModel={config.enableMultiModel}
          onToggleMultiModel={(enabled) => {
            config.update((config) => {
              config.enableMultiModel = enabled;
            });
          }}
        />
      </List>
    );
  };

  // 语音设置
  const renderVoiceSettings = () => (
    <>
      <List>
        <RealtimeConfigList
          realtimeConfig={config.realtimeConfig}
          updateConfig={(updater) => {
            const realtimeConfig = { ...config.realtimeConfig };
            updater(realtimeConfig);
            config.update((config) => (config.realtimeConfig = realtimeConfig));
          }}
        />
      </List>
      <List>
        <TTSConfigList
          ttsConfig={config.ttsConfig}
          updateConfig={(updater) => {
            const ttsConfig = { ...config.ttsConfig };
            updater(ttsConfig);
            config.update((config) => (config.ttsConfig = ttsConfig));
          }}
        />
      </List>
    </>
  );

  return (
    <ErrorBoundary>
      <div className="window-header" data-tauri-drag-region>
        <div className="window-header-title">
          <div className="window-header-main-title">
            {Locale.Settings.Title}
          </div>
          <div className="window-header-sub-title">
            {Locale.Settings.SubTitle}
          </div>
        </div>
        <div className="window-actions">
          <div className="window-action-button"></div>
          <div className="window-action-button"></div>
          <div className="window-action-button">
            <IconButton
              aria={Locale.UI.Close}
              icon={<CloseIcon />}
              onClick={() => navigate(Path.Home)}
              bordered
            />
          </div>
        </div>
      </div>
      <div className={styles["settings"]}>
        {/* 分页导航 */}
        <div className={styles["settings-tabs"]}>
          {tabConfig.map((tab) => (
            <button
              key={tab.key}
              className={`${styles["settings-tab"]} ${
                currentTab === tab.key ? styles["settings-tab-active"] : ""
              }`}
              onClick={() => setCurrentTab(tab.key)}
            >
              <span className={styles["tab-icon"]}>{tab.icon}</span>
              <span className={styles["tab-label"]}>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* 分页内容 */}
        <div className={styles["settings-content"]}>{renderTabContent()}</div>
      </div>

      {/* 模型管理器 */}
      {showModelManager && currentProvider && (
        <ModelManager
          provider={currentProvider}
          onClose={() => {
            setShowModelManager(false);
            setCurrentProvider(null);
          }}
        />
      )}

      {/* 自定义服务商添加弹窗 */}
      {showAddCustomProvider && (
        <AddCustomProviderModal
          onClose={() => setShowAddCustomProvider(false)}
          onAdd={(provider) => {
            accessStore.addCustomProvider(provider);
            setShowAddCustomProvider(false);
          }}
        />
      )}
    </ErrorBoundary>
  );
}
