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

export default function MessageBubble({ message }: MessageBubbleProps) {
  const setMessageFeedback = useConversationStore((s) => s.setMessageFeedback);

  const handleFeedback = (feedback: "like" | "dislike" | null) => {
    setMessageFeedback(message.id, feedback);
  };

  return (
    <motion.div
      key={message.id}
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={cn(
        "flex gap-4 md:gap-6",
        message.role === "user" ? "flex-row-reverse" : "",
      )}
    >
      <div
        className={cn(
          "mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-xl",
          message.role === "user"
            ? "border border-white/10 bg-gradient-to-br from-blue-600 to-indigo-700"
            : "border border-gray-300 dark:border-[#333537] bg-gray-200 dark:bg-[#1a1a1b]",
        )}
      >
        {message.role === "user" ? (
          <User size={20} className="text-white" />
        ) : (
          <Sparkles size={18} className="text-blue-500 dark:text-blue-400" />
        )}
      </div>
      <div
        className={cn(
          "min-w-0 flex-1",
          message.role === "user" ? "text-right" : "",
        )}
      >
        <div
          className={cn(
            "prose dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-transparent prose-pre:p-0",
            "prose-strong:text-blue-700 dark:prose-strong:text-blue-300",
            "prose-code:text-blue-700 dark:prose-code:text-blue-300",
            message.role === "user"
              ? "inline-block rounded-[28px] border border-blue-500/20 bg-blue-600/10 px-5 py-4 text-left shadow-xl"
              : "",
          )}
        >
          {message.role === "assistant" &&
          parseReasoning(message.content).hasStructuredReasoning ? (
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
                        "rounded-md bg-gray-200 dark:bg-[#333537] px-2 py-0.5 font-mono text-xs font-bold text-blue-600 dark:text-blue-300",
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
        {message.role === "assistant" && (
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={() => handleFeedback(message.feedback === "like" ? null : "like")}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
                message.feedback === "like"
                  ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                  : "border-gray-300 dark:border-white/10 bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-white/40 hover:border-emerald-500/20 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-200"
              )}
              title="Cette réponse est utile"
            >
              <ThumbsUp size={12} />
              <span>Utile</span>
            </button>
            <button
              onClick={() => handleFeedback(message.feedback === "dislike" ? null : "dislike")}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
                message.feedback === "dislike"
                  ? "border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-300"
                  : "border-gray-300 dark:border-white/10 bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-white/40 hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-200"
              )}
              title="Cette réponse n'est pas utile"
            >
              <ThumbsDown size={12} />
              <span>Pas utile</span>
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
