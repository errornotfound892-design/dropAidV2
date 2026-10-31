import React, { useState } from 'react';
import { Booking, AmbulanceUnit, TripStage, Hospital, SimulationState } from '../../types/index.ts';
import { HOSPITALS } from '../../data/mockData.ts';
import { LeafletMap } from '../Map/LeafletMap.tsx';
import {
  Headset,
  Check,
  X,
  Truck,
  UserCheck,
  Navigation,
  Clock,
  Phone,
  Radio,
  AlertCircle,
  FileText,
  Volume2,
  ExternalLink,
  ChevronRight,
  Shield,
  Activity,
  Building2,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Camera,
  MapPin,
  CheckCircle2,
  Layers,
  Zap,
  Sliders,
  History,
  ShieldAlert
} from 'lucide-react';
import { emergencyAudio } from '../../services/audioService.ts';

interface OperatorDashboardProps {
  bookings: Booking[];
  ambulances: AmbulanceUnit[];
  onAcceptBooking: (bookingId: string) => void;
  onRejectBooking: (bookingId: string) => void;
  onAssignUnit: (bookingId: string, unitId: string) => void;
  onAdvanceStage: (bookingId: string, nextStage: TripStage) => void;
  onOpenDriverView: (unitId: string) => void;
  onOperatorReroute?: (bookingId: string, hospital: Hospital) => void;
  onUploadDriverPhoto?: (unitId: string) => void;
  simulationState?: SimulationState;
  onStartSimulation?: () => void;
  onPauseSimulation?: () => void;
  onResetSimulation?: () => void;
  onChangeSimulationSpeed?: (speed: number) => void;
}

const STAGE_ORDER: TripStage[] = [
  'pending',
  'accepted',
  'en_route_pickup',
  'on_scene',
  'transporting',
  'at_hospital',
  'completed',
];

