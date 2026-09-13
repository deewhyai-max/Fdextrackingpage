import React, { useState } from 'react';
import { 
  Package, 
  Send, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  ExternalLink, 
  RefreshCw,
  Building2,
  UserCheck,
  DollarSign,
  Layers,
  ShieldCheck,
  Snowflake,
  AlertTriangle,
  Calendar,
  FileCheck,
  Route
} from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { 
  buildShipmentPayload, 
  generate12DigitTrackingId, 
  ShipmentFormData, 
  ShipmentInsertPayload 
} from '@/src/lib/shipmentPayload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface ShipmentInitializationEngineProps {
  onShipmentCreated?: (trackingId: string) => void;
}

export default function ShipmentInitializationEngine({ onShipmentCreated }: ShipmentInitializationEngineProps) {
  // Form State with standard defaults
  const [formData, setFormData] = useState<ShipmentFormData>({
    id: generate12DigitTrackingId(),
    recipient_name: '',
    destination_address: '',
    estimated_delivery_date: '',

    sender_name: 'FedEx Global Logistics Hub',
    sender_address: '3610 Hacks Cross Rd, Memphis, TN 38125',
    origin_city_state: 'Memphis, TN',

    currency: 'USD',
    service_type: 'FedEx Priority Overnight',
    asset_value: '',
    service_fee: '',
    declared_value: '',

    package_type: 'FedEx Box',
    weight: '5.0',
    weight_unit: 'lbs',
    length: '12',
    width: '10',
    height: '6',
    dimension_unit: 'in',
    num_packages: 1,

    is_dry_ice: false,
    is_hazardous: false,
    is_saturday_delivery: false,
    signature_option: 'None',
    is_hold_at_location: false,
    auto_advance: false,
    is_on_hold: false,
  });

  const [waypointInput, setWaypointInput] = useState('St. Louis, MO; Indianapolis, IN; Columbus, OH');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successPayload, setSuccessPayload] = useState<ShipmentInsertPayload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [showPayloadPreview, setShowPayloadPreview] = useState(false);

  // Generate new 12-digit ID
  const handleRegenerateId = () => {
    setFormData(prev => ({
      ...prev,
      id: generate12DigitTrackingId()
    }));
  };

  // Format 12-digit tracking number with spaces
  const formatTrackingNumber = (val?: string) => {
    if (!val) return '';
    const digits = val.replace(/\D/g, '').slice(0, 12);
    const groups = digits.match(/.{1,4}/g) || [];
    return groups.join(' ');
  };

  // Handle input change
  const handleChange = (field: keyof ShipmentFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessPayload(null);

    try {
      // Get current authenticated user UUID if available
      let currentUserId: string | null = null;
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user?.id) {
          currentUserId = authData.user.id;
        }
      } catch {
        // Safe fallback if auth session is unavailable
      }

      // Parse intermediate waypoints
      const parsedWaypoints = waypointInput
        .split(/[;,]/)
        .map(w => w.trim())
        .filter(w => w.length > 0)
        .map(w => ({ name: w, location: w }));

      const submissionData: ShipmentFormData = {
        ...formData,
        route_waypoints: parsedWaypoints
      };

      // Build strictly aligned database payload using our engine builder
      const payload: ShipmentInsertPayload = buildShipmentPayload(submissionData, currentUserId);

      // Submit to Supabase shipments table
      const { data, error } = await supabase
        .from('shipments')
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.error('Supabase Insert Error:', error);
        setErrorMessage(error.message || 'Failed to initialize shipment in database.');
        return;
      }

      setSuccessPayload(payload);

      if (onShipmentCreated) {
        onShipmentCreated(payload.id);
      }
    } catch (err: any) {
      console.error('Submission Error:', err);
      setErrorMessage(err?.message || 'An unexpected error occurred during initialization.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyTrackingId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#4D148C] to-[#360e63] text-white p-6 md:p-8 rounded-2xl shadow-lg space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-[#FF6600] text-white text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded">
                Admin Engine
              </span>
              <p className="text-xs font-semibold text-purple-200">FedEx Enterprise Logistics</p>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight mt-1">
              Shipment Initialization Engine
            </h1>
            <p className="text-xs md:text-sm text-purple-200/90 max-w-2xl mt-1">
              Generate 12-digit tracking numbers, configure full package specifications, routing points, financial metrics, and special handling options mapped directly to Supabase.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-xs border border-white/15 p-3 rounded-xl flex items-center gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-purple-200">Active Tracking Number</p>
              <p className="text-lg font-mono font-bold text-white tracking-widest">
                {formatTrackingNumber(formData.id)}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRegenerateId}
              className="bg-white/20 hover:bg-white/30 text-white border-white/30 cursor-pointer h-9 px-3"
            >
              <RefreshCw className="w-4 h-4 mr-1.5" />
              Generate
            </Button>
          </div>
        </div>
      </div>

      {/* Success Notification Alert */}
      {successPayload && (
        <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl space-y-4 shadow-xs animate-in fade-in slide-in-from-top-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-emerald-950">Shipment Initialized Successfully</h3>
                <p className="text-xs text-emerald-700">
                  Initial timeline milestone "Shipping label created" recorded in Supabase database.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyTrackingId(successPayload.id)}
                className="bg-white hover:bg-emerald-50 text-emerald-900 border-emerald-300 font-bold text-xs cursor-pointer"
              >
                {copiedId ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                {copiedId ? 'Copied' : 'Copy ID'}
              </Button>
              <a
                href={`/?id=${successPayload.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1 bg-[#4D148C] hover:bg-[#3b0f6c] text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors"
              >
                <span>Track on Portal</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-emerald-200/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-400 font-bold uppercase text-[9px]">Tracking ID</span>
              <p className="font-mono font-bold text-slate-900 text-sm">{formatTrackingNumber(successPayload.id)}</p>
            </div>
            <div>
              <span className="text-slate-400 font-bold uppercase text-[9px]">Recipient</span>
              <p className="font-semibold text-slate-900">{successPayload.recipient_name}</p>
            </div>
            <div>
              <span className="text-slate-400 font-bold uppercase text-[9px]">Service Type</span>
              <p className="font-semibold text-slate-900">{successPayload.service_type}</p>
            </div>
            <div>
              <span className="text-slate-400 font-bold uppercase text-[9px]">Status</span>
              <span className="inline-block px-2 py-0.5 rounded bg-purple-100 text-[#4D148C] font-bold text-[10px]">
                {successPayload.status}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center gap-3 text-red-700 text-sm font-medium">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Core Identifiers */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Package className="w-5 h-5 text-[#4D148C]" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              1. Core Identifiers & Delivery Schedule
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">12-Digit Tracking ID *</label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  maxLength={12}
                  value={formData.id}
                  onChange={(e) => handleChange('id', e.target.value.replace(/\D/g, '').slice(0, 12))}
                  className="font-mono font-bold text-base border-slate-300"
                  placeholder="12-digit number"
                  required
                />
                <Button 
                  type="button" 
                  onClick={handleRegenerateId}
                  variant="outline"
                  className="text-xs font-semibold cursor-pointer"
                >
                  Generate
                </Button>
              </div>
              <p className="text-[10px] text-slate-400">Database format: 12 numeric digits without spaces</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Estimated Delivery Date (YYYY-MM-DD)</label>
              <Input
                type="date"
                value={formData.estimated_delivery_date || ''}
                onChange={(e) => handleChange('estimated_delivery_date', e.target.value)}
                className="border-slate-300"
              />
              <p className="text-[10px] text-slate-400">Leaves as null if unspecified</p>
            </div>
          </div>
        </div>

        {/* Section 2: Sender & Receiver Details */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building2 className="w-5 h-5 text-[#4D148C]" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              2. Sender & Destination Details
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Sender Column */}
            <div className="space-y-3 p-4 bg-slate-50/70 rounded-xl border border-slate-200/60">
              <p className="text-[11px] font-bold text-[#4D148C] uppercase tracking-wider">Sender Origin</p>
              
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Sender Name</label>
                <Input
                  type="text"
                  placeholder="e.g. FedEx World Hub"
                  value={formData.sender_name || ''}
                  onChange={(e) => handleChange('sender_name', e.target.value)}
                  className="bg-white border-slate-300"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Sender Address</label>
                <Input
                  type="text"
                  placeholder="e.g. 3610 Hacks Cross Rd"
                  value={formData.sender_address || ''}
                  onChange={(e) => handleChange('sender_address', e.target.value)}
                  className="bg-white border-slate-300"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Origin City / State</label>
                <Input
                  type="text"
                  placeholder="e.g. Memphis, TN"
                  value={formData.origin_city_state || ''}
                  onChange={(e) => handleChange('origin_city_state', e.target.value)}
                  className="bg-white border-slate-300"
                />
              </div>
            </div>

            {/* Receiver Column */}
            <div className="space-y-3 p-4 bg-slate-50/70 rounded-xl border border-slate-200/60">
              <p className="text-[11px] font-bold text-[#FF6600] uppercase tracking-wider">Primary Receiver</p>
              
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Recipient Name</label>
                <Input
                  type="text"
                  placeholder="e.g. Jane Doe (Fallback: 'Unspecified')"
                  value={formData.recipient_name || ''}
                  onChange={(e) => handleChange('recipient_name', e.target.value)}
                  className="bg-white border-slate-300"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Destination Delivery Address</label>
                <Input
                  type="text"
                  placeholder="e.g. 500 5th Ave, New York, NY 10110"
                  value={formData.destination_address || ''}
                  onChange={(e) => handleChange('destination_address', e.target.value)}
                  className="bg-white border-slate-300"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Financial & Service Settings */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <DollarSign className="w-5 h-5 text-[#4D148C]" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              3. Financial & Service Settings
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Currency Code</label>
              <select
                value={formData.currency}
                onChange={(e) => handleChange('currency', e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#4D148C]"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CAD">CAD (CA$)</option>
                <option value="NGN">NGN (₦)</option>
                <option value="AUD">AUD (A$)</option>
                <option value="JPY">JPY (¥)</option>
              </select>
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700">FedEx Service Type</label>
              <select
                value={formData.service_type}
                onChange={(e) => handleChange('service_type', e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#4D148C]"
              >
                <option value="FedEx Priority Overnight">FedEx Priority Overnight</option>
                <option value="FedEx Standard Overnight">FedEx Standard Overnight</option>
                <option value="FedEx 2Day">FedEx 2Day</option>
                <option value="FedEx Express Saver">FedEx Express Saver</option>
                <option value="FedEx Ground">FedEx Ground</option>
                <option value="FedEx Home Delivery">FedEx Home Delivery</option>
                <option value="FedEx International Priority">FedEx International Priority</option>
                <option value="FedEx International Economy">FedEx International Economy</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Total Asset Value</label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.asset_value || ''}
                onChange={(e) => handleChange('asset_value', e.target.value)}
                className="border-slate-300"
              />
              <p className="text-[10px] text-slate-400">Stored as numeric float (default: 0)</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Declared Value</label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.declared_value || ''}
                onChange={(e) => handleChange('declared_value', e.target.value)}
                className="border-slate-300"
              />
              <p className="text-[10px] text-slate-400">Stored as numeric float (default: 0)</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Shipping & Service Fee</label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.service_fee || ''}
                onChange={(e) => handleChange('service_fee', e.target.value)}
                className="border-slate-300"
              />
              <p className="text-[10px] text-slate-400">Stored as numeric float (default: 0)</p>
            </div>
          </div>
        </div>

        {/* Section 4: Package Specifications */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Layers className="w-5 h-5 text-[#4D148C]" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              4. Package Specifications
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700">Package Type</label>
              <select
                value={formData.package_type}
                onChange={(e) => handleChange('package_type', e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#4D148C]"
              >
                <option value="FedEx Box">FedEx Box</option>
                <option value="FedEx Envelope">FedEx Envelope</option>
                <option value="FedEx Pak">FedEx Pak</option>
                <option value="FedEx Tube">FedEx Tube</option>
                <option value="Customer Packaging">Customer Packaging</option>
                <option value="Box">Box</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Number of Packages</label>
              <Input
                type="number"
                min="1"
                value={formData.num_packages || 1}
                onChange={(e) => handleChange('num_packages', e.target.value)}
                className="border-slate-300"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Weight & Unit</label>
              <div className="flex gap-1.5">
                <Input
                  type="number"
                  step="0.1"
                  placeholder="0.0"
                  value={formData.weight || ''}
                  onChange={(e) => handleChange('weight', e.target.value)}
                  className="border-slate-300 flex-grow"
                />
                <select
                  value={formData.weight_unit}
                  onChange={(e) => handleChange('weight_unit', e.target.value)}
                  className="w-20 h-10 px-2 rounded-lg border border-slate-300 bg-white text-xs font-bold"
                >
                  <option value="lbs">lbs</option>
                  <option value="kg">kg</option>
                </select>
              </div>
            </div>

            {/* Dimensions */}
            <div className="sm:col-span-2 md:col-span-4 space-y-1">
              <label className="text-xs font-semibold text-slate-700">Dimensions (L × W × H) & Unit</label>
              <div className="grid grid-cols-4 gap-2">
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Length"
                  value={formData.length || ''}
                  onChange={(e) => handleChange('length', e.target.value)}
                  className="border-slate-300"
                />
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Width"
                  value={formData.width || ''}
                  onChange={(e) => handleChange('width', e.target.value)}
                  className="border-slate-300"
                />
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Height"
                  value={formData.height || ''}
                  onChange={(e) => handleChange('height', e.target.value)}
                  className="border-slate-300"
                />
                <select
                  value={formData.dimension_unit}
                  onChange={(e) => handleChange('dimension_unit', e.target.value)}
                  className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs font-bold"
                >
                  <option value="in">in</option>
                  <option value="cm">cm</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Section 5: Special Handling Options */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <ShieldCheck className="w-5 h-5 text-[#4D148C]" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              5. Special Handling & Delivery Options
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1 sm:col-span-2 md:col-span-1">
              <label className="text-xs font-semibold text-slate-700">Signature Option</label>
              <select
                value={formData.signature_option}
                onChange={(e) => handleChange('signature_option', e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#4D148C]"
              >
                <option value="None">None (Default)</option>
                <option value="Direct">Direct Signature Required</option>
                <option value="Indirect">Indirect Signature Required</option>
                <option value="Adult">Adult Signature Required</option>
              </select>
            </div>

            <div className="sm:col-span-2 space-y-3 pt-1">
              <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(formData.is_dry_ice)}
                  onChange={(e) => handleChange('is_dry_ice', e.target.checked)}
                  className="w-4 h-4 rounded text-[#4D148C] focus:ring-[#4D148C] cursor-pointer"
                />
                <Snowflake className="w-4 h-4 text-sky-600" />
                <span>Dry Ice (Special Cold Chain Delivery)</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(formData.is_hazardous)}
                  onChange={(e) => handleChange('is_hazardous', e.target.checked)}
                  className="w-4 h-4 rounded text-[#4D148C] focus:ring-[#4D148C] cursor-pointer"
                />
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Hazardous Materials / Dangerous Goods</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(formData.is_saturday_delivery)}
                  onChange={(e) => handleChange('is_saturday_delivery', e.target.checked)}
                  className="w-4 h-4 rounded text-[#4D148C] focus:ring-[#4D148C] cursor-pointer"
                />
                <Calendar className="w-4 h-4 text-indigo-600" />
                <span>Saturday Delivery Guaranteed</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(formData.is_hold_at_location)}
                  onChange={(e) => handleChange('is_hold_at_location', e.target.checked)}
                  className="w-4 h-4 rounded text-[#4D148C] focus:ring-[#4D148C] cursor-pointer"
                />
                <Building2 className="w-4 h-4 text-emerald-600" />
                <span>Hold at FedEx OnSite Location</span>
              </label>
            </div>
          </div>
        </div>

        {/* Section 6: 8-Stage Automated Route Engine */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Route className="w-5 h-5 text-[#FF6600]" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              6. 8-Stage Automated Route Engine & Transit Control
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Initial Stage</label>
              <select
                value={formData.status || 'Shipping label created'}
                onChange={(e) => handleChange('status', e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#4D148C]"
              >
                <option value="Shipping label created">1. Shipping label created</option>
                <option value="Package received by FedEx">2. Package received by FedEx</option>
                <option value="In Transit">3. In Transit</option>
                <option value="On the way">4. On the way</option>
                <option value="Arriving at destination facility">5. Arriving at destination facility</option>
                <option value="At local FedEx facility">6. At local FedEx facility</option>
                <option value="Out for Delivery">7. Out for Delivery</option>
                <option value="Delivered">8. Delivered</option>
              </select>
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700">
                Intermediate Route Waypoints (Semicolon or comma-separated)
              </label>
              <Input
                placeholder="e.g. Nashville, TN; Louisville, KY; Columbus, OH"
                value={waypointInput}
                onChange={(e) => setWaypointInput(e.target.value)}
                className="border-slate-300 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(formData.auto_advance)}
                onChange={(e) => handleChange('auto_advance', e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded text-[#4D148C] focus:ring-[#4D148C] cursor-pointer"
              />
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-900">Auto-Advance Route Engine</p>
                <p className="text-[11px] text-slate-500">
                  Automatically progresses stages forward based on milestone timeline clock comparison.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50/40 hover:bg-amber-50 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(formData.is_on_hold)}
                onChange={(e) => handleChange('is_on_hold', e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded text-[#FF6600] focus:ring-[#FF6600] cursor-pointer"
              />
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-amber-900">Master "On Hold" Override</p>
                <p className="text-[11px] text-amber-800">
                  Freezes route advancement at the active milestone and renders prominent orange hold badge.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowPayloadPreview(!showPayloadPreview)}
            className="text-xs text-slate-500 font-semibold cursor-pointer"
          >
            {showPayloadPreview ? 'Hide Payload Preview' : 'Inspect JSON Payload Builder'}
          </Button>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-[#FF6600] hover:bg-[#e05a00] text-white font-bold h-12 px-8 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>INITIALIZING SHIPMENT...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>INITIALIZE SHIPMENT & RECORD IN SUPABASE</span>
              </>
            )}
          </Button>
        </div>

        {/* Collapsible JSON Preview */}
        {showPayloadPreview && (
          <div className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase tracking-wider">
              <span>Real-Time Schema Payload Inspector</span>
              <span>buildShipmentPayload() output</span>
            </div>
            <pre>{JSON.stringify(buildShipmentPayload(formData), null, 2)}</pre>
          </div>
        )}
      </form>
    </div>
  );
}
