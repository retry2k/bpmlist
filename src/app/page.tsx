"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { EventData, REGIONS, GENRE_CATEGORIES, DROPDOWN_GENRE_TAGS } from "@/types/event";
import { parseEventDate, isSameDay, isWithinDays } from "@/lib/date-utils";
import EventPanel from "@/components/EventPanel";
import EventList from "@/components/EventList";

const EventMap = dynamic(() => import("@/components/EventMap"), { ssr: false });

type TimeFilter = "now" | "soon" | "later";

// Quick-filter genre keys (shown as buttons)
const QUICK_GENRES = ["all", "house", "techno", "bass", "trance", "dnb"] as const;
type QuickGenre = (typeof QUICK_GENRES)[number];

export default function Home() {
  const [regionId, setRegionId] = useState("BayArea");
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const [genreFilter, setGenreFilter] = useState<string>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("soon");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [locationInput, setLocationInput] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [genreDropdownOpen, setGenreDropdownOpen] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleLocationSubmit = useCallback(() => {
    if (!locationInput.trim()) return;
    setLocationLoading(true);
    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationInput)}&format=json&limit=1`, {
      headers: { "User-Agent": "bpmlist/1.0" },
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data || data.length === 0) {
          setLocationLoading(false);
          return;
        }
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        const label = data[0].display_name.split(",").slice(0, 2).join(",");
        setUserLocation({ lat, lng, label });
        setLocationModalOpen(false);
        setLocationInput("");
        setLocationLoading(false);
      })
      .catch(() => {
        setLocationLoading(false);
      });
  }, [locationInput]);

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

    // Check if it's a quick-filter group (house, techno, bass, trance, dnb)
    const groupKeywords = GENRE_CATEGORIES[genreFilter];
    if (groupKeywords) {
      return events.filter((e) =>
        e.tags.some((tag) =>
          groupKeywords.some((kw) => tag.toLowerCase().includes(kw))
        )
      );
    }

    // Individual tag from dropdown - includes match
    const filterLower = genreFilter.toLowerCase();
    return events.filter((e) =>
      e.tags.some((tag) => tag.toLowerCase().includes(filterLower))
    );
  }, [events, genreFilter]);

  // Apply time filter
  const filteredEvents = useMemo(() => {
    const today = new Date();

    return genreFiltered.filter((e) => {
      const eventDate = parseEventDate(e.date);
      if (!eventDate) return timeFilter === "later";

      if (timeFilter === "now") {
        return isSameDay(eventDate, today);
      }
      if (timeFilter === "soon") {
        return !isSameDay(eventDate, today) && isWithinDays(eventDate, today, 7);
      }
      return !isSameDay(eventDate, today);
    });
  }, [genreFiltered, timeFilter]);

  const mappableEvents = useMemo(
    () => filteredEvents.filter((e) => e.lat != null && e.lng != null),
    [filteredEvents]
  );

  const handleEventClick = useCallback((event: EventData) => {
    setSelectedEvent(event);
  }, []);

  const timeFilters: { key: TimeFilter; label: string }[] = [
    { key: "now", label: "now" },
    { key: "soon", label: "soon" },
    { key: "later", label: "later" },
  ];

  // Check if current genreFilter is a custom dropdown selection (not a quick button)
  const isCustomGenre = genreFilter !== "all" && !GENRE_CATEGORIES[genreFilter];

  // Shared sidebar/list content
  const panelContent = selectedEvent ? (
    <EventPanel
      event={selectedEvent}
      onClose={() => setSelectedEvent(null)}
    />
  ) : loading ? (
    <div className="flex items-center justify-center py-20">
      <div className="w-5 h-5 border-2 border-neutral-600 border-t-white rounded-full animate-spin" />
    </div>
  ) : error ? (
    <p className="text-red-400 text-sm font-mono p-4">{error}</p>
  ) : filteredEvents.length === 0 ? (
    <p className="text-neutral-500 text-sm font-mono p-4">no events found</p>
  ) : (
    <EventList
      events={filteredEvents}
      onEventHover={setHoveredEventId}
      onEventClick={handleEventClick}
    />
  );

  // Time filter buttons (reused in desktop bar and mobile)
  const timeFilterButtons = (
    <div className="flex items-center gap-1">
      {timeFilters.map((t) => (
        <button
          key={t.key}
          onClick={() => { setTimeFilter(t.key); setSelectedEvent(null); }}
          className={`px-3.5 py-1.5 text-sm font-mono rounded-md transition-colors cursor-pointer ${
            timeFilter === t.key
              ? "bg-purple-500 text-white font-bold"
              : "text-neutral-500 hover:text-white hover:bg-neutral-800"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );

  // Handle selecting a genre from the dropdown
  const handleDropdownSelect = useCallback((tag: string) => {
    setGenreFilter(tag);
    setSelectedEvent(null);
    setGenreDropdownOpen(false);
  }, []);

  // Genre filter buttons + dropdown (reused in desktop bar and mobile)
  const genreFilterButtons = (compact: boolean = false) => (
    <div className="flex items-center gap-1.5 relative">
      {QUICK_GENRES.map((g) => (
        <button
          key={g}
          onClick={() => { setGenreFilter(g); setSelectedEvent(null); setGenreDropdownOpen(false); }}
          className={`${compact ? "px-2 py-1 text-xs" : "px-2.5 py-1.5 text-xs"} font-mono rounded transition-colors cursor-pointer ${
            genreFilter === g
              ? "bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30"
              : "text-neutral-500 hover:text-white hover:bg-neutral-800"
          }`}
        >
          {g}
        </button>
      ))}

      {/* + dropdown button */}
      <div className="relative">
        <button
          onClick={() => setGenreDropdownOpen(!genreDropdownOpen)}
          className={`${compact ? "px-2.5 py-1 text-sm" : "px-3 py-1.5 text-sm"} font-mono rounded transition-colors cursor-pointer font-bold ${
            isCustomGenre
              ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
              : "text-neutral-400 hover:text-white hover:bg-neutral-800"
          }`}
          title="More genres"
        >
          {isCustomGenre ? genreFilter : "+"}
        </button>

        {genreDropdownOpen && (
          <>
            {/* Backdrop to close dropdown on outside click */}
            <div
              className="fixed inset-0 z-[1999]"
              onClick={() => setGenreDropdownOpen(false)}
            />
            <div className="absolute top-full right-0 mt-1 w-48 bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl z-[2000] py-1">
              {DROPDOWN_GENRE_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleDropdownSelect(tag)}
                  className={`w-full text-left px-3 py-2 text-xs font-mono transition-colors cursor-pointer ${
                    genreFilter === tag
                      ? "bg-neutral-700 text-white font-bold"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-800"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );

  if (!mounted) {
    return (
      <div className="h-screen w-screen bg-neutral-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-neutral-600 border-t-purple-400 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-neutral-400 text-sm font-mono">loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-neutral-950 text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-neutral-900/90 backdrop-blur-sm border-b border-neutral-800 z-[1001] flex-shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-black tracking-tighter">
            bpm<span className="text-purple-500">list</span>
          </h1>
          <span className="hidden sm:inline text-neutral-500 text-xs font-mono">
            find your bpm
          </span>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={regionId}
            onChange={(e) => setRegionId(e.target.value)}
            className="bg-neutral-800 text-neutral-300 text-sm rounded px-3 py-1.5 border border-neutral-700 focus:outline-none focus:border-neutral-500 font-mono cursor-pointer"
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
            className="hidden md:block text-neutral-400 hover:text-white p-1.5 rounded hover:bg-neutral-800 transition-colors cursor-pointer"
            title={sidebarOpen ? "Hide list" : "Show list"}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
        </div>
      </header>

      {/* Filters bar - desktop only */}
      <div className="hidden md:flex items-center gap-1.5 px-4 py-2 bg-neutral-900/60 border-b border-neutral-800/50 z-[1001] flex-shrink-0">
        {timeFilterButtons}

        <div className="w-px h-5 bg-neutral-700 mx-1.5" />

        {genreFilterButtons()}

        <span className="ml-auto text-neutral-500 text-xs font-mono">
          {loading ? "loading..." : `${filteredEvents.length}`}
        </span>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col md:flex-row relative overflow-hidden">
        {/* Desktop Sidebar */}
        {sidebarOpen && (
          <div className="hidden md:block w-80 bg-neutral-900/90 border-r border-neutral-800 overflow-y-auto overscroll-contain flex-shrink-0 z-[999]">
            {panelContent}
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
            onLocationRequest={() => setLocationModalOpen(true)}
            userLocation={userLocation}
            sidebarOpen={sidebarOpen}
          />

          {loading && (
            <div className="absolute inset-0 bg-neutral-950/60 flex items-center justify-center z-[500]">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-neutral-600 border-t-purple-400 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-neutral-400 text-sm font-mono">fetching events...</p>
              </div>
            </div>
          )}
        </div>

        {/* Mobile list area */}
        <div className="md:hidden flex flex-col h-[45vh] bg-neutral-900/90 border-t border-neutral-800 flex-shrink-0">
          {/* Mobile filters */}
          <div className="flex flex-col gap-1.5 px-3 py-2 border-b border-neutral-800/50 flex-shrink-0">
            <div className="flex items-center justify-between">
              {timeFilterButtons}
              <span className="text-neutral-600 text-xs font-mono">
                {loading ? "..." : `${filteredEvents.length}`}
              </span>
            </div>
            <div className="flex items-center">
              {genreFilterButtons(true)}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain">
            {panelContent}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="hidden md:block px-4 py-1.5 bg-neutral-900/90 border-t border-neutral-800 z-[1001] flex-shrink-0">
        <p className="text-neutral-600 text-[10px] font-mono">
          data via{" "}
          <a href="https://19hz.info" target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-neutral-300 underline underline-offset-2">
            19hz.info
          </a>
          {" "}&middot; say yes to the afters
        </p>
      </footer>

      {/* Location input modal */}
      {locationModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-5 w-80 shadow-2xl">
            <h3 className="text-white text-sm font-mono font-bold mb-3">Set your location</h3>
            <input
              type="text"
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleLocationSubmit(); }}
              placeholder="Enter address or city..."
              autoFocus
              className="w-full bg-neutral-800 text-white text-sm font-mono rounded px-3 py-2 border border-neutral-600 focus:outline-none focus:border-purple-500 placeholder-neutral-500"
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { setLocationModalOpen(false); setLocationInput(""); }}
                className="flex-1 px-3 py-1.5 text-xs font-mono text-neutral-400 hover:text-white bg-neutral-800 rounded border border-neutral-700 cursor-pointer"
              >
                cancel
              </button>
              <button
                onClick={handleLocationSubmit}
                disabled={locationLoading || !locationInput.trim()}
                className="flex-1 px-3 py-1.5 text-xs font-mono text-white bg-purple-500 hover:bg-purple-400 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-bold"
              >
                {locationLoading ? "finding..." : "find me"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
