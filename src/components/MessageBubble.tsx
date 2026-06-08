import { motion } from "motion/react";
import ReactMarkdown from "react-markdown";
import { Sparkles, User, ThumbsUp, ThumbsDown } from "lucide-react";

import { cn } from "@/src/lib/utils";
import { ChatMessage } from "../lib/chat-history";
import CodeBlock from "./CodeBlock";
import { useConversationStore } from "../stores/useConversationStore";
import { parseReasoning } from "../lib/reasoning-parser";
import ReasoningPhasesView from "./ReasoningPhasesView";

interface MessageBubbleProps {
  message: ChatMessage;
}

// Animation variants pour les entrées de messages
const userMessageVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
};

const assistantMessageVariants = {
  initial: { opacity: 0, x: -12, y: 8 },
  animate: { opacity: 1, x: 0, y: 0 },
};

const messageTransition = {
  duration: 0.3,
  ease: [0.0, 0, 0.2, 1] as const,
};

// Animation pour les boutons feedback
const feedbackButtonsVariants = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
};

const feedbackTransition = {
  duration: 0.25,
  delay: 0.5,
  ease: [0.0, 0, 0.2, 1] as const,
};

// Formatter le timestamp
function formatTimestamp(createdAt: string): string {
  try {
    const date = new Date(createdAt);
    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const setMessageFeedback = useConversationStore((s) => s.setMessageFeedback);

  const handleFeedback = (feedback: "like" | "dislike" | null) => {
    setMessageFeedback(message.id, feedback);
  };

  const isUser = message.role === "user";
  const timestamp = formatTimestamp(message.createdAt);

  return (
    <motion.div
      key={message.id}
      variants={isUser ? userMessageVariants : assistantMessageVariants}
      initial="initial"
      animate="animate"
      transition={messageTransition}
      className={cn(
        "flex gap-4 md:gap-6",
        isUser ? "flex-row-reverse" : "",
      )}
    >
      {/* Avatar Container */}
      <div className="relative shrink-0">
        {isUser ? (
          // Avatar User avec gradient animé
          <motion.div
            className="group relative mt-1 flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl shadow-xl"
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.2 }}
          >
            {/* Fond avec gradient animé */}
            <div className="absolute inset-0 animate-gradient-shift bg-gradient-to-br from-blue-500 via-indigo-600 to-blue-600 bg-[length:200%_200%]" />
            {/* Bordure glow au hover */}
            <div className="absolute -inset-[1px] rounded-2xl bg-blue-400/0 transition-all duration-300 group-hover:bg-blue-400/30 group-hover:blur-sm" />
            <User size={20} className="relative z-10 text-white" />
          </motion.div>
        ) : (
          // Avatar Assistant avec rotation lente et gradient subtil
          <motion.div
            className="group relative mt-1 flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl border border-gray-300 bg-gray-200 shadow-xl dark:border-[#333537] dark:bg-[#1a1a1b]"
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.2 }}
          >
            {/* Fond gradient subtil animé */}
            <div className="absolute inset-0 animate-gradient-loop bg-gradient-to-br from-blue-500/10 via-violet-500/10 to-blue-500/10 bg-[length:200%_200%] dark:from-blue-400/10 dark:via-violet-400/10 dark:to-blue-400/10" />
            <motion.div
              animate={{ rotate: 360 }}
              transition={{
                duration: 20,
                repeat: Infinity,
                ease: "linear",
              }}
            >
              <Sparkles size={18} className="relative z-10 text-blue-500 dark:text-blue-400" />
            </motion.div>
          </motion.div>
        )}
      </div>

      {/* Content Container */}
      <div
        className={cn(
          "min-w-0 flex-1",
          isUser ? "text-right" : "",
        )}
      >
        {/* Message Bubble */}
        <div
          className={cn(
            "prose dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-transparent prose-pre:p-0",
            "prose-strong:text-blue-700 dark:prose-strong:text-blue-300",
            "prose-code:text-blue-700 dark:prose-code:text-blue-300",
            isUser
              ? "inline-block rounded-[24px_24px_8px_24px] border border-blue-500/20 bg-gradient-to-br from-blue-600/12 to-indigo-600/8 px-5 py-4 text-left shadow-xl backdrop-blur-sm dark:border-blue-400/15 dark:from-blue-500/15 dark:to-indigo-500/10"
              : "",
          )}
        >
          {!isUser && parseReasoning(message.content).hasStructuredReasoning ? (
            <ReasoningPhasesView text={message.content} />
          ) : (
            <ReactMarkdown
              components={{
                code({ className, children, ...codeProps }) {
                  const match = /language-(\w+)/.exec(className || "");
                  const isInline = !match;

                  return !isInline ? (
                    <CodeBlock
                      language={match[1]}
                      value={String(children).replace(/\n$/, "")}
                    />
                  ) : (
                    <code
                      className={cn(
                        "rounded-md bg-gray-200 px-2 py-0.5 font-mono text-xs font-bold text-blue-600 dark:bg-[#333537] dark:text-blue-300",
                        className,
                      )}
                      {...codeProps}
                    >
                      {children}
                    </code>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>

        {/* Timestamp */}
        {timestamp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            transition={{ duration: 0.3, delay: 0.4 }}
            className={cn(
              "mt-1 text-[10px] text-gray-500 dark:text-white/30",
              isUser ? "text-right pr-1" : "text-left pl-1",
            )}
          >
            {timestamp}
          </motion.div>
        )}

        {/* Feedback Buttons - Assistant only */}
        {!isUser && (
          <motion.div
            variants={feedbackButtonsVariants}
            initial="initial"
            animate="animate"
            transition={feedbackTransition}
            className="mt-2 flex items-center gap-2"
          >
            <motion.button
              onClick={() => handleFeedback(message.feedback === "like" ? null : "like")}
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.15 }}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                message.feedback === "like"
                  ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                  : "border-gray-300 bg-gray-100 text-gray-500 hover:border-emerald-500/20 hover:bg-emerald-500/10 hover:text-emerald-600 dark:border-white/10 dark:bg-white/5 dark:text-white/40 dark:hover:text-emerald-200",
              )}
              title="Cette réponse est utile"
            >
              <ThumbsUp size={12} />
              <span>Utile</span>
            </motion.button>
            <motion.button
              onClick={() => handleFeedback(message.feedback === "dislike" ? null : "dislike")}
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.15 }}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                message.feedback === "dislike"
                  ? "border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-300"
                  : "border-gray-300 bg-gray-100 text-gray-500 hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-600 dark:border-white/10 dark:bg-white/5 dark:text-white/40 dark:hover:text-red-200",
              )}
              title="Cette réponse n'est pas utile"
            >
              <ThumbsDown size={12} />
              <span>Pas utile</span>
            </motion.button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
