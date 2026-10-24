import { useCallback, useEffect, useState } from 'react';
import { getActiveUserIdFromStorage } from '@/contexts/UserContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';

const firestoreDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function resolveScopedStorageKey(rawKey: string, userId?: string | null): string {
  if (rawKey.startsWith('evolutigas_auth_') || rawKey.startsWith('evolutigas_global_')) {
    return rawKey;
  }
  const resolvedUid = userId !== undefined ? userId : getActiveUserIdFromStorage();
  const activeId = resolvedUid || 'anon';
  return `u_${activeId}_${rawKey}`;
}

function resolveMetaTimestampKey(rawKey: string, userId: string): string {
  return `u_${userId}__meta_ts__${rawKey}`;
}

export function getLocalKeyTimestamp(rawKey: string, userId: string): number {
  try {
    const raw = window.localStorage.getItem(resolveMetaTimestampKey(rawKey, userId));
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

function setLocalKeyTimestamp(rawKey: string, userId: string, ts: number): void {
  try {
    window.localStorage.setItem(resolveMetaTimestampKey(rawKey, userId), String(ts));
  } catch {
    // ignore
  }
}

export function readScopedLocalStorage<T>(rawKey: string, fallbackValue: T): T {
  if (typeof window === 'undefined') return fallbackValue;
  try {
    const scoped = resolveScopedStorageKey(rawKey);
    const raw = window.localStorage.getItem(scoped);
    if (raw !== null) {
      return JSON.parse(raw) as T;
    }
    const legacyRaw = window.localStorage.getItem(rawKey);
    return legacyRaw !== null ? (JSON.parse(legacyRaw) as T) : fallbackValue;
  } catch {
    return fallbackValue;
  }
}

export function writeScopedLocalStorage<T>(rawKey: string, value: T, syncFirestore = true): void {
  if (typeof window === 'undefined') return;
  try {
    const currentUid = getActiveUserIdFromStorage();
    const targetKey = resolveScopedStorageKey(rawKey, currentUid);
    const serialized = JSON.stringify(value);
    const prevRaw = window.localStorage.getItem(targetKey);

    window.localStorage.setItem(targetKey, serialized);

    const nowMs = Date.now();
    if (currentUid && prevRaw !== serialized) {
      setLocalKeyTimestamp(rawKey, currentUid, nowMs);
    }

    window.dispatchEvent(
      new CustomEvent('evolutigas-storage-sync', {
        detail: { rawKey, targetKey },
      })
    );

    if (syncFirestore && currentUid && !rawKey.startsWith('evolutigas_auth_')) {
      const timerId = `${currentUid}::${rawKey}`;
      const existing = firestoreDebounceTimers.get(timerId);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        firestoreDebounceTimers.delete(timerId);
        const ts = getLocalKeyTimestamp(rawKey, currentUid) || Date.now();
        setDoc(
          doc(db, 'formTemplates', `user_workspace__${currentUid}`),
          {
            ownerId: currentUid,
            updatedAt: new Date(ts).toISOString(),
            keys: {
              [rawKey]: serialized,
            },
            keyTimestamps: {
              [rawKey]: ts,
            },
          },
          { merge: true }
        ).catch((err) => {
          console.warn('Firestore workspace sync error:', err);
        });
      }, 350);

      firestoreDebounceTimers.set(timerId, timer);
    }
  } catch (err) {
    console.warn(`useLocalStorage: failed to write key "${rawKey}"`, err);
  }
}

/**
 * Bidirectional sync between local browser storage and Firestore workspace document.
 * - Pulls any newer or missing keys from Firestore into localStorage.
 * - Pushes any local keys that are missing or newer in localStorage up to Firestore.
 */
