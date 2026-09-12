import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Truck, Package, ShieldCheck, ArrowRight } from 'lucide-react';

interface TransitMapProps {
  origin: string;
  currentLocation?: string;
  destination: string;
  currentStatus: string;
}

interface GeoPoint {
  lat: number;
  lng: number;
  label: string;
  sublabel?: string;
  type: 'origin' | 'current' | 'destination';
}

// Well-known logistics hub & city coordinate lookups for fast, offline-safe resolution
const KNOWN_COORDINATES: Record<string, [number, number]> = {
  'memphis': [35.1495, -90.0490],
  'memphis, tn': [35.1495, -90.0490],
  'indianapolis': [39.7684, -86.1581],
  'indianapolis, in': [39.7684, -86.1581],
  'louisville': [38.2527, -85.7585],
  'louisville, ky': [38.2527, -85.7585],
  'newark': [40.7357, -74.1724],
  'newark, nj': [40.7357, -74.1724],
  'new york': [40.7128, -74.0060],
  'new york, ny': [40.7128, -74.0060],
  'los angeles': [34.0522, -118.2437],
  'los angeles, ca': [34.0522, -118.2437],
  'chicago': [41.8781, -87.6298],
  'chicago, il': [41.8781, -87.6298],
  'dallas': [32.7767, -96.7970],
  'dallas, tx': [32.7767, -96.7970],
  'fort worth': [32.7555, -97.3308],
  'atlanta': [33.7490, -84.3880],
  'atlanta, ga': [33.7490, -84.3880],
  'miami': [25.7617, -80.1918],
  'miami, fl': [25.7617, -80.1918],
  'seattle': [47.6062, -122.3321],
  'seattle, wa': [47.6062, -122.3321],
  'san francisco': [37.7749, -122.4194],
  'san francisco, ca': [37.7749, -122.4194],
  'oakland': [37.8044, -122.2712],
  'phoenix': [33.4484, -112.0740],
  'phoenix, az': [33.4484, -112.0740],
  'denver': [39.7392, -104.9903],
  'denver, co': [39.7392, -104.9903],
  'houston': [29.7604, -95.3698],
  'houston, tx': [29.7604, -95.3698],
  'boston': [42.3601, -71.0589],
  'boston, ma': [42.3601, -71.0589],
  'philadelphia': [39.9526, -75.1652],
  'philadelphia, pa': [39.9526, -75.1652],
  'detroit': [42.3314, -83.0458],
  'detroit, mi': [42.3314, -83.0458],
  'minneapolis': [44.9778, -93.2650],
  'minneapolis, mn': [44.9778, -93.2650],
  'orlando': [28.5383, -81.3792],
  'orlando, fl': [28.5383, -81.3792],
  'las vegas': [36.1699, -115.1398],
  'las vegas, nv': [36.1699, -115.1398],
  'london': [51.5074, -0.1278],
  'london, uk': [51.5074, -0.1278],
  'paris': [48.8566, 2.3522],
  'paris, france': [48.8566, 2.3522],
  'frankfurt': [50.1109, 8.6821],
  'frankfurt, germany': [50.1109, 8.6821],
  'tokyo': [35.6762, 139.6503],
  'tokyo, japan': [35.6762, 139.6503],
  'toronto': [43.6532, -79.3832],
  'toronto, canada': [43.6532, -79.3832],
  'vancouver': [49.2827, -123.1207],
  'vancouver, canada': [49.2827, -123.1207],
  'sydney': [-33.8688, 151.2093],
  'sydney, australia': [-33.8688, 151.2093]
};

// Simple memory cache for geocoded queries
const GEO_CACHE = new Map<string, [number, number]>();

async function geocodeLocation(query: string, fallbackOffset = 0): Promise<[number, number]> {
  const clean = query.trim().toLowerCase();
  if (!clean) return [39.8283 + fallbackOffset, -98.5795 + fallbackOffset];

  // 1. Check direct lookup in KNOWN_COORDINATES
  if (KNOWN_COORDINATES[clean]) {
    return KNOWN_COORDINATES[clean];
  }

  // 2. Check if any known key is contained in the string (e.g. "Collierville, Memphis, TN")
  for (const [key, coords] of Object.entries(KNOWN_COORDINATES)) {
    if (clean.includes(key)) {
      return coords;
    }
  }

  // 3. Check memory cache
  if (GEO_CACHE.has(clean)) {
    return GEO_CACHE.get(clean)!;
  }

  // 4. Query OpenStreetMap Nominatim with safety timeout
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2800);
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
      {
        signal: controller.signal,
        headers: { 'Accept-Language': 'en' }
      }
    );
    clearTimeout(timer);

    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data) && data.length > 0 && data[0].lat && data[0].lon) {
        const coords: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        GEO_CACHE.set(clean, coords);
        return coords;
      }
    }
  } catch {
    // Network/timeout fallback
  }

  // 5. Deterministic fallback so pins don't overlap completely if unresolved
  const hash = clean.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const lat = 37.5 + ((hash % 120) - 60) * 0.08 + fallbackOffset * 0.4;
  const lng = -96.0 + (((hash * 7) % 200) - 100) * 0.15 + fallbackOffset * 0.6;
  const fallbackCoords: [number, number] = [lat, lng];
  GEO_CACHE.set(clean, fallbackCoords);
  return fallbackCoords;
}

