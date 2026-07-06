'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Send, LogOut, Mic, Plus, X, FileText, Camera, Image as ImageIcon } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────
type MessageType = 'user' | 'ai' | 'badge' | 'translation' | 'progress' | 'rag_trace' | 'diagnosis_card';

interface ChatMessage {
  id: string;
  type: MessageType;
  content: string;
  timestamp: Date;
  translationOriginal?: string;
  translationResult?: string;
  diagnosisData?: RegionalRoute;
}

interface RegionalRoute {
  phcName: string;
  location: string;
  workerName: string;
  workerPhone: string;
}

// ─── Particle class ──────────────────────────────────────────────────
class Particle {
  x: number; y: number; size: number; speedX: number; speedY: number; alpha: number;
  constructor(w: number, h: number) {
    this.x = Math.random() * w; this.y = Math.random() * h;
    this.size = Math.random() * 2 + 0.5;
    this.speedX = Math.random() * 0.4 - 0.2; this.speedY = Math.random() * 0.4 - 0.2;
    this.alpha = Math.random() * 0.4 + 0.1;
  }
  update(w: number, h: number) {
    this.x += this.speedX; this.y += this.speedY;
    if (this.x < 0 || this.x > w) this.speedX *= -1;
    if (this.y < 0 || this.y > h) this.speedY *= -1;
  }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = `rgba(255,255,255,${this.alpha})`;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
  }
}

// ─── Regional routing data ──────────────────────────────────────────
const regionalDataMap: Record<string, RegionalRoute> = {
  Hindi: {
    phcName: 'Sanjay Gandhi Regional PHC Sub-Centre',
    location: 'Sector 4, Near Community Hub, Lucknow, UP',
    workerName: 'Anita Devi (Senior ASHA)',
    workerPhone: '+91 98451 23091',
  },
  Bhojpuri: {
    phcName: 'Bhojpur Zonal Primary Health Centre',
    location: 'Station Road, Opp. Civil Hospital, Ara, Bihar',
    workerName: 'Sunita Rai (Community ASHA)',
    workerPhone: '+91 97420 11843',
  },
  English: {
    phcName: 'National Urban Health PHC Facility',
    location: '7th Main, KHB Colony, Koramangala, Bengaluru, Karnataka',
    workerName: 'Sister Mary D\'Souza (ASHA Lead)',
    workerPhone: '+91 99002 44512',
  },
};

// ─── Workflow locale messages ───────────────────────────────────────
const getWorkflowLocales = (name: string): Record<string, Record<number, string>> => ({
  English: {
    1: `Namaste, ${name} 👋\nI am Nirog-Setu AI, your multi-agent health intelligence companion.\nPlease describe any health challenges or physical symptoms you are currently experiencing.`,
    2: "Based on your symptom profile, this requires immediate, closer evaluation. Please upload any recent chest X-ray images or corresponding clinical reports using the '+' configuration option below so our specialized image node can parse it.",
    3: 'Analyzing X-ray context...',
  },
  Hindi: {
    1: `नमस्ते, ${name} 👋\nमैं निरोग-सेतु AI हूँ, आपका स्वास्थ्य इंटेलिजेंस सहायक।\nकृपया मुझे बताएं कि आपको क्या शारीरिक लक्षण या स्वास्थ्य संबंधी समस्याएं महसूस हो रही हैं?`,
    2: "आपके लक्षणों को देखते हुए, इस स्थिति की तुरंत जांच की आवश्यकता है। कृपया नीचे दिए गए '+' बटन का उपयोग करके अपना चेस्ट एक्स-रे (Chest X-ray) या मेडिकल रिपोर्ट अपलोड करें ताकि हमारे इमेज नोड इसका विश्लेषण कर सकें।",
    3: 'एक्स-रे का विश्लेषण किया जा रहा है...',
  },
  Bhojpuri: {
    1: `नमस्ते, ${name} 👋\nहम निरोग-सेतु AI बानी, रउआ स्वास्थ्य सहायक।\nरउआ के का तकलीफ बा? कृपया बोल के बताइब।`,
    2: "रउआ लक्षण देख के लगत बा कि एकर तुरंत जांच होखे के चाहीं। नीचे दिहल गइल '+' बटन दबाके आपन चेस्ट एक्स-रे या कवनो डॉक्टरी कागज अपलोड करीं ताकि नोड एकर जांच कर सके।",
    3: 'एक्स-रे के जांच हो रहल बा...',
  },
});

