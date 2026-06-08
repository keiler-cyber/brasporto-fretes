'use client';

import Image from 'next/image';

interface BrasportoLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

// O PNG já contém o texto "BRASPORTO INTERNATIONAL LOGISTICS"
export function BrasportoLogo({ className = '', size = 'md' }: BrasportoLogoProps) {
  const widths  = { sm: 130, md: 180, lg: 260 };
  const heights = { sm: 46,  md: 63,  lg: 91  };
  const w = widths[size];
  const h = heights[size];

  return (
    <div className={className}>
      <Image
        src="/brasporto-logo.png"
        alt="Brasporto International Logistics"
        width={w}
        height={h}
        className="object-contain"
        priority
      />
    </div>
  );
}
