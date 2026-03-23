"use client";

import { EventData } from "@/types/event";

interface EventPanelProps {
  event: EventData;
  onClose: () => void;
}

export default function EventPanel({ event, onClose }: EventPanelProps) {
  return (
    <div className="p-4">
      <button
        onClick={onClose}
        className="flex items-center gap-1 text-zinc-500 hover:text-white text-xs font-mono mb-3 cursor-pointer"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        back to list
      </button>

      <div className="space-y-3">
        <div>
          <p className="text-zinc-400 text-xs font-mono uppercase tracking-wider">
            {event.date} {event.time}
          </p>
          <h3 className="text-white text-lg font-bold mt-1 leading-tight">{event.title}</h3>
        </div>

        <div>
          <p className="text-zinc-300 text-sm">
            <span className="text-zinc-500">@</span> {event.venue}
            {event.city && <span className="text-zinc-500"> ({event.city})</span>}
          </p>
          {event.address && (
            <p className="text-zinc-500 text-xs mt-0.5 font-mono">{event.address}</p>
          )}
        </div>

        {event.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {event.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-zinc-800 text-zinc-300 text-xs rounded font-mono"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-4 text-sm">
          {event.price && (
            <span className="text-emerald-400 font-mono">{event.price}</span>
          )}
          {event.age && (
            <span className="text-amber-400 font-mono">{event.age}</span>
          )}
        </div>

        {event.organizers && (
          <p className="text-zinc-400 text-xs">
            <span className="text-zinc-600">by</span> {event.organizers}
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {event.eventUrl && (
            <a
              href={event.eventUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 text-xs font-mono underline underline-offset-2"
            >
              event page &rarr;
            </a>
          )}
          {event.links.map((link, i) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 text-xs font-mono underline underline-offset-2"
            >
              {link.label.toLowerCase()} &rarr;
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
