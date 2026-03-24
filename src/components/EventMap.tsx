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
  onLocationRequest: () => void;
  userLocation: { lat: number; lng: number; label: string } | null;
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

export default function EventMap({ events, center, zoom, onEventClick, hoveredEventId, onLocationRequest, userLocation, sidebarOpen }: EventMapProps & { sidebarOpen?: boolean }) {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.CircleMarker>>(new Map());
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const onLocationRequestRef = useRef(onLocationRequest);
  onLocationRequestRef.current = onLocationRequest;

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
    }).setView(center, zoom);

    // Location button control (above zoom)
    const LocationControl = L.Control.extend({
      options: { position: "bottomright" as L.ControlPosition },
      onAdd: () => {
        const container = L.DomUtil.create("div", "leaflet-bar leaflet-control");
        const btn = L.DomUtil.create("a", "", container);
        btn.href = "#";
        btn.title = "Set your location";
        btn.role = "button";
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin:7px;">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>`;
        Object.assign(btn.style, {
          width: "30px",
          height: "30px",
          lineHeight: "30px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          backgroundColor: "#18181b",
          color: "#a1a1aa",
          borderColor: "#3f3f46",
        });
        btn.onmouseover = () => { btn.style.backgroundColor = "#27272a"; btn.style.color = "#fafafa"; };
        btn.onmouseout = () => { btn.style.backgroundColor = "#18181b"; btn.style.color = "#a1a1aa"; };

        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.on(btn, "click", (e) => {
          L.DomEvent.preventDefault(e);
          onLocationRequestRef.current();
        });

        return container;
      },
    });

    new LocationControl().addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Base layer: CARTO dark (grayscale dark map)
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

  // Handle user location marker
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove previous marker
    if (userMarkerRef.current) {
      mapRef.current.removeLayer(userMarkerRef.current);
      userMarkerRef.current = null;
    }

    if (userLocation) {
      const icon = L.divIcon({
        html: `<div class="user-location-marker"></div>`,
        className: "",
        iconSize: L.point(24, 24),
        iconAnchor: L.point(12, 12),
      });

      const marker = L.marker([userLocation.lat, userLocation.lng], { icon, zIndexOffset: 1000 });
      marker.bindTooltip(
        `<div style="font-family: monospace; font-size: 12px;"><strong>You are here</strong><br/>${userLocation.label}</div>`,
        { direction: "top", offset: [0, -14], className: "event-tooltip" }
      );
      marker.addTo(mapRef.current);
      userMarkerRef.current = marker;
    }
  }, [userLocation]);

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

  // Invalidate map size when sidebar toggles
  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current?.invalidateSize();
      }, 50);
    }
  }, [sidebarOpen]);

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
