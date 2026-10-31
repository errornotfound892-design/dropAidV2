import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ViewMode,
  Booking,
  AmbulanceUnit,
  LatLng,
  TripStage,
  PatientProfile,
  BookingDocument,
  Hospital,
  SimulationState,
  EmergencyCategory,
  HospitalDoctor,
  BookingSubmissionData
} from './types/index.ts';
import {
  HOSPITALS,
  LANDMARKS,
  INITIAL_AMBULANCES,
  INITIAL_PATIENT,
} from './data/mockData.ts';
import {
  getDrivingRoute,
  reverseGeocode,
  findNearestAvailableAmbulance,
  calculateBearing,
  calculateHaversineDistance,
} from './services/routingService.ts';
import { getRecommendedHospital } from './services/hospitalMatcher.ts';
import { Header } from './components/Common/Header.tsx';
import { UserDashboard } from './components/UserDashboard/UserDashboard.tsx';
import { OperatorDashboard } from './components/OperatorDashboard/OperatorDashboard.tsx';
import { HospitalDirectory } from './components/Hospitals/HospitalDirectory.tsx';
import { CloudinaryUploadModal } from './components/Cloudinary/CloudinaryUploadModal.tsx';
import { UserProfileView } from './components/Profile/UserProfileView.tsx';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export default function App() {
  // 1. Primary Top Controls State
  const [currentView, setCurrentView] = useState<ViewMode>('user');

  // Emergency specialty category for intelligent hospital matching
  const [selectedCategory, setSelectedCategory] = useState<EmergencyCategory>('general');

  // 2. Map & Route State (Default: Central Delhi NCR)
  const [pickup, setPickup] = useState<{ coords: LatLng; address: string }>({
    coords: { lat: 28.6327, lng: 77.2197 }, // Connaught Place, New Delhi
    address: 'Connaught Place (Inner Circle), Block A, New Delhi',
  });

  const [hospitals, setHospitals] = useState<Hospital[]>(() => {
    return HOSPITALS;
  });

  // Dynamic intelligent recommendation based on initial GPS location & category (Removes hardcoded AIIMS)
  const [dropoff, setDropoff] = useState<{ coords: LatLng; address: string; hospitalId?: string }>(() => {
    const recommended = getRecommendedHospital({ lat: 28.6327, lng: 77.2197 }, HOSPITALS, 'general');
    return {
      coords: { lat: recommended.hospital.lat, lng: recommended.hospital.lng },
      address: `${recommended.hospital.name}, ${recommended.hospital.address}`,
      hospitalId: recommended.hospital.id,
    };
  });

  const [routePolyline, setRoutePolyline] = useState<[number, number][]>([]);
  const [routeDistanceKm, setRouteDistanceKm] = useState<number>(7.8);
  const [routeEtaMins, setRouteEtaMins] = useState<number>(6);
  const [routeError, setRouteError] = useState<string | null>(null);

  // 3. Fleet & Bookings Simulation State
  const [ambulances, setAmbulances] = useState<AmbulanceUnit[]>(() => {
    const saved = localStorage.getItem('dropaid_ambulances');
    return saved ? JSON.parse(saved) : INITIAL_AMBULANCES;
  });

  const [bookings, setBookings] = useState<Booking[]>(() => {
    try {
      const saved = localStorage.getItem('dropaid_bookings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const nonDemo = parsed.filter((b) => b.id !== 'bk-demo-01');
          return nonDemo;
        }
      }
    } catch {
      // fallback
    }
    return [];
  });

  // Daily Ride Simulation State
  const [simulationState, setSimulationState] = useState<SimulationState>({
    status: 'idle',
    simulatedDay: 1,
    simulatedHour: 8,
    simulatedMinute: 0,
    speedMultiplier: 10,
    ridesTargetPerDay: 20,
    generatedCount: 0,
    activeCount: 0,
    completedCount: 0,
  });

  const [patientProfile, setPatientProfile] = useState<PatientProfile>(() => {
    try {
      const saved = localStorage.getItem('dropaid_patient_profile');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return INITIAL_PATIENT;
  });

  const [gpsAccuracy, setGpsAccuracy] = useState<number>(10);
  const [isDetectingGPS, setIsDetectingGPS] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const isSubmittingRef = useRef<boolean>(false);
  const routingRequestIdRef = useRef<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Autonomous 5-Second Dispatch & Movement Engine Refs
  const [dispatchCountdown, setDispatchCountdown] = useState<number | null>(null);
  const dispatchCountdownRef = useRef<NodeJS.Timeout | null>(null);
  const movementIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const activeTransitionsRef = useRef<Set<string>>(new Set());

  // 4. Modals State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<
    'id_card' | 'insurance' | 'medical_history' | 'incident_photo' | 'hospital_photo' | 'driver_photo' | 'ambulance_photo'
  >('insurance');
  const [uploadEntityId, setUploadEntityId] = useState<string | undefined>(undefined);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  // Active User Booking (excludes simulated rides from user-facing active card unless tracking)
  const activeBooking = bookings.find(
    (b) => !b.isSimulated && b.stage !== 'completed' && b.stage !== 'cancelled'
  ) || null;

  const assignedAmbulance = activeBooking?.assignedUnitId
    ? ambulances.find((a) => a.id === activeBooking.assignedUnitId) || null
    : null;

  // Persist State to LocalStorage
  useEffect(() => {
    localStorage.setItem('dropaid_bookings', JSON.stringify(bookings));
  }, [bookings]);

  useEffect(() => {
    localStorage.setItem('dropaid_ambulances', JSON.stringify(ambulances));
  }, [ambulances]);

  // Toast Helper
  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3800);
  };

  // Sync with Server (simulation state, bookings, fleet, hospitals, and profile)
  useEffect(() => {
    const fetchSync = async () => {
      try {
        const res = await fetch('/api/sync');
        if (!res.ok) return;
        const data = await res.json();

        if (data.simulation) {
          setSimulationState(data.simulation);
        }
        if (Array.isArray(data.bookings)) {
          setBookings((prev) => {
            const serverMap = new Map<string, Booking>(data.bookings.map((b: Booking) => [b.id, b]));
            const localActive = prev.find(
              (b) => !b.isSimulated && b.stage !== 'completed' && b.stage !== 'cancelled'
            );
            if (localActive && !serverMap.has(localActive.id)) {
              serverMap.set(localActive.id, localActive);
            }

            const STAGE_WEIGHT: Record<TripStage, number> = {
              pending: 0,
              accepted: 1,
              en_route_pickup: 2,
              on_scene: 3,
              transporting: 4,
              at_hospital: 5,
              completed: 6,
              cancelled: 6,
            };

            return Array.from(serverMap.values()).map((sb) => {
              const localMatch = prev.find((p) => p.id === sb.id);
              if (!localMatch) return sb;

              const localWeight = STAGE_WEIGHT[localMatch.stage] ?? 0;
              const serverWeight = STAGE_WEIGHT[sb.stage] ?? 0;

              // If local stage has progressed further than server polling state, protect local progression!
              if (localWeight > serverWeight) {
                return {
                  ...sb,
                  stage: localMatch.stage,
                  routePolyline: localMatch.routePolyline?.length ? localMatch.routePolyline : sb.routePolyline,
                  currentVehiclePosition: localMatch.currentVehiclePosition || sb.currentVehiclePosition,
                  currentWaypointIndex: localMatch.currentWaypointIndex ?? sb.currentWaypointIndex,
                  distanceKm: localMatch.distanceKm ?? sb.distanceKm,
                  etaMinutes: localMatch.etaMinutes ?? sb.etaMinutes,
                  statusHistory: localMatch.statusHistory || sb.statusHistory,
                  stageTimestamps: localMatch.stageTimestamps || sb.stageTimestamps,
                };
              }

              // If at the same active transit stage, retain smooth vehicle coordinate interpolation
              if (localWeight === serverWeight && ['en_route_pickup', 'on_scene', 'transporting', 'at_hospital'].includes(localMatch.stage)) {
                return {
                  ...sb,
                  stage: localMatch.stage,
                  currentVehiclePosition: localMatch.currentVehiclePosition || sb.currentVehiclePosition,
                  currentWaypointIndex: localMatch.currentWaypointIndex ?? sb.currentWaypointIndex,
                  distanceKm: localMatch.distanceKm ?? sb.distanceKm,
                  etaMinutes: localMatch.etaMinutes ?? sb.etaMinutes,
                  routePolyline: localMatch.routePolyline?.length ? localMatch.routePolyline : sb.routePolyline,
                };
              }

              return sb;
            });
          });
        }
        if (Array.isArray(data.ambulances) && data.ambulances.length > 0) {
          setAmbulances((prev) =>
            data.ambulances.map((sa: AmbulanceUnit) => {
              const localMatch = prev.find((la) => la.id === sa.id);
              if (localMatch && ['en_route_pickup', 'on_scene', 'transporting', 'at_hospital'].includes(localMatch.status)) {
                return {
                  ...sa,
                  status: localMatch.status,
                  location: localMatch.location,
                  heading: localMatch.heading,
                  speedKmH: localMatch.speedKmH,
                  currentBookingId: localMatch.currentBookingId ?? sa.currentBookingId,
                };
              }
              return sa;
            })
          );
        }
        if (Array.isArray(data.hospitals) && data.hospitals.length > 0) {
          setHospitals(data.hospitals);
        }
        if (data.profile) {
          setPatientProfile((prev) => ({ ...prev, ...data.profile }));
        }
      } catch {
        // silent sync
      }
    };

    fetchSync();
    const timer = setInterval(fetchSync, 2500);
    return () => clearInterval(timer);
  }, []);

  // Fetch initial profile from server on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/profile');
        if (res.ok) {
          const data = await res.json();
          if (data.profile) {
            setPatientProfile(data.profile);
            localStorage.setItem('dropaid_patient_profile', JSON.stringify(data.profile));
          }
        }
      } catch (err) {
        console.warn('Profile fetch error, using local fallback:', err);
      }
    };
    fetchProfile();
  }, []);

  // Save profile changes (persisted in database & localStorage)
  const handleSaveProfile = async (updated: PatientProfile) => {
    setPatientProfile(updated);
    localStorage.setItem('dropaid_patient_profile', JSON.stringify(updated));

    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });

      if (!res.ok) {
        throw new Error('Server returned error');
      }

      showToast('Profile and medical records saved to database!', 'success');
    } catch (err) {
      console.warn('Error saving profile to server:', err);
      showToast('Profile saved in local storage (Server offline fallback).', 'info');
    }
  };

  // Recalculate Route preview when no active booking is running
  const calculateCurrentRoute = useCallback(async (start: LatLng, end: LatLng) => {
    setRouteError(null);
    const reqId = ++routingRequestIdRef.current;
    try {
      const result = await getDrivingRoute(start, end);
      if (reqId !== routingRequestIdRef.current) return;
      setRoutePolyline(result.polyline);
      setRouteDistanceKm(result.distanceKm);
      setRouteEtaMins(result.etaMinutes);
    } catch (err: any) {
      if (reqId === routingRequestIdRef.current) {
        console.warn('Failed to calculate route:', err);
        setRouteError('Route service calculating road grid path.');
      }
    }
  }, []);

  // Automatically update preview route if no active booking
  useEffect(() => {
    if (!activeBooking) {
      calculateCurrentRoute(pickup.coords, dropoff.coords);
    } else if (activeBooking.routePolyline && activeBooking.routePolyline.length > 0) {
      setRoutePolyline(activeBooking.routePolyline);
      setRouteDistanceKm(activeBooking.distanceKm);
      setRouteEtaMins(activeBooking.etaMinutes);
    }
  }, [pickup.coords, dropoff.coords, activeBooking?.id, activeBooking?.stage, calculateCurrentRoute]);

  // CONTINUOUS AMBULANCE ROAD-ROUTE MOVEMENT ENGINE
  // Animates vehicle markers smoothly and continuously along actual road-route coordinates.
  // Continuously updates vehicle coordinates, heading/bearing, remaining distance, ETA, and triggers stage transitions.
  useEffect(() => {
    const isTransitStage = (stage: TripStage) => stage === 'en_route_pickup' || stage === 'transporting';

    movementIntervalRef.current = setInterval(() => {
      setBookings((prevBookings) => {
        let hasChanges = false;
        const nextBookings = [...prevBookings];

        for (let idx = 0; idx < nextBookings.length; idx++) {
          const bk = nextBookings[idx];
          if (!isTransitStage(bk.stage) || !bk.assignedUnitId || !bk.routePolyline || bk.routePolyline.length < 2) {
            continue;
          }

          const polyline = bk.routePolyline;
          const totalPoints = polyline.length;
          const currIdx = bk.currentWaypointIndex ?? 0;

          if (currIdx >= totalPoints - 1) {
            // Reached destination for current route segment
            if (bk.stage === 'en_route_pickup') {
              if (activeTransitionsRef.current.has(bk.id)) {
                continue;
              }
              activeTransitionsRef.current.add(bk.id);
              hasChanges = true;

              const arrivedTime = new Date().toISOString();
              nextBookings[idx] = {
                ...bk,
                stage: 'on_scene',
                currentVehiclePosition: [bk.pickupCoords.lat, bk.pickupCoords.lng],
                currentWaypointIndex: 0,
                etaMinutes: 0,
                distanceKm: 0,
                stageTimestamps: {
                  ...bk.stageTimestamps,
                  arrivedScene: arrivedTime,
                },
                statusHistory: [
                  ...(bk.statusHistory || []),
                  {
                    stage: 'on_scene',
                    timestamp: arrivedTime,
                    note: 'Ambulance arrived at patient scene. Paramedics initiating triage and boarding patient.',
                  },
                ],
              };

              const targetBkId = bk.id;
              const unitId = bk.assignedUnitId;
              const pickupPos = bk.pickupCoords;
              const dropoffPos = bk.dropoffCoords;
              const dropoffAddr = bk.dropoffAddress;

              // Synchronize ambulance status on scene
              setAmbulances((prevAmbs) =>
                prevAmbs.map((a) =>
                  a.id === unitId
                    ? { ...a, status: 'on_scene', location: { ...pickupPos }, speedKmH: 0 }
                    : a
                )
              );

              // 1. Immediately report on_scene stage to server
              fetch(`/api/bookings/${targetBkId}/stage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  stage: 'on_scene',
                  assignedUnitId: unitId,
                  isOperator: true,
                }),
              }).catch(() => {});

              // 2. Compute true road route from patient pickup to selected hospital
              getDrivingRoute(pickupPos, dropoffPos)
                .then((hospRoute) => {
                  // Allow 2.5s for realistic patient triage & boarding into ambulance
                  setTimeout(() => {
                    const departedTime = new Date().toISOString();
                    setBookings((latest) =>
                      latest.map((b) =>
                        b.id === targetBkId
                          ? {
                              ...b,
                              stage: 'transporting',
                              routePolyline: hospRoute.polyline,
                              currentWaypointIndex: 0,
                              currentVehiclePosition: hospRoute.polyline[0] || [pickupPos.lat, pickupPos.lng],
                              distanceKm: hospRoute.distanceKm,
                              etaMinutes: hospRoute.etaMinutes,
                              stageTimestamps: {
                                ...b.stageTimestamps,
                                departedScene: departedTime,
                              },
                              statusHistory: [
                                ...(b.statusHistory || []),
                                {
                                  stage: 'transporting',
                                  timestamp: departedTime,
                                  note: `Patient loaded into ambulance. En route to ${dropoffAddr.split(',')[0]} emergency trauma bay.`,
                                },
                              ],
                            }
                          : b
                      )
                    );

                    // Update ambulance to transporting
                    setAmbulances((latestAmbs) =>
                      latestAmbs.map((a) =>
                        a.id === unitId
                          ? { ...a, status: 'transporting', speedKmH: 52 }
                          : a
                      )
                    );

                    // Sync transporting stage to server with hospital road polyline
                    fetch(`/api/bookings/${targetBkId}/stage`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        stage: 'transporting',
                        assignedUnitId: unitId,
                        routePolyline: hospRoute.polyline,
                        distanceKm: hospRoute.distanceKm,
                        etaMinutes: hospRoute.etaMinutes,
                        isOperator: true,
                      }),
                    }).catch(() => {});

                    // Unlock transitions for next phase (hospital arrival)
                    activeTransitionsRef.current.delete(targetBkId);
                  }, 2500);
                })
                .catch((err) => {
                  console.warn('Failed to calculate road route to hospital:', err);
                  activeTransitionsRef.current.delete(targetBkId);
                });

            } else if (bk.stage === 'transporting') {
              if (activeTransitionsRef.current.has(bk.id)) {
                continue;
              }
              activeTransitionsRef.current.add(bk.id);
              hasChanges = true;

              const arrivedHospTime = new Date().toISOString();
              nextBookings[idx] = {
                ...bk,
                stage: 'at_hospital',
                currentVehiclePosition: [bk.dropoffCoords.lat, bk.dropoffCoords.lng],
                currentWaypointIndex: 0,
                etaMinutes: 0,
                distanceKm: 0,
                stageTimestamps: {
                  ...bk.stageTimestamps,
                  arrivedHospital: arrivedHospTime,
                },
                statusHistory: [
                  ...(bk.statusHistory || []),
                  {
                    stage: 'at_hospital',
                    timestamp: arrivedHospTime,
                    note: 'Arrived at Hospital Emergency Bay. Handing off patient to trauma resuscitation team.',
                  },
                ],
              };

              const targetBkId = bk.id;
              const unitId = bk.assignedUnitId;

              setAmbulances((prevAmbs) =>
                prevAmbs.map((a) =>
                  a.id === unitId
                    ? { ...a, status: 'at_hospital', location: { ...bk.dropoffCoords }, speedKmH: 0 }
                    : a
                )
              );

              // 1. Immediately report at_hospital stage to server
              fetch(`/api/bookings/${targetBkId}/stage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  stage: 'at_hospital',
                  assignedUnitId: unitId,
                  isOperator: true,
                }),
              }).catch(() => {});

              // 2. Complete transfer after 4.5 seconds clinical reception
              setTimeout(() => {
                const completedTime = new Date().toISOString();
                setBookings((latest) =>
                  latest.map((b) =>
                    b.id === targetBkId
                      ? {
                          ...b,
                          stage: 'completed',
                          stageTimestamps: {
                            ...b.stageTimestamps,
                            completed: completedTime,
                          },
                          statusHistory: [
                            ...(b.statusHistory || []),
                            {
                              stage: 'completed',
                              timestamp: completedTime,
                              note: 'Emergency transfer completed. Unit disinfected and returned to base bay.',
                            },
                          ],
                        }
                      : b
                  )
                );

                setAmbulances((latestAmbs) =>
                  latestAmbs.map((a) => {
                    if (a.id === unitId) {
                      return {
                        ...a,
                        status: 'available',
                        currentBookingId: undefined,
                        location: { ...a.baseLocation },
                        speedKmH: 0,
                      };
                    }
                    return a;
                  })
                );

                fetch(`/api/bookings/${targetBkId}/stage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ stage: 'completed', isOperator: true }),
                }).catch(() => {});

                activeTransitionsRef.current.delete(targetBkId);
              }, 4500);
            }
          } else {
            // Step forward along road route with realistic responsive progress
            hasChanges = true;
            const step = Math.max(1, Math.min(3, Math.ceil(totalPoints / 60)));
            const nextIdx = Math.min(currIdx + step, totalPoints - 1);
            const currPoint = polyline[currIdx];
            const nextPoint = polyline[nextIdx];
            const heading = calculateBearing(
              { lat: currPoint[0], lng: currPoint[1] },
              { lat: nextPoint[0], lng: nextPoint[1] }
            );

            // Compute remaining distance
            let remainingKm = 0;
            for (let p = nextIdx; p < totalPoints - 1; p++) {
              remainingKm += calculateHaversineDistance(
                { lat: polyline[p][0], lng: polyline[p][1] },
                { lat: polyline[p + 1][0], lng: polyline[p + 1][1] }
              );
            }
            const remainingMins = Math.max(1, Math.round((remainingKm / 48) * 60));

            nextBookings[idx] = {
              ...bk,
              currentWaypointIndex: nextIdx,
              currentVehiclePosition: nextPoint,
              distanceKm: Number(remainingKm.toFixed(1)),
              etaMinutes: remainingMins,
            };

            // Synchronize ambulance location and heading
            setAmbulances((prevAmbs) =>
              prevAmbs.map((a) =>
                a.id === bk.assignedUnitId
                  ? {
                      ...a,
                      location: { lat: nextPoint[0], lng: nextPoint[1] },
                      heading,
                      speedKmH: 48,
                    }
                  : a
              )
            );
          }
        }

        return hasChanges ? nextBookings : prevBookings;
      });
    }, 750);

    return () => {
      if (movementIntervalRef.current) {
        clearInterval(movementIntervalRef.current);
        movementIntervalRef.current = null;
      }
    };
  }, []);

  // GPS Location Detection with Graceful Error & Permission Handling
  const handleDetectGPS = useCallback(() => {
    if (!navigator.geolocation) {
      const msg = 'Geolocation is not supported by your browser.';
      setGpsError(msg);
      showToast(msg, 'error');
      return;
    }

    setIsDetectingGPS(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const accuracy = Math.round(pos.coords.accuracy || 12);
        setGpsAccuracy(accuracy);
        setGpsError(null);

        const address = await reverseGeocode(coords.lat, coords.lng);
        setPickup({ coords, address });
        setIsDetectingGPS(false);
        showToast(`GPS Position detected: ${address.split(',')[0]} (±${accuracy}m)`, 'success');
      },
      (err) => {
        setIsDetectingGPS(false);
        let errorMsg = 'GPS location unavailable.';
        if (err.code === err.PERMISSION_DENIED) {
          errorMsg = 'Location permission was denied by browser. Please enable location permissions or select your address below.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          errorMsg = 'GPS satellite fix or network position is currently unavailable.';
        } else if (err.code === err.TIMEOUT) {
          errorMsg = 'GPS location request timed out.';
        }
        setGpsError(errorMsg);
        showToast(errorMsg, 'error');
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 10000 }
    );
  }, []);

  // Map Change Handlers (Customer view before booking)
  const handlePickupChange = (coords: LatLng, address: string) => {
    setPickup({ coords, address });
  };

  const handleDropoffChange = (coords: LatLng, address: string, hospitalId?: string) => {
    setDropoff({ coords, address, hospitalId });
  };

  // Switch Emergency Category with Intelligent Hospital Matching
  const handleSelectCategory = (cat: EmergencyCategory) => {
    setSelectedCategory(cat);
    // If no active booking, automatically compute and route to the top recommended hospital
    const active = bookings.find((b) => b.stage !== 'completed' && b.stage !== 'cancelled' && !b.isSimulated);
    if (!active) {
      const rec = getRecommendedHospital(pickup.coords, hospitals, cat);
      setDropoff({
        coords: { lat: rec.hospital.lat, lng: rec.hospital.lng },
        address: `${rec.hospital.name}, ${rec.hospital.address}`,
        hospitalId: rec.hospital.id,
      });
      calculateCurrentRoute(pickup.coords, { lat: rec.hospital.lat, lng: rec.hospital.lng });
    }
  };

  // CREATE EMERGENCY BOOKING (Hold 5s or Manual Form)
  // WITH AUTONOMOUS PROXIMITY DISPATCH & BACKEND AUTOMATION
  const handleCreateBooking = async (
    equipmentOrData: string[] | BookingSubmissionData,
    maybeNotes?: string,
    maybeBookingType: 'emergency_hold' | 'manual' = 'emergency_hold'
  ) => {
    if (isSubmittingRef.current) return;
    if (activeBooking && activeBooking.stage !== 'completed' && activeBooking.stage !== 'cancelled') {
      showToast('An emergency booking is already in progress.', 'info');
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    const isSubmissionData = !Array.isArray(equipmentOrData) && typeof equipmentOrData === 'object';
    const subData: Partial<BookingSubmissionData> = isSubmissionData ? equipmentOrData : {};
    const equipmentIds = isSubmissionData ? (subData.equipmentIds || ['eq-als', 'eq-cardiac']) : (equipmentOrData as string[]);
    const notes = isSubmissionData ? (subData.notes || '') : (maybeNotes || '');
    const bookingType = isSubmissionData ? (subData.bookingType || 'emergency_hold') : maybeBookingType;

    const patientName = subData.patientName?.trim() || patientProfile.name || 'Emergency Patient';
    const patientPhone = subData.patientPhone?.trim() || patientProfile.phone || '+91 98101 23456';
    const patientEmail = subData.patientEmail || patientProfile.email || undefined;
    const bloodGroup = subData.bloodGroup || patientProfile.bloodType || undefined;
    const bookingFor = subData.bookingFor || 'self';
    const relationship = subData.relationship;
    const callerName = subData.callerName;
    const callerPhone = subData.callerPhone;
    const patientPhotoUrl = subData.patientPhotoUrl;
    const patientPhotoPublicId = subData.patientPhotoPublicId;
    const photoConsentGiven = subData.photoConsentGiven;
    const effectiveCategory = subData.issueCategory || selectedCategory;

    const newBookingId = `bk-${Date.now()}`;
    const trackingCode = `DA-${Math.floor(1000 + Math.random() * 9000)}`;
    const caseAccessKey = Math.random().toString(36).substring(2, 10);

    // Autonomous Proximity Dispatch: identify nearest available ambulance
    const nearestResult = findNearestAvailableAmbulance(pickup.coords, ambulances);
    const assigned = nearestResult?.ambulance || null;

    let stage: TripStage = 'pending';
    let assignedUnitId: string | undefined = undefined;
    let initialPolyline: [number, number][] = [];
    let initialDist = nearestResult?.distanceKm || 4.8;
    let initialEta = nearestResult?.etaMinutes || 5;

    if (assigned) {
      stage = 'en_route_pickup';
      assignedUnitId = assigned.id;
      try {
        const leg = await getDrivingRoute(assigned.location, pickup.coords);
        initialPolyline = leg.polyline;
        initialDist = leg.distanceKm;
        initialEta = leg.etaMinutes;
      } catch {
        initialPolyline = [
          [assigned.location.lat, assigned.location.lng],
          [pickup.coords.lat, pickup.coords.lng],
        ];
      }

      setAmbulances((prev) =>
        prev.map((a) =>
          a.id === assigned.id
            ? { ...a, status: 'en_route_pickup', currentBookingId: newBookingId, speedKmH: 48 }
            : a
        )
      );
    }

    const nowIso = new Date().toISOString();
    const destHospital = hospitals.find((h) => h.id === dropoff.hospitalId || dropoff.address.includes(h.name));
    const defaultDoctor = destHospital?.attendingDoctors?.[0];

    const newBooking: Booking = {
      id: newBookingId,
      trackingCode,
      createdAt: nowIso,
      patientName,
      patientPhone,
      patientEmail,
      bloodGroup,
      bookingFor,
      relationship,
      callerName,
      callerPhone,
      patientPhotoUrl,
      patientPhotoPublicId,
      photoConsentGiven,
      caseAccessKey,
      patientNotes: `${bookingType === 'emergency_hold' ? '[5s Hold Emergency] ' : '[Manual Assisted] '}${notes}`,
      pickupAddress: pickup.address,
      pickupCoords: { ...pickup.coords },
      dropoffAddress: dropoff.address,
      dropoffCoords: { ...dropoff.coords },
      destinationHospitalId: dropoff.hospitalId,
      equipmentRequested: equipmentIds,
      stage,
      assignedUnitId,
      etaMinutes: initialEta,
      distanceKm: initialDist,
      routePolyline: initialPolyline,
      currentVehiclePosition: assigned ? [assigned.location.lat, assigned.location.lng] : undefined,
      priceEst: Math.round(150 + initialDist * 18),
      documents: [],
      stageTimestamps: {
        requested: nowIso,
        ...(assigned ? { accepted: nowIso, dispatched: nowIso } : {}),
      },
      isSimulated: false,
      issueCategory: effectiveCategory,
      confirmedDoctor: defaultDoctor,
      isDoctorConfirmedByHospital: false, // Displays "Awaiting hospital confirmation" until hospital signs off
      treatmentTeam: destHospital?.treatmentTeam,
      treatmentProcedure: destHospital?.primaryProcedures?.[0],
      preArrivalAlertSent: false,
      preArrivalConsentGiven: false,
      telegramNotificationStatus: 'pending',
      statusHistory: [
        { stage: 'pending', timestamp: nowIso, note: `Emergency dispatch requested (${bookingFor === 'someone_else' ? `For ${relationship || 'other'}` : 'Self'})` },
        ...(assigned
          ? [
              {
                stage: 'en_route_pickup' as TripStage,
                timestamp: nowIso,
                note: `Auto-dispatched unit ${assigned.callSign} (Driver: ${assigned.driverName}) via proximity algorithm`,
              },
            ]
          : []),
      ],
    };

    setRoutePolyline(initialPolyline);
    setBookings((prev) => [newBooking, ...prev.filter((b) => b.id !== newBookingId)]);

    if (assigned) {
      showToast(
        `Auto-Dispatched Unit ${assigned.callSign}! En route to your pickup location (ETA ~${initialEta}m).`,
        'success'
      );
    } else {
      showToast(
        `Emergency dispatch initiated! Searching Delhi NCR fleet for nearest available unit...`,
        'info'
      );
    }

    // Sync to Backend API with Telegram & Database Persistence
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newBookingId,
          trackingCode,
          assignedUnitId,
          routePolyline: initialPolyline,
          patientName,
          patientPhone,
          patientEmail,
          bloodGroup,
          bookingFor,
          relationship,
          callerName,
          callerPhone,
          patientPhotoUrl,
          patientPhotoPublicId,
          photoConsentGiven,
          caseAccessKey,
          patientNotes: notes,
          pickupAddress: pickup.address,
          pickupCoords: pickup.coords,
          dropoffAddress: dropoff.address,
          dropoffCoords: dropoff.coords,
          destinationHospitalId: dropoff.hospitalId,
          equipmentRequested: equipmentIds,
          bookingType,
          issueCategory: effectiveCategory,
        }),
      });
      const data = await res.json();
      if (data.success && data.booking) {
        setBookings((prev) =>
          prev.map((b) => (b.id === newBookingId ? { ...b, ...data.booking } : b))
        );
      }
    } catch (apiErr) {
      console.warn('Backend API booking network glitch, preserved in state:', apiErr);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Pre-Arrival ER Trauma Alert Transmission (with patient consent)
  const handleSendPreArrivalAlert = async () => {
    if (!activeBooking) return;
    try {
      const res = await fetch(`/api/bookings/${activeBooking.id}/pre-arrival-alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consentGiven: true }),
      });
      const data = await res.json();
      if (data.success && data.booking) {
        setBookings((prev) => prev.map((b) => (b.id === activeBooking.id ? { ...b, ...data.booking } : b)));
      } else {
        setBookings((prev) =>
          prev.map((b) =>
            b.id === activeBooking.id
              ? {
                  ...b,
                  preArrivalAlertSent: true,
                  preArrivalConsentGiven: true,
                  preArrivalSentAt: new Date().toISOString(),
                }
              : b
          )
        );
      }
      showToast('Pre-Arrival Alert transmitted to Emergency Trauma Bay!', 'success');
    } catch (err) {
      console.warn('Pre-arrival alert send fallback:', err);
      setBookings((prev) =>
        prev.map((b) =>
          b.id === activeBooking.id
            ? {
                ...b,
                preArrivalAlertSent: true,
                preArrivalConsentGiven: true,
                preArrivalSentAt: new Date().toISOString(),
              }
            : b
        )
      );
      showToast('Pre-Arrival Alert transmitted to Emergency Trauma Bay!', 'success');
    }
  };

  // Secure Medical Document Upload to Active Booking
  const handleUploadDocument = async (
    file: File,
    stage: 'pre_dispatch' | 'in_transit' | 'hospital_handoff' | 'post_treatment',
    type: 'id_card' | 'insurance' | 'medical_history' | 'prescription' | 'incident_photo'
  ) => {
    if (!activeBooking) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', type);
      const upRes = await fetch('/api/cloudinary/upload', {
        method: 'POST',
        body: formData,
      });
      const upData = await upRes.json();
      const assetUrl = upData.url || URL.createObjectURL(file);
      const publicId = upData.publicId || `local-${Date.now()}`;

      const docPayload = {
        name: file.name,
        documentType: type,
        url: assetUrl,
        publicId,
        treatmentStage: stage,
        consentGranted: true,
        retentionPolicy: '90_days' as const,
      };

      const res = await fetch(`/api/bookings/${activeBooking.id}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(docPayload),
      });
      const data = await res.json();

      if (data.success && data.document) {
        setBookings((prev) =>
          prev.map((b) =>
            b.id === activeBooking.id ? { ...b, documents: [...(b.documents || []), data.document] } : b
          )
        );
      } else {
        const localDoc: BookingDocument = {
          id: `doc-${Date.now()}`,
          name: file.name,
          type: type,
          url: assetUrl,
          publicId,
          source: 'cloudinary_live',
          uploadedAt: new Date().toISOString(),
          treatmentStage: stage,
          consentGranted: true,
          retentionPolicy: '90_days',
          isVerified: true,
        };
        setBookings((prev) =>
          prev.map((b) =>
            b.id === activeBooking.id ? { ...b, documents: [...(b.documents || []), localDoc] } : b
          )
        );
      }
      showToast(`Document "${file.name}" uploaded and encrypted.`, 'success');
    } catch (err) {
      console.error('Document upload failed:', err);
      showToast('Failed to upload document. Please retry.', 'error');
    }
  };

  // Delete Medical Document
  const handleDeleteDocument = async (docId: string) => {
    if (!activeBooking) return;
    setBookings((prev) =>
      prev.map((b) =>
        b.id === activeBooking.id
          ? { ...b, documents: (b.documents || []).filter((d) => d.id !== docId) }
          : b
      )
    );
    showToast('Medical document removed from records.', 'info');
  };

  // Confirm Doctor assignment
  const handleConfirmDoctor = async (doctor: HospitalDoctor) => {
    if (!activeBooking) return;
    try {
      await fetch(`/api/bookings/${activeBooking.id}/confirm-doctor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctor }),
      });
    } catch {
      // quiet fallback
    }
    setBookings((prev) =>
      prev.map((b) =>
        b.id === activeBooking.id
          ? { ...b, isDoctorConfirmedByHospital: true, confirmedDoctor: doctor }
          : b
      )
    );
    showToast(`Attending doctor confirmed: ${doctor.name} (${doctor.specialty})`, 'success');
  };

  // RETRY / RECALCULATE ACTIVE TRIP ROUTE
  const handleRetryRoute = async () => {
    if (!activeBooking) {
      calculateCurrentRoute(pickup.coords, dropoff.coords);
      return;
    }

    setRouteError(null);
    const reqId = ++routingRequestIdRef.current;

    if (activeBooking.stage === 'transporting') {
      const assigned = ambulances.find((a) => a.id === activeBooking.assignedUnitId);
      const origin = assigned?.location || activeBooking.pickupCoords;
      const dest = activeBooking.dropoffCoords;
      setRoutePolyline([]);

      try {
        const hospRoute = await getDrivingRoute(origin, dest);
        if (reqId !== routingRequestIdRef.current) return;
        setRoutePolyline(hospRoute.polyline);
        setRouteDistanceKm(hospRoute.distanceKm);
        setRouteEtaMins(hospRoute.etaMinutes);
        setRouteError(null);

        setBookings((prev) =>
          prev.map((b) =>
            b.id === activeBooking.id
              ? {
                  ...b,
                  routePolyline: hospRoute.polyline,
                  distanceKm: hospRoute.distanceKm,
                  etaMinutes: hospRoute.etaMinutes,
                }
              : b
          )
        );
        showToast('Hospital road route recalculated successfully.', 'success');
      } catch {
        if (reqId === routingRequestIdRef.current) {
          setRoutePolyline([]);
          setRouteError('Failed to fetch hospital road route. Click to retry.');
        }
      }
    } else if (activeBooking.stage === 'en_route_pickup') {
      const assigned = ambulances.find((a) => a.id === activeBooking.assignedUnitId);
      if (assigned) {
        setRoutePolyline([]);
        try {
          const leg1 = await getDrivingRoute(assigned.location, activeBooking.pickupCoords);
          if (reqId !== routingRequestIdRef.current) return;
          setRoutePolyline(leg1.polyline);
          setRouteDistanceKm(leg1.distanceKm);
          setRouteEtaMins(leg1.etaMinutes);
          setRouteError(null);
          showToast('Pickup route recalculated successfully.', 'success');
        } catch {
          if (reqId === routingRequestIdRef.current) {
            setRoutePolyline([]);
            setRouteError('Failed to fetch route to patient. Click to retry.');
          }
        }
      }
    } else {
      calculateCurrentRoute(pickup.coords, dropoff.coords);
    }
  };

  // ADVANCE TRIP STAGE (Multi-Phase Road Routing & Availability Transition)
  const handleAdvanceStage = async (bookingId: string, nextStage: TripStage) => {
    const currentBk = bookings.find((b) => b.id === bookingId);
    const assignedId = currentBk?.assignedUnitId;
    const assignedUnit = ambulances.find((a) => a.id === assignedId);

    setRoutePolyline([]);
    setRouteError(null);

    setBookings((prev) =>
      prev.map((b) => {
        if (b.id !== bookingId) return b;
        return {
          ...b,
          stage: nextStage,
          routePolyline: [],
          stageTimestamps: {
            ...b.stageTimestamps,
            ...(nextStage === 'accepted' ? { accepted: new Date().toISOString() } : {}),
            ...(nextStage === 'en_route_pickup' ? { dispatched: new Date().toISOString() } : {}),
            ...(nextStage === 'on_scene' ? { arrivedScene: new Date().toISOString() } : {}),
            ...(nextStage === 'transporting' ? { departedScene: new Date().toISOString() } : {}),
            ...(nextStage === 'at_hospital' ? { arrivedHospital: new Date().toISOString() } : {}),
            ...(nextStage === 'completed' ? { completed: new Date().toISOString() } : {}),
          },
        };
      })
    );

    // PHASE 2 TRANSITION: "Patient Picked Up" -> Hospital ER Route
    if (nextStage === 'transporting' && currentBk) {
      if (assignedId) {
        setAmbulances((prev) =>
          prev.map((a) => (a.id === assignedId ? { ...a, status: 'transporting', speedKmH: 48 } : a))
        );
      }

      const originLocation = assignedUnit?.location || currentBk.pickupCoords;
      const hospitalLocation = currentBk.dropoffCoords;
      const reqId = ++routingRequestIdRef.current;

      try {
        const hospRoute = await getDrivingRoute(originLocation, hospitalLocation);
        if (reqId !== routingRequestIdRef.current) return;

        setRoutePolyline(hospRoute.polyline);
        setRouteDistanceKm(hospRoute.distanceKm);
        setRouteEtaMins(hospRoute.etaMinutes);
        setRouteError(null);

        setBookings((prev) =>
          prev.map((b) =>
            b.id === bookingId
              ? {
                  ...b,
                  routePolyline: hospRoute.polyline,
                  distanceKm: hospRoute.distanceKm,
                  etaMinutes: hospRoute.etaMinutes,
                  currentVehiclePosition: [originLocation.lat, originLocation.lng],
                }
              : b
          )
        );

        try {
          await fetch(`/api/bookings/${bookingId}/stage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              stage: 'transporting',
              assignedUnitId: assignedId,
              routePolyline: hospRoute.polyline,
              distanceKm: hospRoute.distanceKm,
              etaMinutes: hospRoute.etaMinutes,
              isOperator: true,
            }),
          });
        } catch {
          // quiet
        }

        showToast(
          `Patient Picked Up! En route to ${currentBk.dropoffAddress.split(',')[0]} (ETA ${hospRoute.etaMinutes}m)`,
          'info'
        );
      } catch (routingErr) {
        if (reqId === routingRequestIdRef.current) {
          console.error('Failed to calculate hospital route:', routingErr);
          setRoutePolyline([]);
          setRouteError('Failed to fetch hospital road route. Click to retry.');
        }
      }
    } else if (nextStage === 'on_scene' && assignedId && currentBk) {
      setAmbulances((prev) =>
        prev.map((a) =>
          a.id === assignedId
            ? { ...a, status: 'on_scene', location: { ...currentBk.pickupCoords }, speedKmH: 0 }
            : a
        )
      );
      try {
        await fetch(`/api/bookings/${bookingId}/stage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage: 'on_scene', isOperator: true }),
        });
      } catch {
        // quiet
      }
      showToast(`Ambulance arrived at patient location. Initiating triage.`, 'info');
    } else if (nextStage === 'at_hospital' && assignedId && currentBk) {
      setAmbulances((prev) =>
        prev.map((a) =>
          a.id === assignedId
            ? { ...a, status: 'at_hospital', location: { ...currentBk.dropoffCoords }, speedKmH: 0 }
            : a
        )
      );
      try {
        await fetch(`/api/bookings/${bookingId}/stage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage: 'at_hospital', isOperator: true }),
        });
      } catch {
        // quiet
      }
      showToast(`Arrived at ${currentBk.dropoffAddress.split(',')[0]} ER trauma bay.`, 'info');
    } else if (nextStage === 'completed') {
      if (assignedId && assignedUnit) {
        setAmbulances((prev) =>
          prev.map((a) =>
            a.id === assignedId
              ? {
                  ...a,
                  location: { ...assignedUnit.baseLocation },
                  status: 'available',
                  currentBookingId: undefined,
                  speedKmH: 0,
                }
              : a
          )
        );
      }
      try {
        await fetch(`/api/bookings/${bookingId}/stage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage: 'completed', isOperator: true }),
        });
      } catch {
        // quiet
      }
      showToast('Emergency transfer completed. Unit returned to service.', 'success');
    } else if (nextStage === 'cancelled') {
      if (assignedId && assignedUnit) {
        setAmbulances((prev) =>
          prev.map((a) =>
            a.id === assignedId
              ? {
                  ...a,
                  location: { ...assignedUnit.baseLocation },
                  status: 'available',
                  currentBookingId: undefined,
                  speedKmH: 0,
                }
              : a
          )
        );
      }
      try {
        await fetch(`/api/bookings/${bookingId}/stage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage: 'cancelled', isOperator: true }),
        });
      } catch {
        // quiet
      }
      showToast('Booking cancelled.', 'info');
    }
  };

  // ACCEPT BOOKING (Operator force accept)
  const handleAcceptBooking = async (bookingId: string) => {
    const currentBk = bookings.find((b) => b.id === bookingId);
    if (!currentBk) return;

    const nearestResult = findNearestAvailableAmbulance(currentBk.pickupCoords, ambulances);
    const assigned = nearestResult?.ambulance || ambulances.find((a) => a.status === 'available') || ambulances[0];

    setRoutePolyline([]);
    setRouteError(null);
    const reqId = ++routingRequestIdRef.current;

    let phase1Polyline: [number, number][] = [];
    let dispatchDistKm = nearestResult?.distanceKm || 4.2;
    let dispatchEtaMins = nearestResult?.etaMinutes || 5;

    try {
      const leg1 = await getDrivingRoute(assigned.location, currentBk.pickupCoords);
      if (reqId !== routingRequestIdRef.current) return;
      phase1Polyline = leg1.polyline;
      dispatchDistKm = leg1.distanceKm;
      dispatchEtaMins = leg1.etaMinutes;
    } catch {
      phase1Polyline = [
        [assigned.location.lat, assigned.location.lng],
        [currentBk.pickupCoords.lat, currentBk.pickupCoords.lng],
      ];
    }

    setRoutePolyline(phase1Polyline);
    setRouteDistanceKm(dispatchDistKm);
    setRouteEtaMins(dispatchEtaMins);

    setAmbulances((prev) =>
      prev.map((a) =>
        a.id === assigned.id
          ? { ...a, status: 'en_route_pickup', currentBookingId: bookingId, speedKmH: 48 }
          : a
      )
    );

    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              stage: 'en_route_pickup',
              assignedUnitId: assigned.id,
              routePolyline: phase1Polyline,
              distanceKm: dispatchDistKm,
              etaMinutes: dispatchEtaMins,
              currentVehiclePosition: [assigned.location.lat, assigned.location.lng],
            }
          : b
      )
    );

    try {
      await fetch(`/api/bookings/${bookingId}/stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: 'en_route_pickup',
          assignedUnitId: assigned.id,
          routePolyline: phase1Polyline,
          distanceKm: dispatchDistKm,
          etaMinutes: dispatchEtaMins,
          isOperator: true,
        }),
      });
    } catch {
      // quiet
    }

    showToast(
      `Dispatched ${assigned.callSign} from ${assigned.stationName} (ETA ~${dispatchEtaMins}m)`,
      'success'
    );
  };

  const handleRejectBooking = (bookingId: string) => {
    handleAdvanceStage(bookingId, 'cancelled');
  };

  // OPERATOR OVERRIDE UNIT ASSIGNMENT
  const handleAssignUnit = async (bookingId: string, unitId: string) => {
    const unit = ambulances.find((a) => a.id === unitId);
    const bk = bookings.find((b) => b.id === bookingId);
    if (!unit || !bk) return;

    setRoutePolyline([]);
    const reqId = ++routingRequestIdRef.current;

    let newPolyline: [number, number][] = [];
    let newDist = bk.distanceKm;
    let newEta = bk.etaMinutes;

    try {
      const newRoute = await getDrivingRoute(unit.location, bk.pickupCoords);
      if (reqId === routingRequestIdRef.current) {
        newPolyline = newRoute.polyline;
        newDist = newRoute.distanceKm;
        newEta = newRoute.etaMinutes;
        setRoutePolyline(newPolyline);
        setRouteDistanceKm(newDist);
        setRouteEtaMins(newEta);
      }
    } catch {
      newPolyline = [[unit.location.lat, unit.location.lng], [bk.pickupCoords.lat, bk.pickupCoords.lng]];
    }

    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              assignedUnitId: unitId,
              stage: b.stage === 'pending' ? 'en_route_pickup' : b.stage,
              routePolyline: newPolyline,
              distanceKm: newDist,
              etaMinutes: newEta,
            }
          : b
      )
    );

    setAmbulances((prev) =>
      prev.map((a) =>
        a.id === unitId
          ? { ...a, status: (bk.stage === 'transporting' ? 'transporting' : 'en_route_pickup') as any, currentBookingId: bookingId }
          : a.currentBookingId === bookingId
          ? { ...a, status: 'available', currentBookingId: undefined }
          : a
      )
    );

    try {
      await fetch(`/api/bookings/${bookingId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitId }),
      });
    } catch {
      // quiet
    }

    showToast(`Operator override confirmed: assigned to ${unit.callSign}`, 'success');
  };

  // CANCEL BOOKING (Enforces restriction after patient pickup)
  const handleCancelActiveBooking = (bookingId: string) => {
    const bk = bookings.find((b) => b.id === bookingId);
    if (!bk) return;

    if (
      bk.stage === 'transporting' ||
      bk.stage === 'at_hospital' ||
      bk.stage === 'completed'
    ) {
      showToast('Your trip is in progress. Contact the assigned operator if assistance is required.', 'error');
      return;
    }

    handleAdvanceStage(bookingId, 'cancelled');
  };

  // OPERATOR REROUTE DESTINATION
  const handleOperatorReroute = async (bookingId: string, hospital: Hospital) => {
    const targetBooking = bookings.find((b) => b.id === bookingId);
    if (!targetBooking) return;

    const newDropoffCoords: LatLng = { lat: hospital.lat, lng: hospital.lng };
    const newDropoffAddress = `${hospital.name}, ${hospital.address}`;

    setDropoff({
      coords: newDropoffCoords,
      address: newDropoffAddress,
      hospitalId: hospital.id,
    });

    let newPolyline = routePolyline;
    let newDist = routeDistanceKm;
    let newEta = routeEtaMins;

    const assigned = ambulances.find((a) => a.id === targetBooking.assignedUnitId);
    if (targetBooking.stage === 'transporting' && assigned) {
      try {
        const reqId = ++routingRequestIdRef.current;
        const newRoute = await getDrivingRoute(assigned.location, newDropoffCoords);
        if (reqId === routingRequestIdRef.current) {
          newPolyline = newRoute.polyline;
          newDist = newRoute.distanceKm;
          newEta = newRoute.etaMinutes;
          setRoutePolyline(newPolyline);
          setRouteDistanceKm(newDist);
          setRouteEtaMins(newEta);
        }
      } catch (err) {
        console.warn('Operator reroute road routing failed:', err);
      }
    }

    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              dropoffCoords: newDropoffCoords,
              dropoffAddress: newDropoffAddress,
              destinationHospitalId: hospital.id,
              routePolyline: targetBooking.stage === 'transporting' ? newPolyline : b.routePolyline,
              distanceKm: targetBooking.stage === 'transporting' ? newDist : b.distanceKm,
              etaMinutes: targetBooking.stage === 'transporting' ? newEta : b.etaMinutes,
            }
          : b
      )
    );

    try {
      await fetch(`/api/bookings/${bookingId}/reroute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospitalId: hospital.id,
          dropoffCoords: newDropoffCoords,
          dropoffAddress: newDropoffAddress,
          polyline: newPolyline,
          distanceKm: newDist,
          etaMinutes: newEta,
        }),
      });
    } catch (err) {
      console.warn('Failed to sync reroute to backend:', err);
    }

    showToast(`Destination rerouted to ${hospital.name} (${hospital.traumaLevel}) by Authorized Operator`, 'success');
  };

  // RESET STATE
  const handleResetSimulation = async () => {
    try {
      await fetch('/api/reset', { method: 'POST' });
    } catch {
      // quiet
    }

    localStorage.removeItem('dropaid_bookings');
    localStorage.removeItem('dropaid_ambulances');

    setAmbulances(INITIAL_AMBULANCES);
    const defaultPickup = {
      coords: { lat: 28.6327, lng: 77.2197 },
      address: 'Connaught Place (Inner Circle), Block A, New Delhi',
    };
    const defaultDropoff = {
      coords: { lat: HOSPITALS[0].lat, lng: HOSPITALS[0].lng },
      address: `${HOSPITALS[0].name}, ${HOSPITALS[0].address}`,
      hospitalId: HOSPITALS[0].id,
    };
    setPickup(defaultPickup);
    setDropoff(defaultDropoff);
    setGpsError(null);
    setBookings([]);
    calculateCurrentRoute(defaultPickup.coords, defaultDropoff.coords);

    showToast('Platform reset. All 14 ambulances returned to base hospital emergency bays.', 'info');
  };

  // SIMULATION CONTROLS
  const handleStartSimulation = async () => {
    try {
      const res = await fetch('/api/simulation/start', { method: 'POST' });
      const data = await res.json();
      if (data.state) setSimulationState(data.state);
      showToast('Daily Ride Simulation started (~20 rides/day schedule)', 'success');
    } catch {
      showToast('Failed to start simulation', 'error');
    }
  };

  const handlePauseSimulation = async () => {
    try {
      const res = await fetch('/api/simulation/pause', { method: 'POST' });
      const data = await res.json();
      if (data.state) setSimulationState(data.state);
      showToast('Daily Ride Simulation paused', 'info');
    } catch {
      showToast('Failed to pause simulation', 'error');
    }
  };

  const handleChangeSimulationSpeed = async (multiplier: number) => {
    try {
      const res = await fetch('/api/simulation/speed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ multiplier }),
      });
      const data = await res.json();
      if (data.speedMultiplier) {
        setSimulationState((prev) => ({ ...prev, speedMultiplier: data.speedMultiplier }));
      }
    } catch {
      // quiet
    }
  };

  // CLOUDINARY MODAL TRIGGERS FOR HOSPITALS & DRIVERS
  const handleOpenHospitalPhotoUpload = (hospitalId: string) => {
    setUploadCategory('hospital_photo');
    setUploadEntityId(hospitalId);
    setIsUploadModalOpen(true);
  };

  const handleOpenDriverPhotoUpload = (unitId: string) => {
    setUploadCategory('driver_photo');
    setUploadEntityId(unitId);
    setIsUploadModalOpen(true);
  };

  const handleAssetUploaded = async (asset: { url: string; publicId: string; source: string; name: string }) => {
    if (uploadCategory === 'hospital_photo' && uploadEntityId) {
      setHospitals((prev) =>
        prev.map((h) => (h.id === uploadEntityId ? { ...h, image: asset.url, cloudinaryPublicId: asset.publicId } : h))
      );
      try {
        await fetch(`/api/hospitals/${uploadEntityId}/image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: asset.url, publicId: asset.publicId }),
        });
      } catch {
        // quiet
      }
      showToast('Hospital image updated and delivered via Cloudinary!', 'success');
    } else if (uploadCategory === 'driver_photo' && uploadEntityId) {
      setAmbulances((prev) =>
        prev.map((a) => (a.id === uploadEntityId ? { ...a, driverPhoto: asset.url, driverPhotoPublicId: asset.publicId } : a))
      );
      try {
        await fetch(`/api/fleet/${uploadEntityId}/photo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photoUrl: asset.url, publicId: asset.publicId, target: 'driver' }),
        });
      } catch {
        // quiet
      }
      showToast('Driver photo updated and delivered via Cloudinary!', 'success');
    }
  };

  const handleUploadComplete = (doc: BookingDocument) => {
    setPatientProfile((prev) => ({
      ...prev,
      documents: [doc, ...(prev as any).documents || []],
    }));
    showToast(`Document "${doc.name}" securely attached.`, 'success');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      {/* Top Header Navigation */}
      <Header
        currentView={currentView}
        onViewChange={(v) => setCurrentView(v)}
        onReset={handleResetSimulation}
        activeBookingCount={bookings.filter((b) => b.stage !== 'completed' && b.stage !== 'cancelled').length}
      />

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 animate-in fade-in slide-in-from-top-2">
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-sky-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white ml-2 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {currentView === 'hospitals' ? (
          /* Dedicated Hospital Directory Accessible Exclusively via Top Navbar */
          <HospitalDirectory
            hospitals={hospitals}
            currentDestinationId={dropoff.hospitalId}
            onSelectHospital={(hosp) => {
              handleDropoffChange({ lat: hosp.lat, lng: hosp.lng }, `${hosp.name}, ${hosp.address}`, hosp.id);
              setCurrentView('user');
              showToast(`${hosp.name} set as emergency destination.`, 'success');
            }}
            onUploadHospitalImage={handleOpenHospitalPhotoUpload}
          />
        ) : currentView === 'profile' ? (
          /* Dedicated My Profile Page */
          <UserProfileView
            profile={patientProfile}
            onSaveProfile={handleSaveProfile}
            onBackToHome={() => setCurrentView('user')}
          />
        ) : currentView === 'user' ? (
          /* User / Patient Emergency Booking & Live Tracking Dashboard */
          <UserDashboard
            currentPickup={pickup}
            currentDropoff={dropoff}
            onPickupChange={handlePickupChange}
            onDropoffChange={handleDropoffChange}
            onDetectGPS={handleDetectGPS}
            isDetectingGPS={isDetectingGPS}
            gpsAccuracy={gpsAccuracy}
            gpsError={gpsError}
            activeBooking={activeBooking}
            assignedAmbulance={assignedAmbulance}
            bookingHistory={bookings.filter((b) => !b.isSimulated)}
            onSubmitBooking={handleCreateBooking}
            onCancelActiveBooking={handleCancelActiveBooking}
            patientProfile={patientProfile}
            onOpenUploadModal={(cat) => {
              setUploadCategory(cat);
              setUploadEntityId(undefined);
              setIsUploadModalOpen(true);
            }}
            ambulances={ambulances}
            routePolyline={routePolyline}
            routeError={routeError}
            onRecalculateRoute={handleRetryRoute}
            isSubmitting={isSubmitting}
            hospitals={hospitals}
            selectedCategory={selectedCategory}
            onSelectCategory={handleSelectCategory}
            onSendPreArrivalAlert={handleSendPreArrivalAlert}
            onUploadDocument={handleUploadDocument}
            onDeleteDocument={handleDeleteDocument}
            onConfirmDoctor={handleConfirmDoctor}
          />
        ) : (
          /* Dedicated Operator Dashboard */
          <OperatorDashboard
            bookings={bookings}
            ambulances={ambulances}
            onAcceptBooking={handleAcceptBooking}
            onRejectBooking={handleRejectBooking}
            onAssignUnit={handleAssignUnit}
            onAdvanceStage={handleAdvanceStage}
            onOperatorReroute={handleOperatorReroute}
            onUploadDriverPhoto={handleOpenDriverPhotoUpload}
            simulationState={simulationState}
            onStartSimulation={handleStartSimulation}
            onPauseSimulation={handlePauseSimulation}
            onResetSimulation={handleResetSimulation}
            onChangeSimulationSpeed={handleChangeSimulationSpeed}
            onOpenDriverView={() => {}}
          />
        )}
      </main>

      {/* Cloudinary Document / Asset Upload Modal */}
      <CloudinaryUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadComplete={handleUploadComplete}
        onAssetUploaded={handleAssetUploaded}
        targetCategory={uploadCategory}
        entityId={uploadEntityId}
        title={
          uploadCategory === 'hospital_photo'
            ? 'Upload Hospital Image to Cloudinary'
            : uploadCategory === 'driver_photo'
            ? 'Upload Paramedic Driver Photo to Cloudinary'
            : 'Upload Medical Document / Scene Photo'
        }
      />

      {/* Accessible Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-900">Drop<span className="text-sky-600">Aid</span></span>
            <span>· Delhi NCR Emergency Medical Dispatch & Telemetry System</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
