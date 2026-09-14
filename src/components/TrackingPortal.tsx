import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Search, 
  Clock, 
  Truck, 
  Package, 
  Building2, 
  User, 
  Calendar, 
  AlertTriangle, 
  Snowflake, 
  FileCheck, 
  Layers, 
  ShieldCheck,
  AlertCircle,
  Check,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase, Shipment, ShipmentStatus, TrackingHistory } from '@/src/lib/supabase';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import TransitMap from './TransitMap';

// Standard 8-Stage Sequential FedEx Logistics Stages
export const MASTER_STAGES: ShipmentStatus[] = [
  'Shipping label created',
  'Package received by FedEx',
  'In Transit',
  'On the way',
  'Arriving at destination facility',
  'At local FedEx facility',
  'Out for Delivery',
  'Delivered'
];

export function parseTimestamp(dateStr?: string | null): Date | null {
  if (!dateStr || dateStr === '0' || dateStr === 'Pending') return null;
  let normalized = String(dateStr).trim();
  if (normalized.includes(' ') && !normalized.includes('T')) {
    normalized = normalized.replace(' ', 'T');
  }
  const date = new Date(normalized.includes('T') || normalized.includes('Z') ? normalized : normalized.replace(/-/g, '/'));
  return isNaN(date.getTime()) ? null : date;
}

export function findStageIndex(statusStr?: string | null): number {
  if (!statusStr) return -1;
  const clean = statusStr.toLowerCase().trim();

  for (let i = 0; i < MASTER_STAGES.length; i++) {
    if (clean === MASTER_STAGES[i].toLowerCase()) return i;
  }

  if (clean.includes('label created')) return 0;
  if (clean.includes('package received') || clean.includes('picked up')) return 1;
  if (clean === 'in transit') return 2;
  if (clean === 'on the way') return 3;
  if (clean.includes('arriving at destination')) return 4;
  if (clean.includes('local fedex facility') || clean.includes('local facility') || clean.includes('at local')) return 5;
  if (clean.includes('out for delivery')) return 6;
  if (clean.includes('delivered')) return 7;

  return -1;
}

export function getMilestoneForStage(stage: string, history?: TrackingHistory[] | any[] | null): any | null {
  if (!history || !Array.isArray(history)) return null;
  const targetIdx = findStageIndex(stage);

  for (const item of history) {
    const rawStatus = item.status || item.status_name || '';
    if (findStageIndex(rawStatus) === targetIdx) {
      return item;
    }
  }
  return null;
}

