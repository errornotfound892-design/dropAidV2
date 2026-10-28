import { LatLng, Landmark, AmbulanceUnit } from '../types/index.ts';
import { LANDMARKS, HOSPITALS } from '../data/mockData.ts';

// Haversine distance in kilometers
export function calculateHaversineDistance(c1: LatLng, c2: LatLng): number {
  const R = 6371; // Earth radius in km
  const dLat = ((c2.lat - c1.lat) * Math.PI) / 180;
  const dLng = ((c2.lng - c1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((c1.lat * Math.PI) / 180) *
      Math.cos((c2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Find nearest available ambulance to pickup location
export function findNearestAvailableAmbulance(
  pickupCoords: LatLng,
  ambulances: AmbulanceUnit[]
): { ambulance: AmbulanceUnit; distanceKm: number; etaMinutes: number } | null {
  const available = ambulances.filter((a) => a.status === 'available');
  if (available.length === 0) return null;

  let nearest = available[0];
  let minDistance = calculateHaversineDistance(pickupCoords, nearest.location);

  for (let i = 1; i < available.length; i++) {
    const amb = available[i];
    const dist = calculateHaversineDistance(pickupCoords, amb.location);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = amb;
    }
  }

  const distanceKm = Number((minDistance * 1.3).toFixed(1));
  const etaMinutes = Math.max(2, Math.round((distanceKm / 42) * 60) + 1);

  return { ambulance: nearest, distanceKm, etaMinutes };
}

// Calculate compass heading/bearing in degrees between two coordinates (0° = North, 90° = East)
export function calculateBearing(start: LatLng, dest: LatLng): number {
  const startLat = (start.lat * Math.PI) / 180;
  const startLng = (start.lng * Math.PI) / 180;
  const destLat = (dest.lat * Math.PI) / 180;
  const destLng = (dest.lng * Math.PI) / 180;

  const y = Math.sin(destLng - startLng) * Math.cos(destLat);
  const x =
    Math.cos(startLat) * Math.sin(destLat) -
    Math.sin(startLat) * Math.cos(destLat) * Math.cos(destLng - startLng);
  let brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

// Generate realistic road grid waypoints if OSRM is offline or blocked (NEVER a straight line)
export function generateRealisticRoadRoute(start: LatLng, end: LatLng): [number, number][] {
  const waypoints: [number, number][] = [];
  waypoints.push([start.lat, start.lng]);

  const latDiff = end.lat - start.lat;
  const lngDiff = end.lng - start.lng;

  // Urban grid navigation: 5-8 intermediate intersection bends
  const steps = 7;
  for (let i = 1; i < steps; i++) {
    const progress = i / steps;
    // Step along major street axes with slight zigzag to mimic city blocks
    const jitterFactor = Math.sin(progress * Math.PI * 2) * 0.0018;
    const interLat = start.lat + latDiff * progress + (i % 2 === 0 ? jitterFactor : -jitterFactor * 0.5);
    const interLng = start.lng + lngDiff * progress + (i % 2 === 1 ? jitterFactor : jitterFactor * 0.3);
    waypoints.push([interLat, interLng]);
  }

  waypoints.push([end.lat, end.lng]);
  return waypoints;
}

// Fetch driving route via OSRM with automatic fallback to realistic road grid
export async function getDrivingRoute(
  start: LatLng,
  end: LatLng
): Promise<{ polyline: [number, number][]; distanceKm: number; etaMinutes: number; provider: 'osrm' | 'grid_fallback' }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OSRM responded with status ${response.status}`);
    }

    const data = await response.json();
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      // OSRM returns coordinates as [lng, lat], convert to [lat, lng] for Leaflet
      const polyline: [number, number][] = route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
      const distanceKm = Number((route.distance / 1000).toFixed(1));
      // Average emergency siren speed ~ 42 km/h
      const etaMinutes = Math.max(1, Math.round((route.duration / 60) * 0.75));

      return {
        polyline,
        distanceKm,
        etaMinutes,
        provider: 'osrm',
      };
    }
  } catch (err) {
    // Graceful fallback to road grid calculation
    console.warn('Using road-grid route fallback:', err);
  }

  const polyline = generateRealisticRoadRoute(start, end);
  const directDistance = calculateHaversineDistance(start, end);
  const distanceKm = Number((directDistance * 1.3).toFixed(1)); // 30% winding factor
  const etaMinutes = Math.max(2, Math.round((distanceKm / 42) * 60) + 1);

  return {
    polyline,
    distanceKm,
    etaMinutes,
    provider: 'grid_fallback',
  };
}

// Reverse geocode latitude and longitude to readable address
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  // Check if near any landmark first for instant resolution
  const target = { lat, lng };
  let closestDist = Infinity;
  let closestLandmark: Landmark | null = null;

  for (const lm of LANDMARKS) {
    const d = calculateHaversineDistance(target, { lat: lm.lat, lng: lm.lng });
    if (d < 0.15 && d < closestDist) {
      closestDist = d;
      closestLandmark = lm;
    }
  }

  if (closestLandmark) {
    return `${closestLandmark.name}, ${closestLandmark.address}`;
  }

  // Check hospitals
  for (const hosp of HOSPITALS) {
    const d = calculateHaversineDistance(target, { lat: hosp.lat, lng: hosp.lng });
    if (d < 0.15) {
      return `${hosp.name}, ${hosp.address}`;
    }
  }

  // Try Nominatim API with timeout
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
      {
        headers: { 'User-Agent': 'DropAid-EmergencyApp/1.0' },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data && data.display_name) {
        const parts = data.display_name.split(', ');
        return parts.slice(0, 3).join(', ');
      }
    }
  } catch {
    // Ignore and fallback
  }

  return `Metro Staging Zone (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
}