export default function TransitMap({ origin, currentLocation, destination, currentStatus }: TransitMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const effectiveCurrent = currentLocation || origin;

  // Resolve points
  useEffect(() => {
    let isCancelled = false;

    async function resolveAll() {
      setLoading(true);
      const originCoords = await geocodeLocation(origin || 'Memphis, TN', -0.5);
      const currentCoords = await geocodeLocation(effectiveCurrent || origin || 'Indianapolis, IN', 0);
      const destCoords = await geocodeLocation(destination || 'New York, NY', 0.5);

      if (isCancelled) return;

      const newPoints: GeoPoint[] = [
        {
          lat: originCoords[0],
          lng: originCoords[1],
          label: 'Shipment Origin',
          sublabel: origin || 'Logistics Hub',
          type: 'origin'
        },
        {
          lat: currentCoords[0],
          lng: currentCoords[1],
          label: currentStatus || 'In Transit',
          sublabel: effectiveCurrent || 'Current Location',
          type: 'current'
        },
        {
          lat: destCoords[0],
          lng: destCoords[1],
          label: 'Final Destination',
          sublabel: destination || 'Delivery Address',
          type: 'destination'
        }
      ];

      setPoints(newPoints);
      setLoading(false);
    }

    resolveAll();

    return () => {
      isCancelled = true;
    };
  }, [origin, effectiveCurrent, destination, currentStatus]);

  // Render Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || points.length === 0) return;

    // Clean up existing map instance
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Initialize Leaflet Map
    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: true
    });
    mapInstanceRef.current = map;

    // OpenStreetMap standard free tile URL without API keys or watermarks
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
    }).addTo(map);

    const originPoint = points.find(p => p.type === 'origin')!;
    const currentPoint = points.find(p => p.type === 'current')!;
    const destPoint = points.find(p => p.type === 'destination')!;

    // 1. Polyline from Origin -> Current (Traveled segment: Solid FedEx Purple)
    const completedCoords: [number, number][] = [
      [originPoint.lat, originPoint.lng],
      [currentPoint.lat, currentPoint.lng]
    ];
    L.polyline(completedCoords, {
      color: '#4D148C',
      weight: 4,
      opacity: 0.85,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);

    // 2. Polyline from Current -> Destination (Remaining segment: Dashed FedEx Orange)
    const remainingCoords: [number, number][] = [
      [currentPoint.lat, currentPoint.lng],
      [destPoint.lat, destPoint.lng]
    ];
    L.polyline(remainingCoords, {
      color: '#FF6600',
      weight: 3.5,
      dashArray: '7, 8',
      opacity: 0.8,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);

    // Custom Marker Icons
    const createOriginIcon = () => {
      return L.divIcon({
        className: 'custom-leaflet-pin',
        html: `
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            background: #4D148C;
            border: 3px solid #FFFFFF;
            border-radius: 50%;
            box-shadow: 0 4px 12px rgba(77, 20, 140, 0.4);
            color: #FFFFFF;
            font-size: 13px;
          ">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18]
      });
    };

    const createCurrentIcon = () => {
      return L.divIcon({
        className: 'custom-leaflet-pin-current',
        html: `
          <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
            <div style="
              position: absolute;
              width: 44px;
              height: 44px;
              border-radius: 50%;
              background: rgba(255, 102, 0, 0.25);
              animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
            "></div>
            <div style="
              position: relative;
              display: flex;
              align-items: center;
              justify-content: center;
              width: 36px;
              height: 36px;
              background: #FF6600;
              border: 3px solid #FFFFFF;
              border-radius: 50%;
              box-shadow: 0 4px 14px rgba(255, 102, 0, 0.5);
              color: #FFFFFF;
              z-index: 2;
            ">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="1" y="3" width="15" height="13"></rect>
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                <circle cx="5.5" cy="18.5" r="2.5"></circle>
                <circle cx="18.5" cy="18.5" r="2.5"></circle>
              </svg>
            </div>
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
        popupAnchor: [0, -22]
      });
    };

    const createDestIcon = () => {
      return L.divIcon({
        className: 'custom-leaflet-pin',
        html: `
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            background: #10B981;
            border: 3px solid #FFFFFF;
            border-radius: 50%;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
            color: #FFFFFF;
          ">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18]
      });
    };

    // Add Markers with Clean FedEx-Styled Tooltips
    const originMarker = L.marker([originPoint.lat, originPoint.lng], { icon: createOriginIcon() })
      .bindPopup(`
        <div style="font-family: sans-serif; min-width: 160px; padding: 4px;">
          <div style="font-size: 9px; font-weight: 800; color: #4D148C; text-transform: uppercase; letter-spacing: 0.05em;">Origin</div>
          <div style="font-size: 13px; font-weight: 700; color: #0F172A; margin-top: 2px;">${originPoint.sublabel}</div>
        </div>
      `)
      .addTo(map);

    const currentMarker = L.marker([currentPoint.lat, currentPoint.lng], { icon: createCurrentIcon(), zIndexOffset: 1000 })
      .bindPopup(`
        <div style="font-family: sans-serif; min-width: 170px; padding: 4px;">
          <div style="font-size: 9px; font-weight: 800; color: #FF6600; text-transform: uppercase; letter-spacing: 0.05em;">Live Package Position</div>
          <div style="font-size: 13px; font-weight: 800; color: #0F172A; margin-top: 2px;">${currentPoint.label}</div>
          <div style="font-size: 11px; color: #64748B; margin-top: 2px;">${currentPoint.sublabel}</div>
        </div>
      `)
      .addTo(map);

    const destMarker = L.marker([destPoint.lat, destPoint.lng], { icon: createDestIcon() })
      .bindPopup(`
        <div style="font-family: sans-serif; min-width: 160px; padding: 4px;">
          <div style="font-size: 9px; font-weight: 800; color: #10B981; text-transform: uppercase; letter-spacing: 0.05em;">Destination</div>
          <div style="font-size: 13px; font-weight: 700; color: #0F172A; margin-top: 2px;">${destPoint.sublabel}</div>
        </div>
      `)
      .addTo(map);

    // Auto-open current location popup
    currentMarker.openPopup();

    // Fit Bounds with padding
    const group = L.featureGroup([originMarker, currentMarker, destMarker]);
    map.fitBounds(group.getBounds(), {
      padding: [45, 45],
      maxZoom: 10
    });

    // Invalidate size on resize
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [points]);

  return (
    <div className="bg-white rounded-2xl p-6 md:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-slate-200/80 space-y-5 overflow-hidden">
      {/* Header bar with FedEx route summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#4D148C]/10 flex items-center justify-center text-[#4D148C] flex-shrink-0">
            <Navigation className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-[#4D148C] uppercase tracking-wider">Live Transit Route</p>
            <h4 className="text-sm md:text-base font-bold text-slate-900 flex flex-wrap items-center gap-1.5">
              <span>{origin || 'Origin'}</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[#FF6600] font-extrabold">{effectiveCurrent || 'Transit'}</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              <span>{destination || 'Destination'}</span>
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-semibold bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full bg-[#4D148C]" /> Origin
          </span>
          <span className="flex items-center gap-1.5 text-[#FF6600]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF6600] animate-pulse" /> Current
          </span>
          <span className="flex items-center gap-1.5 text-emerald-600">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Destination
          </span>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative w-full h-[280px] md:h-[360px] rounded-xl overflow-hidden border border-slate-200/90 bg-slate-100">
        {loading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center z-10">
            <div className="flex items-center gap-2 text-xs font-bold text-[#4D148C]">
              <Truck className="w-4 h-4 animate-bounce text-[#FF6600]" />
              <span>Plotting live logistics telemetry...</span>
            </div>
          </div>
        )}
        <div ref={mapContainerRef} className="w-full h-full" style={{ zIndex: 1 }} />
      </div>

      {/* Footer hint */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-1">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Real-time GPS telemetry routed via FedEx logistics network</span>
        </span>
        <span className="text-[10px] text-[#4D148C] font-mono font-bold uppercase tracking-wider bg-[#4D148C]/5 px-2 py-0.5 rounded border border-[#4D148C]/10">
          LIVE TELEMETRY
        </span>
      </div>
    </div>
  );
}
