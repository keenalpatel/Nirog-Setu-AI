'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { useEffect, useState, useRef, useCallback } from 'react';

const stats = [
  { value: 65, suffix: '%', label: 'Rural Population', description: 'Of India\'s population lives in rural areas with limited healthcare access', color: 'from-indigo-500 to-purple-500' },
  { value: 220, suffix: 'K', label: 'TB Deaths Annually', description: 'Tuberculosis kills approximately 220,000 Indians every year', color: 'from-red-500 to-orange-500' },
  { value: 600, suffix: 'M', label: 'Without Healthcare', description: 'Indians lack access to basic healthcare services and facilities', color: 'from-amber-500 to-yellow-500' },
  { value: 22, suffix: '+', label: 'Languages', description: 'Indian languages supported via Bhashini integration for true accessibility', color: 'from-emerald-500 to-teal-500' },
  { value: 5, suffix: 'M+', label: 'Monthly Screenings', description: 'Projected screenings at national scale by Year 3 of deployment', color: 'from-blue-500 to-cyan-500' },
  { value: 180, suffix: 'K', label: 'Lives Saved', description: 'Potentially saved annually through early detection and AI intervention', color: 'from-pink-500 to-rose-500' },
];

const agents = [
  { name: 'Triage-Agent', description: 'First point of contact. Voice-based initial assessment, severity scoring, and intelligent routing.', tags: ['Gemini 2.0', 'Bhashini'], color: 'indigo' },
  { name: 'Diagnose-Agent', description: 'AI-powered preliminary diagnosis with multimodal analysis of X-rays, skin lesions, and symptoms.', tags: ['Vertex AI', 'RAG'], color: 'blue' },
  { name: 'Prescribe-Agent', description: 'Evidence-based treatment protocols from ICMR/WHO guidelines with drug interaction checks.', tags: ['BigQuery', 'ICMR'], color: 'green' },
  { name: 'Refer-Agent', description: 'Real-time PHC/CHC finder with bed availability, doctor schedules, and automatic appointment booking.', tags: ['Maps API', 'Cloud Functions'], color: 'amber' },
  { name: 'ASHA-Agent', description: 'Community health worker coordination with DOTS tracking and medication adherence monitoring.', tags: ['Pub/Sub', 'Firebase'], color: 'pink' },
  { name: 'Emergency-Agent', description: 'Critical condition detection with automatic 108 ambulance dispatch and first-aid guidance.', tags: ['Cloud Functions', 'SOS API'], color: 'red' },
];

// ─── Chat Demo Steps ────────────────────────────────────────────────
interface DemoChatMsg { type: 'user' | 'ai'; content: string; agent?: string }
interface DemoThinkingStep { text: string; icon: string }

const chatDemoSteps: Array<{ type: 'user' | 'ai' | 'thinking'; content?: string; agent?: string; delay: number; steps?: Array<DemoThinkingStep & { delay: number }> }> = [
  { type: 'user', content: 'I have fever and cough for 3 days. I also feel very tired.', delay: 500 },
  { type: 'ai', content: 'I understand. Let me analyze your symptoms through our triage system.', delay: 1500, agent: 'Triage-Agent' },
  { type: 'thinking', delay: 0, steps: [
    { text: 'AI Thinking...', icon: 'brain', delay: 800 },
    { text: 'Routing to Triage Agent', icon: 'route', delay: 1200 },
    { text: 'Analyzing symptoms...', icon: 'analyze', delay: 1600 },
    { text: 'Calling Diagnose Agent', icon: 'call', delay: 2000 },
    { text: 'Checking Medical Database', icon: 'database', delay: 2400 },
    { text: 'Recommendation Ready', icon: 'check', delay: 2800 },
  ]},
  { type: 'ai', content: 'Based on your symptoms (fever, cough, fatigue), I recommend: 1) Get a TB screening test at your nearest PHC 2) Rest and hydration 3) Monitor temperature. I have notified ASHA worker Meera Devi for follow-up.', delay: 3000, agent: 'Diagnose-Agent' },
];

