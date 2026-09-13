import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Search, 
  Clock, 
  Truck, 
  Package, 
  Building2, 
  UserCheck, 
  Calendar, 
  AlertTriangle, 
  Snowflake, 
  FileCheck, 
  Layers, 
  ShieldCheck,
  AlertCircle,
  Check,
  PauseCircle,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase, Shipment, ShipmentStatus, TrackingHistory } from '@/src/lib/supabase';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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

/**
 * Match any status text to one of the 8 canonical FedEx stages
 */
export function findStageIndex(statusStr?: string | null): number {
  if (!statusStr) return -1;
  const clean = statusStr.toLowerCase().trim();

  for (let i = 0; i < MASTER_STAGES.length; i++) {
    if (clean === MASTER_STAGES[i].toLowerCase()) return i;
  }

  // Resilient semantic matching
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

/**
 * Find milestone from history corresponding to a given canonical stage
 */
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

// Currency formatter utility
const formatCurrency = (val?: number | null, currencyCode = 'USD'): string | null => {
  if (val === undefined || val === null) return null;
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  if (isNaN(num) || num <= 0) return null;

  try {
    const code = (currencyCode || 'USD').trim().toUpperCase();
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    const code = (currencyCode || 'USD').trim().toUpperCase();
    return `${code} ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
};

export default function TrackingPortal({ initialId }: { initialId?: string } = {}) {
  const [trackingId, setTrackingId] = useState(
    initialId ? initialId.replace(/\D/g, '').slice(0, 12).match(/.{1,4}/g)?.join(' ') || '' : ''
  );
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  // Real-time clock for automated stage advancement
  const [clockNow, setClockNow] = useState<Date>(() => new Date());

  // Check Supabase Configuration on load
  useEffect(() => {
    if (!supabase) {
      setErrorStatus("System initialization failed. Please contact support.");
    }
  }, []);

  // Update clock ticker when auto_advance is active
  useEffect(() => {
    if (!shipment?.auto_advance || shipment?.is_on_hold) return;
    const interval = setInterval(() => {
      setClockNow(new Date());
    }, 4000); // Check clock every 4 seconds
    return () => clearInterval(interval);
  }, [shipment?.auto_advance, shipment?.is_on_hold]);

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
    const id = (idToTrack || trackingId).replace(/\s/g, '');
    if (id.length !== 12) {
      if (id.length > 0 && id.length < 12) {
        setErrorStatus("Please enter a valid 12-digit tracking number.");
      }
      return;
    }

    setLoading(true);
    setHasSearched(true);
    
    // Update URL without refreshing
    const formattedId = formatId(id);
    const url = new URL(window.location.href);
    url.searchParams.set('id', formattedId);
    window.history.pushState({}, '', url);

    try {
      const { data, error } = await supabase
        .from('shipments')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('Supabase Error:', error);
        setErrorStatus("Database connection error. Please try again later.");
        setShipment(null);
        return;
      }

      if (!data) {
        setShipment(null);
      } else {
        setShipment(data as Shipment);
        setErrorStatus(null);
      }
    } catch (err) {
      console.error('Fetch Error:', err);
      setErrorStatus("An unexpected error occurred. Please refresh the page.");
      setShipment(null);
    } finally {
      setLoading(false);
    }
  }, [trackingId]);

  useEffect(() => {
    if (initialId) {
      const formatted = formatId(initialId);
      setTrackingId(formatted);
      trackShipment(formatted);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const idFromUrl = params.get('id');
    if (idFromUrl) {
      const formatted = formatId(idFromUrl);
      setTrackingId(formatted);
      trackShipment(formatted);
    }
  }, [initialId]);

  const formatDate = (dateStr?: string | null) => {
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
    }) + ' • ' + date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Geographic locations for map and fallback
  const originLoc = shipment?.origin_city_state || shipment?.sender_address || shipment?.origin || 'FedEx Origin Hub';
  const destinationLoc = shipment?.destination_address || shipment?.receiver_address || shipment?.recipient_address || shipment?.destination || 'Destination Address';

  /**
   * Section 2 & 3: Standard 8-Stage Timeline & Dynamic Stage Calculation
   * 
   * Advancement & Active Stage Logic:
   * - If auto_advance is true, evaluate timestamps in history against current time (new Date()).
   *   The highest milestone whose timestamp has passed is designated as the Active Stage.
   * - If auto_advance is false, designate explicit status in shipment.status (or last populated history entry).
   * 
   * Dynamic "On Hold" Override Display:
   * - If is_on_hold === true: Freeze progression immediately. The package stays pinned at its current active milestone.
   * - Replace current active milestone icon with prominent Orange (#FF6600) "On Hold" badge.
   * - Display status title as On Hold for that specific step while preserving actual location and timestamp.
   * - Keep all subsequent unreached milestones strictly in the gray "UPCOMING" state.
   */
  const stageComputation = useMemo(() => {
    if (!shipment) {
      return {
        activeStageIndex: 0,
        activeStageName: MASTER_STAGES[0],
        isEffectiveOnHold: false,
        activeMilestone: null,
        activeLocation: originLoc,
        activeTimestamp: null as string | null
      };
    }

    const isOnHold = Boolean(shipment.is_on_hold || shipment.status === 'On Hold');
    const history = Array.isArray(shipment.history) ? shipment.history : [];

    let computedIndex = 0;

    if (shipment.auto_advance && !isOnHold) {
      // Evaluate timestamps in history against clockNow
      let highestPassed = -1;

      for (const item of history) {
        const stageIdx = findStageIndex(item.status || (item as any).status_name);
        if (stageIdx >= 0 && item.timestamp) {
          let normalized = String(item.timestamp).trim();
          if (normalized.includes(' ') && !normalized.includes('T')) {
            normalized = normalized.replace(' ', 'T');
          }
          const itemDate = new Date(normalized);
          if (!isNaN(itemDate.getTime()) && itemDate.getTime() <= clockNow.getTime()) {
            if (stageIdx > highestPassed) {
              highestPassed = stageIdx;
            }
          }
        }
      }

      if (highestPassed >= 0) {
        computedIndex = highestPassed;
      } else {
        const explicitIdx = findStageIndex(shipment.status);
        computedIndex = explicitIdx >= 0 ? explicitIdx : 0;
      }
    } else {
      // auto_advance is false OR isOnHold is true (progression frozen at current active milestone)
      let explicitIdx = -1;
      if (shipment.status && shipment.status !== 'On Hold') {
        explicitIdx = findStageIndex(shipment.status);
      }

      if (explicitIdx >= 0) {
        computedIndex = explicitIdx;
      } else if (history.length > 0) {
        let maxHistIdx = -1;
        for (const item of history) {
          const idx = findStageIndex(item.status || (item as any).status_name);
          if (idx > maxHistIdx) {
            maxHistIdx = idx;
          }
        }
        computedIndex = maxHistIdx >= 0 ? maxHistIdx : 0;
      } else {
        computedIndex = 0;
      }
    }

    computedIndex = Math.max(0, Math.min(computedIndex, MASTER_STAGES.length - 1));
    const activeStageName = MASTER_STAGES[computedIndex];
    const activeMilestone = getMilestoneForStage(activeStageName, history) || history[computedIndex] || null;

    // Preserve actual location and timestamp of active milestone
    const activeLocation = activeMilestone?.location || 
      (computedIndex === 0 ? originLoc : (computedIndex === MASTER_STAGES.length - 1 ? destinationLoc : originLoc));
    const activeTimestamp = activeMilestone?.timestamp || shipment.created_at || null;

    return {
      activeStageIndex: computedIndex,
      activeStageName,
      isEffectiveOnHold: isOnHold,
      activeMilestone,
      activeLocation,
      activeTimestamp
    };
  }, [shipment, clockNow, originLoc, destinationLoc]);

  const {
    activeStageIndex,
    activeStageName,
    isEffectiveOnHold,
    activeMilestone,
    activeLocation,
    activeTimestamp
  } = stageComputation;

  // Extract non-zero, populated specs
  const rawWeight = shipment?.weight ? Number(String(shipment.weight).replace(/[^\d.]/g, '')) : 0;
  const hasWeight = rawWeight > 0;
  const displayWeight = hasWeight ? `${shipment?.weight} ${shipment?.weight_unit || 'lbs'}` : null;

  const rawLength = shipment?.length ? Number(shipment.length) : 0;
  const rawWidth = shipment?.width ? Number(shipment.width) : 0;
  const rawHeight = shipment?.height ? Number(shipment.height) : 0;
  const hasDimensions = (rawLength > 0 && rawWidth > 0 && rawHeight > 0) || (!!shipment?.dimensions && shipment.dimensions !== '0');
  const displayDimensions = (rawLength > 0 && rawWidth > 0 && rawHeight > 0)
    ? `${rawLength} × ${rawWidth} × ${rawHeight} ${shipment?.dimension_unit || 'in'}`
    : (shipment?.dimensions && shipment.dimensions !== '0' ? shipment.dimensions : null);

  const rawPackages = shipment?.num_packages ?? shipment?.package_count ?? shipment?.pieces ?? 0;
  const hasNumPackages = Number(rawPackages) > 0;

  const hasServiceType = !!(shipment?.service_type && shipment.service_type !== '0');
  const hasPackageType = !!(shipment?.package_type && shipment.package_type !== '0');

  const hasPackageSpecs = hasServiceType || hasPackageType || hasWeight || hasDimensions || hasNumPackages;

  // Financial values
  const formattedAssetValue = formatCurrency(shipment?.asset_value, shipment?.currency);
  const formattedDeclaredValue = formatCurrency(shipment?.declared_value, shipment?.currency);
  const formattedServiceFee = formatCurrency(shipment?.service_fee, shipment?.currency);
  const hasFinancials = !!(formattedAssetValue || formattedDeclaredValue || formattedServiceFee);

  // Sender & Receiver details
  const hasSenderName = !!(shipment?.sender_name && shipment.sender_name !== '0');
  const hasSenderAddress = !!(shipment?.sender_address && shipment.sender_address !== '0') || 
                           !!(shipment?.origin_city_state && shipment.origin_city_state !== '0') || 
                           !!(shipment?.origin && shipment.origin !== '0');
  const hasSender = hasSenderName || hasSenderAddress;

  const hasReceiverName = !!(shipment?.recipient_name && shipment.recipient_name !== '0');
  const hasReceiverAddress = !!(shipment?.destination_address && shipment.destination_address !== '0') ||
                             !!(shipment?.receiver_address && shipment.receiver_address !== '0') || 
                             !!(shipment?.recipient_address && shipment.recipient_address !== '0') || 
                             !!(shipment?.destination && shipment.destination !== '0');
  const hasReceiver = hasReceiverName || hasReceiverAddress;

  // Special handling badges
  const specialHandlingBadges = [
    shipment?.is_dry_ice && {
      id: 'dry-ice',
      label: 'Dry Ice (Special Cold Chain)',
      icon: Snowflake,
      badgeClass: 'bg-sky-50 text-sky-800 border-sky-200'
    },
    shipment?.is_hazardous && {
      id: 'hazardous',
      label: 'Hazardous Materials / Dangerous Goods',
      icon: AlertTriangle,
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200'
    },
    shipment?.is_saturday_delivery && {
      id: 'saturday',
      label: 'Saturday Delivery',
      icon: Calendar,
      badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200'
    },
    (shipment?.signature_option && shipment.signature_option !== 'None' && shipment.signature_option !== '0') && {
      id: 'signature',
      label: shipment.signature_option === 'true' ? 'Signature Required' : shipment.signature_option,
      icon: FileCheck,
      badgeClass: 'bg-purple-50 text-[#4D148C] border-purple-200'
    },
    shipment?.is_hold_at_location && {
      id: 'hold',
      label: 'Hold at FedEx OnSite Location',
      icon: Building2,
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200'
    }
  ].filter(Boolean) as { id: string; label: string; icon: any; badgeClass: string }[];

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans text-[#141414]">
      {/* Sticky Header */}
      <header className="fixed top-0 left-0 right-0 h-[64px] bg-white border-b border-slate-100 flex items-center justify-between z-40 px-6 shadow-xs">
        <div className="flex items-center">
          <span className="text-2xl font-black text-[#4D148C]">Fed</span>
          <span className="text-2xl font-black text-[#FF6600]">Ex</span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="hidden sm:inline text-slate-500 font-semibold">
            Official Logistics Network
          </span>
          <span className="bg-[#4D148C]/5 text-[#4D148C] border border-[#4D148C]/15 font-mono font-bold px-2.5 py-1 rounded-md text-[11px]">
            8-STAGE AUTOMATED ENGINE
          </span>
        </div>
      </header>

      <main className="pt-[84px] pb-24 px-4 max-w-4xl mx-auto space-y-6">
        {/* Search Engine Input */}
        <div className="space-y-4">
          {errorStatus && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
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
                autoCapitalize="none"
                spellCheck={false}
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                placeholder="Enter 12-digit tracking number (e.g. 4829 1039 4857)"
                value={trackingId}
                onChange={handleInputChange}
                onKeyDown={(e) => e.key === 'Enter' && trackShipment()}
                className="h-14 pl-12 pr-4 bg-white border-slate-200/80 rounded-xl text-base md:text-lg font-mono font-bold tracking-wider placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal placeholder:tracking-normal shadow-xs focus-visible:ring-[#4D148C] focus-visible:border-[#4D148C]"
              />
              <Search className="w-5 h-5 text-[#4D148C] absolute left-4 top-1/2 -translate-y-1/2" />
            </div>
            <Button 
              id="track_btn"
              onClick={() => trackShipment()}
              disabled={loading || trackingId.replace(/\s/g, '').length !== 12}
              className="h-14 px-6 md:px-8 bg-[#FF6600] hover:bg-[#E05A00] text-white font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>TRACK</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-xl p-4 flex items-start gap-3 shadow-2xs">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-slate-700">Verified Automated Logistics Engine</p>
              <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                This portal tracks verified FedEx shipments using our 8-Stage Automated Route Engine with OpenStreetMap telemetry, waypoint routing, and instant milestone synchronization.
              </p>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {shipment ? (
            <motion.div
              key={`shipment-${shipment.id}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Master Card */}
              <Card className="border border-slate-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-2xl overflow-hidden bg-white">
                <CardContent className="p-6 md:p-8 space-y-6">
                  {/* Dynamic "On Hold" Master Alert Banner */}
                  {isEffectiveOnHold && (
                    <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3 text-amber-900 shadow-2xs">
                      <AlertTriangle className="w-5 h-5 text-[#FF6600] shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-black uppercase tracking-wider text-[#FF6600]">
                            Shipment On Hold — Automation Frozen
                          </p>
                          <span className="bg-[#FF6600] text-white text-[9px] font-black uppercase px-2 py-0.2 rounded font-mono">
                            ACTIVE HOLD
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed">
                          Package progression is currently frozen at <strong>{activeLocation}</strong>. 
                          The shipment is pinned at this milestone and all subsequent delivery steps remain paused until released by FedEx dispatch.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Top Status Header */}
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "w-2.5 h-2.5 rounded-full animate-ping",
                          isEffectiveOnHold ? "bg-[#FF6600]" : "bg-[#4D148C]"
                        )} />
                        <p className="text-[10px] font-bold text-[#4D148C] uppercase tracking-widest">
                          Shipment Status
                        </p>
                        {shipment.auto_advance && !isEffectiveOnHold && (
                          <span className="text-[9px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            AUTO-ADVANCE ACTIVE
                          </span>
                        )}
                      </div>
                      <h2 className={cn(
                        "text-2xl md:text-3xl font-black tracking-tight uppercase",
                        isEffectiveOnHold ? "text-[#FF6600]" : "text-slate-900"
                      )}>
                        {isEffectiveOnHold ? 'On Hold' : activeStageName}
                      </h2>
                      <p className="text-xs text-slate-500 font-medium">
                        {[activeLocation, activeTimestamp ? formatDate(activeTimestamp) : null].filter(Boolean).join(' • ')}
                      </p>
                    </div>

                    <div className="text-left md:text-right space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tracking Number</p>
                      <p className="text-base font-mono font-bold text-slate-900 tracking-wider">
                        {formatId(shipment.id)}
                      </p>
                      {hasServiceType && (
                        <p className="text-xs font-semibold text-[#4D148C]">
                          {shipment.service_type}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 8-Stage Visual Segmented Progress Bar */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                      <span className="text-slate-500">8-Stage Automated Progression</span>
                      <span className={cn(
                        "font-mono px-2 py-0.5 rounded",
                        isEffectiveOnHold ? "bg-[#FF6600]/10 text-[#FF6600]" : "bg-[#4D148C]/10 text-[#4D148C]"
                      )}>
                        STAGE {activeStageIndex + 1} OF 8 {isEffectiveOnHold ? '• ON HOLD' : ''}
                      </span>
                    </div>

                    <div className="grid grid-cols-8 gap-1.5 h-2.5">
                      {MASTER_STAGES.map((stage, idx) => {
                        const isDone = idx < activeStageIndex;
                        const isCurrent = idx === activeStageIndex;
                        return (
                          <div
                            key={stage}
                            title={`Stage ${idx + 1}: ${stage}`}
                            className={cn(
                              "h-full rounded-full transition-all duration-300",
                              isDone ? "bg-[#4D148C]" :
                              isCurrent ? (isEffectiveOnHold ? "bg-[#FF6600] animate-pulse ring-2 ring-[#FF6600]/30" : "bg-[#FF6600] ring-2 ring-[#FF6600]/30") :
                              "bg-slate-200"
                            )}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Special Handling Badges */}
                  {specialHandlingBadges.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Special Handling & Delivery Services</p>
                      <div className="flex flex-wrap gap-2">
                        {specialHandlingBadges.map((badge) => {
                          const Icon = badge.icon;
                          return (
                            <span 
                              key={badge.id}
                              className={cn(
                                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all shadow-2xs",
                                badge.badgeClass
                              )}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              <span>{badge.label}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Sender & Receiver Cards */}
                  {(hasSender || hasReceiver) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Sender Card */}
                      {hasSender && (
                        <div className="bg-[#F8F9FA] border border-slate-200/70 rounded-xl p-4 space-y-2">
                          <div className="flex items-center gap-2 text-[#4D148C]">
                            <Building2 className="w-4 h-4" />
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Shipment Sender</p>
                          </div>
                          <div className="space-y-0.5">
                            {hasSenderName && (
                              <p className="text-sm font-bold text-slate-900">{shipment.sender_name}</p>
                            )}
                            {hasSenderAddress && (
                              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                                {shipment.sender_address || shipment.origin_city_state || shipment.origin}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Primary Receiver Card */}
                      {hasReceiver && (
                        <div className="bg-[#F8F9FA] border border-slate-200/70 rounded-xl p-4 space-y-2">
                          <div className="flex items-center gap-2 text-[#FF6600]">
                            <UserCheck className="w-4 h-4" />
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Primary Receiver</p>
                          </div>
                          <div className="space-y-0.5">
                            {hasReceiverName && (
                              <p className="text-sm font-bold text-slate-900">{shipment.recipient_name}</p>
                            )}
                            {hasReceiverAddress && (
                              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                                {shipment.destination_address || shipment.receiver_address || shipment.recipient_address || shipment.destination}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Package Specifications Grid */}
                  {hasPackageSpecs && (
                    <div className="bg-[#F8F9FA] border border-slate-200/70 rounded-xl p-4 md:p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[#4D148C]">
                          <Layers className="w-4 h-4" />
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#4D148C]">FedEx Package Specifications</p>
                        </div>
                        {hasServiceType && (
                          <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                            {shipment.service_type}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pt-1">
                        {hasPackageType && (
                          <div className="space-y-0.5">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Package Type</p>
                            <p className="text-xs font-bold text-slate-900">{shipment.package_type}</p>
                          </div>
                        )}
                        {hasWeight && (
                          <div className="space-y-0.5">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Weight</p>
                            <p className="text-xs font-bold text-slate-900">{displayWeight}</p>
                          </div>
                        )}
                        {hasDimensions && (
                          <div className="space-y-0.5">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Dimensions</p>
                            <p className="text-xs font-bold text-slate-900">{displayDimensions}</p>
                          </div>
                        )}
                        {hasNumPackages && (
                          <div className="space-y-0.5">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Pieces</p>
                            <p className="text-xs font-bold text-slate-900">{rawPackages} pkg(s)</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Financial & Valuation Summary */}
                  {hasFinancials && (
                    <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {formattedAssetValue && (
                        <div className="space-y-1">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Shipment Value</p>
                          <p className="text-base font-bold text-slate-900">{formattedAssetValue}</p>
                        </div>
                      )}
                      {formattedDeclaredValue && (
                        <div className="space-y-1">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Declared Value</p>
                          <p className="text-base font-bold text-slate-900">{formattedDeclaredValue}</p>
                        </div>
                      )}
                      {formattedServiceFee && (
                        <div className="space-y-1">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Shipping & Service Fee</p>
                          <p className="text-base font-bold text-slate-900">{formattedServiceFee}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Delivery Schedule Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100">
                    {shipment.estimated_delivery_date && shipment.estimated_delivery_date !== '0' ? (
                      <div className="space-y-1">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Estimated Delivery Date</p>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-[#4D148C]" />
                          <p className="text-sm font-bold text-slate-900">{formatDate(shipment.estimated_delivery_date).split(' • ')[0]}</p>
                        </div>
                      </div>
                    ) : (
                      <div />
                    )}
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-[#4D148C] uppercase tracking-widest bg-[#4D148C]/5 px-3 py-1.5 rounded-lg border border-[#4D148C]/10">
                        {activeStageIndex + 1} OF 8 MILESTONES COMPLETED
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Section 4: OpenStreetMap & Waypoint Route Visualization */}
              <TransitMap
                origin={originLoc}
                currentLocation={activeLocation}
                destination={destinationLoc}
                currentStatus={isEffectiveOnHold ? 'On Hold' : activeStageName}
                routeWaypoints={shipment.route_waypoints || []}
                isOnHold={isEffectiveOnHold}
              />

              {/* Section 2 & 3: Standard 8-Stage Timeline */}
              <div className="bg-white p-6 md:p-8 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-slate-200/80 space-y-8">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                      8-Stage Automated Route Milestones
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Standardized FedEx Logistics Network Sequential Timeline
                    </p>
                  </div>
                  {isEffectiveOnHold ? (
                    <span className="text-[11px] font-bold text-[#FF6600] bg-[#FF6600]/10 px-2.5 py-1 rounded-md border border-[#FF6600]/20 flex items-center gap-1.5">
                      <PauseCircle className="w-3.5 h-3.5" />
                      PROGRESSION FROZEN (ON HOLD)
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-[#4D148C]">
                      Real-time Milestone Progression
                    </span>
                  )}
                </div>
                
                <div className="space-y-0 relative">
                  {MASTER_STAGES.map((stage, index) => {
                    const isCompleted = index < activeStageIndex;
                    const isActive = index === activeStageIndex;
                    const isUpcoming = index > activeStageIndex;

                    const milestone = getMilestoneForStage(stage, shipment.history);
                    const milestoneLocation = milestone?.location || 
                      (index === 0 ? originLoc : (index === MASTER_STAGES.length - 1 ? destinationLoc : activeLocation));
                    const milestoneTimestamp = milestone?.timestamp ? formatDate(milestone.timestamp).replace(' • ', ', ') : null;

                    return (
                      <div key={stage} className="flex gap-5 min-h-[76px]">
                        {/* Timeline Track & Node */}
                        <div className="flex flex-col items-center">
                          {isCompleted ? (
                            /* Completed Stage: Solid FedEx Purple Icon */
                            <div className="w-8 h-8 rounded-full bg-[#4D148C] text-white flex items-center justify-center z-10 shadow-xs">
                              <Check className="w-4 h-4 stroke-[3]" />
                            </div>
                          ) : isActive ? (
                            /* Active Stage: Prominent Orange On Hold badge OR Highlighted Indicator Badge */
                            isEffectiveOnHold ? (
                              <div className="w-9 h-9 rounded-full bg-[#FF6600] text-white flex items-center justify-center z-10 shadow-lg ring-4 ring-[#FF6600]/30 animate-pulse">
                                <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
                              </div>
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-[#4D148C] text-white flex items-center justify-center z-10 shadow-lg ring-4 ring-[#4D148C]/25">
                                <Truck className="w-4 h-4" />
                              </div>
                            )
                          ) : (
                            /* Upcoming Stage: Grayed-out */
                            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center z-10">
                              <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                            </div>
                          )}

                          {/* Connecting vertical line */}
                          {index !== MASTER_STAGES.length - 1 && (
                            <div className={cn(
                              "w-0.5 flex-grow my-1 transition-colors duration-300",
                              isCompleted ? "bg-[#4D148C]" : "bg-slate-200"
                            )} />
                          )}
                        </div>

                        {/* Milestone Description Content */}
                        <div className={cn(
                          "pb-8 flex-grow",
                          isUpcoming && "opacity-45"
                        )}>
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className={cn(
                                  "text-sm leading-tight transition-colors duration-300",
                                  isCompleted ? "text-slate-900 font-bold" :
                                  isActive ? (isEffectiveOnHold ? "text-[#FF6600] font-black text-base" : "text-slate-900 font-black text-base") :
                                  "text-slate-400 font-medium"
                                )}>
                                  {isActive && isEffectiveOnHold ? 'On Hold' : stage}
                                </p>

                                {/* Badges */}
                                {isCompleted && (
                                  <span className="text-[9px] font-bold text-[#4D148C] bg-[#4D148C]/10 px-2 py-0.5 rounded uppercase tracking-wider">
                                    Completed
                                  </span>
                                )}
                                {isActive && (
                                  isEffectiveOnHold ? (
                                    <span className="text-[9px] font-black uppercase tracking-widest text-white bg-[#FF6600] px-2.5 py-0.5 rounded-full shadow-xs">
                                      ON HOLD
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-black uppercase tracking-widest text-white bg-[#FF6600] px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                      Active Stage
                                    </span>
                                  )
                                )}
                                {isUpcoming && (
                                  <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                                    UPCOMING
                                  </span>
                                )}
                              </div>

                              {/* Location and Timestamp (preserved on hold and completed) */}
                              {!isUpcoming ? (
                                <div className="space-y-0.5">
                                  <p className="text-[12px] text-slate-600 font-medium">
                                    {[milestoneLocation, milestoneTimestamp].filter(Boolean).join(' • ')}
                                  </p>
                                  {milestone?.details && (
                                    <p className="text-[11px] text-slate-500 italic">
                                      {milestone.details}
                                    </p>
                                  )}
                                  {isActive && isEffectiveOnHold && (
                                    <p className="text-[11px] text-[#FF6600] font-semibold">
                                      Package movement paused at this facility. Scheduled progression will resume once released.
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <p className="text-[11px] text-slate-400 font-normal">
                                  Pending FedEx logistics route dispatch
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          ) : hasSearched && !loading ? (
            <motion.div
              key="no-results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20 space-y-4"
            >
              <Package className="w-16 h-16 text-slate-200 mx-auto" />
              <p className="text-slate-400 font-medium">Tracking ID not recognized in database.</p>
            </motion.div>
          ) : !loading && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20 space-y-4"
            >
              <Search className="w-16 h-16 text-slate-200 mx-auto" />
              <p className="text-slate-400 font-medium">Enter a 12-digit tracking number to view real-time transit details</p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
