import React, { useState, useRef, useEffect } from 'react';
import { PatientProfile } from '../../types/index.ts';
import {
  User,
  Phone,
  Mail,
  Camera,
  Heart,
  Shield,
  AlertTriangle,
  Save,
  RotateCcw,
  CheckCircle2,
  Trash2,
  Plus,
  X,
  UploadCloud,
  FileBadge,
  Sparkles,
  Loader2
} from 'lucide-react';

interface UserProfileViewProps {
  profile: PatientProfile;
  onSaveProfile: (updated: PatientProfile) => Promise<void>;
  onBackToHome: () => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({
  profile,
  onSaveProfile,
  onBackToHome,
}) => {
  // Form State
  const [formData, setFormData] = useState<PatientProfile>(profile);
  const [newAllergy, setNewAllergy] = useState('');
  const [newCondition, setNewCondition] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state if initial profile updates
  useEffect(() => {
    setFormData(profile);
  }, [profile]);

  const hasChanges = JSON.stringify(formData) !== JSON.stringify(profile);

  // Handle Photo File Selection & Cloudinary Upload
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    // Validation 1: Format
    const validFormats = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validFormats.includes(file.type)) {
      setUploadError('Invalid image format. Please select a JPEG, PNG, or WEBP image.');
      return;
    }

    // Validation 2: Size (Max 12MB)
    if (file.size > 12 * 1024 * 1024) {
      setUploadError('File size exceeds the 12MB limit.');
      return;
    }

    setIsUploadingPhoto(true);

    try {
      // Convert to base64 data url
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;

        try {
          // Upload to Cloudinary API proxy
          const res = await fetch('/api/cloudinary/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileData: base64Data,
              folder: 'dropaid/profiles',
              resourceType: 'image',
              fileName: `profile_${formData.id}_${Date.now()}`,
            }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || 'Failed to upload photo to Cloudinary');
          }

