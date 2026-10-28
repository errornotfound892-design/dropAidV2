import React, { useState, useEffect } from 'react';
import {
  Booking,
  Hospital,
  Landmark,
  MedicalEquipmentItem,
  PatientProfile,
  LatLng,
  AmbulanceUnit,
  BookingDocument,
  TripStage,
  EmergencyCategory,
  HospitalDoctor
} from '../../types/index.ts';
import { HOSPITALS, LANDMARKS, EQUIPMENT_CATALOG } from '../../data/mockData.ts';
import { HoldToConfirmButton } from '../Booking/HoldToConfirmButton.tsx';
import { LeafletMap } from '../Map/LeafletMap.tsx';
import { HospitalMatchingPanel } from '../Hospitals/HospitalMatchingPanel.tsx';
import { FloatingAIAssistant } from '../AI/FloatingAIAssistant.tsx';
import { DoctorTreatmentCard } from '../Booking/DoctorTreatmentCard.tsx';
import { DocumentManagementPanel } from '../Documents/DocumentManagementPanel.tsx';
import { TimeSavingFeatures } from '../Booking/TimeSavingFeatures.tsx';
import {
  MapPin,
  Building2,
  Navigation,
  Crosshair,
  Search,
  Check,
  Share2,
  Phone,
  Clock,
  ShieldCheck,
  FileText,
  AlertTriangle,
  Copy,
  CheckCheck,
  ExternalLink,
  User,
  HeartPulse,
  Flame,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Compass,
  AlertCircle,
  Radio,
  Zap,
  Loader2,
  Shield,
  ShieldAlert,
  RotateCcw
} from 'lucide-react';

