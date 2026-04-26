export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  feedback?: "like" | "dislike" | null;
}

/**
 * Modes de conversation :
 *  - "chat" : agent SIG actif, peut modifier QGIS (charger couches, lancer scripts, etc.)
 *  - "free" : assistant conversationnel libre, sans accès aux outils QGIS
 *
 * Le mode "plan" historique est déprécié et migré automatiquement vers "chat".
 */
export type ConversationMode = "chat" | "free";
export type LayerContextScope = "layer" | "selection";

export interface LayerContextConfig {
  layerId: string;
  scope: LayerContextScope;
}

export interface ChatConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  selectedLayerIds: string[];
  layerContextById: Record<string, LayerContextScope>;
  mode: ConversationMode;
}

interface StoredChatHistory {
  activeConversationId: string | null;
  conversations: ChatConversation[];
}

const CHAT_HISTORY_STORAGE_KEY = "geoai-chat-history";

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeMessage(input: Partial<ChatMessage>): ChatMessage | null {
  const role = input.role === "user" || input.role === "assistant" ? input.role : null;
  const content = typeof input.content === "string" ? input.content.trim() : "";
  if (!role || !content) {
    return null;
  }

  return {
    id: typeof input.id === "string" && input.id ? input.id : createId("message"),
    role,
    content,
    createdAt:
      typeof input.createdAt === "string" && input.createdAt
        ? input.createdAt
        : new Date().toISOString(),
  };
}

function normalizeConversation(
  input: Partial<ChatConversation>,
): ChatConversation | null {
  const messages = Array.isArray(input.messages)
    ? input.messages
        .map((message) => normalizeMessage(message))
        .filter((message): message is ChatMessage => message !== null)
    : [];

  if (messages.length === 0) {
    return null;
  }

  const createdAt =
    typeof input.createdAt === "string" && input.createdAt
      ? input.createdAt
      : messages[0].createdAt;
  const updatedAt =
    typeof input.updatedAt === "string" && input.updatedAt
      ? input.updatedAt
      : messages[messages.length - 1].createdAt;

  return {
    id: typeof input.id === "string" && input.id ? input.id : createId("conversation"),
    title:
      typeof input.title === "string" && input.title.trim()
        ? input.title.trim()
        : buildConversationTitle(messages),
    createdAt,
    updatedAt,
    messages,
    selectedLayerIds: Array.isArray(input.selectedLayerIds)
      ? input.selectedLayerIds.filter(
          (layerId): layerId is string => typeof layerId === "string" && layerId.length > 0,
        )
      : [],
    layerContextById:
      input.layerContextById && typeof input.layerContextById === "object"
        ? Object.fromEntries(
            Object.entries(input.layerContextById)
              .filter(
                ([layerId, scope]) =>
                  layerId.length > 0 && (scope === "layer" || scope === "selection"),
              )
              .map(([layerId, scope]) => [layerId, scope as LayerContextScope]),
          )
        : {},
    // Migration: ancien mode "plan" → "chat" (action). Mode "free" preserve.
    mode: input.mode === "free" ? "free" : "chat",
  };
}

export function createMessage(
  role: ChatMessage["role"],
  content: string,
): ChatMessage {
  return {
    id: createId("message"),
    role,
    content: content.trim(),
    createdAt: new Date().toISOString(),
  };
}

export function buildConversationTitle(
  messages: ChatMessage[],
  fallback = "Nouvelle discussion",
): string {
  const firstUserMessage = messages.find((message) => message.role === "user");
  if (!firstUserMessage) {
    return fallback;
  }

  const flattened = firstUserMessage.content.replace(/\s+/g, " ").trim();
  if (flattened.length <= 52) {
    return flattened;
  }

  return `${flattened.slice(0, 49).trimEnd()}...`;
}

export function createConversation(initialMessage: ChatMessage): ChatConversation {
  const now = initialMessage.createdAt || new Date().toISOString();

  return {
    id: createId("conversation"),
    title: "Nouvelle discussion",
    createdAt: now,
    updatedAt: now,
    messages: [initialMessage],
    selectedLayerIds: [],
    layerContextById: {},
    mode: "chat",
  };
}

export function finalizeConversation(
  conversation: ChatConversation,
  options?: { touch?: boolean },
): ChatConversation {
  const touch = options?.touch ?? true;

  return {
    ...conversation,
    title: buildConversationTitle(conversation.messages),
    updatedAt: touch ? new Date().toISOString() : conversation.updatedAt,
  };
}

export function sortConversations(
  conversations: ChatConversation[],
): ChatConversation[] {
  return [...conversations].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
}

export function loadConversationHistory(): StoredChatHistory {
  try {
    const rawValue = localStorage.getItem(CHAT_HISTORY_STORAGE_KEY);
    if (!rawValue) {
      return {
        activeConversationId: null,
        conversations: [],
      };
    }

    const parsed = JSON.parse(rawValue) as Partial<StoredChatHistory>;
    const conversations = Array.isArray(parsed.conversations)
      ? parsed.conversations
          .map((conversation) => normalizeConversation(conversation))
          .filter((conversation): conversation is ChatConversation => conversation !== null)
      : [];

    const sorted = sortConversations(conversations);
    const activeConversationId =
      typeof parsed.activeConversationId === "string" &&
      sorted.some((conversation) => conversation.id === parsed.activeConversationId)
        ? parsed.activeConversationId
        : sorted[0]?.id || null;

    return {
      activeConversationId,
      conversations: sorted,
    };
  } catch {
    return {
      activeConversationId: null,
      conversations: [],
    };
  }
}

export function saveConversationHistory(
  conversations: ChatConversation[],
  activeConversationId: string | null,
): void {
  const payload: StoredChatHistory = {
    activeConversationId,
    conversations: sortConversations(conversations),
  };

  localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(payload));
}
