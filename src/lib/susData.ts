export interface Cid10Item {
  code: string; // e.g. "J18.9"
  rawCode: string; // e.g. "J189"
  description: string;
}

export interface SigtapItem {
  code: string; // 10 raw digits, e.g. "0303140151"
  formattedCode: string; // e.g. "03.03.14.015-1"
  name: string;
  aihFlag: 0 | 1 | 2; // 1 = AIH Principal (03), 2 = AIH Especial/Sec (04/05), 0 = Outros
  compatibleWithCid?: boolean;
}

export interface MunicipioIbgeItem {
  ibge7: string;
  ibge6: string;
  nome: string;
  uf: string;
}

export interface CnesItem {
  cnes: string; // 7 digits padded
  nome: string;
  municipio: string;
  uf: string;
  tipo?: number;
  source?: 'local' | 'live';
}

export interface ViaCepResult {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
}

export function normalizeSusText(input: string): string {
  return (input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatSigtapCode(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.length !== 10) return raw;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function getDataBaseUrl(): string {
  const base = (import.meta as any).env?.BASE_URL || '/';
  return base.endsWith('/') ? base : `${base}/`;
}

// Lazy singleton loaders with promise deduplication
let cidPromise: Promise<Array<Cid10Item & { _search: string }>> | null = null;
let sigtapPromise: Promise<Array<SigtapItem & { _search: string }>> | null = null;
let sigtapCidMapPromise: Promise<Record<string, number[]>> | null = null;
let municipiosPromise: Promise<Array<MunicipioIbgeItem & { _search: string; _normNome: string }>> | null = null;
let cnesGoPromise: Promise<Array<CnesItem & { _search: string }>> | null = null;

async function loadCid10(): Promise<Array<Cid10Item & { _search: string }>> {
  if (!cidPromise) {
    cidPromise = fetch(`${getDataBaseUrl()}data/cid10.json`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: [string, string][]) =>
        rows.map(([code, description]) => {
          const rawCode = code.replace(/\./g, '').toUpperCase();
          return {
            code,
            rawCode,
            description,
            _search: `${rawCode.toLowerCase()} ${code.toLowerCase()} ${normalizeSusText(description)}`,
          };
        })
      )
      .catch(() => {
        cidPromise = null;
        return [];
      });
  }
  return cidPromise;
}

async function loadSigtap(): Promise<Array<SigtapItem & { _search: string }>> {
  if (!sigtapPromise) {
    sigtapPromise = fetch(`${getDataBaseUrl()}data/sigtap.json`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: [string, string, 0 | 1 | 2][]) =>
        rows.map(([code, name, aihFlag]) => {
          const formattedCode = formatSigtapCode(code);
          return {
            code,
            formattedCode,
            name,
            aihFlag,
            _search: `${code} ${normalizeSusText(name)}`,
          };
        })
      )
      .catch(() => {
        sigtapPromise = null;
        return [];
      });
  }
  return sigtapPromise;
}