export const OperatorDashboard: React.FC<OperatorDashboardProps> = ({
  bookings,
  ambulances,
  onAcceptBooking,
  onRejectBooking,
  onAssignUnit,
  onAdvanceStage,
  onOpenDriverView,
  onOperatorReroute,
  onUploadDriverPhoto,
  simulationState,
  onStartSimulation,
  onPauseSimulation,
  onResetSimulation,
  onChangeSimulationSpeed,
}) => {
  const [operatorTab, setOperatorTab] = useState<'fleet_map' | 'active_trips' | 'incoming' | 'fleet_units' | 'history'>('fleet_map');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'real' | 'simulated'>('all');
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    bookings.length > 0 ? bookings[0].id : null
  );
  const [isRerouteOpen, setIsRerouteOpen] = useState<boolean>(false);
  const [overrideUnitBookingId, setOverrideUnitBookingId] = useState<string | null>(null);

  const selectedBooking = bookings.find((b) => b.id === selectedBookingId) || bookings[0] || null;
  const assignedUnit = selectedBooking ? ambulances.find((a) => a.id === selectedBooking.assignedUnitId) : null;

  const incomingRequests = bookings.filter((b) => b.stage === 'pending');
  const activeTrips = bookings.filter((b) =>
    ['accepted', 'en_route_pickup', 'on_scene', 'transporting', 'at_hospital'].includes(b.stage)
  );
  const completedOrCancelled = bookings.filter((b) => ['completed', 'cancelled'].includes(b.stage));

  const filteredHistory = completedOrCancelled.filter((b) => {
    if (historyFilter === 'real') return !b.isSimulated;
    if (historyFilter === 'simulated') return b.isSimulated;
    return true;
  });

  const getNextStage = (current: TripStage): TripStage | null => {
    const idx = STAGE_ORDER.indexOf(current);
    if (idx !== -1 && idx < STAGE_ORDER.length - 1) {
      return STAGE_ORDER[idx + 1];
    }
    return null;
  };

  const getStageLabel = (stage: TripStage): string => {
    switch (stage) {
      case 'pending': return '1. Pending Triage';
      case 'accepted': return '2. Request Accepted';
      case 'en_route_pickup': return '3. En Route to Pickup';
      case 'on_scene': return '4. On Scene / Assessing';
      case 'transporting': return '5. Patient Picked Up (To ER)';
      case 'at_hospital': return '6. Arrived at Hospital';
      case 'completed': return '7. Transfer Completed';
      case 'cancelled': return 'Cancelled';
      default: return stage;
    }
  };

  const availableAmbulances = ambulances.filter((a) => a.status === 'available');

  return (
    <div className="space-y-6">
      {/* ---------------- OPERATOR COMMAND CONSOLE TELEMETRY HEADER ---------------- */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-400 bg-sky-950/80 border border-sky-800/80 px-2.5 py-0.5 rounded-md flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-sky-400" />
                <span>Operator Command Console</span>
              </span>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Autonomous Proximity Dispatch Ready</span>
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black tracking-tight">
              Fleet Operations Command Console
            </h2>
            <p className="text-xs text-slate-300">
              Live monitoring of 14 ALS, BLS, and MICU emergency units stationed across Delhi, Noida, and Haryana.
            </p>
          </div>


        </div>

        {/* Live Operational Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-800 text-xs">
          <div>
            <span className="text-slate-400 text-[11px]">Active Dispatches:</span>
            <div className="font-bold font-mono text-sky-400 mt-0.5 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              <span>{activeTrips.length} Active Trips</span>
            </div>
          </div>
          <div>
            <span className="text-slate-400 text-[11px]">Ambulance Availability:</span>
            <div className="font-bold font-mono text-emerald-400 mt-0.5 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5" />
              <span>{availableAmbulances.length} / {ambulances.length} Units Ready</span>
            </div>
          </div>
          <div>
            <span className="text-slate-400 text-[11px]">Incoming Queue:</span>
            <div className="font-bold font-mono text-rose-400 mt-0.5 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5" />
              <span>{incomingRequests.length} Pending Triage</span>
            </div>
          </div>
          <div>
            <span className="text-slate-400 text-[11px]">Automatic Dispatch:</span>
            <div className="font-bold font-mono text-white mt-0.5 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Active (Nearest Unit &lt; 5s)</span>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- OPERATOR TAB CONTROLS ---------------- */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-3 gap-3">
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setOperatorTab('fleet_map')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              operatorTab === 'fleet_map' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-sky-600" />
            <span>Fleet Map</span>
          </button>

          <button
            onClick={() => setOperatorTab('active_trips')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              operatorTab === 'active_trips' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-emerald-600" />
            <span>Active Trips</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full font-mono">
              {activeTrips.length}
            </span>
          </button>

          <button
            onClick={() => setOperatorTab('incoming')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              operatorTab === 'incoming' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-rose-600" />
            <span>Incoming Queue</span>
            {incomingRequests.length > 0 && (
              <span className="text-[10px] bg-rose-600 text-white px-1.5 py-0.2 rounded-full font-mono animate-pulse">
                {incomingRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setOperatorTab('fleet_units')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              operatorTab === 'fleet_units' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Truck className="w-3.5 h-3.5 text-slate-600" />
            <span>Driver & Fleet Availability ({ambulances.length})</span>
          </button>

          <button
            onClick={() => setOperatorTab('history')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              operatorTab === 'history' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5 text-indigo-600" />
            <span>Trip History ({completedOrCancelled.length})</span>
          </button>
        </div>

      </div>

      {/* ---------------- TAB 1: OPERATOR FLEET MAP (Zero user dragging controls) ---------------- */}
      {operatorTab === 'fleet_map' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between pb-3 mb-3 border-b border-slate-100 gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-sky-600" />
                  <span>Delhi NCR Master Fleet Map (Autonomous Dispatch View)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Real-time GPS telemetry for all 14 ambulances across Delhi, Noida, and Haryana. User drag controls disabled for dispatch stability.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  {availableAmbulances.length} Available
                </span>
                <span className="flex items-center gap-1 text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-1 rounded-md font-semibold">
                  {ambulances.length - availableAmbulances.length} Active / Assigned
                </span>
              </div>
            </div>

            {/* Embedded Live Fleet Map */}
            <div className="w-full h-[480px] rounded-xl overflow-hidden border border-slate-200">
              <LeafletMap
                pickupCoords={selectedBooking ? selectedBooking.pickupCoords : { lat: 28.6139, lng: 77.2090 }}
                dropoffCoords={selectedBooking ? selectedBooking.dropoffCoords : { lat: HOSPITALS[0].lat, lng: HOSPITALS[0].lng }}
                ambulances={ambulances}
                activeAmbulanceId={selectedBooking?.assignedUnitId}
                routePolyline={selectedBooking?.routePolyline || []}
                isLocked={true} // NO DRAGGING IN OPERATOR DISPATCH VIEW
                tripStage={selectedBooking?.stage}
                onPickupChange={() => {}}
                onDropoffChange={() => {}}
              />
            </div>
          </div>
        </div>
      )}

      {/* ---------------- TAB 2: ACTIVE TRIPS & OVERRIDE CONTROLLER ---------------- */}
      {operatorTab === 'active_trips' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Active Trips Master List */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wide px-1">
              <span>Active Dispatches in Progress</span>
              <span className="font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                {activeTrips.length} Ongoing
              </span>
            </div>

            {activeTrips.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-500">
                No active ambulance trips at this moment. Start simulation or create a booking to initiate dispatches.
              </div>
            ) : (
              <div className="space-y-2 max-h-[650px] overflow-y-auto pr-1">
                {activeTrips.map((bk) => {
                  const isSelected = selectedBooking?.id === bk.id;
                  const unit = ambulances.find((a) => a.id === bk.assignedUnitId);

                  return (
                    <div
                      key={bk.id}
                      onClick={() => setSelectedBookingId(bk.id)}
                      className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                        isSelected
                          ? 'border-sky-600 bg-sky-50/70 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-slate-900">
                            {bk.trackingCode}
                          </span>
                          {bk.isSimulated && (
                            <span className="text-[9px] font-bold uppercase bg-purple-100 text-purple-800 border border-purple-200 px-1.5 py-0.2 rounded">
                              Simulated
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-sky-100 text-sky-800">
                          {bk.stage.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <div className="text-xs font-bold text-slate-900 mt-2 truncate">
                        {bk.patientName} · {bk.patientPhone}
                      </div>

                      <div className="text-[11px] text-slate-500 truncate mt-0.5">
                        {bk.pickupAddress.split(',')[0]} → {bk.dropoffAddress.split(',')[0]}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-600 mt-2.5 pt-2 border-t border-slate-100">
                        <span className="font-semibold text-emerald-700">
                          {unit ? unit.callSign : 'Unassigned'}
                        </span>
                        <span className="font-mono text-slate-500">
                          ETA: ~{bk.etaMinutes}m ({bk.distanceKm}km)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Selected Active Trip Detailed Controller & Override */}
          <div className="lg:col-span-7">
            {selectedBooking ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-slate-900">
                        Dispatch #{selectedBooking.trackingCode}
                      </h3>
                      {selectedBooking.isSimulated && (
                        <span className="text-[10px] font-bold uppercase bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 rounded">
                          Simulated Ride (Day {selectedBooking.simulationDay || 1})
                        </span>
                      )}
                      <span className="text-xs font-semibold bg-sky-100 text-sky-800 px-2.5 py-0.5 rounded-md uppercase">
                        {selectedBooking.stage.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Patient: <strong className="text-slate-800">{selectedBooking.patientName}</strong> ({selectedBooking.patientPhone})
                    </p>
                  </div>

                  {/* Manual Stage Override Button for Operators */}
                  {getNextStage(selectedBooking.stage) && (
                    <button
                      type="button"
                      onClick={() => onAdvanceStage(selectedBooking.id, getNextStage(selectedBooking.stage)!)}
                      className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Advance to {getStageLabel(getNextStage(selectedBooking.stage)!)}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Assigned Ambulance Unit & OPERATOR OVERRIDE */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-sky-600" />
                      <span>Assigned Unit & Override</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setOverrideUnitBookingId(overrideUnitBookingId === selectedBooking.id ? null : selectedBooking.id)}
                      className="text-xs font-bold text-sky-600 hover:text-sky-800 cursor-pointer underline"
                    >
                      {overrideUnitBookingId === selectedBooking.id ? 'Cancel Override' : 'Override Assignment'}
                    </button>
                  </div>

                  {assignedUnit ? (
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-slate-900">{assignedUnit.callSign} ({assignedUnit.type})</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Driver: {assignedUnit.driverName} ({assignedUnit.driverPhone}) · Base: {assignedUnit.stationName}
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded">
                        {assignedUnit.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                      No ambulance unit currently assigned. Select an available unit below to dispatch.
                    </div>
                  )}

                  {/* Override Dropdown Selector */}
                  {overrideUnitBookingId === selectedBooking.id && (
                    <div className="pt-2 border-t border-slate-200 space-y-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Select Ambulance to Override Assignment:
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                        {ambulances.map((unit) => (
                          <button
                            key={unit.id}
                            type="button"
                            onClick={() => {
                              onAssignUnit(selectedBooking.id, unit.id);
                              setOverrideUnitBookingId(null);
                            }}
                            className={`p-2.5 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                              unit.id === selectedBooking.assignedUnitId
                                ? 'border-sky-600 bg-sky-50 text-sky-900 font-bold'
                                : 'border-slate-200 hover:bg-white text-slate-700'
                            }`}
                          >
                            <div className="font-bold">{unit.callSign}</div>
                            <div className="text-[10px] text-slate-500">
                              {unit.type} · {unit.status.replace(/_/g, ' ')}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Route Locations & Authorized Operator Reroute */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-emerald-600" />
                      <span>Route Locations</span>
                    </span>
                    {onOperatorReroute && (
                      <button
                        type="button"
                        onClick={() => setIsRerouteOpen(!isRerouteOpen)}
                        className="text-xs font-bold text-sky-600 hover:text-sky-800 cursor-pointer underline"
                      >
                        {isRerouteOpen ? 'Close Reroute' : 'Reroute Destination'}
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div>
                      <span className="text-slate-500 font-medium">Pickup Point:</span>
                      <div className="font-semibold text-slate-800">{selectedBooking.pickupAddress}</div>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Destination ER:</span>
                      <div className="font-semibold text-slate-800">{selectedBooking.dropoffAddress}</div>
                    </div>
                  </div>

                  {/* Operator Reroute Dropdown */}
                  {isRerouteOpen && onOperatorReroute && (
                    <div className="pt-2 border-t border-slate-200 space-y-2 animate-in fade-in">
                      <label className="block text-xs font-bold text-slate-800">
                        Select Destination Hospital to Reroute Active Trip:
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                        {HOSPITALS.map((hosp) => (
                          <button
                            key={hosp.id}
                            type="button"
                            onClick={() => {
                              onOperatorReroute(selectedBooking.id, hosp);
                              setIsRerouteOpen(false);
                            }}
                            className={`p-2.5 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                              selectedBooking.destinationHospitalId === hosp.id
                                ? 'border-sky-600 bg-sky-50 text-sky-900 font-bold'
                                : 'border-slate-200 hover:bg-white text-slate-700'
                            }`}
                          >
                            <div className="font-bold">{hosp.name}</div>
                            <div className="text-[10px] text-slate-500">
                              {hosp.region} · {hosp.traumaLevel} · {hosp.availableBeds} beds
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Status History Audit Trail */}
                {selectedBooking.statusHistory && selectedBooking.statusHistory.length > 0 && (
                  <div className="border-t border-slate-200 pt-4 space-y-2">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Audit Trail & Status History
                    </span>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {selectedBooking.statusHistory.map((sh, idx) => (
                        <div key={idx} className="text-xs flex items-start gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <span className="font-bold uppercase text-[10px] text-sky-800 bg-sky-100 px-1.5 py-0.2 rounded mr-1.5">
                              {sh.stage}
                            </span>
                            <span className="text-slate-700">{sh.note || sh.stage}</span>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {new Date(sh.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 text-xs">
                Select an active trip from the queue to view telemetry and override controls.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- TAB 3: INCOMING REQUESTS QUEUE ---------------- */}
      {operatorTab === 'incoming' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Radio className="w-4 h-4 text-rose-600" />
                  <span>Incoming Emergency Dispatch Queue</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Autonomous dispatch automatically evaluates proximity. Pending requests occur when units are en route or awaiting vehicle assignment.
                </p>
              </div>
              <span className="text-xs font-mono font-bold bg-rose-100 text-rose-800 px-2.5 py-1 rounded-full">
                {incomingRequests.length} Pending
              </span>
            </div>

            {incomingRequests.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs">
                No incoming pending requests. All eligible dispatches have been autonomously routed to ambulances.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {incomingRequests.map((bk) => (
                  <div key={bk.id} className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-slate-900">{bk.trackingCode}</span>
                      <span className="text-[10px] font-bold uppercase bg-rose-600 text-white px-2 py-0.5 rounded">
                        Pending Assignment
                      </span>
                    </div>

                    <div className="text-xs">
                      <div className="font-bold text-slate-900">{bk.patientName} ({bk.patientPhone})</div>
                      <div className="text-slate-600 mt-1">{bk.patientNotes}</div>
                    </div>

                    <div className="text-[11px] text-slate-500 pt-2 border-t border-rose-100">
                      Pickup: {bk.pickupAddress}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onAcceptBooking(bk.id)}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                      >
                        Force Dispatch Nearest Unit
                      </button>
                      <button
                        type="button"
                        onClick={() => onRejectBooking(bk.id)}
                        className="px-3 py-2 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- TAB 4: DRIVER & FLEET AVAILABILITY ---------------- */}
      {operatorTab === 'fleet_units' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-sky-600" />
                  <span>Ambulance Fleet & Paramedic Telemetry</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  14 units across Delhi NCR with driver profiles, fuel/battery telemetry, and Cloudinary photo management.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1 rounded-lg font-bold">
                  {availableAmbulances.length} Ready
                </span>
                <span className="bg-sky-50 border border-sky-200 text-sky-800 px-3 py-1 rounded-lg font-bold">
                  {ambulances.length - availableAmbulances.length} On Duty
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
              {ambulances.map((unit) => {
                const isAvail = unit.status === 'available';

                return (
                  <div
                    key={unit.id}
                    className="border border-slate-200 rounded-xl p-4 bg-white shadow-2xs hover:shadow-xs transition-all space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 truncate pr-2">
                        {unit.callSign}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          isAvail
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-sky-100 text-sky-800'
                        }`}
                      >
                        {unit.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    {/* Driver Profile & Photo */}
                    <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <div className="relative w-12 h-12 rounded-full overflow-hidden bg-slate-200 shrink-0 border border-slate-300">
                        <img
                          src={unit.driverPhoto}
                          alt={unit.driverName}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="min-w-0 flex-1 text-xs">
                        <div className="font-bold text-slate-900 truncate">{unit.driverName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{unit.driverPhone}</div>
                        <div className="text-[10px] text-slate-400">Rating: ★ {unit.driverRating}</div>
                      </div>

                      {/* Cloudinary Photo Replace Trigger */}
                      {onUploadDriverPhoto && (
                        <button
                          type="button"
                          onClick={() => onUploadDriverPhoto(unit.id)}
                          className="p-1.5 text-slate-500 hover:text-sky-600 hover:bg-white rounded-md transition-colors cursor-pointer border border-transparent hover:border-slate-200"
                          title="Upload new driver photo via Cloudinary"
                        >
                          <Camera className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="text-xs space-y-1 text-slate-600">
                      <div>
                        <strong>Unit Type:</strong> {unit.typeName}
                      </div>
                      <div>
                        <strong>Paramedic:</strong> {unit.paramedicName}
                      </div>
                      <div>
                        <strong>Base Bay:</strong> {unit.stationName}
                      </div>
                    </div>

                    {/* Telemetry Fuel / Battery */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                      <div>
                        <span className="text-slate-400">Fuel:</span>{' '}
                        <span className="font-bold text-slate-800 font-mono">{unit.fuelPct}%</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Battery:</span>{' '}
                        <span className="font-bold text-slate-800 font-mono">{unit.batteryPct}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- TAB 5: COMPREHENSIVE TRIP HISTORY ---------------- */}
      {operatorTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-600" />
                  <span>Master Emergency Dispatch History</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Complete audit log of all completed and cancelled emergency dispatches, filterable by real vs simulated.
                </p>
              </div>

              {/* Real vs Simulated Filter */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setHistoryFilter('all')}
                  className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                    historyFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
                  }`}
                >
                  All ({completedOrCancelled.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryFilter('real')}
                  className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                    historyFilter === 'real' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
                  }`}
                >
                  Real Dispatches ({completedOrCancelled.filter((b) => !b.isSimulated).length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryFilter('simulated')}
                  className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                    historyFilter === 'simulated' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
                  }`}
                >
                  Simulated ({completedOrCancelled.filter((b) => b.isSimulated).length})
                </button>
              </div>
            </div>

            {filteredHistory.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs">
                No dispatch records found for the selected filter.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredHistory.map((bk) => {
                  const unit = ambulances.find((a) => a.id === bk.assignedUnitId);

                  return (
                    <div key={bk.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">{bk.trackingCode}</span>
                          {bk.isSimulated ? (
                            <span className="text-[9px] font-bold uppercase bg-purple-100 text-purple-800 border border-purple-200 px-1.5 py-0.2 rounded">
                              Simulated Day {bk.simulationDay || 1}
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold uppercase bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded">
                              Real Patient Call
                            </span>
                          )}
                          <span
                            className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${
                              bk.stage === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {bk.stage}
                          </span>
                        </div>
                        <div className="text-slate-800 font-semibold truncate">
                          {bk.patientName} · {bk.pickupAddress.split(',')[0]} → {bk.dropoffAddress.split(',')[0]}
                        </div>
                      </div>

                      <div className="text-right text-[11px] text-slate-500">
                        <div>Unit: {unit ? unit.callSign : 'Unassigned'}</div>
                        <div className="font-mono">{new Date(bk.createdAt).toLocaleTimeString()}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
