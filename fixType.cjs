const fs = require('fs');
let code = fs.readFileSync('src/pages/Calculadoras.tsx', 'utf8');

// Use regex to replace the useState type for resultadoPedz
code = code.replace(/useState<\{[\s\S]*?\} \| null>\(null\);/, "useState<any | null>(null);");

fs.writeFileSync('src/pages/Calculadoras.tsx', code);
console.log('fixed');