async function loadSigtapCidMap(): Promise<Record<string, number[]>> {
  if (!sigtapCidMapPromise) {
    sigtapCidMapPromise = fetch(`${getDataBaseUrl()}data/sigtap-cid-aih.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => {
        sigtapCidMapPromise = null;
        return {};
      });
  }
  return sigtapCidMapPromise;
}

async function loadMunicipios(): Promise<
  Array<MunicipioIbgeItem & { _search: string; _normNome: string }>
> {
  if (!municipiosPromise) {
    municipiosPromise = fetch(`${getDataBaseUrl()}data/municipios-ibge.json`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: [string, string, string][]) =>
        rows.map(([ibge7, nome, uf]) => {
          const normNome = normalizeSusText(nome);
          return {
            ibge7,
            ibge6: ibge7.slice(0, 6),
            nome,
            uf,
            _normNome: normNome,
            _search: `${normNome} ${uf.toLowerCase()} ${ibge7}`,
          };
        })
      )
      .catch(() => {
        municipiosPromise = null;
        return [];
      });
  }
  return municipiosPromise;
}

async function loadCnesGo(): Promise<Array<CnesItem & { _search: string }>> {
  if (!cnesGoPromise) {
    cnesGoPromise = fetch(`${getDataBaseUrl()}data/cnes-go.json`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: [string, string, string, string, number][]) =>
        rows.map(([cnes, nome, municipio, uf, tipo]) => {
          const aliases =
            cnes === '2338424'
              ? ' hc hcufg hc ufg hospital das clinicas ufg ebserh'
              : cnes === '7743068'
              ? ' hugol'
              : cnes === '2338262'
              ? ' hugo'
              : cnes === '2338734'
              ? ' hgg alberto rassi'
              : cnes === '2506661'
              ? ' hdt doencas tropicais'
              : cnes === '2673932'
              ? ' crer'
              : '';
          return {
            cnes,
            nome,
            municipio,
            uf,
            tipo,
            source: 'local' as const,
            _search: `${cnes} ${Number(cnes)} ${normalizeSusText(nome)} ${normalizeSusText(municipio)} ${uf.toLowerCase()}${aliases}`,
          };
        })
      )
      .catch(() => {
        cnesGoPromise = null;
        return [];
      });
  }
  return cnesGoPromise;
}

export async function searchCid10(query: string, limit = 15): Promise<Cid10Item[]> {
  const list = await loadCid10();
  const qRaw = (query || '').trim();
  if (!qRaw) return [];

  const qCode = qRaw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const tokens = normalizeSusText(qRaw).split(' ').filter(Boolean);
  if (tokens.length === 0) return [];

  const scored: Array<{ score: number; item: Cid10Item }> = [];

  for (const item of list) {
    if (qCode && item.rawCode === qCode) {
      scored.push({ score: 1000, item });
      continue;
    }
    if (qCode.length >= 2 && item.rawCode.startsWith(qCode)) {
      scored.push({ score: 800 - item.rawCode.length, item });
      continue;
    }
    if (tokens.every((t) => item._search.includes(t))) {
      const descNorm = normalizeSusText(item.description);
      const starts = descNorm.startsWith(tokens[0]) ? 120 : 0;
      const isSub = item.rawCode.length === 4 ? 20 : 10;
      scored.push({ score: 300 + starts + isSub - item.description.length * 0.1, item });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.item.code.localeCompare(b.item.code));
  return scored.slice(0, limit).map((s) => ({
    code: s.item.code,
    rawCode: s.item.rawCode,
    description: s.item.description,
  }));
}

export async function searchSigtap(
  query: string,
  options?: { cidCode?: string; prioritizeAih?: boolean; limit?: number }
): Promise<SigtapItem[]> {
  const [list, cidMap] = await Promise.all([
    loadSigtap(),
    options?.cidCode ? loadSigtapCidMap() : Promise.resolve({} as Record<string, number[]>),
  ]);

  const limit = options?.limit ?? 18;
  const prioritizeAih = options?.prioritizeAih !== false;

  // Build set of compatible indices for the currently selected CID-10 Principal
  const compatibleIndices = new Set<number>();
  if (options?.cidCode) {
    const cleanCid = options.cidCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (cleanCid.length >= 3) {
      const exact = cidMap[cleanCid];
      if (exact) exact.forEach((i) => compatibleIndices.add(i));
      if (compatibleIndices.size === 0 && cleanCid.length === 4) {
        const cat = cidMap[cleanCid.slice(0, 3)];
        if (cat) cat.forEach((i) => compatibleIndices.add(i));
      }
    }
  }

  const qRaw = (query || '').trim();
  if (!qRaw) {
    if (compatibleIndices.size > 0) {
      return Array.from(compatibleIndices)
        .slice(0, limit)
        .map((idx) => {
          const p = list[idx];
          return {
            code: p.code,
            formattedCode: p.formattedCode,
            name: p.name,
            aihFlag: p.aihFlag,
            compatibleWithCid: true,
          };
        });
    }
    return [];
  }

  const digits = qRaw.replace(/\D/g, '');
  const tokens = normalizeSusText(qRaw).split(' ').filter(Boolean);
  if (tokens.length === 0 && !digits) return [];

  const scored: Array<{ score: number; item: SigtapItem }> = [];

  for (let idx = 0; idx < list.length; idx++) {
    const item = list[idx];
    const isCompat = compatibleIndices.has(idx);
    const aihBonus = prioritizeAih ? (item.aihFlag === 1 ? 260 : item.aihFlag === 2 ? 120 : 0) : 0;
    const compatBonus = isCompat ? 320 : 0;

    if (digits.length >= 2 && item.code.startsWith(digits)) {
      const exactBonus = item.code === digits ? 500 : 250;
      scored.push({
        score: 700 + exactBonus + aihBonus + compatBonus,
        item: {
          code: item.code,
          formattedCode: item.formattedCode,
          name: item.name,
          aihFlag: item.aihFlag,
          compatibleWithCid: isCompat,
        },
      });
      continue;
    }

    if (tokens.length > 0 && tokens.every((t) => item._search.includes(t))) {
      const normName = normalizeSusText(item.name);
      const starts = normName.startsWith(tokens[0]) ? 90 : 0;
      scored.push({
        score: 200 + starts + aihBonus + compatBonus - item.name.length * 0.05,
        item: {
          code: item.code,
          formattedCode: item.formattedCode,
          name: item.name,
          aihFlag: item.aihFlag,
          compatibleWithCid: isCompat,
        },
      });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.item.code.localeCompare(b.item.code));
  return scored.slice(0, limit).map((s) => s.item);
}

const PRIORITY_CITIES = new Set([
  '5208707', // Goiânia
  '5201405', // Aparecida de Goiânia
  '5201108', // Anápolis
  '5218805', // Rio Verde
  '5212501', // Luziânia
  '5200258', // Águas Lindas de Goiás
  '5221858', // Valparaíso de Goiás
  '5221403', // Trindade
  '5208004', // Formosa
  '5219753', // Senador Canedo
  '5300108', // Brasília
  '3550308', // São Paulo
  '3304557', // Rio de Janeiro
  '3106200', // Belo Horizonte
]);

export async function searchMunicipios(query: string, limit = 12): Promise<MunicipioIbgeItem[]> {
  const list = await loadMunicipios();
  const qRaw = (query || '').trim();
  if (!qRaw) {
    return list
      .filter((m) => PRIORITY_CITIES.has(m.ibge7))
      .slice(0, limit)
      .map(({ ibge7, ibge6, nome, uf }) => ({ ibge7, ibge6, nome, uf }));
  }

  const qNorm = normalizeSusText(qRaw);
  const tokens = qNorm.split(' ').filter(Boolean);
  if (tokens.length === 0) return [];

  const scored: Array<{ score: number; item: MunicipioIbgeItem }> = [];

  for (const item of list) {
    if (item.ibge7 === qNorm || item.ibge6 === qNorm) {
      scored.push({ score: 1200, item });
      continue;
    }
    if (tokens.every((t) => item._search.includes(t))) {
      let score = 200;
      if (item._normNome === qNorm) score += 600;
      else if (item._normNome.startsWith(tokens[0])) score += 300;
      if (item.uf === 'GO') score += 80;
      if (PRIORITY_CITIES.has(item.ibge7)) score += 60;
      scored.push({ score, item });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.item.nome.localeCompare(b.item.nome));
  return scored.slice(0, limit).map((s) => ({
    ibge7: s.item.ibge7,
    ibge6: s.item.ibge6,
    nome: s.item.nome,
    uf: s.item.uf,
  }));
}

const FEATURED_GO_CNES = [
  '2338424', // HC-UFG
  '7743068', // HUGOL
  '2338262', // HUGO
  '2338734', // HGG
  '2506661', // HDT
  '2673932', // CRER
  '2338351', // Santa Casa
];

export async function searchCnes(query: string, limit = 14): Promise<CnesItem[]> {
  const [localList, municipios] = await Promise.all([loadCnesGo(), loadMunicipios()]);
  const qRaw = (query || '').trim();

  if (!qRaw) {
    const featured = FEATURED_GO_CNES.map((code) => localList.find((x) => x.cnes === code)).filter(
      Boolean
    ) as CnesItem[];
    return featured.slice(0, limit);
  }

  const digits = qRaw.replace(/\D/g, '');
  const tokens = normalizeSusText(qRaw).split(' ').filter(Boolean);

  // 1. Instant offline search over 1,487 Goiás establishments
  const scored: Array<{ score: number; item: CnesItem }> = [];
  for (const item of localList) {
    if (digits.length >= 4 && (item.cnes.startsWith(digits) || String(Number(item.cnes)).startsWith(digits))) {
      scored.push({ score: item.cnes === digits.padStart(7, '0') ? 1500 : 900, item });
      continue;
    }
    if (tokens.length > 0 && tokens.every((t) => item._search.includes(t))) {
      let score = 300;
      const featuredIdx = FEATURED_GO_CNES.indexOf(item.cnes);
      if (featuredIdx >= 0) score += 250 - featuredIdx * 10;
      if (item.tipo === 5 || item.tipo === 7) score += 80; // Hospital
      if (item.tipo === 73 || item.tipo === 20) score += 50; // UPA / PS
      if (normalizeSusText(item.nome).startsWith(tokens[0])) score += 70;
      scored.push({ score, item });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.item.nome.localeCompare(b.item.nome));
  const localMatches = scored.slice(0, limit).map(({ item }) => ({
    cnes: item.cnes,
    nome: item.nome,
    municipio: item.municipio,
    uf: item.uf,
    tipo: item.tipo,
    source: 'local' as const,
  }));

  // 2. Live national CNES lookup when:
  //    a) user typed a 5-7 digit CNES code not matched locally, OR
  //    b) user typed a Brazilian municipality name outside Goiás (or local has < 3 matches)
  const shouldFetchLiveByCode =
    digits.length >= 5 && digits.length <= 7 && !localMatches.some((m) => m.cnes === digits.padStart(7, '0'));

  let matchedMun: MunicipioIbgeItem | undefined;
  if (!shouldFetchLiveByCode && localMatches.length < 4 && tokens.length >= 1 && qRaw.length >= 4) {
    const qNorm = normalizeSusText(qRaw);
    matchedMun = municipios.find(
      (m) => m.uf !== 'GO' && (m._normNome === qNorm || (tokens.length === 1 && m._normNome.startsWith(qNorm) && qNorm.length >= 5))
    );
  }

  if (shouldFetchLiveByCode || matchedMun) {
    try {
      const mun6ToInfo = new Map<string, { nome: string; uf: string }>();
      municipios.forEach((m) => mun6ToInfo.set(m.ibge6, { nome: m.nome, uf: m.uf }));

      const res = await fetch('/api/cnes-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cnes: shouldFetchLiveByCode ? digits : undefined,
          codigoMunicipio6: matchedMun?.ibge6,
          queryText: matchedMun ? '' : qRaw,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const liveItems: CnesItem[] = (data?.items || []).map((raw: any) => {
          const mInfo = raw.codigoMunicipio ? mun6ToInfo.get(String(raw.codigoMunicipio).slice(0, 6)) : undefined;
          return {
            cnes: String(raw.cnes || '').padStart(7, '0'),
            nome: String(raw.nome || ''),
            municipio: mInfo?.nome || matchedMun?.nome || '',
            uf: mInfo?.uf || matchedMun?.uf || '',
            tipo: raw.tipo,
            source: 'live' as const,
          };
        });
        const seen = new Set(localMatches.map((m) => m.cnes));
        const merged: CnesItem[] = [...localMatches];
        for (const item of liveItems) {
          if (item.cnes && !seen.has(item.cnes)) {
            seen.add(item.cnes);
            merged.push(item);
          }
        }
        return merged.slice(0, limit);
      }
    } catch {
      // Offline fallback cleanly uses localMatches
    }
  }

  return localMatches;
}

export async function lookupCep(cep: string): Promise<ViaCepResult | null> {
  const digits = (cep || '').replace(/\D/g, '');
  if (digits.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.erro) return null;
    return {
      cep: data.cep || digits,
      logradouro: data.logradouro || '',
      bairro: data.bairro || '',
      localidade: data.localidade || '',
      uf: data.uf || '',
      ibge: data.ibge || '',
    };
  } catch {
    return null;
  }
}