export async function syncAllLocalWorkspaceWithCloud(userId: string): Promise<void> {
  if (typeof window === 'undefined' || !userId) return;
  try {
    const docRef = doc(db, 'formTemplates', `user_workspace__${userId}`);
    const snap = await getDoc(docRef);
    const cloudData = snap.exists() ? snap.data() : null;
    const cloudKeys: Record<string, string> =
      cloudData && cloudData.keys && typeof cloudData.keys === 'object' ? cloudData.keys : {};
    const cloudTimestamps: Record<string, number> =
      cloudData && cloudData.keyTimestamps && typeof cloudData.keyTimestamps === 'object'
        ? cloudData.keyTimestamps
        : {};

    let updatedLocal = false;

    // 1. Pull from cloud to localStorage when cloud has keys missing locally or newer than local
    Object.entries(cloudKeys).forEach(([rawKey, cloudVal]) => {
      if (typeof cloudVal !== 'string') return;
      const scopedKey = `u_${userId}_${rawKey}`;
      const localVal = window.localStorage.getItem(scopedKey);
      const localTs = getLocalKeyTimestamp(rawKey, userId);
      const cloudTs = Number(cloudTimestamps[rawKey]) || 1;

      if (localVal === null || (cloudTs >= localTs && localVal !== cloudVal)) {
        window.localStorage.setItem(scopedKey, cloudVal);
        setLocalKeyTimestamp(rawKey, userId, cloudTs);
        updatedLocal = true;
        window.dispatchEvent(
          new CustomEvent('evolutigas-storage-sync', {
            detail: { rawKey, targetKey: scopedKey },
          })
        );
      }
    });

    if (updatedLocal) {
      window.dispatchEvent(new Event('evolutigas-user-changed'));
    }

    // 2. Push any local keys for this user that are missing in cloud or newer locally
    const prefix = `u_${userId}_`;
    const keysToPush: Record<string, string> = {};
    const tsToPush: Record<string, number> = {};

    for (let i = 0; i < window.localStorage.length; i++) {
      const fullKey = window.localStorage.key(i);
      if (!fullKey || !fullKey.startsWith(prefix)) continue;
      if (fullKey.startsWith(`u_${userId}__meta_ts__`)) continue;

      const rawKey = fullKey.slice(prefix.length);
      if (
        !rawKey ||
        rawKey.startsWith('ai_quota_') ||
        rawKey.startsWith('evolutigas_custom_form_templates_')
      ) {
        continue;
      }

      const localVal = window.localStorage.getItem(fullKey);
      if (localVal === null) continue;

      const localTs = getLocalKeyTimestamp(rawKey, userId);
      const cloudVal = cloudKeys[rawKey];
      const cloudTs = Number(cloudTimestamps[rawKey]) || 0;

      if (cloudVal === undefined || (localTs > cloudTs && localVal !== cloudVal)) {
        const effectiveTs = localTs || Date.now();
        setLocalKeyTimestamp(rawKey, userId, effectiveTs);
        keysToPush[rawKey] = localVal;
        tsToPush[rawKey] = effectiveTs;
      }
    }

    if (Object.keys(keysToPush).length > 0) {
      await setDoc(
        docRef,
        {
          ownerId: userId,
          updatedAt: new Date().toISOString(),
          keys: keysToPush,
          keyTimestamps: tsToPush,
        },
        { merge: true }
      );
    }
  } catch (err) {
    console.warn('Failed to sync workspace with cloud:', err);
  }
}

/**
 * Real-time subscription to the user's cloud workspace document so changes made in
 * Chrome immediately appear in Safari, mobile, or the preview window.
 */
export function subscribeWorkspaceFromCloud(userId: string): () => void {
  if (typeof window === 'undefined' || !userId) return () => {};
  const docRef = doc(db, 'formTemplates', `user_workspace__${userId}`);

  return onSnapshot(
    docRef,
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (!data || !data.keys || typeof data.keys !== 'object') return;

      const cloudKeys = data.keys as Record<string, string>;
      const cloudTimestamps = (data.keyTimestamps || {}) as Record<string, number>;

      Object.entries(cloudKeys).forEach(([rawKey, cloudVal]) => {
        if (typeof cloudVal !== 'string') return;
        const scopedKey = `u_${userId}_${rawKey}`;
        const localVal = window.localStorage.getItem(scopedKey);
        const localTs = getLocalKeyTimestamp(rawKey, userId);
        const cloudTs = Number(cloudTimestamps[rawKey]) || 1;

        if (localVal !== cloudVal && (localVal === null || cloudTs >= localTs)) {
          window.localStorage.setItem(scopedKey, cloudVal);
          setLocalKeyTimestamp(rawKey, userId, cloudTs);
          window.dispatchEvent(
            new CustomEvent('evolutigas-storage-sync', {
              detail: { rawKey, targetKey: scopedKey },
            })
          );
        }
      });
    },
    () => {
      // Ignore offline snapshot errors
    }
  );
}

/**
 * Drop-in replacement for reading/writing JSON in localStorage,
 * automatically isolated 100% per logged-in classmate and synced to Firestore with debounce.
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [activeUserId, setActiveUserId] = useState<string | null>(() => getActiveUserIdFromStorage());
  const scopedKey = resolveScopedStorageKey(key, activeUserId);

  const readValue = useCallback((): T => {
    return readScopedLocalStorage<T>(key, initialValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, activeUserId]);

  const [value, setValue] = useState<T>(readValue);

  // Re-read when the key or the logged-in classmate changes
  useEffect(() => {
    setValue(readValue());
  }, [scopedKey, readValue]);

  useEffect(() => {
    const handleUserChange = () => {
      const nextUid = getActiveUserIdFromStorage();
      setActiveUserId(nextUid);
      setValue(readScopedLocalStorage<T>(key, initialValue));
    };

    const handleSameTabSync = (e: Event) => {
      const custom = e as CustomEvent<{ rawKey?: string }>;
      if (custom.detail?.rawKey === key) {
        setValue(readScopedLocalStorage<T>(key, initialValue));
      }
    };

    window.addEventListener('evolutigas-user-changed', handleUserChange);
    window.addEventListener('evolutigas-storage-sync', handleSameTabSync);
    return () => {
      window.removeEventListener('evolutigas-user-changed', handleUserChange);
      window.removeEventListener('evolutigas-storage-sync', handleSameTabSync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setStoredValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = next instanceof Function ? next(prev) : next;
        writeScopedLocalStorage(key, resolved, true);
        return resolved;
      });
    },
    [key]
  );

  return [value, setStoredValue] as const;
}