interface UserDashboardProps {
  currentPickup: { coords: LatLng; address: string };
  currentDropoff: { coords: LatLng; address: string; hospitalId?: string };
  onPickupChange: (coords: LatLng, address: string) => void;
  onDropoffChange: (coords: LatLng, address: string, hospitalId?: string) => void;
  onDetectGPS: () => void;
  isDetectingGPS: boolean;
  gpsAccuracy: number;
  gpsError?: string | null;
  activeBooking: Booking | null;
  assignedAmbulance: AmbulanceUnit | null;
  bookingHistory: Booking[];
  onSubmitBooking: (equipmentIds: string[], notes: string, bookingType?: 'emergency_hold' | 'manual') => void;
  onCancelActiveBooking: (id: string) => void;
  patientProfile: PatientProfile;
  onOpenUploadModal: (category: 'id_card' | 'insurance' | 'medical_history' | 'incident_photo') => void;
  ambulances: AmbulanceUnit[];
  routePolyline: [number, number][];
  routeError?: string | null;
  onRecalculateRoute?: () => void;
  isSubmitting?: boolean;
  onRetryDispatch?: (bookingId: string) => void;
  dispatchCountdown?: number | null;
  hospitals?: Hospital[];
  selectedCategory?: EmergencyCategory;
  onSelectCategory?: (category: EmergencyCategory) => void;
  onSendPreArrivalAlert?: () => Promise<void> | void;
  onUploadDocument?: (file: File, stage: 'pre_dispatch' | 'in_transit' | 'hospital_handoff' | 'post_treatment', type: 'id_card' | 'insurance' | 'medical_history' | 'prescription' | 'incident_photo') => Promise<void> | void;
  onDeleteDocument?: (docId: string) => Promise<void> | void;
  onConfirmDoctor?: (doctor: HospitalDoctor) => Promise<void> | void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({
  currentPickup,
  currentDropoff,
  onPickupChange,
  onDropoffChange,
  onDetectGPS,
  isDetectingGPS,
  gpsAccuracy,
  gpsError = null,
  activeBooking,
  assignedAmbulance,
  bookingHistory,
  onSubmitBooking,
  onCancelActiveBooking,
  patientProfile,
  onOpenUploadModal,
  ambulances,
  routePolyline,
  routeError = null,
  onRecalculateRoute,
  isSubmitting = false,
  onRetryDispatch,
  dispatchCountdown = null,
  hospitals = HOSPITALS,
  selectedCategory = 'general',
  onSelectCategory,
  onSendPreArrivalAlert,
  onUploadDocument,
  onDeleteDocument,
  onConfirmDoctor,
}) => {
  const [addressSearch, setAddressSearch] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>(['eq-als', 'eq-cardiac']);
  const [emergencyNotes, setEmergencyNotes] = useState('Patient reporting acute chest tightness and lightheadedness.');
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [activeTab, setActiveTab] = useState<'dispatch' | 'history' | 'medical_id'>('dispatch');
  const [isManualBookingOpen, setIsManualBookingOpen] = useState(false);

  // Filter landmarks by search
  const filteredLandmarks = addressSearch
    ? LANDMARKS.filter(
        (lm) =>
          lm.name.toLowerCase().includes(addressSearch.toLowerCase()) ||
          lm.address.toLowerCase().includes(addressSearch.toLowerCase()) ||
          lm.category.toLowerCase().includes(addressSearch.toLowerCase())
      ).slice(0, 6)
    : [];

  const toggleEquipment = (id: string) => {
    setSelectedEquipment((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCopyShareLink = () => {
    if (!activeBooking) return;
    const shareText = `DropAid Emergency Tracking: Unit ${assignedAmbulance?.callSign || 'Assigned'} is en route to ${activeBooking.pickupAddress}. Live ETA: ${activeBooking.etaMinutes} mins. Tracking Code: ${activeBooking.trackingCode}. Link: ${window.location.origin}/?track=${activeBooking.trackingCode}`;
    navigator.clipboard.writeText(shareText);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  // Called when 5-second hold completes
  const handleEmergencyHoldConfirm = () => {
    onSubmitBooking(selectedEquipment, emergencyNotes, 'emergency_hold');
  };

  // Called when manual booking form is submitted
  const handleManualFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitBooking(selectedEquipment, emergencyNotes, 'manual');
  };

  return (
    <div className="space-y-6">
      {/* Sub-Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('dispatch')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              activeTab === 'dispatch' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Emergency Dispatch
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'history' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Trip History</span>
            <span className="text-[10px] bg-slate-200 px-1.5 py-0.2 rounded-full font-mono">
              {bookingHistory.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('medical_id')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              activeTab === 'medical_id' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Patient Medical ID
          </button>
        </div>

        {/* Quick Document Upload Trigger */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenUploadModal('insurance')}
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span>Upload Insurance Card</span>
          </button>
        </div>
      </div>

      {/* ---------------- TAB 1: EMERGENCY DISPATCH & HOMEPAGE HERO ---------------- */}
      {activeTab === 'dispatch' && (
        <div className="space-y-6">
          {activeBooking && activeBooking.stage !== 'completed' && activeBooking.stage !== 'cancelled' ? (
            /* --- ACTIVE BOOKING & LIVE TRACKING INTERFACE (WITH MAP) --- */
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* 1. Active Booking Status Header */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-sky-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                      {assignedAmbulance?.type || 'ALS'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900">
                          {activeBooking.stage === 'pending'
                            ? 'Emergency Request Registered'
                            : assignedAmbulance?.callSign || 'Unit Dispatched'}
                        </h3>
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-md uppercase tracking-wide flex items-center gap-1.5 ${
                            activeBooking.stage === 'pending'
                              ? 'bg-amber-100 text-amber-800 animate-pulse border border-amber-300'
                              : 'bg-sky-100 text-sky-800'
                          }`}
                        >
                          {activeBooking.stage === 'pending' && <Radio className="w-3 h-3 text-amber-600 animate-spin" />}
                          <span>{activeBooking.stage.replace(/_/g, ' ')}</span>
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Tracking Code: <span className="font-mono font-bold text-slate-900">{activeBooking.trackingCode}</span> · Requested at {new Date(activeBooking.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setShowShareModal(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 bg-white border border-sky-300 hover:bg-sky-50 px-3 py-2 rounded-lg transition-colors cursor-pointer shadow-2xs"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share Trip Link</span>
                    </button>

                    {/* RESTRICTION 3: Allow users to cancel an eligible booking before driver confirms pickup. Once picked up, disable & hide cancellation and display message */}
                    {activeBooking.stage === 'pending' || activeBooking.stage === 'accepted' || activeBooking.stage === 'en_route_pickup' || activeBooking.stage === 'on_scene' ? (
                      <button
                        onClick={() => onCancelActiveBooking(activeBooking.id)}
                        className="text-xs font-semibold text-rose-700 hover:text-rose-900 hover:bg-rose-50 px-3 py-2 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                      >
                        Cancel Request
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs font-semibold">
                        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Your trip is in progress. Contact the assigned operator if assistance is required.</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dynamic Status Banner for Pending Ambulance Search */}
                {activeBooking.stage === 'pending' && (
                  (() => {
                    const hasAvailable = ambulances.some((a) => a.status === 'available');
                    if (!hasAvailable && !activeBooking.assignedUnitId) {
                      return (
                        <div className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-300 flex flex-wrap items-center justify-between gap-3 text-xs text-rose-900 animate-in fade-in">
                          <div className="flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                            <div>
                              <div className="font-bold text-sm text-rose-950">
                                No Ambulances Currently Available in Fleet
                              </div>
                              <p className="text-rose-800 text-xs mt-0.5">
                                All 14 emergency fleet units across Delhi NCR are currently deployed on active emergency runs.
                              </p>
                            </div>
                          </div>
                          {onRetryDispatch && (
                            <button
                              type="button"
                              onClick={() => onRetryDispatch(activeBooking.id)}
                              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Retry Ambulance Dispatch</span>
                            </button>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div className="mt-4 p-3.5 rounded-xl bg-gradient-to-r from-sky-50 via-amber-50 to-sky-50 border border-amber-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                          <div>
                            <span className="font-bold text-slate-900">
                              Autonomous Proximity Dispatch:
                            </span>{' '}
                            <span className="text-slate-600">
                              Calculating road grid routes across 14 Delhi NCR fleet units. Nearest available unit will be assigned automatically within 5 seconds.
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[11px] text-sky-800 bg-sky-100/80 px-2.5 py-1 rounded-md border border-sky-200 shrink-0">
                          <Radio className="w-3.5 h-3.5 text-sky-600 animate-spin" />
                          <span>
                            {dispatchCountdown !== null && dispatchCountdown !== undefined
                              ? `Auto-Matching in ${dispatchCountdown}s`
                              : 'Auto-Matching (< 5s)'}
                          </span>
                        </div>
                      </div>
                    );
                  })()
                )}

                {/* Dynamic Status Banner for Patient Picked Up (Transporting Phase) */}
                {activeBooking.stage === 'transporting' && (
                  <div className="mt-4 p-3.5 rounded-xl bg-gradient-to-r from-sky-50 via-blue-50 to-sky-50 border border-sky-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-sky-600 animate-ping" />
                      <div>
                        <span className="font-bold text-sky-900">
                          Patient Picked Up · Phase 2 Hospital Route:
                        </span>{' '}
                        <span className="text-slate-700">
                          Ambulance is en route to {activeBooking.dropoffAddress.split(',')[0]} emergency bay. Route polyline and ETA are dynamically locked to hospital road path.
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[11px] text-sky-900 bg-sky-100/80 px-2.5 py-1 rounded-md border border-sky-300 shrink-0">
                      <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
                      <span>Trauma Bay Pre-Notified</span>
                    </div>
                  </div>
                )}

                {/* Routing Failure Alert with Instant Retry */}
                {routeError && (
                  <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-3 text-xs text-rose-800">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{routeError}</span>
                    </div>
                    {onRecalculateRoute && (
                      <button
                        onClick={onRecalculateRoute}
                        className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-xs font-bold transition-colors cursor-pointer shrink-0"
                      >
                        Retry Hospital Route
                      </button>
                    )}
                  </div>
                )}

                {/* 2. Interactive Leaflet Map Viewport inside Tracking Interface (Locations Locked Once Submitted) */}
                <div className="mt-4 w-full h-[460px] rounded-xl overflow-hidden shadow-sm border border-slate-200">
                  <LeafletMap
                    pickupCoords={activeBooking.pickupCoords}
                    dropoffCoords={activeBooking.dropoffCoords}
                    ambulances={ambulances}
                    activeAmbulanceId={assignedAmbulance?.id}
                    routePolyline={routePolyline}
                    onPickupChange={() => {}}
                    onDropoffChange={() => {}}
                    gpsAccuracyMeters={gpsAccuracy}
                    routeError={routeError}
                    onRecalculateRoute={onRecalculateRoute}
                    isSearching={activeBooking.stage === 'pending'}
                    tripStage={activeBooking.stage}
                    isLocked={true}
                  />
                </div>

                {/* 3. Real-time Telemetry Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 mt-2 border-b border-slate-200 text-center">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                      {activeBooking.stage === 'transporting' ? 'ETA to Hospital' : 'Live ETA'}
                    </span>
                    <div className="text-2xl font-black text-sky-700 font-mono tabular-nums">
                      {activeBooking.stage === 'pending' ? '~5 min' : `${activeBooking.etaMinutes} min`}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                      {activeBooking.stage === 'transporting' ? 'Distance to Hospital' : 'Road Distance'}
                    </span>
                    <div className="text-2xl font-black text-slate-800 font-mono tabular-nums">
                      {activeBooking.stage === 'pending' ? '~4.8 km' : `${activeBooking.distanceKm} km`}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Dispatched Unit</span>
                    <div className="text-sm font-bold text-slate-800 truncate mt-1">
                      {activeBooking.stage === 'pending'
                        ? 'Locating Nearest Unit...'
                        : assignedAmbulance ? assignedAmbulance.callSign.split(' - ')[0] : 'Unit Dispatched'}
                    </div>
                    {assignedAmbulance && (
                      <div className="text-[10px] text-sky-700 font-semibold truncate mt-0.5">
                        {assignedAmbulance.isHospitalStationed ? '🏥 ' : '🚓 '}
                        {assignedAmbulance.stationName}
                      </div>
                    )}
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Destination Bay</span>
                    <div className="text-sm font-bold text-sky-800 truncate mt-1">
                      {activeBooking.dropoffAddress.split(',')[0]}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate mt-0.5">
                      Verified Emergency ER
                    </div>
                  </div>
                </div>

                {/* 4. Assigned Driver Details & Emergency Controls */}
                {assignedAmbulance && (
                  <div className="pt-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={assignedAmbulance.driverPhoto}
                        alt={assignedAmbulance.driverName}
                        className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-xs"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-900">
                          {assignedAmbulance.driverName} · ★ {assignedAmbulance.driverRating}
                        </div>
                        <div className="text-[11px] text-slate-600">
                          Lead Paramedic: {assignedAmbulance.paramedicName} · Call: {assignedAmbulance.driverPhone}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={`tel:${assignedAmbulance.driverPhone}`}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 px-3.5 py-2 rounded-lg transition-colors shadow-2xs"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Direct Driver Call</span>
                      </a>
                    </div>
                  </div>
                )}

                {/* 5. Trip Stage Visual Progression Stepper */}
                <div className="pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Live Dispatch Progress
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      Step {['pending', 'accepted', 'en_route_pickup', 'on_scene', 'transporting', 'at_hospital', 'completed'].indexOf(activeBooking.stage) + 1} of 7
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
                    {[
                      { key: 'pending', label: '1. Searching' },
                      { key: 'accepted', label: '2. Accepted' },
                      { key: 'en_route_pickup', label: '3. En Route' },
                      { key: 'on_scene', label: '4. On Scene' },
                      { key: 'transporting', label: '5. Patient Picked Up' },
                      { key: 'at_hospital', label: '6. Hospital ER' },
                      { key: 'completed', label: '7. Complete' }
                    ].map((step, idx) => {
                      const stages = ['pending', 'accepted', 'en_route_pickup', 'on_scene', 'transporting', 'at_hospital', 'completed'];
                      const currentIdx = stages.indexOf(activeBooking.stage);
                      const isCurrent = activeBooking.stage === step.key;
                      const isPassed = currentIdx > idx;

                      return (
                        <div
                          key={step.key}
                          className={`p-2 rounded-lg border text-[11px] font-semibold text-center transition-all ${
                            isCurrent
                              ? 'border-sky-600 bg-sky-50 text-sky-900 ring-2 ring-sky-200'
                              : isPassed
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                              : 'border-slate-200 bg-slate-50 text-slate-400'
                          }`}
                        >
                          <div className="text-[10px] opacity-75 font-mono">
                            {isPassed ? '✓ Done' : isCurrent ? '● Active' : `Step ${idx + 1}`}
                          </div>
                          <div className="truncate">{step.label}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 6. Medical Details & Attached Documents Card */}
                <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-700 uppercase tracking-wide">
                        Route & Destination Details
                      </span>
                      <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono font-bold">
                        🔒 Confirmed & Locked
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Pickup Point:</span>
                      <div className="font-bold text-slate-900 mt-0.5">{activeBooking.pickupAddress}</div>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Destination Emergency ER:</span>
                      <div className="font-bold text-sky-700 mt-0.5">{activeBooking.dropoffAddress}</div>
                    </div>
                    <div className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-200">
                      Locations are locked during active trip to ensure paramedic navigational continuity. Contact dispatch operator if emergency reroute is required.
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                    <span className="font-bold text-slate-700 uppercase tracking-wide">
                      Triage Information & Equipment
                    </span>
                    <div>
                      <span className="text-slate-500 font-medium">Reported Symptoms:</span>
                      <div className="text-slate-800 font-medium mt-0.5">{activeBooking.patientNotes || 'Emergency medical assistance requested.'}</div>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Requested Equipment:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {activeBooking.equipmentRequested.map((eqId) => (
                          <span key={eqId} className="bg-white border border-slate-200 text-slate-800 px-2 py-0.5 rounded text-[10px] font-semibold">
                            {EQUIPMENT_CATALOG.find((e) => e.id === eqId)?.name || eqId}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 7. Doctor & Verified Clinical Treatment Team Card */}
              <DoctorTreatmentCard
                booking={activeBooking}
                onConfirmDoctor={onConfirmDoctor}
              />

              {/* 8. Time-Saving Emergency Features (Pre-Arrival Alert, 1-Tap Share, Hospital ER Direct Link) */}
              <TimeSavingFeatures
                booking={activeBooking}
                assignedAmbulance={assignedAmbulance}
                patientProfile={patientProfile}
                onSendPreArrivalAlert={onSendPreArrivalAlert}
                onOpenUploadModal={onOpenUploadModal}
              />

              {/* 9. Medical Document Management (Reports, Prescriptions, Insurance & Retention Controls) */}
              <DocumentManagementPanel
                bookingId={activeBooking.id}
                documents={activeBooking.documents || []}
                onOpenUpload={onOpenUploadModal}
                onUploadDocument={onUploadDocument}
                onDeleteDocument={onDeleteDocument}
              />
            </div>
          ) : (
            /* --- HOMEPAGE (ZERO MAP, PROFESSIONAL & FOCUSED ON AMBULANCE BOOKING) --- */
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Intelligent Hospital Matching Panel (Emergency Category & Road ETA) */}
              <HospitalMatchingPanel
                pickupCoords={currentPickup.coords}
                currentDestinationId={currentDropoff.hospitalId}
                hospitals={hospitals}
                selectedCategory={selectedCategory}
                onSelectCategory={(cat) => onSelectCategory && onSelectCategory(cat)}
                onSelectHospital={(hosp) =>
                  onDropoffChange({ lat: hosp.lat, lng: hosp.lng }, `${hosp.name}, ${hosp.address}`, hosp.id)
                }
              />

              {/* 1. HOMEPAGE RED EMERGENCY BOOKING HERO & 2. MANUAL BOOKING BUTTON */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm text-center relative overflow-hidden">
                {/* Ambient Background Gradient Accent */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-sky-500/5 blur-3xl pointer-events-none rounded-full" />

                <div className="max-w-2xl mx-auto space-y-4">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      Emergency Ambulance Dispatch
                    </h2>
                  </div>

                  {/* GPS Status & Graceful Error Handling Feedback */}
                  <div className="max-w-md mx-auto">
                    {gpsError ? (
                      <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-xs text-left flex items-start gap-2.5 shadow-2xs">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <div className="font-bold">Location Permission or GPS Error</div>
                          <div className="text-[11px] text-amber-700 mt-0.5">
                            {gpsError} Using staging address: {currentPickup.address.split(',')[0]}. You can also adjust pickup manually below.
                          </div>
                          <button
                            type="button"
                            onClick={onDetectGPS}
                            className="mt-2 text-[11px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded transition-colors cursor-pointer"
                          >
                            Retry GPS Detection
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs flex items-center justify-between gap-3 text-left">
                        <div className="flex items-center gap-2 min-w-0">
                          <Crosshair className={`w-4 h-4 text-emerald-600 shrink-0 ${isDetectingGPS ? 'animate-spin' : ''}`} />
                          <div className="truncate">
                            <span className="font-semibold text-slate-800">
                              {isDetectingGPS ? 'Detecting GPS coordinates...' : 'GPS Pickup:'}
                            </span>{' '}
                            <span className="text-slate-600 font-mono text-[11px]">
                              {currentPickup.address.split(',')[0]}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={onDetectGPS}
                          disabled={isDetectingGPS}
                          className="text-[11px] font-bold text-sky-700 hover:text-sky-800 hover:underline shrink-0 cursor-pointer"
                        >
                          {isDetectingGPS ? 'Locating...' : 'Refresh GPS'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* REQUIREMENT 1: LARGE CENTERED RED EMERGENCY BOOKING BUTTON */}
                  <div className="pt-2 pb-1 flex flex-col items-center justify-center">
                    <HoldToConfirmButton
                      buttonSize={210}
                      destinationName={currentDropoff.address.split(',')[0]}
                      disabled={isSubmitting || (activeBooking !== null && activeBooking.stage !== 'completed' && activeBooking.stage !== 'cancelled')}
                      onHoldStart={() => {
                        // Proactively refresh GPS on hold start if not yet calibrated
                        if (!isDetectingGPS) {
                          onDetectGPS();
                        }
                      }}
                      onConfirm={handleEmergencyHoldConfirm}
                    />
                  </div>

                  {/* REQUIREMENT 3: CLEARLY VISIBLE "MANUAL BOOKING" BUTTON DIRECTLY BELOW */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setIsManualBookingOpen((prev) => !prev)}
                      className={`w-full max-w-md mx-auto py-3 px-5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer border ${
                        isManualBookingOpen
                          ? 'bg-sky-50 border-sky-300 text-sky-800'
                          : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800 hover:border-slate-400'
                      }`}
                    >
                      <SlidersHorizontal className="w-4 h-4 text-sky-600" />
                      <span>Manual Booking (Custom Route, Equipment & Notes)</span>
                      {isManualBookingOpen ? (
                        <ChevronUp className="w-4 h-4 text-slate-400 ml-auto" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400 ml-auto" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* MANUAL BOOKING SECTION (Preserves current fields, layout, and functionality) */}
              {isManualBookingOpen && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 animate-in fade-in slide-in-from-top-3 duration-200">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                        <SlidersHorizontal className="w-4 h-4 text-sky-600" />
                        <span>Manual Booking Configuration</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Customize your pickup, destination hospital, required equipment, and patient notes.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsManualBookingOpen(false)}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      Collapse Panel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left 7 Columns: Route & Destination Selection */}
                    <div className="lg:col-span-7 space-y-4">
                      {/* 1. Pickup Address Card */}
                      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wide">
                            <MapPin className="w-4 h-4 text-emerald-600" />
                            <span>1. Pickup Location</span>
                          </div>
                          <button
                            type="button"
                            onClick={onDetectGPS}
                            disabled={isDetectingGPS}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 transition-colors cursor-pointer"
                          >
                            <Crosshair className={`w-3.5 h-3.5 ${isDetectingGPS ? 'animate-spin' : ''}`} />
                            <span>{isDetectingGPS ? 'Locating...' : 'Detect My GPS'}</span>
                          </button>
                        </div>

                        <div className="text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex items-center justify-between">
                          <span className="truncate">{currentPickup.address}</span>
                          <span className="text-[10px] text-emerald-700 font-mono shrink-0 ml-2">
                            ±{gpsAccuracy}m GPS
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1.5">
                          Detected via device GPS or verified staging landmark.
                        </p>
                      </div>

                      {/* 2. Destination Hospital Card (10 Verified Hospitals across Delhi NCR) */}
                      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wide">
                            <Building2 className="w-4 h-4 text-sky-600" />
                            <span>2. Destination Emergency Facility</span>
                          </div>
                          <span className="text-xs font-semibold text-slate-500">
                            10 Hospitals (Delhi · Noida · Haryana)
                          </span>
                        </div>

                        {/* Quick 10 Hospitals Selector Strip */}
                        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                          {HOSPITALS.map((hosp) => {
                            const isSelected =
                              currentDropoff.hospitalId === hosp.id ||
                              currentDropoff.address.includes(hosp.name);

                            return (
                              <div
                                key={hosp.id}
                                onClick={() =>
                                  onDropoffChange({ lat: hosp.lat, lng: hosp.lng }, hosp.name, hosp.id)
                                }
                                className={`p-3 rounded-lg border text-left cursor-pointer transition-all flex items-center justify-between gap-3 ${
                                  isSelected
                                    ? 'border-sky-600 bg-sky-50/80 shadow-2xs ring-1 ring-sky-300'
                                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-900 truncate">
                                      {hosp.name}
                                    </span>
                                    <span className="text-[10px] font-semibold text-sky-700 bg-sky-100/80 px-1.5 py-0.2 rounded uppercase">
                                      {hosp.region}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate mt-0.5">
                                    {hosp.address} · Helpline: {hosp.emergencyContact}
                                  </div>
                                </div>

                                <div className="text-right shrink-0">
                                  <div className="text-xs font-black text-emerald-700 font-mono tabular-nums">
                                    {hosp.availableBeds} beds
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    {isSelected ? 'Selected' : 'Click to select'}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* 3. Landmark Search & Autocomplete */}
                      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wide">
                            <Search className="w-4 h-4 text-slate-500" />
                            <span>Search 30 Delhi NCR Landmarks</span>
                          </div>
                        </div>

                        <div className="relative">
                          <input
                            type="text"
                            value={addressSearch}
                            onChange={(e) => setAddressSearch(e.target.value)}
                            placeholder="Search Connaught Place, Cyber Hub, Sector 18, Airport, Metro stations..."
                            className="w-full text-xs text-slate-800 border border-slate-300 rounded-lg p-2.5 pl-8 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                          />
                          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                        </div>

                        {filteredLandmarks.length > 0 && (
                          <div className="mt-2 border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white shadow-sm overflow-hidden">
                            {filteredLandmarks.map((lm) => (
                              <div
                                key={lm.id}
                                className="p-2.5 text-xs hover:bg-slate-50 flex items-center justify-between cursor-pointer"
                              >
                                <div>
                                  <div className="font-semibold text-slate-900">{lm.name}</div>
                                  <div className="text-[11px] text-slate-500">{lm.address} ({lm.category})</div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => onPickupChange({ lat: lm.lat, lng: lm.lng }, `${lm.name}, ${lm.address}`)}
                                    className="text-[10px] font-semibold text-emerald-700 hover:bg-emerald-50 border border-emerald-200 px-2 py-1 rounded cursor-pointer"
                                  >
                                    Set Pickup
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDropoffChange({ lat: lm.lat, lng: lm.lng }, `${lm.name}, ${lm.address}`)}
                                    className="text-[10px] font-semibold text-sky-700 hover:bg-sky-50 border border-sky-200 px-2 py-1 rounded cursor-pointer"
                                  >
                                    Set Drop-off
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right 5 Columns: Equipment & Submit Form */}
                    <div className="lg:col-span-5 space-y-4">
                      {/* Medical Equipment Options */}
                      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wide">
                            <HeartPulse className="w-4 h-4 text-rose-600" />
                            <span>3. Medical Equipment Requirements</span>
                          </div>
                          <span className="text-[11px] font-mono text-slate-500">
                            {selectedEquipment.length} selected
                          </span>
                        </div>

                        <div className="grid grid-cols-1 gap-1.5 max-h-56 overflow-y-auto pr-1">
                          {EQUIPMENT_CATALOG.map((item) => {
                            const checked = selectedEquipment.includes(item.id);
                            return (
                              <div
                                key={item.id}
                                onClick={() => toggleEquipment(item.id)}
                                className={`p-2 rounded-lg border text-xs cursor-pointer transition-colors flex items-start gap-2.5 ${
                                  checked
                                    ? 'border-sky-500 bg-sky-50/70 text-slate-900'
                                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <div
                                  className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border shrink-0 ${
                                    checked
                                      ? 'bg-sky-600 border-sky-600 text-white'
                                      : 'border-slate-300 bg-white'
                                  }`}
                                >
                                  {checked && <Check className="w-3 h-3 stroke-2" />}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-slate-900">{item.name}</div>
                                  <div className="text-[11px] text-slate-500 truncate">{item.description}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Patient Symptoms / Notes */}
                      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                        <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1.5">
                          4. Patient Symptoms / Medical Notes
                        </label>
                        <textarea
                          rows={3}
                          value={emergencyNotes}
                          onChange={(e) => setEmergencyNotes(e.target.value)}
                          placeholder="Detail chief complaint, consciousness, mobility..."
                          className="w-full text-xs text-slate-800 border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                        />
                      </div>

                      {/* Manual Booking Direct Submit CTA */}
                      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
                        <div className="text-xs text-slate-600">
                          Destination: <span className="font-bold text-slate-800">{currentDropoff.address.split(',')[0]}</span>
                        </div>

                        <button
                          type="button"
                          onClick={handleManualFormSubmit}
                          disabled={isSubmitting || (activeBooking !== null && activeBooking.stage !== 'completed' && activeBooking.stage !== 'cancelled')}
                          className="w-full py-3 px-4 bg-sky-600 hover:bg-sky-700 active:scale-98 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm disabled:bg-slate-300 disabled:cursor-not-allowed"
                        >
                          Confirm Manual Booking & Dispatch
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---------------- TAB 2: TRIP HISTORY ---------------- */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">Patient Emergency Dispatch History</h3>
            <span className="text-xs text-slate-500">Persistent local & server-synced records</span>
          </div>

          {bookingHistory.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500">
              No historical dispatch records found. Use the Emergency button or Manual Booking to dispatch an ambulance.
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs divide-y divide-slate-100">
              {bookingHistory.map((bk) => (
                <div key={bk.id} className="p-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 font-mono">
                        {bk.trackingCode}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          bk.stage === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : bk.stage === 'cancelled'
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-sky-100 text-sky-800'
                        }`}
                      >
                        {bk.stage.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs text-slate-500">
                        {new Date(bk.createdAt).toLocaleDateString()} {new Date(bk.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="text-xs text-slate-700">
                      <span className="font-semibold">From:</span> {bk.pickupAddress}
                    </div>
                    <div className="text-xs text-slate-700">
                      <span className="font-semibold">To:</span> {bk.dropoffAddress}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-black text-slate-900 font-mono">
                      ₹{bk.priceEst.toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {bk.distanceKm} km · Unit {bk.assignedUnitId || 'Dispatched'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---------------- TAB 4: PATIENT MEDICAL ID ---------------- */}
      {activeTab === 'medical_id' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div>
              <h3 className="text-base font-bold text-slate-900">Digital Patient Medical ID</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatically shared with assigned paramedics and receiving trauma team.
              </p>
            </div>
            <button
              onClick={() => onOpenUploadModal('insurance')}
              className="text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              Upload Digital Card
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="space-y-3">
              <div>
                <span className="font-bold text-slate-500 uppercase tracking-wide">Full Name</span>
                <div className="text-sm font-bold text-slate-900 mt-0.5">{patientProfile.name}</div>
              </div>
              <div>
                <span className="font-bold text-slate-500 uppercase tracking-wide">Blood Type</span>
                <div className="text-sm font-bold text-rose-600 mt-0.5">{patientProfile.bloodType}</div>
              </div>
              <div>
                <span className="font-bold text-slate-500 uppercase tracking-wide">Known Allergies</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {patientProfile.allergies.map((all, i) => (
                    <span key={i} className="bg-rose-50 text-rose-800 font-semibold px-2 py-0.5 rounded">
                      {all}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <span className="font-bold text-slate-500 uppercase tracking-wide">Emergency Contact</span>
                <div className="text-sm font-bold text-slate-900 mt-0.5">
                  {patientProfile.emergencyContact.name} ({patientProfile.emergencyContact.relationship})
                </div>
                <div className="text-slate-600 font-mono mt-0.5">
                  {patientProfile.emergencyContact.phone}
                </div>
              </div>
              <div>
                <span className="font-bold text-slate-500 uppercase tracking-wide">Insurance Policy</span>
                <div className="text-sm font-semibold text-slate-900 mt-0.5">{patientProfile.insuranceProvider}</div>
                <div className="text-slate-500 font-mono">Policy #{patientProfile.policyNumber}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trip Sharing Modal */}
      {showShareModal && activeBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-sky-600" />
                <h4 className="text-sm font-bold text-slate-900">Share Emergency Tracking</h4>
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 mt-3">
              Share real-time GPS tracking with family or emergency contacts so they can monitor ambulance arrival live.
            </p>

            <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                Tracking Link
              </span>
              <div className="text-xs font-mono text-slate-900 break-all select-all mt-1">
                {window.location.origin}/?track={activeBooking.trackingCode}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowShareModal(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={handleCopyShareLink}
                className="px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                {copiedShare ? (
                  <>
                    <CheckCheck className="w-4 h-4" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Tracking Link</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating AI Assistant for Natural Language Triage, Document Guidance & Hospital Matching */}
      <FloatingAIAssistant
        pickupCoords={currentPickup.coords}
        pickupAddress={currentPickup.address}
        hospitals={hospitals}
        patientProfile={patientProfile}
        onSelectHospital={(hosp) =>
          onDropoffChange({ lat: hosp.lat, lng: hosp.lng }, `${hosp.name}, ${hosp.address}`, hosp.id)
        }
        onApplyCategory={(cat) => onSelectCategory && onSelectCategory(cat)}
        onApplyEmergencyNotes={(notes) =>
          setEmergencyNotes((prev) => (prev ? `${prev} | ${notes}` : notes))
        }
      />
    </div>
  );
};
