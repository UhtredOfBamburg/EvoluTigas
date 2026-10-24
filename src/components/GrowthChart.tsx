import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

export function GrowthChart({ data, title, xAxisLabel, yAxisLabel, patientData }) {
  // If patientData is provided, we can add it as an extra series or just as a ReferenceDot.
  // For simplicity, let's just render the standard curves.
  // patientData should be { age: number, value: number }
  
  const combinedData = [...data];
  
  // If we have a patient data point, we can insert it or just render it differently.
  // Actually, recharts allows mixing data or adding a separate scatter/line.
  // We'll just add the patient value to the exact age bin if possible, or create a custom dot.

  return (
    <div className="h-64 w-full mt-4">
      <h3 className="text-center font-medium text-sm text-slate-700 mb-2">{title}</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={combinedData} margin={{ top: 5, right: 20, left: 0, bottom: 15 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis 
            dataKey="age" 
            type="number"
            domain={['dataMin', 'dataMax']}
            label={{ value: xAxisLabel, position: 'insideBottom', offset: -10, style: { fontSize: 12, fill: '#64748b' } }} 
            tick={{ fontSize: 12, fill: '#64748b' }}
          />
          <YAxis 
            domain={['auto', 'auto']}
            label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#64748b' } }} 
            tick={{ fontSize: 12, fill: '#64748b' }}
          />
          <Tooltip 
            formatter={(value) => value.toFixed(1)} 
            labelFormatter={(label) => `${label} ${xAxisLabel.includes('meses') ? 'meses' : 'anos'}`} 
          />
          <Legend wrapperStyle={{ fontSize: '11px' }} />
          <Line type="monotone" dataKey="p3" name="P3" stroke="#ef4444" strokeWidth={1} dot={false} />
          <Line type="monotone" dataKey="p15" name="P15" stroke="#f59e0b" strokeWidth={1} dot={false} />
          <Line type="monotone" dataKey="p50" name="P50" stroke="#10b981" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="p85" name="P85" stroke="#f59e0b" strokeWidth={1} dot={false} />
          <Line type="monotone" dataKey="p97" name="P97" stroke="#ef4444" strokeWidth={1} dot={false} />
          
          {/* Render patient data if present */}
          {patientData && (
             <Line 
               dataKey="patientValue" 
               name="Paciente" 
               stroke="#3b82f6" 
               strokeWidth={0} 
               dot={{ r: 5, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} 
               activeDot={{ r: 7 }} 
               data={[{ age: patientData.age, patientValue: patientData.value }]}
             />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
