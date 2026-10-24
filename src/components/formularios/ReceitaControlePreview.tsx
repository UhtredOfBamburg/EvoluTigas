import React from 'react';

const Half = ({ data, via }: { data: any, via: string }) => {
  return (
    <div className="flex-1 flex flex-col pt-6 pb-2 px-10 relative overflow-hidden" style={{ lineHeight: '1.4' }}>
      {/* HEADER - SCALED DOWN 50% */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-5">
          <div className="flex flex-col items-center">
            <div className="flex items-center text-[#004f9f] font-bold text-xl tracking-tight">
              <div className="grid grid-cols-3 gap-0.5 mr-1">
                <div className="w-1.5 h-1.5 bg-[#004f9f] rounded-sm"></div>
                <div className="w-1.5 h-1.5 bg-[#004f9f] rounded-sm"></div>
                <div className="w-1.5 h-1.5 bg-[#004f9f] rounded-sm"></div>
                <div className="w-1.5 h-1.5 bg-[#004f9f] rounded-sm"></div>
                <div className="w-1.5 h-1.5 bg-[#004f9f] rounded-sm"></div>
                <div className="w-1.5 h-1.5 bg-[#004f9f] rounded-sm"></div>
              </div>
              UFG
            </div>
            <span className="text-[7px] uppercase text-[#004f9f] leading-tight text-center font-semibold mt-0.5">Universidade<br/>Federal de Goiás</span>
          </div>
          <div className="flex flex-col items-center text-[#117631]">
            <span className="font-extrabold text-2xl leading-none">HC</span>
            <span className="text-[8px] font-bold mt-0.5">Hospital das Clínicas</span>
            <span className="text-[9px] font-extrabold leading-none">UFG</span>
          </div>
          <div className="flex flex-col text-gray-500">
            <span className="font-black text-3xl tracking-tighter leading-none text-[#9eb13b]">EBSERH</span>
            <span className="text-[6px] tracking-widest font-bold mt-0.5">HOSPITAIS UNIVERSITÁRIOS FEDERAIS</span>
          </div>
        </div>
        <div className="text-right">
          <h2 className="font-bold text-base leading-tight uppercase font-serif tracking-widest text-slate-800">Receituário de<br/>Controle Especial</h2>
          <p className="text-[9px] text-gray-600 font-bold mt-1">{via}</p>
        </div>
      </div>
      
      <div className="border-b border-black w-full mb-3"></div>

      {/* IDENTIFICAÇÃO DO EMITENTE / USUARIO - SCALED */}
      <div className="grid grid-cols-2 gap-3 mb-3 border border-black p-2 bg-slate-50">
        <div>
          <p className="text-[8px] font-bold text-gray-500 mb-1">IDENTIFICAÇÃO DO EMITENTE</p>
          <div className="h-8"></div>
        </div>
        <div className="border-l border-black pl-2">
          <p className="text-[8px] font-bold text-gray-500 mb-1">IDENTIFICAÇÃO DO USUÁRIO</p>
          <p className="text-xs font-bold uppercase truncate">Nome: <span className="font-normal">{data.nome || ' '}</span></p>
          <p className="text-xs font-bold uppercase truncate mt-1">End: <span className="font-normal">___________________________</span></p>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col px-2 overflow-hidden">
        {data.prescricaoType === 'livre' ? (
           <div className="whitespace-pre-wrap" style={{ fontSize: `${(data.fontSize || 16) * 0.7}px` }}>{data.prescricao}</div>
        ) : (
           <div className="space-y-3">
             {Array.from(new Set(data.medications?.map((m: any) => m.via))).map(viaType => (
               <div key={viaType as string} className="mb-3">
                 <p className="text-center font-medium uppercase mb-2 text-slate-800" style={{ fontSize: `${(data.fontSize || 16) * 0.7}px` }}>USO {viaType as string}</p>
                 {data.medications?.filter((m: any) => m.via === viaType).map((med: any, idx: number) => (
                   <div key={med.id} className="mb-2" style={{ fontSize: `${(data.fontSize || 16) * 0.7}px` }}>
                     <div className="flex justify-between items-end gap-1 w-full">
                       <div className="flex whitespace-nowrap">
                         {idx + 1}) {med.item}
                       </div>
                       <div className="flex-1 border-b border-dashed border-black mb-[3px] mx-2 relative min-w-[10px]"></div>
                       <div className="whitespace-nowrap uppercase">
                         {med.quantidade}
                       </div>
                     </div>
                     <div className="pl-4 mt-1 whitespace-pre-wrap">
                       {med.posologia}
                     </div>
                   </div>
                 ))}
               </div>
             ))}
           </div>
        )}
      </div>

      <div className="mt-auto grid grid-cols-2 gap-3 border border-black p-2 mb-2 bg-slate-50">
        <div>
          <p className="text-[8px] font-bold text-gray-500 mb-2">IDENTIFICAÇÃO DO COMPRADOR</p>
          <div className="space-y-2 text-[9px]">
            <p>Nome: _____________________________________</p>
            <p>RG: _________________ Orgão Emissor: _______</p>
            <p>Endereço: __________________________________</p>
            <p>Cidade: _______________________ UF: _________</p>
            <p>Telefone: ___________________________________</p>
          </div>
        </div>
        <div className="border-l border-black pl-2">
          <p className="text-[8px] font-bold text-gray-500 mb-2">IDENTIFICAÇÃO DO FORNECEDOR</p>
          <div className="space-y-2 text-[9px] flex flex-col h-full">
            <p className="mb-auto">Data: ___/___/___</p>
            <div className="mt-auto">
              <p>___________________________________________</p>
              <p className="text-center mt-1">Assinatura do Farmacêutico</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-end mt-1 px-2 border-t border-black pt-2">
        <div className="text-xs font-semibold w-1/3">
          {data.data ? data.data.split('-').reverse().join('/') : ''}
        </div>
        <div className="w-1/3 flex flex-col items-center">
          <div className="w-full border-t border-black mb-1"></div>
          <span className="text-[9px]">MÉDICO / CRM</span>
        </div>
        <div className="w-1/3 flex justify-end">
           <span className="text-[8px] text-right font-serif">1ª AVENIDA - S/Nº - SETOR UNIVERSITÁRIO<br/>FONE (62) 3269-8200 - GOIÂNIA/GO</span>
        </div>
      </div>
    </div>
  );
};

export const ReceitaControlePreview = ({ data }: { data: any }) => {
  return (
    <div id="receita_controle-preview" className="bg-white w-[750px] aspect-[1/1.414] shrink-0 font-sans text-black relative flex flex-col shadow-md">
      <Half data={data} via="1ª VIA - RETENÇÃO DA FARMÁCIA" />
      <div className="w-full border-b border-dashed border-gray-400"></div>
      <Half data={data} via="2ª VIA - ORIENTAÇÃO AO PACIENTE" />
    </div>
  );
};
