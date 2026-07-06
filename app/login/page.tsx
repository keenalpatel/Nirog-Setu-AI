'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Loader2, MapPin, MessageCircle } from 'lucide-react';
import Image from 'next/image';

// Particle class for background animation
class Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  alpha: number;

  constructor(canvasWidth: number, canvasHeight: number) {
    this.x = Math.random() * canvasWidth;
    this.y = Math.random() * canvasHeight;
    this.size = Math.random() * 2 + 0.5;
    this.speedX = Math.random() * 0.4 - 0.2;
    this.speedY = Math.random() * 0.4 - 0.2;
    this.alpha = Math.random() * 0.4 + 0.1;
  }

  update(canvasWidth: number, canvasHeight: number) {
    this.x += this.speedX;
    this.y += this.speedY;
    if (this.x < 0 || this.x > canvasWidth) this.speedX *= -1;
    if (this.y < 0 || this.y > canvasHeight) this.speedY *= -1;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

export default function LoginPage() {
  const { login } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  const [userCoordinates, setUserCoordinates] = useState<{ lat: number; lng: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);

  // Particle animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    particlesRef.current = Array.from({ length: 60 }, () => new Particle(canvas.width, canvas.height));

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particlesRef.current.forEach((p) => {
        p.update(canvas.width, canvas.height);
        p.draw(ctx);
      });
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const handleLocationRequest = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus('denied');
      return;
    }
    setLocationStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserCoordinates({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocationStatus('granted');
        setError('');
      },
      () => {
        setUserCoordinates(null);
        setLocationStatus('denied');
      }
    );
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isSignUp && !fullName.trim()) {
      setError('Please fill out your Name to construct your registration profile.');
      return;
    }
    if (!email.trim() || !mobile.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!userCoordinates) {
      setError('Please share your current location before proceeding.');
      return;
    }

    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (isSignUp) {
      // For sign-up, attempt login with provided credentials
      const result = login(email, mobile);
      if (!result.success) {
        setError(result.error || 'Account creation failed');
      }
    } else {
      const result = login(email, mobile);
      if (!result.success) {
        setError(result.error || 'Login failed');
      }
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Aurora Background */}
      <div className="fixed inset-0 aurora-bg" style={{ zIndex: -3 }} />

      {/* Particle Canvas */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: -2 }}
      />

      {/* Top Navigation */}
      <nav className="fixed top-0 left-0 w-full z-50 glass px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center overflow-hidden shadow-lg">
              <Image src="/logo.jpeg" alt="Logo" width={40} height={40} className="object-contain p-0.5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">
              Nirog-Setu <span className="text-indigo-400">AI</span>
            </span>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow pt-32 pb-8 px-4 flex flex-col items-center justify-center relative z-10">
        <div
          className="w-full max-w-lg glass-card rounded-2xl p-8 space-y-6"
          style={{ animation: 'fadeIn 0.5s ease-out forwards' }}
        >
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center overflow-hidden mx-auto mb-2 shadow-lg shadow-indigo-500/20">
              <Image src="/logo.jpeg" alt="Logo" width={48} height={48} className="object-contain p-0.5" />
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight gradient-text">
              Welcome to Nirog-Setu AI
            </h2>
            <p className="text-gray-400 text-sm max-w-sm mx-auto">
              {isSignUp
                ? 'Please provide your details to begin your AI healthcare consultation.'
                : 'Please log in to your account to begin your AI healthcare consultation.'}
            </p>
          </div>

          {/* Sign In / Sign Up Toggle */}
          <div className="grid grid-cols-2 p-1 bg-white/5 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => { setIsSignUp(false); setError(''); }}
              className={`py-2.5 text-sm font-semibold rounded-lg transition-all ${
                !isSignUp
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsSignUp(true); setError(''); }}
              className={`py-2.5 text-sm font-semibold rounded-lg transition-all ${
                isSignUp
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              New Account
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name (Sign Up only) */}
            {isSignUp && (
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_15px_rgba(99,102,241,0.3)] focus:bg-white/[0.08] transition-all"
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Email Address *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_15px_rgba(99,102,241,0.3)] focus:bg-white/[0.08] transition-all"
              />
            </div>

            {/* Mobile Number */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Mobile Number *
              </label>
              <input
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="+91 XXXXX XXXXX"
                required
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_15px_rgba(99,102,241,0.3)] focus:bg-white/[0.08] transition-all"
              />
            </div>

            {/* Location Access */}
            <div className="pt-2">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Allow Location Access *
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  type="button"
                  onClick={handleLocationRequest}
                  className={`px-4 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 bg-white/5 border transition-all whitespace-nowrap ${
                    locationStatus === 'granted'
                      ? 'border-emerald-500/30 bg-emerald-500/10'
                      : 'border-white/10 hover:bg-white/[0.05] hover:border-white/25'
                  }`}
                >
                  <MapPin className="w-4 h-4 text-indigo-400" />
                  Share Current Location
                </button>
                <div className="text-xs">
                  {locationStatus === 'idle' && (
                    <span className="text-gray-400">Required to map region insights.</span>
                  )}
                  {locationStatus === 'requesting' && (
                    <span className="text-indigo-400 animate-pulse">Requesting access...</span>
                  )}
                  {locationStatus === 'granted' && (
                    <span className="text-emerald-400 font-medium flex items-center gap-1">
                      ✓ Location shared successfully.
                    </span>
                  )}
                  {locationStatus === 'denied' && (
                    <span className="text-red-400">Permission denied. Location access required.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-4 rounded-xl font-bold tracking-wide shadow-lg shadow-indigo-500/20 text-sm uppercase mt-4 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {isSignUp ? 'Creating Account...' : 'Logging in...'}
                </>
              ) : (
                isSignUp ? 'Create Account' : 'Login'
              )}
            </button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full relative z-10 py-8 px-4 flex flex-col items-center border-t border-white/5 bg-black/20 backdrop-blur-sm">
        <p className="text-xs text-gray-500 mb-3 tracking-wide">
          Prefer skipping portal access details completely?
        </p>
        <a
          href="https://wa.me/919999999999"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium tracking-wide text-indigo-300 hover:text-white px-6 py-3 rounded-xl flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-white/[0.05] hover:border-white/25 transition-all duration-300 transform hover:-translate-y-0.5"
        >
          <MessageCircle className="w-4 h-4" />
          Continue to Chat on WhatsApp
        </a>
      </footer>
    </div>
  );
}
