"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import { EventData } from "@/types/event";

interface EventMapProps {
  events: EventData[];
  center: [number, number];
  zoom: number;
  onEventClick: (event: EventData) => void;
  hoveredEventId: string | null;
}

function getMarkerColor(tags: string[]): string {
  const tagStr = tags.join(" ").toLowerCase();
  if (/techno|industrial/.test(tagStr)) return "#ff3366";
  if (/house|deep house|tech house|progressive/.test(tagStr)) return "#33ccff";
  if (/drum|bass|dnb|jungle/.test(tagStr)) return "#ffcc00";
  if (/trance/.test(tagStr)) return "#cc66ff";
  if (/dubstep|bass music/.test(tagStr)) return "#ff9933";
  return "#66ff66";
}

export default function EventMap({ events, center, zoom, onEventClick, hoveredEventId }: EventMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.CircleMarker>>(new Map());
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
    }).setView(center, zoom);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update center/zoom when region changes
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setView(center, zoom);
    }
  }, [center, zoom]);

  // Update markers when events change
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear old cluster group
    if (clusterRef.current) {
      mapRef.current.removeLayer(clusterRef.current);
    }
    markersRef.current.clear();

    const cluster = L.markerClusterGroup({
      maxClusterRadius: 40,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      iconCreateFunction: (clusterObj) => {
        const count = clusterObj.getChildCount();
        const size = count < 10 ? 30 : count < 50 ? 40 : 50;
        return L.divIcon({
          html: `<div style="
            background: rgba(51, 204, 255, 0.2);
            border: 2px solid rgba(51, 204, 255, 0.6);
            border-radius: 50%;
            width: ${size}px;
            height: ${size}px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #33ccff;
            font-family: monospace;
            font-size: 12px;
            font-weight: bold;
          ">${count}</div>`,
          className: "",
          iconSize: L.point(size, size),
        });
      },
    });

    events.forEach((event) => {
      if (event.lat == null || event.lng == null) return;

      const color = getMarkerColor(event.tags);
      const marker = L.circleMarker([event.lat, event.lng], {
        radius: 6,
        fillColor: color,
        color: color,
        weight: 1,
        opacity: 0.9,
        fillOpacity: 0.8,
      });

      marker.bindTooltip(
        `<div style="font-family: monospace; font-size: 12px;">
          <strong>${event.title}</strong><br/>
          ${event.venue}${event.city ? ` (${event.city})` : ""}
        </div>`,
        {
          direction: "top",
          offset: [0, -8],
          className: "event-tooltip",
        }
      );

      marker.on("click", () => onEventClick(event));
      cluster.addLayer(marker);
      markersRef.current.set(event.id, marker);
    });

    mapRef.current.addLayer(cluster);
    clusterRef.current = cluster;
  }, [events, onEventClick]);

  // Handle hover highlighting
  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      if (id === hoveredEventId) {
        marker.setStyle({ radius: 10, weight: 3, fillOpacity: 1 });
        marker.openTooltip();
      } else {
        const event = events.find((e) => e.id === id);
        const color = event ? getMarkerColor(event.tags) : "#66ff66";
        marker.setStyle({ radius: 6, weight: 1, fillOpacity: 0.8, color, fillColor: color });
        marker.closeTooltip();
      }
    });
  }, [hoveredEventId, events]);

  return <div ref={containerRef} className="w-full h-full" />;
}
