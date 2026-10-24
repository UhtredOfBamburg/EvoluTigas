import { useState, useEffect, useCallback, useRef } from 'react';
import type { FormTemplate, SavedFormPreset } from '@/types/formTemplate';
import { db, stripUndefined } from '@/lib/firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { getActiveUserIdFromStorage } from '@/contexts/UserContext';
import { writeScopedLocalStorage } from '@/hooks/useLocalStorage';

const COLLECTION_NAME = 'formTemplates';
const LOCAL_TEMPLATES_KEY = 'evolutigas_custom_form_templates_v2';
const LOCAL_PRESETS_KEY = 'evolutigas_saved_form_presets_v2';
const LEGACY_MIGRATED_KEY = 'evolutigas_auth_legacy_migrated_v1';
const PDF_CHUNK_SIZE = 650_000;

function getScopedTemplatesKey(userId: string | null): string {
  return `u_${userId || 'anon'}_${LOCAL_TEMPLATES_KEY}`;
}

function getScopedPresetsKey(userId: string | null): string {
  return `u_${userId || 'anon'}_${LOCAL_PRESETS_KEY}`;
}

function loadLocalTemplates(userId: string | null): FormTemplate[] {
  try {
    const raw = localStorage.getItem(getScopedTemplatesKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalTemplates(userId: string | null, list: FormTemplate[]) {
  try {
    localStorage.setItem(getScopedTemplatesKey(userId), JSON.stringify(list));
  } catch {
    // ignore quota error
  }
}

function loadLocalPresets(userId: string | null): SavedFormPreset[] {
  try {
    const raw = localStorage.getItem(getScopedPresetsKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalPresets(userId: string | null, list: SavedFormPreset[]) {
  try {
    writeScopedLocalStorage(LOCAL_PRESETS_KEY, list, Boolean(userId));
  } catch {
    // ignore
  }
}

function splitIntoChunks(str: string, chunkSize: number): string[] {
  if (!str) return [''];
  const chunks: string[] = [];
  for (let i = 0; i < str.length; i += chunkSize) {
    chunks.push(str.slice(i, i + chunkSize));
  }
  return chunks;
}

async function persistTemplateToFirestore(template: FormTemplate): Promise<void> {
  const clean = stripUndefined(template);
  const fullBase64 = clean.pdfBase64 || '';
  const chunks = splitIntoChunks(fullBase64, PDF_CHUNK_SIZE);

  const mainPayload = {
    ...clean,
    pdfBase64: chunks[0] || '',
    pdfChunkCount: chunks.length,
  };

  await setDoc(doc(db, COLLECTION_NAME, clean.id), mainPayload);

  if (chunks.length > 1) {
    const chunkWrites: Promise<void>[] = [];
    for (let idx = 1; idx < chunks.length; idx++) {
      chunkWrites.push(
        setDoc(doc(db, COLLECTION_NAME, `pdf_chunk__${clean.id}__${idx}`), {
          ownerId: clean.ownerId || 'anon',
          templateId: clean.id,
          chunkIndex: idx,
          data: chunks[idx],
        })
      );
    }
    await Promise.all(chunkWrites);
  }
}

async function removeTemplateFromFirestore(templateId: string, chunkCount = 5): Promise<void> {
  const deletions: Promise<void>[] = [deleteDoc(doc(db, COLLECTION_NAME, templateId))];
  for (let idx = 1; idx < chunkCount; idx++) {
    deletions.push(deleteDoc(doc(db, COLLECTION_NAME, `pdf_chunk__${templateId}__${idx}`)));
  }
  await Promise.allSettled(deletions);
}

export function useFormTemplates() {
  const [activeUserId, setActiveUserId] = useState<string | null>(() => getActiveUserIdFromStorage());
  const [templates, setTemplates] = useState<FormTemplate[]>(() => loadLocalTemplates(activeUserId));
  const [presets, setPresets] = useState<SavedFormPreset[]>(() => loadLocalPresets(activeUserId));
  const deletedIdsRef = useRef<Set<string>>(new Set());
  const uploadedRescueIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleUserChanged = () => {
      const uid = getActiveUserIdFromStorage();
      setActiveUserId(uid);
      setTemplates(loadLocalTemplates(uid));
      setPresets(loadLocalPresets(uid));
    };

    const handleStorageSync = (e: Event) => {
      const custom = e as CustomEvent<{ rawKey?: string }>;
      if (custom.detail?.rawKey === LOCAL_PRESETS_KEY) {
        const uid = getActiveUserIdFromStorage();
        setPresets(loadLocalPresets(uid));
      }
    };

    window.addEventListener('evolutigas-user-changed', handleUserChanged);
    window.addEventListener('evolutigas-storage-sync', handleStorageSync);
    return () => {
      window.removeEventListener('evolutigas-user-changed', handleUserChanged);
      window.removeEventListener('evolutigas-storage-sync', handleStorageSync);
    };
  }, []);

  useEffect(() => {
    const uid = activeUserId;
    if (!uid) {
      setTemplates([]);
      setPresets([]);
      return;
    }

    setPresets(loadLocalPresets(uid));
    const legacyOwnerId = localStorage.getItem(LEGACY_MIGRATED_KEY);

    const q = collection(db, COLLECTION_NAME);
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const chunkMap = new Map<string, Record<number, string>>();
        const rawCloudTemplates: Array<FormTemplate & { pdfChunkCount?: number }> = [];

        snapshot.forEach((docSnap) => {
          if (
            docSnap.id.startsWith('user_profile__') ||
            docSnap.id.startsWith('user_workspace__')
          ) {
            return;
          }

          if (docSnap.id.startsWith('pdf_chunk__')) {
            const cData = docSnap.data() as {
              templateId?: string;
              chunkIndex?: number;
              data?: string;
            };
            if (cData?.templateId && typeof cData.chunkIndex === 'number' && typeof cData.data === 'string') {
              const existing = chunkMap.get(cData.templateId) || {};
              existing[cData.chunkIndex] = cData.data;
              chunkMap.set(cData.templateId, existing);
            }
            return;
          }

          const data = docSnap.data() as FormTemplate & { pdfChunkCount?: number };
          if (!data || !data.id || !data.fields) return;

          if (data.ownerId === uid) {
            rawCloudTemplates.push(data);
          } else if (!data.ownerId && legacyOwnerId === uid) {
            rawCloudTemplates.push({ ...data, ownerId: uid });
          }
        });

        const loadedTemplates: FormTemplate[] = [];
        const cloudIds = new Set<string>();

        for (const item of rawCloudTemplates) {
          if (deletedIdsRef.current.has(item.id)) continue;

          let fullBase64 = item.pdfBase64 || '';
          const chunkCount = item.pdfChunkCount || 1;
          if (chunkCount > 1) {
            const extraChunks = chunkMap.get(item.id) || {};
            let allChunksReady = true;
            const parts = [fullBase64];
            for (let idx = 1; idx < chunkCount; idx++) {
              if (typeof extraChunks[idx] === 'string') {
                parts.push(extraChunks[idx]);
              } else {
                allChunksReady = false;
                break;
              }
            }
            if (allChunksReady) {
              fullBase64 = parts.join('');
            } else {
              // Use local version while chunks finish arriving
              const localFallback = loadLocalTemplates(uid).find((t) => t.id === item.id);
              if (localFallback?.pdfBase64) {
                fullBase64 = localFallback.pdfBase64;
              }
            }
          }

          const { pdfChunkCount: _ignored, ...cleanItem } = item;
          loadedTemplates.push({
            ...cleanItem,
            pdfBase64: fullBase64,
          });
          cloudIds.add(item.id);
        }

        // Rescue any templates stored locally in this browser that are missing in Firestore
        const localTemplates = loadLocalTemplates(uid);
        for (const localTpl of localTemplates) {
          if (
            localTpl &&
            localTpl.id &&
            localTpl.pdfBase64 &&
            !cloudIds.has(localTpl.id) &&
            !deletedIdsRef.current.has(localTpl.id)
          ) {
            const tagged: FormTemplate = { ...localTpl, ownerId: uid };
            loadedTemplates.push(tagged);
            cloudIds.add(tagged.id);

            if (!uploadedRescueIdsRef.current.has(tagged.id)) {
              uploadedRescueIdsRef.current.add(tagged.id);
              persistTemplateToFirestore(tagged).catch((err) => {
                console.warn('Could not rescue local template to Firestore:', err);
              });
            }
          }
        }

        loadedTemplates.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setTemplates(loadedTemplates);
        saveLocalTemplates(uid, loadedTemplates);
      },
      (error) => {
        console.warn('Firestore snapshot fallback to localStorage:', error);
        setTemplates(loadLocalTemplates(uid));
      }
    );

    return () => {
      unsubscribe();
    };
  }, [activeUserId]);

  const saveTemplate = useCallback(async (template: FormTemplate) => {
    const uid = getActiveUserIdFromStorage() || 'anon';
    deletedIdsRef.current.delete(template.id);
    const taggedTemplate: FormTemplate = stripUndefined({
      ...template,
      ownerId: uid,
    });

    setTemplates((prev) => {
      const exists = prev.some((t) => t.id === taggedTemplate.id);
      const next = exists
        ? prev.map((t) => (t.id === taggedTemplate.id ? taggedTemplate : t))
        : [taggedTemplate, ...prev];
      saveLocalTemplates(uid, next);
      return next;
    });
    try {
      await persistTemplateToFirestore(taggedTemplate);
    } catch (e) {
      console.error('Error saving template to Firestore', e);
    }
  }, []);

  const deleteTemplate = useCallback(async (id: string) => {
    const uid = getActiveUserIdFromStorage() || 'anon';
    deletedIdsRef.current.add(id);
    setTemplates((prev) => {
      const next = prev.filter((t) => t.id !== id);
      saveLocalTemplates(uid, next);
      return next;
    });
    try {
      await removeTemplateFromFirestore(id);
    } catch (e) {
      console.error('Error deleting template from Firestore', e);
    }
  }, []);

  const clearAllTemplates = useCallback(async () => {
    const uid = getActiveUserIdFromStorage() || 'anon';
    const currentIds = templates.map((t) => t.id);
    currentIds.forEach((id) => deletedIdsRef.current.add(id));
    setTemplates([]);
    setPresets([]);
    saveLocalTemplates(uid, []);
    saveLocalPresets(uid, []);
    try {
      await Promise.allSettled(currentIds.map((id) => removeTemplateFromFirestore(id)));
    } catch (e) {
      console.error('Error clearing all templates from Firestore', e);
    }
  }, [templates]);

  const renameTemplate = useCallback(
    async (id: string, newName: string) => {
      const template = templates.find((t) => t.id === id);
      if (template) {
        const updated = { ...template, name: newName };
        await saveTemplate(updated);
      }
    },
    [templates, saveTemplate]
  );

  const getTemplate = useCallback((id: string) => templates.find((t) => t.id === id), [templates]);

  // --- Saved Form Presets ("Modelos de Preenchimento") ---
  const savePreset = useCallback((preset: SavedFormPreset) => {
    const uid = getActiveUserIdFromStorage() || 'anon';
    const taggedPreset: SavedFormPreset = stripUndefined({ ...preset, ownerId: uid });
    setPresets((prev) => {
      const exists = prev.some((p) => p.id === taggedPreset.id);
      const next = exists
        ? prev.map((p) => (p.id === taggedPreset.id ? taggedPreset : p))
        : [taggedPreset, ...prev];
      saveLocalPresets(uid, next);
      return next;
    });
  }, []);

  const deletePreset = useCallback((id: string) => {
    const uid = getActiveUserIdFromStorage() || 'anon';
    setPresets((prev) => {
      const next = prev.filter((p) => p.id !== id);
      saveLocalPresets(uid, next);
      return next;
    });
  }, []);

  const getPresetsForForm = useCallback(
    (formId: string) => presets.filter((p) => p.formId === formId),
    [presets]
  );

  return {
    templates,
    saveTemplate,
    deleteTemplate,
    clearAllTemplates,
    renameTemplate,
    getTemplate,
    presets,
    savePreset,
    deletePreset,
    getPresetsForForm,
  };
}

