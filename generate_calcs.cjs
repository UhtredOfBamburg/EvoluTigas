const fs = require('fs');
const parts = JSON.parse(fs.readFileSync('prevent_parts.json', 'utf8'));

const createComponent = (name, stateCode, jsxCode, imports) => {
  const code = `import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label } from '@/components/ui';
${imports}

export function ${name}() {
${stateCode}
  return (
    ${jsxCode.replace(/\n/g, '\n    ')}
  );
}
`;
  fs.writeFileSync(`src/pages/calculadoras/${name}.tsx`, code);
};

createComponent('PreventCalculator', parts.preventState, parts.preventJsx, `import { HeartPulse } from 'lucide-react';\nimport { PREVENT } from '@/lib/prevent';\nimport { PREVENT_COEFFS } from '@/lib/prevent_coeffs';`);
createComponent('PedzCalculator', parts.pedzState, parts.pedzJsx, `import { Baby, RotateCcw } from 'lucide-react';\nimport { calculateAll } from '@pedi-growth/core';\nimport { GrowthChart } from '@/components/GrowthChart';\nimport pediatricCharts from '@/lib/pediatricCharts.json';`);
createComponent('ImcCalculator', parts.imcState, parts.imcJsx, `import { Activity } from 'lucide-react';`);
createComponent('IdadeGestacionalCalculator', parts.igState, parts.igJsx, `import { Baby } from 'lucide-react';`);
createComponent('TaxaDiureseCalculator', parts.diureseState, parts.diureseJsx, `import { Droplets } from 'lucide-react';`);
createComponent('CargaTabagicaCalculator', parts.tabagismoState, parts.tabagismoJsx, `import { Cigarette } from 'lucide-react';`);

// Now write the new Calculadoras.tsx
const newCalculadoras = `import React from 'react';
import { PreventCalculator } from './calculadoras/PreventCalculator';
import { PedzCalculator } from './calculadoras/PedzCalculator';
import { ImcCalculator } from './calculadoras/ImcCalculator';
import { IdadeGestacionalCalculator } from './calculadoras/IdadeGestacionalCalculator';
import { TaxaDiureseCalculator } from './calculadoras/TaxaDiureseCalculator';
import { CargaTabagicaCalculator } from './calculadoras/CargaTabagicaCalculator';

export default function Calculadoras() {
  return (
    <div className="flex-1 overflow-auto bg-slate-50/50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <PreventCalculator />
        <PedzCalculator />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ImcCalculator />
          <IdadeGestacionalCalculator />
          <TaxaDiureseCalculator />
          <CargaTabagicaCalculator />
        </div>
      </div>
    </div>
  );
}
`;

fs.writeFileSync('src/pages/Calculadoras.tsx', newCalculadoras);
console.log('Generated successfully');
