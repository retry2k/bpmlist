"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { EventData } from "@/types/event";
import { parseArtists } from "@/lib/artist-parser";
import { parseEventDate } from "@/lib/date-utils";

interface ArtistResult {
  query: string;
  found: boolean;
  name?: string;
  raUrl?: string | null;
  soundcloudUrl?: string | null;
  instagramUrl?: string | null;
  spotifyUrl?: string | null;
  bandcampUrl?: string | null;
  websiteUrl?: string | null;
  previewUrl?: string | null;
  topTrackName?: string | null;
}

interface ArtistDetails {
  name: string;
  bio: string | null;
  imageUrl: string | null;
  country: string | null;
  raUrl: string | null;
  soundcloudUrl: string | null;
  instagramUrl: string | null;
  bandcampUrl: string | null;
  websiteUrl: string | null;
  followers: number | null;
  aliases: string | null;
}

interface EventPanelProps {
  event: EventData;
  onClose: () => void;
  onShare?: () => void;
  isSaved?: boolean;
  onToggleSave?: (eventId: string) => void;
  allEvents?: EventData[];
  onEventClick?: (event: EventData) => void;
  onVenueClick?: (venue: string) => void;
}

// Generate .ics calendar file content
function generateICS(event: EventData): string {
  const eventDate = parseEventDate(event.date);
  if (!eventDate) return "";

  // Parse time like "9pm-2am" or "10pm"
  const timeMatch = event.time?.match(/(\d{1,2})(:\d{2})?\s*(am|pm)/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2].slice(1)) : 0;
    const ampm = timeMatch[3].toLowerCase();
    if (ampm === "pm" && hours !== 12) hours += 12;
    if (ampm === "am" && hours === 12) hours = 0;
    eventDate.setHours(hours, minutes, 0);
  } else {
    eventDate.setHours(21, 0, 0); // default 9pm
  }

  // End time: parse from time string or default +4 hours
  const endDate = new Date(eventDate);
  const endMatch = event.time?.match(/-\s*(\d{1,2})(:\d{2})?\s*(am|pm)/i);
  if (endMatch) {
    let hours = parseInt(endMatch[1]);
    const minutes = endMatch[2] ? parseInt(endMatch[2].slice(1)) : 0;
    const ampm = endMatch[3].toLowerCase();
    if (ampm === "pm" && hours !== 12) hours += 12;
    if (ampm === "am" && hours === 12) hours = 0;
    endDate.setHours(hours, minutes, 0);
    // If end time is before start time, it's the next day
    if (endDate <= eventDate) endDate.setDate(endDate.getDate() + 1);
  } else {
    endDate.setHours(endDate.getHours() + 4);
  }

  const fmt = (d: Date) => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  };

  const location = [event.venue, event.address, event.city].filter(Boolean).join(", ");
  const description = [
    event.tags.length > 0 ? `Genres: ${event.tags.join(", ")}` : "",
    event.price ? `Price: ${event.price}` : "",
    event.age || "",
    event.eventUrl ? `Details: ${event.eventUrl}` : "",
  ].filter(Boolean).join("\\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//bpmlist//EN",
    "BEGIN:VEVENT",
    `DTSTART:${fmt(eventDate)}`,
    `DTEND:${fmt(endDate)}`,
    `SUMMARY:${event.title}`,
    `LOCATION:${location}`,
    `DESCRIPTION:${description}`,
    `URL:${event.eventUrl || ""}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function downloadICS(event: EventData) {
  const ics = generateICS(event);
  if (!ics) return;
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${event.title.replace(/[^a-z0-9]/gi, "_").slice(0, 40)}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

// Check if event starts after 2am (after hours)
export function isAfterHours(event: EventData): boolean {
  const timeStr = event.time?.toLowerCase() || "";
  const match = timeStr.match(/(\d{1,2})(:\d{2})?\s*(am|pm)/i);
  if (!match) return false;
  let hours = parseInt(match[1]);
  const ampm = match[3].toLowerCase();
  if (ampm === "pm" && hours !== 12) hours += 12;
  if (ampm === "am" && hours === 12) hours = 0;
  // After hours: starts between 12am-6am (0-6) or after 11pm (23+)
  return hours >= 23 || hours <= 6;
}

// Inline artist detail component
function ArtistDetailCard({ raUrl, onClose }: { raUrl: string; onClose: () => void }) {
  const [details, setDetails] = useState<ArtistDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/artist?raUrl=${encodeURIComponent(raUrl)}`)
      .then((res) => {
        if (!res.ok) throw new Error("not found");
        return res.json();
      })
      .then((data) => {
        setDetails(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [raUrl]);

  if (loading) {
    return (
      <div className="ml-9 mr-2 mb-2 p-3 bg-neutral-800/60 rounded-lg border border-neutral-700/50">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border border-neutral-600 border-t-violet-500 rounded-full animate-spin" />
          <span className="text-neutral-500 text-xs font-mono">loading artist...</span>
        </div>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="ml-9 mr-2 mb-2 p-3 bg-neutral-800/60 rounded-lg border border-neutral-700/50">
        <div className="flex items-center justify-between">
          <span className="text-neutral-500 text-xs font-mono">artist details unavailable</span>
          <button onClick={onClose} className="text-neutral-600 hover:text-neutral-400 cursor-pointer">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ml-9 mr-2 mb-2 bg-neutral-800/60 rounded-lg border border-neutral-700/50 overflow-hidden">
      {/* Artist image + info */}
      <div className="flex gap-3 p-3">
        {details.imageUrl && (
          <div className="flex-shrink-0 w-16 h-16 rounded-md overflow-hidden bg-neutral-700">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={details.imageUrl}
              alt={details.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1">
            <div>
              <p className="text-white text-sm font-bold leading-tight">{details.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {details.country && (
                  <span className="text-neutral-500 text-[10px] font-mono">{details.country}</span>
                )}
                {details.aliases && (
                  <span className="text-neutral-600 text-[10px] font-mono italic">
                    aka {details.aliases}
                  </span>
                )}
                {details.followers && details.followers > 0 && (
                  <span className="text-neutral-600 text-[10px] font-mono">
                    {details.followers.toLocaleString()} followers
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-neutral-600 hover:text-neutral-400 cursor-pointer flex-shrink-0 mt-0.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Bio */}
      {details.bio && (
        <div className="px-3 pb-2">
          <p className="text-neutral-400 text-xs leading-relaxed">{details.bio}</p>
        </div>
      )}

      {/* Social links row */}
      <div className="flex items-center gap-1 px-3 pb-3 flex-wrap">
        {details.raUrl && (
          <a
            href={details.raUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-neutral-700/50 hover:bg-neutral-700 text-neutral-300 hover:text-white text-[10px] font-mono transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            RA
          </a>
        )}
        {details.soundcloudUrl && (
          <a
            href={details.soundcloudUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-orange-500/10 hover:bg-orange-500/20 text-orange-400/80 hover:text-orange-400 text-[10px] font-mono transition-colors"
          >
            SoundCloud
          </a>
        )}
        {details.instagramUrl && (
          <a
            href={details.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-pink-500/10 hover:bg-pink-500/20 text-pink-400/80 hover:text-pink-400 text-[10px] font-mono transition-colors"
          >
            Instagram
          </a>
        )}
        {details.bandcampUrl && (
          <a
            href={details.bandcampUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400/80 hover:text-cyan-400 text-[10px] font-mono transition-colors"
          >
            Bandcamp
          </a>
        )}
        {details.websiteUrl && (
          <a
            href={details.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-neutral-700/50 hover:bg-neutral-700 text-neutral-400 hover:text-white text-[10px] font-mono transition-colors"
          >
            Website
          </a>
        )}
      </div>
    </div>
  );
}

// Compute similar events based on shared tags
function getSimilarEvents(current: EventData, allEvents: EventData[]): EventData[] {
  if (!allEvents || allEvents.length === 0 || current.tags.length === 0) return [];
  const currentTags = new Set(current.tags.map((t) => t.toLowerCase()));
  const scored: { event: EventData; score: number; matchingTags: string[] }[] = [];

  for (const e of allEvents) {
    if (e.id === current.id) continue;
    const matchingTags = e.tags.filter((t) => currentTags.has(t.toLowerCase()));
    if (matchingTags.length === 0) continue;
    let score = matchingTags.length;
    if (e.venue.toLowerCase() === current.venue.toLowerCase()) score += 2;
    if (e.date === current.date) score += 1;
    scored.push({ event: e, score, matchingTags });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map((s) => s.event);
}

export default function EventPanel({ event, onClose, onShare, isSaved, onToggleSave, allEvents, onEventClick, onVenueClick }: EventPanelProps) {
  const [artists, setArtists] = useState<ArtistResult[]>([]);
  const [loadingArtists, setLoadingArtists] = useState(false);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [flyerUrl, setFlyerUrl] = useState<string | null>(null);
  const [expandedArtist, setExpandedArtist] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [goingCount, setGoingCount] = useState(0);
  const [isGoing, setIsGoing] = useState(false);

  const parsedArtists = parseArtists(event.title);

  // Fetch artist data + flyer when event changes
  useEffect(() => {
    setFlyerUrl(null);
    setExpandedArtist(null);

    if (parsedArtists.length === 0 && !event.eventUrl?.includes("ra.co")) {
      setArtists([]);
      return;
    }

    setLoadingArtists(true);
    const params = new URLSearchParams();
    if (event.eventUrl) params.set("eventUrl", event.eventUrl);
    if (parsedArtists.length > 0) params.set("artists", parsedArtists.join(","));

    fetch(`/api/spotify?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setArtists(data.artists || []);
        if (data.imageUrl) setFlyerUrl(data.imageUrl);
        setLoadingArtists(false);
      })
      .catch(() => {
        setLoadingArtists(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id]);

  // Fetch going count and check localStorage
  useEffect(() => {
    setGoingCount(0);
    setIsGoing(false);
    try {
      const stored = JSON.parse(localStorage.getItem("bpmlist-going") || "[]");
      if (Array.isArray(stored) && stored.includes(event.id)) {
        setIsGoing(true);
      }
    } catch { /* ignore */ }

    fetch(`/api/going?eventId=${encodeURIComponent(event.id)}`)
      .then((res) => res.json())
      .then((data) => setGoingCount(data.count || 0))
      .catch(() => {});
  }, [event.id]);

  const handleGoing = useCallback(() => {
    if (isGoing) return;
    setIsGoing(true);
    setGoingCount((c) => c + 1);
    try {
      const stored = JSON.parse(localStorage.getItem("bpmlist-going") || "[]");
      if (!stored.includes(event.id)) {
        stored.push(event.id);
        localStorage.setItem("bpmlist-going", JSON.stringify(stored));
      }
    } catch { /* ignore */ }
    fetch("/api/going", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: event.id }),
    }).catch(() => {});
  }, [event.id, isGoing]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const togglePlay = useCallback((previewUrl: string) => {
    if (playingUrl === previewUrl) {
      audioRef.current?.pause();
      setPlayingUrl(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(previewUrl);
    audio.volume = 0.5;
    audio.play().catch(() => {});
    audio.onended = () => setPlayingUrl(null);
    audioRef.current = audio;
    setPlayingUrl(previewUrl);
  }, [playingUrl]);

  // Swipe left to go back
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);

  const handleSwipeStart = useCallback((e: React.TouchEvent) => {
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
  }, []);

  const handleSwipeEnd = useCallback((e: React.TouchEvent) => {
    if (swipeStartX.current === null || swipeStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - swipeStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - swipeStartY.current);
    // Swipe right (finger moves left-to-right) with enough horizontal distance and not too vertical
    if (dx > 80 && dy < 100) {
      onClose();
    }
    swipeStartX.current = null;
    swipeStartY.current = null;
  }, [onClose]);

  const hasAnyLink = (artist: ArtistResult) =>
    artist.raUrl || artist.soundcloudUrl || artist.instagramUrl || artist.spotifyUrl || artist.bandcampUrl || artist.websiteUrl;

  const toggleArtistExpand = useCallback((artistKey: string, raUrl: string | null | undefined) => {
    // Only expand if artist has an RA URL (verified from event page)
    if (!raUrl) return;
    setExpandedArtist((prev) => (prev === artistKey ? null : artistKey));
  }, []);

  return (
    <div className="p-5 pb-32" onTouchStart={handleSwipeStart} onTouchEnd={handleSwipeEnd}>
      {/* Top bar: back + actions */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={onClose}
          className="flex items-center gap-1 text-neutral-500 hover:text-white text-xs font-mono cursor-pointer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          back to list
        </button>
        <div className="flex items-center gap-2">
          {/* Save button */}
          {onToggleSave && (
            <button
              onClick={() => onToggleSave(event.id)}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                isSaved ? "text-pink-400 hover:text-pink-300" : "text-neutral-500 hover:text-pink-400"
              }`}
              title={isSaved ? "Remove from saved" : "Save event"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
          )}
          {/* Calendar button */}
          <button
            onClick={() => downloadICS(event)}
            className="p-1.5 rounded text-neutral-500 hover:text-violet-400 transition-colors cursor-pointer"
            title="Add to calendar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <line x1="12" y1="14" x2="12" y2="18" />
              <line x1="10" y1="16" x2="14" y2="16" />
            </svg>
          </button>
          {/* Share button */}
          {onShare && (
            <button
              onClick={onShare}
              className="p-1.5 rounded text-neutral-500 hover:text-violet-400 transition-colors cursor-pointer"
              title="Share this event"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex items-start justify-between gap-2">
            <p className="text-neutral-400 text-xs font-mono uppercase tracking-wider">
              {event.date} {event.time}
            </p>
            {isAfterHours(event) && (
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-violet-700/20 text-violet-400 border border-violet-700/30 flex-shrink-0">
                AFTERS
              </span>
            )}
          </div>
          <h3 className="text-white text-lg font-bold mt-1 leading-tight">{event.title}</h3>
        </div>

        <div>
          <p className="text-neutral-300 text-sm">
            <span className="text-neutral-500">@</span>{" "}
            {onVenueClick ? (
              <button
                onClick={() => onVenueClick(event.venue)}
                className="underline underline-offset-2 hover:text-white transition-colors cursor-pointer"
              >
                {event.venue}
              </button>
            ) : (
              event.venue
            )}
            {event.city && <span className="text-neutral-500"> ({event.city})</span>}
          </p>
          {event.address && (
            <p className="text-neutral-500 text-xs mt-0.5 font-mono">{event.address}</p>
          )}
        </div>

        {event.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {event.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-neutral-800 text-neutral-300 text-xs rounded font-mono"
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
          <p className="text-neutral-400 text-xs">
            <span className="text-neutral-600">by</span> {event.organizers}
          </p>
        )}

        {/* Event page links - moved up */}
        <div className="flex flex-wrap gap-2">
          {event.eventUrl && (
            <a
              href={event.eventUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-500 hover:text-violet-400 text-xs font-mono underline underline-offset-2"
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
              className="text-violet-500 hover:text-violet-400 text-xs font-mono underline underline-offset-2"
            >
              {link.label.toLowerCase()} &rarr;
            </a>
          ))}
        </div>

        {/* Going button */}
        <button
          onClick={handleGoing}
          disabled={isGoing}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono transition-colors cursor-pointer ${
            isGoing
              ? "bg-violet-700/20 text-violet-400 border border-violet-700/30"
              : "bg-neutral-700 text-neutral-300 hover:bg-neutral-600"
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          {isGoing ? `you're going! ${goingCount} going` : `${goingCount} going`}
        </button>

        {/* Artists section */}
        {(parsedArtists.length > 0 || loadingArtists) && (
          <div className="pt-2 border-t border-neutral-800">
            <p className="text-neutral-500 text-[10px] font-mono uppercase tracking-wider mb-2">artists</p>

            {loadingArtists ? (
              <div className="flex items-center gap-2 py-2">
                <div className="w-3 h-3 border border-neutral-600 border-t-violet-500 rounded-full animate-spin" />
                <span className="text-neutral-500 text-xs font-mono">finding artists...</span>
              </div>
            ) : (
              <div className="space-y-0.5">
                {artists.map((artist, i) => {
                  const artistKey = `${artist.name || artist.query}-${i}`;
                  const isExpanded = expandedArtist === artistKey;
                  const hasRaUrl = !!artist.raUrl;

                  return (
                    <div key={i}>
                      <div className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-neutral-800/50">
                        {/* Play button */}
                        {artist.previewUrl ? (
                          <button
                            onClick={() => togglePlay(artist.previewUrl!)}
                            className="flex-shrink-0 w-7 h-7 rounded-full bg-violet-700/20 hover:bg-violet-700/40 flex items-center justify-center transition-colors cursor-pointer"
                            title={playingUrl === artist.previewUrl ? "Pause" : `Play ${artist.topTrackName || "preview"}`}
                          >
                            {playingUrl === artist.previewUrl ? (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-violet-400">
                                <rect x="6" y="4" width="4" height="16" rx="1" />
                                <rect x="14" y="4" width="4" height="16" rx="1" />
                              </svg>
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-violet-400 ml-0.5">
                                <polygon points="5,3 19,12 5,21" />
                              </svg>
                            )}
                          </button>
                        ) : (
                          <div className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${hasAnyLink(artist) ? "bg-violet-500" : "bg-neutral-600"}`} />
                        )}

                        {/* Artist name - clickable if has RA URL */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {hasRaUrl ? (
                              <button
                                onClick={() => toggleArtistExpand(artistKey, artist.raUrl)}
                                className={`text-sm transition-colors truncate text-left cursor-pointer ${
                                  isExpanded
                                    ? "text-violet-400 font-semibold"
                                    : "text-white hover:text-violet-400"
                                }`}
                                title="View artist details"
                              >
                                {artist.name || artist.query}
                              </button>
                            ) : (
                              <span className="text-neutral-300 text-sm truncate">
                                {artist.name || artist.query}
                              </span>
                            )}

                            {/* Expand indicator for artists with RA data */}
                            {hasRaUrl && (
                              <button
                                onClick={() => toggleArtistExpand(artistKey, artist.raUrl)}
                                className={`flex-shrink-0 transition-transform cursor-pointer ${
                                  isExpanded ? "rotate-90" : ""
                                }`}
                              >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-neutral-500">
                                  <polyline points="9 18 15 12 9 6" />
                                </svg>
                              </button>
                            )}

                            {/* Social icons - inline (only show when NOT expanded) */}
                            {!isExpanded && (
                              <>
                                {artist.soundcloudUrl && (
                                  <a href={artist.soundcloudUrl} target="_blank" rel="noopener noreferrer"
                                    className="flex-shrink-0 text-orange-500/70 hover:text-orange-400 transition-colors" title="SoundCloud">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.058-.05-.1-.1-.1m-.899.828c-.06 0-.091.037-.104.094L0 14.479l.172 1.282c.013.06.045.094.104.094.057 0 .09-.038.104-.094l.2-1.282-.2-1.332c-.014-.057-.047-.094-.104-.094m1.79-1.065c-.067 0-.114.053-.121.12l-.214 2.371.214 2.257c.007.067.054.12.121.12.065 0 .113-.053.12-.12l.244-2.257-.244-2.371c-.007-.067-.055-.12-.12-.12m.938-.136c-.076 0-.132.063-.137.132l-.198 2.507.198 2.345c.005.075.061.132.137.132.075 0 .13-.057.137-.132l.224-2.345-.224-2.507c-.007-.075-.062-.132-.137-.132m.938-.043c-.083 0-.145.067-.152.145l-.182 2.55.182 2.41c.007.083.069.145.152.145.082 0 .144-.062.152-.145l.207-2.41-.207-2.55c-.008-.083-.07-.145-.152-.145m1.015-.182c-.089 0-.158.075-.163.158l-.167 2.732.167 2.46c.005.09.074.158.163.158.088 0 .157-.068.163-.158l.188-2.46-.188-2.732c-.006-.089-.075-.158-.163-.158m1.097-.376c-.098 0-.173.083-.178.176l-.15 2.919.15 2.479c.005.098.08.176.178.176.097 0 .172-.078.178-.176l.17-2.479-.17-2.919c-.006-.098-.081-.176-.178-.176m1.046-.01c-.105 0-.187.09-.19.188l-.137 2.929.137 2.496c.003.105.085.188.19.188s.186-.083.19-.188l.155-2.496-.155-2.929c-.004-.105-.085-.188-.19-.188m1.13-.204c-.112 0-.2.094-.204.2l-.12 3.133.12 2.512c.004.112.092.2.204.2.11 0 .2-.088.204-.2l.136-2.512-.136-3.133c-.004-.112-.094-.2-.204-.2m1.096.135c-.12 0-.213.1-.215.213l-.107 2.998.107 2.52c.002.12.095.213.215.213.118 0 .212-.093.215-.213l.12-2.52-.12-2.998c-.003-.12-.097-.213-.215-.213m1.12-.527c-.124 0-.22.105-.222.222l-.093 3.525.093 2.524c.002.124.098.222.222.222.123 0 .22-.098.222-.222l.106-2.524-.106-3.525c-.002-.124-.099-.222-.222-.222m1.101-.093c-.132 0-.234.11-.235.232l-.08 3.618.08 2.53c.001.132.103.232.235.232.13 0 .233-.1.235-.232l.09-2.53-.09-3.618c-.002-.132-.105-.232-.235-.232m1.16-.261c-.14 0-.248.115-.249.245l-.065 3.879.065 2.533c.001.14.109.245.249.245.139 0 .247-.105.249-.245l.074-2.533-.074-3.879c-.002-.14-.11-.245-.249-.245m1.102.136c-.147 0-.261.12-.262.255l-.051 3.743.051 2.533c.001.147.115.255.262.255.146 0 .26-.108.262-.255l.058-2.533-.058-3.743c-.002-.147-.116-.255-.262-.255m1.19-.481c-.038-.01-.078-.014-.118-.014-.153 0-.278.128-.28.265l-.036 3.958.036 2.532c.002.153.127.265.28.265.152 0 .277-.112.28-.265l.04-2.532-.04-3.958c-.002-.145-.119-.26-.27-.265m.96-.164c-.16 0-.29.133-.291.278l-.024 4.122.024 2.526c.001.16.131.278.291.278.16 0 .289-.118.291-.278l.027-2.526-.027-4.122c-.002-.16-.131-.278-.291-.278m2.08.636c-.02-.163-.156-.273-.305-.273-.021 0-.04 0-.06.004-.163.02-.283.16-.283.309v.013l-.012 3.442.012 2.52c.002.163.141.285.305.285.163 0 .303-.122.305-.285l.014-2.52-.014-3.47v-.012l.037-.013zm.674-.071c-.172 0-.311.145-.312.307l.001 3.504-.001 2.517c.001.172.14.307.312.307.17 0 .31-.135.312-.307l.003-2.517-.003-3.504c-.002-.172-.142-.307-.312-.307m3.487 1.152c-.23 0-.443.04-.642.108-.134-1.506-1.4-2.682-2.942-2.682-.373 0-.735.072-1.069.199-.125.048-.158.098-.159.193v5.275c.001.1.079.182.175.19h4.637c.958 0 1.736-.784 1.736-1.748 0-.964-.778-1.535-1.736-1.535" />
                                    </svg>
                                  </a>
                                )}

                                {artist.spotifyUrl && (
                                  <a href={artist.spotifyUrl} target="_blank" rel="noopener noreferrer"
                                    className="flex-shrink-0 text-green-500/70 hover:text-green-400 transition-colors" title="Spotify">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                                    </svg>
                                  </a>
                                )}

                                {artist.instagramUrl && (
                                  <a href={artist.instagramUrl} target="_blank" rel="noopener noreferrer"
                                    className="flex-shrink-0 text-pink-500/70 hover:text-pink-400 transition-colors" title="Instagram">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                                    </svg>
                                  </a>
                                )}

                                {artist.bandcampUrl && (
                                  <a href={artist.bandcampUrl} target="_blank" rel="noopener noreferrer"
                                    className="flex-shrink-0 text-cyan-500/70 hover:text-cyan-400 transition-colors" title="Bandcamp">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M0 18.75l7.437-13.5H24l-7.438 13.5z" />
                                    </svg>
                                  </a>
                                )}
                              </>
                            )}
                          </div>
                          {artist.topTrackName && playingUrl === artist.previewUrl && (
                            <p className="text-violet-500/60 text-[10px] font-mono truncate mt-0.5">
                              ♪ {artist.topTrackName}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Expanded artist detail card */}
                      {isExpanded && artist.raUrl && (
                        <ArtistDetailCard
                          raUrl={artist.raUrl}
                          onClose={() => setExpandedArtist(null)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Event flyer image */}
        {flyerUrl && (
          <div className="rounded-lg overflow-hidden border border-neutral-800 -mx-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={flyerUrl}
              alt={event.title}
              className="w-full h-auto object-contain"
              loading="lazy"
            />
          </div>
        )}

        {/* Report wrong location */}
        {(event.address || (event.lat != null && event.lng != null)) && (
          <div className="pt-1">
            <button
              onClick={() => {
                // Clear bad venue coords from KV cache so it gets re-geocoded
                if (event.venue && event.city) {
                  fetch("/api/venue-report", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ venue: event.venue, city: event.city }),
                  }).catch(() => {});
                }
                // Open email
                const subject = encodeURIComponent(`Wrong location: ${event.title}`);
                const body = encodeURIComponent(
                  `Event: ${event.title}\nVenue: ${event.venue}\nCity: ${event.city}\nCurrent address: ${event.address || "N/A"}\nCurrent coordinates: ${event.lat ?? "N/A"}, ${event.lng ?? "N/A"}\nCorrect address: [please fill in]\n\nSent from bpmlist.com`
                );
                window.open(`mailto:bpmlists@gmail.com?subject=${subject}&body=${body}`, "_self");
              }}
              className="text-neutral-600 text-[10px] font-mono hover:text-neutral-400 transition-colors cursor-pointer"
            >
              report location
            </button>
          </div>
        )}

        {/* Similar events - always at the very bottom */}
        {allEvents && onEventClick && (() => {
          const similar = getSimilarEvents(event, allEvents);
          if (similar.length === 0) return null;
          return (
            <div className="pt-2 border-t border-neutral-800">
              <p className="text-neutral-500 text-[10px] font-mono uppercase tracking-wider mb-2">similar events</p>
              <div className="space-y-1.5">
                {similar.map((se) => {
                  const matchingTags = se.tags.filter((t) =>
                    event.tags.some((et) => et.toLowerCase() === t.toLowerCase())
                  );
                  return (
                    <button
                      key={se.id}
                      onClick={() => onEventClick(se)}
                      className="w-full text-left px-3 py-2 rounded bg-neutral-800/50 hover:bg-neutral-800 transition-colors cursor-pointer"
                    >
                      <p className="text-white text-sm font-medium truncate">{se.title}</p>
                      <p className="text-neutral-500 text-xs font-mono truncate">{se.venue} &middot; {se.date}</p>
                      {matchingTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {matchingTags.slice(0, 3).map((tag) => (
                            <span key={tag} className="px-1.5 py-0.5 bg-violet-700/20 text-violet-400 text-[10px] rounded font-mono">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
