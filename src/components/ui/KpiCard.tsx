import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type ColorVariant = 'primary' | 'success' | 'warning' | 'info' | 'destructive';

const VARIANT_CONFIG: Record<ColorVariant, { gradient: string; glow: string }> = {
  primary: {
    gradient: 'linear-gradient(163deg, #5C2D00 0%, #A0540A 100%)',
    glow: '0px 0px 30px 1px rgba(92, 45, 0, 0.30)',
  },
  success: {
    gradient: 'linear-gradient(163deg, #00875A 0%, #00C87A 100%)',
    glow: '0px 0px 30px 1px rgba(0, 200, 122, 0.30)',
  },
  warning: {
    gradient: 'linear-gradient(163deg, #B37400 0%, #E89000 100%)',
    glow: '0px 0px 30px 1px rgba(232, 144, 0, 0.30)',
  },
  info: {
    gradient: 'linear-gradient(163deg, #0060B0 0%, #2B90D9 100%)',
    glow: '0px 0px 30px 1px rgba(43, 144, 217, 0.30)',
  },
  destructive: {
    gradient: 'linear-gradient(163deg, #B02020 0%, #E53C3C 100%)',
    glow: '0px 0px 30px 1px rgba(229, 60, 60, 0.30)',
  },
};

interface KpiCardProps {
  colorVariant?: ColorVariant;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}

export function KpiCard({ colorVariant = 'primary', onClick, className, children }: KpiCardProps) {
  const [hovered, setHovered] = useState(false);
  const config = VARIANT_CONFIG[colorVariant];

  return (
    <div
      className={cn(
        'group rounded-2xl p-[2px] transition-all duration-300',
        onClick && 'cursor-pointer',
        className,
      )}
      style={{
        backgroundImage: config.gradient,
        boxShadow: hovered ? config.glow : undefined,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      <div className="h-full w-full rounded-[14px] bg-card transition-transform duration-200 group-hover:scale-[0.98]">
        {children}
      </div>
    </div>
  );
}
