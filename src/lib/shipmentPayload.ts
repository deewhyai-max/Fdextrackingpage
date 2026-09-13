import { ShipmentStatus, TrackingHistory } from './supabase';

export interface ShipmentFormData {
  // 1. Core Identifiers & Required Fields
  id?: string;
  user_id?: string;
  recipient_name?: string;
  destination_address?: string;
  status?: ShipmentStatus;
  history?: TrackingHistory[];
  created_at?: string;

  // 2. Sender Details
  sender_name?: string;
  sender_address?: string;
  origin_city_state?: string;

  // 3. Financial & Service Settings
  currency?: string;
  service_type?: string;
  asset_value?: number | string;
  service_fee?: number | string;
  declared_value?: number | string;
  estimated_delivery_date?: string;

  // 4. Package Specifications
  package_type?: string;
  weight?: number | string;
  weight_unit?: 'lbs' | 'kg' | string;
  length?: number | string;
  width?: number | string;
  height?: number | string;
  dimension_unit?: 'in' | 'cm' | string;
  num_packages?: number | string;

  // 5. Special Handling Options
  is_dry_ice?: boolean;
  is_hazardous?: boolean;
  is_saturday_delivery?: boolean;
  signature_option?: 'None' | 'Direct' | 'Indirect' | 'Adult' | string;
  is_hold_at_location?: boolean;
}

export interface ShipmentInsertPayload {
  // 1. Core Identifiers & Required Fields
  id: string;
  user_id: string;
  recipient_name: string;
  destination_address: string | null;
  origin: string | null;
  destination: string | null;
  status: ShipmentStatus;
  history: TrackingHistory[];
  created_at: string;

  // 2. Sender Details
  sender_name: string | null;
  sender_address: string | null;
  origin_city_state: string | null;

  // 3. Financial & Service Settings
  currency: string;
  service_type: string;
  asset_value: number;
  service_fee: number;
  declared_value: number;
  estimated_delivery_date: string | null;

  // 4. Package Specifications
  package_type: string;
  weight: number;
  weight_unit: string;
  length: number;
  width: number;
  height: number;
  dimension_unit: string;
  num_packages: number;

  // 5. Special Handling Options
  is_dry_ice: boolean;
  is_hazardous: boolean;
  is_saturday_delivery: boolean;
  signature_option: string;
  is_hold_at_location: boolean;
}

/**
 * Generate a random 12-digit numeric FedEx tracking number string
 */
export function generate12DigitTrackingId(): string {
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += Math.floor(Math.random() * 10).toString();
  }
  return result;
}

/**
 * Parses numeric input values safely with fallback
 */
function parseNumeric(val: number | string | undefined | null, fallback = 0): number {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  const cleaned = String(val).trim().replace(/[^0-9.-]/g, '');
  if (!cleaned) return fallback;
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Parses integer input values safely with fallback (minimum 1)
 */
function parseInteger(val: number | string | undefined | null, fallback = 1): number {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'number') return isNaN(val) ? fallback : Math.max(1, Math.floor(val));
  const cleaned = String(val).trim().replace(/\D/g, '');
  if (!cleaned) return fallback;
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) || parsed < 1 ? fallback : parsed;
}

/**
 * Normalizes estimated delivery date into YYYY-MM-DD or null
 */
