export interface CnesLiveItem {
  cnes: string;
  nome: string;
  razaoSocial?: string;
  municipio?: string;
  uf?: string;
  codigoMunicipio?: string;
  tipo?: number;
}

const cnesCache = new Map<string, { ts: number; items: CnesLiveItem[] }>();
const CACHE_TTL_MS = 15 * 60 * 1000;

function normalizeText(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function mapRawEstablishment(raw: any): CnesLiveItem | null {
  if (!raw || !raw.codigo_cnes) return null;
  const cnes = String(raw.codigo_cnes).replace(/\D/g, '').padStart(7, '0');
  if (!cnes || cnes === '0000000') return null;
  const fantasia = String(raw.nome_fantasia || '').trim();
  const razao = String(raw.nome_razao_social || '').trim();
  let nome = fantasia && fantasia.length >= 4 ? fantasia : razao || fantasia;
  if (!nome) return null;
  if (cnes === '2338424') {
    nome = 'HOSPITAL DAS CLINICAS DE GOIAS - UFG';
  } else if (
    razao &&
    fantasia &&
    !fantasia.toUpperCase().includes('UFG') &&
    razao.toUpperCase().includes('UFG')
  ) {
    nome = `${fantasia} - UFG`;
  }
  return {
    cnes,
    nome,
    razaoSocial: razao || undefined,
    codigoMunicipio: raw.codigo_municipio ? String(raw.codigo_municipio).slice(0, 6) : undefined,
    tipo: typeof raw.codigo_tipo_unidade === 'number' ? raw.codigo_tipo_unidade : undefined,
  };
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 6000): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function searchLiveCnes(params: {
  cnes?: string;
  codigoMunicipio6?: string;
  queryText?: string;
}): Promise<CnesLiveItem[]> {
  const cleanCnes = String(params.cnes || '').replace(/\D/g, '');
  const mun6 = String(params.codigoMunicipio6 || '').replace(/\D/g, '').slice(0, 6);
  const queryNorm = normalizeText(params.queryText || '');

  // 1. Direct lookup by exact CNES code (5-7 digits)
  if (cleanCnes.length >= 5 && cleanCnes.length <= 7) {
    const cacheKey = `cnes:${cleanCnes}`;
    const hit = cnesCache.get(cacheKey);
    if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
      return hit.items;
    }
    const raw = await fetchJsonWithTimeout(
      `https://apidadosabertos.saude.gov.br/cnes/estabelecimentos/${Number(cleanCnes)}`
    );
    const mapped = mapRawEstablishment(raw);
    const items = mapped ? [mapped] : [];
    cnesCache.set(cacheKey, { ts: Date.now(), items });
    return items;
  }

  // 2. Lookup hospitals/UPAs/polyclinics by 6-digit IBGE municipality code
  if (mun6.length === 6) {
    const cacheKey = `mun:${mun6}`;
    let items: CnesLiveItem[];
    const hit = cnesCache.get(cacheKey);
    if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
      items = hit.items;
    } else {
      const urls = [
        `https://apidadosabertos.saude.gov.br/cnes/estabelecimentos?codigo_municipio=${mun6}&codigo_tipo_unidade=5&limit=20&offset=0`,
        `https://apidadosabertos.saude.gov.br/cnes/estabelecimentos?codigo_municipio=${mun6}&codigo_tipo_unidade=5&limit=20&offset=1`,
        `https://apidadosabertos.saude.gov.br/cnes/estabelecimentos?codigo_municipio=${mun6}&codigo_tipo_unidade=7&limit=20&offset=0`,
        `https://apidadosabertos.saude.gov.br/cnes/estabelecimentos?codigo_municipio=${mun6}&codigo_tipo_unidade=73&limit=20&offset=0`,
        `https://apidadosabertos.saude.gov.br/cnes/estabelecimentos?codigo_municipio=${mun6}&codigo_tipo_unidade=20&limit=20&offset=0`,
        `https://apidadosabertos.saude.gov.br/cnes/estabelecimentos?codigo_municipio=${mun6}&codigo_tipo_unidade=4&limit=20&offset=0`,
      ];
      const pages = await Promise.all(urls.map((u) => fetchJsonWithTimeout(u, 5500)));
      const seen = new Map<string, CnesLiveItem>();
      for (const page of pages) {
        for (const raw of page?.estabelecimentos || []) {
          const mapped = mapRawEstablishment(raw);
          if (mapped && !seen.has(mapped.cnes)) {
            seen.set(mapped.cnes, mapped);
          }
        }
      }
      items = Array.from(seen.values()).sort((a, b) => a.nome.localeCompare(b.nome));
      cnesCache.set(cacheKey, { ts: Date.now(), items });
    }

    if (!queryNorm) return items.slice(0, 20);
    const tokens = queryNorm.split(/\s+/).filter((t) => t.length >= 2);
    const filtered = items.filter((item) => {
      const hay = normalizeText(`${item.cnes} ${item.nome} ${item.razaoSocial || ''}`);
      return tokens.every((tk) => hay.includes(tk));
    });
    return (filtered.length > 0 ? filtered : items).slice(0, 20);
  }

  return [];
}
