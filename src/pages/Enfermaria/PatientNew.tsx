import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, Button, Label, Input } from '@/components/ui';
import { ArrowLeft, Save } from 'lucide-react';
import { useEnfermariaPatients, calculateAgeFromBirthDate } from '@/hooks/useEnfermariaPatients';
import { useToast } from '@/hooks/useToast';

export default function PatientNew() {
  const navigate = useNavigate();
  const { addPatient } = useEnfermariaPatients();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nome: '',
    dataNascimento: '',
    idadeManual: '',
    sexo: 'M' as 'M' | 'F' | 'O',
    leito: '',
    prontuario: '',
    admissionDate: new Date().toISOString().split('T')[0],
    diagnosticoPrincipal: '',
    comorbidades: '',
    alergias: 'Nega alergias',
    antibioticos: '',
    dispositivos: '',
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim()) {
      toast('Informe o nome completo do paciente.', 'error');
      return;
    }

    const computedAge = formData.dataNascimento
      ? calculateAgeFromBirthDate(formData.dataNascimento)
      : parseInt(formData.idadeManual, 10) || 0;

    const created = addPatient({
      name: formData.nome.trim(),
      birthDate: formData.dataNascimento || undefined,
      age: computedAge,
      sex: formData.sexo || 'M',
      bed: formData.leito.trim() || 'Sem leito',
      prontuario: formData.prontuario.trim() || undefined,
      admissionDate: formData.admissionDate || new Date().toISOString().split('T')[0],
      diagnosis: formData.diagnosticoPrincipal.trim() || 'Em investigação diagnóstica',
      comorbidades: formData.comorbidades.trim() || undefined,
      alergias: formData.alergias.trim() || 'Nega alergias',
      antibioticos: formData.antibioticos.trim() || undefined,
      dispositivos: formData.dispositivos.trim() || undefined,
    });

    toast(`Paciente ${created.name} admitido com sucesso!`, 'success');
    navigate(`/enfermaria/paciente/${created.id}`);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/enfermaria')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Admitir Novo Paciente</h1>
          <p className="text-sm text-slate-500">Cadastre um novo paciente na enfermaria e inicie a evolução ou admissão.</p>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <Card>
          <CardHeader>
            <CardTitle>Identificação e Dados Clínicos da Internação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-2">
                <Label>Nome Completo *</Label>
                <Input
                  placeholder="Ex: João da Silva Oliveira"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Nº Prontuário</Label>
                <Input
                  placeholder="Ex: 482910"
                  value={formData.prontuario}
                  onChange={(e) => setFormData({ ...formData, prontuario: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Data de Nascimento</Label>
                <Input
                  type="date"
                  value={formData.dataNascimento}
                  onChange={(e) => setFormData({ ...formData, dataNascimento: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Idade (anos)</Label>
                <Input
                  type="number"
                  placeholder={
                    formData.dataNascimento
                      ? String(calculateAgeFromBirthDate(formData.dataNascimento))
                      : 'Ex: 65'
                  }
                  value={
                    formData.dataNascimento
                      ? String(calculateAgeFromBirthDate(formData.dataNascimento))
                      : formData.idadeManual
                  }
                  onChange={(e) => setFormData({ ...formData, idadeManual: e.target.value })}
                  disabled={Boolean(formData.dataNascimento)}
                />
              </div>
              <div className="space-y-2">
                <Label>Sexo</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500"
                  value={formData.sexo}
                  onChange={(e) => setFormData({ ...formData, sexo: e.target.value as 'M' | 'F' | 'O' })}
                >
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                  <option value="O">Outro</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Leito / Setor *</Label>
                <Input
                  placeholder="Ex: Leito 12A"
                  value={formData.leito}
                  onChange={(e) => setFormData({ ...formData, leito: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Data de Internação</Label>
                <Input
                  type="date"
                  value={formData.admissionDate}
                  onChange={(e) => setFormData({ ...formData, admissionDate: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Diagnóstico Principal / Hipótese Diagnóstica (HD)</Label>
              <Input
                placeholder="Ex: Pneumonia Adquirida na Comunidade (PAC)"
                value={formData.diagnosticoPrincipal}
                onChange={(e) => setFormData({ ...formData, diagnosticoPrincipal: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Comorbidades / Antecedentes</Label>
                <Input
                  placeholder="Ex: HAS, DM2, Ex-tabagista"
                  value={formData.comorbidades}
                  onChange={(e) => setFormData({ ...formData, comorbidades: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Alergias</Label>
                <Input
                  placeholder="Ex: Nega alergias / Dipirona"
                  value={formData.alergias}
                  onChange={(e) => setFormData({ ...formData, alergias: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Antibióticos / Terapias em Curso</Label>
                <Input
                  placeholder="Ex: Ceftriaxona 2g/dia (D1)"
                  value={formData.antibioticos}
                  onChange={(e) => setFormData({ ...formData, antibioticos: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Dispositivos Invasivos</Label>
                <Input
                  placeholder="Ex: AVP em MSE, SVD"
                  value={formData.dispositivos}
                  onChange={(e) => setFormData({ ...formData, dispositivos: e.target.value })}
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => navigate('/enfermaria')}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-teal-600 hover:bg-teal-700">
                <Save className="w-4 h-4 mr-2" />
                Salvar e Abrir Prontuário
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
