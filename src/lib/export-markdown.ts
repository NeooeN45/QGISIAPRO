import { ChatConversation } from "./chat-history";

export function conversationToMarkdown(conversation: ChatConversation): string {
  const lines: string[] = [];

  lines.push(`# ${conversation.title || "Conversation sans titre"}`);
  lines.push("");
  lines.push(
    `> Mode : **${conversation.mode === "free" ? "Libre" : "Action"}** — ` +
      `${conversation.messages.length} message(s) — ` +
      `Créée le ${new Date(conversation.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}`,
  );

  if (conversation.selectedLayerIds.length > 0) {
    lines.push("");
    lines.push(
      `**Couches liées :** ${conversation.selectedLayerIds.join(", ")}`,
    );
  }

  lines.push("");
  lines.push("---");
  lines.push("");

  for (const message of conversation.messages) {
    const roleLabel =
      message.role === "user" ? "🧑 **Utilisateur**" : "🤖 **Assistant**";
    const timestamp = new Date(message.createdAt).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    lines.push(`### ${roleLabel}  <sub>${timestamp}</sub>`);
    lines.push("");
    lines.push(message.content);
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

export function downloadMarkdown(
  conversation: ChatConversation,
): void {
  const markdown = conversationToMarkdown(conversation);
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const slug = (conversation.title || "conversation")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug}.md`;
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
