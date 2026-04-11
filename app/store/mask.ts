import { getLang, Lang } from "../locales";
import { DEFAULT_TOPIC, ChatMessage } from "./chat";
import { ModelConfig, useAppConfig } from "./config";
import { StoreKey } from "../constant";
import { nanoid } from "nanoid";
import { createPersistStore } from "../utils/store";
import { getModelCompressThreshold } from "../config/model-context-tokens";

export type Mask = {
  id: string;
  createdAt: number;
  avatar: string;
  name: string;
  hideContext?: boolean;
  context: ChatMessage[];
  syncGlobalConfig?: boolean;
  modelConfig: ModelConfig;
  defaultModel?: string; // 添加默认模型配置
  lang: Lang;
  builtin: boolean;

  enableArtifacts?: boolean;
  enableCodeFold?: boolean;
};

export const DEFAULT_MASK_STATE = {
  masks: {} as Record<string, Mask>,
  language: undefined as Lang | undefined,
};

export type MaskState = typeof DEFAULT_MASK_STATE & {
  language?: Lang | undefined;
};

export const DEFAULT_MASK_AVATAR = "gpt-bot";
export const DEFAULT_MASK_ID = "default-mask";

export const createDefaultMask = () => {
  const globalConfig = useAppConfig.getState().modelConfig;

  const defaultMask = {
    id: DEFAULT_MASK_ID,
    avatar: DEFAULT_MASK_AVATAR,
    name: "默认助手",
    context: [],
    syncGlobalConfig: false, // 修改为 false，让默认助手也保持自己的配置
    modelConfig: {
      ...globalConfig,
      compressMessageLengthThreshold: getModelCompressThreshold(
        globalConfig.model,
      ),
    },
    defaultModel: undefined, // 初始化默认模型为 undefined

    lang: getLang(),
    builtin: true, // 标记为内置，不可删除
    createdAt: Date.now(),
  } as Mask;

  return defaultMask;
};

export const createEmptyMask = () => {
  const globalConfig = useAppConfig.getState().modelConfig;
  return {
    id: nanoid(),
    avatar: DEFAULT_MASK_AVATAR,
    name: DEFAULT_TOPIC,
    context: [],
    syncGlobalConfig: true, // use global config as default
    modelConfig: {
      ...globalConfig,
      compressMessageLengthThreshold: getModelCompressThreshold(
        globalConfig.model,
      ),
    },
    defaultModel: undefined, // 初始化默认模型为 undefined

    lang: getLang(),
    builtin: false,
    createdAt: Date.now(),
    plugin: [],
  } as Mask;
};

export const useMaskStore = createPersistStore(
  { ...DEFAULT_MASK_STATE },

  (set, get) => ({
    create(mask?: Partial<Mask>) {
      const masks = get().masks;
      const id = nanoid();
      masks[id] = {
        ...createEmptyMask(),
        ...mask,
        id,
        builtin: false,
      };

      set(() => ({ masks }));
      get().markUpdate();

      return masks[id];
    },
    updateMask(id: string, updater: (mask: Mask) => void) {
      const masks = get().masks;
      const mask = masks[id];
      if (!mask) return;
      const updateMask = { ...mask };
      updater(updateMask);
      masks[id] = updateMask;
      set(() => ({ masks }));
      get().markUpdate();
    },
    delete(id: string) {
      // 防止删除默认助手
      if (id === DEFAULT_MASK_ID) {
        return;
      }
      const masks = get().masks;
      delete masks[id];
      set(() => ({ masks }));
      get().markUpdate();
    },

    get(id?: string) {
      return get().masks[id ?? 1145141919810];
    },
    getAll() {
      // 确保默认助手存在
      const masks = get().masks;
      if (!masks[DEFAULT_MASK_ID]) {
        const defaultMask = createDefaultMask();
        masks[DEFAULT_MASK_ID] = defaultMask;
        set(() => ({ masks }));
      }

      const userMasks = Object.values(masks).sort(
        (a, b) => b.createdAt - a.createdAt,
      );

      return userMasks;
    },
    search(text: string) {
      return Object.values(get().masks);
    },
    setLanguage(language: Lang | undefined) {
      set({
        language,
      });
    },
  }),
  {
    name: StoreKey.Mask,
    version: 3.3,

    migrate(state, version) {
      const newState = JSON.parse(JSON.stringify(state)) as MaskState;

      // migrate mask id to nanoid
      if (version < 3) {
        Object.values(newState.masks).forEach((m) => (m.id = nanoid()));
      }

      if (version < 3.1) {
        const updatedMasks: Record<string, Mask> = {};
        Object.values(newState.masks).forEach((m) => {
          updatedMasks[m.id] = m;
        });
        newState.masks = updatedMasks;
      }

      // 修复默认助手的同步配置
      if (version < 3.2) {
        Object.values(newState.masks).forEach((m) => {
          // 修复默认助手的同步配置
          if (m.id === DEFAULT_MASK_ID && m.syncGlobalConfig === true) {
            m.syncGlobalConfig = false;
          }
        });
      }

      // 统一默认助手头像为默认占位符，交给UI渲染为OpenAI图标
      Object.values(newState.masks).forEach((m) => {
        if (
          m.id === DEFAULT_MASK_ID &&
          (m.avatar === "1f40b" || !m.avatar || m.avatar === "gpt-bot")
        ) {
          m.avatar = DEFAULT_MASK_AVATAR;
        }
      });

      // 确保默认助手存在
      if (!newState.masks[DEFAULT_MASK_ID]) {
        newState.masks[DEFAULT_MASK_ID] = createDefaultMask();
      }

      return newState as any;
    },
  },
);
