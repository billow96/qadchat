"use client";

require("../polyfill");

import { useEffect, useState } from "react";
import styles from "./home.module.scss";

import BotIcon from "../icons/bot.svg";
import LoadingIcon from "../icons/three-dots.svg";

import { getCSSVar, useMobileScreen } from "../utils";

import dynamic from "next/dynamic";
import { Path, SlotID } from "../constant";
import { ErrorBoundary } from "./error";

import { getISOLang } from "../locales";

import {
  HashRouter as Router,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { SideBar, useDragSideBar } from "./sidebar";
import { useAppConfig } from "../store/config";
import { getClientConfig } from "../config/client";
import {
  type ClientApi,
  getClientApi,
  normalizeProviderName,
} from "../client/api";
import { useAccessStore } from "../store";
import clsx from "clsx";
import { initializeMcpSystem } from "../mcp/actions";
import { ServiceProvider } from "../constant";
import { useEnabledModels } from "../utils/hooks";
import Locale from "../locales";
import { IconButton } from "./button";
import ChatGptIcon from "../icons/chatgpt.svg";

function providerKeyOf(model: {
  provider?: { id?: string; providerName?: string };
}) {
  return model.provider?.id || model.provider?.providerName || "";
}

function isModelMatched(
  model: { name: string; provider?: { id?: string; providerName?: string } },
  targetModel: string,
  targetProvider?: string,
) {
  if (model.name !== targetModel) return false;
  if (!targetProvider) return true;

  const providerKey = providerKeyOf(model);
  if (providerKey === targetProvider) return true;

  return (
    normalizeProviderName(providerKey) === normalizeProviderName(targetProvider)
  );
}

function pickAutoCompressModel(
  models: Array<{
    name: string;
    provider?: { id?: string; providerName?: string };
    isDefault?: boolean;
  }>,
  selectedChatModel?: {
    name: string;
    provider?: { id?: string; providerName?: string };
  },
) {
  if (models.length === 0) return null;

  const preferred =
    models.find(
      (model) =>
        model.name !== selectedChatModel?.name ||
        providerKeyOf(model) !== providerKeyOf(selectedChatModel || {}),
    ) ||
    selectedChatModel ||
    models.find((model) => model.isDefault) ||
    models[0];

  return preferred || null;
}

function syncResolvedModelsToConfig(
  configStore: ReturnType<typeof useAppConfig.getState>,
  models: Array<{
    name: string;
    provider?: { id?: string; providerName?: string };
    isDefault?: boolean;
  }>,
) {
  if (models.length === 0) return;

  const currentConfig = configStore.modelConfig;
  const preferredChatModel =
    models.find((model) => model.isDefault) || models[0];
  const currentChatModelExists = models.some((model) =>
    isModelMatched(
      model,
      currentConfig.model,
      currentConfig.providerName as string | undefined,
    ),
  );

  const shouldReplaceChatModel =
    !currentConfig.model ||
    !currentChatModelExists ||
    (currentConfig.model === "gpt-4o-mini" && models.length > 0);

  const resolvedChatModel = shouldReplaceChatModel
    ? preferredChatModel
    : models.find((model) =>
        isModelMatched(
          model,
          currentConfig.model,
          currentConfig.providerName as string | undefined,
        ),
      ) || preferredChatModel;

  const currentCompressExists =
    !!currentConfig.compressModel &&
    models.some((model) =>
      isModelMatched(
        model,
        currentConfig.compressModel,
        currentConfig.compressProviderName as string | undefined,
      ),
    );

  const shouldReplaceCompressModel =
    !currentConfig.compressModel ||
    !currentCompressExists ||
    currentConfig.compressModel === "gpt-4o-mini";

  const resolvedCompressModel = shouldReplaceCompressModel
    ? pickAutoCompressModel(models, resolvedChatModel)
    : models.find((model) =>
        isModelMatched(
          model,
          currentConfig.compressModel,
          currentConfig.compressProviderName as string | undefined,
        ),
      ) || pickAutoCompressModel(models, resolvedChatModel);

  const nextChatModel = resolvedChatModel?.name || "";
  const nextChatProvider = (providerKeyOf(resolvedChatModel || {}) ||
    resolvedChatModel?.provider?.providerName ||
    ServiceProvider.OpenAI) as string;
  const nextCompressModel = resolvedCompressModel?.name || "";
  const nextCompressProvider =
    providerKeyOf(resolvedCompressModel || {}) ||
    resolvedCompressModel?.provider?.providerName ||
    "";

  const chatModelChanged =
    nextChatModel !== currentConfig.model ||
    nextChatProvider !== String(currentConfig.providerName || "");
  const compressModelChanged =
    nextCompressModel !== String(currentConfig.compressModel || "") ||
    nextCompressProvider !== String(currentConfig.compressProviderName || "");

  if (!chatModelChanged && !compressModelChanged) {
    return;
  }

  configStore.update((config) => {
    if (chatModelChanged && resolvedChatModel) {
      config.modelConfig.model = nextChatModel as any;
      config.modelConfig.providerName = nextChatProvider as any;
    }

    if (compressModelChanged && resolvedCompressModel) {
      config.modelConfig.compressModel = nextCompressModel;
      config.modelConfig.compressProviderName = nextCompressProvider;
    }
  });
}

export function Loading(props: { noLogo?: boolean }) {
  return (
    <div className={clsx("no-dark", styles["loading-content"])}>
      {!props.noLogo && <BotIcon />}
      <LoadingIcon />
    </div>
  );
}

const Artifacts = dynamic(async () => (await import("./artifacts")).Artifacts, {
  loading: () => <Loading noLogo />,
});

const Settings = dynamic(async () => (await import("./settings")).Settings, {
  loading: () => <Loading noLogo />,
});

const Chat = dynamic(async () => (await import("./chat")).Chat, {
  loading: () => <Loading noLogo />,
  ssr: false,
});

const NewChat = dynamic(async () => (await import("./new-chat")).NewChat, {
  loading: () => <Loading noLogo />,
});

const MaskPage = dynamic(async () => (await import("./mask")).MaskPage, {
  loading: () => <Loading noLogo />,
});

const SearchChat = dynamic(
  async () => (await import("./search-chat")).SearchChatPage,
  {
    loading: () => <Loading noLogo />,
  },
);

export function useSwitchTheme() {
  const config = useAppConfig();

  useEffect(() => {
    document.body.classList.remove("light");
    document.body.classList.remove("dark");

    if (config.theme === "dark") {
      document.body.classList.add("dark");
    } else if (config.theme === "light") {
      document.body.classList.add("light");
    }

    const metaDescriptionDark = document.querySelector(
      'meta[name="theme-color"][media*="dark"]',
    );
    const metaDescriptionLight = document.querySelector(
      'meta[name="theme-color"][media*="light"]',
    );

    if (config.theme === "auto") {
      metaDescriptionDark?.setAttribute("content", "#151515");
      metaDescriptionLight?.setAttribute("content", "#fafafa");
    } else {
      const themeColor = getCSSVar("--theme-color");
      metaDescriptionDark?.setAttribute("content", themeColor);
      metaDescriptionLight?.setAttribute("content", themeColor);
    }
  }, [config.theme]);
}

function useHtmlLang() {
  useEffect(() => {
    const lang = getISOLang();
    const htmlLang = document.documentElement.lang;

    if (lang !== htmlLang) {
      document.documentElement.lang = lang;
    }
  }, []);
}

const useHasHydrated = () => {
  const [hasHydrated, setHasHydrated] = useState<boolean>(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  return hasHydrated;
};

const loadAsyncGoogleFont = () => {
  const linkEl = document.createElement("link");
  const proxyFontUrl = "/google-fonts";
  const remoteFontUrl = "https://fonts.googleapis.com";
  const googleFontUrl =
    getClientConfig()?.buildMode === "export" ? remoteFontUrl : proxyFontUrl;
  linkEl.rel = "stylesheet";
  linkEl.href =
    googleFontUrl +
    "/css2?family=" +
    encodeURIComponent("Noto Sans:wght@300;400;700;900") +
    "&display=swap";
  document.head.appendChild(linkEl);
};

export function WindowContent(props: { children: React.ReactNode }) {
  return (
    <div className={styles["window-content"]} id={SlotID.AppBody}>
      {props?.children}
    </div>
  );
}

function AccessGate(props: {
  accessCode: string;
  authError: string;
  submittingAccess: boolean;
  onChangeAccessCode: (value: string) => void;
  onSubmit: () => void;
}) {
  const {
    accessCode,
    authError,
    submittingAccess,
    onChangeAccessCode,
    onSubmit,
  } = props;

  return (
    <div className={styles["access-gate"]}>
      <div className={styles["access-gate-shell"]}>
        <section className={styles["access-gate-brand"]}>
          <div className={styles["access-gate-brand-bg"]} />
          <div className={styles["access-gate-brand-header"]}>
            <div className={styles["access-gate-brand-logo"]}>
              <ChatGptIcon />
            </div>
            <div>
              <div className={styles["access-gate-brand-title"]}>
                {Locale.Auth.Brand}
              </div>
              <div className={styles["access-gate-brand-subtitle"]}>
                {Locale.Auth.BrandSubTitle}
              </div>
            </div>
          </div>
          <div className={styles["access-gate-brand-badge"]}>
            {Locale.Auth.SecurityBadge}
          </div>
          <h1 className={styles["access-gate-brand-heading"]}>
            {Locale.Auth.SecurityTitle}
          </h1>
          <p className={styles["access-gate-brand-description"]}>
            {Locale.Auth.Description}
          </p>
          <div className={styles["access-gate-brand-divider"]} />
          <div className={styles["access-gate-feature-title"]}>
            {Locale.Auth.HintTitle}
          </div>
          <ul className={styles["access-gate-feature-list"]}>
            <li>{Locale.Auth.HintFeatureChats}</li>
            <li>{Locale.Auth.HintFeatureProviders}</li>
            <li>{Locale.Auth.HintFeatureSecurity}</li>
          </ul>
        </section>

        <section className={styles["access-gate-panel"]}>
          <div className={styles["access-gate-panel-card"]}>
            <div className={styles["access-gate-panel-head"]}>
              <div className={styles["access-gate-panel-kicker"]}>
                {Locale.Auth.SecurityBadge}
              </div>
              <h2 className={styles["access-gate-panel-title"]}>
                {Locale.Auth.Title}
              </h2>
              <p className={styles["access-gate-panel-text"]}>
                {Locale.Auth.Tips}
              </p>
            </div>

            <div className={styles["access-gate-form"]}>
              <label
                className={styles["access-gate-label"]}
                htmlFor="access-code-input"
              >
                {Locale.Auth.Input}
              </label>
              <input
                id="access-code-input"
                aria-label={Locale.Auth.Input}
                className={styles["access-gate-input"]}
                type="password"
                placeholder={Locale.Auth.Input}
                value={accessCode}
                onChange={(e) => onChangeAccessCode(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !submittingAccess) {
                    e.preventDefault();
                    onSubmit();
                  }
                }}
              />

              <div className={styles["access-gate-actions"]}>
                <IconButton
                  type="primary"
                  shadow
                  text={
                    submittingAccess
                      ? Locale.Auth.Verifying
                      : Locale.Auth.Confirm
                  }
                  onClick={onSubmit}
                  disabled={submittingAccess || !accessCode.trim()}
                  className={styles["access-gate-submit"]}
                  aria={Locale.Auth.Confirm}
                />
              </div>

              <div
                className={clsx(styles["access-gate-feedback"], {
                  [styles["access-gate-feedback-error"]]: !!authError,
                })}
                aria-live="polite"
              >
                {authError || Locale.Auth.SubTips}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Screen() {
  const config = useAppConfig();
  const accessStore = useAccessStore();
  const location = useLocation();
  const isArtifact = location.pathname.includes(Path.Artifacts);
  const isHome = location.pathname === Path.Home;
  const isSettings = location.pathname === Path.Settings;

  const isMobileScreen = useMobileScreen();
  const shouldTightBorder =
    getClientConfig()?.isApp || (config.tightBorder && !isMobileScreen);
  const { isCollapsed } = useDragSideBar();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [submittingAccess, setSubmittingAccess] = useState(false);
  const [authError, setAuthError] = useState("");

  const submitAccessCode = async () => {
    if (submittingAccess || !accessStore.accessCode.trim()) {
      return;
    }

    setSubmittingAccess(true);
    setAuthError("");

    try {
      const ok = await accessStore.verifyServerAccessCode(
        accessStore.accessCode,
      );

      if (ok) {
        await accessStore.fetchServerConfig(accessStore.accessCode);
      } else {
        setAuthError(Locale.Auth.Invalid);
      }
    } finally {
      setSubmittingAccess(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const store = useAccessStore.getState();

    const run = async () => {
      try {
        await store.fetchServerConfig(store.accessCode);
      } finally {
        if (!cancelled) {
          setCheckingAccess(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    loadAsyncGoogleFont();
  }, []);

  if (isArtifact) {
    return (
      <Routes>
        <Route path="/artifacts/:id" element={<Artifacts />} />
      </Routes>
    );
  }

  const requiresAuth = accessStore.enabledAccessControl();
  const isAuthorized = accessStore.isAuthorized();

  if (checkingAccess) {
    return <Loading />;
  }

  if (requiresAuth && !isAuthorized) {
    return (
      <AccessGate
        accessCode={accessStore.accessCode}
        authError={authError}
        submittingAccess={submittingAccess}
        onChangeAccessCode={(value) => {
          setAuthError("");
          accessStore.updateAccessCode(value);
        }}
        onSubmit={() => {
          void submitAccessCode();
        }}
      />
    );
  }

  const renderContent = () => {
    return (
      <>
        <SideBar
          className={clsx({
            [styles["sidebar-show"]]: isHome,
          })}
        />
        <WindowContent>
          <Routes>
            <Route path={Path.Home} element={<Chat />} />
            <Route path={Path.NewChat} element={<NewChat />} />
            <Route path={Path.Masks} element={<MaskPage />} />

            <Route path={Path.SearchChat} element={<SearchChat />} />
            <Route path={Path.Chat} element={<Chat />} />
            <Route path={Path.Settings} element={<Settings />} />
            {/* 将旧的 /auth 路由指向设置页，避免无效跳转 */}
            <Route path={Path.Auth} element={<Settings />} />
            <Route path={Path.McpMarket} element={<Settings />} />
          </Routes>
        </WindowContent>
      </>
    );
  };

  return (
    <div
      className={clsx(styles.container, {
        [styles["tight-container"]]: shouldTightBorder,
        [styles["sidebar-collapsed"]]: isCollapsed,
        // 暂时移除 RTL 支持，因为已注释掉阿拉伯语
        // [styles["rtl-screen"]]: getLang() === "ar",
      })}
    >
      {renderContent()}
    </div>
  );
}

export function useLoadData(enabled: boolean) {
  const config = useAppConfig();
  const enabledModels = useEnabledModels();

  useEffect(() => {
    if (!enabled) return;
    (async () => {
      try {
        const api: ClientApi = getClientApi(config.modelConfig.providerName);
        const models = await api.llm.models();
        config.mergeModels(models);
        syncResolvedModelsToConfig(useAppConfig.getState(), models);
      } catch (e) {
        console.error("[Config] failed to fetch models", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    if (enabledModels.length === 0) return;
    syncResolvedModelsToConfig(useAppConfig.getState(), enabledModels);
  }, [enabledModels]);
}

export function Home() {
  useSwitchTheme();
  useHtmlLang();
  const accessStore = useAccessStore();
  const configReady = accessStore.configLoaded;
  const canLoadProtectedData =
    configReady &&
    (!accessStore.enabledAccessControl() || accessStore.isAuthorized());

  useLoadData(canLoadProtectedData);

  useEffect(() => {
    accessStore.fetch();

    const initMcp = async () => {
      try {
        if (canLoadProtectedData) {
          await initializeMcpSystem();
        }
      } catch (err) {
        // MCP 初始化失败，静默处理
      }
    };
    void initMcp();
  }, [accessStore, canLoadProtectedData]);

  if (!useHasHydrated() || !configReady) {
    return <Loading />;
  }

  return (
    <ErrorBoundary>
      <Router>
        <Screen />
      </Router>
    </ErrorBoundary>
  );
}
