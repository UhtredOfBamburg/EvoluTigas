const fs = require('fs');
const content = fs.readFileSync('src/pages/Calculadoras.tsx', 'utf8');

// I will write it by extracting the exact strings.

const getBetween = (str, start, end) => {
  const s = str.indexOf(start);
  if (s === -1) return '';
  const e = str.indexOf(end, s + start.length);
  if (e === -1) return '';
  return str.substring(s, e);
};

const preventState = getBetween(content, '// AHA PREVENT State\n', '  // Pedz / Curvas de Crescimento State\n');
const pedzState = getBetween(content, '  // Pedz / Curvas de Crescimento State\n', '  // IMC State\n');
const imcState = getBetween(content, '  // IMC State\n', '  // Idade Gestacional (DUM) State\n');
const igState = getBetween(content, '  // Idade Gestacional (DUM) State\n', '  // Diurese Pediátrica State\n');
const diureseState = getBetween(content, '  // Diurese Pediátrica State\n', '  // Carga Tabágica State\n');
const tabagismoState = getBetween(content, '  // Carga Tabágica State\n', '\n  return (\n');

const getCard = (startStr) => {
  const s = content.indexOf(startStr);
  if (s === -1) return '';
  
  let depth = 0;
  let curr = s;
  while (curr < content.length) {
    if (content.substr(curr, 5) === '<Card' && content[curr+5] !== 'T') depth++; // avoid CardTitle, CardHeader, CardContent
    if (content.substr(curr, 7) === '</Card>') {
      depth--;
      if (depth === 0) {
        return content.substring(s, curr + 7);
      }
    }
    curr++;
  }
  return '';
};

const preventJsx = getCard('<Card className="border-slate-200 shadow-sm w-full">\n        <CardHeader className="pb-4 border-b border-slate-100 flex flex-row items-center justify-between">');
const pedzJsx = getCard('<Card className="border-slate-200 shadow-sm w-full">\n        <CardHeader className="pb-4 border-b border-slate-100 flex flex-row items-center justify-between">\n          <div>\n            <CardTitle className="text-xl text-slate-800 flex items-center gap-2">\n              <Baby className="w-6 h-6 text-teal-600" />');
const imcJsx = getCard('<Card className="border-teal-200 shadow-sm">\n          <CardHeader className="pb-3 border-b border-slate-100">\n            <CardTitle className="text-lg text-teal-800 flex items-center gap-2">\n              <Activity className="w-5 h-5" /> IMC\n            </CardTitle>');
const igJsx = getCard('<Card className="border-teal-200 shadow-sm">\n          <CardHeader className="pb-3 border-b border-slate-100">\n            <CardTitle className="text-lg text-teal-800 flex items-center gap-2">\n              <Baby className="w-5 h-5" /> Idade Gestacional (DUM)\n            </CardTitle>');
const diureseJsx = getCard('<Card className="border-teal-200 shadow-sm">\n          <CardHeader className="pb-3 border-b border-slate-100">\n            <CardTitle className="text-lg text-teal-800 flex items-center gap-2">\n              <Droplets className="w-5 h-5" /> Taxa de Diurese\n            </CardTitle>');
const tabagismoJsx = getCard('<Card className="border-teal-200 shadow-sm">\n          <CardHeader className="pb-3 border-b border-slate-100">\n            <CardTitle className="text-lg text-teal-800 flex items-center gap-2">\n              <Cigarette className="w-5 h-5" /> Carga Tabágica\n            </CardTitle>');

fs.writeFileSync('prevent_parts.json', JSON.stringify({ preventState, preventJsx, pedzState, pedzJsx, imcState, imcJsx, igState, igJsx, diureseState, diureseJsx, tabagismoState, tabagismoJsx }, null, 2));
console.log('done');
