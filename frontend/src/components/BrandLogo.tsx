import React from 'react';

interface BrandLogoProps {
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  showBadge?: boolean;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'light',
  size = 'md',
  showBadge = true,
  className = '',
}) => {
  const isDark = variant === 'dark';

  // Dimension scaling
  const iconSize = size === 'sm' ? 24 : size === 'lg' ? 36 : 28;
  const fontSize = size === 'sm' ? '17px' : size === 'lg' ? '24px' : '20px';

  return (
    <div
      className={`winback-brand-mark ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size === 'sm' ? '8px' : '10px',
        textDecoration: 'none',
        userSelect: 'none',
      }}
    >
      {/* Precision Geometric SVG Icon Emblem */}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0, filter: 'drop-shadow(0 2px 8px rgba(0, 229, 153, 0.25))' }}
      >
        <defs>
          <linearGradient id="winbackGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00E599" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="winbackGrad2" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#04120D" />
            <stop offset="100%" stopColor="#0F3D2E" />
          </linearGradient>
          <linearGradient id="winbackAccent" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#00E599" />
          </linearGradient>
        </defs>

        {/* Outer Rounded Hex/Shield Container */}
        <rect
          x="1"
          y="1"
          width="38"
          height="38"
          rx="10"
          fill="url(#winbackGrad2)"
          stroke="rgba(0, 229, 153, 0.35)"
          strokeWidth="1.5"
        />

        {/* Dynamic Recovery Loop Curve (Cashflow Inflow Arc) */}
        <path
          d="M12 21C12 16.0294 16.0294 12 21 12C24.866 12 28.1409 14.4346 29.3905 17.8824"
          stroke="url(#winbackGrad1)"
          strokeWidth="3.2"
          strokeLinecap="round"
        />

        {/* Forward Arrow Head on Recovery Loop */}
        <path
          d="M26 18H30.5V13.5"
          stroke="url(#winbackGrad1)"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Secondary Return Arc (Closing the autonomous loop) */}
        <path
          d="M28 21C28 24.866 24.866 28 21 28C17.134 28 13.8591 25.5654 12.6095 22.1176"
          stroke="url(#winbackAccent)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeDasharray="2 2"
        />

        {/* Center High-Confidence Sentinel Pulse Node */}
        <circle cx="20" cy="20" r="2.8" fill="#00E599" />
      </svg>

      {/* Brand Wordmark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span
          style={{
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            fontSize: fontSize,
            fontWeight: 900,
            letterSpacing: '-0.7px',
            color: isDark ? '#FFFFFF' : '#061A14',
            lineHeight: 1,
          }}
        >
          win<span style={{ color: '#00B377' }}>back</span>
        </span>

        {showBadge && (
          <span
            style={{
              fontSize: size === 'sm' ? '8.5px' : '9.5px',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              letterSpacing: '0.8px',
              padding: size === 'sm' ? '1.5px 5px' : '2px 6px',
              borderRadius: '4px',
              background: isDark ? 'rgba(0, 229, 153, 0.15)' : 'rgba(6, 26, 20, 0.08)',
              color: isDark ? '#00E599' : '#061A14',
              border: isDark ? '1px solid rgba(0, 229, 153, 0.3)' : '1px solid rgba(6, 26, 20, 0.15)',
              textTransform: 'uppercase',
            }}
          >
            OS
          </span>
        )}
      </div>
    </div>
  );
};
