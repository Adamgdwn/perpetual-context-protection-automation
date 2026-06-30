import { contextBridge, ipcRenderer } from "electron";
import type {
  DesktopActionResponse,
  DesktopStateResponse,
  SessionAutomationMode
} from "../shared/protocol";

export interface DesktopBridgeApi {
  getState: () => Promise<DesktopStateResponse>;
  armCard: (cardId: string) => Promise<DesktopActionResponse>;
  pauseCard: (cardId: string) => Promise<DesktopActionResponse>;
  dismissCard: (cardId: string) => Promise<DesktopActionResponse>;
  armAll: () => Promise<DesktopActionResponse>;
  setAutomationMode: (mode: SessionAutomationMode) => Promise<DesktopActionResponse>;
}

const api: DesktopBridgeApi = {
  getState: () => ipcRenderer.invoke("pcpa:desktop-state") as Promise<DesktopStateResponse>,
  armCard: (cardId) => desktopAction(`/desktop/cards/${encodeURIComponent(cardId)}/arm`),
  pauseCard: (cardId) =>
    desktopAction(`/desktop/cards/${encodeURIComponent(cardId)}/pause`),
  dismissCard: (cardId) =>
    desktopAction(`/desktop/cards/${encodeURIComponent(cardId)}/dismiss`),
  armAll: () => desktopAction("/desktop/arm-all"),
  setAutomationMode: (mode) => desktopAction(`/desktop/automation-mode/${mode}`)
};

contextBridge.exposeInMainWorld("pcpaDesktop", api);

function desktopAction(path: string): Promise<DesktopActionResponse> {
  return ipcRenderer.invoke("pcpa:desktop-action", path) as Promise<DesktopActionResponse>;
}
