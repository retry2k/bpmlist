"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { EventData } from "@/types/event";
import { parseVibeQuery } from "@/lib/vibe-engine";

interface VibeChatProps {
  events: EventData[];
  onEventClick: (event: EventData) => void;
  onClose: () => void;
}

interface ChatMessage {
  role: "bot" | "user";
  text: string;
  emoji?: string;
  events?: EventData[];
}

function getTimeString(event: EventData): string {
  const parts = [];
  if (event.date) parts.push(event.date);
  if (event.time) parts.push(event.time);
  return parts.join(" · ");
}

function getDotColor(tags: string[]): string {
  const tagStr = tags.join(" ").toLowerCase();
  if (/techno|industrial/.test(tagStr)) return "bg-pink-500";
  if (/house|deep house|tech house|progressive/.test(tagStr)) return "bg-cyan-400";
  if (/drum|bass|dnb|jungle/.test(tagStr)) return "bg-yellow-400";
  if (/trance/.test(tagStr)) return "bg-violet-500";
  if (/dubstep|bass music/.test(tagStr)) return "bg-orange-400";
  return "bg-green-400";
}

const QUICK_VIBES = [
  { label: "dark & heavy", emoji: "🖤" },
  { label: "chill house", emoji: "🌊" },
  { label: "rave", emoji: "👾" },
  { label: "funky disco", emoji: "🕺" },
  { label: "late night", emoji: "🌙" },
  { label: "trippy", emoji: "🍄" },
];

export default function VibeChat({ events, onEventClick, onClose }: VibeChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "bot",
      text: "what mood are you in tonight?",
      emoji: "👋",
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = useCallback(
    (text: string) => {
      if (!text.trim()) return;

      const userMsg: ChatMessage = { role: "user", text: text.trim() };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsTyping(true);

      // Simulate typing delay for natural feel
      setTimeout(() => {
        const result = parseVibeQuery(text, events);
        const botMsg: ChatMessage = {
          role: "bot",
          text: result.response,
          emoji: result.emoji,
          events: result.events,
        };
        setMessages((prev) => [...prev, botMsg]);
        setIsTyping(false);
      }, 600 + Math.random() * 400);
    },
    [events]
  );

  return (
    <div className="fixed bottom-4 right-4 z-[2000] w-[360px] max-w-[calc(100vw-2rem)] h-[500px] max-h-[calc(100vh-6rem)] bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎧</span>
          <div>
            <p className="text-white text-sm font-bold font-mono">vibe check</p>
            <p className="text-neutral-500 text-[10px] font-mono">describe your mood, i'll find the event</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-neutral-500 hover:text-white p-1 rounded hover:bg-neutral-800 transition-colors cursor-pointer"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] ${
                msg.role === "user"
                  ? "bg-violet-700/30 border border-violet-700/40 text-white"
                  : "bg-neutral-800 border border-neutral-700/50 text-neutral-200"
              } rounded-2xl px-3.5 py-2.5 text-sm font-mono`}
            >
              {msg.role === "bot" && msg.emoji && (
                <span className="mr-1.5">{msg.emoji}</span>
              )}
              {msg.text}

              {/* Event suggestions */}
              {msg.events && msg.events.length > 0 && (
                <div className="mt-2.5 space-y-2">
                  {msg.events.map((event) => (
                    <button
                      key={event.id}
                      onClick={() => onEventClick(event)}
                      className="w-full text-left bg-neutral-900/80 hover:bg-neutral-700/50 border border-neutral-700/50 hover:border-violet-700/40 rounded-xl p-2.5 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-start gap-2">
                        <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${getDotColor(event.tags)}`} />
                        <div className="min-w-0">
                          <p className="text-white text-xs font-bold truncate group-hover:text-violet-400 transition-colors">
                            {event.title}
                          </p>
                          <p className="text-neutral-500 text-[10px] truncate mt-0.5">
                            {event.venue}{event.city ? ` · ${event.city}` : ""}
                          </p>
                          <p className="text-neutral-600 text-[10px] mt-0.5">
                            {getTimeString(event)}
                            {event.price && event.price !== "$0" && (
                              <span className="ml-1.5 text-green-500/70">{event.price}</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-neutral-800 border border-neutral-700/50 rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        {/* Quick vibe buttons (only show after first bot message if no user messages yet) */}
        {messages.length === 1 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {QUICK_VIBES.map((v) => (
              <button
                key={v.label}
                onClick={() => handleSend(v.label)}
                className="px-3 py-1.5 text-xs font-mono text-neutral-400 hover:text-white bg-neutral-800/50 hover:bg-neutral-700/50 border border-neutral-700/40 hover:border-violet-700/40 rounded-full transition-colors cursor-pointer"
              >
                {v.emoji} {v.label}
              </button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-3 py-3 border-t border-neutral-800">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isTyping) handleSend(input);
            }}
            placeholder="describe the vibe..."
            className="flex-1 bg-neutral-800 text-white text-sm font-mono rounded-xl px-3.5 py-2.5 border border-neutral-700 focus:outline-none focus:border-violet-700 placeholder-neutral-600"
          />
          <button
            onClick={() => handleSend(input)}
            disabled={!input.trim() || isTyping}
            className="px-3.5 py-2.5 bg-violet-700 hover:bg-violet-600 text-white rounded-xl transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
