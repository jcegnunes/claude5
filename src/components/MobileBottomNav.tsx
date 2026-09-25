import React from 'react';
import { LayoutDashboard, FlaskConical, Shield, QrCode, RefreshCw } from 'lucide-react';

interface MobileBottomNavProps {
  activeView: string;
  onNavigate: (view: string) => void;
  onOpenQRScanner: () => void;
  pendingSyncCount: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeView,
  onNavigate,
  onOpenQRScanner,
  pendingSyncCount
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0A2540] border-t border-slate-800 text-white flex items-center justify-around h-16 px-2 shadow-2xl safe-area-pb">
      <button
        onClick={() => onNavigate('dashboard')}
        className={`flex flex-col items-center justify-center w-14 h-full gap-1 ${
          activeView === 'dashboard' ? 'text-orange-400 font-bold' : 'text-slate-400'
        }`}
      >
        <LayoutDashboard className="w-5 h-5" />
        <span className="text-[10px]">Início</span>
      </button>

      <button
        onClick={() => onNavigate('equipment')}
        className={`flex flex-col items-center justify-center w-14 h-full gap-1 ${
          activeView === 'equipment' ? 'text-orange-400 font-bold' : 'text-slate-400'
        }`}
      >
        <Shield className="w-5 h-5" />
        <span className="text-[10px]">EPI/EPC</span>
      </button>

      {/* Central QR Code Scanner Button */}
      <button
        onClick={onOpenQRScanner}
        className="flex flex-col items-center justify-center -translate-y-4 w-13 h-13 rounded-full bg-orange-500 hover:bg-orange-600 text-white shadow-lg border-4 border-slate-900 transition-transform active:scale-95"
        title="Escanear QR Code"
      >
        <QrCode className="w-6 h-6" />
      </button>

      <button
        onClick={() => onNavigate('wizard')}
        className={`flex flex-col items-center justify-center w-14 h-full gap-1 ${
          activeView === 'wizard' ? 'text-orange-400 font-bold' : 'text-slate-400'
        }`}
      >
        <FlaskConical className="w-5 h-5" />
        <span className="text-[10px]">Ensaio</span>
      </button>

      <button
        onClick={() => onNavigate('sync')}
        className={`relative flex flex-col items-center justify-center w-14 h-full gap-1 ${
          activeView === 'sync' ? 'text-orange-400 font-bold' : 'text-slate-400'
        }`}
      >
        <RefreshCw className="w-5 h-5" />
        <span className="text-[10px]">Sync</span>
        {pendingSyncCount > 0 && (
          <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-amber-500 text-slate-950 font-bold text-[9px] flex items-center justify-center">
            {pendingSyncCount}
          </span>
        )}
      </button>
    </nav>
  );
};