function normalizeDate(rawDate?: string | null): string | null {
  if (!rawDate) return null;
  const trimmed = rawDate.trim();
  if (!trimmed || trimmed === '0') return null;

  // Match YYYY-MM-DD pattern directly
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

/**
 * Builds the exact database payload for the Supabase `shipments` table
 * following all schema requirements and default fallback rules:
 *
 * 1. Core Identifiers & Required Fields:
 *    - id: 12-digit tracking number string
 *    - user_id: Current logged-in user UUID (fallback to 00000000-0000-0000-0000-000000000000 if not authenticated)
 *    - recipient_name: Receiver Name (fallback to 'Unspecified')
 *    - destination_address: Delivery Address (string or null)
 *    - status: 'Shipping label created'
 *    - history: Array containing initial timeline event object
 *    - created_at: Current ISO timestamp string
 *
 * 2. Sender Details:
 *    - sender_name: Sender Name (string or null)
 *    - sender_address: Sender Address (string or null)
 *    - origin_city_state: Sender Address / Origin (string or null)
 *
 * 3. Financial & Service Settings:
 *    - currency: Selected currency code - default: 'USD'
 *    - service_type: Selected service name - default: 'FedEx Priority Overnight'
 *    - asset_value: Numeric value (parsed float) - fallback to 0
 *    - service_fee: Numeric value (parsed float) - fallback to 0
 *    - declared_value: Numeric value (parsed float) - fallback to 0
 *    - estimated_delivery_date: Date string formatted YYYY-MM-DD or null
 *
 * 4. Package Specifications:
 *    - package_type: Selected type - default: 'Box'
 *    - weight: Numeric weight (parsed float) - fallback to 0
 *    - weight_unit: 'lbs' or 'kg' - default: 'lbs'
 *    - length: Numeric length (parsed float) - fallback to 0
 *    - width: Numeric width (parsed float) - fallback to 0
 *    - height: Numeric height (parsed float) - fallback to 0
 *    - dimension_unit: 'in' or 'cm' - default: 'in'
 *    - num_packages: Numeric count (parsed int) - default: 1
 *
 * 5. Special Handling Options:
 *    - is_dry_ice: Boolean - default: false
 *    - is_hazardous: Boolean - default: false
 *    - is_saturday_delivery: Boolean - default: false
 *    - signature_option: 'None', 'Direct', 'Indirect', or 'Adult' - default: 'None'
 *    - is_hold_at_location: Boolean - default: false
 */
export function buildShipmentPayload(
  formData: ShipmentFormData,
  currentUserId?: string | null
): ShipmentInsertPayload {
  // 1. Core Identifiers & Required Fields
  const digitsOnly = (formData.id || '').replace(/\D/g, '');
  const id = digitsOnly.length === 12 ? digitsOnly : generate12DigitTrackingId();
  
  const userId = currentUserId || formData.user_id || '00000000-0000-0000-0000-000000000000';
  const recipientName = (formData.recipient_name || '').trim() || 'Unspecified';
  const destinationAddress = (formData.destination_address || '').trim() || null;
  const createdAt = formData.created_at || new Date().toISOString();

  // 2. Sender Details
  const senderName = (formData.sender_name || '').trim() || null;
  const senderAddress = (formData.sender_address || '').trim() || null;
  const originCityState = (formData.origin_city_state || formData.sender_address || '').trim() || null;

  // Initial timeline event
  const initialHistory: TrackingHistory[] = (formData.history && formData.history.length > 0)
    ? formData.history
    : [
        {
          status: 'Shipping label created',
          location: originCityState || senderAddress || 'FedEx Origin Facility',
          timestamp: createdAt,
          details: 'Shipment information sent to FedEx'
        }
      ];

  // 3. Financial & Service Settings
  const currency = (formData.currency || 'USD').trim().toUpperCase() || 'USD';
  const serviceType = (formData.service_type || '').trim() || 'FedEx Priority Overnight';
  const assetValue = parseNumeric(formData.asset_value, 0);
  const serviceFee = parseNumeric(formData.service_fee, 0);
  const declaredValue = parseNumeric(formData.declared_value, 0);
  const estimatedDeliveryDate = normalizeDate(formData.estimated_delivery_date);

  // 4. Package Specifications
  const packageType = (formData.package_type || '').trim() || 'Box';
  const weight = parseNumeric(formData.weight, 0);
  const weightUnit = (formData.weight_unit || 'lbs').trim() || 'lbs';
  const length = parseNumeric(formData.length, 0);
  const width = parseNumeric(formData.width, 0);
  const height = parseNumeric(formData.height, 0);
  const dimensionUnit = (formData.dimension_unit || 'in').trim() || 'in';
  const numPackages = parseInteger(formData.num_packages, 1);

  // 5. Special Handling Options
  const isDryIce = Boolean(formData.is_dry_ice);
  const isHazardous = Boolean(formData.is_hazardous);
  const isSaturdayDelivery = Boolean(formData.is_saturday_delivery);
  const signatureOption = (formData.signature_option || '').trim() || 'None';
  const isHoldAtLocation = Boolean(formData.is_hold_at_location);

  return {
    id,
    user_id: userId,
    recipient_name: recipientName,
    destination_address: destinationAddress,
    origin: originCityState,
    destination: destinationAddress,
    status: 'Shipping label created',
    history: initialHistory,
    created_at: createdAt,

    sender_name: senderName,
    sender_address: senderAddress,
    origin_city_state: originCityState,

    currency,
    service_type: serviceType,
    asset_value: assetValue,
    service_fee: serviceFee,
    declared_value: declaredValue,
    estimated_delivery_date: estimatedDeliveryDate,

    package_type: packageType,
    weight,
    weight_unit: weightUnit,
    length,
    width,
    height,
    dimension_unit: dimensionUnit,
    num_packages: numPackages,

    is_dry_ice: isDryIce,
    is_hazardous: isHazardous,
    is_saturday_delivery: isSaturdayDelivery,
    signature_option: signatureOption,
    is_hold_at_location: isHoldAtLocation
  };
}
