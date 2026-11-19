import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, Button, Input } from '@/components/ui';
import {
  BookOpenCheck,
  Search,
  Star,
  Lock,
  FileText,
  Syringe,
  Copy,
  Check,
  Calculator,
  AlertTriangle,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Pencil,
  UserCheck,
  Scale,
  X,
  ClipboardList,
  Info,
  CheckSquare,
  Square,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { cn, copyToClipboard } from '@/lib/utils';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useEnfermariaPatients } from '@/hooks/useEnfermariaPatients';
import { useToast } from '@/hooks/useToast';
import { formatMedicationsToText } from '@/lib/generateFilledPdf';
import {
  ALL_PRESCRIPTION_PROTOCOLS,
  SPECIALTY_LIST,
  searchPrescriptionProtocols,
  detectRequiredReceiptType,
  protocolHasControlledOption,
  protocolSupportsHomeReceipt,
  type QuickFilterMode,
  type PrescriptionProtocol,
  type PrescriptionSpecialty,
  type GuideMedicationItem,
} from '@/data/prescricoes';
import type { MedicationItem } from '@/types/formTemplate';

interface MedOverride {
  quantidade?: string;
  posologia?: string;
}

function formatComputedWeightDose(weightKg: number, med: GuideMedicationItem): string | null {
  if (!med.weightDose || !Number.isFinite(weightKg) || weightKg <= 0) return null;
  const spec = med.weightDose;
  const formatNum = (val: number) =>
    val >= 100
      ? Math.round(val).toLocaleString('pt-BR')
      : Number(val.toFixed(2)).toLocaleString('pt-BR');

  if (typeof spec.mgPerKg === 'number') {
    let total = weightKg * spec.mgPerKg;
    if (spec.maxDose && total > spec.maxDose) total = spec.maxDose;
    if (spec.minDose && total < spec.minDose) total = spec.minDose;
    return `${formatNum(total)} ${spec.unit}`;
  }
  if (typeof spec.mlPerKg === 'number') {
    let total = weightKg * spec.mlPerKg;
    if (spec.maxDose && total > spec.maxDose) total = spec.maxDose;
    if (spec.minDose && total < spec.minDose) total = spec.minDose;
    return `${formatNum(total)} ${spec.unit}`;
  }
  if (typeof spec.uiPerKg === 'number') {
    let total = weightKg * spec.uiPerKg;
    if (spec.maxDose && total > spec.maxDose) total = spec.maxDose;
    return `${formatNum(total)} ${spec.unit}`;
  }
  if (typeof spec.mcgPerKg === 'number') {
    let total = weightKg * spec.mcgPerKg;
    if (spec.maxDose && total > spec.maxDose) total = spec.maxDose;
    return `${formatNum(total)} ${spec.unit}`;
  }
  return null;
}