// ─── Component ───────────────────────────────────────────────────────
export default function ChatPage() {
  const { user, logout } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const [dispatchCount, setDispatchCount] = useState('1,824');
  const [toast, setToast] = useState<{ visible: boolean; phone: string }>({ visible: false, phone: '' });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const initializedRef = useRef(false);
  const animRef = useRef<number>(0);
  const currentStepRef = useRef(1);
  const photoPickerRef = useRef<HTMLInputElement>(null);
  const filePickerRef = useRef<HTMLInputElement>(null);
  const xrayPickerRef = useRef<HTMLInputElement>(null);

  // Patient info from localStorage (or defaults)
  const [patientName, setPatientName] = useState('Niha');
  const [patientLang, setPatientLang] = useState('Hindi');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPatientName(localStorage.getItem('ns_patient_name') || 'Niha');
      setPatientLang(localStorage.getItem('ns_patient_lang') || 'Hindi');
    }
  }, []);

  const workflowLocales = getWorkflowLocales(patientName);

  // ── Particle animation ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    particlesRef.current = Array.from({ length: 60 }, () => new Particle(canvas.width, canvas.height));
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particlesRef.current.forEach((p) => { p.update(canvas.width, canvas.height); p.draw(ctx); });
      animRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(animRef.current); };
  }, []);

  // ── Auto-scroll ──
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, showProgress]);

  // ── Speech recognition setup ──
  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.lang = patientLang === 'Hindi' ? 'hi-IN' : patientLang === 'Bhojpuri' ? 'hi-IN' : 'en-US';
      recognition.interimResults = false;
      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        if (text) setInput(text);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  }, [patientLang]);

  // (menu closes via backdrop overlay, no document listener needed)

  // ── Toast auto-dismiss ──
  useEffect(() => {
    if (!toast.visible) return;
    const t = setTimeout(() => setToast({ visible: false, phone: '' }), 4500);
    return () => clearTimeout(t);
  }, [toast.visible]);

  // ── Helper: generate unique id ──
  const uid = () => Date.now().toString() + Math.random().toString(36).slice(2);

  // ── Helpers ──
  const appendMessage = useCallback((type: MessageType, content: string, extra?: Partial<ChatMessage>) => {
    setMessages((prev) => [...prev, { id: uid(), type, content, timestamp: new Date(), ...extra }]);
  }, []);

  const appendBadge = useCallback((text: string) => {
    appendMessage('badge', text);
  }, [appendMessage]);

  const appendBhashiniTranslation = useCallback((original: string, translated: string) => {
    setMessages((prev) => [...prev, {
      id: uid(),
      type: 'translation',
      content: '',
      timestamp: new Date(),
      translationOriginal: original,
      translationResult: translated,
    }]);
  }, []);

  const triggerAiResponse = useCallback((customText: string | null = null) => {
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      const step = currentStepRef.current;
      if (step === 2) {
        appendBadge('Triage-Agent Routed Query');
      }
      const message = customText || workflowLocales[patientLang]?.[step] || 'Please share further context.';
      appendMessage('ai', message);
    }, 1200);
  }, [appendBadge, appendMessage, patientLang, workflowLocales]);

  // ── Render AlloyDB trace + diagnosis card after progress ──
  const renderAlloyDbTraceAndDiagnosis = useCallback(() => {
    appendBadge('Vertex AI Vision & Gemini 2.0 Multimodal Execution Layer Active');
    appendMessage('rag_trace', '');

    setTimeout(() => {
      appendBadge('Diagnose-Agent Finished Logic Processing • AlloyDB RAG Grounding Verified');
      const activeRoute = regionalDataMap[patientLang] || regionalDataMap['English'];
      setMessages((prev) => [...prev, {
        id: uid(),
        type: 'diagnosis_card',
        content: '',
        timestamp: new Date(),
        diagnosisData: activeRoute,
      }]);
      // Update dispatch counter and show toast
      setDispatchCount('1,825');
      setToast({ visible: true, phone: activeRoute.workerPhone });
    }, 1000);
  }, [appendBadge, appendMessage, patientLang]);

  // ── Submit handler ──
  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      const val = input.trim();
      if (!val) return;
      appendMessage('user', val);
      setInput('');
      setAttachMenuOpen(false);

      if (currentStepRef.current === 1) {
        currentStepRef.current = 2;
        if (patientLang !== 'English') {
          setTimeout(() => {
            appendBhashiniTranslation(val, 'I have had a bad cough and fever for three weeks, and I am coughing up blood.');
            triggerAiResponse(null);
          }, 500);
        } else {
          triggerAiResponse(null);
        }
      } else {
        triggerAiResponse("Thank you. Please use the '+' attachment menu to upload your diagnostic file to proceed.");
      }
    },
    [input, appendMessage, patientLang, appendBhashiniTranslation, triggerAiResponse],
  );

  // ── File upload handler ──
  const handleFileSelected = useCallback(
    (type: string) => {
      setAttachMenuOpen(false);

      if (type === 'Chest X-ray') {
        appendMessage('user', '🩻 Attached: Patient_Chest_XRay_Report.pdf');
        currentStepRef.current = 3;
        setIsTyping(true);

        setTimeout(() => {
          setIsTyping(false);
          appendMessage('ai', 'File received. Initiating cloud pipeline analysis execution context...');

          // Start progress
          appendBadge('Vertex AI Vision & Gemini 2.0 Multimodal Execution Layer Active');
          setShowProgress(true);
          setProgressValue(0);
          let prog = 0;
          const interval = setInterval(() => {
            prog += 10;
            setProgressValue(prog);
            if (prog >= 100) {
              clearInterval(interval);
              setTimeout(() => {
                setShowProgress(false);
                // Show RAG trace
                appendMessage('rag_trace', '');
                setTimeout(() => {
                  appendBadge('Diagnose-Agent Finished Logic Processing • AlloyDB RAG Grounding Verified');
                  const activeRoute = regionalDataMap[patientLang] || regionalDataMap['English'];
                  setMessages((prev) => [...prev, {
                    id: uid(),
                    type: 'diagnosis_card',
                    content: '',
                    timestamp: new Date(),
                    diagnosisData: activeRoute,
                  }]);
                  setDispatchCount('1,825');
                  setToast({ visible: true, phone: activeRoute.workerPhone });
                }, 1000);
              }, 400);
            }
          }, 200);
        }, 1000);
      } else {
        appendMessage('user', `📎 Attached ${type}`);
        triggerAiResponse('Document uploaded successfully. Please provide your Chest X-ray file for structural evaluation matching.');
      }
    },
    [appendMessage, appendBadge, triggerAiResponse, patientLang],
  );

  // ── Voice toggle ──
  const toggleVoice = useCallback(() => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      // Pre-fill based on language for demo
      if (patientLang === 'Hindi') {
        setInput('मुझे तीन हफ्ते से बहुत तेज खांसी और बुखार है, और थूक में खून आ रहा है।');
      } else if (patientLang === 'Bhojpuri') {
        setInput('हमरा तीन हफ्ता से बहुत तेज खोखी अउर बुखार बा, अउर खोखला पर मुंह से खून गिरत बा।');
      } else {
        setInput('I have had a bad cough and fever for three weeks, and I am coughing up blood.');
      }
      recognitionRef.current.start();
    }
  }, [isListening, patientLang]);

  // ── Logout ──
  const handleLogout = useCallback(() => {
    if (typeof window !== 'undefined') localStorage.clear();
    logout();
  }, [logout]);

  // ── Initial greeting ──
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    triggerAiResponse(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Render helpers ──
  const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ fontFamily: "'Inter', sans-serif", background: '#0a0a0a', color: 'white' }}>
      {/* Aurora + Particles */}
      <div className="fixed inset-0 aurora-bg" style={{ zIndex: -3 }} />
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: -2 }} />

      {/* ── Navigation Header ── */}
      <nav className="glass px-6 py-4 shrink-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-sm">NS</div>
            <div>
              <span className="font-semibold text-base tracking-wider block text-white">Nirog-Setu AI</span>
              <span className="text-xs text-indigo-300 font-medium">Patient: {patientName} ({patientLang})</span>
            </div>
          </div>

          {/* Live Command Center Analytics Ticker */}
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-4 text-right">
              <div>
                <span className="text-[9px] uppercase text-gray-500 tracking-wider block font-bold">Network Nodes</span>
                <span className="text-xs font-bold text-indigo-400 font-mono">142 PHCs Active</span>
              </div>
              <div className="border-l border-white/10 pl-4">
                <span className="text-[9px] uppercase text-gray-500 tracking-wider block font-bold">Dispatches Today</span>
                <span className="text-xs font-bold text-emerald-400 font-mono">{dispatchCount}</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full text-xs text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Medical AI Active
              </div>
              <button
                onClick={handleLogout}
                className="text-xs text-gray-400 hover:text-white border border-white/10 px-3 py-1.5 rounded-lg bg-white/5 transition-all"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Main Workspace Container ── */}
      <main className="flex-grow flex flex-col max-w-4xl w-full mx-auto overflow-hidden relative z-10">
        {/* Message Stream */}
        <div className="flex-grow p-6 overflow-y-auto space-y-6 chat-scroll">
          {messages.map((msg) => {
            // ── System Badge ──
            if (msg.type === 'badge') {
              return (
                <div key={msg.id} className="flex w-full justify-center my-2" style={{ animation: 'fadeIn 0.3s ease-out forwards' }}>
                  <div className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-md shadow-sm">
                    ⚡ SYSTEM CORE: {msg.content}
                  </div>
                </div>
              );
            }

            // ── Bhashini Translation ──
            if (msg.type === 'translation') {
              return (
                <div key={msg.id} className="flex w-full justify-start mb-1" style={{ animation: 'fadeIn 0.3s ease-out forwards' }}>
                  <div className="max-w-[78%] bg-white/5 border border-white/10 px-4 py-2 rounded-xl text-xs text-gray-400 italic">
                    <span className="text-indigo-400 font-semibold not-italic block mb-0.5">
                      🌐 Bhashini translation layer ({patientLang} ➜ English):
                    </span>
                    &ldquo;{msg.translationResult}&rdquo;
                  </div>
                </div>
              );
            }

            // ── AlloyDB RAG Terminal Trace ──
            if (msg.type === 'rag_trace') {
              return (
                <div key={msg.id} className="flex w-full justify-start font-mono text-[11px] mb-2" style={{ animation: 'fadeIn 0.3s ease-out forwards' }}>
                  <div className="w-full max-w-lg bg-black/50 border border-indigo-500/20 p-3 rounded-xl text-gray-400 space-y-1 shadow-md">
                    <div className="text-indigo-400 font-bold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-ping" />&gt;_ ALLOYDB_VECTOR_RECON:
                    </div>
                    <div>[0.02s] Generating structural embeddings for uploaded X-ray slice...</div>
                    <div>[0.08s] Executing vector similarity search against 42,000+ clinical indexes...</div>
                    <div className="text-emerald-400 font-medium">[0.12s] Match found: MOHFW_TB_Protocol_Standard.db (94.2% confidence index)</div>
                  </div>
                </div>
              );
            }

            // ── Diagnosis Card ──
            if (msg.type === 'diagnosis_card' && msg.diagnosisData) {
              const route = msg.diagnosisData;
              return (
                <div key={msg.id} className="flex w-full justify-start" style={{ animation: 'fadeIn 0.3s ease-out forwards' }}>
                  <div className="w-full max-w-lg glass-card border border-red-500/30 rounded-2xl overflow-hidden shadow-2xl">
                    <div className="bg-red-500/10 border-b border-red-500/20 px-6 py-4 flex items-center justify-between">
                      <h4 className="text-red-400 font-bold text-sm tracking-wider uppercase flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" /> Diagnostic Analysis Output
                      </h4>
                      <span className="text-xs text-red-400 font-semibold bg-red-500/20 px-2 py-0.5 rounded">High Severity</span>
                    </div>
                    <div className="p-6 space-y-4 text-sm">
                      <div className="flex justify-between items-start border-b border-white/5 pb-3">
                        <span className="text-gray-400 font-medium shrink-0">Finding Condition</span>
                        <span className="text-red-400 font-bold text-right ml-4">High Probability of Pulmonary TB</span>
                      </div>
                      <div className="flex flex-col border-b border-white/5 pb-3 gap-0.5">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400 font-medium">Nearest Healthcare PHC</span>
                          <span className="text-white font-semibold text-right">{route.phcName}</span>
                        </div>
                        <span className="text-[11px] text-indigo-300/80 text-right font-mono">{route.location}</span>
                      </div>
                      <div className="flex flex-col border-b border-white/5 pb-3 gap-0.5">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400 font-medium">Assigned ASHA Worker</span>
                          <span className="text-white font-semibold text-right">{route.workerName}</span>
                        </div>
                        <span className="text-[11px] text-emerald-400 text-right font-mono font-medium">📞 Contact: {route.workerPhone}</span>
                      </div>
                      <div className="pt-2 space-y-1.5">
                        <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 block">✓ Automated Emergency Action Triggered</span>
                        <p className="text-gray-300 leading-relaxed text-xs bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-xl">
                          Structured diagnostic summary notification encrypted &amp; dispatched to assigned ASHA worker <strong>{route.workerName}</strong> ({route.workerPhone}). Telemetry tracking has matched patient profile endpoints directly with <strong>{route.phcName}</strong> database queues.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // ── User / AI Message Bubbles ──
            const isUser = msg.type === 'user';
            return (
              <div
                key={msg.id}
                className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
                style={{ animation: 'fadeIn 0.3s ease-out forwards' }}
              >
                <div className={`max-w-[78%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`px-5 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
                      isUser
                        ? 'bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-purple-500/30 text-white rounded-tr-[4px]'
                        : 'bg-white/[0.04] border border-white/[0.08] text-gray-200 rounded-tl-[4px] shadow-[0_4px_12px_rgba(0,0,0,0.1)]'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-gray-500 mt-1 px-1">{formatTime(msg.timestamp)}</span>
                </div>
              </div>
            );
          })}

          {/* Progress bar */}
          {showProgress && (
            <div className="flex w-full justify-start" style={{ animation: 'fadeIn 0.3s ease-out forwards' }}>
              <div className="w-full max-w-md bg-white/5 border border-white/10 p-4 rounded-2xl space-y-3">
                <div className="flex justify-between text-xs font-semibold tracking-wider text-indigo-300 uppercase">
                  <span>Processing via Gemini 2.0 Multimodal AI...</span>
                  <span>{progressValue}%</span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-300"
                    style={{ width: `${progressValue}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Typing indicator */}
          {isTyping && (
            <div className="px-0 py-2">
              <div className="bg-white/[0.04] border border-white/[0.08] max-w-[100px] px-4 py-2.5 rounded-2xl flex items-center justify-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-indigo-400 dot-pulse" />
                <div className="w-2 h-2 rounded-full bg-indigo-400 dot-pulse" style={{ animationDelay: '0.2s' }} />
                <div className="w-2 h-2 rounded-full bg-indigo-400 dot-pulse" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Hidden Native File Inputs */}
        <input type="file" ref={photoPickerRef} accept="image/*" className="hidden" onChange={() => handleFileSelected('Photo')} />
        <input type="file" ref={filePickerRef} accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={() => handleFileSelected('File')} />
        <input type="file" ref={xrayPickerRef} accept="image/*,.pdf" className="hidden" onChange={() => handleFileSelected('Chest X-ray')} />

        {/* ── Input Processing Panel ── */}
        <div className="p-4 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/90 to-transparent shrink-0 relative">
          {/* Backdrop overlay to close menu on outside click */}
          {attachMenuOpen && (
            <div className="fixed inset-0 z-40" onClick={() => setAttachMenuOpen(false)} />
          )}

          {/* Attachment Floating Menu Popup */}
          {attachMenuOpen && (
            <div
              className="absolute bottom-20 left-4 w-56 glass rounded-xl p-2 border border-white/10 shadow-2xl flex flex-col gap-1 z-50"
            >
              <button
                onClick={() => { setAttachMenuOpen(false); setTimeout(() => photoPickerRef.current?.click(), 50); }}
                className="w-full text-left px-3 py-2 text-xs font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-2.5 transition-all"
              >
                <span>📷</span> Upload Photo
              </button>
              <button
                onClick={() => { setAttachMenuOpen(false); setTimeout(() => filePickerRef.current?.click(), 50); }}
                className="w-full text-left px-3 py-2 text-xs font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-2.5 transition-all"
              >
                <span>📄</span> Upload File
              </button>
              <button
                onClick={() => { setAttachMenuOpen(false); setTimeout(() => xrayPickerRef.current?.click(), 50); }}
                className="w-full text-left px-3 py-2 text-xs font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-2.5 transition-all"
              >
                <span>🩻</span> Upload Chest X-ray (Demo Node)
              </button>
            </div>
          )}

          {/* Chat Form Bar */}
          <form
            onSubmit={handleSubmit}
            className="glass rounded-2xl p-2 flex items-center gap-1.5 max-w-4xl mx-auto border border-white/10 relative z-10"
          >
            {/* Toggle Attachment Button [+] */}
            <button
              type="button"
              onClick={() => setAttachMenuOpen((prev) => !prev)}
              className="p-3 text-gray-400 hover:text-indigo-400 transition-all rounded-xl hover:bg-white/5 shrink-0 font-semibold text-lg flex items-center justify-center w-11 h-11"
            >
              ＋
            </button>

            {/* Main Core Text Input */}
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoComplete="off"
              placeholder="Type your health response query..."
              className="bg-transparent flex-grow px-2 py-3 text-sm text-white focus:outline-none placeholder-gray-500 min-w-0"
            />

            {/* Voice Input Microphone Button */}
            <button
              type="button"
              onClick={toggleVoice}
              className={`p-3 transition-all rounded-xl shrink-0 flex items-center justify-center w-11 h-11 ${
                isListening
                  ? 'mic-active'
                  : 'text-gray-400 hover:text-indigo-400 hover:bg-white/5'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 0 3-3v-6a3 3 0 0 0-3-3 3 3 0 0 0-3 3v6a3 3 0 0 0 3 3z" />
              </svg>
            </button>

            {/* Send Button */}
            <button
              type="submit"
              className="btn-primary p-3 rounded-xl text-white font-medium shadow-md shrink-0 flex items-center justify-center w-11 h-11"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L6 12zm0 0h7" />
              </svg>
            </button>
          </form>
        </div>
      </main>

      {/* ── Gateway Dispatch Toast ── */}
      {toast.visible && (
        <div
          className="fixed bottom-6 right-6 bg-emerald-600/95 backdrop-blur-md border border-emerald-400/40 text-white text-xs px-4 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-3 transition-all duration-300"
          style={{ animation: 'fadeIn 0.3s ease-out forwards' }}
        >
          <span className="text-base animate-bounce">📲</span>
          <div>
            <strong className="block font-semibold">Gateway Dispatch Success</strong>
            <span className="text-gray-200 text-[11px]">Secure SMS alert routed to payload hub terminal {toast.phone}</span>
          </div>
        </div>
      )}

      {/* Animations */}
      <style jsx>{`
        .chat-scroll::-webkit-scrollbar { width: 5px; }
        .chat-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }
        .dot-pulse { animation: dotPulse 1.4s infinite ease-in-out both; }
        @keyframes dotPulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1.2); opacity: 1; }
        }
        @keyframes micPulse {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        .mic-active {
          animation: micPulse 1.5s infinite;
          background: rgba(239, 68, 68, 0.2) !important;
          color: #ef4444 !important;
          border-color: rgba(239, 68, 68, 0.4) !important;
        }
      `}</style>
    </div>
  );
}
