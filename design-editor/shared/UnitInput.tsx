'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { parseValue, convertUnit, formatValue, UNIT_OPTIONS, type CSSUnit, type ConversionContext } from './unit-utils';

interface UnitInputProps {
  value: string;
  onChange: (value: string) => void;
  units?: CSSUnit[];
  conversionContext?: ConversionContext;
  placeholder?: string;
  className?: string;
}

export default function UnitInput({
  value,
  onChange,
  units = ['px', 'rem', '%', 'auto'],
  conversionContext,
  placeholder = '—',
  className = '',
}: UnitInputProps) {
  const parsed = parseValue(value);
  const [localNum, setLocalNum] = useState<string>(parsed.number !== null ? String(parsed.number) : '');
  const [currentUnit, setCurrentUnit] = useState<CSSUnit>(parsed.unit === 'none' ? 'px' : parsed.unit);
  const dragRef = useRef<{ startY: number; startValue: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync from external value changes
  useEffect(() => {
    const p = parseValue(value);
    setLocalNum(p.number !== null ? String(p.number) : '');
    if (p.unit !== 'none') setCurrentUnit(p.unit);
  }, [value]);

  const commit = useCallback((num: string, unit: CSSUnit) => {
    if (unit === 'auto') {
      onChange('auto');
      return;
    }
    const n = parseFloat(num);
    if (isNaN(n)) {
      onChange('');
      return;
    }
    onChange(formatValue(n, unit));
  }, [onChange]);

  const handleNumChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalNum(e.target.value);
  }, []);

  const handleNumBlur = useCallback(() => {
    commit(localNum, currentUnit);
  }, [localNum, currentUnit, commit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commit(localNum, currentUnit);
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const delta = e.key === 'ArrowUp' ? step : -step;
      const current = parseFloat(localNum) || 0;
      const next = String(Math.round((current + delta) * 100) / 100);
      setLocalNum(next);
      commit(next, currentUnit);
    }
  }, [localNum, currentUnit, commit]);

  const handleUnitChange = useCallback((newUnit: CSSUnit) => {
    if (newUnit === currentUnit) return;
    if (newUnit === 'auto') {
      setCurrentUnit(newUnit);
      onChange('auto');
      return;
    }
    const num = parseFloat(localNum);
    if (!isNaN(num) && currentUnit !== 'auto') {
      const converted = convertUnit(num, currentUnit, newUnit, conversionContext);
      setLocalNum(String(converted));
      setCurrentUnit(newUnit);
      commit(String(converted), newUnit);
    } else {
      setCurrentUnit(newUnit);
    }
  }, [currentUnit, localNum, conversionContext, commit, onChange]);

  // Scrub-to-change: drag vertically on the label to change value
  const handleScrubStart = useCallback((e: React.PointerEvent) => {
    const num = parseFloat(localNum) || 0;
    dragRef.current = { startY: e.clientY, startValue: num };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    document.body.style.cursor = 'ns-resize';
  }, [localNum]);

  const handleScrubMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const delta = dragRef.current.startY - e.clientY;
    const step = e.shiftKey ? 10 : 1;
    const next = String(Math.round((dragRef.current.startValue + delta * step / 5) * 100) / 100);
    setLocalNum(next);
    commit(next, currentUnit);
  }, [currentUnit, commit]);

  const handleScrubEnd = useCallback(() => {
    dragRef.current = null;
    document.body.style.cursor = '';
  }, []);

  const filteredUnits = UNIT_OPTIONS.filter((u) => units.includes(u.value));

  if (currentUnit === 'auto') {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <span className="text-[11px] text-stone-400 px-1.5">auto</span>
        <select
          value={currentUnit}
          onChange={(e) => handleUnitChange(e.target.value as CSSUnit)}
          className="text-[10px] text-stone-400 bg-transparent border-none outline-none cursor-pointer py-0.5"
        >
          {filteredUnits.map((u) => (
            <option key={u.value} value={u.value}>{u.label}</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      <input
        ref={inputRef}
        type="text"
        value={localNum}
        onChange={handleNumChange}
        onBlur={handleNumBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-[52px] px-1.5 py-1 text-[11px] bg-stone-50 border border-stone-200 rounded-lg text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:ring-1 focus:ring-stone-400/15 outline-none text-right tabular-nums"
      />
      {/* Scrub label — drag vertically to adjust value */}
      <span
        onPointerDown={handleScrubStart}
        onPointerMove={handleScrubMove}
        onPointerUp={handleScrubEnd}
        className="text-[10px] text-stone-400 cursor-ns-resize select-none px-0.5"
      >
        ↕
      </span>
      <select
        value={currentUnit}
        onChange={(e) => handleUnitChange(e.target.value as CSSUnit)}
        className="text-[10px] text-stone-400 bg-transparent border-none outline-none cursor-pointer py-0.5 min-w-[24px]"
      >
        {filteredUnits.map((u) => (
          <option key={u.value} value={u.value}>{u.label}</option>
        ))}
      </select>
    </div>
  );
}
