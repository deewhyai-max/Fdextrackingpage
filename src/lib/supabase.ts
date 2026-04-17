import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yqruprxxnfpxzduvfrfd.supabase.co';
const supabaseKey = 'sb_publishable_LjUXXjzUgp1tegR_hrXVfg_8duAXn12';

export const supabase = createClient(supabaseUrl, supabaseKey);

export type ShipmentStatus = 
  | 'Shipping label created'
  | 'Package received by FedEx'
  | 'In Transit'
  | 'On the way'
  | 'Out for Delivery'
  | 'Arriving at destination facility'
  | 'On Hold'
  | 'Delivered';

export interface TrackingHistory {
  status: ShipmentStatus;
  location: string;
  timestamp: string;
  details?: string;
}

export interface Shipment {
  id: string;
  status: ShipmentStatus;
  origin: string;
  destination: string;
  estimated_delivery_date: string;
  history: TrackingHistory[];
  recipient_name?: string;
  asset_value?: number;
  service_fee?: number;
}
