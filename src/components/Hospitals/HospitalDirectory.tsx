import React, { useState } from 'react';
import { Hospital } from '../../types/index.ts';
import { HOSPITALS } from '../../data/mockData.ts';
import {
  Building2,
  Phone,
  MapPin,
  Clock,
  Bed,
  CheckCircle,
  Search,
  ExternalLink,
  ShieldCheck,
  HeartPulse,
  Navigation,
  Camera,
  Sparkles
} from 'lucide-react';

interface HospitalDirectoryProps {
  currentDestinationId?: string;
  onSelectHospital: (hospital: Hospital) => void;
  hospitals?: Hospital[];
  onUploadHospitalImage?: (hospitalId: string) => void;
  className?: string;
}

export const HospitalDirectory: React.FC<HospitalDirectoryProps> = ({
  currentDestinationId,
  onSelectHospital,
  hospitals = HOSPITALS,
  onUploadHospitalImage,
  className = '',
}) => {
  const [selectedRegion, setSelectedRegion] = useState<'All' | 'Delhi' | 'Noida' | 'Haryana'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const activeHospitalList = hospitals.length > 0 ? hospitals : HOSPITALS;

  const filteredHospitals = activeHospitalList.filter((h) => {
    const matchesRegion = selectedRegion === 'All' || h.region === selectedRegion;
    const matchesSearch =
      !searchQuery ||
      h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.specialties.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesRegion && matchesSearch;
  });

  const getRegionCounts = (region: 'All' | 'Delhi' | 'Noida' | 'Haryana') => {
    if (region === 'All') return activeHospitalList.length;
    return activeHospitalList.filter((h) => h.region === region).length;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Directory Title & Region Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-sky-600" />
              <h2 className="text-lg font-bold text-slate-900">
                Verified Hospital Emergency Directory
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              10 verified emergency facilities with live ICU bed telemetry, ER trauma teams, and Cloudinary photo management.
            </p>
          </div>

          {/* Region Filter Segmented Tabs */}
          <div className="flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200 self-start sm:self-auto">
            {(['All', 'Delhi', 'Noida', 'Haryana'] as const).map((region) => (
              <button
                key={region}
                type="button"
                onClick={() => setSelectedRegion(region)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                  selectedRegion === region
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{region}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  selectedRegion === region ? 'bg-sky-100 text-sky-800' : 'bg-slate-200 text-slate-600'
                }`}>
                  {getRegionCounts(region)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Search Input Bar */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by hospital name, city, locality, or medical specialty (e.g. Trauma, Cardiac, Burn, ICU)..."
            className="w-full text-xs text-slate-800 bg-white border border-slate-300 rounded-xl p-3 pl-9 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-2xs"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
        </div>
      </div>

      {/* Hospital Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredHospitals.map((hosp) => {
          const isSelected = currentDestinationId === hosp.id;
          const isCloudinary = hosp.cloudinaryPublicId || hosp.image.includes('cloudinary');

          return (
            <div
              key={hosp.id}
              className={`bg-white border rounded-2xl overflow-hidden shadow-2xs transition-all flex flex-col justify-between ${
                isSelected
                  ? 'border-sky-600 ring-2 ring-sky-200 shadow-md'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                {/* Photo & Status Banner */}
                <div className="relative h-44 w-full overflow-hidden bg-slate-100 group">
                  <img
                    src={hosp.image}
                    alt={hosp.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
                    referrerPolicy="no-referrer"
                  />

                  {/* Badges */}
                  <div className="absolute top-2.5 left-2.5 bg-slate-900/80 backdrop-blur-xs text-white px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <span>{hosp.region}</span>
                    <span className="text-slate-400">·</span>
                    <span>{hosp.city}</span>
                  </div>

                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                    {isCloudinary && (
                      <span className="bg-sky-600/90 backdrop-blur-xs text-white text-[9px] font-bold uppercase px-2 py-0.5 rounded shadow-xs flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>Cloudinary CDN</span>
                      </span>
                    )}
                    <div className="bg-emerald-600 text-white px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 shadow-xs">
                      <ShieldCheck className="w-3 h-3" />
                      <span>Verified</span>
                    </div>
                  </div>

                  {/* Cloudinary Image Upload / Replace Button */}
                  {onUploadHospitalImage && (
                    <button
                      type="button"
                      onClick={() => onUploadHospitalImage(hosp.id)}
                      className="absolute bottom-2.5 right-2.5 bg-slate-900/80 hover:bg-slate-900 text-white text-[11px] font-semibold px-2.5 py-1 rounded-lg backdrop-blur-xs shadow-md flex items-center gap-1.5 transition-all cursor-pointer opacity-90 hover:opacity-100"
                      title="Upload or replace this hospital photo via Cloudinary"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Update Photo</span>
                    </button>
                  )}
                </div>

                {/* Content */}
                <div className="p-5 space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 line-clamp-1">{hosp.name}</h3>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{hosp.address}</p>
                  </div>

                  {/* Contact Details */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-medium">ER Direct Helpline:</span>
                      <a
                        href={`tel:${hosp.emergencyContact}`}
                        className="font-bold text-rose-600 hover:text-rose-700 underline font-mono"
                      >
                        {hosp.emergencyContact}
                      </a>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-medium">Hospital Board:</span>
                      <a
                        href={`tel:${hosp.phone}`}
                        className="font-semibold text-slate-700 hover:text-slate-900 font-mono"
                      >
                        {hosp.phone}
                      </a>
                    </div>
                  </div>

                  {/* Bed & Wait Time Stats */}
                  <div className="grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="bg-emerald-50/70 border border-emerald-100 p-2.5 rounded-xl">
                      <span className="text-[10px] text-emerald-800 font-medium uppercase">Available Beds</span>
                      <div className="text-sm font-black text-emerald-700 font-mono">
                        {hosp.availableBeds} <span className="text-[10px] font-normal text-slate-500">/ {hosp.totalBeds}</span>
                      </div>
                    </div>
                    <div className="bg-sky-50/70 border border-sky-100 p-2.5 rounded-xl">
                      <span className="text-[10px] text-sky-800 font-medium uppercase">ER Triage Wait</span>
                      <div className="text-sm font-black text-sky-700 font-mono">
                        ~{hosp.erWaitMins} mins
                      </div>
                    </div>
                  </div>

                  {/* Specialties Pills */}
                  <div className="flex flex-wrap gap-1">
                    {hosp.specialties.slice(0, 3).map((spec, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded"
                      >
                        {spec}
                      </span>
                    ))}
                    {hosp.specialties.length > 3 && (
                      <span className="text-[10px] text-slate-400 self-center">
                        +{hosp.specialties.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div className="p-5 pt-0 border-t border-slate-100 mt-2 space-y-2">
                <button
                  type="button"
                  onClick={() => onSelectHospital(hosp)}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs ${
                    isSelected
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-sky-600 text-white hover:bg-sky-700'
                  }`}
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>{isSelected ? '✓ Selected as Destination' : 'Set as Destination & Route'}</span>
                </button>

                <a
                  href={`tel:${hosp.emergencyContact}`}
                  className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-[11px] font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <Phone className="w-3 h-3 text-rose-600" />
                  <span>Call Emergency Helpline ({hosp.emergencyContact.split('/')[0].trim()})</span>
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
