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
  ArrowRight,
  Share2
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
  const [copiedLink, setCopiedLink] = useState(false);

  // Format ID in 4-digit blocks
  const formatId = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 12);
    const groups = digits.match(/.{1,4}/g) || [];
    return groups.join(' ');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatId(e.target.value);
    setTrackingId(formatted);
    if (errorStatus) setErrorStatus(null);
  };

  // Core Supabase fetch function: queries Supabase using sanitized tracking ID
  const fetchShipmentData = useCallback(async (trackingNumber: string) => {
    const cleanDigits = trackingNumber.replace(/[\s-]/g, '').trim();
    if (cleanDigits.length !== 12) {
      if (cleanDigits.length > 0) {
        setErrorStatus("Please enter a valid 12-digit tracking number.");
      }
      return;
    }

    setLoading(true);
    setHasSearched(true);
    setErrorStatus(null);

    try {
      const { data, error } = await supabase
        .from('shipments')
        .select('*')
        .eq('id', cleanDigits)
        .maybeSingle();

      if (error) {
        console.error('Supabase Error:', error);
        setErrorStatus("Unable to connect to database. Please check your connection and try again.");
        setShipment(null);
        return;
      }

      if (!data) {
        setShipment(null);
        setErrorStatus(`No shipment record found for tracking number ${formatId(cleanDigits)}.`);
      } else {
        setShipment(data as Shipment);
        setErrorStatus(null);
      }
    } catch (err) {
      console.error('Fetch Error:', err);
      setErrorStatus("Connection error. Please verify your network and try again.");
      setShipment(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Requirement 1: Dynamic URL Update on Tracking Search
  // When a user submits a tracking search (or selects a shipment), clean the tracking number (sanitize spaces/dashes)
  // and update the browser address bar without reloading the page using window.history.pushState
  const trackShipment = useCallback((idToTrack?: string) => {
    const trackingNumber = idToTrack !== undefined ? idToTrack : trackingId;
    const cleanDigits = trackingNumber.replace(/[\s-]/g, '').trim();

    if (cleanDigits.length !== 12) {
      if (cleanDigits.length > 0) {
        setErrorStatus("Please enter a valid 12-digit tracking number.");
      }
      return;
    }

    // Clean tracking number & update browser address bar without reloading page
    const cleanId = trackingNumber.trim();
    if (typeof window !== 'undefined') {
      try {
        const newUrl = `${window.location.pathname}?id=${encodeURIComponent(cleanId)}`;
        const currentUrl = `${window.location.pathname}${window.location.search}`;
        if (currentUrl !== newUrl) {
          window.history.pushState({ path: newUrl }, '', newUrl);
        }
      } catch (err) {
        console.warn('URL pushState error:', err);
      }
    }

    fetchShipmentData(cleanDigits);
  }, [trackingId, fetchShipmentData]);

  // Requirement 2: Automatic Search on Page Load (Deep Linking)
  // When the page initialises, check for the id query parameter in window.location.search:
  // If sharedTrackingId exists:
  // - Populate the search input field with sharedTrackingId.
  // - Automatically trigger the Supabase tracking fetch function immediately.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const sharedTrackingId = urlParams.get('id') || urlParams.get('tracking');

    if (sharedTrackingId && sharedTrackingId.trim().length > 0) {
      const rawTrimmed = sharedTrackingId.trim();
      const cleanDigits = rawTrimmed.replace(/[\s-]/g, '');
      const formattedInput = cleanDigits.length === 12 ? formatId(cleanDigits) : rawTrimmed;

      setTrackingId(formattedInput);
      fetchShipmentData(cleanDigits);
    } else if (initialId && initialId.trim().length > 0) {
      const rawTrimmed = initialId.trim();
      const cleanDigits = rawTrimmed.replace(/[\s-]/g, '');
      const formattedInput = cleanDigits.length === 12 ? formatId(cleanDigits) : rawTrimmed;

      setTrackingId(formattedInput);
      if (cleanDigits.length === 12) {
        fetchShipmentData(cleanDigits);
      }
    } else {
      // Clean slate: leave empty waiting for user to enter tracking number
      setTrackingId('');
      setShipment(null);
      setHasSearched(false);
      setErrorStatus(null);
    }
  }, [initialId, fetchShipmentData]);

  // Browser Navigation Listener (PopState: Back/Forward buttons in browser history)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const sharedTrackingId = urlParams.get('id') || urlParams.get('tracking');
      if (sharedTrackingId && sharedTrackingId.trim().length > 0) {
        const rawTrimmed = sharedTrackingId.trim();
        const cleanDigits = rawTrimmed.replace(/[\s-]/g, '');
        const formattedInput = cleanDigits.length === 12 ? formatId(cleanDigits) : rawTrimmed;
        setTrackingId(formattedInput);
        if (cleanDigits.length === 12) {
          fetchShipmentData(cleanDigits);
        }
      } else {
        // Reset to initial empty state on navigating back to root
        setTrackingId('');
        setShipment(null);
        setHasSearched(false);
        setErrorStatus(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [fetchShipmentData]);

  const handleCopyShareLink = () => {
    if (typeof window === 'undefined' || !shipment) return;
    const cleanId = formatId(shipment.id);
    const shareUrl = `${window.location.origin}${window.location.pathname}?id=${encodeURIComponent(cleanId)}`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      }).catch(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      });
    }
  };

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

  const formatCurrency = (amount?: number | string | null, currencyStr?: string | null) => {
    if (amount === undefined || amount === null || amount === '') return null;
    const num = Number(amount);
    if (isNaN(num)) return null;
    const rawCurrency = (currencyStr || 'USD').trim().toUpperCase();
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: rawCurrency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(num);
    } catch {
      return `${rawCurrency} ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  };

  // Locations
  const originLoc = shipment?.origin_city_state || shipment?.sender_address || shipment?.origin || 'FedEx Origin Hub';
  const destinationLoc = shipment?.destination_address || shipment?.receiver_address || shipment?.recipient_address || shipment?.destination || 'Destination Address';

  // Array Deduplication, Sequential Order (1 to 8), Single Active Hold Node, and Strict Completed vs. Upcoming
  const processedStagesData = useMemo(() => {
    if (!shipment) {
      return {
        activeStageIndex: 0,
        activeStageName: MASTER_STAGES[0],
        isEffectiveOnHold: false,
        activeLocation: originLoc,
        activeTimestamp: null as string | null,
        stages: []
      };
    }

    const isShipmentOnHold = Boolean(
      shipment.is_on_hold ||
      (typeof shipment.status === 'string' && shipment.status.toLowerCase() === 'on hold')
    );

    const rawHistory = Array.isArray(shipment.history) ? [...shipment.history] : [];

    // 1. Separate standalone hold entries from standard stages
    const holdEntries: any[] = [];
    const standardEntries: any[] = [];
    rawHistory.forEach(item => {
      const rawName = (item.status || (item as any).status_name || '').trim();
      if (rawName.toLowerCase() === 'on hold') {
        holdEntries.push(item);
      } else {
        standardEntries.push(item);
      }
    });

    const effectiveOnHold = isShipmentOnHold || holdEntries.length > 0;

    // 2. Array Deduplication: filter out duplicate status nodes (keep only the latest entry per unique stage index)
    const stageMap = new Map<number, any>();
    standardEntries.forEach(item => {
      const rawName = (item.status || (item as any).status_name || '').trim();
      const stageIdx = findStageIndex(rawName);
      if (stageIdx >= 0 && stageIdx < MASTER_STAGES.length) {
        const existing = stageMap.get(stageIdx);
        if (!existing) {
          stageMap.set(stageIdx, item);
        } else {
          // Keep only the latest entry per unique stage title
          const tNew = parseTimestamp(item.timestamp)?.getTime() ?? 0;
          const tOld = parseTimestamp(existing.timestamp)?.getTime() ?? 0;
          if (tNew >= tOld) {
            stageMap.set(stageIdx, item);
          }
        }
      }
    });

    // If shipment has an explicit standard status and no history entry exists for it, add it
    const explicitIdx = findStageIndex(shipment.status);
    if (explicitIdx >= 0 && !stageMap.has(explicitIdx)) {
      stageMap.set(explicitIdx, {
        status_name: MASTER_STAGES[explicitIdx],
        location: originLoc,
        timestamp: null
      });
    }

    // 3. Accurate History Reading to Determine Current Active Milestone
    // Inspect all milestones recorded in shipment.history (and stageMap):
    // - Check passed timestamps (timestamp <= nowTime) vs. future timestamps
    // - If auto_advance is explicitly false and shipment.status is set, honor explicit status
    // - Find the highest milestone that has occurred as the active stage
    const nowTime = clockNow.getTime();
    let activeIdx = 0;

    if (shipment.auto_advance === false && explicitIdx >= 0) {
      activeIdx = explicitIdx;
    } else {
      let highestPastStage = -1;
      let lowestFutureStage = 999;

      for (let i = 0; i < MASTER_STAGES.length; i++) {
        if (stageMap.has(i)) {
          const entry = stageMap.get(i);
          const t = parseTimestamp(entry?.timestamp);
          if (t) {
            if (t.getTime() <= nowTime) {
              if (i > highestPastStage) highestPastStage = i;
            } else {
              if (i < lowestFutureStage) lowestFutureStage = i;
            }
          } else {
            // Milestone is recorded without a future timestamp
            if (i > highestPastStage && i < lowestFutureStage) {
              highestPastStage = i;
            }
          }
        }
      }

      if (highestPastStage >= 0) {
        activeIdx = highestPastStage;
      } else if (explicitIdx >= 0) {
        activeIdx = explicitIdx;
      } else {
        activeIdx = 0;
      }

      // If explicitIdx is set and higher than highestPastStage and has no future milestones before it
      if (explicitIdx >= 0 && explicitIdx > activeIdx && explicitIdx < lowestFutureStage) {
        activeIdx = explicitIdx;
      }
    }

    // If hold entries exist, use the latest hold entry's location/timestamp for the active hold badge
    const latestHoldEntry = holdEntries[holdEntries.length - 1];

    // 4. Build the 8 stages strictly in defined sequential order (1 to 8)
    const stages = MASTER_STAGES.map((stageName, idx) => {
      const entry = stageMap.get(idx);
      let nodeState: 'COMPLETED' | 'ACTIVE' | 'UPCOMING';
      if (idx < activeIdx) {
        nodeState = 'COMPLETED';
      } else if (idx === activeIdx) {
        nodeState = 'ACTIVE';
      } else {
        nodeState = 'UPCOMING';
      }

      // Single Active Hold Node: If shipment.is_on_hold === true, display ONLY ONE single active "On Hold"
      // badge at the exact stage where the package was paused. Do NOT render multiple "On Hold" steps.
      const isHoldNode = (nodeState === 'ACTIVE' && effectiveOnHold);

      const location = isHoldNode && latestHoldEntry?.location
        ? latestHoldEntry.location
        : (entry?.location || (idx === 7 ? destinationLoc : (idx === 0 ? originLoc : (shipment.origin_city_state || 'FedEx Facility'))));

      const timestamp = isHoldNode && latestHoldEntry?.timestamp
        ? latestHoldEntry.timestamp
        : (entry?.timestamp || null);

      return {
        id: `stage-${idx}`,
        step: idx + 1,
        title: isHoldNode ? 'On Hold' : stageName,
        originalTitle: stageName,
        location,
        timestamp,
        dateFormatted: formatMilestoneDate(timestamp),
        nodeState,
        isHold: isHoldNode,
        isActive: nodeState === 'ACTIVE',
        isCompleted: nodeState === 'COMPLETED',
        isUpcoming: nodeState === 'UPCOMING'
      };
    });

    const activeStageItem = stages[activeIdx];

    return {
      activeStageIndex: activeIdx,
      activeStageName: effectiveOnHold ? 'On Hold' : MASTER_STAGES[activeIdx],
      isEffectiveOnHold: effectiveOnHold,
      activeLocation: activeStageItem?.location || originLoc,
      activeTimestamp: activeStageItem?.timestamp || null,
      stages
    };
  }, [shipment, clockNow, originLoc, destinationLoc]);

  const { activeStageIndex, activeStageName, isEffectiveOnHold, activeLocation } = processedStagesData;
  const chronologicalHistory = processedStagesData.stages;
  const packageName = (shipment?.package_name || (shipment as any)?.shipment_name || (shipment as any)?.package_title || '').trim();

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
                type="text"
                inputMode="numeric"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="Enter 12-digit tracking number..."
                value={trackingId}
                onChange={handleInputChange}
                onKeyDown={(e) => e.key === 'Enter' && trackShipment()}
                className="h-11 pl-10 pr-3 bg-slate-50 border-slate-200/80 rounded-xl text-base font-mono font-bold tracking-wider placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:text-sm focus-visible:ring-[#4D148C] touch-manipulation select-text"
                style={{ fontSize: '16px' }}
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <Button
              id="track_btn"
              onClick={() => trackShipment()}
              disabled={loading || trackingId.replace(/\s/g, '').length !== 12}
              className="h-11 px-5 bg-[#FF6600] hover:bg-[#E05A00] text-white font-bold rounded-xl text-xs shadow-xs transition-all shrink-0 cursor-pointer disabled:opacity-50 touch-manipulation"
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
                {packageName && (
                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200/80 text-xs font-bold text-slate-800">
                      <Package className="w-3.5 h-3.5 text-[#FF6600] shrink-0" />
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Package:</span>
                      <span className="text-slate-900 font-bold">{packageName}</span>
                    </span>
                  </div>
                )}
              </div>

              <div className="text-right space-y-0.5">
                <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                  Tracking Number
                </p>
                <div className="flex items-center justify-end gap-1.5">
                  <p className="text-lg md:text-xl font-bold font-mono tracking-wider text-slate-900">
                    {formatId(shipment.id)}
                  </p>
                  <button
                    type="button"
                    id="copy_share_link_btn"
                    onClick={handleCopyShareLink}
                    title="Copy direct shareable tracking link"
                    className="p-1 rounded-md text-slate-400 hover:text-[#4D148C] hover:bg-slate-100 transition-colors cursor-pointer"
                    aria-label="Copy share link"
                  >
                    {copiedLink ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Share2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                {copiedLink && (
                  <p className="text-[10px] font-medium text-emerald-600">Link copied!</p>
                )}
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
                {packageName && (
                  <div className="space-y-0.5 col-span-2 pb-2.5 mb-1 border-b border-slate-200/60">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Package / Shipment Name</p>
                    <p className="text-sm md:text-base font-extrabold text-slate-900 flex items-center gap-2">
                      <Package className="w-4 h-4 text-[#FF6600] shrink-0" />
                      <span>{packageName}</span>
                    </p>
                  </div>
                )}
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

            {/* Financial Details: Total Shipment Value & Service Fee */}
            {(() => {
              const rawAssetVal = shipment.asset_value ?? shipment.declared_value;
              const numericAssetVal = rawAssetVal !== null && rawAssetVal !== undefined && String(rawAssetVal).trim() !== ''
                ? Number(rawAssetVal)
                : 0;
              const hasAssetValue = !isNaN(numericAssetVal) && numericAssetVal > 0;

              const rawServiceFee = shipment.service_fee;
              const numericServiceFee = rawServiceFee !== null && rawServiceFee !== undefined && String(rawServiceFee).trim() !== ''
                ? Number(rawServiceFee)
                : 0;
              // STRICT: Only show Service Fee if it is greater than 1 (never show 0, 0.00, empty, or null)
              const hasServiceFee = !isNaN(numericServiceFee) && numericServiceFee > 1;

              if (!hasAssetValue && !hasServiceFee) {
                return null;
              }

              return (
                <div className={cn(
                  "grid gap-4",
                  (hasAssetValue && hasServiceFee)
                    ? "grid-cols-1 sm:grid-cols-2"
                    : "grid-cols-1"
                )}>
                  {/* Total Shipment Value Card */}
                  {hasAssetValue && (
                    <div className="bg-[#FBFBFC] border border-slate-200/75 rounded-2xl p-5 space-y-1 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Total Shipment Value
                        </p>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          {shipment.currency || 'USD'}
                        </span>
                      </div>
                      <p className="text-xl md:text-2xl font-bold text-slate-900">
                        {formatCurrency(numericAssetVal, shipment.currency)}
                      </p>
                    </div>
                  )}

                  {/* Service Fee Card - STRICT: Never shown if 0, 0.00, null, or not greater than 1 */}
                  {hasServiceFee && (
                    <div className="bg-[#FBFBFC] border border-slate-200/75 rounded-2xl p-5 space-y-1 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Service Fee
                        </p>
                        <span className="px-2 py-0.5 rounded-md bg-orange-50 border border-orange-200/60 text-[#FF6600] text-[10px] font-bold uppercase tracking-wider">
                          Standard Fee
                        </span>
                      </div>
                      <p className="text-xl md:text-2xl font-bold text-slate-900">
                        {formatCurrency(numericServiceFee, shipment.currency)}
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Estimated Delivery Date Card */}
            {shipment.estimated_delivery_date && (
              <div className="bg-[#FBFBFC] border border-slate-200/75 rounded-2xl p-5 space-y-1 shadow-2xs">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estimated Delivery Date</p>
                <p className="text-base font-bold text-slate-900">
                  {formatShortDate(shipment.estimated_delivery_date)}
                </p>
              </div>
            )}

            {/* Interactive Route Map (Automated Route Engine Box under Estimated Delivery Date) */}
            <div className="pt-2">
              <TransitMap
                origin={originLoc}
                currentLocation={activeLocation}
                destination={destinationLoc}
                recipientName={shipment.recipient_name}
                packageName={packageName}
                destinationAddress={shipment.destination_address}
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
                          /* Active Hold Node: Orange (#FF6600) circle with white truck icon & alert ring */
                          <div className="w-10 h-10 rounded-full bg-[#FF6600] flex items-center justify-center text-white shrink-0 shadow-md ring-4 ring-red-500/25 z-10">
                            <Truck className="w-5 h-5 text-white" />
                          </div>
                        ) : item.isActive ? (
                          /* Current Active Node: Iconic FedEx Orange (#FF6600) circle with white truck icon */
                          <div className="w-10 h-10 rounded-full bg-[#FF6600] text-white flex items-center justify-center shrink-0 shadow-md ring-4 ring-[#FF6600]/25 z-10">
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
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 border border-red-200 text-[#FF2D20] text-[10px] font-bold tracking-wider uppercase">
                              <AlertTriangle className="w-3 h-3 text-[#FF2D20]" />
                              ON HOLD
                            </span>
                          </div>
                        ) : item.isActive ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-base font-bold text-[#FF6600]">
                              {item.title}
                            </p>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FF6600]/10 border border-[#FF6600]/30 text-[#FF6600] text-[10px] font-bold tracking-wider uppercase">
                              <Truck className="w-3 h-3 text-[#FF6600]" />
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
