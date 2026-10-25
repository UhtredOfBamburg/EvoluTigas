import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db, stripUndefined } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs, onSnapshot } from 'firebase/firestore';
import {
  syncAllLocalWorkspaceWithCloud,
  subscribeWorkspaceFromCloud,
} from '@/hooks/useLocalStorage';
import { SHARED_BUILTIN_KEY_STORAGE, getBuiltinGeminiApiKey } from '@/lib/aiClient';

export type AiChatProvider = 'builtin' | 'claude' | 'chatgpt' | 'gemini';

export interface AiConnectionsState {
  activeProvider: AiChatProvider;
  builtinModel?: string;
  claudeKey?: string;
  claudeModel?: string;
  claudeConnected?: boolean;
  chatgptKey?: string;
  chatgptModel?: string;
  chatgptConnected?: boolean;
  geminiKey?: string;
  geminiModel?: string;
  geminiConnected?: boolean;
  updatedAt?: number;
}

export const DEFAULT_AI_CONNECTIONS: AiConnectionsState = {
  activeProvider: 'builtin',
  builtinModel: 'gemini-3.8-flash',
  claudeKey: '',
  claudeModel: 'claude-opus-5-5',
  claudeConnected: false,
  chatgptKey: '',
  chatgptModel: 'gpt-5.6-sol',
  chatgptConnected: false,
  geminiKey: '',
  geminiModel: 'gemini-4-argon',
  geminiConnected: false,
  updatedAt: 0,
};

function normalizeAiConnections(conn?: Partial<AiConnectionsState>): AiConnectionsState {
  const merged: AiConnectionsState = {
    ...DEFAULT_AI_CONNECTIONS,
    ...(conn || {}),
  };
  if (merged.geminiModel === 'gemini-2.5-flash') {
    merged.geminiModel = 'gemini-3.8-flash';
  } else if (merged.geminiModel === 'gemini-2.5-pro') {
    merged.geminiModel = 'gemini-4-argon';
  }
  if (!merged.builtinModel) {
    merged.builtinModel = 'gemini-3.8-flash';
  }
  return merged;
}

/**
 * Merges cloud and local AI connection states per account without ever letting
 * an unconfigured browser/device's empty strings overwrite keys saved in the cloud.
 */
export function mergeAiConnections(
  cloud?: Partial<AiConnectionsState>,
  local?: Partial<AiConnectionsState>
): AiConnectionsState {
  const c = normalizeAiConnections(cloud);
  const l = normalizeAiConnections(local);
  const cTs = Number(c.updatedAt) || 0;
  const lTs = Number(l.updatedAt) || 0;
  const preferLocal = lTs > cTs;

  const pickKey = (cVal?: string, lVal?: string): string => {
    const cleanC = (cVal || '').trim();
    const cleanL = (lVal || '').trim();
    if (preferLocal) return cleanL || cleanC;
    return cleanC || cleanL;
  };

  const claudeKey = pickKey(c.claudeKey, l.claudeKey);
  const chatgptKey = pickKey(c.chatgptKey, l.chatgptKey);
  const geminiKey = pickKey(c.geminiKey, l.geminiKey);

  let activeProvider: AiChatProvider = preferLocal ? l.activeProvider : c.activeProvider;
  if (activeProvider === 'builtin') {
    if (c.activeProvider && c.activeProvider !== 'builtin') {
      activeProvider = c.activeProvider;
    } else if (l.activeProvider && l.activeProvider !== 'builtin') {
      activeProvider = l.activeProvider;
    }
  }

  return normalizeAiConnections({
    activeProvider,
    builtinModel: (preferLocal ? l.builtinModel : c.builtinModel) || c.builtinModel || l.builtinModel,
    claudeKey,
    claudeModel: (preferLocal ? l.claudeModel : c.claudeModel) || c.claudeModel || l.claudeModel,
    claudeConnected: Boolean(claudeKey) && Boolean(c.claudeConnected || l.claudeConnected),
    chatgptKey,
    chatgptModel: (preferLocal ? l.chatgptModel : c.chatgptModel) || c.chatgptModel || l.chatgptModel,
    chatgptConnected: Boolean(chatgptKey) && Boolean(c.chatgptConnected || l.chatgptConnected),
    geminiKey,
    geminiModel: (preferLocal ? l.geminiModel : c.geminiModel) || c.geminiModel || l.geminiModel,
    geminiConnected: Boolean(geminiKey) && Boolean(c.geminiConnected || l.geminiConnected),
    updatedAt: Math.max(cTs, lTs),
  });
}

