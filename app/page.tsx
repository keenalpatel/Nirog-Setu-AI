'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';

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

export default function LandingPage() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

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
