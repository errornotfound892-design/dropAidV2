import {
  Booking,
  Hospital,
  HospitalDoctor,
  TreatmentTeamMember,
  TreatmentProcedure
} from '../../types/index.ts';
import {
  UserCheck,
  Clock,
  ShieldCheck,
  Building2,
  PhoneCall,
  Stethoscope,
  Activity,
  AlertCircle,
  FileBadge,
  Sparkles,
  BedDouble,
  HeartHandshake
} from 'lucide-react';

interface DoctorTreatmentCardProps {
  booking?: Booking | null;
  hospital?: Hospital | null;
  isConfirmed?: boolean;
  doctor?: HospitalDoctor | null;
  treatmentTeam?: TreatmentTeamMember[] | null;
  procedure?: TreatmentProcedure | null;
  hospitalName?: string;
  onConfirmAssignment?: () => void; // Operator/Demo trigger if simulating ER reception
  onConfirmDoctor?: (doctor: HospitalDoctor) => void | Promise<void>;
}

export const DoctorTreatmentCard: React.FC<DoctorTreatmentCardProps> = ({
  booking,
  hospital,
  isConfirmed: isConfirmedProp,
  doctor: doctorProp,
  treatmentTeam: treatmentTeamProp,
  procedure: procedureProp,
  hospitalName: hospitalNameProp,
  onConfirmAssignment,
  onConfirmDoctor,
}) => {
  const isConfirmed = isConfirmedProp ?? (booking?.isDoctorConfirmedByHospital || false);
  const doctor = doctorProp ?? booking?.confirmedDoctor;
  const treatmentTeam = treatmentTeamProp ?? booking?.treatmentTeam;
  const procedure = procedureProp ?? booking?.treatmentProcedure;
  const hospitalName = hospitalNameProp ?? (hospital?.name || (booking ? booking.dropoffAddress.split(',')[0] : 'Receiving Hospital'));
  // If information is unavailable or unconfirmed by receiving hospital, display "Awaiting hospital confirmation"
  if (!isConfirmed || !doctor) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-50 rounded-lg text-amber-700 border border-amber-200">
              <Stethoscope className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                Attending Doctor & Emergency Treatment Team
              </h4>
              <p className="text-[11px] text-slate-500">
                Receiving Facility: <span className="font-semibold text-slate-700">{hospital?.name || hospitalName}</span>
              </p>
            </div>
          </div>

          <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Awaiting hospital confirmation</span>
          </span>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600 space-y-2">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-slate-800">
                Hospital Triage Assignment in Progress
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                The receiving emergency department at {hospital?.name || hospitalName} is reviewing pre-arrival telemetry. Official physician roster, surgical lead, and designated trauma bay assignments will display here once verified by the emergency desk.
              </p>
            </div>
          </div>

          {hospital?.emergencyContact && (
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">Emergency Desk Line:</span>
              <a
                href={`tel:${hospital.emergencyContact.split('/')[0].trim()}`}
                className="text-[11px] font-bold text-sky-700 hover:text-sky-800 flex items-center gap-1"
              >
                <PhoneCall className="w-3 h-3" />
                <span>{hospital.emergencyContact}</span>
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Hospital Confirmed Doctor & Treatment Team
  return (
    <div className="bg-white border border-emerald-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
      {/* Verified Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-emerald-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-700 border border-emerald-200">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <span>Verified Hospital Medical Assignment</span>
              <span className="text-[10px] font-mono uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-extrabold border border-emerald-300">
                Confirmed by ER Desk
              </span>
            </h4>
            <p className="text-[11px] text-slate-500">
              Facility: <span className="font-semibold text-slate-700">{hospital?.name || hospitalName}</span>
            </p>
          </div>
        </div>

        {hospital?.emergencyContact && (
          <a
            href={`tel:${hospital.emergencyContact.split('/')[0].trim()}`}
            className="text-[11px] font-bold text-sky-700 hover:text-sky-800 bg-sky-50 border border-sky-200 px-2.5 py-1 rounded-lg flex items-center gap-1"
          >
            <PhoneCall className="w-3 h-3" />
            <span>Direct ER Line</span>
          </a>
        )}
      </div>

      {/* Primary Responsible Doctor Card */}
      <div className="bg-gradient-to-br from-slate-50 via-white to-sky-50/30 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-sky-100 text-sky-700 border border-sky-200 flex items-center justify-center font-bold text-base shrink-0 shadow-2xs">
            {doctor.avatarUrl ? (
              <img
                src={doctor.avatarUrl}
                alt={doctor.name}
                className="w-full h-full object-cover rounded-xl"
              />
            ) : (
              <Stethoscope className="w-6 h-6 text-sky-700" />
            )}
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h5 className="text-sm font-extrabold text-slate-900">
                {doctor.name}
              </h5>
              <span className="text-[10px] font-bold bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full border border-sky-200">
                {doctor.experienceYears} Years Clinical Exp
              </span>
            </div>
            <div className="text-xs font-semibold text-sky-900">
              {doctor.role} · {doctor.specialty}
            </div>
            <div className="text-[11px] text-slate-600">
              {doctor.qualifications}
            </div>
            <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1 pt-0.5">
              <FileBadge className="w-3 h-3 text-emerald-600" />
              <span>Medical Registration: <strong>{doctor.registrationNumber}</strong></span>
            </div>
          </div>
        </div>

        {doctor.onDutyShift && (
          <div className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-right text-[11px] shrink-0 shadow-2xs">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Shift Status</span>
            <span className="font-semibold text-emerald-700">● {doctor.onDutyShift}</span>
          </div>
        )}
      </div>

      {/* Treatment Team & Procedure Room Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        {/* Confirmed Procedure / Room */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
          <div className="font-bold text-slate-800 flex items-center gap-1.5">
            <BedDouble className="w-3.5 h-3.5 text-sky-600" />
            <span>Designated Emergency Bay & Triage</span>
          </div>
          <div className="text-xs font-mono font-bold text-sky-900 bg-white border border-sky-200 p-2 rounded-lg">
            {procedure?.assignedBayOrRoom || 'Trauma Resuscitation Bay 3 (Pre-Allocated)'}
          </div>
          <div className="text-[11px] text-slate-600">
            Triage Priority: <strong className="text-rose-700">{procedure?.triageLevel || 'Level 1 - Immediate Resuscitation'}</strong>
          </div>
          {procedure?.preparedEquipment && (
            <div className="text-[10px] text-slate-500 pt-1">
              Standby Equipment: {procedure.preparedEquipment.join(', ')}
            </div>
          )}
        </div>

        {/* Assigned Treatment Team */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
          <div className="font-bold text-slate-800 flex items-center gap-1.5">
            <HeartHandshake className="w-3.5 h-3.5 text-sky-600" />
            <span>Emergency Team on Standby</span>
          </div>
          <div className="space-y-1">
            {(treatmentTeam || hospital?.treatmentTeam || [
              { name: doctor.name, role: 'Lead Resuscitation Specialist', specialty: doctor.specialty },
              { name: 'Dr. Priya Swaminathan', role: 'Attending Physician', specialty: 'Acute Care Triage' },
              { name: 'Nurse Ankit Rao, B.Sc', role: 'Critical Care Lead', specialty: 'Advanced Airway Access' },
            ]).map((member, idx) => (
              <div
                key={idx}
                className="bg-white border border-slate-200 px-2.5 py-1 rounded-md text-[11px] flex items-center justify-between"
              >
                <span className="font-semibold text-slate-800">{member.name}</span>
                <span className="text-[10px] text-slate-500">{member.role}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
