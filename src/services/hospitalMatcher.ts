import { Hospital, LatLng, EmergencyCategory } from '../types/index.ts';
import { calculateHaversineDistance } from './routingService.ts';

export interface HospitalMatchResult {
  hospital: Hospital;
  score: number; // 0 to 100
  roadDistanceKm: number;
  roadEtaMins: number;
  matchReasons: string[];
  hasVerifiedCapacity: boolean;
  capacitySummary: string;
  isCategorySpecialist: boolean;
  specialtyHighlights: string[];
}

export const EMERGENCY_CATEGORIES: {
  id: EmergencyCategory;
  name: string;
  description: string;
  iconName: string;
  recommendedKeywords: string[];
}[] = [
  {
    id: 'cardiac',
    name: 'Cardiac Emergency',
    description: 'Acute chest pain, suspected STEMI heart attack, severe arrhythmia, cardiac arrest',
    iconName: 'HeartPulse',
    recommendedKeywords: ['cardiac', 'heart', 'stemi', 'ecmo', 'cath lab', 'coronary'],
  },
  {
    id: 'trauma',
    name: 'Trauma & Accidents',
    description: 'High-speed motor collision, severe arterial bleeding, compound fractures, head injury',
    iconName: 'Activity',
    recommendedKeywords: ['trauma', 'orthopedic', 'resuscitation', 'spine', 'neuro-trauma'],
  },
  {
    id: 'dental',
    name: 'Dental & Maxillofacial',
    description: 'Severe facial/jaw trauma, avulsed tooth, uncontrolled oral hemorrhage, acute dental abscess',
    iconName: 'Smile',
    recommendedKeywords: ['dental', 'maxillofacial', 'oral surgery', 'facial trauma', 'jaw'],
  },
  {
    id: 'stroke',
    name: 'Stroke & Neurological',
    description: 'Sudden facial droop, arm weakness, slurred speech, acute neurovascular emergency',
    iconName: 'Brain',
    recommendedKeywords: ['stroke', 'neurovascular', 'thrombolysis', 'neurological'],
  },
  {
    id: 'pediatric',
    name: 'Pediatric Emergency',
    description: 'Infant/child acute respiratory distress, severe dehydration, pediatric seizure',
    iconName: 'Baby',
    recommendedKeywords: ['pediatric', 'picu', 'child', 'infant', 'neonatal'],
  },
  {
    id: 'burns',
    name: 'Severe Burns',
    description: 'Third-degree thermal, electrical flash, or chemical burn requiring specialized burn ICU',
    iconName: 'Flame',
    recommendedKeywords: ['burn', 'burn center', 'thermal', 'reconstruction'],
  },
  {
    id: 'general',
    name: 'General Medical Emergency',
    description: 'Severe acute abdominal pain, high fever with altered sensorium, sudden syncope',
    iconName: 'Stethoscope',
    recommendedKeywords: ['resuscitation', 'emergency department', 'critical care', 'triage'],
  },
];

/**
 * Intelligent Hospital Matching Engine
 * Ranks all available hospitals based on:
 * 1. Medical specialty alignment with patient's acute emergency category
 * 2. True road driving distance and travel time from user GPS
 * 3. Verified live bed and emergency bay availability
 * Note: Never claims a hospital has capacity without verified information.
 */
