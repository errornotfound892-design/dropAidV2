import React, { useState, useMemo } from 'react';
import {
  Hospital,
  LatLng,
  EmergencyCategory
} from '../../types/index.ts';
import {
  EMERGENCY_CATEGORIES,
  rankHospitalsForEmergency,
  HospitalMatchResult
} from '../../services/hospitalMatcher.ts';
import {
  Building2,
  HeartPulse,
  Activity,
  Smile,
  Brain,
  Baby,
  Flame,
  Stethoscope,
  Clock,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Phone,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';

interface HospitalMatchingPanelProps {
  pickupCoords: LatLng;
  currentDestinationId?: string;
  hospitals: Hospital[];
  selectedCategory: EmergencyCategory;
  onSelectCategory: (category: EmergencyCategory) => void;
  onSelectHospital: (hospital: Hospital) => void;
  isLocked?: boolean;
}

export const HospitalMatchingPanel: React.FC<HospitalMatchingPanelProps> = ({
  pickupCoords,
  currentDestinationId,
  hospitals,
  selectedCategory,
  onSelectCategory,
  onSelectHospital,
  isLocked = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Compute intelligent match ranking
  const rankedMatches: HospitalMatchResult[] = useMemo(() => {
    return rankHospitalsForEmergency(pickupCoords, hospitals, selectedCategory);
  }, [pickupCoords, hospitals, selectedCategory]);

  const topMatch = rankedMatches[0];
  const currentHospital = hospitals.find((h) => h.id === currentDestinationId) || topMatch?.hospital;
  const currentIsTopMatch = topMatch?.hospital.id === currentHospital?.id;

  const getCategoryIcon = (id: EmergencyCategory) => {
    switch (id) {
      case 'cardiac':
        return <HeartPulse className="w-3.5 h-3.5 text-rose-600" />;
      case 'trauma':
        return <Activity className="w-3.5 h-3.5 text-amber-600" />;
      case 'dental':
        return <Smile className="w-3.5 h-3.5 text-cyan-600" />;
      case 'stroke':
        return <Brain className="w-3.5 h-3.5 text-purple-600" />;
      case 'pediatric':
        return <Baby className="w-3.5 h-3.5 text-emerald-600" />;
      case 'burns':
        return <Flame className="w-3.5 h-3.5 text-orange-600" />;
      default:
        return <Stethoscope className="w-3.5 h-3.5 text-sky-600" />;
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
      {/* Header & Category Selection */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-sky-50 rounded-lg text-sky-700 border border-sky-100">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span>Intelligent Hospital Matching</span>
                <span className="text-[10px] font-mono uppercase bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold border border-emerald-200">
                  Live Road Travel Engine
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Matches patient GPS location, true road travel time, specialized emergency care & verified capacity.
              </p>
            </div>
          </div>
          {isLocked && (
            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 flex items-center gap-1">
              <span>🔒 Destination locked post-booking</span>
            </span>
          )}
        </div>

        {/* Emergency Category Selector Chips */}
        <div className="mt-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
            Select Medical Emergency Condition:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {EMERGENCY_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  disabled={isLocked}
                  onClick={() => onSelectCategory(cat.id)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-2xs font-bold'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  } ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {getCategoryIcon(cat.id)}
                  <span>{cat.name.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top Recommendation Highlight Card */}
      {topMatch && (
        <div className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50/60 via-white to-blue-50/30 p-4 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold bg-sky-600 text-white px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 shadow-2xs">
                  <Sparkles className="w-3 h-3" />
                  <span>Recommended for {EMERGENCY_CATEGORIES.find((c) => c.id === selectedCategory)?.name}</span>
                </span>
                <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>{topMatch.capacitySummary}</span>
                </span>
              </div>

              <h4 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                {topMatch.hospital.name}
              </h4>
              <p className="text-xs text-slate-600 truncate">
                {topMatch.hospital.address}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-700">
                <span className="flex items-center gap-1 font-bold text-sky-800">
                  <Clock className="w-3.5 h-3.5 text-sky-600" />
                  <span>~{topMatch.roadEtaMins} min road travel time</span>
                </span>
                <span>·</span>
                <span className="flex items-center gap-1 font-semibold text-slate-600">
                  <Navigation className="w-3.5 h-3.5 text-slate-500" />
                  <span>{topMatch.roadDistanceKm} km away</span>
                </span>
                <span>·</span>
                <span className="text-slate-600 font-medium">
                  Trauma: <strong>{topMatch.hospital.traumaLevel}</strong>
                </span>
              </div>

              {/* Match Rationale Pill */}
              <div className="flex flex-wrap gap-1.5 pt-1.5">
                {topMatch.matchReasons.slice(0, 2).map((reason, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded font-medium shadow-2xs"
                  >
                    ✓ {reason}
                  </span>
                ))}
              </div>
            </div>

            {/* Selection Action Button */}
            {!isLocked && (
              <div className="shrink-0 flex sm:flex-col items-center sm:items-end gap-2">
                {currentIsTopMatch ? (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-2xs">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Active Destination</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelectHospital(topMatch.hospital)}
                    className="text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 px-4 py-2.5 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <span>Route to This Hospital</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Expandable All Matching Facilities Drawer */}
      <div>
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="w-full text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 py-2 px-3 rounded-xl transition-colors flex items-center justify-between cursor-pointer"
        >
          <span>View All 10 Verified Facilities Ranked by Suitability & Proximity</span>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </button>

        {isExpanded && (
          <div className="mt-2.5 space-y-2 max-h-80 overflow-y-auto pr-1 animate-in fade-in duration-150">
            {rankedMatches.map((match) => {
              const isSelected = match.hospital.id === currentHospital?.id;
              return (
                <div
                  key={match.hospital.id}
                  className={`p-3 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-3 transition-colors ${
                    isSelected
                      ? 'border-sky-300 bg-sky-50/50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <strong className="text-slate-900 font-bold truncate">
                        {match.hospital.name}
                      </strong>
                      <span className="text-[10px] text-slate-500 font-mono">
                        ({match.hospital.region})
                      </span>
                      {match.isCategorySpecialist && (
                        <span className="text-[9px] font-bold text-sky-700 bg-sky-100 px-1.5 py-0.2 rounded uppercase">
                          Specialist
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                      {match.roadDistanceKm} km · ~{match.roadEtaMins} min road travel · {match.capacitySummary}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {isSelected ? (
                      <span className="text-[11px] font-bold text-sky-700 bg-white border border-sky-200 px-2.5 py-1 rounded-md">
                        Selected
                      </span>
                    ) : (
                      !isLocked && (
                        <button
                          type="button"
                          onClick={() => onSelectHospital(match.hospital)}
                          className="text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                        >
                          Select
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Verified Capacity Safeguard Notice */}
      <div className="text-[10px] text-slate-500 flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-lg p-2">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span>
          <strong>Capacity Verification Safeguard:</strong> DropAid only certifies availability where official telemetry connects with hospital trauma desks. If unverified, status confirms immediately upon ambulance assignment.
        </span>
      </div>
    </div>
  );
};
