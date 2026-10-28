import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  MessageSquare,
  X,
  Send,
  AlertTriangle,
  PhoneCall,
  ShieldAlert,
  Building2,
  FileText,
  CheckCircle2,
  RotateCcw,
  Bot,
  User,
  HeartPulse,
  Smile,
  Activity,
  ArrowRight,
  Shield
} from 'lucide-react';
import { Hospital, LatLng, PatientProfile, EmergencyCategory } from '../../types/index.ts';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  category?: EmergencyCategory;
  recommendedHospitalId?: string;
  recommendedHospitalName?: string;
  suggestedNotes?: string;
  requiredDocuments?: string[];
  isEmergencyAlert?: boolean;
}

interface FloatingAIAssistantProps {
  pickupCoords: LatLng;
  pickupAddress: string;
  hospitals: Hospital[];
  patientProfile: PatientProfile;
  onSelectHospital: (hospital: Hospital) => void;
  onApplyCategory: (category: EmergencyCategory) => void;
  onApplyEmergencyNotes?: (notes: string) => void;
}

export const FloatingAIAssistant: React.FC<FloatingAIAssistantProps> = ({
  pickupCoords,
  pickupAddress,
  hospitals,
  patientProfile,
  onSelectHospital,
  onApplyCategory,
  onApplyEmergencyNotes,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Hello, I'm the DropAid Emergency AI Assistant. Describe what symptoms or emergency you are experiencing in plain words (e.g. chest pain, dental injury, accident, high fever).

I will identify the appropriate emergency specialty, recommend the best nearby hospital with verified capacity, and explain what documents you'll need.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (userText: string) => {
    if (!userText.trim() || isLoading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: userText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.text,
          userLocation: {
            lat: pickupCoords.lat,
            lng: pickupCoords.lng,
            address: pickupAddress,
          },
          patientProfile: {
            name: patientProfile.name,
            bloodType: patientProfile.bloodType,
            allergies: patientProfile.allergies,
            medicalConditions: patientProfile.medicalConditions,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Assistant API temporary network delay');
      }

      const data = await response.json();

      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: data.reply || 'Thank you. I have analyzed your situation.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        category: data.identifiedCategory,
        recommendedHospitalId: data.recommendedHospitalId,
        recommendedHospitalName: data.recommendedHospitalName,
        suggestedNotes: data.suggestedNotes,
        requiredDocuments: data.requiredDocuments,
        isEmergencyAlert: data.isEmergency,
      };

      setMessages((prev) => [...prev, aiMsg]);

      // If category was identified, automatically update category in parent
      if (data.identifiedCategory) {
        onApplyCategory(data.identifiedCategory);
      }
    } catch (err: any) {
      // Robust client fallback with medical rules
      console.warn('AI API fallback to local triage matcher:', err);
      const textLower = userMsg.text.toLowerCase();

      let detectedCat: EmergencyCategory = 'general';
      let recHospId = hospitals[0]?.id;
      let recHospName = hospitals[0]?.name;
      let documents = ['Government Photo ID (Aadhaar/Passport)', 'Health Insurance Card / Policy'];

      if (textLower.includes('chest') || textLower.includes('heart') || textLower.includes('stemi') || textLower.includes('arm pain')) {
        detectedCat = 'cardiac';
        const cardHosp = hospitals.find((h) => h.traumaLevel === 'Cardiac Center') || hospitals[2];
        recHospId = cardHosp.id;
        recHospName = cardHosp.name;
        documents.push('Previous ECG / Cardiac records', 'Current blood-thinner prescriptions');
      } else if (textLower.includes('tooth') || textLower.includes('teeth') || textLower.includes('dental') || textLower.includes('jaw') || textLower.includes('mouth')) {
        detectedCat = 'dental';
        const dentalHosp = hospitals.find((h) => h.dentalFacilities && h.dentalFacilities.length > 0) || hospitals[3];
        recHospId = dentalHosp.id;
        recHospName = dentalHosp.name;
        documents.push('Dental history (if available)', 'Keep knocked-out tooth in cold milk or saliva');
      } else if (textLower.includes('accident') || textLower.includes('bleed') || textLower.includes('fracture') || textLower.includes('bone') || textLower.includes('crash')) {
        detectedCat = 'trauma';
        const traumaHosp = hospitals.find((h) => h.traumaLevel === 'Level 1') || hospitals[0];
        recHospId = traumaHosp.id;
        recHospName = traumaHosp.name;
        documents.push('Incident scene details', 'Blood group documentation');
      } else if (textLower.includes('child') || textLower.includes('baby') || textLower.includes('infant') || textLower.includes('pediatric')) {
        detectedCat = 'pediatric';
        const pedHosp = hospitals.find((h) => h.specialties.some((s) => s.toLowerCase().includes('pediatric'))) || hospitals[1];
        recHospId = pedHosp.id;
        recHospName = pedHosp.name;
        documents.push('Child vaccination card', 'Pediatric birth/medical records');
      }

      onApplyCategory(detectedCat);

      const fallbackMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: `Based on your description, this is evaluated as a **${detectedCat.toUpperCase()} EMERGENCY**.

🚨 **Immediate Step:** Please keep calm and call 112 if condition worsens rapidly.
🏥 **Recommended Hospital:** **${recHospName}**, which specializes in ${detectedCat} emergencies.
📋 **Documents Needed:** ${documents.join(', ')}.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        category: detectedCat,
        recommendedHospitalId: recHospId,
        recommendedHospitalName: recHospName,
        requiredDocuments: documents,
        isEmergencyAlert: true,
      };

      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const QUICK_PROMPTS = [
    { label: 'Chest pain & breathing issues', text: 'I am feeling severe crushing chest pain, tightness radiating to my left arm, and shortness of breath.' },
    { label: 'Broken tooth / Dental bleeding', text: 'Severe dental trauma from a fall, knocked-out front tooth with heavy mouth bleeding.' },
    { label: 'Accident / Severe bleeding', text: 'Motor vehicle accident, deep bleeding wound on leg and possible bone fracture.' },
    { label: 'Child high fever & seizure', text: 'My child has a high fever with sudden twitching and difficulty breathing.' },
    { label: 'What documents should I prepare?', text: 'What medical documents and insurance cards do I need ready before the ambulance arrives?' },
  ];

  return (
    <>
      {/* Floating Launcher Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="relative group p-3.5 sm:p-4 bg-slate-900 hover:bg-slate-800 text-white rounded-full shadow-2xl transition-all duration-300 hover:scale-105 cursor-pointer flex items-center justify-center border border-slate-700"
          title="Open DropAid Emergency AI Triage Assistant"
          aria-label="Open AI Assistant"
        >
          {/* Ambient Glow Pulse */}
          <div className="absolute -inset-1 rounded-full bg-sky-500/30 blur-md group-hover:bg-sky-500/50 transition-all pointer-events-none animate-pulse" />
          
          <div className="relative flex items-center justify-center">
            {isOpen ? (
              <X className="w-6 h-6 text-white" />
            ) : (
              <>
                <Sparkles className="w-6 h-6 text-sky-400" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-slate-900 animate-ping" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-slate-900" />
              </>
            )}
          </div>
        </button>
      </div>

      {/* Floating Assistant Modal / Drawer */}
      {isOpen && (
        <div className="fixed bottom-22 right-4 sm:right-6 z-40 w-[94vw] max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col h-[580px] max-h-[80vh] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center">
                <Bot className="w-4 h-4 text-sky-400" />
              </div>
              <div>
                <h3 className="text-xs font-bold flex items-center gap-1.5">
                  <span>DropAid Emergency AI Triage</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                </h3>
                <p className="text-[10px] text-slate-300">
                  Natural Language Triage & Hospital Recommender
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Emergency Warning & 112 Hotline Banner */}
          <div className="bg-rose-50 border-b border-rose-200 p-2.5 px-3 shrink-0 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <div className="text-[11px] text-rose-900 leading-tight">
                <strong>Not a diagnosis.</strong> In life-threatening emergencies, call immediately.
              </div>
            </div>
            <a
              href="tel:112"
              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[11px] rounded-md transition-colors shrink-0 flex items-center gap-1 shadow-2xs"
            >
              <PhoneCall className="w-3 h-3" />
              <span>Call 112</span>
            </a>
          </div>

          {/* Chat Messages Scrollable Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs bg-slate-50/50">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.sender === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 mt-0.5 border border-sky-200">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-3 shadow-2xs space-y-2 ${
                    m.sender === 'user'
                      ? 'bg-slate-900 text-white rounded-br-xs'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                  }`}
                >
                  <p className="whitespace-pre-line leading-relaxed text-xs">
                    {m.text}
                  </p>

                  {/* Interactive Facility Switch Card */}
                  {m.recommendedHospitalId && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-sky-50 border border-sky-200 space-y-2">
                      <div className="flex items-center gap-1.5 text-sky-900 font-bold text-[11px]">
                        <Building2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                        <span>Recommended Hospital:</span>
                      </div>
                      <div className="font-bold text-slate-900 text-xs">
                        {m.recommendedHospitalName}
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            const target = hospitals.find((h) => h.id === m.recommendedHospitalId);
                            if (target) {
                              onSelectHospital(target);
                              if (m.category) onApplyCategory(m.category);
                            }
                          }}
                          className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-bold text-[11px] shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <span>Set Destination & Route</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>

                        {m.suggestedNotes && onApplyEmergencyNotes && (
                          <button
                            type="button"
                            onClick={() => onApplyEmergencyNotes(m.suggestedNotes!)}
                            className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer"
                          >
                            Add to Booking Notes
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Required Documents Checklist Card */}
                  {m.requiredDocuments && m.requiredDocuments.length > 0 && (
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] space-y-1">
                      <div className="font-bold text-slate-700 flex items-center gap-1">
                        <FileText className="w-3 h-3 text-sky-600" />
                        <span>Recommended Paperwork to Prepare:</span>
                      </div>
                      <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                        {m.requiredDocuments.map((doc, i) => (
                          <li key={i}>{doc}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <span className={`text-[9px] block text-right font-mono ${m.sender === 'user' ? 'text-slate-400' : 'text-slate-400'}`}>
                    {m.timestamp}
                  </span>
                </div>

                {m.sender === 'user' && (
                  <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2 items-center text-xs text-slate-500 bg-white p-3 rounded-xl border border-slate-200 w-fit">
                <Sparkles className="w-3.5 h-3.5 text-sky-600 animate-spin" />
                <span>Evaluating symptoms, proximity & ER availability...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Scenario Chips */}
          <div className="p-2 bg-white border-t border-slate-100 shrink-0">
            <div className="flex gap-1.5 overflow-x-auto pb-1 text-[11px] scrollbar-none">
              {QUICK_PROMPTS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleSendMessage(p.text)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full whitespace-nowrap transition-colors cursor-pointer shrink-0 font-medium"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputMessage);
            }}
            className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Describe symptoms or medical need..."
              disabled={isLoading}
              className="flex-1 text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent bg-slate-50 text-slate-900"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || isLoading}
              className="p-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-xl transition-colors cursor-pointer shadow-xs shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          {/* Privacy Safeguard Disclaimer */}
          <div className="bg-slate-50 border-t border-slate-100 px-3 py-1.5 text-[9px] text-slate-400 flex items-center justify-between shrink-0">
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-emerald-600" />
              <span>Inputs processed strictly for dispatch triage. No commercial storage.</span>
            </span>
            <span className="font-mono">DropAid v3 AI</span>
          </div>
        </div>
      )}
    </>
  );
};
