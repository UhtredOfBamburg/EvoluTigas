const fs = require('fs');
let code = fs.readFileSync('src/pages/calculadoras/PedzCalculator.tsx', 'utf8');

const replacement = `
    let mediaEstatura = 50;
    if (totalMeses <= 12) mediaEstatura = 50 + totalMeses * (25.0 / 12.0);
    else if (totalMeses <= 24) mediaEstatura = 75 + (totalMeses - 12) * (12.0 / 12.0);
    else mediaEstatura = 87 + (totalMeses - 24) * (6.5 / 12.0);

    let mediaPeso = 3.3;
    if (totalMeses <= 12) mediaPeso = 3.3 + totalMeses * (6.0 / 12.0);
    else if (totalMeses <= 24) mediaPeso = 9.3 + (totalMeses - 12) * (2.7 / 12.0);
    else mediaPeso = 12.0 + (totalMeses - 24) * (2.0 / 12.0);

    let mediaPerimetro = 35;
    if (totalMeses <= 12) mediaPerimetro = 35 + totalMeses * (12.0 / 12.0);
    else mediaPerimetro = 47 + (totalMeses - 12) * 0.2;

    const sdEstatura = mediaEstatura * 0.04; 
    const sdPeso = mediaPeso * 0.12;
    const sdPerimetro = mediaPerimetro * 0.03;
`;

// regex to replace the old logic
const target = `    // Valores médios simulados baseados na idade (muito aproximados, apenas para visualização de interface)
    const mediaEstatura = isOMS \\? \\(50 \\+ totalMeses \\* \\(isMasculino \\? 2.5 : 2.4\\)\\) : \\(48 \\+ totalMeses \\* 2.0\\);
    const sdEstatura = mediaEstatura \\* 0.04; 

    const mediaPeso = isOMS \\? \\(3.3 \\+ totalMeses \\* \\(isMasculino \\? 0.6 : 0.55\\)\\) : \\(3.0 \\+ totalMeses \\* 0.5\\);
    const sdPeso = mediaPeso \\* 0.12;

    const mediaPerimetro = isOMS \\? \\(35 \\+ totalMeses \\* \\(isMasculino \\? 0.8 : 0.75\\)\\) : \\(34 \\+ totalMeses \\* 0.7\\);
    const sdPerimetro = mediaPerimetro \\* 0.03;`;

const match = new RegExp(target);
code = code.replace(match, replacement.trim());
fs.writeFileSync('src/pages/Calculadoras.tsx', code);
console.log('replaced:', code.includes('mediaEstatura = 50 + totalMeses'));
