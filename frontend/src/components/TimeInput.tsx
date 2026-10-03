import { forwardRef } from 'react';

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  className?: string;
  disabled?: boolean;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

const TimeInput = forwardRef<HTMLInputElement, TimeInputProps>(function TimeInput(
  { value, onChange, onKeyDown, className, disabled },
  ref
) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
    const next = digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
    onChange(next);
  }

  function handleBlur() {
    const [h, m] = value.split(':');
    if (h === undefined) return;
    const hh = clamp(Number(h) || 0, 0, 23);
    const mm = m !== undefined ? clamp(Number(m) || 0, 0, 59) : 0;
    onChange(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
  }

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={onKeyDown}
      disabled={disabled}
      placeholder="HH:MM"
      maxLength={5}
      className={className}
    />
  );
});

export default TimeInput;
