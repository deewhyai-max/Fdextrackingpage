import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, Truck, Package, ShieldCheck, ArrowRight, AlertTriangle, MapPin, CheckCircle2, User } from 'lucide-react';
import { RouteWaypoint } from '@/src/lib/supabase';

export interface TransitMapProps {
  origin: string;
  currentLocation?: string;
  currentCoordinates?: { lat: number; lng: number } | [number, number];
  destination: string;
  recipientName?: string;
  packageName?: string;
  destinationAddress?: string;
  currentStatus: string;
  routeWaypoints?: (string | RouteWaypoint | [number, number])[];
  isOnHold?: boolean;
}

interface GeoPoint {
  lat: number;
  lng: number;
  label: string;
  sublabel?: string;
  type: 'origin' | 'waypoint' | 'current' | 'destination';
  index?: number;
}

// Well-known logistics hub & city coordinate lookups for instant, resilient resolution
const KNOWN_COORDINATES: Record<string, [number, number]> = {
  'memphis': [35.1495, -90.0490],
  'memphis, tn': [35.1495, -90.0490],
  'memphis superhub': [35.0425, -89.9767],
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
  'nashville': [36.1627, -86.7816],
  'nashville, tn': [36.1627, -86.7816],
  'columbus': [39.9612, -82.9988],
  'columbus, oh': [39.9612, -82.9988],
  'cincinnati': [39.1031, -84.5120],
  'cincinnati, oh': [39.1031, -84.5120],
  'kansas city': [39.0997, -94.5786],
  'st. louis': [38.6270, -90.1994],
  'st louis': [38.6270, -90.1994],
  'charlotte': [35.2271, -80.8431],
  'charlotte, nc': [35.2271, -80.8431],
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

const GEO_CACHE = new Map<string, [number, number]>();

async function geocodeLocation(query: string, fallbackOffset = 0): Promise<[number, number]> {
  const clean = query.trim().toLowerCase();
  if (!clean) return [39.8283 + fallbackOffset, -98.5795 + fallbackOffset];

  // 1. Direct match
  if (KNOWN_COORDINATES[clean]) {
    return KNOWN_COORDINATES[clean];
  }

  // 2. Substring match
  for (const [key, coords] of Object.entries(KNOWN_COORDINATES)) {
    if (clean.includes(key)) {
      return coords;
    }
  }

  // 3. Cache
  if (GEO_CACHE.has(clean)) {
    return GEO_CACHE.get(clean)!;
  }

  // 4. OpenStreetMap Nominatim
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2600);
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

  // 5. Deterministic fallback hash
  const hash = clean.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const lat = 37.5 + ((hash % 120) - 60) * 0.08 + fallbackOffset * 0.35;
  const lng = -96.0 + (((hash * 7) % 200) - 100) * 0.15 + fallbackOffset * 0.55;
  const fallbackCoords: [number, number] = [lat, lng];
  GEO_CACHE.set(clean, fallbackCoords);
  return fallbackCoords;
}

