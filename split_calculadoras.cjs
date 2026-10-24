const fs = require('fs');

const code = fs.readFileSync('src/pages/Calculadoras.tsx', 'utf8');

const lines = code.split('\n');

const extractSection = (startMarker, endMarker, isJsx = false) => {
  let inSection = false;
  let sectionLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(startMarker)) inSection = true;
    if (endMarker && lines[i].includes(endMarker)) {
      if (!isJsx) inSection = false;
      else {
        sectionLines.push(lines[i]); // include the end marker for JSX (like </Card>)
        inSection = false;
        continue;
      }
    }
    
    if (inSection) {
      sectionLines.push(lines[i]);
    }
  }
  return sectionLines.join('\n');
};

// 1. PREVENT
const preventState = extractSection('// AHA PREVENT State', '// Pedz');
const preventJsx = extractSection('<Card className="border-slate-200 shadow-sm w-full">', '</Card>', true).split('</Card>')[0] + '</Card>';

// 2. PedZ
const pedzState = extractSection('// Pedz / Curvas de Crescimento State', '// IMC State');
const pedzJsx = extractSection('<Card className="border-slate-200 shadow-sm w-full">', '</Card>', true).split('</Card>').slice(1).join('</Card>').split('</Card>')[0] + '</Card>';

// ... wait, regex is safer.

