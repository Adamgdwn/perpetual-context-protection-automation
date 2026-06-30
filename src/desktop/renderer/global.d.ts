import type { DesktopBridgeApi } from "../preload";

declare global {
  interface Window {
    pcpaDesktop?: DesktopBridgeApi;
  }
}

export {};
