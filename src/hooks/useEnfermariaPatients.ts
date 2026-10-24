import { useLocalStorage } from './useLocalStorage';

export interface PatientPendencia {
  id: string;
  text: string;
  done: boolean;
}

export interface EnfermariaPatient {
  id: string;
  name: string;
  birthDate?: string;
  age: number;
  sex: 'M' | 'F' | 'O';
  bed: string;
  diagnosis: string;
  admissionDate: string;
  prontuario?: string;
  alergias?: string;
  comorbidades?: string;
  antibioticos?: string;
  dispositivos?: string;
  pendencias?: PatientPendencia[];
  status: 'internado' | 'alta';
  lastUpdate: string;
  googleDoc?: {
    docId: string;
    title: string;
    url: string;
    lastSyncedAt?: string;
  } | null;
}

const DEFAULT_PATIENTS: EnfermariaPatient[] = [
  {
    id: '1',
    name: 'João Silva Oliveira',
    birthDate: '1961-04-12',
    age: 65,
    sex: 'M',
    bed: 'Leito 12A',
    diagnosis: 'Pneumonia Adquirida na Comunidade (PAC)',
    admissionDate: '2026-10-19',
    prontuario: '482910',
    alergias: 'Dipirona',
    comorbidades: 'HAS, Ex-tabagista (30 maços-ano)',
    antibioticos: 'Ceftriaxona 2g/dia (D4) + Azitromicina 500mg/dia (D4)',
    dispositivos: 'AVP em MSE',
    pendencias: [
      { id: 'p1', text: 'Checar resultado de PCR e leucograma de controle', done: false },
      { id: 'p2', text: 'Avaliar desmame de O2 e transição para ATB VO no D5', done: false },
    ],
    status: 'internado',
    lastUpdate: 'Hoje, 08:30',
  },
  {
    id: '2',
    name: 'Maria Santos Souza',
    birthDate: '1984-08-22',
    age: 42,
    sex: 'F',
    bed: 'Leito 14B',
    diagnosis: 'Pielonefrite Aguda Não Complicada',
    admissionDate: '2026-10-21',
    prontuario: '519023',
    alergias: 'Nega alergias',
    comorbidades: 'DM2 em uso de Metformina',
    antibioticos: 'Cefepime 2g 12/12h (D2)',
    dispositivos: 'AVP em MSD',
    pendencias: [
      { id: 'p3', text: 'Cobrar resultado de urocultura com antibiograma', done: false },
      { id: 'p4', text: 'USG de rins e vias urinárias solicitado', done: true },
    ],
    status: 'internado',
    lastUpdate: 'Ontem, 16:45',
  },
  {
    id: '3',
    name: 'Antônio Ferreira Lima',
    birthDate: '1948-01-10',
    age: 78,
    sex: 'M',
    bed: 'Leito 03C',
    diagnosis: 'Insuficiência Cardíaca Descompensada (Perfil B)',
    admissionDate: '2026-10-18',
    prontuario: '330194',
    alergias: 'Nega alergias',
    comorbidades: 'ICFEr (FE 32%), FA crônica, DRC estágio 3b',
    antibioticos: 'Sem ATB no momento',
    dispositivos: 'AVP salinizado + SVD para controle de diurese',
    pendencias: [
      { id: 'p5', text: 'Controle diário de peso em jejum e balanço hídrico', done: false },
      { id: 'p6', text: 'Checar função renal (Cr/U) e K+ pós-furosemida EV', done: false },
    ],
    status: 'internado',
    lastUpdate: 'Hoje, 09:15',
  },
];

export function calculateAgeFromBirthDate(birthDate?: string): number {
  if (!birthDate) return 0;
  const parts = birthDate.split('-');
  if (parts.length !== 3) return 0;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const today = new Date();
  let age = today.getFullYear() - year;
  const m = today.getMonth() - month;
  if (m < 0 || (m === 0 && today.getDate() < day)) {
    age--;
  }
  return Math.max(0, age);
}

export function calculateDaysInterned(admissionDate?: string): number {
  if (!admissionDate) return 1;
  const start = new Date(admissionDate + 'T00:00:00');
  if (isNaN(start.getTime())) return 1;
  const now = new Date();
  const diff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff + 1);
}

export function useEnfermariaPatients() {
  const [patients, setPatients] = useLocalStorage<EnfermariaPatient[]>(
    'evolutigas_enfermaria_patients_v1',
    DEFAULT_PATIENTS
  );

  const addPatient = (data: Omit<EnfermariaPatient, 'id' | 'lastUpdate' | 'status'>) => {
    const newPatient: EnfermariaPatient = {
      ...data,
      id: Date.now().toString(),
      status: 'internado',
      lastUpdate: 'Recém-admitido',
    };
    setPatients((prev) => [newPatient, ...prev]);
    return newPatient;
  };

  const updatePatient = (id: string, patch: Partial<EnfermariaPatient>) => {
    setPatients((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
    );
  };

  const addPendencia = (patientId: string, text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id !== patientId) return p;
        const list = p.pendencias || [];
        return {
          ...p,
          pendencias: [...list, { id: Date.now().toString(), text: clean, done: false }],
        };
      })
    );
  };

  const togglePendencia = (patientId: string, pendenciaId: string) => {
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id !== patientId) return p;
        const list = (p.pendencias || []).map((item) =>
          item.id === pendenciaId ? { ...item, done: !item.done } : item
        );
        return { ...p, pendencias: list };
      })
    );
  };

  const removePendencia = (patientId: string, pendenciaId: string) => {
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id !== patientId) return p;
        const list = (p.pendencias || []).filter((item) => item.id !== pendenciaId);
        return { ...p, pendencias: list };
      })
    );
  };

  const deletePatient = (id: string) => {
    setPatients((prev) => prev.filter((p) => p.id !== id));
  };

  const getPatientById = (id?: string) => {
    if (!id) return undefined;
    return patients.find((p) => p.id === id);
  };

  return {
    patients,
    setPatients,
    addPatient,
    updatePatient,
    addPendencia,
    togglePendencia,
    removePendencia,
    deletePatient,
    getPatientById,
  };
}

