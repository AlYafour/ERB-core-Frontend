'use client';

import { useEffect, useState } from 'react';

export default function SplashScreen() {
  // Start hidden to avoid SSR/CSR hydration mismatch.
  // The splash is purely a client-side enhancement shown only on first paint.
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    setIsVisible(true);

    const hide = () => {
      setIsAnimating(true);
      setTimeout(() => setIsVisible(false), 500);
    };

    if (document.readyState === 'complete') {
      const t = setTimeout(hide, 300);
      return () => clearTimeout(t);
    }

    const t = setTimeout(hide, 1500);
    window.addEventListener('load', hide, { once: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener('load', hide);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-500 ${
        isAnimating ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{ backgroundColor: 'var(--background)' }}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <img
            src="/logo.png"
            alt="AL YAFOUR CONSTRUCTION Logo"
            width={80}
            height={80}
            className="animate-pulse"
            style={{ filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))' }}
            onError={(e) => { e.currentTarget.src = '/logo.svg'; }}
          />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>
            Procurement System
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            AL YAFOUR CONSTRUCTION
          </p>
        </div>
        <div className="mt-4">
          <div className="flex gap-1">
            {[0, 150, 300].map((delay) => (
              <div
                key={delay}
                className="w-2 h-2 rounded-full animate-bounce"
                style={{ backgroundColor: 'var(--primary)', animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