export interface AppUser {
  id: string;
  name: string;
  hasPassword: boolean;
  passwordHash?: string;
  createdAt: string;
  aiConnections?: AiConnectionsState;
}

interface UserContextValue {
  currentUser: AppUser | null;
  knownUsers: AppUser[];
  isLoadingAuth: boolean;
  loginOrRegister: (
    name: string,
    password?: string
  ) => Promise<{ ok: boolean; error?: string; isNew?: boolean }>;
  logout: () => void;
  updateAiConnections: (patch: Partial<AiConnectionsState>) => Promise<void>;
  dailyLimit: number;
  usedToday: number;
  remainingToday: number;
  incrementDailyUsage: () => void;
  isShareModalOpen: boolean;
  setIsShareModalOpen: (open: boolean) => void;
  isAiModalOpen: boolean;
  setIsAiModalOpen: (open: boolean) => void;
  syncWorkspaceKeyToCloud: (key: string, value: unknown) => void;
  sharedBuiltinKey: string;
  updateSharedBuiltinKey: (key: string) => Promise<void>;
}

const UserContext = createContext<UserContextValue | null>(null);

const CURRENT_USER_KEY = 'evolutigas_auth_current_user_v1';
const USERS_REGISTRY_KEY = 'evolutigas_auth_users_registry_v1';
const LEGACY_MIGRATED_KEY = 'evolutigas_auth_legacy_migrated_v1';
const DAILY_LIMIT = 20;

export function normalizeUserId(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'colega'
  );
}

function simpleHash(str: string): string {
  let hash = 5381;
  const clean = str.trim();
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 33) ^ clean.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

function getTodayKey(userId: string): string {
  const today = new Date().toISOString().split('T')[0];
  return `u_${userId}_ai_quota_${today}`;
}

function loadLocalRegistry(): Record<string, AppUser> {
  try {
    const raw = localStorage.getItem(USERS_REGISTRY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalRegistry(reg: Record<string, AppUser>) {
  try {
    localStorage.setItem(USERS_REGISTRY_KEY, JSON.stringify(reg));
  } catch {
    // ignore
  }
}

function migrateLegacyDataToFirstUser(userId: string) {
  try {
    const legacyKeys = [
      'evolutigas_enfermaria_patients_v1',
      'evolutigas_ambulatorio_pacientes_v1',
      'evolutigas_custom_form_templates_v1',
      'evolutigas_custom_form_templates_v2',
      'evolutigas_saved_form_presets_v1',
      'evolutigas_saved_form_presets_v2',
      'transcricoes_salvas',
      'transcritor_formatos_salvos',
    ];

    legacyKeys.forEach((key) => {
      const existingLegacy = localStorage.getItem(key) ?? localStorage.getItem(`u_anon_${key}`);
      const scopedKey = `u_${userId}_${key}`;
      if (existingLegacy && !localStorage.getItem(scopedKey)) {
        localStorage.setItem(scopedKey, existingLegacy);
      }
    });

    if (!localStorage.getItem(LEGACY_MIGRATED_KEY)) {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('historico_paciente_') || k.startsWith('rascunho_enfermaria_v1_'))) {
          const val = localStorage.getItem(k);
          const scopedKey = `u_${userId}_${k}`;
          if (val && !localStorage.getItem(scopedKey)) {
            localStorage.setItem(scopedKey, val);
          }
        }
      }
      localStorage.setItem(LEGACY_MIGRATED_KEY, userId);
    }
  } catch (e) {
    console.warn('Failed to migrate legacy data:', e);
  }
}