export default function TrackingPortal({ initialId }: { initialId?: string } = {}) {
  const [trackingId, setTrackingId] = useState('');
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [clockNow, setClockNow] = useState<Date>(() => new Date());

  // Format ID in 4-digit blocks
  const formatId = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 12);
    const groups = digits.match(/.{1,4}/g) || [];
    return groups.join(' ');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatId(e.target.value);
    setTrackingId(formatted);
  };

  const trackShipment = useCallback(async (idToTrack?: string) => {
    const rawInput = idToTrack !== undefined ? idToTrack : trackingId;
    const id = rawInput.replace(/\s/g, '');
    if (id.length !== 12) {
      if (id.length > 0 && id.length < 12) {
        setErrorStatus("Please enter a valid 12-digit tracking number.");
      }
      return;
    }

    setLoading(true);
    setHasSearched(true);

    // Keep URL parameter synchronized so link immediately brings up the shipment
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.get('id') !== id) {
          url.searchParams.set('id', id);
          window.history.replaceState({}, '', url.toString());
        }
      } catch {
        // Safe fallback in restrictive environments
      }
    }

    try {
      const { data, error } = await supabase
        .from('shipments')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('Supabase Error:', error);
        setErrorStatus("Unable to connect to database. Please try again.");
        setShipment(null);
        return;
      }

      if (!data) {
        setShipment(null);
        setErrorStatus("Tracking number not found in logistics network.");
      } else {
        setShipment(data as Shipment);
        setErrorStatus(null);
      }
    } catch (err) {
      console.error('Fetch Error:', err);
      setErrorStatus("An unexpected error occurred. Please refresh.");
      setShipment(null);
    } finally {
      setLoading(false);
    }
  }, [trackingId]);

  // Initial load: check URL parameter or initialId; default to reference tracking number so hitting the link brings up info immediately
  useEffect(() => {
    let target = '';
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get('id') || params.get('tracking') || initialId;
      if (fromUrl && fromUrl.trim().length > 0) {
        target = formatId(fromUrl);
      }
    }

    // Default tracking number if no ID in URL
    if (!target) {
      target = '7554 8775 0430';
    }

    setTrackingId(target);
    trackShipment(target);
  }, [initialId, trackShipment]);

  // Clock ticker for real-time live timestamp evaluation
  useEffect(() => {
    const interval = setInterval(() => {
      setClockNow(new Date());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Date format matching reference image: "September 11, 2026, 9:19 AM"
  const formatMilestoneDate = (dateStr?: string | null) => {
    if (!dateStr || dateStr === '0') return 'Pending';
    let normalized = String(dateStr).trim();
    if (normalized.includes(' ') && !normalized.includes('T')) {
      normalized = normalized.replace(' ', 'T');
    }
    const date = new Date(normalized.includes('T') || normalized.includes('Z') ? normalized : normalized.replace(/-/g, '/'));
    if (isNaN(date.getTime())) return dateStr;

    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }) + ', ' + date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatShortDate = (dateStr?: string | null) => {
    if (!dateStr || dateStr === '0') return 'TBD';
    let normalized = String(dateStr).trim();
    if (normalized.includes(' ') && !normalized.includes('T')) {
      normalized = normalized.replace(' ', 'T');
    }
    const date = new Date(normalized.includes('T') || normalized.includes('Z') ? normalized : normalized.replace(/-/g, '/'));
    if (isNaN(date.getTime())) return dateStr;

    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Locations
  const originLoc = shipment?.origin_city_state || shipment?.sender_address || shipment?.origin || 'FedEx Origin Hub';
  const destinationLoc = shipment?.destination_address || shipment?.receiver_address || shipment?.recipient_address || shipment?.destination || 'Destination Address';

  // Stage calculation
  const stageComputation = useMemo(() => {
    if (!shipment) {
      return {
        activeStageIndex: 0,
        activeStageName: MASTER_STAGES[0],
        isEffectiveOnHold: false,
        activeLocation: originLoc,
        activeTimestamp: null as string | null
      };
    }

    const isOnHold = Boolean(shipment.is_on_hold || shipment.status === 'On Hold');
    const nowTime = clockNow.getTime();
    const rawHistory = Array.isArray(shipment.history) ? [...shipment.history] : [];

    if (rawHistory.length > 0) {
      // Sort chronologically ascending
      rawHistory.sort((a, b) => {
        const tA = parseTimestamp(a.timestamp)?.getTime() ?? 0;
        const tB = parseTimestamp(b.timestamp)?.getTime() ?? 0;
        return tA - tB;
      });

      // Find highest milestone whose timestamp has passed (stageDate <= now)
      let activeIdx = 0;
      for (let i = 0; i < rawHistory.length; i++) {
        const itemDate = parseTimestamp(rawHistory[i].timestamp);
        if (itemDate && itemDate.getTime() <= nowTime) {
          activeIdx = i;
        }
      }

      const activeItem = rawHistory[activeIdx];
      const rawName = (activeItem?.status || (activeItem as any)?.status_name || shipment.status || 'In Transit').trim();
      const effectiveOnHold = isOnHold || rawName.toLowerCase() === 'on hold';

      return {
        activeStageIndex: activeIdx,
        activeStageName: effectiveOnHold ? 'On Hold' : rawName,
        isEffectiveOnHold: effectiveOnHold,
        activeLocation: activeItem?.location || originLoc,
        activeTimestamp: activeItem?.timestamp || null
      };
    }

    // Fallback if no history array
    const explicitIdx = findStageIndex(shipment.status);
    const validIdx = explicitIdx >= 0 ? explicitIdx : 0;
    return {
      activeStageIndex: validIdx,
      activeStageName: isOnHold ? 'On Hold' : (MASTER_STAGES[validIdx] || 'In Transit'),
      isEffectiveOnHold: isOnHold,
      activeLocation: originLoc,
      activeTimestamp: null
    };
  }, [shipment, clockNow, originLoc]);

  const { activeStageIndex, activeStageName, isEffectiveOnHold, activeLocation } = stageComputation;

  // Chronological history with strict Node UI States (COMPLETED, ACTIVE, UPCOMING) based on live time comparison
  const chronologicalHistory = useMemo(() => {
    if (!shipment) return [];

    const nowTime = clockNow.getTime();
    const isOnHold = isEffectiveOnHold;
    const rawHistory = Array.isArray(shipment.history) ? [...shipment.history] : [];

    if (rawHistory.length > 0) {
      // Sort chronologically ascending (earliest milestone first, latest last)
      rawHistory.sort((a, b) => {
        const tA = parseTimestamp(a.timestamp)?.getTime() ?? 0;
        const tB = parseTimestamp(b.timestamp)?.getTime() ?? 0;
        return tA - tB;
      });

      // Live Time Comparison: find highest milestone whose timestamp has passed
      let activeIdx = -1;
      for (let i = 0; i < rawHistory.length; i++) {
        const itemDate = parseTimestamp(rawHistory[i].timestamp);
        const hasPassed = itemDate ? itemDate.getTime() <= nowTime : (i === 0);
        if (hasPassed) {
          activeIdx = i;
        }
      }

      if (activeIdx === -1 && rawHistory.length > 0) {
        activeIdx = 0;
      }

      return rawHistory.map((item, idx) => {
        const itemDate = parseTimestamp(item.timestamp);
        const rawStatus = (item.status || (item as any).status_name || '').trim();
        const hasPassed = itemDate ? itemDate.getTime() <= nowTime : (idx <= activeIdx);

        // Determine node state:
        // COMPLETED: Stage timestamp is in the past (stageDate <= new Date() and before active)
        // ACTIVE: The highest milestone whose timestamp has passed
        // UPCOMING: Stage timestamp is strictly in the future (stageDate > new Date())
        let nodeState: 'COMPLETED' | 'ACTIVE' | 'UPCOMING';
        if (idx < activeIdx) {
          nodeState = 'COMPLETED';
        } else if (idx === activeIdx) {
          nodeState = 'ACTIVE';
        } else {
          nodeState = 'UPCOMING';
        }

        // On Hold Rule: If shipment.is_on_hold === true, replace ONLY the active stage icon with the active Orange (#FF6600) Hold badge
        const isHoldNode = (nodeState === 'ACTIVE' && isOnHold) || (rawStatus.toLowerCase() === 'on hold' && nodeState !== 'UPCOMING');

        return {
          id: `hist-${idx}`,
          title: isHoldNode ? 'On Hold' : rawStatus,
          originalTitle: rawStatus,
          location: item.location || activeLocation || originLoc,
          timestamp: item.timestamp,
          dateFormatted: formatMilestoneDate(item.timestamp),
          nodeState,
          isHold: isHoldNode,
          isActive: nodeState === 'ACTIVE',
          isCompleted: nodeState === 'COMPLETED',
          isUpcoming: nodeState === 'UPCOMING'
        };
      });
    }

    // Fallback if no history array in database: construct from MASTER_STAGES
    const targetIdx = Math.max(0, findStageIndex(shipment.status));
    return MASTER_STAGES.map((stage, idx) => {
      let nodeState: 'COMPLETED' | 'ACTIVE' | 'UPCOMING';
      if (idx < targetIdx) {
        nodeState = 'COMPLETED';
      } else if (idx === targetIdx) {
        nodeState = 'ACTIVE';
      } else {
        nodeState = 'UPCOMING';
      }

      const isHoldNode = nodeState === 'ACTIVE' && isOnHold;

      return {
        id: `stage-${idx}`,
        title: isHoldNode ? 'On Hold' : stage,
        originalTitle: stage,
        location: idx === 0 ? originLoc : destinationLoc,
        timestamp: null,
        dateFormatted: nodeState === 'UPCOMING' ? 'Upcoming' : 'Completed',
        nodeState,
        isHold: isHoldNode,
        isActive: nodeState === 'ACTIVE',
        isCompleted: nodeState === 'COMPLETED',
        isUpcoming: nodeState === 'UPCOMING'
      };
    });
  }, [shipment, isEffectiveOnHold, clockNow, originLoc, destinationLoc, activeLocation]);

  return (
    <div className="min-h-screen bg-white font-sans text-[#141414]">
      {/* Top FedEx Purple Accent Line */}
      <div className="h-2.5 bg-[#4D148C] w-full" />

      {/* Clean White Header with Centered FedEx Logo (Identical to IMG_1764 & IMG_1765) */}
      <header className="sticky top-0 bg-white border-b border-slate-100 py-3.5 px-4 z-40 flex items-center justify-center shadow-2xs">
        <div className="flex items-center select-none">
          <span className="text-3xl md:text-4xl font-black text-[#4D148C] tracking-tight">Fed</span>
          <span className="text-3xl md:text-4xl font-black text-[#FF6600] tracking-tight">Ex</span>
        </div>
      </header>

      {/* Main Single Column Container matching Mobile/Reference Frame */}
      <main className="max-w-xl md:max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* Unobtrusive Search Bar */}
        <div className="space-y-2">
          {errorStatus && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorStatus}</span>
            </div>
          )}

          <div className="flex gap-2">
            <div className="relative flex-grow">
              <Input
                id="tracking_search_input"
                name="tracking_search"
                type="search"
                autoComplete="off"
                placeholder="Enter 12-digit tracking number..."
                value={trackingId}
                onChange={handleInputChange}
                onKeyDown={(e) => e.key === 'Enter' && trackShipment()}
                className="h-11 pl-10 pr-3 bg-slate-50 border-slate-200/80 rounded-xl text-sm font-mono font-bold tracking-wider placeholder:font-sans placeholder:font-normal placeholder:tracking-normal focus-visible:ring-[#4D148C]"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
            <Button
              id="track_btn"
              onClick={() => trackShipment()}
              disabled={loading || trackingId.replace(/\s/g, '').length !== 12}
              className="h-11 px-5 bg-[#FF6600] hover:bg-[#E05A00] text-white font-bold rounded-xl text-xs shadow-xs transition-all shrink-0 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>TRACK</span>
              )}
            </Button>
          </div>
        </div>

        {shipment ? (
          <div className="space-y-4 pt-2">
            {/* Top Status & Tracking Number Bar (IMG_1765.png reference) */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FFD6A5] inline-block" />
                  <p className="text-[11px] font-bold text-[#4D148C] tracking-wider uppercase">
                    Shipment Status
                  </p>
                </div>
                <h1 className={cn(
                  "text-3xl md:text-4xl font-black tracking-tight uppercase",
                  isEffectiveOnHold ? "text-[#FF2D20]" : "text-[#4D148C]"
                )}>
                  {isEffectiveOnHold ? 'ON HOLD' : activeStageName}
                </h1>
              </div>

              <div className="text-right space-y-0.5">
                <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                  Tracking Number
                </p>
                <p className="text-lg md:text-xl font-bold font-mono tracking-wider text-slate-900">
                  {formatId(shipment.id)}
                </p>
                {shipment.service_type && (
                  <p className="text-xs font-semibold text-[#4D148C]">
                    {shipment.service_type}
                  </p>
                )}
              </div>
            </div>

            {/* Special Handling & Delivery Services (IMG_1765.png reference) */}
            {shipment.is_hold_at_location && (
              <div className="space-y-2 pt-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Special Handling & Delivery Services
                </p>
                <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#E8F8F0] border border-[#B7E8D0] text-[#0D6838] text-xs font-bold shadow-2xs">
                  <Building2 className="w-4 h-4 text-[#0D6838]" />
                  <span>Hold at FedEx OnSite Location</span>
                </div>
              </div>
            )}

            {/* Shipment Sender Card (IMG_1765.png reference) */}
            {shipment.sender_name && (
              <div className="bg-[#FBFBFC] border border-slate-200/75 rounded-2xl p-5 space-y-1 shadow-2xs">
                <div className="flex items-center gap-2 text-slate-400">
                  <Building2 className="w-4 h-4 text-[#4D148C]" />
                  <p className="text-[10px] font-bold uppercase tracking-wider">Shipment Sender</p>
                </div>
                <p className="text-base font-bold text-slate-900 pt-0.5">{shipment.sender_name}</p>
                {shipment.sender_address && (
                  <p className="text-xs text-slate-600 font-normal leading-relaxed">{shipment.sender_address}</p>
                )}
              </div>
            )}

            {/* Primary Receiver Card (IMG_1765.png reference) */}
            {shipment.recipient_name && (
              <div className="bg-[#FBFBFC] border border-slate-200/75 rounded-2xl p-5 space-y-1 shadow-2xs">
                <div className="flex items-center gap-2 text-slate-400">
                  <User className="w-4 h-4 text-[#FF6600]" />
                  <p className="text-[10px] font-bold uppercase tracking-wider">Primary Receiver</p>
                </div>
                <p className="text-base font-bold text-slate-900 pt-0.5">{shipment.recipient_name}</p>
                {shipment.destination_address && (
                  <p className="text-xs text-slate-600 font-normal leading-relaxed">{shipment.destination_address}</p>
                )}
              </div>
            )}

            {/* FedEx Package Specifications Card (IMG_1765.png reference) */}
            <div className="bg-[#FBFBFC] border border-slate-200/75 rounded-2xl p-5 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#4D148C]">
                  <Layers className="w-4 h-4" />
                  <p className="text-xs font-bold uppercase tracking-wider text-[#4D148C]">
                    FedEx Package Specifications
                  </p>
                </div>
                {shipment.service_type && (
                  <span className="bg-white border border-slate-200 text-xs font-semibold text-slate-700 px-3 py-1 rounded-lg">
                    {shipment.service_type}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Package Type</p>
                  <p className="text-sm font-bold text-slate-900">{shipment.package_type || 'FedEx Box'}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Pieces</p>
                  <p className="text-sm font-bold text-slate-900">{shipment.num_packages || 1} pkg(s)</p>
                </div>
              </div>
            </div>

            {/* Total Shipment Value Card (IMG_1765.png reference) */}
            {(shipment.asset_value || shipment.declared_value) ? (
              <div className="bg-[#FBFBFC] border border-slate-200/75 rounded-2xl p-5 space-y-1 shadow-2xs">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Shipment Value</p>
                <p className="text-xl md:text-2xl font-bold text-slate-900">
                  {shipment.currency || 'SEK'} {Number(shipment.asset_value || shipment.declared_value).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            ) : null}

            {/* Estimated Delivery Date Card */}
            {shipment.estimated_delivery_date && (
              <div className="bg-[#FBFBFC] border border-slate-200/75 rounded-2xl p-5 space-y-1 shadow-2xs">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estimated Delivery Date</p>
                <p className="text-base font-bold text-slate-900">
                  {formatShortDate(shipment.estimated_delivery_date)}
                </p>
              </div>
            )}

            {/* Interactive Route Map */}
            <div className="pt-2">
              <TransitMap
                origin={originLoc}
                currentLocation={activeLocation}
                destination={destinationLoc}
                currentStatus={isEffectiveOnHold ? 'On Hold' : activeStageName}
                routeWaypoints={shipment.route_waypoints || []}
                isOnHold={isEffectiveOnHold}
              />
            </div>

            {/* Shipment History Milestones Section (IMG_1764.png reference) */}
            <div className="pt-4 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-black tracking-wider text-[#4D148C] uppercase">
                  Shipment History Milestones
                </h3>
                <p className="text-xs font-bold text-[#4D148C] text-right">
                  Standardized FedEx Logistics Network
                </p>
              </div>

              {/* Vertical Timeline */}
              <div className="space-y-0 relative pl-1">
                {chronologicalHistory.map((item, idx) => {
                  const isLast = idx === chronologicalHistory.length - 1;
                  const nextItem = !isLast ? chronologicalHistory[idx + 1] : null;
                  const isLineCompleted = (item.isCompleted || item.isActive) && (nextItem?.isCompleted || nextItem?.isActive);

                  return (
                    <div key={item.id} className="flex gap-4 min-h-[76px] relative">
                      {/* Timeline Track & Node */}
                      <div className="flex flex-col items-center">
                        {item.isHold ? (
                          /* Active Hold Node: Orange (#FF6600) circle with white truck icon */
                          <div className="w-10 h-10 rounded-full bg-[#FF6600] flex items-center justify-center text-white shrink-0 shadow-sm z-10">
                            <Truck className="w-5 h-5 text-white" />
                          </div>
                        ) : item.isActive ? (
                          /* Active Node: Highlighted FedEx Purple icon with truck */
                          <div className="w-10 h-10 rounded-full bg-[#4D148C] text-white flex items-center justify-center shrink-0 shadow-md ring-4 ring-[#4D148C]/20 z-10">
                            <Truck className="w-5 h-5 text-white" />
                          </div>
                        ) : item.isCompleted ? (
                          /* Completed Node: Solid purple circle with white concentric dot */
                          <div className="w-9 h-9 rounded-full bg-[#4D148C] flex items-center justify-center shrink-0 z-10">
                            <div className="w-2.5 h-2.5 rounded-full bg-white" />
                          </div>
                        ) : (
                          /* Upcoming Node: Grayed-out node with light gray border & inner dot */
                          <div className="w-9 h-9 rounded-full bg-slate-50 border-2 border-slate-200 flex items-center justify-center shrink-0 z-10">
                            <div className="w-2 h-2 rounded-full bg-slate-300" />
                          </div>
                        )}

                        {/* Connecting Line */}
                        {!isLast && (
                          <div className={cn(
                            "flex-grow my-0.5",
                            isLineCompleted ? "w-[2.5px] bg-[#4D148C]" : "w-[2px] bg-slate-200"
                          )} />
                        )}
                      </div>

                      {/* Milestone Text Content */}
                      <div className="pb-6 pt-1 flex-grow space-y-0.5">
                        {item.isHold ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-base font-bold text-[#FF2D20]">
                              {item.title}
                            </p>
                            <span className="px-2 py-0.5 rounded-md bg-red-50 border border-red-200 text-[#FF2D20] text-[10px] font-bold tracking-wider uppercase">
                              ON HOLD
                            </span>
                          </div>
                        ) : item.isActive ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-base font-bold text-[#4D148C]">
                              {item.title}
                            </p>
                            <span className="px-2 py-0.5 rounded-md bg-[#4D148C]/10 border border-[#4D148C]/20 text-[#4D148C] text-[10px] font-bold tracking-wider uppercase">
                              CURRENT
                            </span>
                          </div>
                        ) : item.isCompleted ? (
                          <p className="text-base font-bold text-slate-900">
                            {item.title}
                          </p>
                        ) : (
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-base font-semibold text-slate-400">
                              {item.title}
                            </p>
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-400 text-[10px] font-bold tracking-wider uppercase">
                              UPCOMING
                            </span>
                          </div>
                        )}

                        <p className={cn(
                          "text-xs font-normal leading-relaxed",
                          item.isUpcoming ? "text-slate-400" : "text-slate-500"
                        )}>
                          {item.location} | {item.dateFormatted}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : loading ? (
          <div className="text-center py-20 space-y-4">
            <div className="w-10 h-10 border-3 border-[#4D148C] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-semibold text-[#4D148C]">Searching FedEx logistics network...</p>
          </div>
        ) : hasSearched ? (
          <div className="text-center py-20 px-4 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
              <Package className="w-7 h-7 text-slate-400" />
            </div>
            <p className="text-base font-bold text-slate-800">No Shipment Found</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No tracking information was found for this number in the database. Please verify the 12-digit tracking number and try again.
            </p>
          </div>
        ) : (
          <div className="text-center py-20 px-4 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
              <Package className="w-7 h-7 text-[#4D148C]" />
            </div>
            <p className="text-base font-bold text-slate-800">Ready to Track</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Please enter your 12-digit tracking number above and click Track to view shipment status and delivery details.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
