import React, { useState } from 'react';
import {
  Booking,
  Hospital,
  PatientProfile,
  AmbulanceUnit,
  TripStage
} from '../../types/index.ts';
import {
  BellRing,
  Share2,
  PhoneCall,
  Navigation,
  CheckCircle2,
  Clock,
  ShieldCheck,
  FileCheck,
  Radio,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  UserCheck,
  Send,
  HeartHandshake
} from 'lucide-react';

interface TimeSavingFeaturesProps {
  booking: Booking;
  hospital?: Hospital | null;
  patientProfile: PatientProfile;
  assignedAmbulance?: AmbulanceUnit | null;
  onSendPreArrivalAlert?: () => void;
  onOpenUploadDocument?: (category: 'id_card' | 'insurance' | 'medical_history' | 'incident_photo') => void;
  onOpenUploadModal?: (category: 'id_card' | 'insurance' | 'medical_history' | 'incident_photo') => void;
}

export const TimeSavingFeatures: React.FC<TimeSavingFeaturesProps> = ({
  booking,
  hospital,
  patientProfile,
  assignedAmbulance,
  onSendPreArrivalAlert,
  onOpenUploadDocument,
  onOpenUploadModal,
}) => {
  const triggerUpload = onOpenUploadDocument || onOpenUploadModal;
  const [copiedLink, setCopiedLink] = useState(false);
  const [preArrivalConsent, setPreArrivalConsent] = useState(booking.preArrivalConsentGiven ?? true);
  const [preArrivalSent, setPreArrivalSent] = useState(booking.preArrivalAlertSent ?? false);

  const trackingUrl = typeof window !== 'undefined' ? `${window.location.origin}?track=${booking.trackingCode}` : '';

  const shareText = `🚨 DropAid Emergency Alert: Ambulance unit ${assignedAmbulance?.callSign || 'dispatched'} is en route for ${booking.patientName}. Destination: ${booking.dropoffAddress.split(',')[0]}. Live Tracking: ${trackingUrl}`;

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `DropAid Emergency Tracking - ${booking.trackingCode}`,
          text: shareText,
          url: trackingUrl,
        });
      } catch {
        // User cancelled or fallback
      }
    } else {
      navigator.clipboard.writeText(shareText);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleSendPreArrival = async () => {
    if (!preArrivalConsent) return;
    setPreArrivalSent(true);

    try {
      await fetch(`/api/bookings/${booking.id}/pre-arrival-alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: booking.patientName,
          bloodType: patientProfile.bloodType,
          allergies: patientProfile.allergies,
          medicalConditions: patientProfile.medicalConditions,
          etaMinutes: booking.etaMinutes,
          destinationHospitalId: booking.destinationHospitalId,
        }),
      });
    } catch {
      // quiet fallback
    }

    onSendPreArrivalAlert?.();
  };

  // Pre-arrival document checklist state
  const hasId = booking.documents.some((d) => d.type === 'id_card');
  const hasInsurance = booking.documents.some((d) => d.type === 'insurance');
  const hasHistory = booking.documents.some((d) => d.type === 'medical_history' || d.type === 'prescription');
  const hasAllergiesDocumented = patientProfile.allergies && patientProfile.allergies.length > 0;

  // Timeline stage mapping
  const TIMELINE_STEPS: {
    stage: TripStage;
    label: string;
    subtext: string;
  }[] = [
    {
      stage: 'pending',
      label: 'Emergency Booking Registered',
      subtext: `Requested at ${new Date(booking.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    },
    {
      stage: 'en_route_pickup',
      label: 'Ambulance Dispatched & En Route',
      subtext: assignedAmbulance ? `${assignedAmbulance.callSign} (Driver: ${assignedAmbulance.driverName})` : 'Searching fleet',
    },
    {
      stage: 'on_scene',
      label: 'Paramedics On-Scene & Triage',
      subtext: 'Patient vital checks & immediate stabilization',
    },
    {
      stage: 'transporting',
      label: 'In-Transit to Emergency Hospital',
      subtext: `En route to ${booking.dropoffAddress.split(',')[0]} (ETA ~${booking.etaMinutes}m)`,
    },
    {
      stage: 'at_hospital',
      label: 'Arrived at Hospital ER Bay',
      subtext: 'Backed into trauma bay. Receiving team receiving report',
    },
    {
      stage: 'completed',
      label: 'Treatment Handover Completed',
      subtext: 'Patient successfully admitted under emergency physician care',
    },
  ];

  const getStepStatus = (stepStage: TripStage) => {
    const stageOrder: TripStage[] = ['pending', 'accepted', 'en_route_pickup', 'on_scene', 'transporting', 'at_hospital', 'completed'];
    const currentIdx = stageOrder.indexOf(booking.stage);
    const stepIdx = stageOrder.indexOf(stepStage);

    if (currentIdx > stepIdx) return 'completed';
    if (currentIdx === stepIdx) return 'active';
    return 'upcoming';
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5">
      {/* Time-Saving Actions Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-700 border border-emerald-100">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">
              Emergency Time-Saving Suite
            </h3>
            <p className="text-xs text-slate-500">
              Hospital pre-arrival notification, emergency contact sharing & required document checklist.
            </p>
          </div>
        </div>

        {/* One-Tap Share Action */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleNativeShare}
            className="text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{copiedLink ? 'Link Copied!' : '1-Tap Share Location'}</span>
          </button>
        </div>
      </div>

      {/* 1. Hospital Pre-Arrival Alert Bar */}
      <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
                <BellRing className="w-4 h-4 text-sky-600" />
                <span>Hospital Pre-Arrival Trauma Alert</span>
              </span>
              {preArrivalSent ? (
                <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-300">
                  Transmitted to ER Desk
                </span>
              ) : (
                <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
                  Ready to Transmit
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600">
              Pre-notifies {hospital?.name || booking.dropoffAddress.split(',')[0]} ER staff with patient blood group ({patientProfile.bloodType}), known allergies, and ETA to pre-allocate resuscitation bays.
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            {!preArrivalSent ? (
              <button
                type="button"
                onClick={handleSendPreArrival}
                disabled={!preArrivalConsent}
                className="text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 px-4 py-2 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Pre-Arrival Alert</span>
              </button>
            ) : (
              <div className="text-xs font-bold text-emerald-700 bg-white border border-emerald-300 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Bay Pre-Allocated</span>
              </div>
            )}
          </div>
        </div>

        {/* Consent Safeguard */}
        <div className="pt-2 border-t border-sky-100 flex items-center justify-between text-[11px] text-slate-500">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={preArrivalConsent}
              onChange={(e) => setPreArrivalConsent(e.target.checked)}
              className="w-3.5 h-3.5 text-sky-600 rounded border-slate-300 focus:ring-sky-500 cursor-pointer"
            />
            <span>I consent to share medical profile & ETA with the receiving hospital triage desk</span>
          </label>
          <span className="text-slate-400 font-mono text-[10px]">Strict HIPAA / DISHA Confidentiality</span>
        </div>
      </div>

      {/* 2. Medical Document Checklist & Emergency Contacts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pre-Arrival Medical Document Checklist */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-sky-600" />
              <span>Pre-Arrival Document Checklist</span>
            </div>
            <span className="text-[10px] text-slate-500 font-semibold">
              {[hasId, hasInsurance, hasHistory, hasAllergiesDocumented].filter(Boolean).length} of 4 Ready
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between bg-white border border-slate-200 p-2 rounded-lg">
              <div className="flex items-center gap-2 min-w-0">
                <span className={hasId ? 'text-emerald-600' : 'text-slate-300'}>
                  {hasId ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border border-slate-300" />}
                </span>
                <span className="text-slate-800 font-medium truncate">Government Photo ID (Aadhaar / Passport)</span>
              </div>
              {!hasId && triggerUpload && (
                <button
                  type="button"
                  onClick={() => triggerUpload('id_card')}
                  className="text-[10px] font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 px-2 py-0.5 rounded cursor-pointer"
                >
                  Upload
                </button>
              )}
            </div>

            <div className="flex items-center justify-between bg-white border border-slate-200 p-2 rounded-lg">
              <div className="flex items-center gap-2 min-w-0">
                <span className={hasInsurance ? 'text-emerald-600' : 'text-slate-300'}>
                  {hasInsurance ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border border-slate-300" />}
                </span>
                <span className="text-slate-800 font-medium truncate">Health Insurance Card / TPA Details</span>
              </div>
              {!hasInsurance && triggerUpload && (
                <button
                  type="button"
                  onClick={() => triggerUpload('insurance')}
                  className="text-[10px] font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 px-2 py-0.5 rounded cursor-pointer"
                >
                  Upload
                </button>
              )}
            </div>

            <div className="flex items-center justify-between bg-white border border-slate-200 p-2 rounded-lg">
              <div className="flex items-center gap-2 min-w-0">
                <span className={hasHistory ? 'text-emerald-600' : 'text-slate-300'}>
                  {hasHistory ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border border-slate-300" />}
                </span>
                <span className="text-slate-800 font-medium truncate">Past Medical Records / Prescriptions</span>
              </div>
              {!hasHistory && triggerUpload && (
                <button
                  type="button"
                  onClick={() => triggerUpload('medical_history')}
                  className="text-[10px] font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 px-2 py-0.5 rounded cursor-pointer"
                >
                  Upload
                </button>
              )}
            </div>

            <div className="flex items-center justify-between bg-white border border-slate-200 p-2 rounded-lg">
              <div className="flex items-center gap-2 min-w-0">
                <span className={hasAllergiesDocumented ? 'text-emerald-600' : 'text-amber-500'}>
                  <CheckCircle2 className="w-4 h-4" />
                </span>
                <span className="text-slate-800 font-medium truncate">
                  Allergies: {patientProfile.allergies.join(', ') || 'No known allergies documented'}
                </span>
              </div>
              <span className="text-[10px] font-bold text-slate-500 font-mono">
                {patientProfile.bloodType}
              </span>
            </div>
          </div>
        </div>

        {/* Hospital Contact & Navigation Actions */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
              <Navigation className="w-4 h-4 text-sky-600" />
              <span>Receiving Facility Contact & Directions</span>
            </div>

            <div className="bg-white border border-slate-200 p-2.5 rounded-lg space-y-1">
              <div className="font-bold text-slate-900 text-xs">
                {hospital?.name || booking.dropoffAddress.split(',')[0]}
              </div>
              <div className="text-[11px] text-slate-600 truncate">
                {hospital?.address || booking.dropoffAddress}
              </div>
              <div className="text-[10px] text-slate-500">
                Emergency Desk: <strong className="text-slate-800">{hospital?.emergencyContact || '112 / +91 11 2658 8500'}</strong>
              </div>
            </div>

            {/* Emergency Contact Quick Notify */}
            <div className="bg-white border border-slate-200 p-2.5 rounded-lg text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Emergency Contact:</span>
                <span className="font-bold text-slate-800">{patientProfile.emergencyContact.name} ({patientProfile.emergencyContact.relationship})</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-slate-700">{patientProfile.emergencyContact.phone}</span>
                <a
                  href={`tel:${patientProfile.emergencyContact.phone}`}
                  className="text-[11px] font-bold text-sky-700 hover:underline flex items-center gap-1"
                >
                  <PhoneCall className="w-3 h-3" />
                  <span>Call Contact</span>
                </a>
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            {hospital?.lat && hospital?.lng && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${hospital.lat},${hospital.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold text-center flex items-center justify-center gap-1.5 transition-colors"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Open Google Maps</span>
              </a>
            )}

            {hospital?.emergencyContact && (
              <a
                href={`tel:${hospital.emergencyContact.split('/')[0].trim()}`}
                className="flex-1 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-lg text-xs font-bold text-center flex items-center justify-center gap-1.5 transition-colors"
              >
                <PhoneCall className="w-3.5 h-3.5 text-sky-600" />
                <span>Call Hospital ER</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* 3. Clear Timeline for Booking, Pickup, Hospital Arrival & Treatment Handover */}
      <div className="space-y-3 pt-2">
        <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
          <Clock className="w-3.5 h-3.5 text-sky-600" />
          <span>Trip & Treatment Handover Timeline</span>
        </h4>

        <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
          {TIMELINE_STEPS.map((step, idx) => {
            const status = getStepStatus(step.stage);
            return (
              <div key={idx} className="relative flex items-start gap-3 text-xs">
                {/* Dot */}
                <div
                  className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 ${
                    status === 'completed'
                      ? 'bg-emerald-600 border-white text-white'
                      : status === 'active'
                      ? 'bg-sky-600 border-white text-white ring-4 ring-sky-100 animate-pulse'
                      : 'bg-white border-slate-300 text-slate-400'
                  }`}
                >
                  {status === 'completed' ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-current" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className={`font-bold ${status === 'active' ? 'text-sky-700' : status === 'completed' ? 'text-slate-900' : 'text-slate-500'}`}>
                    {step.label}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {step.subtext}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
