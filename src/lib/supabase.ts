import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yqruprxxnfpxzduvfrfd.supabase.co';
const supabaseKey = 'sb_publishable_LjUXXjzUgp1tegR_hrXVfg_8duAXn12';

export const supabase = createClient(supabaseUrl, supabaseKey);

export type ShipmentStatus = 
  | 'Shipping label created'
  | 'Package received by FedEx'
  | 'In Transit'
  | 'On the way'
  | 'Arriving at destination facility'
  | 'At local FedEx facility'
  | 'Out for Delivery'
  | 'Delivered'
  | 'On Hold';

export interface RouteWaypoint {
  name?: string;
  location?: string;
  lat?: number;
  lng?: number;
  coordinates?: [number, number];
  timestamp?: string;
  status?: string;
}

export interface TrackingHistory {
  status: ShipmentStatus | string;
  location: string;
  timestamp: string;
  details?: string;
  lat?: number;
  lng?: number;
}

export interface Shipment {
  id: string;
  user_id?: string;
  status: ShipmentStatus | string;
  origin?: string;
  origin_city_state?: string;
  destination?: string;
  destination_address?: string;
  created_at?: string;
  estimated_delivery_date: string;
  history: TrackingHistory[];
  recipient_name?: string;
  recipient_address?: string;
  receiver_address?: string;
  asset_value?: number;
  service_fee?: number;

  // New 8-Stage Automated Route Engine fields
  route_waypoints?: (string | RouteWaypoint | [number, number])[];
  auto_advance?: boolean;
  is_on_hold?: boolean;

  // Sender details
  sender_name?: string;
  sender_address?: string;

  // Currency & Service
  currency?: string;
  service_type?: string;

  // Package specifications
  package_name?: string;
  shipment_name?: string;
  package_type?: string;
  weight?: string | number;
  weight_unit?: string;
  length?: number;
  width?: number;
  height?: number;
  dimension_unit?: string;
  num_packages?: number;
  package_count?: number;
  pieces?: number;
  declared_value?: number;
  dimensions?: string;

  // Special handling & Delivery options
  is_dry_ice?: boolean;
  is_hazardous?: boolean;
  is_saturday_delivery?: boolean;
  signature_option?: string;
  is_hold_at_location?: boolean;
}