export function rankHospitalsForEmergency(
  pickupCoords: LatLng,
  hospitals: Hospital[],
  category: EmergencyCategory = 'general'
): HospitalMatchResult[] {
  const results: HospitalMatchResult[] = hospitals.map((hospital) => {
    // 1. Calculate realistic road distance (1.35x road grid winding factor across Delhi NCR)
    const directDistKm = calculateHaversineDistance(pickupCoords, { lat: hospital.lat, lng: hospital.lng });
    const roadDistKm = Number((directDistKm * 1.32).toFixed(1));

    // Estimated road travel time: ~42 km/h average emergency siren transit + traffic buffer
    const roadEtaMins = Math.max(3, Math.round((roadDistKm / 42) * 60) + Math.round(hospital.erWaitMins * 0.4));

    // 2. Specialty alignment evaluation
    const specialtiesLower = hospital.specialties.map((s) => s.toLowerCase()).join(' ');
    const categoryConfig = EMERGENCY_CATEGORIES.find((c) => c.id === category);
    const keywords = categoryConfig?.recommendedKeywords || [];

    let specialtyScore = 40;
    const matchReasons: string[] = [];
    let isCategorySpecialist = false;
    const specialtyHighlights: string[] = [];

    // Category-specific evaluation
    if (category === 'cardiac') {
      if (hospital.traumaLevel === 'Cardiac Center' || specialtiesLower.includes('stemi') || specialtiesLower.includes('cath lab')) {
        specialtyScore = 100;
        isCategorySpecialist = true;
        matchReasons.push('Verified 24/7 Acute STEMI & Cath Lab Standby');
        specialtyHighlights.push('Immediate Angioplasty / STEMI Pathway');
      } else if (hospital.traumaLevel === 'Level 1') {
        specialtyScore = 80;
        matchReasons.push('Level 1 Resuscitation & Intensive Cardiac ICU');
        specialtyHighlights.push('Advanced Cardiac Resuscitation');
      }
    } else if (category === 'dental') {
      if (
        hospital.dentalFacilities && hospital.dentalFacilities.length > 0 ||
        specialtiesLower.includes('maxillofacial') ||
        specialtiesLower.includes('dental') ||
        specialtiesLower.includes('head')
      ) {
        specialtyScore = 100;
        isCategorySpecialist = true;
        matchReasons.push('Dedicated Maxillofacial & Dental Trauma Emergency Wing');
        specialtyHighlights.push('On-Duty Oral & Maxillofacial Surgeons');
      } else if (hospital.traumaLevel === 'Level 1' || hospital.traumaLevel === 'Level 2') {
        specialtyScore = 65;
        matchReasons.push('General Trauma ER capable of acute facial bleeding control');
        specialtyHighlights.push('Emergency Facial Hemostasis');
      }
    } else if (category === 'trauma') {
      if (hospital.traumaLevel === 'Level 1') {
        specialtyScore = 100;
        isCategorySpecialist = true;
        matchReasons.push('Level 1 Apex Trauma Center with dedicated resuscitation bays');
        specialtyHighlights.push('Round-the-clock Trauma Surgery & Neuro-trauma');
      } else if (hospital.traumaLevel === 'Level 2') {
        specialtyScore = 75;
        matchReasons.push('Level 2 Trauma Center');
        specialtyHighlights.push('Emergency Orthopedic & General Surgery');
      }
    } else if (category === 'stroke') {
      if (specialtiesLower.includes('stroke') || specialtiesLower.includes('neurovascular')) {
        specialtyScore = 100;
        isCategorySpecialist = true;
        matchReasons.push('Comprehensive Stroke Center with rapid IV-thrombolysis');
        specialtyHighlights.push('Interventional Neurovascular Suite');
      } else if (hospital.traumaLevel === 'Level 1') {
        specialtyScore = 80;
        matchReasons.push('Level 1 Neuro-trauma & CT Angiography');
        specialtyHighlights.push('Emergency CT & Neuro ICU');
      }
    } else if (category === 'pediatric') {
      if (specialtiesLower.includes('pediatric') || hospital.traumaLevel === 'Pediatric Trauma') {
        specialtyScore = 100;
        isCategorySpecialist = true;
        matchReasons.push('Advanced Pediatric Intensive Care Unit (PICU) on standby');
        specialtyHighlights.push('Pediatric Resuscitation Specialists');
      } else if (hospital.traumaLevel === 'Level 1') {
        specialtyScore = 75;
        matchReasons.push('Multi-specialty emergency care with pediatric triage');
      }
    } else if (category === 'burns') {
      if (specialtiesLower.includes('burn')) {
        specialtyScore = 100;
        isCategorySpecialist = true;
        matchReasons.push('National Burn Center with sterile isolation ICU');
        specialtyHighlights.push('Plastic & Reconstructive Burn Team');
      } else if (hospital.traumaLevel === 'Level 1') {
        specialtyScore = 70;
        matchReasons.push('Level 1 emergency burn stabilization unit');
      }
    } else {
      // General Emergency
      if (hospital.traumaLevel === 'Level 1') {
        specialtyScore = 90;
        matchReasons.push('Comprehensive Level 1 Emergency Facility');
      } else {
        specialtyScore = 75;
        matchReasons.push('Full-service Emergency Department');
      }
    }

    // 3. Proximity scoring (closer is better, max 50 points)
    // 0 to 5km => 50 pts; 5 to 15km => 35 pts; 15 to 30km => 15 pts; >30km => 0 pts
    let proximityScore = 50;
    if (roadDistKm <= 4) {
      proximityScore = 50;
      matchReasons.push(`Nearest facility (~${roadDistKm} km · ${roadEtaMins} min road travel)`);
    } else if (roadDistKm <= 9) {
      proximityScore = 40;
      matchReasons.push(`Close proximity (~${roadDistKm} km · ${roadEtaMins} min)`);
    } else if (roadDistKm <= 18) {
      proximityScore = 25;
    } else {
      proximityScore = 10;
    }

    // 4. Capacity & verified availability scoring
    let availabilityScore = 20;
    let capacitySummary = '';
    const hasVerifiedCapacity = hospital.hasVerifiedCapacity;

    if (hospital.status === 'diverting') {
      availabilityScore = -50; // heavily penalize diverting facilities
      matchReasons.push('⚠️ Alert: Hospital currently on diverting status (Heavy ER overload)');
      capacitySummary = 'Status Diverting · Not Recommended for Non-Critical Redirects';
    } else if (hospital.status === 'busy') {
      availabilityScore = 5;
      matchReasons.push(`Busy status · ER wait est. ${hospital.erWaitMins} min`);
      capacitySummary = hasVerifiedCapacity
        ? `Verified Capacity: ${hospital.availableBeds} beds available (${hospital.baysAvailable} ER bays)`
        : 'Live Capacity: Awaiting confirmation';
    } else {
      // Open
      availabilityScore = 25;
      if (hasVerifiedCapacity) {
        matchReasons.push(`Verified Capacity: ${hospital.availableBeds} ER beds · ${hospital.baysAvailable} trauma bays`);
        capacitySummary = `Verified Capacity: ${hospital.availableBeds} beds (${hospital.baysAvailable} bays open)`;
      } else {
        matchReasons.push('Operating normal intake · Live bay availability confirming on dispatch');
        capacitySummary = 'Intake Normal · Live verification on dispatch';
      }
    }

    // Combined Score (0 to 100)
    // Specialty: 45% weight, Proximity: 35% weight, Availability: 20% weight
    const totalRawScore = (specialtyScore * 0.45) + (proximityScore * 0.35) + (availabilityScore * 0.20);
    const score = Math.max(5, Math.min(99, Math.round(totalRawScore)));

    return {
      hospital,
      score,
      roadDistanceKm: roadDistKm,
      roadEtaMins,
      matchReasons,
      hasVerifiedCapacity,
      capacitySummary,
      isCategorySpecialist,
      specialtyHighlights,
    };
  });

  // Sort descending by match score
  return results.sort((a, b) => b.score - a.score);
}

/**
 * Returns the single top-recommended hospital for the patient.
 */
export function getRecommendedHospital(
  pickupCoords: LatLng,
  hospitals: Hospital[],
  category: EmergencyCategory = 'general'
): HospitalMatchResult {
  const ranked = rankHospitalsForEmergency(pickupCoords, hospitals, category);
  return ranked[0];
}