export default function Prescricoes() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { patients } = useEnfermariaPatients();
  const [ambulatorioPacientes] = useLocalStorage<any[]>('evolutigas_ambulatorio_pacientes_v1', []);

  // Persisted user preferences
  const [favoriteIds, setFavoriteIds] = useLocalStorage<string[]>('evolutigas_presc_favs_v1', []);
  const [recentIds, setRecentIds] = useLocalStorage<string[]>('evolutigas_presc_recent_v1', [
    'agitacao-psicomotora',
    'anafilaxia',
    'pac',
  ]);

  // Left-panel filter state
  const [query, setQuery] = useState<string>('');
  const [quickFilter, setQuickFilter] = useState<QuickFilterMode>('todas');
  const [selectedSpecialty, setSelectedSpecialty] = useState<PrescriptionSpecialty | null>(null);
  const [showAllSpecialties, setShowAllSpecialties] = useState<boolean>(true);

  // Selected protocol & mobile view state
  const locState = (location.state as { protocolId?: string } | null) || null;
  const [selectedProtocolId, setSelectedProtocolId] = useState<string>(() => {
    if (locState?.protocolId && ALL_PRESCRIPTION_PROTOCOLS.some((p) => p.id === locState.protocolId)) {
      return locState.protocolId;
    }
    return ALL_PRESCRIPTION_PROTOCOLS[0]?.id || 'pac';
  });
  const [mobileShowDetail, setMobileShowDetail] = useState<boolean>(Boolean(locState?.protocolId));

  // Right-panel scenario & prescription builder state
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('');
  const [checkedMedIds, setCheckedMedIds] = useState<Set<string>>(new Set());
  const [medOverrides, setMedOverrides] = useState<Record<string, MedOverride>>({});
  const [editingMedId, setEditingMedId] = useState<string | null>(null);
  const [includeOrientacoesInObs, setIncludeOrientacoesInObs] = useState<boolean>(false);
  const [patientName, setPatientName] = useState<string>('');
  const [weightInput, setWeightInput] = useState<string>('70');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const favoritesSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const filteredProtocols = useMemo(
    () =>
      searchPrescriptionProtocols(
        ALL_PRESCRIPTION_PROTOCOLS,
        query,
        quickFilter,
        selectedSpecialty,
        favoritesSet
      ),
    [query, quickFilter, selectedSpecialty, favoritesSet]
  );

  // Grouped A-Z list
  const alphabeticalGroups = useMemo(() => {
    const groups: { letter: string; items: PrescriptionProtocol[] }[] = [];
    const map = new Map<string, PrescriptionProtocol[]>();
    filteredProtocols.forEach((p) => {
      const letter = (p.title.trim().charAt(0) || '#')
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      const existing = map.get(letter);
      if (existing) {
        existing.push(p);
      } else {
        const arr = [p];
        map.set(letter, arr);
        groups.push({ letter, items: arr });
      }
    });
    return groups;
  }, [filteredProtocols]);

  const recentProtocols = useMemo(() => {
    if (query.trim() || quickFilter !== 'todas' || selectedSpecialty) return [];
    return recentIds
      .map((id) => ALL_PRESCRIPTION_PROTOCOLS.find((p) => p.id === id))
      .filter((p): p is PrescriptionProtocol => Boolean(p))
      .slice(0, 4);
  }, [recentIds, query, quickFilter, selectedSpecialty]);

  const activeProtocol = useMemo(
    () =>
      ALL_PRESCRIPTION_PROTOCOLS.find((p) => p.id === selectedProtocolId) ||
      filteredProtocols[0] ||
      ALL_PRESCRIPTION_PROTOCOLS[0],
    [selectedProtocolId, filteredProtocols]
  );

  const activeScenario = useMemo(() => {
    if (!activeProtocol) return undefined;
    return (
      activeProtocol.scenarios.find((s) => s.id === selectedScenarioId) ||
      activeProtocol.scenarios[0]
    );
  }, [activeProtocol, selectedScenarioId]);

  // Handle Ctrl+K or external navigation with protocolId
  useEffect(() => {
    if (locState?.protocolId && ALL_PRESCRIPTION_PROTOCOLS.some((p) => p.id === locState.protocolId)) {
      setSelectedProtocolId(locState.protocolId);
      setMobileShowDetail(true);
    }
  }, [locState?.protocolId]);

  // Reset scenario when protocol changes
  useEffect(() => {
    if (!activeProtocol) return;
    const firstScenario = activeProtocol.scenarios[0];
    setSelectedScenarioId(firstScenario?.id || '');
    setMedOverrides({});
    setEditingMedId(null);
    setIncludeOrientacoesInObs(false);
  }, [activeProtocol?.id]);

  // Reset selected medications when scenario changes
  useEffect(() => {
    if (!activeScenario) return;
    const defaults = activeScenario.medications
      .filter((m) => m.defaultSelected !== false)
      .map((m) => m.id);
    setCheckedMedIds(new Set(defaults));
    setEditingMedId(null);
  }, [activeScenario?.id]);

  // Quick list of patient names from Enfermaria & Ambulatório
  const patientQuickOptions = useMemo(() => {
    const names = new Set<string>();
    patients
      .filter((p) => p.status === 'internado' && p.name?.trim())
      .forEach((p) => names.add(p.name.trim()));
    ambulatorioPacientes
      .filter((p) => !p.archived && p.nome?.trim())
      .forEach((p) => names.add(String(p.nome).trim()));
    return Array.from(names);
  }, [patients, ambulatorioPacientes]);

  const handleSelectProtocol = (protocol: PrescriptionProtocol) => {
    setSelectedProtocolId(protocol.id);
    setMobileShowDetail(true);
    setRecentIds((prev) => [protocol.id, ...prev.filter((id) => id !== protocol.id)].slice(0, 8));
  };

  const toggleFavorite = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setFavoriteIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [id, ...prev]
    );
  };

  const toggleMed = (medId: string) => {
    setCheckedMedIds((prev) => {
      const next = new Set(prev);
      if (next.has(medId)) next.delete(medId);
      else next.add(medId);
      return next;
    });
  };

  const selectedMeds = useMemo(() => {
    if (!activeScenario) return [];
    return activeScenario.medications.filter((m) => checkedMedIds.has(m.id));
  }, [activeScenario, checkedMedIds]);

  const requiredReceipt = useMemo(
    () =>
      detectRequiredReceiptType(
        selectedMeds,
        activeScenario?.recommendedReceipt || activeProtocol?.primaryReceipt || 'receita_simples'
      ),
    [selectedMeds, activeScenario, activeProtocol]
  );

  const weightKg = useMemo(() => {
    const parsed = parseFloat(weightInput.replace(',', '.'));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [weightInput]);

  const buildSelectedMedicationItems = (): MedicationItem[] => {
    const baseList =
      selectedMeds.length > 0
        ? selectedMeds
        : (activeScenario?.medications || []).slice(0, 1);

    const mapped: MedicationItem[] = baseList.map((m, idx) => {
      const ov = medOverrides[m.id];
      return {
        id: String(idx + 1),
        via: m.via || 'Oral',
        quantidade: (ov?.quantidade ?? m.quantidade) || '1 CAIXA',
        item: m.item,
        posologia: ov?.posologia ?? m.posologia,
      };
    });

    if (includeOrientacoesInObs && activeProtocol?.orientacoes?.length) {
      mapped.push({
        id: String(mapped.length + 1),
        via: 'Uso Interno',
        quantidade: 'ORIENTAÇÕES',
        item: 'Orientações ao Paciente',
        posologia: activeProtocol.orientacoes.map((o) => `- ${o}`).join('\n'),
      });
    }

    return mapped;
  };

  const handleGenerateReceipt = (targetForm: 'receita_simples' | 'receita_controle') => {
    if (!activeProtocol || !activeScenario) return;
    if (selectedMeds.length === 0) {
      toast('Marque ao menos 1 item da prescrição antes de gerar a receita.', 'info');
      return;
    }

    const medicationsPayload = buildSelectedMedicationItems();
    navigate('/formularios', {
      state: {
        selectedForm: targetForm,
        fromGuide: true,
        patientName: patientName.trim() || undefined,
        cid: activeProtocol.cid,
        medications: medicationsPayload,
      },
    });
  };

  const handleCopyPrescriptionText = async () => {
    if (!activeProtocol || !activeScenario) return;
    const medsToFormat = buildSelectedMedicationItems();
    const medsText = formatMedicationsToText(medsToFormat);
    const parts: string[] = [];
    parts.push(`${activeProtocol.title.toUpperCase()} (CID-10: ${activeProtocol.cid}) — ${activeScenario.label}`);
    if (patientName.trim()) {
      parts.push(`Paciente: ${patientName.trim()}${weightKg > 0 && activeProtocol.supportsWeightCalc ? ` (${weightKg} kg)` : ''}`);
    }
    if (medsText) parts.push(medsText);
    if (activeScenario.conductSteps?.length) {
      parts.push('CONDUTAS & SUPORTE:\n' + activeScenario.conductSteps.map((s) => `- ${s}`).join('\n'));
    }
    if (includeOrientacoesInObs && activeProtocol.orientacoes?.length && !medsText.includes('Orientações ao Paciente')) {
      parts.push('ORIENTAÇÕES AO PACIENTE:\n' + activeProtocol.orientacoes.map((o) => `- ${o}`).join('\n'));
    }

    const ok = await copyToClipboard(parts.join('\n\n'));
    if (ok) {
      setCopiedId('prescription');
      toast('Prescrição copiada para a área de transferência!', 'success');
      setTimeout(() => setCopiedId(null), 1800);
    }
  };

  const handleCopyOrientacoes = async () => {
    if (!activeProtocol?.orientacoes?.length) return;
    const text =
      `Orientações (${activeProtocol.title}):\n` +
      activeProtocol.orientacoes.map((o) => `- ${o}`).join('\n');
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedId('orientacoes');
      toast('Orientações copiadas!', 'success');
      setTimeout(() => setCopiedId(null), 1800);
    }
  };

  const handleCopyCid = async (cid: string) => {
    const ok = await copyToClipboard(cid);
    if (ok) {
      toast(`CID-10 ${cid} copiado!`, 'success');
    }
  };

  const renderProtocolTypeIcon = (protocol: PrescriptionProtocol) => {
    if (protocolHasControlledOption(protocol)) {
      return (
        <span title="Possui Antimicrobiano (RDC 471) ou Medicamento Controlado (2 vias)">
          <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </span>
      );
    }
    if (protocolSupportsHomeReceipt(protocol)) {
      return (
        <span title="Receita Simples Ambulatorial / Alta">
          <FileText className="w-3.5 h-3.5 text-teal-600/80 shrink-0" />
        </span>
      );
    }
    return (
      <span title="Conduta Hospitalar / Pronto Atendimento">
        <Syringe className="w-3.5 h-3.5 text-amber-600/80 shrink-0" />
      </span>
    );
  };

  const isHospitalOnlyScenario =
    activeScenario?.setting === 'hospitalar' &&
    !selectedMeds.some((m) => m.via === 'Oral' || m.via === 'Oftálmica' || m.via === 'Intravaginal' || m.via === 'Nasal' || m.via === 'Inalatória' || m.via === 'Tópica');

  return (
    <div className="max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: Directory & Filters (matching reference UI) */}
        <Card
          className={cn(
            'lg:col-span-5 xl:col-span-5 overflow-hidden border-slate-200/90 shadow-xs lg:sticky lg:top-2 lg:flex lg:flex-col lg:max-h-[calc(100vh-4.5rem)]',
            mobileShowDetail ? 'hidden lg:flex' : 'flex flex-col'
          )}
        >
          {/* Compact Header */}
          <div className="p-4 pb-3 border-b border-slate-100 space-y-3 shrink-0 bg-white">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 border border-teal-100 flex items-center justify-center shrink-0">
                  <BookOpenCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-tight truncate">
                    Guia de Prescrições
                  </h1>
                  <p className="text-xs text-slate-500 truncate">
                    {ALL_PRESCRIPTION_PROTOCOLS.length} condutas prontas · envio direto p/ Formulários
                  </p>
                </div>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Queixa, sigla, medicamento ou CID (ex: PAC, J18.9)..."
                aria-label="Buscar protocolo clínico por queixa, sigla, medicamento ou CID"
                className="w-full h-10 pl-10 pr-9 rounded-2xl bg-slate-100/90 border border-slate-200/80 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Limpar busca"
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 absolute right-2.5 top-1/2 -translate-y-1/2"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'todas', label: 'Todas' },
                  {
                    id: 'favoritas',
                    label: favoriteIds.length > 0 ? `★ Favoritas (${favoriteIds.length})` : '☆ Favoritas',
                  },
                  { id: 'pronto_atendimento', label: 'Pronto atendimento' },
                  { id: 'receita_casa', label: 'Receita p/ Casa' },
                ] as { id: QuickFilterMode; label: string }[]
              ).map((pill) => {
                const active = quickFilter === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setQuickFilter(pill.id)}
                    className={cn(
                      'px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors shrink-0',
                      active
                        ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-teal-300 hover:bg-slate-50'
                    )}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>

            {/* Specialty Filter Chips */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Especialidades {selectedSpecialty ? `· ${selectedSpecialty}` : ''}
                </span>
                <div className="flex items-center gap-2">
                  {selectedSpecialty && (
                    <button
                      type="button"
                      onClick={() => setSelectedSpecialty(null)}
                      className="text-[11px] font-semibold text-teal-700 hover:underline"
                    >
                      Limpar área
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowAllSpecialties((prev) => !prev)}
                    className="inline-flex items-center gap-0.5 text-[11px] font-medium text-slate-500 hover:text-slate-700"
                  >
                    {showAllSpecialties ? (
                      <>
                        Ocultar <ChevronUp className="w-3 h-3" />
                      </>
                    ) : (
                      <>
                        Mostrar ({SPECIALTY_LIST.length}) <ChevronDown className="w-3 h-3" />
                      </>
                    )}
                  </button>
                </div>
              </div>

              {showAllSpecialties && (
                <div className="flex flex-wrap gap-1.5">
                  {SPECIALTY_LIST.map((spec) => {
                    const active = selectedSpecialty === spec;
                    return (
                      <button
                        key={spec}
                        type="button"
                        onClick={() => setSelectedSpecialty(active ? null : spec)}
                        className={cn(
                          'px-2.5 py-1 rounded-xl text-xs font-medium border transition-colors',
                          active
                            ? 'bg-teal-50 border-teal-500 text-teal-800 font-semibold'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-teal-300 hover:bg-slate-50'
                        )}
                      >
                        {spec}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Scrollable List: Recents + A-Z */}
          <div className="overflow-y-auto flex-1 divide-y divide-slate-100 custom-scrollbar">
            {/* RECENTES */}
            {recentProtocols.length > 0 && (
              <div>
                <div className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs px-4 py-1.5 border-b border-slate-200/60">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    RECENTES
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {recentProtocols.map((p) => {
                    const isSelected = activeProtocol?.id === p.id;
                    const isFav = favoritesSet.has(p.id);
                    return (
                      <div
                        key={`rec_${p.id}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleSelectProtocol(p)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleSelectProtocol(p);
                          }
                        }}
                        className={cn(
                          'w-full px-4 py-3 flex items-center justify-between gap-2.5 cursor-pointer transition-colors',
                          isSelected
                            ? 'bg-teal-50/75 border-l-3 border-l-teal-600'
                            : 'hover:bg-slate-50'
                        )}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{p.title}</p>
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            {p.specialties.join(' · ')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => toggleFavorite(e, p.id)}
                            aria-label={isFav ? 'Remover dos favoritos' : 'Favoritar protocolo'}
                            className="p-1 rounded-md hover:bg-slate-200/60 text-slate-300 hover:text-amber-500 transition-colors"
                          >
                            <Star
                              className={cn(
                                'w-3.5 h-3.5',
                                isFav ? 'fill-amber-400 text-amber-500' : 'text-slate-300'
                              )}
                            />
                          </button>
                          {renderProtocolTypeIcon(p)}
                          <span className="text-[11px] font-mono font-medium text-slate-500 min-w-[42px] text-right">
                            {p.cid}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ALPHABETICAL GROUPS */}
            {alphabeticalGroups.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-sm text-slate-500">
                  Nenhum protocolo encontrado para os filtros atuais.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQuery('');
                    setQuickFilter('todas');
                    setSelectedSpecialty(null);
                  }}
                >
                  Limpar filtros
                </Button>
              </div>
            ) : (
              alphabeticalGroups.map((group) => (
                <div key={group.letter}>
                  <div className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs px-4 py-1 border-b border-slate-200/60">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      {group.letter}
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {group.items.map((p) => {
                      const isSelected = activeProtocol?.id === p.id;
                      const isFav = favoritesSet.has(p.id);
                      return (
                        <div
                          key={p.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleSelectProtocol(p)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleSelectProtocol(p);
                            }
                          }}
                          className={cn(
                            'w-full px-4 py-3 flex items-center justify-between gap-2.5 cursor-pointer transition-colors',
                            isSelected
                              ? 'bg-teal-50/75 border-l-3 border-l-teal-600'
                              : 'hover:bg-slate-50'
                          )}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {p.title}
                            </p>
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                              {p.specialties.join(' · ')}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => toggleFavorite(e, p.id)}
                              aria-label={isFav ? 'Remover dos favoritos' : 'Favoritar protocolo'}
                              className="p-1 rounded-md hover:bg-slate-200/60 text-slate-300 hover:text-amber-500 transition-colors"
                            >
                              <Star
                                className={cn(
                                  'w-3.5 h-3.5',
                                  isFav ? 'fill-amber-400 text-amber-500' : 'text-slate-300'
                                )}
                              />
                            </button>
                            {renderProtocolTypeIcon(p)}
                            <span className="text-[11px] font-mono font-medium text-slate-500 min-w-[42px] text-right">
                              {p.cid}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* RIGHT COLUMN: Clinical Detail & Interactive Prescription Builder */}
        <div
          className={cn(
            'lg:col-span-7 xl:col-span-7 space-y-4',
            !mobileShowDetail ? 'hidden lg:block' : 'block'
          )}
        >
          {activeProtocol && activeScenario && (
            <>
              {/* Mobile back to list */}
              <div className="lg:hidden">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMobileShowDetail(false)}
                  className="text-xs"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Voltar para a lista
                </Button>
              </div>

              {/* Protocol Header Card */}
              <Card className="border-slate-200/90 shadow-xs">
                <CardContent className="p-5 pt-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {activeProtocol.specialties.map((s) => (
                          <span
                            key={s}
                            className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-700 border border-teal-200/80"
                          >
                            {s}
                          </span>
                        ))}
                        <button
                          type="button"
                          onClick={() => handleCopyCid(activeProtocol.cid)}
                          title="Clique para copiar o CID-10"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                        >
                          CID {activeProtocol.cid}
                        </button>
                      </div>

                      <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                        {activeProtocol.title}
                      </h2>
                      {activeProtocol.shortSubtitle && (
                        <p className="text-xs sm:text-sm text-slate-500">
                          {activeProtocol.shortSubtitle}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {activeProtocol.relatedCalculatorTab && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            navigate('/calculadoras', {
                              state: { initialTab: activeProtocol.relatedCalculatorTab },
                            })
                          }
                          className="text-xs border-teal-200 text-teal-800 hover:bg-teal-50"
                        >
                          <Calculator className="w-3.5 h-3.5 mr-1.5 text-teal-600" />
                          Calculadora
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => toggleFavorite(e, activeProtocol.id)}
                        className="text-xs"
                      >
                        <Star
                          className={cn(
                            'w-3.5 h-3.5 mr-1',
                            favoritesSet.has(activeProtocol.id)
                              ? 'fill-amber-400 text-amber-500'
                              : 'text-slate-400'
                          )}
                        />
                        {favoritesSet.has(activeProtocol.id) ? 'Favorita' : 'Favoritar'}
                      </Button>
                    </div>
                  </div>

                  {/* Patient & Optional Weight Bar */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-2 border-t border-slate-100">
                    <div
                      className={cn(
                        'space-y-1',
                        activeProtocol.supportsWeightCalc ? 'sm:col-span-8' : 'sm:col-span-12'
                      )}
                    >
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-teal-600" />
                        Paciente p/ preencher na Receita (opcional)
                      </label>
                      <div className="flex items-center gap-2">
                        <Input
                          list="guide-patient-list"
                          value={patientName}
                          onChange={(e) => setPatientName(e.target.value)}
                          placeholder="Digite o nome ou escolha um paciente ativo..."
                          className="h-9 text-sm rounded-xl bg-slate-50/70"
                        />
                        {patientName && (
                          <button
                            type="button"
                            onClick={() => setPatientName('')}
                            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            title="Limpar nome"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        <datalist id="guide-patient-list">
                          {patientQuickOptions.map((n) => (
                            <option key={n} value={n} />
                          ))}
                        </datalist>
                      </div>
                    </div>

                    {activeProtocol.supportsWeightCalc && (
                      <div className="sm:col-span-4 space-y-1">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                          <Scale className="w-3.5 h-3.5 text-teal-600" />
                          Peso (kg) p/ cálculo
                        </label>
                        <div className="relative">
                          <Input
                            type="number"
                            min="1"
                            max="300"
                            step="0.5"
                            value={weightInput}
                            onChange={(e) => setWeightInput(e.target.value)}
                            className="h-9 text-sm rounded-xl bg-slate-50/70 pr-10 tabular-nums"
                          />
                          <span className="text-xs font-medium text-slate-400 absolute right-3 top-1/2 -translate-y-1/2">
                            kg
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Scenarios Switcher */}
                  {activeProtocol.scenarios.length > 1 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                        Cenário Clínico / Via
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {activeProtocol.scenarios.map((sc) => {
                          const isScActive = sc.id === activeScenario.id;
                          return (
                            <button
                              key={sc.id}
                              type="button"
                              onClick={() => setSelectedScenarioId(sc.id)}
                              className={cn(
                                'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors text-left',
                                isScActive
                                  ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-teal-300'
                              )}
                            >
                              {sc.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {activeScenario.summary && (
                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 text-xs text-blue-900">
                      <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <p className="leading-relaxed">{activeScenario.summary}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Conduct Steps if present */}
              {activeScenario.conductSteps && activeScenario.conductSteps.length > 0 && (
                <Card className="border-slate-200/90 shadow-xs">
                  <CardContent className="p-4 pt-4 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                      <ClipboardList className="w-4 h-4 text-teal-600" />
                      Condutas & Sequência de Atendimento
                    </div>
                    <ul className="space-y-1.5">
                      {activeScenario.conductSteps.map((step, i) => (
                        <li key={i} className="text-xs sm:text-sm text-slate-700 flex items-start gap-2 leading-relaxed">
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-600 shrink-0 mt-2" />
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Medications Interactive Selector */}
              <Card className="border-slate-200/90 shadow-xs">
                <CardContent className="p-4 pt-4 sm:p-5 sm:pt-5 space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Itens da Prescrição ({selectedMeds.length}/{activeScenario.medications.length})
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Marque apenas os medicamentos desejados ou edite quantidade/posologia antes de gerar a receita.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setCheckedMedIds(
                            new Set(
                              activeScenario.medications
                                .filter((m) => m.defaultSelected !== false)
                                .map((m) => m.id)
                            )
                          )
                        }
                        className="h-7 px-2 text-xs text-teal-700"
                      >
                        Padrão
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setCheckedMedIds(new Set(activeScenario.medications.map((m) => m.id)))
                        }
                        className="h-7 px-2 text-xs text-slate-600"
                      >
                        Todos
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setCheckedMedIds(new Set())}
                        className="h-7 px-2 text-xs text-slate-500"
                      >
                        Limpar
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {activeScenario.medications.map((med) => {
                      const isChecked = checkedMedIds.has(med.id);
                      const override = medOverrides[med.id];
                      const displayQtd = override?.quantidade ?? med.quantidade;
                      const displayPoso = override?.posologia ?? med.posologia;
                      const isEditing = editingMedId === med.id;
                      const computedWeight = formatComputedWeightDose(weightKg, med);

                      return (
                        <div
                          key={med.id}
                          className={cn(
                            'rounded-2xl border p-3.5 transition-all',
                            isChecked
                              ? 'bg-teal-50/40 border-teal-300/90 shadow-2xs'
                              : 'bg-white border-slate-200/80 opacity-85 hover:opacity-100'
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              onClick={() => toggleMed(med.id)}
                              aria-label={isChecked ? `Desmarcar ${med.item}` : `Marcar ${med.item}`}
                              className="mt-0.5 text-teal-600 shrink-0 focus:outline-none"
                            >
                              {isChecked ? (
                                <CheckSquare className="w-5 h-5 text-teal-600" />
                              ) : (
                                <Square className="w-5 h-5 text-slate-300 hover:text-slate-400" />
                              )}
                            </button>

                            <div className="flex-1 min-w-0 space-y-1.5">
                              <div className="flex items-start justify-between gap-2">
                                <div
                                  onClick={() => toggleMed(med.id)}
                                  className="cursor-pointer space-y-1 min-w-0"
                                >
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-sm text-slate-900">
                                      {med.item}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                                      {med.via}
                                    </span>
                                    {med.tag && (
                                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/70">
                                        {med.tag}
                                      </span>
                                    )}
                                    {med.controlled && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/80">
                                        <Lock className="w-2.5 h-2.5" />
                                        {med.controlledReason === 'antimicrobiano'
                                          ? 'ATB · 2 vias'
                                          : 'Controle Especial'}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] font-mono font-semibold text-teal-700">
                                    Qtd: {displayQtd}
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => setEditingMedId(isEditing ? null : med.id)}
                                  title="Editar quantidade ou posologia"
                                  className={cn(
                                    'p-1.5 rounded-lg text-xs transition-colors shrink-0',
                                    isEditing
                                      ? 'bg-teal-600 text-white'
                                      : 'text-slate-400 hover:text-teal-700 hover:bg-slate-100'
                                  )}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {isEditing ? (
                                <div className="space-y-2 pt-1.5 bg-white p-2.5 rounded-xl border border-slate-200">
                                  <div className="space-y-1">
                                    <label className="text-[11px] font-semibold text-slate-500">
                                      Quantidade p/ receita:
                                    </label>
                                    <Input
                                      value={displayQtd}
                                      onChange={(e) =>
                                        setMedOverrides((prev) => ({
                                          ...prev,
                                          [med.id]: { ...prev[med.id], quantidade: e.target.value },
                                        }))
                                      }
                                      className="h-8 text-xs"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[11px] font-semibold text-slate-500">
                                      Posologia / Utilização:
                                    </label>
                                    <textarea
                                      value={displayPoso}
                                      onChange={(e) =>
                                        setMedOverrides((prev) => ({
                                          ...prev,
                                          [med.id]: { ...prev[med.id], posologia: e.target.value },
                                        }))
                                      }
                                      rows={2}
                                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    />
                                  </div>
                                  <div className="flex justify-end">
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() => setEditingMedId(null)}
                                      className="h-7 text-xs bg-teal-600 hover:bg-teal-700 text-white"
                                    >
                                      <Check className="w-3 h-3 mr-1" /> Concluir edição
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                                  {displayPoso}
                                </p>
                              )}

                              {computedWeight && (
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200/80 text-xs text-emerald-900 font-semibold tabular-nums">
                                  <Scale className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  Para {weightKg} kg: <span className="font-bold">{computedWeight}</span>
                                  <span className="font-normal text-emerald-700">
                                    ({med.weightDose?.label})
                                  </span>
                                </div>
                              )}

                              {med.note && (
                                <p className="text-[11px] text-amber-800 bg-amber-50/70 border border-amber-200/60 rounded-lg px-2.5 py-1">
                                  Obs.: {med.note}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* #Bizu Pearls */}
              {activeProtocol.bizus && activeProtocol.bizus.length > 0 && (
                <Card className="border-amber-200 bg-amber-50/80 shadow-xs">
                  <CardContent className="p-4 pt-4 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-900">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      #Bizu Clínico & Alertas de Segurança
                    </div>
                    <ul className="space-y-1.5">
                      {activeProtocol.bizus.map((bizu, idx) => (
                        <li key={idx} className="text-xs sm:text-sm text-amber-900 flex items-start gap-2 leading-relaxed">
                          <span className="font-bold text-amber-600 shrink-0">•</span>
                          <span>{bizu}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Patient Orientations */}
              {activeProtocol.orientacoes && activeProtocol.orientacoes.length > 0 && (
                <Card className="border-teal-200 bg-teal-50/50 shadow-xs">
                  <CardContent className="p-4 pt-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-900">
                        <Sparkles className="w-4 h-4 text-teal-600" />
                        Orientações ao Paciente
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleCopyOrientacoes}
                        className="h-7 px-2 text-xs text-teal-800 hover:bg-teal-100/70"
                      >
                        {copiedId === 'orientacoes' ? (
                          <>
                            <Check className="w-3.5 h-3.5 mr-1" /> Copiado
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 mr-1" /> Copiar orientações
                          </>
                        )}
                      </Button>
                    </div>
                    <ul className="space-y-1">
                      {activeProtocol.orientacoes.map((ori, idx) => (
                        <li key={idx} className="text-xs sm:text-sm text-teal-900 flex items-start gap-2 leading-relaxed">
                          <span className="text-teal-600 font-bold shrink-0">•</span>
                          <span>{ori}</span>
                        </li>
                      ))}
                    </ul>
                    <label className="flex items-center gap-2 pt-1.5 border-t border-teal-200/60 cursor-pointer text-xs text-teal-900 font-medium">
                      <input
                        type="checkbox"
                        checked={includeOrientacoesInObs}
                        onChange={(e) => setIncludeOrientacoesInObs(e.target.checked)}
                        className="rounded border-teal-400 text-teal-600 focus:ring-teal-500"
                      />
                      Incluir estas orientações no corpo da receita impressa
                    </label>
                  </CardContent>
                </Card>
              )}

              {/* Sticky Action Footer -> Central de Formulários / Copy */}
              <Card className="sticky bottom-16 md:bottom-2 z-20 border-2 border-teal-200 bg-white shadow-lg">
                <CardContent className="px-4 py-3.5 pt-3.5 sm:px-4 sm:py-4 sm:pt-4 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 min-w-0">
                      {requiredReceipt === 'receita_controle' ? (
                        <>
                          <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span className="truncate">
                            {isHospitalOnlyScenario
                              ? 'Uso Hospitalar / Controle Especial'
                              : 'Recomendado: Controle Especial (2 vias)'}
                          </span>
                        </>
                      ) : isHospitalOnlyScenario ? (
                        <>
                          <Syringe className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <span className="truncate">Prescrição Hospitalar / Pronto Atendimento</span>
                        </>
                      ) : (
                        <>
                          <FileText className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <span className="truncate">Recomendado: Receita Simples</span>
                        </>
                      )}
                    </div>
                    <span className="text-[11px] font-medium text-slate-500 shrink-0 tabular-nums">
                      {selectedMeds.length > 0
                        ? `${selectedMeds.length} item(ns) selecionado(s)`
                        : 'Nenhum item marcado'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {isHospitalOnlyScenario ? (
                      <>
                        <Button
                          type="button"
                          onClick={handleCopyPrescriptionText}
                          className="bg-teal-600 hover:bg-teal-700 text-white text-xs h-9 px-3.5 flex-1 sm:flex-none"
                        >
                          {copiedId === 'prescription' ? (
                            <>
                              <Check className="w-3.5 h-3.5 mr-1.5" /> Copiado!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar p/ Prontuário
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleGenerateReceipt(requiredReceipt)}
                          className="text-xs h-9 px-3"
                        >
                          Abrir em Formulários <ArrowRight className="w-3.5 h-3.5 ml-1" />
                        </Button>
                      </>
                    ) : requiredReceipt === 'receita_controle' ? (
                      <>
                        <Button
                          type="button"
                          onClick={() => handleGenerateReceipt('receita_controle')}
                          className="bg-teal-600 hover:bg-teal-700 text-white text-xs h-9 px-3.5 flex-1 sm:flex-none"
                        >
                          <Lock className="w-3.5 h-3.5 mr-1.5" />
                          Gerar Receita Controle Especial
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleGenerateReceipt('receita_simples')}
                          className="text-xs h-9 px-3"
                        >
                          Receita Simples
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleCopyPrescriptionText}
                          className="text-xs h-9 px-2.5"
                          title="Copiar prescrição em texto"
                        >
                          {copiedId === 'prescription' ? (
                            <Check className="w-3.5 h-3.5 text-teal-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          type="button"
                          onClick={() => handleGenerateReceipt('receita_simples')}
                          className="bg-teal-600 hover:bg-teal-700 text-white text-xs h-9 px-3.5 flex-1 sm:flex-none"
                        >
                          <FileText className="w-3.5 h-3.5 mr-1.5" />
                          Gerar Receita Simples
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleGenerateReceipt('receita_controle')}
                          className="text-xs h-9 px-3"
                        >
                          Controle Especial (2 vias)
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleCopyPrescriptionText}
                          className="text-xs h-9 px-2.5"
                          title="Copiar prescrição em texto"
                        >
                          {copiedId === 'prescription' ? (
                            <Check className="w-3.5 h-3.5 text-teal-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
