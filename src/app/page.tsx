"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { EventData, REGIONS, GENRE_CATEGORIES } from "@/types/event";
import { parseEventDate, isSameDay, isWithinDays } from "@/lib/date-utils";
import EventPanel from "@/components/EventPanel";
import EventList from "@/components/EventList";

const EventMap = dynamic(() => import("@/components/EventMap"), { ssr: false });

type GenreFilter = "all" | "house" | "techno" | "dnb" | "other";
type TimeFilter = "now" | "soon" | "later";

export default function Home() {
  const [regionId, setRegionId] = useState("BayArea");
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const [genreFilter, setGenreFilter] = useState<GenreFilter>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("soon");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const region = REGIONS.find((r) => r.id === regionId) || REGIONS[0];

  useEffect(() => {
    setLoading(true);
    setError(null);
    setSelectedEvent(null);

    fetch(`/api/events?region=${regionId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch events");
        return res.json();
      })
      .then((data) => {
        setEvents(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [regionId]);

  // Apply genre filter
  const genreFiltered = useMemo(() => {
    if (genreFilter === "all") return events;

    const genreKeywords = GENRE_CATEGORIES[genreFilter];
    if (genreFilter === "other") {
      const allKnownKeywords = [
        ...GENRE_CATEGORIES.house,
        ...GENRE_CATEGORIES.techno,
        ...GENRE_CATEGORIES.dnb,
      ];
      return events.filter((e) =>
        !e.tags.some((tag) =>
          allKnownKeywords.some((kw) => tag.toLowerCase().includes(kw))
        )
      );
    }

    return events.filter((e) =>
      e.tags.some((tag) =>
        genreKeywords.some((kw) => tag.toLowerCase().includes(kw))
      )
    );
  }, [events, genreFilter]);

  // Apply time filter
  const filteredEvents = useMemo(() => {
    if (timeFilter === "later") return genreFiltered;

    const today = new Date();

    return genreFiltered.filter((e) => {
      const eventDate = parseEventDate(e.date);
      if (!eventDate) return false; // recurring events only shown in "later" (handled above)

      if (timeFilter === "now") {
        return isSameDay(eventDate, today);
      }
      // "soon" = today through 7 days
      return isWithinDays(eventDate, today, 7);
    });
  }, [genreFiltered, timeFilter]);

  const mappableEvents = useMemo(
    () => filteredEvents.filter((e) => e.lat != null && e.lng != null),
    [filteredEvents]
  );

  const handleEventClick = useCallback((event: EventData) => {
    setSelectedEvent(event);
  }, []);

  const genres: { key: GenreFilter; label: string }[] = [
    { key: "all", label: "all" },
    { key: "house", label: "house" },
    { key: "techno", label: "techno" },
    { key: "dnb", label: "dnb" },
    { key: "other", label: "other" },
  ];

  const timeFilters: { key: TimeFilter; label: string }[] = [
    { key: "now", label: "now" },
    { key: "soon", label: "soon" },
    { key: "later", label: "later" },
  ];

  const listContent = loading ? (
    <div className="flex items-center justify-center py-20">
      <div className="w-5 h-5 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
    </div>
  ) : error ? (
    <p className="text-red-400 text-sm font-mono p-4">{error}</p>
  ) : filteredEvents.length === 0 ? (
    <p className="text-zinc-500 text-sm font-mono p-4">no events found</p>
  ) : (
    <EventList
      events={filteredEvents}
      onEventHover={setHoveredEventId}
      onEventClick={handleEventClick}
    />
  );

  return (
    <div className="h-screen w-screen bg-zinc-950 text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-zinc-900/80 backdrop-blur-sm border-b border-zinc-800 z-[1001] flex-shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold tracking-tight font-mono">
            bpmlist
          </h1>
          <span className="hidden sm:inline text-zinc-600 text-xs font-mono">
            find your bpm
          </span>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={regionId}
            onChange={(e) => setRegionId(e.target.value)}
            className="bg-zinc-800 text-zinc-300 text-sm rounded px-3 py-1.5 border border-zinc-700 focus:outline-none focus:border-zinc-500 font-mono cursor-pointer"
          >
            {REGIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          {/* Desktop sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden md:block text-zinc-400 hover:text-white p-1.5 rounded hover:bg-zinc-800 transition-colors cursor-pointer"
            title={sidebarOpen ? "Hide list" : "Show list"}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
        </div>
      </header>

      {/* Filters bar */}
      <div className="flex items-center gap-1 px-4 py-2 bg-zinc-900/60 border-b border-zinc-800/50 z-[1001] flex-shrink-0">
        {/* Time filters */}
        <div className="flex items-center gap-0.5 mr-2">
          {timeFilters.map((t) => (
            <button
              key={t.key}
              onClick={() => setTimeFilter(t.key)}
              className={`px-2.5 py-1 text-xs font-mono rounded transition-colors cursor-pointer ${
                timeFilter === t.key
                  ? "bg-cyan-500 text-black font-bold"
                  : "text-zinc-500 hover:text-white hover:bg-zinc-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-zinc-700 mx-1" />

        {/* Genre filters */}
        {genres.map((g) => (
          <button
            key={g.key}
            onClick={() => setGenreFilter(g.key)}
            className={`px-2.5 py-1 text-xs font-mono rounded transition-colors cursor-pointer ${
              genreFilter === g.key
                ? "bg-white text-black"
                : "text-zinc-500 hover:text-white hover:bg-zinc-800"
            }`}
          >
            {g.label}
          </button>
        ))}

        <span className="ml-auto text-zinc-600 text-xs font-mono">
          {loading ? "loading..." : `${filteredEvents.length}`}
        </span>
      </div>

      {/* Main content - horizontal on desktop, vertical on mobile */}
      <div className="flex-1 flex flex-col md:flex-row relative overflow-hidden">
        {/* Desktop Sidebar (left) */}
        {sidebarOpen && (
          <div className="hidden md:block w-80 bg-zinc-900/90 border-r border-zinc-800 overflow-y-auto flex-shrink-0 z-[999]">
            {listContent}
          </div>
        )}

        {/* Map */}
        <div className="flex-1 relative min-h-0">
          <EventMap
            events={mappableEvents}
            center={region.center}
            zoom={region.zoom}
            onEventClick={handleEventClick}
            hoveredEventId={hoveredEventId}
          />

          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 bg-zinc-950/60 flex items-center justify-center z-[500]">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-zinc-600 border-t-cyan-400 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-zinc-400 text-sm font-mono">fetching events...</p>
              </div>
            </div>
          )}
        </div>

        {/* Mobile list (bottom) */}
        <div className="md:hidden h-[45vh] bg-zinc-900/90 border-t border-zinc-800 overflow-y-auto flex-shrink-0">
          {listContent}
        </div>

        {/* Event detail panel */}
        {selectedEvent && (
          <EventPanel
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
          />
        )}
      </div>

      {/* Footer - hidden on mobile */}
      <footer className="hidden md:block px-4 py-1.5 bg-zinc-900/80 border-t border-zinc-800 z-[1001] flex-shrink-0">
        <p className="text-zinc-600 text-[10px] font-mono">
          data via{" "}
          <a href="https://19hz.info" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-zinc-300 underline underline-offset-2">
            19hz.info
          </a>
          {" "}&middot; see you on the dance floor :&#93;
        </p>
      </footer>
    </div>
  );
}