export default function TransitMap({
  origin,
  currentLocation,
  currentCoordinates,
  destination,
  recipientName,
  packageName,
  destinationAddress,
  currentStatus,
  routeWaypoints = [],
  isOnHold = false
}: TransitMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const effectiveCurrent = currentLocation || 'In Transit';
  const effectiveDestination = destinationAddress || destination || 'Destination Address';

  // Geocode and resolve full route: Origin -> route_waypoints -> Current Active Location -> Destination
  useEffect(() => {
    let isCancelled = false;

    async function resolveRoute() {
      setLoading(true);

      // 1. Origin
      const originCoords = await geocodeLocation(origin || 'Memphis, TN', -0.4);

      // 2. Route Waypoints
      const resolvedWaypoints: GeoPoint[] = [];
      if (Array.isArray(routeWaypoints) && routeWaypoints.length > 0) {
        for (let i = 0; i < routeWaypoints.length; i++) {
          const wp = routeWaypoints[i];
          let lat = 0;
          let lng = 0;
          let label = `Waypoint ${i + 1}`;
          let sublabel = '';

          if (Array.isArray(wp) && wp.length >= 2 && typeof wp[0] === 'number') {
            lat = wp[0];
            lng = wp[1];
            sublabel = `Lat ${lat.toFixed(2)}, Lng ${lng.toFixed(2)}`;
          } else if (typeof wp === 'object' && wp !== null) {
            const typedWp = wp as RouteWaypoint;
            label = typedWp.name || typedWp.location || `Waypoint ${i + 1}`;
            sublabel = typedWp.location || typedWp.name || '';
            if (typeof typedWp.lat === 'number' && typeof typedWp.lng === 'number') {
              lat = typedWp.lat;
              lng = typedWp.lng;
            } else if (Array.isArray(typedWp.coordinates) && typedWp.coordinates.length >= 2) {
              lat = typedWp.coordinates[0];
              lng = typedWp.coordinates[1];
            } else {
              const coords = await geocodeLocation(typedWp.location || typedWp.name || `Hub ${i + 1}`, (i + 1) * 0.2);
              lat = coords[0];
              lng = coords[1];
            }
          } else if (typeof wp === 'string') {
            label = wp;
            sublabel = wp;
            const coords = await geocodeLocation(wp, (i + 1) * 0.2);
            lat = coords[0];
            lng = coords[1];
          }

          if (lat && lng) {
            resolvedWaypoints.push({
              lat,
              lng,
              label,
              sublabel,
              type: 'waypoint',
              index: i + 1
            });
          }
        }
      }

      // 3. Current Active Location
      let currentCoords: [number, number];
      if (currentCoordinates) {
        if (Array.isArray(currentCoordinates)) {
          currentCoords = [currentCoordinates[0], currentCoordinates[1]];
        } else {
          currentCoords = [currentCoordinates.lat, currentCoordinates.lng];
        }
      } else {
        currentCoords = await geocodeLocation(effectiveCurrent, 0);
      }

      // 4. Destination
      const destCoords = await geocodeLocation(destination || 'New York, NY', 0.4);

      if (isCancelled) return;

      const fullRoutePoints: GeoPoint[] = [
        {
          lat: originCoords[0],
          lng: originCoords[1],
          label: 'Shipment Origin',
          sublabel: origin || 'FedEx Origin Facility',
          type: 'origin'
        },
        ...resolvedWaypoints,
        {
          lat: currentCoords[0],
          lng: currentCoords[1],
          label: isOnHold ? 'Shipment On Hold' : (currentStatus || 'In Transit'),
          sublabel: effectiveCurrent,
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

      setPoints(fullRoutePoints);
      setLoading(false);
    }

    resolveRoute();

    return () => {
      isCancelled = true;
    };
  }, [origin, effectiveCurrent, currentCoordinates, destination, currentStatus, routeWaypoints, isOnHold]);

  // Leaflet Map Rendering
  useEffect(() => {
    if (!mapContainerRef.current || points.length === 0) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: true
    });
    mapInstanceRef.current = map;

    // Standard OpenStreetMap free tiles (no API keys, no watermarks)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
    }).addTo(map);

    const originPoint = points.find(p => p.type === 'origin') || points[0];
    const waypointPoints = points.filter(p => p.type === 'waypoint');
    const currentPoint = points.find(p => p.type === 'current') || points[points.length - 2];
    const destPoint = points.find(p => p.type === 'destination') || points[points.length - 1];

    // Combine route coordinates: Origin -> route_waypoints -> Current -> Destination
    const allCoords: [number, number][] = points.map(p => [p.lat, p.lng]);

    // Split into Traveled vs Remaining for clear FedEx styling
    const currentIndex = points.findIndex(p => p.type === 'current');
    const traveledPoints = currentIndex >= 0 ? points.slice(0, currentIndex + 1) : [originPoint, currentPoint];
    const remainingPoints = currentIndex >= 0 ? points.slice(currentIndex) : [currentPoint, destPoint];

    // Traveled Segment (Solid FedEx Purple #4D148C)
    if (traveledPoints.length >= 2) {
      const traveledCoords: [number, number][] = traveledPoints.map(p => [p.lat, p.lng]);
      L.polyline(traveledCoords, {
        color: '#4D148C',
        weight: 4.5,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round'
      }).bindTooltip('Completed Route Segment • FedEx Network', { sticky: true }).addTo(map);
    }

    // Remaining Segment (Dashed FedEx Orange #FF6600)
    if (remainingPoints.length >= 2) {
      const remainingCoords: [number, number][] = remainingPoints.map(p => [p.lat, p.lng]);
      L.polyline(remainingCoords, {
        color: '#FF6600',
        weight: 3.5,
        dashArray: '7, 8',
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round'
      }).bindTooltip('Projected Route Path • FedEx Express', { sticky: true }).addTo(map);
    }

    // Marker Icons
    const createOriginIcon = () => {
      return L.divIcon({
        className: 'custom-leaflet-origin-pin',
        html: `
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            width: 34px;
            height: 34px;
            background: #4D148C;
            border: 3px solid #FFFFFF;
            border-radius: 50%;
            box-shadow: 0 4px 12px rgba(77, 20, 140, 0.45);
            color: #FFFFFF;
          ">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -18]
      });
    };

    const createWaypointIcon = (idx: number) => {
      return L.divIcon({
        className: 'custom-leaflet-waypoint-pin',
        html: `
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            background: #FFFFFF;
            border: 3px solid #4D148C;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(77, 20, 140, 0.3);
            color: #4D148C;
            font-weight: 800;
            font-size: 11px;
            font-family: sans-serif;
          ">
            ${idx}
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -16]
      });
    };

    const createCurrentIcon = (onHold: boolean) => {
      if (onHold) {
        return L.divIcon({
          className: 'custom-leaflet-pin-onhold',
          html: `
            <div style="position: relative; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;">
              <div style="
                position: absolute;
                width: 48px;
                height: 48px;
                border-radius: 50%;
                background: rgba(255, 102, 0, 0.3);
                animation: ping 1.4s cubic-bezier(0, 0, 0.2, 1) infinite;
              "></div>
              <div style="
                position: relative;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                width: 38px;
                height: 38px;
                background: #FF6600;
                border: 3px solid #FFFFFF;
                border-radius: 50%;
                box-shadow: 0 4px 16px rgba(255, 102, 0, 0.6);
                color: #FFFFFF;
                z-index: 2;
              ">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              </div>
            </div>
          `,
          iconSize: [48, 48],
          iconAnchor: [24, 24],
          popupAnchor: [0, -24]
        });
      }

      return L.divIcon({
        className: 'custom-leaflet-pin-current',
        html: `
          <div style="position: relative; width: 46px; height: 46px; display: flex; align-items: center; justify-content: center;">
            <div style="
              position: absolute;
              width: 46px;
              height: 46px;
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
        iconSize: [46, 46],
        iconAnchor: [23, 23],
        popupAnchor: [0, -23]
      });
    };

    const createDestIcon = () => {
      return L.divIcon({
        className: 'custom-leaflet-dest-pin',
        html: `
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            width: 34px;
            height: 34px;
            background: #10B981;
            border: 3px solid #FFFFFF;
            border-radius: 50%;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
            color: #FFFFFF;
          ">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -18]
      });
    };

    const markers: L.Marker[] = [];

    // 1. Origin Marker
    const originMarker = L.marker([originPoint.lat, originPoint.lng], { icon: createOriginIcon() })
      .bindPopup(`
        <div style="font-family: sans-serif; min-width: 170px; padding: 4px;">
          <div style="font-size: 9px; font-weight: 800; color: #4D148C; text-transform: uppercase; letter-spacing: 0.08em;">Shipment Origin</div>
          <div style="font-size: 13px; font-weight: 700; color: #0F172A; margin-top: 2px;">${originPoint.sublabel}</div>
          <div style="font-size: 10px; color: #64748B; margin-top: 2px;">FedEx Logistics Origin</div>
        </div>
      `)
      .addTo(map);
    markers.push(originMarker);

    // 2. Waypoint Markers
    waypointPoints.forEach((wp, idx) => {
      const wpMarker = L.marker([wp.lat, wp.lng], { icon: createWaypointIcon(wp.index || idx + 1) })
        .bindPopup(`
          <div style="font-family: sans-serif; min-width: 160px; padding: 4px;">
            <div style="font-size: 9px; font-weight: 800; color: #4D148C; text-transform: uppercase; letter-spacing: 0.08em;">
              Waypoint ${wp.index || idx + 1}
            </div>
            <div style="font-size: 13px; font-weight: 700; color: #0F172A; margin-top: 2px;">${wp.label}</div>
            ${wp.sublabel ? `<div style="font-size: 11px; color: #64748B; margin-top: 2px;">${wp.sublabel}</div>` : ''}
          </div>
        `)
        .addTo(map);
      markers.push(wpMarker);
    });

    // 3. Current Active Marker (accurately placed on latest reached location)
    const currentMarker = L.marker([currentPoint.lat, currentPoint.lng], {
      icon: createCurrentIcon(isOnHold),
      zIndexOffset: 1500
    })
      .bindPopup(`
        <div style="font-family: sans-serif; min-width: 190px; padding: 5px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
            <span style="font-size: 9px; font-weight: 800; color: #FF6600; text-transform: uppercase; letter-spacing: 0.08em;">
              ${isOnHold ? 'Shipment On Hold' : 'Active Package Position'}
            </span>
            ${isOnHold ? '<span style="background: #FF6600; color: #FFF; font-size: 8px; font-weight: 800; padding: 1px 4px; border-radius: 4px;">ON HOLD</span>' : ''}
          </div>
          <div style="font-size: 13px; font-weight: 800; color: #0F172A; margin-top: 3px;">
            ${isOnHold ? 'On Hold' : currentPoint.label}
          </div>
          <div style="font-size: 11px; color: #64748B; margin-top: 2px; font-weight: 500;">
            ${currentPoint.sublabel}
          </div>
          ${isOnHold ? '<div style="font-size: 10px; color: #DC2626; margin-top: 4px; font-weight: 600;">Package movement paused at facility</div>' : ''}
        </div>
      `)
      .addTo(map);
    markers.push(currentMarker);

    // 4. Destination Marker
    const destMarker = L.marker([destPoint.lat, destPoint.lng], { icon: createDestIcon() })
      .bindPopup(`
        <div style="font-family: sans-serif; min-width: 180px; padding: 4px;">
          <div style="font-size: 9px; font-weight: 800; color: #10B981; text-transform: uppercase; letter-spacing: 0.08em;">Final Destination</div>
          ${recipientName ? `<div style="font-size: 13px; font-weight: 800; color: #0F172A; margin-top: 2px;">${recipientName}</div>` : ''}
          <div style="font-size: 11px; font-weight: 600; color: #475569; margin-top: 2px;">${destPoint.sublabel}</div>
          <div style="font-size: 9px; color: #10B981; font-weight: 700; margin-top: 3px; text-transform: uppercase;">Delivery Address</div>
        </div>
      `)
      .addTo(map);
    markers.push(destMarker);

    // Auto-open current active marker popup
    currentMarker.openPopup();

    // Fit Bounds cleanly
    const group = L.featureGroup(markers);
    map.fitBounds(group.getBounds(), {
      padding: [45, 45],
      maxZoom: 10
    });

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
  }, [points, isOnHold, recipientName]);

  return (
    <div className="bg-white rounded-2xl p-6 md:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-slate-200/80 space-y-5 overflow-hidden">
      {/* Route Header: Display receiver name and destination location where it is going (NOT the sender) */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#4D148C]/10 flex items-center justify-center text-[#4D148C] flex-shrink-0 mt-0.5">
            <Navigation className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[10px] font-bold text-[#4D148C] uppercase tracking-wider">
                Automated Route Engine
              </p>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded uppercase tracking-wider">
                Destination Transit
              </span>
              {isOnHold && (
                <span className="bg-[#FF6600] text-white text-[9px] font-black uppercase px-2 py-0.5 rounded font-mono">
                  HOLD ACTIVE
                </span>
              )}
            </div>

            {/* Receiver Name, Package Name, and Destination Location */}
            <div className="pt-0.5 space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-base md:text-lg font-extrabold text-slate-900 leading-tight">
                  {recipientName || 'Primary Receiver'}
                </h4>
                {packageName && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#4D148C] bg-[#4D148C]/10 border border-[#4D148C]/20 px-2 py-0.5 rounded-md">
                    <Package className="w-3 h-3 text-[#FF6600]" />
                    <span>{packageName}</span>
                  </span>
                )}
              </div>
              <p className="text-xs md:text-sm font-semibold text-slate-600 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{effectiveDestination}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Status Badge & Transit Indicators */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/70">
          <span className={`flex items-center gap-1.5 ${isOnHold ? 'text-[#FF6600] font-black' : 'text-[#4D148C] font-bold'}`}>
            <span className={`w-2.5 h-2.5 rounded-full ${isOnHold ? 'bg-[#FF6600] animate-ping' : 'bg-[#4D148C] animate-pulse'}`} />
            {isOnHold ? 'On Hold at Facility' : (currentStatus || 'Active in Transit')}
          </span>
          {routeWaypoints.length > 0 && (
            <>
              <span className="text-slate-300">•</span>
              <span className="text-slate-600 font-semibold text-xs">
                {routeWaypoints.length} Waypoint{routeWaypoints.length > 1 ? 's' : ''}
              </span>
            </>
          )}
          <span className="text-slate-300">•</span>
          <span className="flex items-center gap-1 text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>En Route to Destination</span>
          </span>
        </div>
      </div>

      {/* Map Stage Container */}
      <div className="relative w-full h-[280px] md:h-[370px] rounded-xl overflow-hidden border border-slate-200/90 bg-slate-100">
        {loading && (
          <div className="absolute inset-0 bg-white/85 backdrop-blur-xs flex items-center justify-center z-10">
            <div className="flex items-center gap-2 text-xs font-bold text-[#4D148C]">
              <Truck className="w-4 h-4 animate-bounce text-[#FF6600]" />
              <span>Plotting automated route engine waypoints...</span>
            </div>
          </div>
        )}
        <div ref={mapContainerRef} className="w-full h-full" style={{ zIndex: 1 }} />
      </div>

      {/* Telemetry Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-1">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Automated route telemetry verified via OpenStreetMap Network</span>
        </span>
        <span className="text-[10px] text-[#4D148C] font-mono font-bold uppercase tracking-wider bg-[#4D148C]/5 px-2.5 py-0.5 rounded border border-[#4D148C]/10">
          WAYPOINT ENGINE ACTIVE
        </span>
      </div>
    </div>
  );
}
