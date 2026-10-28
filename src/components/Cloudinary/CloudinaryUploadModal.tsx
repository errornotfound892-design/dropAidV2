import React, { useState, useEffect } from 'react';
import { Upload, X, Check, Image as ImageIcon, FileText, Shield, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import { BookingDocument } from '../../types/index.ts';

interface CloudinaryUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: (doc: BookingDocument) => void;
  onAssetUploaded?: (asset: { url: string; publicId: string; source: string; name: string }) => void;
  targetCategory?: 'id_card' | 'insurance' | 'medical_history' | 'incident_photo' | 'hospital_photo' | 'driver_photo' | 'ambulance_photo';
  entityId?: string;
  title?: string;
}

export const CloudinaryUploadModal: React.FC<CloudinaryUploadModalProps> = ({
  isOpen,
  onClose,
  onUploadComplete,
  onAssetUploaded,
  targetCategory = 'insurance',
  entityId,
  title = 'Upload Medical Document / Asset',
}) => {
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<number>(0);
  const [fileMime, setFileMime] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>(targetCategory);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cloudConfig, setCloudConfig] = useState<{ isConfigured: boolean; cloudName: string; mode: string } | null>(null);

  useEffect(() => {
    setSelectedCategory(targetCategory);
    setFilePreview(null);
    setFileName('');
    setFileSize(0);
    setErrorMsg(null);

    // Fetch cloud config status
    fetch('/api/cloudinary/config')
      .then((res) => res.json())
      .then((data) => setCloudConfig(data))
      .catch(() => setCloudConfig(null));
  }, [targetCategory, isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
      if (!validTypes.includes(file.type)) {
        setErrorMsg('Invalid file format. Please upload a JPEG, PNG, WEBP, or PDF.');
        return;
      }

      // Validate size (max 20MB)
      if (file.size > 20 * 1024 * 1024) {
        setErrorMsg('File exceeds 20MB maximum allowable size.');
        return;
      }

      setFileName(file.name);
      setFileSize(file.size);
      setFileMime(file.type);
      setErrorMsg(null);

      const reader = new FileReader();
      reader.onload = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!filePreview) {
      setErrorMsg('Please select a file to upload.');
      return;
    }

    setIsUploading(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/cloudinary/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: filePreview,
          folder: `dropaid_${selectedCategory}`,
          fileName: fileName.replace(/\.[^/.]+$/, ''),
          resourceType: fileMime.startsWith('image/') ? 'image' : 'auto',
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || `Upload failed with status ${response.status}`);
      }

      const returnedUrl = data.secure_url || filePreview;
      const returnedPublicId = data.public_id || `dropaid_${Date.now()}`;
      const source = data.source || 'cloudinary_live';

      if (onAssetUploaded) {
        onAssetUploaded({
          url: returnedUrl,
          publicId: returnedPublicId,
          source,
          name: fileName,
        });
      }

      if (onUploadComplete) {
        const newDoc: BookingDocument = {
          id: `doc-${Date.now()}`,
          name: fileName,
          type: (['id_card', 'insurance', 'medical_history', 'incident_photo'].includes(selectedCategory)
            ? selectedCategory
            : 'incident_photo') as any,
          url: returnedUrl,
          publicId: returnedPublicId,
          uploadedAt: new Date().toISOString(),
          source: source as any,
          bytes: fileSize,
        };
        onUploadComplete(newDoc);
      }

      onClose();
    } catch (err: any) {
      console.error('Cloudinary upload failure:', err);
      setErrorMsg(err.message || 'Cloudinary upload failed. Check network or credentials.');
    } finally {
      setIsUploading(false);
    }
  };

  const isHospitalOrDriver = ['hospital_photo', 'driver_photo', 'ambulance_photo'].includes(selectedCategory);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-sky-600" />
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {/* Cloudinary Integration Status Pill */}
          <div className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-sky-50 border border-sky-100 text-sky-900">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-600 shrink-0" />
              <span>
                <strong>Cloudinary Storage:</strong>{' '}
                {cloudConfig?.isConfigured
                  ? `Active CDN (${cloudConfig.cloudName}) · Secure Signed Delivery`
                  : 'Active Local Fallback · Ready for Cloudinary Keys'}
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold uppercase bg-white border border-sky-200 px-2 py-0.5 rounded">
              {cloudConfig?.mode || 'Validated'}
            </span>
          </div>

          {/* Category Selector (If not pre-locked to hospital or driver) */}
          {!isHospitalOrDriver ? (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                Category
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('insurance')}
                  className={`p-2.5 rounded-lg border text-left font-medium transition-colors cursor-pointer ${
                    selectedCategory === 'insurance'
                      ? 'border-sky-600 bg-sky-50 text-sky-900'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  Health Insurance Card
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('id_card')}
                  className={`p-2.5 rounded-lg border text-left font-medium transition-colors cursor-pointer ${
                    selectedCategory === 'id_card'
                      ? 'border-sky-600 bg-sky-50 text-sky-900'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  Government Photo ID
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('medical_history')}
                  className={`p-2.5 rounded-lg border text-left font-medium transition-colors cursor-pointer ${
                    selectedCategory === 'medical_history'
                      ? 'border-sky-600 bg-sky-50 text-sky-900'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  Medical Summary / Rx
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('incident_photo')}
                  className={`p-2.5 rounded-lg border text-left font-medium transition-colors cursor-pointer ${
                    selectedCategory === 'incident_photo'
                      ? 'border-sky-600 bg-sky-50 text-sky-900'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  Incident Scene Photo
                </button>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              Target Entity: <span className="font-bold text-slate-900 capitalize">{selectedCategory.replace(/_/g, ' ')}</span>
              {entityId && <span className="text-slate-400 font-mono ml-1.5">({entityId})</span>}
            </div>
          )}

          {/* Upload Dropzone */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              File Selection
            </label>
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors">
              {filePreview ? (
                <div className="space-y-3">
                  <div className="relative max-h-48 overflow-hidden rounded-lg mx-auto max-w-xs border border-slate-200 bg-slate-900">
                    <img
                      src={filePreview}
                      alt="Preview"
                      className="w-full h-auto object-cover max-h-48 mx-auto"
                    />
                  </div>
                  <div className="text-xs text-slate-600 font-medium">
                    {fileName} ({(fileSize / 1024).toFixed(1)} KB)
                  </div>
                  <label className="inline-flex items-center gap-1.5 text-xs text-sky-600 hover:text-sky-700 font-semibold cursor-pointer">
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Choose Different File</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center cursor-pointer">
                  <Upload className="w-8 h-8 text-slate-400 mb-2" />
                  <span className="text-sm font-semibold text-slate-800">
                    Click to browse or drag file here
                  </span>
                  <span className="text-xs text-slate-500 mt-1">
                    Supports JPG, PNG, WEBP, PDF up to 20MB
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {errorMsg && (
            <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-lg font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!filePreview || isUploading}
            className={`px-5 py-2 text-xs font-bold text-white rounded-lg shadow-sm flex items-center gap-1.5 transition-all cursor-pointer ${
              !filePreview || isUploading
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-sky-600 hover:bg-sky-700'
            }`}
          >
            {isUploading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Uploading to Cloudinary...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Upload & Deliver</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
