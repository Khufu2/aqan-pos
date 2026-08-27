"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import type { CrmLead } from "../../lib/aqan";

const REGION_CENTRES: Record<string, [number, number]> = {
  arusha: [-3.3869, 36.683], dar_es_salaam: [-6.7924, 39.2083], dodoma: [-6.163, 35.7516],
  geita: [-2.8714, 32.229], iringa: [-7.77, 35.69], kagera: [-1.31, 31.8], katavi: [-6.37, 31.26],
  kigoma: [-4.88, 29.63], kilimanjaro: [-3.0674, 37.3556], lindi: [-9.9971, 39.7165], manyara: [-4.315, 36.954],
  mara: [-1.7754, 34.1532], mbeya: [-8.9094, 33.4608], morogoro: [-6.8278, 37.6591], mtwara: [-10.2736, 40.1828],
  mwanza: [-2.5164, 32.9175], njombe: [-9.334, 34.771], pwani: [-7.0, 38.92], rukwa: [-7.97, 31.62],
  ruvuma: [-10.68, 35.65], shinyanga: [-3.6618, 33.4236], simiyu: [-2.83, 34.15], singida: [-4.8163, 34.7436],
  songwe: [-9.1, 32.93], tabora: [-5.0162, 32.8266], tanga: [-5.0889, 39.1023],
  zanzibar_north: [-5.94, 39.29], zanzibar_south: [-6.26, 39.43], zanzibar_west: [-6.1659, 39.2026],
};

function locationKey(value: string | null) {
  return (value || "").toLowerCase().replace(/region|mkoa/g, "").trim().replace(/[^a-z]+/g, "_").replace(/^_|_$/g, "");
}

function hash(value: string) {
  let number = 0;
  for (let index = 0; index < value.length; index += 1) number = ((number << 5) - number + value.charCodeAt(index)) | 0;
  return Math.abs(number);
}

function positionFor(lead: CrmLead): [number, number] {
  const centre = REGION_CENTRES[locationKey(lead.region || lead.city)] || [-6.369, 34.8888];
  const seed = hash(`${lead.id}-${lead.facility_name}`);
  const angle = (seed % 360) * (Math.PI / 180);
  const distance = 0.035 + ((seed >> 8) % 100) / 300;
  return [centre[0] + Math.sin(angle) * distance, centre[1] + Math.cos(angle) * distance];
}

export default function FacilityMap({ leads, onSelect }: { leads: CrmLead[]; onSelect: (id: string) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;
    let removeLayer: () => void = () => undefined;
    void import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;
      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, { center: [-6.369, 34.8888], zoom: 6, minZoom: 5, preferCanvas: true, scrollWheelZoom: false });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(mapRef.current);
      }
      const map = mapRef.current;
      const layer = L.layerGroup().addTo(map);
      removeLayer = () => { layer.remove(); };
      leads.forEach((lead) => {
        const colour = lead.lead_status === "proposal_sent" ? "#8b5cf6" : lead.lead_status === "qualified" ? "#0f9f7a" : "#0798d2";
        const marker = L.circleMarker(positionFor(lead), { radius: 6, color: "#ffffff", weight: 2, fillColor: colour, fillOpacity: 0.88 });
        const tooltip = document.createElement("div");
        const name = document.createElement("strong");
        const location = document.createElement("small");
        name.textContent = lead.facility_name;
        location.textContent = [lead.district, lead.region || lead.city].filter(Boolean).join(" · ") || "Tanzania";
        tooltip.append(name, document.createElement("br"), location);
        marker.bindTooltip(tooltip, { direction: "top", offset: [0, -5] });
        marker.on("click", () => onSelect(lead.id));
        marker.addTo(layer);
      });
      if (leads.length && leads.length < 60) {
        const bounds = L.latLngBounds(leads.map(positionFor));
        if (bounds.isValid()) map.fitBounds(bounds.pad(0.2), { maxZoom: 9 });
      }
      setTimeout(() => map.invalidateSize(), 0);
    });
    return () => { cancelled = true; removeLayer(); };
  }, [leads, onSelect]);

  useEffect(() => () => {
    mapRef.current?.remove();
    mapRef.current = null;
  }, []);

  return <div ref={containerRef} className="facility-map-canvas" aria-label="Map of healthcare facilities in Tanzania"/>;
}
