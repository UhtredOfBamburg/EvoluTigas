import React from 'react';

export const ReceitaSimplesPreview = ({ data }: { data: any }) => {
  return (
    <div id="receita_simples-preview" className="bg-white w-[750px] aspect-[1/1.414] shrink-0 font-sans text-black relative flex flex-col pt-16 pb-16 px-16 shadow-md" style={{ lineHeight: '1.4' }}>
      {/* HEADER */}
      <div className="flex items-center justify-center gap-10 mb-8">
        <div className="flex flex-col items-center">
          <div className="flex items-center text-[#004f9f] font-bold text-3xl tracking-tight">
            <div className="grid grid-cols-3 gap-0.5 mr-2">
              <div className="w-2.5 h-2.5 bg-[#004f9f] rounded-sm"></div>
              <div className="w-2.5 h-2.5 bg-[#004f9f] rounded-sm"></div>
              <div className="w-2.5 h-2.5 bg-[#004f9f] rounded-sm"></div>
              <div className="w-2.5 h-2.5 bg-[#004f9f] rounded-sm"></div>
              <div className="w-2.5 h-2.5 bg-[#004f9f] rounded-sm"></div>
              <div className="w-2.5 h-2.5 bg-[#004f9f] rounded-sm"></div>
            </div>
            UFG
          </div>
          <span className="text-[10px] uppercase text-[#004f9f] leading-tight text-center font-semibold mt-1">Universidade<br/>Federal de Goiás</span>
        </div>
        <div className="flex flex-col items-center text-[#117631]">
          <span className="font-extrabold text-4xl leading-none">HC</span>
          <span className="text-[12px] font-bold mt-1">Hospital das Clínicas</span>
          <span className="text-sm font-extrabold leading-none">UFG</span>
        </div>
        <div className="flex flex-col text-gray-500">
          <span className="font-black text-5xl tracking-tighter leading-none text-[#9eb13b]">EBSERH</span>
          <span className="text-[9px] tracking-widest font-bold mt-1">HOSPITAIS UNIVERSITÁRIOS FEDERAIS</span>
        </div>
      </div>

      <div className="border-b-2 border-black w-full mb-8">
        <h2 className="text-center font-bold text-2xl mb-2 font-serif tracking-widest">RECEITUÁRIO</h2>
      </div>
      
      <p className="text-lg font-bold mb-8 mt-2">PARA: <span className="font-normal uppercase ml-2">{data.nome || ''}</span></p>

      <div className="flex-1 flex flex-col px-4">
        {data.prescricaoType === 'livre' ? (
           <div className="whitespace-pre-wrap" style={{ fontSize: `${data.fontSize || 16}px` }}>{data.prescricao}</div>
        ) : (
           <div className="space-y-6">
             {Array.from(new Set(data.medications?.map((m: any) => m.via))).map(via => (
               <div key={via as string} className="mb-6">
                 <p className="text-center font-medium uppercase mb-4 text-slate-800" style={{ fontSize: `${data.fontSize || 16}px` }}>USO {via as string}</p>
                 {data.medications?.filter((m: any) => m.via === via).map((med: any, idx: number) => (
                   <div key={med.id} className="mb-4" style={{ fontSize: `${data.fontSize || 16}px` }}>
                     <div className="flex justify-between items-end gap-2 w-full">
                       <div className="flex whitespace-nowrap">
                         {idx + 1}) {med.item}
                       </div>
                       <div className="flex-1 border-b border-dashed border-black mb-[5px] mx-2 relative min-w-[20px]"></div>
                       <div className="whitespace-nowrap uppercase">
                         {med.quantidade}
                       </div>
                     </div>
                     <div className="pl-6 mt-2 whitespace-pre-wrap">
                       {med.posologia}
                     </div>
                   </div>
                 ))}
               </div>
             ))}
           </div>
        )}
      </div>

      <div className="mt-auto flex justify-between items-end border-t border-black pt-2 relative pb-2 px-2">
        <div className="text-base font-semibold w-1/3">
          {data.data ? data.data.split('-').reverse().join('/') : ''}
        </div>
        <div className="w-1/3 flex flex-col items-center">
          <div className="w-full border-t border-black mb-1"></div>
          <span className="text-sm">MÉDICO / CRM</span>
        </div>
        <div className="w-1/3"></div>
      </div>
      <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center">
        <span className="text-[11px] text-center font-serif">1ª AVENIDA - S/Nº - SETOR UNIVERSITÁRIO<br/>FONE (62) 3269-8200 - GOIÂNIA/GO</span>
      </div>
    </div>
  );
};
