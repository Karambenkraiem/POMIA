// Type declarations for the vendored qrcode-generator library (src/lib/qrcode-generator.js).
// Source: https://github.com/kazuhikoarase/qrcode-generator (MIT license)

export type QRErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

export interface QRCode {
  addData(data: string): void;
  make(): void;
  getModuleCount(): number;
  isDark(row: number, col: number): boolean;
}

declare function qrcode(typeNumber: number, errorCorrectionLevel: QRErrorCorrectionLevel): QRCode;

export default qrcode;
