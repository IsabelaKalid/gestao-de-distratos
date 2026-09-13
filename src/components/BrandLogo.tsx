import React from 'react';

interface BrandLogoProps { className?: string; }

export const BrandLogo: React.FC<BrandLogoProps> = ({ className = '' }) => (
  <div role="img" aria-label="Transpanorama" className={`brand-logo ${className}`} />
);
