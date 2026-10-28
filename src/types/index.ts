export type ViewMode = 'user' | 'operator' | 'hospitals' | 'profile';

export type TripStage =
  | 'pending'
  | 'accepted'
  | 'en_route_pickup'
  | 'on_scene'
  | 'transporting'
  | 'at_hospital'
  | 'completed'
  | 'cancelled';

export interface LatLng {
  lat: number;
  lng: number;
}

export type EmergencyCategory =
  | 'cardiac'
  | 'trauma'
  | 'dental'
  | 'stroke'
  | 'pediatric'
  | 'burns'
  | 'general';

export interface HospitalDoctor {
  id: string;
  name: string;
  role: string;
  specialty: string;
  experienceYears: number;
  qualifications: string;
  registrationNumber: string;
  isConfirmedByHospital: boolean;
  avatarUrl?: string;
  onDutyShift?: string;
}

export interface TreatmentTeamMember {
  name: string;
  role: string;
  specialty: string;
}

export interface TreatmentProcedure {
  assignedBayOrRoom: string;
  triageLevel: 'Level 1 - Resuscitation' | 'Level 2 - Emergent' | 'Level 3 - Urgent' | 'Fast-Track Trauma';
  preparedEquipment: string[];
  notes?: string;
  confirmedAt?: string;
}

export interface Hospital {
  id: string;
  name: string;
  system: string;
  region: 'Delhi' | 'Noida' | 'Haryana';
  city: string;
  address: string;
  lat: number;
  lng: number;
  availableBeds: number;
  totalBeds: number;
  erWaitMins: number;
  traumaLevel: 'Level 1' | 'Level 2' | 'Pediatric Trauma' | 'Cardiac Center' | 'Specialty ER';
  status: 'open' | 'busy' | 'diverting';
  specialties: string[];
  supportedCategories: EmergencyCategory[];
  phone: string;
  emergencyContact: string;
  image: string;
  cloudinaryPublicId?: string;
  baysAvailable: number;
  isVerified: boolean;
  hasVerifiedCapacity: boolean;
  attendingDoctors?: HospitalDoctor[];
  treatmentTeam?: TreatmentTeamMember[];
  dentalFacilities?: string[];
  cardiacCathBeds?: number;
  burnBeds?: number;
  pediatricBeds?: number;
  primaryProcedures?: TreatmentProcedure[];
}

export interface Landmark {
  id: string;
  name: string;
  category: 'Transit' | 'Public Park' | 'Commercial' | 'Civic & Culture' | 'Sports & Arena' | 'Waterfront';
  address: string;
  lat: number;
  lng: number;
}

export interface AmbulanceUnit {
  id: string;
  callSign: string;
  type: 'ALS' | 'BLS' | 'ICU' | 'Neonatal' | 'Bariatric';
  typeName: string;
  status: 'available' | 'assigned' | 'en_route_pickup' | 'on_scene' | 'transporting' | 'at_hospital' | 'returning_to_base' | 'maintenance';
  driverName: string;
  driverPhone: string;
  driverPhoto: string;
  driverPhotoPublicId?: string;
  unitPhoto?: string;
  unitPhotoPublicId?: string;
  driverLicense: string;
  driverRating: number;
  paramedicName: string;
  equipment: string[];
  location: LatLng;
  baseLocation: LatLng;
  stationedHospitalId?: string;
  stationName: string;
  isHospitalStationed: boolean;
  region: 'Delhi' | 'Noida' | 'Haryana';
  heading: number;
  speedKmH: number;
  fuelPct: number;
  batteryPct: number;
  currentBookingId?: string;
}

export interface MedicalEquipmentItem {
  id: string;
  name: string;
  category: string;
  description: string;
  recommendedFor: string;
}

export interface PatientProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  profilePhoto: string;
  profilePhotoPublicId?: string;
  bloodType: string;
  allergies: string[];
  medicalConditions: string[];
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  insuranceProvider: string;
  policyNumber: string;
}

export interface BookingDocument {
  id: string;
  name: string;
  type: 'id_card' | 'insurance' | 'medical_history' | 'incident_photo' | 'prescription' | 'diagnostic_report' | 'other';
  url: string;
  publicId?: string;
  uploadedAt: string;
  source: 'cloudinary_live' | 'local_optimized';
  bytes?: number;
  treatmentStage?: 'pre_dispatch' | 'in_transit' | 'hospital_handoff' | 'post_treatment';
  consentGranted?: boolean;
  retentionPolicy?: '30_days' | '90_days' | '1_year';
  bookingId?: string;
  notes?: string;
  isVerified?: boolean;
}

export interface Booking {
  id: string;
  trackingCode: string;
  createdAt: string;
  patientName: string;
  patientPhone: string;
  patientNotes?: string;
  issueCategory?: EmergencyCategory;
  pickupAddress: string;
  pickupCoords: LatLng;
  dropoffAddress: string;
  dropoffCoords: LatLng;
  destinationHospitalId?: string;
  equipmentRequested: string[];
  stage: TripStage;
  assignedUnitId?: string;
  etaMinutes: number;
  distanceKm: number;
  routePolyline: [number, number][]; // [lat, lng] array
  currentVehiclePosition?: [number, number];
  currentWaypointIndex?: number;
  priceEst: number;
  documents: BookingDocument[];
  stageTimestamps: {
    requested: string;
    accepted?: string;
    dispatched?: string;
    arrivedScene?: string;
    departedScene?: string;
    arrivedHospital?: string;
    completed?: string;
  };
  isSimulated?: boolean;
  simulationDay?: number;
  simulationTime?: string;
  statusHistory?: {
    stage: TripStage;
    timestamp: string;
    note?: string;
  }[];
  // Doctor & Treatment Team confirmation
  isDoctorConfirmedByHospital?: boolean;
  confirmedDoctor?: HospitalDoctor;
  treatmentTeam?: TreatmentTeamMember[];
  treatmentProcedure?: TreatmentProcedure;
  // Time-saving pre-arrival alert & contact sharing
  preArrivalAlertSent?: boolean;
  preArrivalConsentGiven?: boolean;
  preArrivalSentAt?: string;
  emergencyContactShared?: boolean;
}

export interface SimulationState {
  status: 'idle' | 'running' | 'paused';
  simulatedDay: number;
  simulatedHour: number;
  simulatedMinute: number;
  speedMultiplier: number;
  ridesTargetPerDay: number;
  generatedCount: number;
  activeCount: number;
  completedCount: number;
}

export interface DispatchLogItem {
  id: string;
  timestamp: string;
  bookingId?: string;
  action: string;
  operator: string;
  notes: string;
}
