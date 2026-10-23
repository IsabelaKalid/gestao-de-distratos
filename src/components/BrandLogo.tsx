import React from 'react';
import { EMPRESA } from '../config/empresa';

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  tagline?: boolean;
  /** Esconde o nome e mostra apenas o símbolo. */
  markOnly?: boolean;
}

const TAMANHOS = {
  sm: { mark: 'h-9 w-9 rounded-[10px]', icon: 'h-5 w-5', nome: 'text-lg', tagline: 'text-[9px]' },
  md: { mark: 'h-11 w-11 rounded-xl', icon: 'h-6 w-6', nome: 'text-2xl', tagline: 'text-[10px]' },
  lg: { mark: 'h-14 w-14 rounded-2xl', icon: 'h-8 w-8', nome: 'text-[2rem]', tagline: 'text-[11px]' },
};

/** Símbolo: um "D" desenhado como estrada, com a faixa central tracejada. */
export const BrandMark: React.FC<{ className?: string; iconClassName?: string }> = ({
  className = 'h-9 w-9 rounded-[10px]',
  iconClassName = 'h-5 w-5',
}) => (
  <span className={`brand-mark inline-flex shrink-0 items-center justify-center ${className}`}>
    <svg viewBox="0 0 32 32" fill="none" className={iconClassName} aria-hidden="true">
      <path
        d="M8 6.5h7.5a9.5 9.5 0 0 1 0 19H8z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 16h6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeDasharray="2.2 2.6"
      />
    </svg>
  </span>
);

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  size = 'sm',
  tagline = false,
  markOnly = false,
}) => {
  const t = TAMANHOS[size];
  return (
    <div role="img" aria-label={EMPRESA.nome} className={`flex items-center gap-3 min-w-0 ${className}`}>
      <BrandMark className={t.mark} iconClassName={t.icon} />
      {!markOnly && (
        <div className="min-w-0 leading-none">
          <span className={`block truncate font-extrabold tracking-tight text-stone-50 ${t.nome}`}>
            {EMPRESA.nome}
          </span>
          {tagline && (
            <span className={`mt-1.5 block truncate font-semibold uppercase tracking-[0.18em] text-[#d9b86f] ${t.tagline}`}>
              Gestão de distratos
            </span>
          )}
        </div>
      )}
    </div>
  );
};
