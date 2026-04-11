declare module "*.jpg";
declare module "*.png";
declare module "*.woff2";
declare module "*.woff";
declare module "*.ttf";
declare module "*.scss" {
  const content: Record<string, string>;
  export default content;
}

declare module "*.svg";

type DangerConfig = {
  hideUserApiKey: boolean;
  disableGPT4: boolean;
  hideBalanceQuery: boolean;
  disableFastLink: boolean;
  customModels: string;
  defaultModel: string;
  visionModels: string;
  hasServerAccessCode: boolean;
  hasServerProviderConfig: boolean;
  serverProviders: {
    openai: { hasApiKey: boolean; hasBaseUrl: boolean };
    google: { hasApiKey: boolean; hasBaseUrl: boolean };
    anthropic: { hasApiKey: boolean; hasBaseUrl: boolean };
    bytedance: { hasApiKey: boolean; hasBaseUrl: boolean };
    alibaba: { hasApiKey: boolean; hasBaseUrl: boolean };
    moonshot: { hasApiKey: boolean; hasBaseUrl: boolean };
    deepseek: { hasApiKey: boolean; hasBaseUrl: boolean };
    xai: { hasApiKey: boolean; hasBaseUrl: boolean };
    siliconflow: { hasApiKey: boolean; hasBaseUrl: boolean };
  };
};

declare interface Window {
  __TAURI__?: {
    writeText(text: string): Promise<void>;
    invoke(command: string, payload?: Record<string, unknown>): Promise<any>;
    dialog: {
      save(options?: Record<string, unknown>): Promise<string | null>;
    };
    fs: {
      writeBinaryFile(path: string, data: Uint8Array): Promise<void>;
      writeTextFile(path: string, data: string): Promise<void>;
    };
    notification: {
      requestPermission(): Promise<Permission>;
      isPermissionGranted(): Promise<boolean>;
      sendNotification(options: string | Options): void;
    };
    updater: {
      checkUpdate(): Promise<UpdateResult>;
      installUpdate(): Promise<void>;
      onUpdaterEvent(
        handler: (status: UpdateStatusResult) => void,
      ): Promise<UnlistenFn>;
    };
    http: {
      fetch<T>(
        url: string,
        options?: Record<string, unknown>,
      ): Promise<Response<T>>;
    };
  };
}
