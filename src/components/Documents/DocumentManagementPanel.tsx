import React, { useState } from 'react';
import { BookingDocument } from '../../types/index.ts';
import {
  FileText,
  Upload,
  Shield,
  CheckCircle2,
  Lock,
  Eye,
  Trash2,
  Calendar,
  AlertCircle,
  FileCheck,
  Sparkles,
  ExternalLink,
  Layers,
  Clock
} from 'lucide-react';

interface DocumentManagementPanelProps {
  documents: BookingDocument[];
  onOpenUpload?: (category: 'id_card' | 'insurance' | 'medical_history' | 'incident_photo', stage?: 'pre_dispatch' | 'in_transit' | 'hospital_handoff' | 'post_treatment') => void;
  onUploadDocument?: (file: File, stage: 'pre_dispatch' | 'in_transit' | 'hospital_handoff' | 'post_treatment', type: 'id_card' | 'insurance' | 'medical_history' | 'prescription' | 'incident_photo') => void | Promise<void>;
  onDeleteDocument?: (docId: string) => void;
  bookingId?: string;
}

export const DocumentManagementPanel: React.FC<DocumentManagementPanelProps> = ({
  documents,
  onOpenUpload,
  onUploadDocument,
  onDeleteDocument,
  bookingId,
}) => {
  const [activeStageFilter, setActiveStageFilter] = useState<'all' | 'pre_dispatch' | 'in_transit' | 'hospital_handoff' | 'post_treatment'>('all');
  const [selectedPreviewDoc, setSelectedPreviewDoc] = useState<BookingDocument | null>(null);
  const [consentGranted, setConsentGranted] = useState<boolean>(true);
  const [retentionDays, setRetentionDays] = useState<'30_days' | '90_days' | '1_year'>('30_days');

  const STAGES: {
    id: 'pre_dispatch' | 'in_transit' | 'hospital_handoff' | 'post_treatment';
    label: string;
    description: string;
  }[] = [
    { id: 'pre_dispatch', label: '1. Pre-Dispatch', description: 'Govt Photo ID & Health Insurance Cards' },
    { id: 'in_transit', label: '2. In-Transit', description: 'Past Prescriptions & Incident Photos' },
    { id: 'hospital_handoff', label: '3. Hospital Handoff', description: 'Paramedic Run Sheet & ER Triage Slip' },
    { id: 'post_treatment', label: '4. Post-Treatment', description: 'Discharge Summary & Medical Invoices' },
  ];

  const filteredDocs = documents.filter((doc) => {
    if (activeStageFilter === 'all') return true;
    const docStage = doc.treatmentStage || 'pre_dispatch';
    return docStage === activeStageFilter;
  });

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-sky-50 rounded-xl text-sky-700 border border-sky-100">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Medical Document Management</span>
              <span className="text-[10px] font-mono uppercase bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                Cloudinary CDN Encrypted
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Upload and manage medical reports, prescriptions, insurance, and photo ID organized by treatment stage.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onOpenUpload?.('insurance', activeStageFilter === 'all' ? 'pre_dispatch' : activeStageFilter)}
          className="text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 px-3.5 py-2 rounded-xl transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload Document</span>
        </button>
      </div>

      {/* Stage Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <button
          type="button"
          onClick={() => setActiveStageFilter('all')}
          className={`px-3 py-1.5 rounded-lg border font-semibold transition-colors cursor-pointer shrink-0 ${
            activeStageFilter === 'all'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
          }`}
        >
          All Stages ({documents.length})
        </button>

        {STAGES.map((s) => {
          const count = documents.filter((d) => (d.treatmentStage || 'pre_dispatch') === s.id).length;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveStageFilter(s.id)}
              className={`px-3 py-1.5 rounded-lg border font-semibold transition-colors cursor-pointer shrink-0 ${
                activeStageFilter === s.id
                  ? 'bg-sky-600 text-white border-sky-600'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <span>{s.label}</span>
              <span className="ml-1.5 opacity-75 font-mono">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Document Access Controls & Consent Bar */}
      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={consentGranted}
            onChange={(e) => setConsentGranted(e.target.checked)}
            className="w-4 h-4 rounded text-sky-600 border-slate-300 focus:ring-sky-500 cursor-pointer"
          />
          <span className="text-slate-700 text-xs font-medium">
            <strong>Consent Granted:</strong> Transmit documents strictly to verified ER team and assigned paramedics
          </span>
        </label>

        <div className="flex items-center gap-2 text-[11px] text-slate-600">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span>Retention Period:</span>
          <select
            value={retentionDays}
            onChange={(e) => setRetentionDays(e.target.value as any)}
            className="text-[11px] font-semibold bg-white border border-slate-300 rounded px-2 py-0.5"
          >
            <option value="30_days">30 Days (Emergency Standard)</option>
            <option value="90_days">90 Days (Extended Care)</option>
            <option value="1_year">1 Year (Long-term Medical)</option>
          </select>
        </div>
      </div>

      {/* Document List Grid */}
      {filteredDocs.length === 0 ? (
        <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl space-y-2">
          <FileText className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-xs font-semibold text-slate-700">No documents in this treatment stage yet.</p>
          <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
            Attach health insurance cards, doctor prescriptions, identification proof, or diagnostic reports to streamline hospital ER admission.
          </p>
          <button
            type="button"
            onClick={() => onOpenUpload?.('insurance', activeStageFilter === 'all' ? 'pre_dispatch' : activeStageFilter)}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg border border-sky-200 cursor-pointer transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload to {activeStageFilter === 'all' ? 'Pre-Dispatch' : STAGES.find((s) => s.id === activeStageFilter)?.label}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredDocs.map((doc) => (
            <div
              key={doc.id}
              className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-sky-300 transition-all shadow-2xs space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700 shrink-0">
                    <FileCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h5 className="text-xs font-bold text-slate-900 truncate" title={doc.name}>
                      {doc.name}
                    </h5>
                    <span className="text-[10px] uppercase font-mono font-bold text-slate-500">
                      {doc.type.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                {onDeleteDocument && (
                  <button
                    type="button"
                    onClick={() => onDeleteDocument(doc.id)}
                    className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                    title="Remove document"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Treatment Stage & Verification Badge */}
              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                <span className="font-semibold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded">
                  {STAGES.find((s) => s.id === (doc.treatmentStage || 'pre_dispatch'))?.label || 'Pre-Dispatch'}
                </span>
                <span className="font-mono">
                  {doc.bytes ? `${(doc.bytes / 1024).toFixed(0)} KB` : 'Cloudinary Delivery'}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="pt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPreviewDoc(doc)}
                  className="flex-1 py-1 px-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <Eye className="w-3 h-3 text-slate-500" />
                  <span>Preview</span>
                </button>
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-1 px-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                  title="Open original file"
                >
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Document Preview Lightbox Modal */}
      {selectedPreviewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-4 space-y-3 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-600" />
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                  {selectedPreviewDoc.name}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPreviewDoc(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[60vh] overflow-auto flex items-center justify-center bg-slate-100 rounded-xl p-2">
              {selectedPreviewDoc.url.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i) || selectedPreviewDoc.url.startsWith('data:image') ? (
                <img
                  src={selectedPreviewDoc.url}
                  alt={selectedPreviewDoc.name}
                  className="max-h-[55vh] object-contain rounded-lg"
                />
              ) : (
                <iframe
                  src={selectedPreviewDoc.url}
                  title={selectedPreviewDoc.name}
                  className="w-full h-[55vh] rounded-lg bg-white"
                />
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
              <span className="text-[11px]">
                Uploaded: {new Date(selectedPreviewDoc.uploadedAt).toLocaleString()}
              </span>
              <a
                href={selectedPreviewDoc.url}
                download={selectedPreviewDoc.name}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-sky-600 text-white rounded-lg font-bold text-xs hover:bg-sky-700 transition-colors cursor-pointer"
              >
                Download Document
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Security notice */}
      <div className="text-[10px] text-slate-400 flex items-center gap-1.5 pt-1">
        <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span>
          Access strictly restricted to authenticated emergency attendants and receiving ER departments. Data retained for {retentionDays.replace('_', ' ')}.
        </span>
      </div>
    </div>
  );
};
