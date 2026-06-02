'use client';

import { useEffect, useState } from 'react';

const PARTICLES = [
  { w: 3.2, h: 3.5, left: 23.6, top: 33.2, duration: 16.7, delay: 2.94 },
  { w: 5.8, h: 5.1, left: 46.9, top: 61.9, duration: 15.9, delay: 3.99 },
  { w: 4.0, h: 5.1, left: 34.0, top: 92.1, duration: 16.6, delay: 3.74 },
  { w: 5.8, h: 5.2, left: 80.1, top: 43.3, duration: 15.6, delay: 3.21 },
  { w: 2.7, h: 4.9, left: 83.0, top: 57.1, duration: 10.8, delay: 4.97 },
  { w: 6.0, h: 4.3, left: 50.2, top: 27.7, duration: 14.8, delay: 3.79 },
  { w: 5.2, h: 2.2, left: 28.2, top:  3.6, duration: 13.4, delay: 4.54 },
  { w: 5.5, h: 2.5, left: 93.0, top: 98.7, duration: 12.9, delay: 0.37 },
  { w: 5.4, h: 2.3, left: 21.3, top: 14.4, duration: 15.8, delay: 2.33 },
  { w: 2.3, h: 5.8, left: 38.6, top: 86.4, duration: 12.4, delay: 2.86 },
  { w: 5.1, h: 3.0, left: 46.6, top: 81.9, duration: 14.8, delay: 4.12 },
  { w: 5.6, h: 2.6, left: 51.1, top: 99.6, duration: 13.7, delay: 1.76 },
  { w: 5.1, h: 3.6, left: 55.4, top: 48.7, duration: 11.9, delay: 2.94 },
  { w: 2.3, h: 2.6, left: 81.7, top: 16.4, duration: 13.8, delay: 4.74 },
  { w: 5.8, h: 2.8, left: 58.8, top: 72.9, duration: 18.7, delay: 2.02 },
  { w: 2.0, h: 5.2, left: 92.5, top: 90.9, duration: 15.6, delay: 2.98 },
  { w: 2.9, h: 3.6, left: 31.7, top: 97.1, duration: 17.2, delay: 3.84 },
  { w: 2.4, h: 4.9, left:  4.2, top: 59.2, duration: 15.2, delay: 0.98 },
  { w: 2.7, h: 6.0, left: 54.2, top: 72.0, duration: 13.1, delay: 3.57 },
  { w: 3.0, h: 5.4, left: 30.2, top: 45.4, duration: 10.9, delay: 4.55 },
];

export default function AuthParticles() {
  const [show, setShow] = useState(false);

  // Only render on client — prevents SSR/CSR mismatch on inline styles
  useEffect(() => { setShow(true); }, []);

  if (!show) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {PARTICLES.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full opacity-20 auth-particle"
          style={{
            width: `${p.w}px`,
            height: `${p.h}px`,
            left: `${p.left}%`,
            top: `${p.top}%`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