export function getActiveUserIdFromStorage(): string | null {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppUser;
    return parsed?.id || null;
  } catch {
    return null;
  }
}

export function getActiveAiConnectionsFromStorage(): AiConnectionsState {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) return DEFAULT_AI_CONNECTIONS;
    const parsed = JSON.parse(raw) as AppUser;
    const reg = loadLocalRegistry();
    const regConn = parsed?.id ? reg[parsed.id]?.aiConnections : undefined;
    return mergeAiConnections(regConn, parsed?.aiConnections);
  } catch {
    return DEFAULT_AI_CONNECTIONS;
  }
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    try {
      const raw = localStorage.getItem(CURRENT_USER_KEY);
      if (!raw) return null;
      const user = JSON.parse(raw) as AppUser;
      const reg = loadLocalRegistry();
      return {
        ...user,
        aiConnections: mergeAiConnections(reg[user.id]?.aiConnections, user.aiConnections),
      };
    } catch {
      return null;
    }
  });

  const [knownUsers, setKnownUsers] = useState<AppUser[]>(() => {
    const reg = loadLocalRegistry();
    return Object.values(reg).sort((a, b) => a.name.localeCompare(b.name));
  });

  const [usedToday, setUsedToday] = useState<number>(0);
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [sharedBuiltinKey, setSharedBuiltinKey] = useState<string>(() => getBuiltinGeminiApiKey());

  useEffect(() => {
    if (!currentUser) {
      setUsedToday(0);
      return;
    }
    try {
      const raw = localStorage.getItem(getTodayKey(currentUser.id));
      setUsedToday(raw ? parseInt(raw, 10) || 0 : 0);
    } catch {
      setUsedToday(0);
    }
  }, [currentUser]);

  const incrementDailyUsage = useCallback(() => {
    if (!currentUser) return;
    setUsedToday((prev) => {
      const next = prev + 1;
      try {
        localStorage.setItem(getTodayKey(currentUser.id), String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, [currentUser]);

  // Real-time sync of knownUsers, active user AI keys & shared builtin key from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'formTemplates'),
      (snap) => {
        const reg = loadLocalRegistry();
        let changed = false;
        const activeUid = getActiveUserIdFromStorage();

        snap.forEach((docSnap) => {
          if (docSnap.id === 'system_shared_ai_config') {
            const cfg = docSnap.data() as { geminiKey?: string } | undefined;
            if (cfg && typeof cfg.geminiKey === 'string') {
              const clean = cfg.geminiKey.trim();
              try {
                if (clean) {
                  localStorage.setItem(SHARED_BUILTIN_KEY_STORAGE, clean);
                } else {
                  localStorage.removeItem(SHARED_BUILTIN_KEY_STORAGE);
                }
              } catch {}
              setSharedBuiltinKey(clean || getBuiltinGeminiApiKey());
            }
          } else if (docSnap.id.startsWith('user_profile__')) {
            const data = docSnap.data() as AppUser;
            if (data && data.id && data.name) {
              const localAi = reg[data.id]?.aiConnections;
              const mergedAi = mergeAiConnections(data.aiConnections, localAi);
              reg[data.id] = {
                ...reg[data.id],
                ...data,
                aiConnections: mergedAi,
              };
              changed = true;

              if (activeUid && data.id === activeUid) {
                setCurrentUser((prev) => {
                  if (!prev || prev.id !== activeUid) return prev;
                  const nextAi = mergeAiConnections(data.aiConnections, prev.aiConnections);
                  const nextUser: AppUser = {
                    ...prev,
                    ...data,
                    aiConnections: nextAi,
                  };
                  try {
                    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(nextUser));
                  } catch {}
                  return nextUser;
                });
              }
            }
          }
        });
        if (changed) {
          saveLocalRegistry(reg);
          setKnownUsers(Object.values(reg).sort((a, b) => a.name.localeCompare(b.name)));
        }
      },
      () => {}
    );
    return () => unsubscribe();
  }, []);

  const updateSharedBuiltinKey = useCallback(async (key: string) => {
    const clean = (key || '').trim();
    try {
      if (clean) {
        localStorage.setItem(SHARED_BUILTIN_KEY_STORAGE, clean);
      } else {
        localStorage.removeItem(SHARED_BUILTIN_KEY_STORAGE);
      }
    } catch {}
    setSharedBuiltinKey(clean || getBuiltinGeminiApiKey());
    try {
      await setDoc(
        doc(db, 'formTemplates', 'system_shared_ai_config'),
        {
          geminiKey: clean,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Failed to sync shared AI key to Firestore:', err);
    }
  }, []);

  const syncWorkspaceKeyToCloud = useCallback(
    async (key: string, value: unknown) => {
      if (!currentUser) return;
      try {
        const ts = Date.now();
        const docRef = doc(db, 'formTemplates', `user_workspace__${currentUser.id}`);
        await setDoc(
          docRef,
          {
            ownerId: currentUser.id,
            updatedAt: new Date(ts).toISOString(),
            keys: {
              [key]: JSON.stringify(value),
            },
            keyTimestamps: {
              [key]: ts,
            },
          },
          { merge: true }
        );
      } catch {}
    },
    [currentUser]
  );

  const persistUser = useCallback((user: AppUser) => {
    const normalized: AppUser = {
      ...user,
      aiConnections: normalizeAiConnections(user.aiConnections),
    };
    setCurrentUser(normalized);
    try {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(normalized));
    } catch {}
    const reg = loadLocalRegistry();
    reg[normalized.id] = normalized;
    saveLocalRegistry(reg);
    setKnownUsers(Object.values(reg).sort((a, b) => a.name.localeCompare(b.name)));

    const safeCloudProfile = stripUndefined({
      id: normalized.id,
      name: normalized.name,
      hasPassword: Boolean(normalized.hasPassword),
      ...(normalized.passwordHash ? { passwordHash: normalized.passwordHash } : {}),
      createdAt: normalized.createdAt || new Date().toISOString(),
      aiConnections: normalized.aiConnections,
    });
    setDoc(doc(db, 'formTemplates', `user_profile__${normalized.id}`), safeCloudProfile, {
      merge: true,
    }).catch((err) => {
      console.warn('Failed to persist user profile to Firestore:', err);
    });
  }, []);

  // Automatically sync active user profile & workspace on startup and in real-time across browsers/devices
  useEffect(() => {
    if (!currentUser?.id) return;
    const uid = currentUser.id;

    (async () => {
      try {
        const snap = await getDoc(doc(db, 'formTemplates', `user_profile__${uid}`));
        const cloudData = snap.exists() ? (snap.data() as AppUser) : undefined;
        const mergedAi = mergeAiConnections(cloudData?.aiConnections, currentUser.aiConnections);

        const syncedUser: AppUser = {
          ...currentUser,
          ...(cloudData || {}),
          id: uid,
          name: cloudData?.name || currentUser.name,
          aiConnections: mergedAi,
        };

        setCurrentUser(syncedUser);
        try {
          localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(syncedUser));
        } catch {}
        const reg = loadLocalRegistry();
        reg[uid] = syncedUser;
        saveLocalRegistry(reg);

        const safeCloudProfile = stripUndefined({
          id: syncedUser.id,
          name: syncedUser.name,
          hasPassword: Boolean(syncedUser.hasPassword),
          ...(syncedUser.passwordHash ? { passwordHash: syncedUser.passwordHash } : {}),
          createdAt: syncedUser.createdAt || new Date().toISOString(),
          aiConnections: mergedAi,
        });
        await setDoc(doc(db, 'formTemplates', `user_profile__${uid}`), safeCloudProfile, {
          merge: true,
        });
      } catch {}
    })();

    migrateLegacyDataToFirstUser(uid);
    syncAllLocalWorkspaceWithCloud(uid);
    const unsubWorkspace = subscribeWorkspaceFromCloud(uid);

    return () => {
      unsubWorkspace();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  const loginOrRegister = useCallback(
    async (
      rawName: string,
      rawPassword?: string
    ): Promise<{ ok: boolean; error?: string; isNew?: boolean }> => {
      const trimmedName = rawName.trim();
      if (!trimmedName) {
        return { ok: false, error: 'Digite seu nome ou apelido para entrar.' };
      }

      const userId = normalizeUserId(trimmedName);
      const password = (rawPassword || '').trim();

      setIsLoadingAuth(true);
      try {
        const reg = loadLocalRegistry();
        let existing: AppUser | undefined = reg[userId];

        try {
          const snap = await getDoc(doc(db, 'formTemplates', `user_profile__${userId}`));
          if (snap.exists()) {
            const cloudUser = snap.data() as AppUser;
            if (cloudUser && cloudUser.id) {
              existing = {
                ...existing,
                ...cloudUser,
                aiConnections: mergeAiConnections(
                  cloudUser.aiConnections,
                  existing?.aiConnections
                ),
              };
            }
          }
        } catch {}

        if (existing) {
          if (existing.hasPassword && existing.passwordHash) {
            if (!password) {
              return {
                ok: false,
                error: `A conta de "${existing.name}" possui senha. Digite sua senha para entrar.`,
              };
            }
            if (simpleHash(password) !== existing.passwordHash) {
              return {
                ok: false,
                error: 'Senha incorreta para esta conta. Tente novamente.',
              };
            }
          } else if (password) {
            existing.hasPassword = true;
            existing.passwordHash = simpleHash(password);
          }

          const updatedUser: AppUser = {
            ...existing,
            aiConnections: normalizeAiConnections(existing.aiConnections),
          };

          migrateLegacyDataToFirstUser(userId);
          persistUser(updatedUser);
          await syncAllLocalWorkspaceWithCloud(userId);
          window.dispatchEvent(new Event('evolutigas-user-changed'));
          return { ok: true, isNew: false };
        }

        const newUser: AppUser = {
          id: userId,
          name: trimmedName,
          hasPassword: Boolean(password),
          ...(password ? { passwordHash: simpleHash(password) } : {}),
          createdAt: new Date().toISOString(),
          aiConnections: { ...DEFAULT_AI_CONNECTIONS },
        };

        migrateLegacyDataToFirstUser(userId);
        persistUser(newUser);
        await syncAllLocalWorkspaceWithCloud(userId);
        window.dispatchEvent(new Event('evolutigas-user-changed'));
        return { ok: true, isNew: true };
      } finally {
        setIsLoadingAuth(false);
      }
    },
    [persistUser]
  );


  const logout = useCallback(() => {
    setCurrentUser(null);
    try {
      localStorage.removeItem(CURRENT_USER_KEY);
    } catch {}
    window.dispatchEvent(new Event('evolutigas-user-changed'));
  }, []);

  const updateAiConnections = useCallback(
    async (patch: Partial<AiConnectionsState>) => {
      if (!currentUser) return;
      const next: AppUser = {
        ...currentUser,
        aiConnections: {
          ...DEFAULT_AI_CONNECTIONS,
          ...(currentUser.aiConnections || {}),
          ...patch,
          updatedAt: Date.now(),
        },
      };
      persistUser(next);
    },
    [currentUser, persistUser]
  );

  const remainingToday = Math.max(0, DAILY_LIMIT - usedToday);

  return (
    <UserContext.Provider
      value={{
        currentUser,
        knownUsers,
        isLoadingAuth,
        loginOrRegister,
        logout,
        updateAiConnections,
        dailyLimit: DAILY_LIMIT,
        usedToday,
        remainingToday,
        incrementDailyUsage,
        isShareModalOpen,
        setIsShareModalOpen,
        isAiModalOpen,
        setIsAiModalOpen,
        syncWorkspaceKeyToCloud,
        sharedBuiltinKey,
        updateSharedBuiltinKey,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return ctx;
}
