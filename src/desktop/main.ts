import { app, BrowserWindow, ipcMain } from "electron";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_BRIDGE_HOST,
  DEFAULT_BRIDGE_PORT,
  startBridgeServer,
  type BridgeRuntime
} from "../bridge/bridgeServer";

type BridgeRequestMethod = "GET" | "POST";

let bridgeRuntime: BridgeRuntime | undefined;
let mainWindow: BrowserWindow | undefined;

const requestedBridgeUrl =
  process.env.PCPA_BRIDGE_URL ??
  `http://${DEFAULT_BRIDGE_HOST}:${DEFAULT_BRIDGE_PORT}`;

void app.whenReady().then(async () => {
  bridgeRuntime = await startDesktopBridge();
  registerDesktopBridgeHandlers(bridgeRuntime?.url ?? requestedBridgeUrl);
  await createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  ipcMain.removeHandler("pcpa:desktop-state");
  ipcMain.removeHandler("pcpa:desktop-action");
  if (bridgeRuntime) {
    void bridgeRuntime.close();
    bridgeRuntime = undefined;
  }
});

async function createMainWindow(): Promise<void> {
  const shouldQuitAfterLoad = process.argv.includes("--smoke");
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 920,
    minHeight: 640,
    backgroundColor: "#f5f6f8",
    title: "Perpetual Context Protection",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (shouldQuitAfterLoad) {
    mainWindow.webContents.once("did-finish-load", () => {
      setTimeout(() => app.quit(), 500);
    });
  }

  const devServerUrl = process.env.PCPA_DESKTOP_DEV_SERVER_URL;
  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
  } else {
    await mainWindow.loadFile(resolveRendererIndexPath());
  }
}

function resolveRendererIndexPath(): string {
  const preferredPath = join(__dirname, "../../desktop/renderer/index.html");
  if (existsSync(preferredPath)) {
    return preferredPath;
  }
  return join(__dirname, "../../desktop/renderer/desktop/index.html");
}

async function startDesktopBridge(): Promise<BridgeRuntime | undefined> {
  try {
    return await startBridgeServer({
      host: DEFAULT_BRIDGE_HOST,
      port: DEFAULT_BRIDGE_PORT
    });
  } catch (error) {
    if (isAddressInUseError(error)) {
      return undefined;
    }
    throw error;
  }
}

function registerDesktopBridgeHandlers(bridgeUrl: string): void {
  ipcMain.handle("pcpa:desktop-state", async () =>
    requestBridge(bridgeUrl, "/desktop/state", "GET")
  );
  ipcMain.handle("pcpa:desktop-action", async (_event, path: string) => {
    if (!isAllowedDesktopActionPath(path)) {
      throw new Error(`Unsupported desktop action path: ${path}`);
    }
    return requestBridge(bridgeUrl, path, "POST");
  });
}

async function requestBridge<T>(
  bridgeUrl: string,
  path: string,
  method: BridgeRequestMethod
): Promise<T> {
  const response = await fetch(new URL(path, bridgeUrl), { method });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `Bridge request ${method} ${path} failed with ${response.status}: ${text}`
    );
  }
  return JSON.parse(text) as T;
}

function isAllowedDesktopActionPath(path: string): boolean {
  return (
    path === "/desktop/arm-all" ||
    /^\/desktop\/cards\/[^/]+\/(?:arm|pause|dismiss)$/u.test(path)
  );
}

function isAddressInUseError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "EADDRINUSE"
  );
}
