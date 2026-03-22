"use client";

import { EventData } from "@/types/event";

interface EventPanelProps {
  event: EventData;
  onClose: () => void;
}

export default function EventPanel({ event, onClose }: EventPanelProps) {
  return (
    <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:top-4 md:bottom-auto md:w-96 bg-zinc-900/95 backdrop-blur-sm border border-zinc-700 rounded-lg p-5 z-[1000] shadow-2xl">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 text-zinc-400 hover:text-white text-xl leading-none cursor-pointer"
      >
        &times;
      </button>

      <div className="space-y-3">
        <div>
          <p className="text-zinc-400 text-xs font-mono uppercase tracking-wider">
            {event.date} {event.time}
          </p>
          <h3 className="text-white text-lg font-bold mt-1 pr-6 leading-tight">{event.title}</h3>
        </div>

        <div>
          <p className="text-zinc-300 text-sm">
            <span className="text-zinc-500">@</span> {event.venue}
            {event.city && <span className="text-zinc-500"> ({event.city})</span>}
          </p>
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
