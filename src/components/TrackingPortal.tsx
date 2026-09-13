import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Clock, 
  Truck, 
  Package, 
  Building2, 
  UserCheck, 
  MapPin, 
  Calendar, 
  AlertTriangle, 
  Snowflake, 
  FileCheck, 
  Layers, 
  Scale, 
  Maximize2, 
  ShieldCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase, Shipment, ShipmentStatus } from '@/src/lib/supabase';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import TransitMap from './TransitMap';

const MASTER_STAGES: ShipmentStatus[] = [
  'Shipping label created',
  'Package received by FedEx',
  'In Transit',
  'On the way',
  'Out for Delivery',
  'Arriving at destination facility',
  'On Hold',
  'Delivered'
];

const getStageDisplayLabel = (stage: string) => {
  return stage;
};

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
  const [trackingId, setTrackingId] = useState(initialId ? initialId.replace(/\D/g, '').slice(0, 12).match(/.{1,4}/g)?.join(' ') || '' : '');
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  // Check Supabase Configuration on load
  useEffect(() => {
    if (!supabase) {
      setErrorStatus("System initialization failed. Please contact support.");
    }
  }, []);

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

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === '0') return 'TBD';
    
    let normalized = dateStr.trim();
    if (normalized.includes(' ') && !normalized.includes('T')) {
      normalized = normalized.replace(' ', 'T');
    }
    
    const date = NewDate(normalized);
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

  function NewDate(str: string) {
    return new Date(str.includes('T') || str.includes('Z') ? str : str.replace(/-/g, '/'));
  }

  const getHistoryStatus = (stage: string, history: any[]) => {
    if (!history || !Array.isArray(history)) return { exists: false };
    const event = history.find(h => 
      (h.status?.toLowerCase() === stage.toLowerCase()) || 
      (h.status_name?.toLowerCase() === stage.toLowerCase())
    );
    if (event) return { exists: true, ...event };
    return { exists: false };
  };

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
  const formattedServiceFee = formatCurrency(shipment?.service_fee, shipment?.currency);
  const formattedDeclaredValue = formatCurrency(shipment?.declared_value, shipment?.currency);
  const hasFinancials = !!(formattedAssetValue || formattedServiceFee || formattedDeclaredValue);

  // Sender & Receiver
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

  // Geographic locations for map
  const originLoc = shipment?.origin_city_state || shipment?.sender_address || shipment?.origin || '';
  const currentLoc = shipment?.history?.[0]?.location || originLoc;
  const destinationLoc = shipment?.destination_address || shipment?.receiver_address || shipment?.recipient_address || shipment?.destination || '';

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans text-[#141414]">
      {/* Minimalist Sticky Header */}
      <header className="fixed top-0 left-0 right-0 h-[64px] bg-white border-b border-slate-100 flex items-center justify-center z-50 px-6 shadow-xs">
        <div className="flex items-center">
          <span className="text-2xl font-black text-[#4D148C]">Fed</span>
          <span className="text-2xl font-black text-[#FF6600]">Ex</span>
        </div>
      </header>

      <main className="pt-[84px] pb-24 px-4 max-w-4xl mx-auto space-y-6">
        {/* Search Engine */}
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
                placeholder="XXXX XXXX XXXX"
                value={trackingId}
                onChange={handleInputChange}
                className="h-14 text-lg font-mono border-2 border-[#4D148C] rounded-xl focus:ring-0 focus:border-[#4D148C] bg-white px-4"
                onKeyDown={(e) => e.key === 'Enter' && trackShipment()}
              />
            </div>
            <Button 
              onClick={() => trackShipment()}
              disabled={loading}
              className="bg-[#4D148C] hover:bg-[#3a0f6b] text-white h-14 px-8 rounded-xl font-bold transition-all active:scale-95 cursor-pointer"
            >
              {loading ? '...' : 'TRACK'}
            </Button>
          </div>

          {/* Security & Non-collection Guarantee Badge */}
          <div className="bg-white border border-slate-100 rounded-xl p-4 flex items-start gap-3 shadow-xs">
            <div className="w-5 h-5 rounded-full bg-[#4D148C]/10 flex items-center justify-center text-[#4D148C] flex-shrink-0 mt-0.5">
              <span className="text-[10px] font-black">✓</span>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-700">Verified Read-Only Search Portal</p>
              <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                This logistics status portal only accepts 12-digit tracking numbers. We never request passwords, profile logins, credit card information, or physical addresses. All tracking information is completely anonymous and read-only.
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
              {/* Master Card (Expanded Enterprise Bento Design) */}
              <Card className="border border-slate-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-2xl overflow-hidden bg-white">
                <CardContent className="p-6 md:p-8 space-y-6">
                  {/* Top Status Header */}
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#FF6600] animate-ping" />
                        <p className="text-[10px] font-bold text-[#4D148C] uppercase tracking-widest">Shipment Status</p>
                      </div>
                      <h2 className={cn(
                        "text-2xl md:text-3xl font-black tracking-tight uppercase",
                        shipment.status === 'On Hold' ? "text-red-500" : "text-slate-900"
                      )}>
                        {shipment.status}
                      </h2>
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

                  {/* Special Handling Badges (Only rendered if flagged true) */}
                  {specialHandlingBadges.length > 0 && (
                    <div className="space-y-2">
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

                  {/* Inner Bento Box: Sender & Receiver Grid */}
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

                  {/* Financial & Valuation Summary (Strictly > 0) */}
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

                  {/* Delivery Schedule & History Count Bar */}
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
                        {(shipment.history?.length || 0)} of 8 SHIPMENT HISTORY
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Interactive Transit Route Map */}
              <TransitMap
                origin={originLoc}
                currentLocation={currentLoc}
                destination={destinationLoc}
                currentStatus={shipment.status}
              />

              {/* Vertical Journey (SHIPMENT HISTORY) */}
              <div className="bg-white p-6 md:p-8 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-slate-200/80 space-y-8">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Shipment History Milestones</h3>
                  <span className="text-[11px] font-semibold text-[#4D148C]">Standardized FedEx Logistics Network</span>
                </div>
                
                <div className="space-y-0 relative">
                  {MASTER_STAGES.map((stage, index) => {
                    const historyItem = getHistoryStatus(stage, shipment.history);
                    // Match currentStatus with stage (case-insensitive)
                    const currentStatus = shipment.status || shipment.history?.[0]?.status || shipment.history?.[0]?.status_name;
                    const isHead = currentStatus ? currentStatus.trim().toLowerCase() === stage.trim().toLowerCase() : false;
                    const isPast = historyItem.exists || isHead;
                    const isUpcoming = !isPast;

                    return (
                      <div key={stage} className="flex gap-5 min-h-[72px]">
                        <div className="flex flex-col items-center">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center z-10 transition-all duration-300",
                            isHead ? "bg-[#FF6600] scale-110 shadow-md ring-4 ring-[#FF6600]/20" : 
                            isPast ? "bg-[#4D148C]" : "bg-slate-200"
                          )}>
                            {isHead ? (
                              <Truck className="w-4 h-4 text-white" />
                            ) : isPast ? (
                              <div className="w-2.5 h-2.5 rounded-full bg-white" />
                            ) : null}
                          </div>
                          {index !== MASTER_STAGES.length - 1 && (
                            <div className={cn(
                              "w-0.5 flex-grow my-1 transition-colors duration-300",
                              (isPast && !isHead) ? "bg-[#4D148C]" : "bg-slate-200"
                            )} />
                          )}
                        </div>

                        <div className={cn(
                          "pb-8 flex-grow",
                          isUpcoming && "opacity-45"
                        )}>
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <p className={cn(
                                "text-sm leading-tight transition-colors duration-300",
                                isHead ? (stage === 'On Hold' ? "text-red-500 font-black" : "text-slate-900 font-black") : 
                                (isPast && stage === 'On Hold') ? "text-red-500 font-bold" :
                                isPast ? "text-slate-800 font-bold" :
                                "text-slate-400 font-medium"
                              )}>
                                {getStageDisplayLabel(stage)}
                                {isUpcoming && (
                                  <span className="ml-2 text-[8px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                                    Upcoming
                                  </span>
                                )}
                              </p>
                              {isPast && (
                                <p className="text-[12px] text-slate-500 font-medium">
                                  {[historyItem.location, historyItem.timestamp ? formatDate(historyItem.timestamp).replace(' • ', ', ') : null].filter(Boolean).join(' | ')}
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
