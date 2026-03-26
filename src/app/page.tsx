"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { EventData, REGIONS, GENRE_CATEGORIES, DROPDOWN_GENRE_TAGS } from "@/types/event";
import { parseEventDate, isSameDay, isWithinDays } from "@/lib/date-utils";
import EventPanel, { isAfterHours } from "@/components/EventPanel";
import EventList from "@/components/EventList";
import VibeChat from "@/components/VibeChat";

const EventMap = dynamic(() => import("@/components/EventMap"), { ssr: false });

type TimeFilter = "now" | "later" | "afters" | "saved";

// Quick-filter genre keys (shown as buttons)
const QUICK_GENRES = ["all", "house", "techno", "bass", "trance", "dnb"] as const;
type QuickGenre = (typeof QUICK_GENRES)[number];

// Find closest region to a lat/lng, optionally using city/region name as hint
function findClosestRegion(lat: number, lng: number, cityHint?: string, regionHint?: string): string {
  // Try matching by city/region name first (more reliable than IP geolocation coords)
  if (cityHint || regionHint) {
    const hint = `${cityHint || ""} ${regionHint || ""}`.toLowerCase();
    const CITY_TO_REGION: Record<string, string> = {
      "new york": "NYC", "brooklyn": "NYC", "manhattan": "NYC", "queens": "NYC", "bronx": "NYC",
      "los angeles": "LosAngeles", "hollywood": "LosAngeles", "santa monica": "LosAngeles",
      "san francisco": "BayArea", "oakland": "BayArea", "berkeley": "BayArea", "san jose": "BayArea",
      "chicago": "CHI", "detroit": "Detroit", "seattle": "Seattle", "miami": "Miami",
      "fort lauderdale": "Miami", "atlanta": "Atlanta", "denver": "Denver", "boulder": "Denver",
      "boston": "Massachusetts", "cambridge": "Massachusetts",
      "portland": "ORE", "las vegas": "LasVegas", "phoenix": "Phoenix", "scottsdale": "Phoenix",
      "toronto": "Toronto", "vancouver": "BC", "montreal": "Montreal",
      "washington": "DC", "arlington": "DC", "alexandria": "DC",
      "philadelphia": "Philadelphia", "minneapolis": "Minneapolis", "st paul": "Minneapolis",
      "nashville": "Nashville", "new orleans": "NewOrleans", "san diego": "SanDiego",
      "orlando": "Orlando", "charlotte": "Charlotte", "pittsburgh": "Pittsburgh",
      "houston": "Texas", "dallas": "Texas", "austin": "Texas", "san antonio": "Texas",
    };
    for (const [name, regionId] of Object.entries(CITY_TO_REGION)) {
      if (hint.includes(name)) return regionId;
    }
  }

  // Fallback: closest by coordinates (with latitude-adjusted longitude)
  let closest = REGIONS[0].id;
  let minDist = Infinity;
  const cosLat = Math.cos(lat * Math.PI / 180);
  for (const r of REGIONS) {
    const dlat = lat - r.center[0];
    const dlng = (lng - r.center[1]) * cosLat;
    const dist = dlat * dlat + dlng * dlng;
    if (dist < minDist) {
      minDist = dist;
      closest = r.id;
    }
  }
  return closest;
}

// Read initial state from URL params or stored home region
function getInitialParams(): { region: string; eventId: string | null; needsDetection: boolean } {
  if (typeof window === "undefined") return { region: "BayArea", eventId: null, needsDetection: false };
  const params = new URLSearchParams(window.location.search);
  const urlRegion = params.get("region");
  const storedHome = localStorage.getItem("bpmlist-home-region");
  return {
    region: urlRegion || storedHome || "BayArea",
    eventId: params.get("event") || null,
    needsDetection: !urlRegion && !storedHome,
  };
}

