export function managedCardId(sessionId: string): string {
  return `managed:${sessionId}`;
}

export function terminalCardId(windowId: string, terminalId: string): string {
  return `terminal:${windowId}:${terminalId}`;
}

export function workspaceCardId(windowId: string): string {
  return `workspace:${windowId}`;
}
