import React from 'react';

// ---------------------------------------------------------------------------
// BidFlare logo (inline SVG so it inherits crisp rendering and can be sized via
// `height`). The mark is a 3×3 grid of Grid-Grey dots — "the noise" — with one
// glowing Flare-Mint dot at the center: the found opportunity. Wordmark is
// Dark Steel, `Bid` (500) + `Flare` (700).
//
//   <BidFlareLogo />            full horizontal lockup (icon + wordmark)
//   <BidFlareLogo variant="icon" height={32} />   just the mark
// ---------------------------------------------------------------------------

type Variant = 'horizontal' | 'icon';

const GRID = '#C9D2D9';
const MINT = '#36F2A6';
const STEEL = '#2A333D';

function Mark() {
  return (
    <>
      <defs>
        <radialGradient id="bf-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={MINT} stopOpacity="0.55" />
          <stop offset="45%" stopColor={MINT} stopOpacity="0.20" />
          <stop offset="100%" stopColor={MINT} stopOpacity="0" />
        </radialGradient>
      </defs>
      <g fill={GRID}>
        <circle cx="12" cy="12" r="12" />
        <circle cx="50" cy="12" r="12" />
        <circle cx="88" cy="12" r="12" />
        <circle cx="12" cy="50" r="12" />
        <circle cx="88" cy="50" r="12" />
        <circle cx="12" cy="88" r="12" />
        <circle cx="50" cy="88" r="12" />
        <circle cx="88" cy="88" r="12" />
      </g>
      <circle cx="50" cy="50" r="30" fill="url(#bf-glow)" />
      <circle cx="50" cy="50" r="13" fill={MINT} />
    </>
  );
}

export default function BidFlareLogo({
  variant = 'horizontal',
  height = 32,
  title = 'BidFlare',
}: {
  variant?: Variant;
  height?: number;
  title?: string;
}) {
  if (variant === 'icon') {
    return (
      <svg viewBox="-6 -6 112 112" height={height} width={height} role="img" aria-label={title}>
        <title>{title}</title>
        <Mark />
      </svg>
    );
  }

  // Horizontal lockup: viewBox 0 0 432 100 (mark spans 0–100, wordmark from 132).
  const width = (432 / 100) * height;
  return (
    <svg viewBox="0 0 432 100" height={height} width={width} role="img" aria-label={title}>
      <title>{title}</title>
      <Mark />
      <text x="132" y="50" fontSize="62" dominantBaseline="central" fill={STEEL} fontFamily="'Outfit', sans-serif">
        <tspan fontWeight={500}>Bid</tspan>
        <tspan fontWeight={700}>Flare</tspan>
      </text>
    </svg>
  );
}
