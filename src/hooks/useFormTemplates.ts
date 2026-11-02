import { useState, useEffect, useCallback, useRef } from 'react';
import type { FormTemplate, SavedFormPreset } from '@/types/formTemplate';
import { db, stripUndefined } from '@/lib/firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { getActiveUserIdFromStorage } from '@/contexts/UserContext';
import { writeScopedLocalStorage } from '@/hooks/useLocalStorage';

const COLLECTION_NAME = 'formTemplates';
const LOCAL_TEMPLATES_KEY = 'evolutigas_custom_form_templates_v2';
const LOCAL_COMMUNITY_KEY = 'evolutigas_community_form_templates_v1';
const LOCAL_PRESETS_KEY = 'evolutigas_saved_form_presets_v2';
const DISMISSED_OFFICIAL_KEY = 'evolutigas_dismissed_official_templates_v1';
const LEGACY_MIGRATED_KEY = 'evolutigas_auth_legacy_migrated_v1';
const PDF_CHUNK_SIZE = 650_000;
export const OFFICIAL_AUTHOR_ID = 'pdrtorres';

export function isOfficialTemplateOwner(ownerId?: string): boolean {
  if (!ownerId) return true;
  const clean = ownerId.trim().toLowerCase();
  return clean === OFFICIAL_AUTHOR_ID || clean.includes('pdrtorres');
}

