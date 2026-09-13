import React, { useState } from 'react';
import TrackingPortal from './components/TrackingPortal';
import ShipmentInitializationEngine from './components/ShipmentInitializationEngine';
import { PackagePlus, Search } from 'lucide-react';

export default function App() {
  const [viewMode, setViewMode] = useState<'portal' | 'admin'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('view') === 'admin' || params.get('mode') === 'admin') {
        return 'admin';
      }
    }
    return 'portal';
  });

  const [activeTrackingId, setActiveTrackingId] = useState<string | undefined>(undefined);

  const handleShipmentCreated = (newId: string) => {
    setActiveTrackingId(newId);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Top Application Switcher Bar */}
      <nav className="bg-[#4D148C] text-white px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 border-b border-purple-950/20 shadow-xs z-50 relative">
        <div className="flex items-center gap-2">
          <span className="font-black text-[#FF6600] text-sm">FedEx</span>
          <span className="text-purple-300/40">|</span>
          <span className="font-semibold text-purple-100 tracking-wide text-xs">
            {viewMode === 'admin'
              ? 'Shipment Initialization Engine (Admin Dashboard)'
              : 'Enterprise Tracking Portal'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setViewMode('portal')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
              viewMode === 'portal'
                ? 'bg-white text-[#4D148C] shadow-sm'
                : 'text-purple-200 hover:text-white hover:bg-white/10'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Tracking Portal</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('admin')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
              viewMode === 'admin'
                ? 'bg-[#FF6600] text-white shadow-sm'
                : 'text-purple-200 hover:text-white hover:bg-white/10'
            }`}
          >
            <PackagePlus className="w-3.5 h-3.5" />
            <span>Shipment Engine (Admin)</span>
            <span className="bg-black/20 text-[10px] px-1.5 py-0.5 rounded font-mono font-normal">
              Supabase
            </span>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      {viewMode === 'admin' ? (
        <main className="py-8 px-4">
          <ShipmentInitializationEngine
            onShipmentCreated={(createdId) => {
              handleShipmentCreated(createdId);
            }}
          />
        </main>
      ) : (
        <TrackingPortal initialId={activeTrackingId} />
      )}
    </div>
  );
}
