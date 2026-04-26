import { type ChatConversation } from "./chat-history";

export function exportConversationToMarkdown(conversation: ChatConversation): string {
  const lines: string[] = [];

  lines.push(`# ${conversation.title || "Conversation QGISAI+"}`);
  lines.push(``);
  lines.push(`**Date:** ${new Date(conversation.createdAt).toLocaleString("fr-FR")}`);
  lines.push(`**Mode:** ${conversation.mode === "free" ? "Libre" : "Action"}`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);

  conversation.messages.forEach((msg) => {
    const role = msg.role === "user" ? "👤 Utilisateur" : "🤖 Assistant";
    const timestamp = new Date(msg.createdAt).toLocaleTimeString("fr-FR");
    lines.push(`### ${role} - ${timestamp}`);
    lines.push(``);
    lines.push(msg.content);
    lines.push(``);
    lines.push(`---`);
    lines.push(``);
  });

  return lines.join("\n");
}

export function exportConversationToJson(conversation: ChatConversation): string {
  return JSON.stringify(conversation, null, 2);
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importConversationFromJson(json: string): ChatConversation | null {
  try {
    const parsed = JSON.parse(json);
    // Basic validation
    if (!parsed.id || !Array.isArray(parsed.messages)) {
      return null;
    }
    return parsed as ChatConversation;
  } catch {
    return null;
  }
}