function normalizeTplName(name?: string): string {
  return (name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getScopedTemplatesKey(userId: string | null): string {
  return `u_${userId || 'anon'}_${LOCAL_TEMPLATES_KEY}`;
}

function getScopedPresetsKey(userId: string | null): string {
  return `u_${userId || 'anon'}_${LOCAL_PRESETS_KEY}`;
}

function getScopedDismissedKey(userId: string | null): string {
  return `u_${userId || 'anon'}_${DISMISSED_OFFICIAL_KEY}`;
}

function loadDismissedOfficialIds(userId: string | null): Set<string> {
  try {
    const raw = localStorage.getItem(getScopedDismissedKey(userId));
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveDismissedOfficialIds(userId: string | null, ids: Set<string>) {
  try {
    localStorage.setItem(getScopedDismissedKey(userId), JSON.stringify(Array.from(ids)));
  } catch {
    // ignore
  }
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

function loadLocalCommunityTemplates(): FormTemplate[] {
  try {
    const raw = localStorage.getItem(LOCAL_COMMUNITY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalCommunityTemplates(list: FormTemplate[]) {
  try {
    localStorage.setItem(LOCAL_COMMUNITY_KEY, JSON.stringify(list));
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
  const [communityTemplates, setCommunityTemplates] = useState<FormTemplate[]>(() =>
    loadLocalCommunityTemplates()
  );
  const [presets, setPresets] = useState<SavedFormPreset[]>(() => loadLocalPresets(activeUserId));
  const deletedIdsRef = useRef<Set<string>>(new Set());
  const uploadedRescueIdsRef = useRef<Set<string>>(new Set());
  const promotedOfficialIdsRef = useRef<Set<string>>(new Set());

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
        const allRawDocs: Array<FormTemplate & { pdfChunkCount?: number }> = [];

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
          allRawDocs.push(data);
        });

        const localFallbackList = loadLocalTemplates(uid);
        const localCommFallbackList = loadLocalCommunityTemplates();

        const reassembleTemplate = (item: FormTemplate & { pdfChunkCount?: number }): FormTemplate => {
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
              const localFallback =
                localFallbackList.find((t) => t.id === item.id) ||
                localCommFallbackList.find((t) => t.id === item.id);
              if (localFallback?.pdfBase64) {
                fullBase64 = localFallback.pdfBase64;
              }
            }
          }
          const { pdfChunkCount: _ignored, ...cleanItem } = item;
          return {
            ...cleanItem,
            pdfBase64: fullBase64,
          };
        };

        const allCloudTemplates: FormTemplate[] = allRawDocs.map(reassembleTemplate);

        // 1. Identify Official Templates (created by pdrtorres or marked isOfficial)
        const officialTemplates: FormTemplate[] = [];
        const officialById = new Map<string, FormTemplate>();

        for (const tpl of allCloudTemplates) {
          if (tpl.id.startsWith('comm_')) continue;
          const isFromPdr = isOfficialTemplateOwner(tpl.ownerId);
          if (tpl.isOfficial || isFromPdr) {
            const enrichedOfficial: FormTemplate = {
              ...tpl,
              ownerId: tpl.ownerId || OFFICIAL_AUTHOR_ID,
              ownerName: tpl.ownerName || OFFICIAL_AUTHOR_ID,
              isOfficial: true,
              isCommunity: true,
            };
            officialTemplates.push(enrichedOfficial);
            officialById.set(enrichedOfficial.id, enrichedOfficial);

            // Ensure pdrtorres templates in Firestore have official flags persisted
            if (
              isOfficialTemplateOwner(uid) &&
              (!tpl.isOfficial || !tpl.isCommunity || !tpl.ownerId) &&
              !promotedOfficialIdsRef.current.has(tpl.id)
            ) {
              promotedOfficialIdsRef.current.add(tpl.id);
              persistTemplateToFirestore(enrichedOfficial).catch(() => {});
            }
          }
        }

        // 2. Build the user's personal + official templates list
        const loadedTemplates: FormTemplate[] = [];
        const cloudIds = new Set<string>();
        const dismissedOfficial = loadDismissedOfficialIds(uid);

        for (const tpl of allCloudTemplates) {
          if (tpl.id.startsWith('comm_')) continue;
          if (deletedIdsRef.current.has(tpl.id)) continue;

          const belongsToCurrentUser =
            tpl.ownerId === uid || (!tpl.ownerId && (legacyOwnerId === uid || isOfficialTemplateOwner(uid)));

          if (belongsToCurrentUser) {
            const enriched: FormTemplate = isOfficialTemplateOwner(uid)
              ? {
                  ...tpl,
                  ownerId: OFFICIAL_AUTHOR_ID,
                  ownerName: tpl.ownerName || OFFICIAL_AUTHOR_ID,
                  isOfficial: true,
                  isCommunity: true,
                }
              : tpl;
            loadedTemplates.push(enriched);
            cloudIds.add(enriched.id);
          }
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
            // If this local template was an official template from another user that was deleted from cloud, skip rescuing as personal
            if (localTpl.ownerId && localTpl.ownerId !== uid && !isOfficialTemplateOwner(uid)) {
              continue;
            }
            const tagged: FormTemplate = isOfficialTemplateOwner(uid)
              ? {
                  ...localTpl,
                  ownerId: OFFICIAL_AUTHOR_ID,
                  ownerName: localTpl.ownerName || OFFICIAL_AUTHOR_ID,
                  isOfficial: true,
                  isCommunity: true,
                }
              : { ...localTpl, ownerId: uid };
            loadedTemplates.push(tagged);
            cloudIds.add(tagged.id);

            if (isOfficialTemplateOwner(uid)) {
              officialById.set(tagged.id, tagged);
              if (!officialTemplates.some((o) => o.id === tagged.id)) {
                officialTemplates.push(tagged);
              }
            }

            if (!uploadedRescueIdsRef.current.has(tagged.id)) {
              uploadedRescueIdsRef.current.add(tagged.id);
              persistTemplateToFirestore(tagged).catch((err) => {
                console.warn('Could not rescue local template to Firestore:', err);
              });
            }
          }
        }

        // Automatically include Official (pdrtorres) templates for ALL users by default
        if (!isOfficialTemplateOwner(uid)) {
          for (const officialTpl of officialTemplates) {
            if (deletedIdsRef.current.has(officialTpl.id)) continue;
            if (dismissedOfficial.has(officialTpl.id)) continue;

            const alreadyHasCopy = loadedTemplates.some(
              (ut) =>
                ut.id === officialTpl.id ||
                ut.sourceTemplateId === officialTpl.id ||
                normalizeTplName(ut.name) === normalizeTplName(officialTpl.name)
            );
            if (!alreadyHasCopy) {
              loadedTemplates.push(officialTpl);
              cloudIds.add(officialTpl.id);
            }
          }
        }

        // 3. Build "Documentos da Comunitigas" list (Official pdrtorres templates + Community-shared templates)
        const commMap = new Map<string, FormTemplate>();

        // First add all official templates from pdrtorres
        for (const offTpl of officialTemplates) {
          if (deletedIdsRef.current.has(offTpl.id)) continue;
          commMap.set(offTpl.id, offTpl);
        }

        // Next add all templates marked isCommunity or prefixed with comm_
        for (const tpl of allCloudTemplates) {
          if (deletedIdsRef.current.has(tpl.id)) continue;
          if (tpl.id.startsWith('comm_') || tpl.isCommunity) {
            const key = tpl.sourceTemplateId || tpl.id;
            if (!commMap.has(key)) {
              commMap.set(key, {
                ...tpl,
                isCommunity: true,
                ownerName: tpl.ownerName || tpl.ownerId || 'colega',
              });
            }
          }
        }

        const commList = Array.from(commMap.values()).sort((a, b) => {
          // Official templates first, then newest
          if (Boolean(a.isOfficial) !== Boolean(b.isOfficial)) {
            return a.isOfficial ? -1 : 1;
          }
          return (b.createdAt || '').localeCompare(a.createdAt || '');
        });

        loadedTemplates.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setTemplates(loadedTemplates);
        saveLocalTemplates(uid, loadedTemplates);
        setCommunityTemplates(commList);
        saveLocalCommunityTemplates(commList);
      },
      (error) => {
        console.warn('Firestore snapshot fallback to localStorage:', error);
        setTemplates(loadLocalTemplates(uid));
        setCommunityTemplates(loadLocalCommunityTemplates());
      }
    );

    return () => {
      unsubscribe();
    };
  }, [activeUserId]);

  const saveTemplate = useCallback(async (template: FormTemplate) => {
    const uid = getActiveUserIdFromStorage() || 'anon';
    const isPdr = isOfficialTemplateOwner(uid);

    // If a non-pdrtorres user edits an official template owned by pdrtorres, fork it into a personal copy
    const isEditingForeignOfficial =
      !isPdr &&
      ((template.ownerId && template.ownerId !== uid) ||
        (template.isOfficial && template.ownerId !== uid));

    const targetId = isEditingForeignOfficial ? `${template.id}__${uid}` : template.id;
    deletedIdsRef.current.delete(targetId);

    const taggedTemplate: FormTemplate = stripUndefined({
      ...template,
      id: targetId,
      ownerId: isPdr ? OFFICIAL_AUTHOR_ID : uid,
      ownerName: isPdr ? OFFICIAL_AUTHOR_ID : template.ownerName || uid,
      isOfficial: isPdr ? true : false,
      isCommunity: isPdr ? true : Boolean(template.isCommunity),
      sourceTemplateId: isEditingForeignOfficial
        ? template.sourceTemplateId || template.id
        : template.sourceTemplateId,
    });

    setTemplates((prev) => {
      const filtered = isEditingForeignOfficial
        ? prev.filter((t) => t.id !== template.id && t.id !== taggedTemplate.id)
        : prev;
      const exists = filtered.some((t) => t.id === taggedTemplate.id);
      const next = exists
        ? filtered.map((t) => (t.id === taggedTemplate.id ? taggedTemplate : t))
        : [taggedTemplate, ...filtered];
      saveLocalTemplates(uid, next);
      return next;
    });

    try {
      await persistTemplateToFirestore(taggedTemplate);
    } catch (e) {
      console.error('Error saving template to Firestore', e);
    }
  }, []);

  const deleteTemplate = useCallback(
    async (id: string) => {
      const uid = getActiveUserIdFromStorage() || 'anon';
      const target = templates.find((t) => t.id === id);
      const isPdr = isOfficialTemplateOwner(uid);

      // If a regular user removes an official template from their list, only dismiss it locally for them
      if (target && !isPdr && (target.isOfficial || (target.ownerId && target.ownerId !== uid))) {
        const dismissed = loadDismissedOfficialIds(uid);
        dismissed.add(id);
        if (target.sourceTemplateId) dismissed.add(target.sourceTemplateId);
        saveDismissedOfficialIds(uid, dismissed);

        setTemplates((prev) => {
          const next = prev.filter((t) => t.id !== id);
          saveLocalTemplates(uid, next);
          return next;
        });
        return;
      }

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
    },
    [templates]
  );

  const clearAllTemplates = useCallback(async () => {
    const uid = getActiveUserIdFromStorage() || 'anon';
    const isPdr = isOfficialTemplateOwner(uid);
    const ownIds: string[] = [];
    const dismissed = loadDismissedOfficialIds(uid);

    templates.forEach((t) => {
      if (!isPdr && (t.isOfficial || (t.ownerId && t.ownerId !== uid))) {
        dismissed.add(t.id);
      } else {
        ownIds.push(t.id);
        deletedIdsRef.current.add(t.id);
      }
    });

    saveDismissedOfficialIds(uid, dismissed);
    setTemplates([]);
    setPresets([]);
    saveLocalTemplates(uid, []);
    saveLocalPresets(uid, []);
    try {
      await Promise.allSettled(ownIds.map((id) => removeTemplateFromFirestore(id)));
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

  // --- "Documentos da Comunitigas" Collaborations ---
  const publishToCommunity = useCallback(
    async (template: FormTemplate, authorName?: string) => {
      const uid = getActiveUserIdFromStorage() || 'anon';
      const isPdr = isOfficialTemplateOwner(uid);
      const cleanAuthor = (authorName || template.ownerName || uid).trim();

      // Update the user's own template with isCommunity: true
      const updatedOwn: FormTemplate = stripUndefined({
        ...template,
        ownerId: isPdr ? OFFICIAL_AUTHOR_ID : template.ownerId || uid,
        ownerName: isPdr ? OFFICIAL_AUTHOR_ID : cleanAuthor,
        isOfficial: isPdr ? true : Boolean(template.isOfficial),
        isCommunity: true,
      });

      setTemplates((prev) => {
        const next = prev.map((t) => (t.id === updatedOwn.id ? updatedOwn : t));
        saveLocalTemplates(uid, next);
        return next;
      });

      // Also create/update a dedicated community entry so it stays available in Comunitigas
      const commId = isPdr
        ? updatedOwn.id
        : updatedOwn.id.startsWith('comm_')
          ? updatedOwn.id
          : `comm_${updatedOwn.id}`;

      const commTemplate: FormTemplate = stripUndefined({
        ...updatedOwn,
        id: commId,
        sourceTemplateId: updatedOwn.id,
        isCommunity: true,
        ownerId: isPdr ? OFFICIAL_AUTHOR_ID : uid,
        ownerName: isPdr ? OFFICIAL_AUTHOR_ID : cleanAuthor,
        createdAt: updatedOwn.createdAt || new Date().toISOString(),
      });

      setCommunityTemplates((prev) => {
        const filtered = prev.filter(
          (c) => c.id !== commTemplate.id && c.id !== updatedOwn.id && c.sourceTemplateId !== updatedOwn.id
        );
        const next = [commTemplate, ...filtered];
        saveLocalCommunityTemplates(next);
        return next;
      });

      try {
        await persistTemplateToFirestore(updatedOwn);
        if (commId !== updatedOwn.id) {
          await persistTemplateToFirestore(commTemplate);
        }
      } catch (e) {
        console.error('Error publishing template to Comunitigas', e);
      }
    },
    []
  );

  const addCommunityTemplateToMyForms = useCallback(
    async (communityTemplate: FormTemplate): Promise<FormTemplate> => {
      const uid = getActiveUserIdFromStorage() || 'anon';
      const baseId = communityTemplate.sourceTemplateId || communityTemplate.id;

      // Un-dismiss if it was a dismissed official template
      const dismissed = loadDismissedOfficialIds(uid);
      if (dismissed.has(communityTemplate.id) || dismissed.has(baseId)) {
        dismissed.delete(communityTemplate.id);
        dismissed.delete(baseId);
        saveDismissedOfficialIds(uid, dismissed);
      }

      // Check if already in user's templates
      const existing = templates.find(
        (t) =>
          t.id === communityTemplate.id ||
          t.id === baseId ||
          t.sourceTemplateId === communityTemplate.id ||
          t.sourceTemplateId === baseId
      );
      if (existing) {
        return existing;
      }

      // If it's an official template, we can add it directly or as a personal copy
      if (communityTemplate.isOfficial && !isOfficialTemplateOwner(uid)) {
        setTemplates((prev) => {
          if (prev.some((t) => t.id === communityTemplate.id)) return prev;
          const next = [communityTemplate, ...prev];
          saveLocalTemplates(uid, next);
          return next;
        });
        return communityTemplate;
      }

      // Otherwise clone into the user's personal templates in Firestore
      const personalId = `${baseId.replace(/^comm_/, '')}__${uid}`;
      deletedIdsRef.current.delete(personalId);
      const personalCopy: FormTemplate = stripUndefined({
        ...communityTemplate,
        id: personalId,
        ownerId: uid,
        isOfficial: false,
        isCommunity: false,
        sourceTemplateId: communityTemplate.id,
        createdAt: new Date().toISOString(),
      });

      setTemplates((prev) => {
        const exists = prev.some((t) => t.id === personalCopy.id);
        const next = exists ? prev : [personalCopy, ...prev];
        saveLocalTemplates(uid, next);
        return next;
      });

      try {
        await persistTemplateToFirestore(personalCopy);
      } catch (e) {
        console.error('Error saving community template to personal forms', e);
      }

      return personalCopy;
    },
    [templates]
  );

  const removeFromCommunity = useCallback(async (communityTemplate: FormTemplate) => {
    const uid = getActiveUserIdFromStorage() || 'anon';
    deletedIdsRef.current.add(communityTemplate.id);

    setCommunityTemplates((prev) => {
      const next = prev.filter((c) => c.id !== communityTemplate.id);
      saveLocalCommunityTemplates(next);
      return next;
    });

    // If user also has the source template, unset isCommunity on it
    const sourceId = communityTemplate.sourceTemplateId || communityTemplate.id.replace(/^comm_/, '');
    setTemplates((prev) => {
      const next = prev.map((t) =>
        t.id === sourceId || t.id === communityTemplate.id ? { ...t, isCommunity: false } : t
      );
      saveLocalTemplates(uid, next);
      return next;
    });

    try {
      if (communityTemplate.id.startsWith('comm_')) {
        await removeTemplateFromFirestore(communityTemplate.id);
      }
      const ownMatch = templates.find((t) => t.id === sourceId);
      if (ownMatch) {
        await persistTemplateToFirestore({ ...ownMatch, isCommunity: false });
      }
    } catch (e) {
      console.error('Error removing template from Comunitigas', e);
    }
  }, [templates]);

  const isTemplateInMyForms = useCallback(
    (communityTemplate: FormTemplate): boolean => {
      const baseId = communityTemplate.sourceTemplateId || communityTemplate.id;
      return templates.some(
        (t) =>
          t.id === communityTemplate.id ||
          t.id === baseId ||
          t.sourceTemplateId === communityTemplate.id ||
          t.sourceTemplateId === baseId ||
          normalizeTplName(t.name) === normalizeTplName(communityTemplate.name)
      );
    },
    [templates]
  );

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
    communityTemplates,
    saveTemplate,
    deleteTemplate,
    clearAllTemplates,
    renameTemplate,
    getTemplate,
    publishToCommunity,
    addCommunityTemplateToMyForms,
    removeFromCommunity,
    isTemplateInMyForms,
    presets,
    savePreset,
    deletePreset,
    getPresetsForForm,
  };
}

