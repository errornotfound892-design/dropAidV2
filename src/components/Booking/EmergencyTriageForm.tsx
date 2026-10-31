import React, { useState } from 'react';
import { User, Users, Camera, X, CheckCircle2, ShieldCheck, HeartPulse, Mail, Phone, AlertCircle, Loader2 } from 'lucide-react';
import { BookingSubmissionData, PatientProfile } from '../../types/index.ts';

interface EmergencyTriageFormProps {
  patientProfile: PatientProfile;
  bookingData: BookingSubmissionData;
  onChangeBookingData: (updated: Partial<BookingSubmissionData>) => void;
  showToast?: (text: string, type: 'info' | 'success' | 'error') => void;
}

const BLOOD_GROUPS = ['Not Specified', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const RELATIONSHIPS = ['Parent', 'Child', 'Spouse', 'Sibling', 'Colleague', 'Bystander / Good Samaritan', 'Other'];

export const EmergencyTriageForm: React.FC<EmergencyTriageFormProps> = ({
  patientProfile,
  bookingData,
  onChangeBookingData,
  showToast,
}) => {
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // File validation: Images only, max 25MB
    if (!file.type.startsWith('image/')) {
      const err = 'Please select a valid image file (JPEG, PNG, WEBP).';
      setPhotoError(err);
      showToast?.(err, 'error');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      const err = 'Photo size exceeds 25MB limit.';
      setPhotoError(err);
      showToast?.(err, 'error');
      return;
    }

    setPhotoError(null);
    setIsUploadingPhoto(true);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        try {
          const res = await fetch('/api/cloudinary/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileData: base64Data,
              folder: 'dropaid/patient_photos',
              resourceType: 'image',
              fileName: `patient_${Date.now()}`,
            }),
          });
          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.error || 'Failed to upload photo.');
          }

          onChangeBookingData({
            patientPhotoUrl: data.secure_url,
            patientPhotoPublicId: data.public_id,
            photoConsentGiven: true,
          });
          showToast?.('Patient photo uploaded securely.', 'success');
        } catch (err: any) {
          setPhotoError(err.message || 'Upload failed.');
          showToast?.(err.message || 'Upload failed.', 'error');
        } finally {
          setIsUploadingPhoto(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setIsUploadingPhoto(false);
      setPhotoError(err.message || 'Failed to read photo.');
    }
  };

  const handleRemovePhoto = () => {
    onChangeBookingData({
      patientPhotoUrl: undefined,
      patientPhotoPublicId: undefined,
      photoConsentGiven: false,
    });
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 text-left text-xs space-y-4 shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
        <div>
          <span className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
            <HeartPulse className="w-4 h-4 text-rose-600" />
            <span>Emergency Patient Triage & Details</span>
          </span>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Who needs medical assistance? Optional details will never delay dispatch.
          </p>
        </div>
        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-emerald-600" />
          <span>No Info Blocks Dispatch</span>
        </span>
      </div>

      {/* 1. Who are you booking for? */}
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
          Are you booking for yourself or someone else? *
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() =>
              onChangeBookingData({
                bookingFor: 'self',
                patientName: patientProfile.name || 'Aarav Sharma',
                patientPhone: patientProfile.phone || '+91 98101 23456',
                patientEmail: patientProfile.email || '',
                bloodGroup: patientProfile.bloodType || 'B+',
              })
            }
            className={`py-2 px-3 rounded-lg border font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              bookingData.bookingFor === 'self'
                ? 'bg-sky-600 text-white border-sky-600 shadow-xs ring-1 ring-sky-300'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Myself</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onChangeBookingData({
                bookingFor: 'someone_else',
                patientName: '',
                callerName: patientProfile.name || 'Caller',
                callerPhone: patientProfile.phone || '',
                relationship: 'Family Member',
              })
            }
            className={`py-2 px-3 rounded-lg border font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              bookingData.bookingFor === 'someone_else'
                ? 'bg-sky-600 text-white border-sky-600 shadow-xs ring-1 ring-sky-300'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Someone Else</span>
          </button>
        </div>
      </div>

      {/* 2. Patient Information Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Patient Name */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            {bookingData.bookingFor === 'self' ? 'Your Full Name' : "Patient's Full Name"} *
          </label>
          <input
            type="text"
            required
            value={bookingData.patientName}
            onChange={(e) => onChangeBookingData({ patientName: e.target.value })}
            placeholder="e.g. Aarav Sharma"
            className="w-full bg-white border border-slate-300 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-lg px-3 py-1.5 text-xs text-slate-900"
          />
        </div>

        {/* Mobile Number */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
            <span>{bookingData.bookingFor === 'self' ? 'Mobile Number' : "Patient's Mobile"} *</span>
            <span className="text-[10px] text-slate-400 font-normal">For driver call</span>
          </label>
          <input
            type="tel"
            required
            value={bookingData.patientPhone}
            onChange={(e) => onChangeBookingData({ patientPhone: e.target.value })}
            placeholder="+91 98101 23456"
            className="w-full bg-white border border-slate-300 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-mono"
          />
        </div>

        {/* Someone else specific fields: Relationship & Caller Details */}
        {bookingData.bookingFor === 'someone_else' && (
          <>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Your Relationship to Patient
              </label>
              <select
                value={bookingData.relationship || 'Family Member'}
                onChange={(e) => onChangeBookingData({ relationship: e.target.value })}
                className="w-full bg-white border border-slate-300 focus:border-sky-500 rounded-lg px-3 py-1.5 text-xs text-slate-900"
              >
                {RELATIONSHIPS.map((rel) => (
                  <option key={rel} value={rel}>
                    {rel}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Your Name & Phone (Caller)
              </label>
              <input
                type="text"
                value={`${bookingData.callerName || ''}${bookingData.callerPhone ? ` (${bookingData.callerPhone})` : ''}`}
                onChange={(e) => onChangeBookingData({ callerName: e.target.value })}
                placeholder="Your contact details"
                className="w-full bg-white border border-slate-300 focus:border-sky-500 rounded-lg px-3 py-1.5 text-xs text-slate-900"
              />
            </div>
          </>
        )}

        {/* Optional Email */}
        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1 flex items-center justify-between">
            <span>Email Address</span>
            <span className="text-[10px] text-slate-400 italic">Optional</span>
          </label>
          <input
            type="email"
            value={bookingData.patientEmail || ''}
            onChange={(e) => onChangeBookingData({ patientEmail: e.target.value })}
            placeholder="patient@example.com"
            className="w-full bg-white border border-slate-300 focus:border-sky-500 rounded-lg px-3 py-1.5 text-xs text-slate-900"
          />
        </div>

        {/* Blood Group */}
        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1 flex items-center justify-between">
            <span>Blood Group</span>
            <span className="text-[10px] text-slate-400 italic">Optional</span>
          </label>
          <select
            value={bookingData.bloodGroup || 'Not Specified'}
            onChange={(e) => onChangeBookingData({ bloodGroup: e.target.value })}
            className="w-full bg-white border border-slate-300 focus:border-sky-500 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-semibold"
          >
            {BLOOD_GROUPS.map((bg) => (
              <option key={bg} value={bg}>
                {bg}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. Optional Patient / Scene Photo Upload */}
      <div className="pt-2 border-t border-slate-200">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5 text-slate-500" />
            <span>Patient / Scene Photo (Optional)</span>
          </label>
          <span className="text-[10px] text-slate-400 italic">Never blocks dispatch</span>
        </div>

        {bookingData.patientPhotoUrl ? (
          <div className="flex items-center gap-3 bg-white p-2.5 rounded-lg border border-emerald-300 shadow-2xs">
            <img
              src={bookingData.patientPhotoUrl}
              alt="Patient/Scene thumbnail"
              className="w-14 h-14 rounded-md object-cover border border-slate-200"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 text-emerald-700 font-bold text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Photo Securely Attached</span>
              </div>
              <p className="text-[10px] text-slate-500 truncate mt-0.5">
                Encrypted & accessible only to assigned EMT paramedics and receiving ER clinicians.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRemovePhoto}
              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
              title="Remove photo"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 hover:border-slate-400 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs cursor-pointer transition-colors">
              {isUploadingPhoto ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600" />
                  <span>Uploading to Cloudinary...</span>
                </>
              ) : (
                <>
                  <Camera className="w-3.5 h-3.5 text-sky-600" />
                  <span>Attach Patient / Incident Photo</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                disabled={isUploadingPhoto}
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </label>
            <span className="text-[10px] text-slate-400">JPEG, PNG, WEBP (Max 25MB)</span>
          </div>
        )}

        {photoError && (
          <div className="mt-1.5 text-[11px] text-rose-600 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-rose-500" />
            <span>{photoError}</span>
          </div>
        )}
      </div>
    </div>
  );
};