          const uploadResult = await res.json();
          setFormData((prev) => ({
            ...prev,
            profilePhoto: uploadResult.secure_url || base64Data,
            profilePhotoPublicId: uploadResult.public_id,
          }));
          setIsUploadingPhoto(false);
        } catch (err: any) {
          console.error('Photo upload error:', err);
          setUploadError(err.message || 'Error uploading profile image. Please try again.');
          setIsUploadingPhoto(false);
        }
      };

      reader.onerror = () => {
        setUploadError('Failed to read the selected file.');
        setIsUploadingPhoto(false);
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      setUploadError(err.message || 'Unexpected upload error.');
      setIsUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    setFormData((prev) => ({
      ...prev,
      profilePhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      profilePhotoPublicId: undefined,
    }));
  };

  const handleAddAllergy = () => {
    const trimmed = newAllergy.trim();
    if (trimmed && !formData.allergies.includes(trimmed)) {
      setFormData((prev) => ({
        ...prev,
        allergies: [...prev.allergies, trimmed],
      }));
      setNewAllergy('');
    }
  };

  const handleRemoveAllergy = (allergy: string) => {
    setFormData((prev) => ({
      ...prev,
      allergies: prev.allergies.filter((a) => a !== allergy),
    }));
  };

  const handleAddCondition = () => {
    const trimmed = newCondition.trim();
    if (trimmed && !formData.medicalConditions.includes(trimmed)) {
      setFormData((prev) => ({
        ...prev,
        medicalConditions: [...prev.medicalConditions, trimmed],
      }));
      setNewCondition('');
    }
  };

  const handleRemoveCondition = (condition: string) => {
    setFormData((prev) => ({
      ...prev,
      medicalConditions: prev.medicalConditions.filter((c) => c !== condition),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await onSaveProfile(formData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setFormData(profile);
    setUploadError(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-0.5 rounded-md flex items-center gap-1.5">
                <FileBadge className="w-3.5 h-3.5 text-sky-600" />
                <span>My Profile</span>
              </span>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Synced with Emergency Cloud</span>
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-2 tracking-tight">
              Patient Emergency Profile & Medical ID
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Your profile is instantly shared with assigned paramedic crews and receiving hospital trauma teams during emergency dispatches.
            </p>
          </div>

          <button
            type="button"
            onClick={onBackToHome}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl transition-colors cursor-pointer self-start sm:self-auto"
          >
            ← Back to Dispatch
          </button>
        </div>

        {/* Save confirmation alert */}
        {saveSuccess && (
          <div className="mt-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <span className="font-bold">Profile Updated Successfully:</span> All changes have been saved to the database and will persist across browser refreshes.
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-8">
          {/* SECTION 1: PHOTO & AVATAR (Cloudinary Integrated) */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 p-5 bg-slate-50/80 rounded-2xl border border-slate-200/80">
            <div className="relative group shrink-0">
              <img
                src={formData.profilePhoto}
                alt={formData.name}
                className="w-28 h-28 rounded-2xl object-cover border-3 border-white shadow-md bg-white"
              />
              {isUploadingPhoto && (
                <div className="absolute inset-0 bg-slate-950/60 rounded-2xl flex flex-col items-center justify-center text-white text-xs gap-1">
                  <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
                  <span>Uploading...</span>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-2 text-center sm:text-left">
              <h3 className="text-base font-bold text-slate-900">Patient Profile Photo</h3>
              <p className="text-xs text-slate-500 max-w-md">
                Uploaded photos are securely optimized and delivered via Cloudinary CDN. Paramedics use this photo to visually confirm patient identity on scene.
              </p>

              {uploadError && (
                <p className="text-xs font-medium text-rose-600 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {uploadError}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoSelect}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingPhoto}
                  className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Change Photo (Cloudinary)</span>
                </button>

                {formData.profilePhotoPublicId && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-300 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Reset to Default</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 2: PERSONAL INFORMATION */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <User className="w-4 h-4 text-sky-600" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                1. Personal Contact Details
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Legal Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Aarav Malhotra"
                  className="w-full px-3.5 py-2 text-xs font-medium bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Primary Phone Number <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full pl-9 pr-3.5 py-2 text-xs font-medium bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-2xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="patient@example.com"
                    className="w-full pl-9 pr-3.5 py-2 text-xs font-medium bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-2xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: EMERGENCY CONTACT */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Heart className="w-4 h-4 text-rose-600" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                2. Emergency Contact (Primary Next of Kin)
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Contact Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.emergencyContact.name}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      emergencyContact: { ...formData.emergencyContact, name: e.target.value },
                    })
                  }
                  placeholder="e.g. Priya Malhotra"
                  className="w-full px-3.5 py-2 text-xs font-medium bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Relationship <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.emergencyContact.relationship}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      emergencyContact: { ...formData.emergencyContact, relationship: e.target.value },
                    })
                  }
                  className="w-full px-3.5 py-2 text-xs font-medium bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-2xs"
                >
                  <option value="Spouse">Spouse / Partner</option>
                  <option value="Parent">Parent / Guardian</option>
                  <option value="Child">Son / Daughter</option>
                  <option value="Sibling">Brother / Sister</option>
                  <option value="Friend">Close Friend / Colleague</option>
                  <option value="Physician">Personal Physician</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Emergency Phone Number <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="tel"
                    required
                    value={formData.emergencyContact.phone}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        emergencyContact: { ...formData.emergencyContact, phone: e.target.value },
                      })
                    }
                    placeholder="+91 98765 12345"
                    className="w-full pl-9 pr-3.5 py-2 text-xs font-medium bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-2xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: MEDICAL TELEMETRY & RECORDS */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Shield className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                3. Critical Medical Data & Insurance
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Blood Group Type
                </label>
                <select
                  value={formData.bloodType}
                  onChange={(e) => setFormData({ ...formData, bloodType: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs font-medium bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-2xs"
                >
                  <option value="A Positive (A+)">A Positive (A+)</option>
                  <option value="A Negative (A-)">A Negative (A-)</option>
                  <option value="B Positive (B+)">B Positive (B+)</option>
                  <option value="B Negative (B-)">B Negative (B-)</option>
                  <option value="AB Positive (AB+)">AB Positive (AB+)</option>
                  <option value="AB Negative (AB-)">AB Negative (AB-)</option>
                  <option value="O Positive (O+)">O Positive (O+)</option>
                  <option value="O Negative (O-)">O Negative (O-)</option>
                  <option value="Unknown">Unknown / Pending Lab</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Health Insurance Provider
                </label>
                <input
                  type="text"
                  value={formData.insuranceProvider}
                  onChange={(e) => setFormData({ ...formData, insuranceProvider: e.target.value })}
                  placeholder="e.g. Star Health / Max Bupa / HDFC ERGO"
                  className="w-full px-3.5 py-2 text-xs font-medium bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Policy / Member ID Number
                </label>
                <input
                  type="text"
                  value={formData.policyNumber}
                  onChange={(e) => setFormData({ ...formData, policyNumber: e.target.value })}
                  placeholder="SH-DEL-88239014-X"
                  className="w-full px-3.5 py-2 text-xs font-medium bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-2xs font-mono"
                />
              </div>
            </div>

            {/* Allergies Tag List */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <label className="block text-xs font-bold text-slate-800">
                Known Drug & Environmental Allergies
              </label>
              <div className="flex flex-wrap items-center gap-1.5 min-h-[32px]">
                {formData.allergies.map((allergy) => (
                  <span
                    key={allergy}
                    className="inline-flex items-center gap-1 text-xs font-semibold bg-rose-100 text-rose-800 px-2.5 py-1 rounded-lg border border-rose-200"
                  >
                    <span>{allergy}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAllergy(allergy)}
                      className="text-rose-500 hover:text-rose-700 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {formData.allergies.length === 0 && (
                  <span className="text-xs text-slate-400 italic">No allergies recorded.</span>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1 max-w-sm">
                <input
                  type="text"
                  value={newAllergy}
                  onChange={(e) => setNewAllergy(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddAllergy();
                    }
                  }}
                  placeholder="Add allergy (e.g. Penicillin, NSAIDs)..."
                  className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500 shadow-2xs"
                />
                <button
                  type="button"
                  onClick={handleAddAllergy}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Pre-existing Medical Conditions Tag List */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <label className="block text-xs font-bold text-slate-800">
                Pre-existing Medical Conditions & History
              </label>
              <div className="flex flex-wrap items-center gap-1.5 min-h-[32px]">
                {formData.medicalConditions.map((condition) => (
                  <span
                    key={condition}
                    className="inline-flex items-center gap-1 text-xs font-semibold bg-sky-100 text-sky-800 px-2.5 py-1 rounded-lg border border-sky-200"
                  >
                    <span>{condition}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCondition(condition)}
                      className="text-sky-500 hover:text-sky-700 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {formData.medicalConditions.length === 0 && (
                  <span className="text-xs text-slate-400 italic">No prior conditions listed.</span>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1 max-w-sm">
                <input
                  type="text"
                  value={newCondition}
                  onChange={(e) => setNewCondition(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCondition();
                    }
                  }}
                  placeholder="Add condition (e.g. Type 2 Diabetes, Asthma)..."
                  className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500 shadow-2xs"
                />
                <button
                  type="button"
                  onClick={handleAddCondition}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* SECTION 5: ACTION CONTROLS */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-200">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              {hasChanges ? (
                <span className="text-amber-600 font-semibold flex items-center gap-1">
                  ● Unsaved changes detected
                </span>
              ) : (
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  ✓ Profile up to date
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleReset}
                disabled={!hasChanges || isSaving}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Discard Changes</span>
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-bold text-xs rounded-xl transition-all shadow-sm hover:shadow flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving to Database...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Profile Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
