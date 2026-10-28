import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { LatLng, Hospital, Landmark, AmbulanceUnit, TripStage } from '../../types/index.ts';
import { HOSPITALS, LANDMARKS } from '../../data/mockData.ts';
import { reverseGeocode, calculateHaversineDistance } from '../../services/routingService.ts';
import { Crosshair, Navigation, Building2, MapPin, AlertCircle } from 'lucide-react';

interface LeafletMapProps {
  pickupCoords: LatLng;
  dropoffCoords: LatLng;
  ambulances: AmbulanceUnit[];
  activeAmbulanceId?: string;
  routePolyline?: [number, number][];
  onPickupChange: (coords: LatLng, address: string) => void;
  onDropoffChange: (coords: LatLng, address: string, hospitalId?: string) => void;
  gpsAccuracyMeters?: number;
  routeError?: string | null;
  onRecalculateRoute?: () => void;
  isSearching?: boolean;
  tripStage?: TripStage;
  isLocked?: boolean;
}

export const LeafletMap: React.FC<LeafletMapProps> = ({
  pickupCoords,
  dropoffCoords,
  ambulances,
  activeAmbulanceId,
  routePolyline = [],
  onPickupChange,
  onDropoffChange,
  gpsAccuracyMeters = 12,
  routeError = null,
  onRecalculateRoute,
  isSearching = false,
  tripStage,
  isLocked = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Markers & Layers refs
  const pickupMarkerRef = useRef<L.Marker | null>(null);
  const dropoffMarkerRef = useRef<L.Marker | null>(null);
  const ambulanceMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);

  const [isMapReady, setIsMapReady] = useState(false);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [pickupCoords.lat, pickupCoords.lng],
      zoom: 14,
      zoomControl: false,
    });

    // Clean OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapInstanceRef.current = map;
    setIsMapReady(true);

    // Invalidate size shortly after mount to ensure seamless tile rendering
    const timer1 = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    const timer2 = setTimeout(() => {
      map.invalidateSize();
      map.setView([pickupCoords.lat, pickupCoords.lng], 14);
    }, 400);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Center map on user's pickupCoords when updated
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapReady) return;

    // If route polyline has points, we fit bounds separately; otherwise center on pickup
    if (routePolyline.length < 2) {
      map.panTo([pickupCoords.lat, pickupCoords.lng], { animate: true, duration: 0.6 });
    }
  }, [pickupCoords.lat, pickupCoords.lng, isMapReady, routePolyline.length]);

  // Update 5 Hospital Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapReady) return;

    const hospitalLayer = L.layerGroup().addTo(map);

    HOSPITALS.forEach((hosp) => {
      const statusColor = hosp.status === 'open' ? '#0284c7' : hosp.status === 'busy' ? '#d97706' : '#dc2626';

      const icon = L.divIcon({
        className: 'custom-hospital-marker',
        html: `
          <div style="cursor: pointer; transform: translate(-50%, -100%);">
            <div style="background: white; border: 2px solid ${statusColor}; border-radius: 8px; padding: 3px 6px; box-shadow: 0 4px 10px rgba(0,0,0,0.15); display: flex; align-items: center; gap: 4px; white-space: nowrap;">
              <span style="display: inline-block; width: 14px; height: 14px; background: #dc2626; color: white; border-radius: 3px; font-size: 11px; font-weight: 800; line-height: 14px; text-align: center;">+</span>
              <span style="font-size: 11px; font-weight: 700; color: #1e293b;">${hosp.name.split(' ')[0]}</span>
              <span style="font-size: 9px; font-weight: 600; background: #f1f5f9; padding: 1px 4px; border-radius: 4px; color: ${statusColor};">${hosp.availableBeds} beds</span>
            </div>
            <div style="width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 6px solid ${statusColor}; margin: 0 auto;"></div>
          </div>
        `,
        iconSize: [0, 0],
      });

      const marker = L.marker([hosp.lat, hosp.lng], { icon }).addTo(hospitalLayer);
      marker.bindPopup(`
        <div style="max-width: 260px; font-family: inherit;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-bottom: 2px;">
            <span style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 10px; text-transform: uppercase;">${hosp.region}</span>
            <span style="font-size: 10px; color: #059669; font-weight: 600;">✓ Verified</span>
          </div>
          <h4 style="font-weight: 700; font-size: 13px; color: #0f172a; margin: 2px 0 3px 0; line-height: 1.2;">${hosp.name}</h4>
          <p style="font-size: 11px; color: #64748b; margin: 0 0 4px 0;">${hosp.address}</p>
          <div style="font-size: 11px; color: #334155; margin-bottom: 6px;">
            <strong>Emergency Helpline:</strong> <a href="tel:${hosp.emergencyContact}" style="color: #0284c7; text-decoration: underline;">${hosp.emergencyContact}</a>
          </div>
          <div style="display: flex; gap: 4px; margin-bottom: 8px; font-size: 10px;">
            <span style="background: #f1f5f9; color: #475569; padding: 2px 5px; border-radius: 4px; font-weight: 600;">${hosp.traumaLevel}</span>
            <span style="background: #ecfdf5; color: #047857; padding: 2px 5px; border-radius: 4px; font-weight: 600;">${hosp.availableBeds} Beds</span>
          </div>
          ${
            isLocked
              ? `<div style="font-size: 11px; color: #0369a1; font-weight: 600; background: #f0f9ff; padding: 6px 8px; border-radius: 6px; border: 1px solid #bae6fd; text-align: center;">🔒 Destination locked during active trip. Authorized operators can reroute from Operator Panel.</div>`
              : `<button id="select-hosp-${hosp.id}" style="width: 100%; background: #0284c7; color: white; border: none; border-radius: 6px; padding: 6px 10px; font-size: 11px; font-weight: 700; cursor: pointer;">
                  Set as Destination
                </button>`
          }
        </div>
      `);

      if (!isLocked) {
        marker.on('popupopen', () => {
          const btn = document.getElementById(`select-hosp-${hosp.id}`);
          if (btn) {
            btn.onclick = () => {
              onDropoffChange({ lat: hosp.lat, lng: hosp.lng }, hosp.name, hosp.id);
              marker.closePopup();
            };
          }
        });
      }
    });

    return () => {
      hospitalLayer.remove();
    };
  }, [isMapReady, onDropoffChange, isLocked]);

  // Update 30 Landmarks
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapReady) return;

    const landmarkLayer = L.layerGroup().addTo(map);

    LANDMARKS.forEach((lm) => {
      const icon = L.divIcon({
        className: 'custom-landmark-marker',
        html: `
          <div style="width: 8px; height: 8px; background: #64748b; border: 2px solid white; border-radius: 50%; box-shadow: 0 1px 4px rgba(0,0,0,0.3); transform: translate(-50%, -50%); cursor: pointer;" title="${lm.name}"></div>
        `,
        iconSize: [0, 0],
      });

      const marker = L.marker([lm.lat, lm.lng], { icon }).addTo(landmarkLayer);
      marker.bindPopup(`
        <div style="font-family: inherit; font-size: 12px;">
          <strong style="color: #0f172a;">${lm.name}</strong>
          <div style="color: #64748b; font-size: 11px; margin-bottom: 6px;">${lm.address} (${lm.category})</div>
          ${
            isLocked
              ? `<div style="font-size: 11px; color: #64748b; font-style: italic; background: #f8fafc; padding: 4px 6px; border-radius: 4px; border: 1px solid #e2e8f0; text-align: center;">🔒 Locations locked during active dispatch.</div>`
              : `<div style="display: flex; gap: 4px;">
                  <button id="set-pickup-${lm.id}" style="background: #10b981; color: white; border: none; border-radius: 4px; padding: 4px 8px; font-size: 10px; font-weight: 600; cursor: pointer;">Set as Pickup</button>
                  <button id="set-dropoff-${lm.id}" style="background: #0284c7; color: white; border: none; border-radius: 4px; padding: 4px 8px; font-size: 10px; font-weight: 600; cursor: pointer;">Set as Drop-off</button>
                </div>`
          }
        </div>
      `);

      if (!isLocked) {
        marker.on('popupopen', () => {
          const pickBtn = document.getElementById(`set-pickup-${lm.id}`);
          const dropBtn = document.getElementById(`set-dropoff-${lm.id}`);
          if (pickBtn) {
            pickBtn.onclick = () => {
              onPickupChange({ lat: lm.lat, lng: lm.lng }, `${lm.name}, ${lm.address}`);
              marker.closePopup();
            };
          }
          if (dropBtn) {
            dropBtn.onclick = () => {
              onDropoffChange({ lat: lm.lat, lng: lm.lng }, `${lm.name}, ${lm.address}`);
              marker.closePopup();
            };
          }
        });
      }
    });

    return () => {
      landmarkLayer.remove();
    };
  }, [isMapReady, onPickupChange, onDropoffChange, isLocked]);

  // Draggable Pickup Marker with dynamic searching radar and patient picked-up states
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapReady) return;

    const isPatientPickedUp = tripStage === 'transporting' || tripStage === 'at_hospital' || tripStage === 'completed';
    const isDraggable = !isLocked && !isPatientPickedUp;

    const pickupBadgeText = isPatientPickedUp
      ? '✓ PATIENT PICKED UP'
      : isLocked
      ? '🔒 CONFIRMED PICKUP'
      : isSearching
      ? '🛰️ SCANNING PICKUP'
      : '📍 PICKUP POINT';

    const pickupSubText = isPatientPickedUp
      ? '(SCENE CLEAR)'
      : isLocked
      ? '(LOCKED)'
      : isSearching
      ? '(LIVE)'
      : '(DRAG ME)';

    const pickupIcon = L.divIcon({
      className: 'pickup-marker',
      html: `
        <div style="position: relative; transform: translate(-50%, -100%); cursor: ${isDraggable ? 'grab' : 'default'}; text-align: center; opacity: ${isPatientPickedUp ? '0.85' : '1'};">
          ${
            isSearching
              ? `<div class="siren-ring" style="position: absolute; inset: -18px; border-radius: 50%; border: 3px solid #10b981; pointer-events: none;"></div>`
              : ''
          }
          <div style="background: ${isPatientPickedUp ? '#059669' : isLocked ? '#0f766e' : isSearching ? '#0284c7' : '#10b981'}; color: white; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 6px; box-shadow: 0 4px 10px rgba(0,0,0,0.25); display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;">
            <span>${pickupBadgeText}</span>
            <span style="font-size: 8px; opacity: 0.85;">${pickupSubText}</span>
          </div>
          <div style="width: 14px; height: 14px; background: ${isPatientPickedUp ? '#059669' : isLocked ? '#0f766e' : isSearching ? '#0284c7' : '#10b981'}; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.3); margin: 2px auto 0 auto;"></div>
        </div>
      `,
      iconSize: [0, 0],
    });

    if (!pickupMarkerRef.current) {
      const marker = L.marker([pickupCoords.lat, pickupCoords.lng], {
        draggable: isDraggable,
        icon: pickupIcon,
        zIndexOffset: isPatientPickedUp ? 500 : 1000,
      }).addTo(map);

      marker.on('dragend', async () => {
        if (isLocked) return;
        const pos = marker.getLatLng();
        const address = await reverseGeocode(pos.lat, pos.lng);
        onPickupChange({ lat: pos.lat, lng: pos.lng }, address);
      });

      pickupMarkerRef.current = marker;
    } else {
      pickupMarkerRef.current.setLatLng([pickupCoords.lat, pickupCoords.lng]);
      pickupMarkerRef.current.setIcon(pickupIcon);
      if (!isDraggable) {
        pickupMarkerRef.current.dragging?.disable();
      } else {
        pickupMarkerRef.current.dragging?.enable();
      }
    }

    // GPS Accuracy Circle
    if (!accuracyCircleRef.current) {
      accuracyCircleRef.current = L.circle([pickupCoords.lat, pickupCoords.lng], {
        radius: gpsAccuracyMeters,
        color: '#10b981',
        fillColor: '#10b981',
        fillOpacity: 0.12,
        weight: 1,
      }).addTo(map);
    } else {
      accuracyCircleRef.current.setLatLng([pickupCoords.lat, pickupCoords.lng]);
      accuracyCircleRef.current.setRadius(gpsAccuracyMeters);
    }
  }, [pickupCoords, isMapReady, gpsAccuracyMeters, onPickupChange, isSearching, tripStage, isLocked]);

  // Draggable Drop-off / Destination Marker with High-Priority Hospital Pulse when Transporting
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapReady) return;

    const isTransportingToHospital = tripStage === 'transporting';
    const isDraggable = !isLocked && !isTransportingToHospital;

    const dropoffBadgeText = isTransportingToHospital
      ? '🚨 DESTINATION ER BAY (ACTIVE RUN)'
      : isLocked
      ? '🔒 CONFIRMED ER BAY'
      : 'DESTINATION ER';

    const dropoffIcon = L.divIcon({
      className: 'dropoff-marker',
      html: `
        <div style="position: relative; transform: translate(-50%, -100%); cursor: ${isDraggable ? 'grab' : 'default'}; text-align: center;">
          ${
            isTransportingToHospital
              ? `<div class="siren-ring" style="position: absolute; inset: -16px; border-radius: 50%; border: 3px solid #0284c7; pointer-events: none;"></div>`
              : ''
          }
          <div style="background: ${isTransportingToHospital ? '#0369a1' : isLocked ? '#0284c7' : '#0284c7'}; color: white; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 6px; box-shadow: 0 4px 10px rgba(2, 132, 199, 0.4); display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;">
            <span>${dropoffBadgeText}</span>
          </div>
          <div style="width: 14px; height: 14px; background: ${isTransportingToHospital ? '#0369a1' : '#0284c7'}; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.3); margin: 2px auto 0 auto;"></div>
        </div>
      `,
      iconSize: [0, 0],
    });

    if (!dropoffMarkerRef.current) {
      const marker = L.marker([dropoffCoords.lat, dropoffCoords.lng], {
        draggable: isDraggable,
        icon: dropoffIcon,
        zIndexOffset: isTransportingToHospital ? 1500 : 990,
      }).addTo(map);

      marker.on('dragend', async () => {
        if (isLocked) return;
        const pos = marker.getLatLng();
        const address = await reverseGeocode(pos.lat, pos.lng);
        onDropoffChange({ lat: pos.lat, lng: pos.lng }, address);
      });

      dropoffMarkerRef.current = marker;
    } else {
      dropoffMarkerRef.current.setLatLng([dropoffCoords.lat, dropoffCoords.lng]);
      dropoffMarkerRef.current.setIcon(dropoffIcon);
      dropoffMarkerRef.current.setZIndexOffset(isTransportingToHospital ? 1500 : 990);
      if (!isDraggable) {
        dropoffMarkerRef.current.dragging?.disable();
      } else {
        dropoffMarkerRef.current.dragging?.enable();
      }
    }
  }, [dropoffCoords, isMapReady, onDropoffChange, tripStage, isLocked]);

  // Ambulances Markers (Live Road Position & Siren Aura)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapReady) return;

    const currentMarkers = ambulanceMarkersRef.current;

    ambulances.forEach((amb) => {
      const isActive = amb.id === activeAmbulanceId || amb.status === 'en_route_pickup' || amb.status === 'transporting' || amb.status === 'on_scene';
      const isAssigned = amb.status !== 'available';
      const isHospital = amb.isHospitalStationed;
      const distFromPickup = calculateHaversineDistance(amb.location, pickupCoords).toFixed(1);

      const markerBgColor = isActive
        ? '#e11d48'
        : isAssigned
        ? '#0284c7'
        : isHospital
        ? '#059669' // Emerald green for hospital bay ready
        : '#475569'; // Slate for highway patrol

      const ambulanceIcon = L.divIcon({
        className: `ambulance-marker-${amb.id}`,
        html: `
          <div style="position: relative; transform: translate(-50%, -50%); cursor: pointer;">
            ${
              isActive
                ? `<div class="siren-ring" style="position: absolute; inset: -14px; border-radius: 50%; border: 3px solid #e11d48; pointer-events: none;"></div>`
                : ''
            }
            <div style="width: 38px; height: 38px; background: ${markerBgColor}; border: 2.5px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3); transform: rotate(${
          amb.heading
        }deg); transition: transform 300ms ease;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
                <path d="M15 18H9"/>
                <path d="M19 18h2a1 1 0 0 0 1-1v-3.28a1 1 0 0 0-.684-.948l-1.923-.641a1 1 0 0 1-.578-.502l-1.539-3.076A1 1 0 0 0 16.382 8H14"/>
                <circle cx="17" cy="18" r="2"/>
                <circle cx="7" cy="18" r="2"/>
                <path d="M7 10h4"/>
                <path d="M9 8v4"/>
              </svg>
            </div>
            <div style="position: absolute; bottom: -20px; left: 50%; transform: translateX(-50%); background: #0f172a; color: white; font-size: 9px; font-weight: 700; padding: 1.5px 6px; border-radius: 4px; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.25); display: flex; align-items: center; gap: 3px;">
              <span>${isHospital ? '🏥' : '🚓'}</span>
              <span>${amb.callSign.split(' - ')[0]}</span>
            </div>
          </div>
        `,
        iconSize: [0, 0],
      });

      if (!currentMarkers.has(amb.id)) {
        const marker = L.marker([amb.location.lat, amb.location.lng], {
          icon: ambulanceIcon,
          zIndexOffset: isActive ? 2000 : 800,
        }).addTo(map);

        marker.bindPopup(`
          <div style="font-family: inherit; font-size: 12px; min-width: 220px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-size: 9px; font-weight: 800; text-transform: uppercase; padding: 1px 5px; border-radius: 3px; background: ${isHospital ? '#ecfdf5' : '#f1f5f9'}; color: ${isHospital ? '#047857' : '#334155'};">
                ${isHospital ? '🏥 Hospital Base' : '🚓 Roaming Patrol'}
              </span>
              <span style="font-size: 10px; font-weight: 700; color: #0284c7;">${amb.type}</span>
            </div>
            <strong style="color: #0f172a; font-size: 13px; display: block; margin-bottom: 2px;">${amb.callSign}</strong>
            <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">
              📍 Station: <span style="color: #334155; font-weight: 600;">${amb.stationName}</span>
            </div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px; margin-bottom: 6px; font-size: 11px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                <span style="color: #64748b;">Distance to Patient:</span>
                <strong style="color: #0369a1;">${distFromPickup} km</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                <span style="color: #64748b;">Driver:</span>
                <span style="color: #1e293b; font-weight: 600;">${amb.driverName}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #64748b;">Status:</span>
                <span style="font-weight: 700; text-transform: capitalize; color: ${amb.status === 'available' ? '#059669' : '#d97706'};">
                  ${amb.status.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
            <div style="font-size: 10px; color: #059669; font-weight: 600;">
              Driver Rating: ★ ${amb.driverRating} · Fuel: ${amb.fuelPct}%
            </div>
          </div>
        `);

        currentMarkers.set(amb.id, marker);
      } else {
        const marker = currentMarkers.get(amb.id)!;
        marker.setLatLng([amb.location.lat, amb.location.lng]);
        marker.setIcon(ambulanceIcon);
        marker.setZIndexOffset(isActive ? 2000 : 800);
      }
    });

    // Remove obsolete markers if any
    const activeIds = new Set(ambulances.map((a) => a.id));
    currentMarkers.forEach((marker, id) => {
      if (!activeIds.has(id)) {
        marker.remove();
        currentMarkers.delete(id);
      }
    });
  }, [ambulances, activeAmbulanceId, isMapReady]);

  // Update Route Polyline (Along Road Coordinates) - Guaranteed Instant Clean & Redraw
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapReady) return;

    // Immediately remove obsolete polyline layer before rendering any new route
    if (routePolylineRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }

    if (routePolyline.length > 1) {
      const isTransportingToHospital = tripStage === 'transporting';

      // Draw neon path with high-visibility emergency styling
      const polyline = L.polyline(routePolyline, {
        color: isTransportingToHospital ? '#0284c7' : '#0284c7', // Distinctive high-contrast sky/cyan
        weight: 6,
        opacity: 0.92,
        lineCap: 'round',
        lineJoin: 'round',
        dashArray: isTransportingToHospital ? '2, 8' : '1, 8',
      }).addTo(map);

      routePolylineRef.current = polyline;

      // Fit bounds to comfortably frame the new route from vehicle to hospital
      try {
        const bounds = L.latLngBounds(routePolyline);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      } catch {
        // Fallback
      }
    }
  }, [routePolyline, isMapReady, tripStage]);

  // Map Controls Helpers
  const handleRecenterPickup = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([pickupCoords.lat, pickupCoords.lng], 14, { duration: 0.8 });
    }
  };

  const handleFitRoute = () => {
    if (mapInstanceRef.current && routePolyline.length > 1) {
      const bounds = L.latLngBounds(routePolyline);
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  };

  return (
    <div className="relative w-full h-full min-h-[460px] rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-sm">
      {/* Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full min-h-[460px]" />

      {/* Floating Map HUD Controls (Top Left) */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
        <div className="bg-white/95 backdrop-blur-none border border-slate-200 rounded-lg shadow-sm px-3 py-2 flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <Crosshair className="w-3.5 h-3.5 text-emerald-600" />
            <span>GPS: ±{gpsAccuracyMeters}m</span>
          </div>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Building2 className="w-3.5 h-3.5 text-sky-600" />
            <span>10 Verified Hospitals</span>
          </div>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <MapPin className="w-3.5 h-3.5 text-slate-500" />
            <span>30 Landmarks</span>
          </div>
        </div>

        {/* Route Error or Recalculating Notice */}
        {routeError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg p-2 text-xs flex items-center justify-between gap-2 shadow-sm max-w-sm">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
              <span>{routeError}</span>
            </div>
            {onRecalculateRoute && (
              <button
                onClick={onRecalculateRoute}
                className="text-[11px] font-bold underline hover:text-rose-950 shrink-0 cursor-pointer"
              >
                Recalculate
              </button>
            )}
          </div>
        )}
      </div>

      {/* Map Action Buttons (Top Right) */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-1.5">
        <button
          onClick={handleRecenterPickup}
          title="Recenter on Patient Location"
          className="bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 p-2 rounded-lg shadow-sm cursor-pointer transition-colors"
        >
          <Crosshair className="w-4 h-4 text-emerald-600" />
        </button>

        {routePolyline.length > 1 && (
          <button
            onClick={handleFitRoute}
            title="Fit Entire Dispatch Route"
            className="bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 p-2 rounded-lg shadow-sm cursor-pointer transition-colors"
          >
            <Navigation className="w-4 h-4 text-sky-600" />
          </button>
        )}
      </div>

      {/* Draggable Legend Footnote */}
      <div className="absolute bottom-4 left-4 z-20 bg-white/95 border border-slate-200 px-3 py-1.5 rounded-md text-[11px] text-slate-600 shadow-sm flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
          <span>Drag green marker to change pickup</span>
        </span>
        <span className="text-slate-300">·</span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" />
          <span>Click hospital or landmark to route</span>
        </span>
      </div>
    </div>
  );
};
