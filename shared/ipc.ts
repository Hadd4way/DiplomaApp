export const IPC_CHANNELS = {
  ping: 'app:ping'
} as const;

export type PingResponse = {
  ok: true;
  message: string;
  versions: {
    electron: string;
    node: string;
    chrome: string;
  };
};

export interface RendererApi {
  ping: () => Promise<PingResponse>;
}

declare global {
  interface Window {
    api?: RendererApi;
    electronAPI?: RendererApi;
  }
}

export {};
