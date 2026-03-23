"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { EventData } from "@/types/event";
import { parseArtists } from "@/lib/artist-parser";

interface SpotifyArtist {
  query: string;
  found: boolean;
  name?: string;
  spotifyUrl?: string;
  imageUrl?: string | null;
  previewUrl?: string | null;
  topTrackName?: string | null;
}

interface EventPanelProps {
  event: EventData;
  onClose: () => void;
}

export default function EventPanel({ event, onClose }: EventPanelProps) {
  const [artists, setArtists] = useState<SpotifyArtist[]>([]);
  const [loadingArtists, setLoadingArtists] = useState(false);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const parsedArtists = parseArtists(event.title);

  // Fetch Spotify data when event changes
  useEffect(() => {
    if (parsedArtists.length === 0) {
      setArtists([]);
      return;
    }

    setLoadingArtists(true);
    fetch(`/api/spotify?artists=${encodeURIComponent(parsedArtists.join(","))}`)
      .then((res) => res.json())
      .then((data) => {
        setArtists(data.artists || []);
        setLoadingArtists(false);
      })
      .catch(() => {
        setLoadingArtists(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id]);

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
    // If already playing this track, stop it
    if (playingUrl === previewUrl) {
      audioRef.current?.pause();
      setPlayingUrl(null);
      return;
    }

    // Stop current track
    if (audioRef.current) {
      audioRef.current.pause();
    }

    // Play new track
    const audio = new Audio(previewUrl);
    audio.volume = 0.5;
    audio.play().catch(() => {});
    audio.onended = () => setPlayingUrl(null);
    audioRef.current = audio;
    setPlayingUrl(previewUrl);
  }, [playingUrl]);

  return (
    <div className="p-4">
      <button
        onClick={onClose}
        className="flex items-center gap-1 text-neutral-500 hover:text-white text-xs font-mono mb-3 cursor-pointer"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        back to list
      </button>

      <div className="space-y-3">
        <div>
          <p className="text-neutral-400 text-xs font-mono uppercase tracking-wider">
            {event.date} {event.time}
          </p>
          <h3 className="text-white text-lg font-bold mt-1 leading-tight">{event.title}</h3>
        </div>

        <div>
          <p className="text-neutral-300 text-sm">
            <span className="text-neutral-500">@</span> {event.venue}
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

        {/* Artists section */}
        {parsedArtists.length > 0 && (
          <div className="pt-2 border-t border-neutral-800">
            <p className="text-neutral-500 text-[10px] font-mono uppercase tracking-wider mb-2">artists</p>

            {loadingArtists ? (
              <div className="flex items-center gap-2 py-2">
                <div className="w-3 h-3 border border-neutral-600 border-t-purple-400 rounded-full animate-spin" />
                <span className="text-neutral-500 text-xs font-mono">searching spotify...</span>
              </div>
            ) : (
              <div className="space-y-1">
                {artists.map((artist, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-neutral-800/50 group"
                  >
                    {/* Play button */}
                    {artist.found && artist.previewUrl ? (
                      <button
                        onClick={() => togglePlay(artist.previewUrl!)}
                        className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-500/20 hover:bg-purple-500/40 flex items-center justify-center transition-colors cursor-pointer"
                        title={playingUrl === artist.previewUrl ? "Pause" : `Play ${artist.topTrackName || "preview"}`}
                      >
                        {playingUrl === artist.previewUrl ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-purple-300">
                            <rect x="6" y="4" width="4" height="16" rx="1" />
                            <rect x="14" y="4" width="4" height="16" rx="1" />
                          </svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-purple-300 ml-0.5">
                            <polygon points="5,3 19,12 5,21" />
                          </svg>
                        )}
                      </button>
                    ) : (
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-neutral-800 flex items-center justify-center">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-neutral-600">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M8 12h8" />
                        </svg>
                      </div>
                    )}

                    {/* Artist name + track info */}
                    <div className="min-w-0 flex-1">
                      {artist.found && artist.spotifyUrl ? (
                        <a
                          href={artist.spotifyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-white text-sm hover:text-purple-300 transition-colors block truncate"
                        >
                          {artist.name || artist.query}
                        </a>
                      ) : (
                        <span className="text-neutral-400 text-sm block truncate">
                          {artist.query}
                        </span>
                      )}
                      {artist.found && artist.topTrackName && playingUrl === artist.previewUrl && (
                        <p className="text-purple-400/60 text-[10px] font-mono truncate mt-0.5">
                          ♪ {artist.topTrackName}
                        </p>
                      )}
                    </div>

                    {/* Spotify icon link */}
                    {artist.found && artist.spotifyUrl && (
                      <a
                        href={artist.spotifyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 text-neutral-600 hover:text-green-400 transition-colors opacity-0 group-hover:opacity-100"
                        title="Open on Spotify"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                        </svg>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {event.eventUrl && (
            <a
              href={event.eventUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 text-xs font-mono underline underline-offset-2"
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
              className="text-purple-400 hover:text-purple-300 text-xs font-mono underline underline-offset-2"
            >
              {link.label.toLowerCase()} &rarr;
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
