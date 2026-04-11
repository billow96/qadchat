import { getClientConfig } from "../config/client";
import { SubmitKey } from "../store/config";
import { SAAS_CHAT_UTM_URL } from "@/app/constant";
const isApp = !!getClientConfig()?.isApp;

const tw = {
  WIP: "此功能仍在開發中……",
  Error: {
    Unauthorized: isApp
      ? `😆 對話遇到了一些問題，不用慌:
    \\ 1️⃣ 查看項目文檔，[點選這裡訪問 GitHub 🚀](${SAAS_CHAT_UTM_URL})
    \\ 2️⃣ 如果你想消耗自己的 OpenAI 資源，點選[這裡](/#/settings)修改設定 ⚙️`
      : `😆 對話遇到了一些問題，不用慌:
    \ 1️⃣ 查看項目文檔，[點選這裡訪問 GitHub 🚀](${SAAS_CHAT_UTM_URL})
    \ 2️⃣ 如果你正在使用私有部署版本，點選[這裡](/#/auth)輸入存取金鑰 🔑
    \ 3️⃣ 如果你想消耗自己的 OpenAI 資源，點選[這裡](/#/settings)修改設定 ⚙️
 `,
  },

  Auth: {
    Title: "需要密碼",
    Tips: "管理員開啟了密碼驗證，請在下方填入存取密碼",
    SubTips: "或者輸入你的 OpenAI 或 Google API 金鑰",
    Input: "在此處填寫存取密碼",
    Confirm: "確認",
    Later: "稍候再說",
    Return: "返回",
    SaasTips: "設定太麻煩，想要立即使用",
    TopTips:
      "🥳 NextChat AI 首發優惠，立刻解鎖 OpenAI o1, GPT-4o, Claude-3.5 等最新的大型語言模型",
  },
  ChatItem: {
    ChatItemCount: (count: number) => `${count} 則對話`,
  },
  Chat: {
    MultiModel: {
      Title: "多模型對話設置",
      Enabled: "多模型 (已啟用)",
      Disabled: "多模型 (已關閉)",
      Count: (count: number) => `${count}個模型`,
      Description:
        "🎯 多模型對話競技場模式已啟用！點擊模型選擇器可選擇多個模型進行對話。",
      OpenSelector: "開啟模型選擇器",
      AlreadySelected: (count: number) => `(${count} 個已選擇)`,
      Tips: "💡 提示：在多模型模式下，您可以同時選擇多個模型，每個模型都會獨立回覆您的訊息，方便對比不同模型的回答效果。",
      EnableToast:
        "🎯 多模型模式已啟用！點擊模型選擇器可選擇多個模型進行對話競技場",
      DisableToast: "多模型模式已關閉",
      MinimumModelsError: "請至少選擇2個模型才能啟用多模型對話",
      ModelsSelectedToast: (count: number) => `已選擇 ${count} 個模型進行對話`,
    },
    UI: {
      SidebarToggle: "折疊/展開側邊欄",
      SearchModels: "搜尋模型...",
      SelectModel: "選擇模型",
      ContextTooltip: {
        Current: (current: number, max: number) =>
          `目前上下文: ${current} / ${max}`,
        CurrentTokens: (current: number, max: number) =>
          `目前Token: ${current.toLocaleString()} / ${max.toLocaleString()}`,
        CurrentTokensUnknown: (current: number) =>
          `目前Token: ${current.toLocaleString()} / 未知`,
        EstimatedTokens: (estimated: number) =>
          `預估Token: ${estimated.toLocaleString()}`,
        ContextTokens: (tokens: string) => `上下文: ${tokens} tokens`,
      },
    },
    SubTitle: (count: number) => `您已經與 ChatGPT 進行了 ${count} 則對話`,
    EditMessage: {
      Title: "編輯訊息記錄",
      Topic: {
        Title: "聊天主題",
        SubTitle: "更改目前聊天主題",
      },
    },
    Actions: {
      ChatList: "檢視訊息列表",
      CompressedHistory: "檢視壓縮後的歷史 Prompt",
      Export: "匯出聊天紀錄",
      Copy: "複製",
      Stop: "停止",
      Retry: "重試",
      Pin: "固定",
      PinToastContent: "已將 1 條對話固定至預設提示詞",
      PinToastAction: "檢視",
      Delete: "刪除",
      Edit: "編輯",
      FullScreen: "全螢幕",
      RefreshTitle: "重新整理標題",
      RefreshToast: "已傳送重新整理標題請求",
      Speech: "朗讀",
      StopSpeech: "停止",
      PreviousVersion: "上一版本",
      NextVersion: "下一版本",
    },
    Commands: {
      new: "新建聊天",
      newm: "從角色助手新建聊天",
      next: "下一個聊天",
      prev: "上一個聊天",
      clear: "清除上下文",
      fork: "複製聊天",
      del: "刪除聊天",
    },
    InputActions: {
      Stop: "停止回應",
      ToBottom: "移至最新",
      Theme: {
        auto: "自動主題",
        light: "亮色模式",
        dark: "深色模式",
      },
      Prompt: "快捷指令",
      Masks: "所有角色助手",
      Clear: "清除聊天",
      Settings: "對話設定",
      UploadImage: "上傳圖片",
      Search: "搜尋功能",
      SearchOn: "搜尋已啟用",
      SearchOff: "搜尋已停用",
      SearchEnabledToast: "🔍 搜尋功能已啟用！現在可以進行網路搜尋了",
      SearchDisabledToast: "❌ 搜尋功能已停用",
    },
    MCP: {
      Title: "MCP 工具控制",
      Enable: "啟用 MCP 功能",
      EnableDesc:
        "開啟後可使用 MCP 工具，關閉後不會向模型注入任何 MCP 原生工具",
      NoTools: "暫無可用的 MCP 工具",
      Loading: "載入中...",
      ClientFailed: "MCP 客戶端載入失敗，靜默處理",
      ToolsCount: (count: number) => `${count} 個工具`,
      Running: "執行中",
      Done: "已完成",
      Failed: "執行失敗",
      Arguments: "Arguments",
      Response: "Response",
      EmptyArguments: "無參數",
    },
    Rename: "重新命名對話",
    Typing: "正在輸入…",
    Input: (submitKey: string) => {
      var inputHints = `輸入訊息後，按下 ${submitKey} 鍵即可傳送`;
      if (submitKey === String(SubmitKey.Enter)) {
        inputHints += "，Shift + Enter 鍵換行";
      }
      return inputHints;
    },
    Send: "傳送",

    TokenUsage: "使用率",
    TokenTooltip: {
      Context: "目前上下文",
      CurrentToken: "目前Token",
      EstimatedToken: "預估Token",
      Unknown: "未知",
    },
    Config: {
      Reset: "重設",
      SaveAs: "另存新檔",
    },
    IsContext: "預設提示詞",
    ShortcutKey: {
      Title: "鍵盤快捷方式",
      newChat: "開啟新聊天",
      focusInput: "聚焦輸入框",
      copyLastMessage: "複製最後一個回覆",
      copyLastCode: "複製最後一個程式碼區塊",
      showShortcutKey: "顯示快捷方式",
      clearContext: "清除上下文",
    },
    Thinking: {
      Title: "思考深度",
      Dynamic: "動態思考",
      DynamicDesc: "模型自動決定思考深度",
      Off: "關閉思考",
      OffDesc: "不進行思考過程",
      Light: "輕度思考",
      LightDesc: "1024 tokens",
      Medium: "中度思考",
      MediumDesc: "4096 tokens",
      Deep: "深度思考",
      DeepDesc: "8192 tokens",
      VeryDeep: "極深思考",
      VeryDeepDesc: "16384 tokens",
      Notice: "僅支援 thinkingBudget 的模型可調節思維深度",
      ClaudeNotice: "僅支援 Claude 系列模型可調節思維深度",
      GeminiNotice: "僅支援 Gemini 系列模型可調節思維深度",
      ClaudeLight: "輕度思考",
      ClaudeLightDesc: "5000 tokens",
      ClaudeMedium: "中度思考",
      ClaudeMediumDesc: "10000 tokens",
      ClaudeDeep: "深度思考",
      ClaudeDeepDesc: "20000 tokens",
      ClaudeVeryDeep: "極深思考",
      ClaudeVeryDeepDesc: "32000 tokens",
      ClaudeDynamicDesc: "自動調節思考深度（默認10000 tokens）",
    },
  },
  Export: {
    Title: "將聊天記錄匯出為 Markdown",
    Copy: "複製全部",
    Download: "下載檔案",
    Share: "分享到 ShareGPT",
    MessageFromYou: "來自您的訊息",
    MessageFromChatGPT: "來自 ChatGPT 的訊息",
    Format: {
      Title: "匯出格式",
      SubTitle: "可以匯出 Markdown 文字檔或者 PNG 圖片",
    },
    IncludeContext: {
      Title: "包含角色範本上下文",
      SubTitle: "是否在訊息中顯示角色範本上下文",
    },
    Steps: {
      Select: "選取",
      Preview: "預覽",
    },
    Image: {
      Toast: "正在產生截圖",
      Modal: "長按或按右鍵儲存圖片",
    },
    Artifacts: {
      Title: "分享頁面",
      Error: "分享失敗",
    },
  },
  Select: {
    Search: "查詢訊息",
    All: "選取全部",
    Latest: "最近幾條",
    Clear: "清除選取",
  },
  Memory: {
    Title: "上下文記憶 Prompt",
    EmptyContent: "尚未記憶",
    Copy: "複製全部",
    Send: "傳送記憶",
    Reset: "重設對話",
    ResetConfirm: "重設後將清除目前對話記錄以及歷史記憶，確認重設？",
  },
  Home: {
    NewChat: "開新對話",
    DeleteChat: "確定要刪除選取的對話嗎？",
    DeleteToast: "已刪除對話",
    Revert: "撤銷",
  },
  Settings: {
    Title: "設定",
    SubTitle: "設定選項",
    ShowPassword: "顯示密碼",

    Tab: {
      General: "通用設定",
      Sync: "雲端同步",
      Mask: "角色助手",
      Prompt: "提示詞",
      ModelService: "模型服務",
      ModelConfig: "模型設定",
      Voice: "語音",
    },

    Danger: {
      Reset: {
        Title: "重設所有設定",
        SubTitle: "重設所有設定項回預設值",
        Action: "立即重設",
        Confirm: "確認重設所有設定？",
      },
      Clear: {
        Title: "清除所有資料",
        SubTitle: "清除所有聊天、設定資料",
        Action: "立即清除",
        Confirm: "確認清除所有聊天、設定資料？",
      },
    },
    Lang: {
      Name: "Language", // ATTENTION: if you wanna add a new translation, please do not translate this value, leave it as `Language`
      All: "所有語言",
    },
    Avatar: "大頭貼",
    FontSize: {
      Title: "字型大小",
      SubTitle: "聊天內容的字型大小",
    },
    FontFamily: {
      Title: "聊天字型",
      SubTitle: "聊天內容的字型，若留空則套用全域預設字型",
      Placeholder: "字型名稱",
    },

    InputTemplate: {
      Title: "使用者輸入預處理",
      SubTitle: "使用者最新的一則訊息會填充到此範本",
    },

    Update: {
      Version: (x: string) => `目前版本：${x}`,
      IsLatest: "已是最新版本",
      CheckUpdate: "檢查更新",
      IsChecking: "正在檢查更新...",
      FoundUpdate: (x: string) => `發現新版本：${x}`,
      GoToUpdate: "前往更新",
      Success: "更新成功！",
      Failed: "更新失敗",
    },
    SendKey: "傳送鍵",
    Theme: "主題",
    TightBorder: "緊湊邊框",
    SendPreviewBubble: {
      Title: "預覽氣泡",
      SubTitle: "在預覽氣泡中預覽 Markdown 內容",
    },
    AutoGenerateTitle: {
      Title: "自動產生標題",
      SubTitle: "根據對話內容產生合適的標題",
    },
    Sync: {
      CloudState: "雲端資料",
      NotSyncYet: "還沒有進行過同步",
      Success: "同步成功",
      Fail: "同步失敗",

      Config: {
        Modal: {
          Title: "設定雲端同步",
          Check: "檢查可用性",
        },
        SyncType: {
          Title: "同步類型",
          SubTitle: "選擇偏好的同步伺服器",
        },
        Proxy: {
          Title: "啟用代理伺服器",
          SubTitle: "在瀏覽器中同步時，啟用代理伺服器以避免跨域限制",
        },
        ProxyUrl: {
          Title: "代理伺服器位置",
          SubTitle: "僅適用於本專案內建的跨域代理",
        },

        WebDav: {
          Endpoint: "WebDAV 位置",
          UserName: "使用者名稱",
          Password: "密碼",
        },

        UpStash: {
          Endpoint: "UpStash Redis REST Url",
          UserName: "備份名稱",
          Password: "UpStash Redis REST Token",
        },
      },

      LocalState: "本機資料",
      Overview: (overview: any) => {
        return `${overview.chat} 次對話，${overview.message} 則訊息，${overview.prompt} 條提示詞，${overview.mask} 個角色範本`;
      },
      ImportFailed: "匯入失敗",
    },
    Mask: {
      Splash: {
        Title: "角色助手啟動頁面",
        SubTitle: "新增聊天時，呈現角色助手啟動頁面",
      },
      Builtin: {
        Title: "隱藏內建角色助手",
        SubTitle: "在所有角色助手列表中隱藏內建角色助手",
      },
      ModelIcon: {
        Title: "使用模型圖示作為AI頭像",
        SubTitle: "啟用後，對話中的AI頭像將使用目前模型的圖示，而不是表情符號",
      },
    },
    Prompt: {
      Disable: {
        Title: "停用提示詞自動補齊",
        SubTitle: "在輸入框開頭輸入 / 即可觸發自動補齊",
      },
      List: "自訂提示詞列表",
      ListCount: (builtin: number, custom: number) =>
        `內建 ${builtin} 條，使用者自訂 ${custom} 條`,
      Edit: "編輯",
      Modal: {
        Title: "提示詞列表",
        Add: "新增一則",
        Search: "搜尋提示詞",
      },
      EditModal: {
        Title: "編輯提示詞",
      },
    },
    HistoryCount: {
      Title: "附帶歷史訊息數",
      SubTitle: "每次請求附帶的歷史訊息數",
    },
    CompressThreshold: {
      Title: "歷史訊息長度壓縮閾值",
      SubTitle: "當未壓縮的歷史訊息超過該值時，將進行壓縮",
    },

    AccessCode: {
      Title: "存取碼",
      SubTitle: "目前系統啟用了存取控制，請輸入存取碼",
      Placeholder: "請輸入存取碼",
      Status: {
        Enabled: "存取控制已啟用",
        Valid: "存取碼有效",
        Invalid: "存取碼無效",
      },
    },

    Usage: {
      Title: "帳戶餘額",
      SubTitle(used: any, total: any) {
        return `本月已使用 $${used}，訂閱總額 $${total}`;
      },
      IsChecking: "正在檢查…",
      Check: "重新檢查",
      NoAccess: "輸入 API Key 檢視餘額",
    },

    Access: {
      SaasStart: {
        Title: "使用 NextChat AI",
        Label: "(性價比最高的方案)",
        SubTitle:
          "由 NextChat 官方維護，無須設定開箱即用，支援 OpenAI o1、GPT-4o、Claude-3.5 等最新的大型語言模型",
        ChatNow: "立刻開始對話",
      },

      AccessCode: {
        Title: "存取密碼",
        SubTitle: "管理員已開啟加密存取",
        Placeholder: "請輸入存取密碼",
      },
      CustomEndpoint: {
        Title: "自訂 API 端點 (Endpoint)",
        SubTitle: "是否使用自訂端點",
      },
      Provider: {
        Title: "模型供應商",
        SubTitle: "切換不同的服務供應商",
        Name: {
          ByteDance: "字節跳動",
          Alibaba: "阿里雲",
          Moonshot: "月之暗面",
        },
        Status: {
          Enabled: "已啟用",
        },
        Models: {
          Title: "啟用的模型",
          SubTitle: "當前服務商中已啟用的模型列表",
          NoModels: "暫無啟用的模型",
          Manage: "管理",
        },
        Description: {
          OpenAI: "OpenAI GPT 系列模型",
          Google: "Google Gemini 系列模型",
          Anthropic: "Anthropic Claude 系列模型",
          ByteDance: "字節跳動豆包系列模型",
          Alibaba: "阿里雲通義千問系列模型",
          Moonshot: "Moonshot Kimi 系列模型",
          DeepSeek: "DeepSeek 系列模型",
          XAI: "xAI Grok 系列模型",
          SiliconFlow: "SiliconFlow 矽基流動",
          Custom: "自訂",
        },
        Terms: {
          Provider: "服務商",
        },
      },
      OpenAI: {
        ApiKey: {
          Title: "API Key",
          SubTitle: "使用自訂 OpenAI Key 繞過密碼存取限制",
          Placeholder: "OpenAI API Key",
        },

        Endpoint: {
          Title: "API 端點 (Endpoint) 位址",
          SubTitle: "除預設位址外，必須包含 http(s)://",
        },
      },

      Anthropic: {
        ApiKey: {
          Title: "API 金鑰",
          SubTitle: "從 Anthropic AI 取得您的 API 金鑰",
          Placeholder: "Anthropic API Key",
        },

        Endpoint: {
          Title: "端點位址",
          SubTitle: "範例：",
        },

        ApiVerion: {
          Title: "API 版本 (claude api version)",
          SubTitle: "指定一個特定的 API 版本",
        },
      },
      Google: {
        ApiKey: {
          Title: "API 金鑰",
          SubTitle: "從 Google AI 取得您的 API 金鑰",
          Placeholder: "輸入您的 Google AI Studio API 金鑰",
        },

        Endpoint: {
          Title: "端點位址",
          SubTitle: "範例：",
        },

        ApiVersion: {
          Title: "API 版本（僅適用於 gemini-pro）",
          SubTitle: "選擇一個特定的 API 版本",
        },
        GoogleSafetySettings: {
          Title: "Google 安全過濾級別",
          SubTitle: "設定內容過濾級別",
        },
      },
      Baidu: {
        ApiKey: {
          Title: "API Key",
          SubTitle: "使用自訂 Baidu API Key",
          Placeholder: "Baidu API Key",
        },
        SecretKey: {
          Title: "Secret Key",
          SubTitle: "使用自訂 Baidu Secret Key",
          Placeholder: "Baidu Secret Key",
        },
        Endpoint: {
          Title: "介面位址",
          SubTitle: "不支援自訂前往 .env 配置",
        },
      },
      Tencent: {
        ApiKey: {
          Title: "API Key",
          SubTitle: "使用自訂騰訊雲API Key",
          Placeholder: "Tencent API Key",
        },
        SecretKey: {
          Title: "Secret Key",
          SubTitle: "使用自訂騰訊雲Secret Key",
          Placeholder: "Tencent Secret Key",
        },
        Endpoint: {
          Title: "介面位址",
          SubTitle: "不支援自訂前往 .env 配置",
        },
      },
      ByteDance: {
        ApiKey: {
          Title: "介面金鑰",
          SubTitle: "使用自訂 ByteDance API Key",
          Placeholder: "ByteDance API Key",
        },
        Endpoint: {
          Title: "介面位址",
          SubTitle: "範例：",
        },
      },
      Alibaba: {
        ApiKey: {
          Title: "介面金鑰",
          SubTitle: "使用自訂阿里雲API Key",
          Placeholder: "Alibaba Cloud API Key",
        },
        Endpoint: {
          Title: "介面位址",
          SubTitle: "範例：",
        },
      },
      Moonshot: {
        ApiKey: {
          Title: "介面金鑰",
          SubTitle: "使用自訂月之暗面API Key",
          Placeholder: "Moonshot API Key",
        },
        Endpoint: {
          Title: "介面位址",
          SubTitle: "範例：",
        },
      },
      DeepSeek: {
        ApiKey: {
          Title: "介面金鑰",
          SubTitle: "使用自訂DeepSeek API Key",
          Placeholder: "DeepSeek API Key",
        },
        Endpoint: {
          Title: "介面位址",
          SubTitle: "範例：",
        },
      },
      XAI: {
        ApiKey: {
          Title: "介面金鑰",
          SubTitle: "使用自訂XAI API Key",
          Placeholder: "XAI API Key",
        },
        Endpoint: {
          Title: "介面位址",
          SubTitle: "範例：",
        },
      },
      ChatGLM: {
        ApiKey: {
          Title: "介面金鑰",
          SubTitle: "使用自訂 ChatGLM API Key",
          Placeholder: "ChatGLM API Key",
        },
        Endpoint: {
          Title: "介面位址",
          SubTitle: "範例：",
        },
      },
      SiliconFlow: {
        ApiKey: {
          Title: "介面金鑰",
          SubTitle: "使用自訂矽基流動 API Key",
          Placeholder: "矽基流動 API Key",
        },
        Endpoint: {
          Title: "介面位址",
          SubTitle: "範例：",
        },
      },

      Iflytek: {
        ApiKey: {
          Title: "ApiKey",
          SubTitle: "從訊飛星火控制台取得的 APIKey",
          Placeholder: "APIKey",
        },
        ApiSecret: {
          Title: "ApiSecret",
          SubTitle: "從訊飛星火控制台取得的 APISecret",
          Placeholder: "APISecret",
        },
        Endpoint: {
          Title: "介面位址",
          SubTitle: "範例：",
        },
      },
      AI302: {
        ApiKey: {
          Title: "API 金鑰",
          SubTitle: "使用自訂 302.AI API 金鑰",
          Placeholder: "302.AI API 金鑰",
        },
        Endpoint: {
          Title: "端點位址",
          SubTitle: "範例：",
        },
      },
      CustomModel: {
        Title: "自訂模型名稱",
        SubTitle: "新增自訂模型可選項目，使用英文逗號隔開",
      },
      CustomProvider: {
        Add: {
          Title: "新增自訂服務商",
          Button: "新增自訂服務商",
          Description: "基於現有服務商類型新增自訂通道",
        },
        Modal: {
          Title: "新增自訂服務商",
          Name: {
            Title: "服務商名稱",
            Placeholder: "請輸入自訂服務商名稱",
            Required: "請輸入服務商名稱",
            Unique: "服務商名稱已存在，請使用其他名稱",
          },
          Type: {
            Title: "服務商類型",
            OpenAI: "OpenAI - 相容 OpenAI API 的服務",
            Google: "Google - Google Gemini API",
            Anthropic: "Anthropic - Anthropic Claude API",
          },
          ApiKey: {
            Title: "API Key",
            Placeholder: "請輸入 API Key",
            Required: "請輸入 API Key",
          },
          Endpoint: {
            Title: "自訂端點",
            Placeholder: "留空使用預設端點",
            Optional: "(可選)",
          },
          Cancel: "取消",
          Confirm: "新增",
        },
        Config: {
          Type: "服務商類型",
          BasedOn: "基於",
          ApiKeyDescription: "自訂服務商的 API 金鑰",
          EndpointDescription: "自訂的 API 端點位址",
          EndpointPlaceholder: "API 端點位址",
          Delete: {
            Title: "刪除服務商",
            SubTitle: "刪除此自訂服務商及其所有配置",
            Button: "刪除",
            Confirm: "確定要刪除自訂服務商",
            ConfirmSuffix: "嗎？",
          },
        },
      },
    },

    Model: "模型 (model)",
    CompressModel: {
      Title: "壓縮模型",
      SubTitle: "用於壓縮歷史記錄的模型",
    },
    Temperature: {
      Title: "隨機性 (temperature)",
      SubTitle: "值越大，回應越隨機",
    },
    TopP: {
      Title: "核心採樣 (top_p)",
      SubTitle: "與隨機性類似，但不要和隨機性一起更改",
    },
    MaxTokens: {
      Title: "單次回應限制 (max_tokens)",
      SubTitle:
        "單次請求可用的最大 Token。設為 -1 代表不限制，且請求中不會攜帶此欄位。",
    },
    PresencePenalty: {
      Title: "話題新穎度 (presence_penalty)",
      SubTitle: "值越大，越有可能拓展到新話題",
    },
    FrequencyPenalty: {
      Title: "頻率懲罰度 (frequency_penalty)",
      SubTitle: "值越大，越有可能降低重複字詞",
    },
    TTS: {
      Enable: {
        Title: "啟用文字轉語音",
        SubTitle: "啟用文字產生語音服務",
      },
      Autoplay: {
        Title: "啟用自動朗讀",
        SubTitle: "自動產生語音並播放，需先開啟文字轉語音開關",
      },
      Model: "模型",
      Engine: "轉換引擎",
      EngineConfig: {
        Title: "配置說明",
        SubTitle:
          "OpenAI-TTS 將使用模型服務中 OpenAI 提供商的配置，使用前需要在 OpenAI 提供商中新增對應的 API Key",
      },
      Voice: {
        Title: "聲音",
        SubTitle: "產生語音時使用的聲音",
      },
      Speed: {
        Title: "速度",
        SubTitle: "產生語音的速度",
      },
    },
    Realtime: {
      Enable: {
        Title: "即時聊天",
        SubTitle: "開啟即時聊天功能",
      },
      Provider: {
        Title: "模型服務商",
        SubTitle: "切換不同的服務商",
      },
      Model: {
        Title: "模型",
        SubTitle: "選擇一個模型",
      },
      ApiKey: {
        Title: "API Key",
        SubTitle: "API Key",
        Placeholder: "API Key",
      },

      Temperature: {
        Title: "隨機性 (temperature)",
        SubTitle: "值越大，回應越隨機",
      },
    },
  },
  Store: {
    DefaultTopic: "新的對話",
    BotHello: "請問需要我的協助嗎？",
    Error: "出錯了，請稍後再嘗試",
    Prompt: {
      History: (content: string) =>
        "這是 AI 與使用者的歷史聊天總結，作為前情提要：" + content,
      Topic:
        "Use the language used by the user (e.g. en for english conversation, zh-hant for chinese conversation, etc.) to generate a title (at most 6 words) summarizing our conversation without any lead-in, quotation marks, preamble like 'Title:', direct text copies, single-word replies, quotation marks, translations, or brackets. Remove enclosing quotation marks. The title should make third-party grasp the essence of the conversation in first sight.",
      Summarize:
        "Use the language used by the user (e.g. en-us for english conversation, zh-hant for chinese conversation, etc.) to summarise the conversation in at most 200 words. The summary will be used as prompt for you to continue the conversation in the future.",
    },
  },
  Copy: {
    Success: "已複製到剪貼簿中",
    Failed: "複製失敗，請賦予剪貼簿權限",
  },
  Download: {
    Success: "內容已下載到您的目錄。",
    Failed: "下載失敗。",
  },
  Context: {
    Toast: (x: any) => `已設定 ${x} 條前置上下文`,
    Edit: "前置上下文和歷史記憶",
    Add: "新增一則",
    Clear: "上下文已清除",
    Revert: "恢復上下文",
  },

  ChatSettings: {
    Name: "對話設定",
  },
  Mcp: {
    Name: "MCP",
  },
  FineTuned: { Sysmessage: "你是一個助手" },
  Mask: {
    Name: "角色助手",
    DefaultName: "預設助手",
    Management: "助手管理",
    NewMask: "新增助手",
    DefaultModel: "預設模型",
    DefaultModelDesc: "新建對話時使用的預設模型",
    UseGlobalModel: "使用全域預設模型",
    ConversationCount: (count: number) => `${count} 個對話`,
    Page: {
      Title: "預設角色助手",
      SubTitle: (count: number) => `${count} 個預設角色定義`,
      Search: "搜尋角色助手",
      Create: "新增",
    },
    Item: {
      Info: (count: number) => `包含 ${count} 條預設對話`,
      Chat: "對話",
      View: "檢視",
      Edit: "編輯",
      Delete: "刪除",
      DeleteConfirm: "確認刪除？",
    },
    EditModal: {
      Title: (readonly: boolean) =>
        `編輯預設角色助手 ${readonly ? "（唯讀）" : ""}`,
      Download: "下載預設值",
      Clone: "以此預設值建立副本",
    },
    Config: {
      Avatar: "角色頭像",
      Name: "角色名稱",
      Sync: {
        Title: "使用全域設定",
        SubTitle: "目前對話是否使用全域模型設定",
        Confirm: "目前對話的自訂設定將會被自動覆蓋，確認啟用全域設定？",
      },
      HideContext: {
        Title: "隱藏預設對話",
        SubTitle: "隱藏後預設對話不會出現在聊天介面",
      },
      Artifacts: {
        Title: "啟用Artifacts",
        SubTitle: "啟用之後可以直接渲染HTML頁面",
      },
      CodeFold: {
        Title: "啟用程式碼摺疊",
        SubTitle: "啟用之後可以自動摺疊/展開過長的程式碼區塊",
      },
      Share: {
        Title: "分享此角色助手",
        SubTitle: "產生此角色助手的直達連結",
        Action: "複製連結",
      },
    },
  },
  SearchChat: {
    Name: "搜尋聊天記錄",
    Page: {
      Title: "搜尋聊天記錄",
      Search: "輸入搜尋關鍵詞",
      NoResult: "沒有找到結果",
      NoData: "沒有資料",
      Loading: "載入中",

      SubTitle: (count: number) => `找到 ${count} 條結果`,
    },
    Item: {
      View: "檢視",
    },
  },
  NewChat: {
    Return: "返回",
    Skip: "跳過",
    Title: "挑選一個角色助手",
    SubTitle: "現在開始，與角色助手背後的靈魂思維碰撞",
    More: "檢視全部",
    Less: "摺疊程式碼",
    ShowCode: "顯示程式碼",
    Preview: "預覽",
    NotShow: "不再顯示",
    ConfirmNoShow: "確認停用？停用後可以隨時在設定中重新啟用。",
    Searching: "搜尋中...",
    Search: "搜尋內容",
    NoSearch: "沒有搜尋內容",
    SearchFormat: (SearchTime?: number) =>
      SearchTime !== undefined
        ? `（用時 ${Math.round(SearchTime / 1000)} 秒）`
        : "",
    Thinking: "正在思考中...",
    Think: "思考過程",
    NoThink: "沒有思考過程",
    ThinkFormat: (thinkingTime?: number) =>
      thinkingTime !== undefined
        ? `（用時 ${Math.round(thinkingTime / 1000)} 秒）`
        : "",
  },
  URLCommand: {
    Code: "偵測到連結中已經包含存取密碼，是否自動填入？",
    Settings: "偵測到連結中包含了預設設定，是否自動填入？",
  },
  UI: {
    Confirm: "確認",
    Cancel: "取消",
    Close: "關閉",
    Create: "新增",
    Edit: "編輯",
    Export: "匯出",
    Import: "匯入",
    Sync: "同步",
    Config: "設定",
  },
  Exporter: {
    Description: {
      Title: "只有清除上下文之後的訊息會被顯示",
    },
    Model: "模型",
    Messages: "訊息",
    Topic: "主題",
    Time: "時間",
  },
};

type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

export type LocaleType = typeof tw;
export type PartialLocaleType = DeepPartial<typeof tw>;

export default tw;
// Translated by @chunkiuuu, feel free the submit new pr if there are typo/incorrect translations :D
