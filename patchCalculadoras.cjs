const fs = require('fs');
let code = fs.readFileSync('src/pages/Calculadoras.tsx', 'utf8');

// 1. Imports
const imports = `import pediatricCharts from '@/lib/pediatricCharts.json';
import { GrowthChart } from '@/components/GrowthChart';
`;
code = code.replace("import { Activity, Baby", imports + "import { Activity, Baby");

// 2. State update for resultadoPedz (line 179 approx)
code = code.replace(
  "setResultadoPedz({",
  "setResultadoPedz({\n      totalMeses,\n      sexo: sexoPedz,\n      estatura: estaturaPedz ? parseFloat(estaturaPedz) : null,\n      peso: pPesoKilos,\n      "
);

// 3. Render charts
const renderCharts = `
              </div>
              
              <div className="mt-8 space-y-6 border-t border-slate-100 pt-6">
                <h3 className="font-semibold text-slate-800 text-lg">Curvas de Crescimento ({resultadoPedz.sexo === 'M' ? 'Meninos' : 'Meninas'})</h3>
                <div className="flex flex-wrap gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#10b981]"></div>
                    <span className="text-xs text-slate-600">P50 (Mediana)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#f59e0b]"></div>
                    <span className="text-xs text-slate-600">P15 e P85</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#ef4444]"></div>
                    <span className="text-xs text-slate-600">P3 e P97</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#3b82f6] border border-white"></div>
                    <span className="text-xs text-slate-600 font-medium">Paciente</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {resultadoPedz.totalMeses <= 60 ? (
                    <>
                      <GrowthChart 
                        title="Estatura por Idade (0-5 anos)"
                        xAxisLabel="Idade (meses)"
                        yAxisLabel="Estatura (cm)"
                        data={resultadoPedz.sexo === 'M' ? pediatricCharts.boys0to5.height : pediatricCharts.girls0to5.height}
                        patientData={resultadoPedz.estatura ? { age: resultadoPedz.totalMeses, value: resultadoPedz.estatura } : null}
                      />
                      <GrowthChart 
                        title="Peso por Idade (0-5 anos)"
                        xAxisLabel="Idade (meses)"
                        yAxisLabel="Peso (kg)"
                        data={resultadoPedz.sexo === 'M' ? pediatricCharts.boys0to5.weight : pediatricCharts.girls0to5.weight}
                        patientData={resultadoPedz.peso ? { age: resultadoPedz.totalMeses, value: resultadoPedz.peso } : null}
                      />
                    </>
                  ) : (
                    <>
                      <GrowthChart 
                        title="Estatura por Idade (5-19 anos)"
                        xAxisLabel="Idade (anos)"
                        yAxisLabel="Estatura (cm)"
                        data={resultadoPedz.sexo === 'M' ? pediatricCharts.boys5to19.height : pediatricCharts.girls5to19.height}
                        patientData={resultadoPedz.estatura ? { age: resultadoPedz.totalMeses / 12, value: resultadoPedz.estatura } : null}
                      />
                      <GrowthChart 
                        title="Peso por Idade (5-19 anos)"
                        xAxisLabel="Idade (anos)"
                        yAxisLabel="Peso (kg)"
                        data={resultadoPedz.sexo === 'M' ? pediatricCharts.boys5to19.weight : pediatricCharts.girls5to19.weight}
                        patientData={resultadoPedz.peso ? { age: resultadoPedz.totalMeses / 12, value: resultadoPedz.peso } : null}
                      />
                    </>
                  )}
                </div>
`;

code = code.replace(
  "                  </div>\n                )}\n              </div>\n            </div>",
  "                  </div>\n                )}\n              </div>\n" + renderCharts + "\n            </div>"
);

fs.writeFileSync('src/pages/Calculadoras.tsx', code);
console.log('patched');
