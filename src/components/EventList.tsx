"use client";

import { EventData } from "@/types/event";

interface EventListProps {
  events: EventData[];
  onEventHover: (id: string | null) => void;
  onEventClick: (event: EventData) => void;
}

function getTagColor(tags: string[]): string {
  const tagStr = tags.join(" ").toLowerCase();
  if (/techno|industrial/.test(tagStr)) return "bg-pink-500/20 border-pink-500/40";
  if (/house|deep house|tech house|progressive/.test(tagStr)) return "bg-cyan-500/20 border-cyan-500/40";
  if (/drum|bass|dnb|jungle/.test(tagStr)) return "bg-yellow-500/20 border-yellow-500/40";
  if (/trance/.test(tagStr)) return "bg-purple-500/20 border-purple-500/40";
  if (/dubstep|bass music/.test(tagStr)) return "bg-orange-500/20 border-orange-500/40";
  return "bg-green-500/20 border-green-500/40";
}

function getDotColor(tags: string[]): string {
  const tagStr = tags.join(" ").toLowerCase();
  if (/techno|industrial/.test(tagStr)) return "bg-pink-500";
  if (/house|deep house|tech house|progressive/.test(tagStr)) return "bg-cyan-400";
  if (/drum|bass|dnb|jungle/.test(tagStr)) return "bg-yellow-400";
  if (/trance/.test(tagStr)) return "bg-purple-400";
  if (/dubstep|bass music/.test(tagStr)) return "bg-orange-400";
  return "bg-green-400";
}

export default function EventList({ events, onEventHover, onEventClick }: EventListProps) {
  return (
    <div className="space-y-1">
      {events.map((event) => (
        <div
          key={event.id}
          className={`px-3 py-2 rounded cursor-pointer transition-colors border border-transparent hover:border-zinc-700 hover:bg-zinc-800/50 ${getTagColor(event.tags).split(" ")[0]} ${getTagColor(event.tags).split(" ")[0]}`}
          onMouseEnter={() => onEventHover(event.id)}
          onMouseLeave={() => onEventHover(null)}
          onClick={() => onEventClick(event)}
        >
          <div className="flex items-start gap-2">
            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${getDotColor(event.tags)}`} />
            <div className="min-w-0">
              <p className="text-white text-sm font-medium truncate">{event.title}</p>
              <p className="text-zinc-500 text-xs font-mono truncate">
                {event.venue}{event.city ? ` · ${event.city}` : ""} · {event.date} {event.time}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
