import React, { useState } from 'react';
import { Card, CardContent, Label } from '@/components/ui';
import { ChevronRight } from 'lucide-react';

export const SelectField = ({ label, value, onChange, options, className = "" }: any) => (
  <div className={`space-y-1.5 ${className}`}>
    <Label className="text-xs text-slate-500">{label}</Label>
    <select 
      className="w-full h-8 text-xs rounded border-slate-200 bg-transparent px-2 shadow-sm focus:ring-teal-500 focus:border-teal-500"
      value={value} 
      onChange={e => onChange(e.target.value)}
    >
      {options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
    </select>
  </div>
);

export const ToggleButtons = ({ options, value, onChange, className = "" }: any) => (
  <div className={`flex flex-wrap gap-2 ${className}`}>
    {options.map((opt: string) => (
      <button
        key={opt}
        type="button"
        className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
          value === opt
            ? 'bg-teal-600 text-white border-teal-600'
            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
        }`}
        onClick={() => onChange(opt)}
      >
        {opt}
      </button>
    ))}
  </div>
);

export const MultiSelectButtons = ({ options, value = [], onChange, exclusiveOption = null, className = "" }: any) => (
  <div className={`flex flex-wrap gap-2 ${className}`}>
    {options.map((opt: string) => (
      <button
        key={opt}
        type="button"
        className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
          value.includes(opt)
            ? 'bg-teal-600 text-white border-teal-600'
            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
        }`}
        onClick={() => {
          if (opt === exclusiveOption) {
            onChange([opt]);
          } else {
            let newValue = value.includes(opt) 
              ? value.filter((v: string) => v !== opt) 
              : [...value.filter((v: string) => v !== exclusiveOption), opt];
            if (newValue.length === 0 && exclusiveOption) {
              newValue = [exclusiveOption];
            }
            onChange(newValue);
          }
        }}
      >
        {opt}
      </button>
    ))}
  </div>
);

export const SectionCard = ({ title, defaultOpen = false, children }: any) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <Card className="mb-4 overflow-hidden shadow-sm border-slate-200 transition-all">
      <div 
        className="bg-slate-50 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors border-b border-transparent"
        onClick={() => setIsOpen(!isOpen)}
        style={{ borderBottomColor: isOpen ? '#e2e8f0' : 'transparent' }}
      >
        <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
          {title}
        </h3>
        <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
      </div>
      {isOpen && (
        <CardContent className="p-4 bg-white">
          {children}
        </CardContent>
      )}
    </Card>
  );
};
