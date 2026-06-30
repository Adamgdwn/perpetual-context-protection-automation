import type {
  DesktopActionResponse,
  DesktopStateResponse
} from "../../shared/protocol";

const defaultBridgeUrl = "http://127.0.0.1:47320";

export interface DesktopApi {
  getState: () => Promise<DesktopStateResponse>;
  armCard: (cardId: string) => Promise<DesktopActionResponse>;
  pauseCard: (cardId: string) => Promise<DesktopActionResponse>;
  dismissCard: (cardId: string) => Promise<DesktopActionResponse>;
  armAll: () => Promise<DesktopActionResponse>;
}

export function createDesktopApi(): DesktopApi {
  if (window.pcpaDesktop) {
    return window.pcpaDesktop;
  }

  return {
    getState: () => requestBridge<DesktopStateResponse>("/desktop/state", "GET"),
    armCard: (cardId) =>
      requestBridge<DesktopActionResponse>(
        `/desktop/cards/${encodeURIComponent(cardId)}/arm`,
        "POST"
      ),
    pauseCard: (cardId) =>
      requestBridge<DesktopActionResponse>(
        `/desktop/cards/${encodeURIComponent(cardId)}/pause`,
        "POST"
      ),
    dismissCard: (cardId) =>
      requestBridge<DesktopActionResponse>(
        `/desktop/cards/${encodeURIComponent(cardId)}/dismiss`,
        "POST"
      ),
    armAll: () => requestBridge<DesktopActionResponse>("/desktop/arm-all", "POST")
  };
}

async function requestBridge<T>(path: string, method: "GET" | "POST"): Promise<T> {
  const response = await fetch(new URL(path, defaultBridgeUrl), { method });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `Bridge request ${method} ${path} failed with ${response.status}: ${text}`
    );
  }
  return JSON.parse(text) as T;
}
