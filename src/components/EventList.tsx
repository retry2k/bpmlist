"use client";

import { useMemo } from "react";
import { EventData } from "@/types/event";
import { parseEventDate, formatDateHeader } from "@/lib/date-utils";

interface EventListProps {
  events: EventData[];
  onEventHover: (id: string | null) => void;
  onEventClick: (event: EventData) => void;
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

interface DateGroup {
  label: string;
  sortKey: number;
  events: EventData[];
}

export default function EventList({ events, onEventHover, onEventClick }: EventListProps) {
  const grouped = useMemo(() => {
    const groups = new Map<string, DateGroup>();
    const recurringEvents: EventData[] = [];

    for (const event of events) {
      const date = parseEventDate(event.date);
      if (!date) {
        recurringEvents.push(event);
        continue;
      }

      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const label = formatDateHeader(date);

      if (!groups.has(key)) {
        groups.set(key, { label, sortKey: date.getTime(), events: [] });
      }
      groups.get(key)!.events.push(event);
    }

    const sorted = Array.from(groups.values()).sort((a, b) => a.sortKey - b.sortKey);

    // Add recurring at the end if any
    if (recurringEvents.length > 0) {
      sorted.push({ label: "recurring", sortKey: Infinity, events: recurringEvents });
    }

    return sorted;
  }, [events]);

  return (
    <div>
      {grouped.map((group) => (
        <div key={group.label}>
          {/* Date header */}
          <div className="sticky top-0 z-10 px-4 py-1.5 bg-neutral-950/90 backdrop-blur-sm border-b border-neutral-800/50">
            <span className="text-neutral-400 text-xs font-mono font-bold uppercase tracking-wider">
              {group.label}
            </span>
            <span className="text-neutral-600 text-xs font-mono ml-2">
              {group.events.length}
            </span>
          </div>

          {/* Events in this date */}
          <div className="space-y-0.5 py-1 px-1.5">
            {group.events.map((event) => (
              <div
                key={event.id}
                className="px-3 py-2 rounded cursor-pointer transition-colors hover:bg-neutral-800/50"
                onMouseEnter={() => onEventHover(event.id)}
                onMouseLeave={() => onEventHover(null)}
                onClick={() => onEventClick(event)}
              >
                <div className="flex items-start gap-2">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${getDotColor(event.tags)}`} />
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">{event.title}</p>
                    <p className="text-neutral-500 text-xs font-mono truncate">
                      {event.venue}{event.city ? ` · ${event.city}` : ""} · {event.time}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
