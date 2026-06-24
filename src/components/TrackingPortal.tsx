import React, { useState, useEffect, useCallback } from 'react';
import { Search, Clock, Truck, MapPin, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase, Shipment, ShipmentStatus } from '@/src/lib/supabase';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

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
  if (stage === 'Package received by FedEx') {
    return 'Package received by logistics hub';
  }
  return stage;
};

export default function TrackingPortal() {
  const [trackingId, setTrackingId] = useState('');
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
    if (id.length !== 12) return;

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
    const params = new URLSearchParams(window.location.search);
    const idFromUrl = params.get('id');
    if (idFromUrl) {
      const formatted = formatId(idFromUrl);
      setTrackingId(formatted);
      trackShipment(formatted);
    }
  }, []);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'TBD';
    
    // Safety check for Safari: Replace spaces with 'T' to ensure valid ISO format
    // and handle potential missing timezone info by assuming UTC if not specified
    let normalized = dateStr.trim();
    if (normalized.includes(' ') && !normalized.includes('T')) {
      normalized = normalized.replace(' ', 'T');
    }
    
    const date = NewDate(normalized);
    if (isNaN(date.getTime())) return 'Invalid Date';
    
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

  // Helper to ensure date construction is handled consistently
  function NewDate(str: string) {
    return new Date(str.includes('T') || str.includes('Z') ? str : str.replace(/-/g, '/'));
  }

  const getHistoryStatus = (stage: string, history: any[]) => {
    if (!history) return { exists: false };
    // Fuzzy matching: lowercase comparison
    const event = history.find(h => 
      (h.status?.toLowerCase() === stage.toLowerCase()) || 
      (h.status_name?.toLowerCase() === stage.toLowerCase())
    );
    if (event) return { exists: true, ...event };
    return { exists: false };
  };

  const showPackageDetails = shipment ? (
    !shipment.asset_value || 
    !!(shipment.package_type || shipment.weight || shipment.dimensions || shipment.package_count || shipment.num_packages || shipment.pieces)
  ) : false;

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans text-[#141414]">
      {/* Minimalist Sticky Header */}
      <header className="fixed top-0 left-0 right-0 h-[64px] bg-white border-b border-slate-100 flex items-center justify-between z-50 px-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-[#1E3A8A]" />
          <span className="text-xl font-bold tracking-tight text-[#0F172A]">
            spfxtracking
          </span>
          <span className="text-[9px] font-black uppercase tracking-wider text-[#0EA5E9] bg-[#0EA5E9]/5 border border-[#0EA5E9]/20 px-2 py-0.5 rounded-full ml-1">
            Secure Portal
          </span>
        </div>
        <div className="text-[11px] font-medium text-slate-400">
          Independent Logistics Verification
        </div>
      </header>

      <main className="pt-[84px] pb-20 px-4 max-w-lg mx-auto space-y-6">
        {/* Search Engine */}
        <div className="space-y-4">
          {errorStatus && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-4">
              {errorStatus}
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
                className="h-14 text-lg font-mono border-2 border-[#1E3A8A] rounded-xl focus:ring-0 focus:border-[#1E3A8A] bg-white px-4"
                onKeyDown={(e) => e.key === 'Enter' && trackShipment()}
              />
            </div>
            <Button 
              onClick={() => trackShipment()}
              disabled={loading}
              className="bg-[#1E3A8A] hover:bg-[#1D4ED8] text-white h-14 px-8 rounded-xl font-bold transition-all active:scale-95"
            >
              {loading ? '...' : 'TRACK'}
            </Button>
          </div>

          {/* Security & Non-collection Guarantee Badge */}
          <div className="bg-white border border-slate-100 rounded-xl p-4 flex items-start gap-3 shadow-sm">
            <div className="w-5 h-5 rounded-full bg-[#1E3A8A]/10 flex items-center justify-center text-[#1E3A8A] flex-shrink-0 mt-0.5">
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
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              {/* Master Card (Bento Design) */}
              <Card className="border-none shadow-[0_4px_20px_rgba(0,0,0,0.05)] rounded-2xl overflow-hidden bg-white isolate ring-1 ring-black/5">
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-[#1E3A8A] uppercase tracking-widest">Current Status</p>
                    <h2 className={cn(
                      "text-3xl font-black tracking-tight uppercase",
                      shipment.status === 'On Hold' ? "text-red-500" : "text-black"
                    )}>
                      {shipment.status}
                    </h2>
                  </div>

                  {/* Inner Gray Card (The Bento Box) */}
                  <div className="bg-[#F3F4F6] rounded-2xl p-5 space-y-5">
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-1">
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Primary Receiver</p>
                        <p className="text-sm font-bold text-black">{shipment.recipient_name || 'Residential'}</p>
                      </div>
                      
                      {!showPackageDetails ? (
                        <div className={cn(
                          "grid gap-4",
                          (shipment.service_fee !== undefined && shipment.service_fee > 0) ? "grid-cols-2" : "grid-cols-1"
                        )}>
                          <div className="space-y-1">
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Total Shipment Value</p>
                            <p className="text-sm font-bold text-black">${shipment.asset_value?.toLocaleString() || '0.00'}</p>
                          </div>
                          {shipment.service_fee !== undefined && shipment.service_fee > 0 && (
                            <div className="space-y-1">
                              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Shipping/Service Fee</p>
                              <p className="text-sm font-bold text-black">${shipment.service_fee.toLocaleString()}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3 pt-2 border-t border-gray-200">
                          <p className="text-[10px] font-bold text-[#1E3A8A] uppercase tracking-wider">Package Details</p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                            <div className="space-y-0.5">
                              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Package Type</p>
                              <p className="text-xs font-bold text-black">{shipment.package_type || 'Standard Box'}</p>
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Weight</p>
                              <p className="text-xs font-bold text-black">
                                {shipment.weight ? (typeof shipment.weight === 'number' ? `${shipment.weight} lbs` : shipment.weight) : '15.4 lbs'}
                              </p>
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Dimensions</p>
                              <p className="text-xs font-bold text-black">
                                {shipment.dimensions || (shipment.length && shipment.width && shipment.height ? `${shipment.length} × ${shipment.width} × ${shipment.height} in` : '12 × 10 × 8 in')}
                              </p>
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Number of Packages</p>
                              <p className="text-xs font-bold text-black">
                                {shipment.package_count ?? shipment.num_packages ?? shipment.pieces ?? 1} pkg(s)
                              </p>
                            </div>
                          </div>
                          {shipment.service_fee !== undefined && shipment.service_fee > 0 && (
                            <div className="pt-2 border-t border-gray-200">
                              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Shipping/Service Fee</p>
                              <p className="text-xs font-bold text-black">${shipment.service_fee.toLocaleString()}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="h-px bg-gray-200 w-full" />

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Estimated Delivery Date</p>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-[#1E3A8A]" />
                          <p className="text-sm font-bold text-black">{formatDate(shipment.estimated_delivery_date).split(' • ')[0]}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-[#1E3A8A] uppercase tracking-widest">
                          {shipment.history.length} of 8 SHIPMENT HISTORY
                        </p>
                        <p className="text-[8px] text-gray-400 mt-0.5 font-medium">Secured by spfx</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Vertical Journey (SHIPMENT HISTORY) */}
              <div className="bg-white p-6 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] space-y-8">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] px-1">Shipment History</h3>
                
                <div className="space-y-0 relative">
                  {MASTER_STAGES.map((stage, index) => {
                    const historyItem = getHistoryStatus(stage, shipment.history);
                    // The "Head" is the most recent entry in the history array (assuming index 0 is newest)
                    const latestStatus = shipment.history[0]?.status || shipment.history[0]?.status_name;
                    const isHead = latestStatus?.toLowerCase() === stage.toLowerCase();
                    const isPast = historyItem.exists;
                    const isUpcoming = !isPast;

                    return (
                      <div key={stage} className="flex gap-5 min-h-[70px]">
                        <div className="flex flex-col items-center">
                          <div className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center z-10 transition-all duration-500",
                            isHead ? "bg-[#0EA5E9] scale-125 shadow-lg" : 
                            isPast ? "bg-[#1E3A8A]" : "bg-[#E5E7EB]"
                          )}>
                            {isHead ? (
                              <Truck className="w-4 h-4 text-white" />
                            ) : isPast ? (
                              <div className="w-2 h-2 rounded-full bg-white" />
                            ) : null}
                          </div>
                          {index !== MASTER_STAGES.length - 1 && (
                            <div className={cn(
                              "w-0.5 flex-grow my-1 transition-colors duration-500",
                              (isPast && !isHead) ? "bg-[#1E3A8A]" : "bg-[#E5E7EB]"
                            )} />
                          )}
                        </div>

                        <div className={cn(
                          "pb-8 flex-grow",
                          isUpcoming && "opacity-40"
                        )}>
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <p className={cn(
                                "text-sm leading-tight transition-colors duration-300",
                                isHead ? (stage === 'On Hold' ? "text-red-500 font-black" : "text-black font-black") : 
                                (isPast && stage === 'On Hold') ? "text-red-500 font-bold" :
                                isPast ? "text-gray-700 font-bold" :
                                "text-gray-400 font-medium"
                              )}>
                                {getStageDisplayLabel(stage)}
                                {isUpcoming && (
                                  <span className="ml-2 text-[8px] font-black uppercase tracking-widest text-gray-300 bg-gray-100 px-1.5 py-0.5 rounded">
                                    Upcoming
                                  </span>
                                )}
                              </p>
                              {isPast && (
                                <p className="text-[12px] text-gray-400 font-medium">
                                  {historyItem.location} | {formatDate(historyItem.timestamp).replace(' • ', ', ')}
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
              <Package className="w-16 h-16 text-gray-200 mx-auto" />
              <p className="text-gray-400 font-medium">Tracking ID not recognized.</p>
            </motion.div>
          ) : !loading && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20 space-y-4"
            >
              <Search className="w-16 h-16 text-gray-100 mx-auto" />
              <p className="text-gray-300 font-medium">Enter a 12-digit tracking number</p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