export default function LandingPage() {
  const [isVisible, setIsVisible] = useState(false);

  // ── Live AI Demo state ──
  const [demoMessages, setDemoMessages] = useState<DemoChatMsg[]>([]);
  const [thinkingSteps, setThinkingSteps] = useState<Array<{ text: string; icon: string; active: boolean }>>([]);
  const [latency, setLatency] = useState('0ms');
  const [confidence, setConfidence] = useState('0%');
  const demoRunningRef = useRef(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const thinkingScrollRef = useRef<HTMLDivElement>(null);

  const runChatDemo = useCallback(() => {
    if (demoRunningRef.current) return;
    demoRunningRef.current = true;
    setDemoMessages([]);
    setThinkingSteps([]);
    setLatency('0ms');
    setConfidence('0%');

    let totalDelay = 0;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    chatDemoSteps.forEach((step) => {
      if (step.type === 'thinking' && step.steps) {
        step.steps.forEach((s) => {
          totalDelay += s.delay;
          timeouts.push(setTimeout(() => {
            setThinkingSteps((prev) => [
              ...prev.map((p) => ({ ...p, active: false })),
              { text: s.text, icon: s.icon, active: true },
            ]);
            setLatency(Math.floor(Math.random() * 200 + 50) + 'ms');
            setConfidence(Math.floor(Math.random() * 20 + 70) + '%');
          }, totalDelay));
        });
      } else {
        totalDelay += step.delay;
        timeouts.push(setTimeout(() => {
          setDemoMessages((prev) => [...prev, { type: step.type as 'user' | 'ai', content: step.content || '', agent: step.agent }]);
        }, totalDelay));
      }
    });

    timeouts.push(setTimeout(() => {
      demoRunningRef.current = false;
      setThinkingSteps((prev) => prev.map((p) => ({ ...p, active: false })));
      setConfidence('94%');
      setLatency('1.2s');
    }, totalDelay + 500));
  }, []);

  useEffect(() => {
    setIsVisible(true);
    const t = setTimeout(runChatDemo, 1500);
    return () => clearTimeout(t);
  }, [runChatDemo]);

  // Auto-scroll demo panels
  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [demoMessages]);
  useEffect(() => {
    thinkingScrollRef.current?.scrollTo({ top: thinkingScrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [thinkingSteps]);

  return (
    <div className="min-h-screen bg-transparent">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 w-full z-50 glass px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center overflow-hidden shadow-lg">
              <Image src="/logo.jpeg" alt="Logo" width={40} height={40} className="object-contain p-0.5" />
            </div>
            <span className="text-xl font-bold tracking-tight">
              Nirog-Setu <span className="text-indigo-400">AI</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-300">
            <a href="#hero" className="hover:text-white transition-colors">Home</a>
            <a href="#stats" className="hover:text-white transition-colors">Impact</a>
            <a href="#chat" className="hover:text-white transition-colors">Demo</a>
            <a href="#architecture" className="hover:text-white transition-colors">Architecture</a>
          </div>
          <Link href="/login">
            <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-full">
              Try AI Assistant
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="hero" className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        {/* Floating Cards */}
        <div className="absolute top-32 left-10 glass-card rounded-2xl p-4 animate-float hidden lg:block max-w-xs">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-xs text-green-400 font-medium">AI Diagnosis</span>
          </div>
          <p className="text-xs text-gray-400">TB Detection: 94.2% Accuracy</p>
        </div>

        <div className="absolute top-48 right-20 glass-card rounded-2xl p-4 animate-float hidden lg:block max-w-xs" style={{ animationDelay: '1s', animationDuration: '7s' }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <span className="text-xs text-blue-400 font-medium">Emergency</span>
          </div>
          <p className="text-xs text-gray-400">108 Ambulance Dispatched</p>
        </div>

        <div className="absolute bottom-40 left-20 glass-card rounded-2xl p-4 animate-float hidden lg:block max-w-xs" style={{ animationDelay: '2s', animationDuration: '8s' }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-xs text-purple-400 font-medium">Bhashini</span>
          </div>
          <p className="text-xs text-gray-400">22 Languages Supported</p>
        </div>

        {/* Hero Content */}
        <div className={`relative z-20 text-center max-w-5xl mx-auto px-6 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8 border border-indigo-500/30">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
            <span className="text-sm text-indigo-300">Powered by Google Cloud Vertex AI & ADK</span>
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 leading-tight">
            <span className="gradient-text neon-glow">Nirog-Setu</span>
            <br />
            <span className="text-white/90 text-4xl md:text-6xl lg:text-7xl">AI Healthcare</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            A multi-agent AI-powered healthcare intelligence platform bridging the gap between{' '}
            <span className="text-indigo-400">600 million</span> rural Indians and quality healthcare through voice-first, multilingual AI.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login" className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 px-8 py-4 rounded-full font-semibold text-lg flex items-center gap-2 transition-all hover:scale-105">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              Watch Live Demo
            </Link>
            <Link href="/login" className="glass border border-white/10 hover:border-white/30 px-8 py-4 rounded-full font-semibold text-lg flex items-center gap-2 transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Try AI Assistant
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section id="stats" className="relative py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 gradient-text">The Rural Healthcare Crisis</h2>
            <p className="text-gray-400 text-lg">Real numbers. Real impact. Real change.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stats.map((stat, index) => (
              <div key={index} className="glass-card rounded-3xl p-8 glow-card">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center">
                    <div className={`w-7 h-7 rounded-lg bg-gradient-to-r ${stat.color}`} />
                  </div>
                  <span className="text-5xl font-bold stat-number">
                    {stat.value}<span className="text-2xl">{stat.suffix}</span>
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{stat.label}</h3>
                <p className="text-sm text-gray-400">{stat.description}</p>
                <div className="mt-4 h-1 bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-full bg-gradient-to-r ${stat.color} rounded-full`} style={{ width: '100%' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live AI Demo Section */}
      <section id="chat" className="relative py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 gradient-text">Live AI Demo</h2>
            <p className="text-gray-400 text-lg">Experience the multi-agent healthcare intelligence in action</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {/* Left: Chat */}
            <div className="flex flex-col h-[600px] rounded-2xl overflow-hidden" style={{ background: '#1a1a1a' }}>
              <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Nirog-Setu AI</h3>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                      <span className="text-xs text-gray-400">Online</span>
                    </div>
                  </div>
                </div>
                <button onClick={runChatDemo} className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  Restart
                </button>
              </div>

              <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                {demoMessages.map((msg, i) => (
                  <div key={i} className={`flex items-start gap-3 ${msg.type === 'user' ? '' : 'flex-row-reverse'}`} style={{ animation: msg.type === 'user' ? 'messageSlide 0.5s ease-out forwards' : 'messageSlideRight 0.5s ease-out forwards' }}>
                    {msg.type === 'user' ? (
                      <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                      </div>
                    )}
                    <div className={`flex-1 ${msg.type === 'user' ? '' : 'text-right'}`}>
                      {msg.agent && <div className="text-xs text-indigo-400 mb-1 font-medium">{msg.agent}</div>}
                      <div className={`inline-block px-4 py-2 rounded-2xl max-w-xs ${msg.type === 'user' ? 'bg-gray-800 text-white rounded-tl-none' : 'bg-indigo-600/20 text-indigo-100 border border-indigo-500/30 rounded-tr-none'}`}>
                        <p className="text-sm">{msg.content}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-gray-800">
                <div className="flex items-center gap-3">
                  <input type="text" placeholder="Type your symptoms..." className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors" disabled />
                  <button className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center hover:bg-indigo-500 transition-colors">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Agent Thinking */}
            <div className="flex flex-col h-[600px] rounded-2xl overflow-hidden" style={{ background: '#1a1a1a' }}>
              <div className="p-4 border-b border-gray-800">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                  Agent Thinking Process
                </h3>
                <p className="text-xs text-gray-400 mt-1">Real-time multi-agent orchestration via ADK</p>
              </div>

              <div ref={thinkingScrollRef} className="flex-1 overflow-y-auto p-6 space-y-2">
                {thinkingSteps.map((step, i) => (
                  <div key={i}>
                    {i > 0 && (
                      <div className="w-0.5 h-7 mx-auto" style={{ background: 'linear-gradient(to bottom, #6366f1, transparent)', animation: 'lineGrow 0.5s ease-out forwards', transformOrigin: 'top' }} />
                    )}
                    <div className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-400 ${step.active ? 'bg-indigo-500/10 border border-indigo-500/20' : 'opacity-60'}`} style={{ animation: 'fadeIn 0.4s ease-out forwards' }}>
                      <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0">
                        {step.icon === 'brain' && <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>}
                        {step.icon === 'route' && <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>}
                        {step.icon === 'analyze' && <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
                        {step.icon === 'call' && <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>}
                        {step.icon === 'database' && <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>}
                        {step.icon === 'check' && <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-white">{step.text}</p>
                        {step.active && (
                          <div className="flex gap-1 mt-2">
                            <span className="thinking-dot" />
                            <span className="thinking-dot" />
                            <span className="thinking-dot" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* System Status */}
              <div className="p-4 border-t border-gray-800">
                <div className="grid grid-cols-3 gap-3">
                  <div className="glass rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-400 mb-1">Latency</div>
                    <div className="text-sm font-semibold text-green-400">{latency}</div>
                  </div>
                  <div className="glass rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-400 mb-1">Agents</div>
                    <div className="text-sm font-semibold text-indigo-400">6 Active</div>
                  </div>
                  <div className="glass rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-400 mb-1">Confidence</div>
                    <div className="text-sm font-semibold text-blue-400">{confidence}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture Section */}
      <section id="architecture" className="relative py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 gradient-text">Multi-Agent Architecture</h2>
            <p className="text-gray-400 text-lg">Six specialized agents orchestrated through Google Cloud ADK</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent, index) => (
              <div key={index} className="glass-card rounded-2xl p-6 glow-card group cursor-pointer">
                <div className={`w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <div className={`w-6 h-6 rounded-full bg-gradient-to-r from-${agent.color}-500 to-${agent.color}-400`} />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{agent.name}</h3>
                <p className="text-sm text-gray-400">{agent.description}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                  {agent.tags.map((tag, tagIndex) => (
                    <span key={tagIndex} className="px-2 py-1 rounded-full bg-white/5">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-16 px-6 border-t border-gray-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center overflow-hidden shadow-md">
              <Image src="/logo.jpeg" alt="Logo" width={32} height={32} className="object-contain p-0.5" />
            </div>
            <span className="font-semibold">Nirog-Setu AI</span>
          </div>
          <p className="text-sm text-gray-500">Built for APAC GenAI Academy 2026 | Google Cloud Vertex AI & ADK</p>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-600">Ayushman Bharat Aligned</span>
            <span className="text-xs text-gray-600">Mission Bhashini</span>
            <span className="text-xs text-gray-600">IndiaAI Mission</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
