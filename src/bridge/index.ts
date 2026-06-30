import { startBridgeServer } from "./bridgeServer";

function readPort(argv: string[]): number | undefined {
  const portFlagIndex = argv.indexOf("--port");
  if (portFlagIndex === -1) {
    return undefined;
  }

  const rawPort = argv[portFlagIndex + 1];
  const parsed = Number.parseInt(rawPort, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
    throw new Error(`Invalid --port value: ${rawPort}`);
  }
  return parsed;
}

async function main(): Promise<void> {
  const runtime = await startBridgeServer({ port: readPort(process.argv) });
  process.stdout.write(`pcpa bridge listening on ${runtime.url}\n`);

  const shutdown = (): void => {
    void runtime.close().finally(() => process.exit(0));
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`pcpa bridge failed: ${message}\n`);
  process.exitCode = 1;
});
