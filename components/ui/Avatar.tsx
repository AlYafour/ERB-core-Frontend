'use client';

import { useState } from 'react';
import Image from 'next/image';
import { normalizeImageUrl } from '@/lib/utils/image-url';

interface AvatarProps {
  src?: string | null;
  alt?: string;
  size?: number;
  username?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function Avatar({ 
  src, 
  alt = 'User', 
  size = 32, 
  username,
  className = '',
  style = {}
}: AvatarProps) {
  const [imageError, setImageError] = useState(false);
  const normalizedSrc = src ? normalizeImageUrl(src) : null;
  const showImage = normalizedSrc && !imageError;

  return (
    <div
      className={className}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-tertiary)',
        border: '2px solid var(--border-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        position: 'relative',
        ...style,
      }}
    >
      {showImage ? (
        <Image
          src={normalizedSrc}
          alt={alt}
          width={size}
          height={size}
          unoptimized
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          onError={() => {
            setImageError(true);
          }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text-tertiary)',
            fontSize: size <= 32 ? 'var(--font-xs)' : size <= 48 ? 'var(--font-sm)' : 'var(--font-base)',
            fontWeight: 'var(--font-weight-bold)',
          }}
        >
          {(username || alt || 'U').charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );
}