export default function Home() {
  const initialParams = useRef(getInitialParams());
  const [regionId, setRegionId] = useState(initialParams.current.region);
  const [homeRegion, setHomeRegion] = useState(initialParams.current.region);
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const [genreFilter, setGenreFilter] = useState<string>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("now");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [locationInput, setLocationInput] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [genreDropdownOpen, setGenreDropdownOpen] = useState(false);
  const [shareToast, setShareToast] = useState(false);
  const [vibeChatOpen, setVibeChatOpen] = useState(false);
  const [savedEventIds, setSavedEventIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [mobileListExpanded, setMobileListExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef<number | null>(null);
  const dragCurrentY = useRef<number | null>(null);
  const [venueFilter, setVenueFilter] = useState<string | null>(null);
  const [regionPickerOpen, setRegionPickerOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const pendingEventId = useRef<string | null>(initialParams.current.eventId);

  // Load saved events from localStorage
  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem("bpmlist-saved-events");
      if (saved) setSavedEventIds(new Set(JSON.parse(saved)));
    } catch { /* ignore */ }
  }, []);

  const toggleSaveEvent = useCallback((eventId: string) => {
    setSavedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      localStorage.setItem("bpmlist-saved-events", JSON.stringify([...next]));
      return next;
    });
  }, []);

  // Auto-detect user's closest region on first visit
  useEffect(() => {
    if (!initialParams.current.needsDetection) return;

    const setDetectedRegion = (regionId: string) => {
      localStorage.setItem("bpmlist-home-region", regionId);
      setHomeRegion(regionId);
      setRegionId(regionId);
    };

    // Try browser geolocation first (most accurate, works in in-app browsers)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const closest = findClosestRegion(position.coords.latitude, position.coords.longitude);
          setDetectedRegion(closest);
        },
        () => {
          // User denied or timed out — fall back to IP-based detection
          fetch("/api/geo", { signal: AbortSignal.timeout(8000) })
            .then((res) => res.json())
            .then((data) => {
              if (data.latitude && data.longitude) {
                const closest = findClosestRegion(data.latitude, data.longitude, data.city, data.region);
                setDetectedRegion(closest);
              }
            })
            .catch(() => {});
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
      );
    } else {
      // No geolocation API — fall back to IP
      fetch("/api/geo", { signal: AbortSignal.timeout(8000) })
        .then((res) => res.json())
        .then((data) => {
          if (data.latitude && data.longitude) {
            const closest = findClosestRegion(data.latitude, data.longitude, data.city, data.region);
            setDetectedRegion(closest);
          }
        })
        .catch(() => {});
    }
  }, []);

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
    setVenueFilter(null);

    // Fetch from 19hz, Ticketmaster, and RA in parallel
    const fetch19hz = fetch(`/api/events?region=${regionId}`)
      .then((res) => (res.ok ? res.json() : []))
      .catch(() => []);

    const fetchTm = fetch(`/api/ticketmaster?region=${regionId}`)
      .then((res) => (res.ok ? res.json() : []))
      .catch(() => []);

    const fetchRa = fetch(`/api/ra?region=${regionId}`)
      .then((res) => (res.ok ? res.json() : []))
      .catch(() => []);

    Promise.all([fetch19hz, fetchTm, fetchRa])
      .then(([hzEvents, tmEvents, raEvents]) => {
        // Tag 19hz events with source
        const tagged19hz = (hzEvents as EventData[]).map((e) => ({ ...e, source: "19hz" as const }));

        // Deduplicate: remove TM events that match a 19hz event (same venue + similar date)
        const hzKeys = new Set(
          tagged19hz.map((e) =>
            `${e.venue.toLowerCase().substring(0, 20)}|${e.date}`
          )
        );
        const uniqueTm = (tmEvents as EventData[]).filter((e) => {
          const key = `${e.venue.toLowerCase().substring(0, 20)}|${e.date}`;
          return !hzKeys.has(key);
        });

        // Deduplicate: remove RA events that match an existing 19hz or TM event (same venue substring + same date)
        const existingKeys = new Set([
          ...tagged19hz.map((e) => `${e.venue.toLowerCase().substring(0, 20)}|${e.date}`),
          ...uniqueTm.map((e) => `${e.venue.toLowerCase().substring(0, 20)}|${e.date}`),
        ]);
        const uniqueRa = (raEvents as EventData[]).filter((e) => {
          const key = `${e.venue.toLowerCase().substring(0, 20)}|${e.date}`;
          return !existingKeys.has(key);
        });

        const merged = [...tagged19hz, ...uniqueTm, ...uniqueRa];
        setEvents(merged);
        setLoading(false);

        // Auto-select event from URL param on initial load
        if (pendingEventId.current) {
          const found = merged.find((e: EventData) => e.id === pendingEventId.current);
          if (found) {
            setSelectedEvent(found);
            setTimeFilter("later");
          }
          pendingEventId.current = null;
        }
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

    if (timeFilter === "saved") {
      return genreFiltered.filter((e) => savedEventIds.has(e.id));
    }

    if (timeFilter === "afters") {
      return genreFiltered.filter((e) => isAfterHours(e));
    }

    return genreFiltered.filter((e) => {
      const eventDate = parseEventDate(e.date);
      if (!eventDate) return timeFilter === "later";

      if (timeFilter === "now") {
        // "now" = today through end of this Sunday
        const endOfWeek = new Date(today);
        const dayOfWeek = today.getDay(); // 0=Sun, 6=Sat
        const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
        endOfWeek.setDate(today.getDate() + daysUntilSunday);
        endOfWeek.setHours(23, 59, 59, 999);
        const startOfToday = new Date(today);
        startOfToday.setHours(0, 0, 0, 0);
        return eventDate >= startOfToday && eventDate <= endOfWeek;
      }
      // "later" = everything after this week
      const endOfWeek = new Date(today);
      const dayOfWeek = today.getDay();
      const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
      endOfWeek.setDate(today.getDate() + daysUntilSunday);
      endOfWeek.setHours(23, 59, 59, 999);
      return eventDate > endOfWeek;
    });
  }, [genreFiltered, timeFilter, savedEventIds]);

  // Apply venue filter
  const venueFilteredEvents = useMemo(() => {
    if (!venueFilter) return filteredEvents;
    const lowerVenue = venueFilter.toLowerCase();
    return filteredEvents.filter((e) => e.venue.toLowerCase().includes(lowerVenue));
  }, [filteredEvents, venueFilter]);

  // Apply search query filter
  const searchFilteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return venueFilteredEvents;
    const q = searchQuery.toLowerCase().trim();
    return venueFilteredEvents.filter((e) =>
      e.title.toLowerCase().includes(q) ||
      e.venue.toLowerCase().includes(q) ||
      e.tags.some((t) => t.toLowerCase().includes(q)) ||
      (e.organizers && e.organizers.toLowerCase().includes(q))
    );
  }, [venueFilteredEvents, searchQuery]);

  const mappableEvents = useMemo(
    () => searchFilteredEvents.filter((e) => e.lat != null && e.lng != null),
    [searchFilteredEvents]
  );

  const handleEventClick = useCallback((event: EventData) => {
    setSelectedEvent(event);
    setMobileListExpanded(true);
    // Update URL with event and region for sharing
    const url = new URL(window.location.href);
    url.searchParams.set("region", regionId);
    url.searchParams.set("event", event.id);
    window.history.replaceState({}, "", url.toString());
  }, [regionId]);

  const handleVenueClick = useCallback((venue: string) => {
    setSelectedEvent(null);
    setVenueFilter(venue);
  }, []);

  const handleGeolocation = useCallback(() => {
    if (!navigator.geolocation) {
      // Fallback to manual input if geolocation not supported
      setLocationModalOpen(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude, label: "You" });
        // Find and switch to closest region
        const closest = findClosestRegion(latitude, longitude);
        setRegionId(closest);
        localStorage.setItem("bpmlist-home-region", closest);
      },
      () => {
        // User denied or error — fall back to manual input
        setLocationModalOpen(true);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const timeFilters: { key: TimeFilter; label: string; icon?: string }[] = [
    { key: "now", label: "now" },
    { key: "later", label: "later" },
    { key: "afters", label: "afters" },
    { key: "saved", label: "♡" },
  ];

  // Check if current genreFilter is a custom dropdown selection (not a quick button)
  const isCustomGenre = genreFilter !== "all" && !GENRE_CATEGORIES[genreFilter];

  // Clear event from URL when closing panel
  const handleCloseEvent = useCallback(() => {
    setSelectedEvent(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("event");
    window.history.replaceState({}, "", url.toString());
  }, []);

  // Share current event URL
  const handleShare = useCallback(async () => {
    if (!selectedEvent) return;
    const url = new URL(window.location.href);
    url.searchParams.set("region", regionId);
    url.searchParams.set("event", selectedEvent.id);
    const shareUrl = url.toString();

    // Try native share API first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: selectedEvent.title,
          text: `${selectedEvent.title} @ ${selectedEvent.venue} - ${selectedEvent.date}`,
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled or not supported, fall through to clipboard
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2000);
    } catch {
      // ignore
    }
  }, [selectedEvent, regionId]);

  // Shared sidebar/list content
  const panelContent = selectedEvent ? (
    <EventPanel
      event={selectedEvent}
      onClose={handleCloseEvent}
      onShare={handleShare}
      isSaved={savedEventIds.has(selectedEvent.id)}
      onToggleSave={toggleSaveEvent}
      allEvents={events}
      onEventClick={handleEventClick}
      onVenueClick={handleVenueClick}
    />
  ) : loading ? (
    <div className="flex items-center justify-center py-20">
      <div className="w-5 h-5 border-2 border-neutral-600 border-t-white rounded-full animate-spin" />
    </div>
  ) : error ? (
    <p className="text-red-400 text-sm font-mono p-4">{error}</p>
  ) : searchFilteredEvents.length === 0 ? (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {timeFilter === "saved" ? (
        <>
          <span className="text-2xl text-neutral-600 mb-2">♡</span>
          <p className="text-neutral-500 text-sm font-mono">your favorited events will show here</p>
          <p className="text-neutral-600 text-xs font-mono mt-1">tap the heart on any event to save it</p>
        </>
      ) : (
        <p className="text-neutral-500 text-sm font-mono">no events found</p>
      )}
    </div>
  ) : (
    <>
      {venueFilter && (
        <div className="flex items-center gap-2 px-4 py-2 bg-neutral-800/50 border-b border-neutral-800/50">
          <span className="text-neutral-300 text-xs font-mono truncate">@ {venueFilter}</span>
          <button
            onClick={() => setVenueFilter(null)}
            className="flex-shrink-0 text-neutral-500 hover:text-white cursor-pointer"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
      <EventList
        events={searchFilteredEvents}
        onEventHover={setHoveredEventId}
        onEventClick={handleEventClick}
      />
    </>
  );

  // Time filter buttons (reused in desktop bar and mobile)
  const timeFilterButtons = (
    <div className="flex items-center gap-1">
      {timeFilters.map((t) => (
        <button
          key={t.key}
          onClick={() => { setTimeFilter(t.key); setSelectedEvent(null); }}
          className={`${t.key === "saved" ? "px-4 py-1.5 text-xl ml-5" : "px-3.5 py-1.5 text-sm"} font-mono rounded-md transition-colors cursor-pointer ${
            timeFilter === t.key
              ? t.key === "saved" ? "bg-pink-500/20 text-pink-300 font-bold border border-pink-500/30"
              : t.key === "afters" ? "bg-violet-700/20 text-violet-400 font-bold border border-violet-700/30"
              : "bg-violet-700 text-white font-bold"
              : "text-neutral-500 hover:text-white hover:bg-neutral-800"
          }`}
          title={t.key === "saved" ? `Saved events (${savedEventIds.size})` : t.key === "afters" ? "After hours (starts after 11pm)" : undefined}
        >
          {t.key === "saved" && savedEventIds.size > 0
            ? `♡ ${savedEventIds.size}`
            : t.label}
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

  // Genre color map matching dot colors on map/list
  const genreColors: Record<string, { active: string; dot: string }> = {
    all: { active: "bg-violet-700/20 text-violet-400 border border-violet-700/30", dot: "" },
    house: { active: "bg-cyan-400/20 text-cyan-300 border border-cyan-400/30", dot: "bg-cyan-400" },
    techno: { active: "bg-pink-500/20 text-pink-300 border border-pink-500/30", dot: "bg-pink-500" },
    bass: { active: "bg-orange-400/20 text-orange-300 border border-orange-400/30", dot: "bg-orange-400" },
    trance: { active: "bg-violet-500/20 text-violet-400 border border-violet-500/30", dot: "bg-violet-500" },
    dnb: { active: "bg-yellow-400/20 text-yellow-300 border border-yellow-400/30", dot: "bg-yellow-400" },
  };

  // Genre filter buttons + dropdown (reused in desktop bar and mobile)
  const genreFilterButtons = (compact: boolean = false) => (
    <div className="flex items-center gap-1.5 relative">
      {QUICK_GENRES.map((g) => {
        const colors = genreColors[g] || genreColors.all;
        return (
          <button
            key={g}
            onClick={() => { setGenreFilter(g); setSelectedEvent(null); setGenreDropdownOpen(false); }}
            className={`${compact ? "px-2 py-1 text-xs" : "px-2.5 py-1.5 text-xs"} font-mono rounded transition-colors cursor-pointer flex items-center gap-1.5 ${
              genreFilter === g
                ? `${colors.active} font-bold`
                : "text-neutral-500 hover:text-white hover:bg-neutral-800"
            }`}
          >
            {g !== "all" && (
              <span className={`w-1.5 h-1.5 rounded-full ${colors.dot} ${genreFilter === g ? "opacity-100" : "opacity-40"}`} />
            )}
            {g}
          </button>
        );
      })}

      {/* + dropdown button */}
      <div className="relative">
        <button
          onClick={() => setGenreDropdownOpen(!genreDropdownOpen)}
          className={`${compact ? "px-2.5 py-1 text-sm" : "px-3 py-1.5 text-sm"} font-mono rounded transition-colors cursor-pointer font-bold ${
            isCustomGenre
              ? "bg-violet-700/20 text-violet-400 border border-violet-700/30"
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
          <div className="w-8 h-8 border-2 border-neutral-600 border-t-violet-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-neutral-400 text-sm font-mono">loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-neutral-950 text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-neutral-900/90 backdrop-blur-sm border-b border-neutral-800 z-[1001] flex-shrink-0">
        <div className="flex items-end gap-1.5">
          <h1
            className="text-xl font-black tracking-tighter cursor-pointer leading-none"
            onClick={() => {
              setSelectedEvent(null);
              setGenreFilter("all");
              setTimeFilter("now");
              setRegionId(homeRegion);
              setVenueFilter(null);
              const url = new URL(window.location.href);
              url.searchParams.delete("event");
              url.searchParams.delete("region");
              window.history.replaceState({}, "", url.pathname);
            }}
          >
            bpm<span className="text-violet-500">list</span>
          </h1>
          <span className="hidden md:inline text-neutral-600 text-[8px] font-mono leading-none mb-[2px]">
            powered by <a href="https://19hz.info" target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-neutral-400 underline-offset-2">19hz</a>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Desktop: full dropdown */}
          <select
            value={regionId}
            onChange={(e) => setRegionId(e.target.value)}
            className="hidden md:block bg-neutral-800 text-neutral-300 text-sm rounded px-3 py-1.5 border border-neutral-700 focus:outline-none focus:border-neutral-500 font-mono cursor-pointer"
          >
            {REGIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          {/* Mobile: location icon that opens picker */}
          <button
            onClick={() => setRegionPickerOpen(true)}
            className="md:hidden flex items-center gap-1.5 text-neutral-400 hover:text-white px-2 py-1.5 rounded hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Change region"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span className="text-xs font-mono">{REGIONS.find(r => r.id === regionId)?.name || regionId}</span>
          </button>

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
          {/* Floating search box - bottom left of map */}
          <div className="absolute bottom-3 left-3 z-[1000] w-56 md:w-60">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="search artists, venue or genre"
                className="w-full bg-neutral-900/80 backdrop-blur-md text-white text-xs font-mono rounded-md pl-3 pr-7 py-2 border border-violet-500/40 focus:outline-none focus:border-violet-500/70 placeholder-neutral-500 shadow-lg"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 cursor-pointer">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              )}
            </div>
          </div>

          <EventMap
            events={mappableEvents}
            center={region.center}
            zoom={region.zoom}
            onEventClick={handleEventClick}
            hoveredEventId={hoveredEventId}
            onLocationRequest={() => handleGeolocation()}
            userLocation={userLocation}
            selectedEvent={selectedEvent}
            sidebarOpen={sidebarOpen}
          />

          {loading && (
            <div className="absolute inset-0 bg-neutral-950/60 flex items-center justify-center z-[500]">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-neutral-600 border-t-violet-500 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-neutral-400 text-sm font-mono">fetching events...</p>
              </div>
            </div>
          )}
        </div>

        {/* Mobile list area */}
        <div
          className={`md:hidden flex flex-col bg-neutral-900/90 border-t border-neutral-800 flex-shrink-0 transition-[height] duration-300 ease-out ${
            mobileListExpanded ? "h-[80vh]" : "h-[45vh]"
          }`}
        >
          {/* Mobile filters */}
          <div className="flex flex-col gap-1 px-3 pb-1 border-b border-neutral-800/50 flex-shrink-0">
            {/* Draggable top row - entire row is drag target */}
            <div
              className="relative flex items-center -mt-1 select-none"
              onTouchStart={(e) => {
                dragStartY.current = e.touches[0].clientY;
                dragCurrentY.current = e.touches[0].clientY;
                setIsDragging(true);
              }}
              onTouchMove={(e) => {
                if (dragStartY.current === null) return;
                e.preventDefault();
                dragCurrentY.current = e.touches[0].clientY;
                const delta = dragStartY.current - dragCurrentY.current;
                if (delta > 40 && !mobileListExpanded) setMobileListExpanded(true);
                else if (delta < -40 && mobileListExpanded) setMobileListExpanded(false);
              }}
              onTouchEnd={() => {
                dragStartY.current = null;
                dragCurrentY.current = null;
                setIsDragging(false);
              }}
            >
              {timeFilterButtons}
              {/* Drag handle arrow centered */}
              <div
                className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center px-4 py-2 cursor-grab active:cursor-grabbing"
                onClick={() => setMobileListExpanded(!mobileListExpanded)}
              >
                <svg
                  width="28"
                  height="10"
                  viewBox="0 0 28 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className={`text-neutral-500 transition-transform ${mobileListExpanded ? "rotate-180" : ""}`}
                >
                  <polyline points="4 8 14 3 24 8" />
                </svg>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                {genreFilterButtons(true)}
              </div>
              <button onClick={() => setAboutOpen(true)} className="text-neutral-600 hover:text-neutral-400 transition-colors flex-shrink-0 cursor-pointer" title="About">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0" style={{ WebkitOverflowScrolling: "touch" }}>
            {panelContent}
          </div>
        </div>
      </div>


      {/* Footer - desktop */}
      <footer className="hidden md:flex items-center justify-between px-4 py-1.5 bg-neutral-900/90 border-t border-neutral-800 z-[1001] flex-shrink-0">
        <p className="text-neutral-600 text-[10px] font-mono">
          powered by{" "}
          <a href="https://19hz.info" target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-neutral-300 underline underline-offset-2">
            19hz.info
          </a>
          {" "}&middot;{" "}
          <a href="https://ticketmaster.com" target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-neutral-300 underline underline-offset-2">
            ticketmaster
          </a>
          {" "}&middot;{" "}
          <a href="https://ra.co" target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-neutral-300 underline underline-offset-2">
            ra
          </a>
          {" "}&middot; say yes to the afters
        </p>
        <button
          onClick={() => setAboutOpen(true)}
          className="text-neutral-600 text-[10px] font-mono hover:text-neutral-400 underline underline-offset-2 cursor-pointer"
        >
          about
        </button>
      </footer>

      {/* Share toast */}
      {shareToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[3000] bg-violet-700 text-white text-xs font-mono px-4 py-2 rounded-lg shadow-lg animate-fade-in">
          link copied to clipboard
        </div>
      )}

      {/* Vibe Chat */}
      {vibeChatOpen ? (
        <VibeChat
          events={events}
          onEventClick={(event) => {
            handleEventClick(event);
            setVibeChatOpen(false);
          }}
          onClose={() => setVibeChatOpen(false)}
        />
      ) : (
        <button
          onClick={() => setVibeChatOpen(true)}
          className="fixed bottom-4 right-4 z-[1999] w-12 h-12 bg-violet-700 hover:bg-violet-600 text-white rounded-full shadow-lg shadow-violet-900/50 flex items-center justify-center transition-all hover:scale-110 cursor-pointer md:bottom-6 md:right-6"
          title="Vibe check — find events by mood"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {/* About modal */}
      {aboutOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setAboutOpen(false)}>
          <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-6 w-72 shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-black tracking-tighter mb-3">
              bpm<span className="text-violet-500">list</span>
            </h2>
            <p className="text-neutral-400 text-xs font-mono leading-relaxed mb-4">
              created to satisfy your need to just get out and dance.
            </p>
            <div className="text-neutral-500 text-[10px] font-mono space-y-2">
              <p>
                contact:{" "}
                <a href="mailto:bpmlists@gmail.com" className="text-violet-400 hover:text-violet-300 underline underline-offset-2">
                  bpmlists@gmail.com
                </a>
              </p>
              <p>
                powered by{" "}
                <a href="https://19hz.info" target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-neutral-300 underline underline-offset-2">19hz</a>
                {" "}&middot;{" "}
                <a href="https://ticketmaster.com" target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-neutral-300 underline underline-offset-2">ticketmaster</a>
                {" "}&middot;{" "}
                <a href="https://ra.co" target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-neutral-300 underline underline-offset-2">ra</a>
              </p>
            </div>
            <button
              onClick={() => setAboutOpen(false)}
              className="mt-5 text-neutral-600 text-xs font-mono hover:text-neutral-400 cursor-pointer"
            >
              close
            </button>
          </div>
        </div>
      )}

      {/* Mobile region picker */}
      {regionPickerOpen && (
        <div className="fixed inset-0 z-[2000] flex items-end bg-black/60 backdrop-blur-sm" onClick={() => setRegionPickerOpen(false)}>
          <div className="w-full bg-neutral-900 border-t border-neutral-700 rounded-t-2xl p-4 pb-8 max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-neutral-600 rounded-full mx-auto mb-4" />
            <h3 className="text-white text-sm font-mono font-bold mb-3 px-1">select region</h3>
            <div className="grid grid-cols-2 gap-2">
              {REGIONS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => { setRegionId(r.id); setRegionPickerOpen(false); }}
                  className={`text-left px-3 py-2.5 rounded-lg text-sm font-mono transition-colors cursor-pointer ${
                    regionId === r.id
                      ? "bg-violet-700 text-white"
                      : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                  }`}
                >
                  {r.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

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
              className="w-full bg-neutral-800 text-white text-sm font-mono rounded px-3 py-2 border border-neutral-600 focus:outline-none focus:border-violet-700 placeholder-neutral-500"
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
                className="flex-1 px-3 py-1.5 text-xs font-mono text-white bg-violet-700 hover:bg-violet-500 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-bold"
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
