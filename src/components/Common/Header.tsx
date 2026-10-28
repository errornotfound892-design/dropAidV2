import React from 'react';
import { ViewMode } from '../../types/index.ts';
import { Siren, RefreshCw, User, Headset, PhoneCall, Building2, UserCircle } from 'lucide-react';

interface HeaderProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  onReset: () => void;
  activeBookingCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onViewChange,
  onReset,
  activeBookingCount,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/98 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-2 shrink-0">
          <div>
            <span className="text-xl font-extrabold tracking-tight text-slate-900 whitespace-nowrap">
              Drop<span className="text-sky-600">Aid</span>
            </span>
          </div>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="flex items-center gap-3 sm:gap-5 text-xs font-semibold text-slate-600">
          <button
            onClick={() => onViewChange('hospitals')}
            className={`hover:text-sky-600 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
              currentView === 'hospitals'
                ? 'text-sky-600 font-bold bg-sky-50 px-2.5 py-1 rounded-md'
                : ''
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-sky-600" />
            <span>Hospitals</span>
          </button>
          <button
            onClick={() => onViewChange('profile')}
            className={`hover:text-sky-600 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
              currentView === 'profile'
                ? 'text-sky-600 font-bold bg-sky-50 px-2.5 py-1 rounded-md'
                : ''
            }`}
          >
            <UserCircle className="w-3.5 h-3.5 text-sky-600" />
            <span>My Profile</span>
          </button>
          <a
            href="tel:112"
            className="text-rose-600 hover:text-rose-700 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 font-bold"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Emergency 112</span>
          </a>
        </nav>

        {/* Zone 3: EXACT THREE PRIMARY CONTROLS: User, Operator, Reset */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Segmented View Switcher: User & Operator */}
          <div className="flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => onViewChange('user')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                currentView === 'user'
                  ? 'bg-white text-sky-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>User</span>
            </button>
            <button
              type="button"
              onClick={() => onViewChange('operator')}
              className={`relative px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                currentView === 'operator'
                  ? 'bg-white text-sky-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Headset className="w-3.5 h-3.5" />
              <span>Operator</span>
              {activeBookingCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 text-[10px] bg-rose-600 text-white rounded-full font-mono tabular-nums">
                  {activeBookingCount}
                </span>
              )}
            </button>
          </div>

          {/* Third Primary Control: Reset */}
          <button
            type="button"
            onClick={onReset}
            title="Reset demo bookings, routes, vehicle assignments, and timers"
            className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </header>
  );
};
