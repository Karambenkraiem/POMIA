import { useMemo } from 'react';
import qrcode from '../lib/qrcode-generator';

interface QRCodeProps {
  value: string;
  size?: number;
  className?: string;
}

export default function QRCode({ value, size = 140, className }: QRCodeProps) {
  const path = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();

    const count = qr.getModuleCount();
    let d = '';
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (qr.isDark(row, col)) {
          d += `M${col},${row}h1v1h-1z`;
        }
      }
    }
    return { d, count };
  }, [value]);

  return (
    <svg
      viewBox={`0 0 ${path.count} ${path.count}`}
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="QR code"
    >
      <rect width={path.count} height={path.count} fill="#ffffff" />
      <path d={path.d} fill="#0f172a" />
    </svg>
  );
}
