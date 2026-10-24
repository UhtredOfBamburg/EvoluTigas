import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { app } from './firebase';

const auth = getAuth(app);

export const SCOPES = [
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive.readonly',
];

function createGoogleProvider() {
  const provider = new GoogleAuthProvider();
  SCOPES.forEach((scope) => provider.addScope(scope));
  // Always let each user choose their own Google account
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// Cache the access token and connected user strictly in memory.
let cachedAccessToken: string | null = null;
let cachedGoogleUser: { email: string | null; displayName: string | null; photoURL: string | null } | null = null;

export interface GoogleDocFileSummary {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface GoogleDocExtracted {
  documentId: string;
  title: string;
  text: string;
  url: string;
}

export const initGoogleDocsAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      cachedGoogleUser = {
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
      };
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      cachedGoogleUser = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleDocsSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const provider = createGoogleProvider();
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Não foi possível obter o token de acesso do Google.');
    }
    cachedAccessToken = credential.accessToken;
    cachedGoogleUser = {
      email: result.user.email,
      displayName: result.user.displayName,
      photoURL: result.user.photoURL,
    };
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Google Docs sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getGoogleAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const getConnectedGoogleUser = () => {
  return cachedGoogleUser;
};

export const googleDocsLogout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  cachedGoogleUser = null;
};

/**
 * Extracts a Google Docs documentId from either a full URL or a raw ID string.
 */
export function extractDocIdFromUrlOrId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }

  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9-_]+)/);
  if (idParamMatch && idParamMatch[1]) {
    return idParamMatch[1];
  }

  if (/^[a-zA-Z0-9-_]{15,}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Recursively converts Google Docs StructuralElements (paragraphs, tables, lists) into clean plain text.
 */
function extractTextFromStructuralElements(elements: any[] | undefined): string {
  if (!Array.isArray(elements)) return '';
  const chunks: string[] = [];

  for (const el of elements) {
    if (el.paragraph && Array.isArray(el.paragraph.elements)) {
      const isBullet = Boolean(el.paragraph.bullet);
      const lineParts: string[] = [];
      for (const pEl of el.paragraph.elements) {
        if (pEl.textRun && typeof pEl.textRun.content === 'string') {
          lineParts.push(pEl.textRun.content);
        }
      }
      const line = lineParts.join('');
      if (isBullet && line.trim()) {
        chunks.push(`- ${line}`);
      } else {
        chunks.push(line);
      }
    } else if (el.table && Array.isArray(el.table.tableRows)) {
      for (const row of el.table.tableRows) {
        if (!Array.isArray(row.tableCells)) continue;
        const cellTexts = row.tableCells.map((cell: any) =>
          extractTextFromStructuralElements(cell.content).trim().replace(/\n+/g, ' ')
        );
        chunks.push(cellTexts.join(' | ') + '\n');
      }
    } else if (el.tableOfContents && Array.isArray(el.tableOfContents.content)) {
      chunks.push(extractTextFromStructuralElements(el.tableOfContents.content));
    }
  }

  return chunks.join('');
}

/**
 * Lists recent Google Docs files from the connected user's Google Drive, optionally filtered by query text.
 */
export async function searchGoogleDocsFiles(queryText?: string): Promise<GoogleDocFileSummary[]> {
  const token = getGoogleAccessToken();
  if (!token) {
    throw new Error('AUTH_REQUIRED');
  }

  const sanitized = (queryText || '').trim().replace(/'/g, "\\'");
  let q = "mimeType='application/vnd.google-apps.document' and trashed=false";
  if (sanitized) {
    q += ` and name contains '${sanitized}'`;
  }

  const params = new URLSearchParams({
    q,
    pageSize: '25',
    orderBy: 'modifiedTime desc',
    fields: 'files(id,name,modifiedTime,webViewLink)',
  });

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401 || res.status === 403) {
    cachedAccessToken = null;
    throw new Error('AUTH_REQUIRED');
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Erro ao listar documentos do Google Drive: ${errText}`);
  }

  const data = await res.json();
  return Array.isArray(data.files) ? data.files : [];
}

/**
 * Fetches a Google Doc by ID or URL using the authenticated user's token (with fallback to public link proxy).
 */
export async function fetchGoogleDocContent(docIdOrUrl: string): Promise<GoogleDocExtracted> {
  const docId = extractDocIdFromUrlOrId(docIdOrUrl);
  if (!docId) {
    throw new Error('Link ou ID do Google Docs inválido.');
  }

  const token = getGoogleAccessToken();

  if (token) {
    const res = await fetch(`https://docs.googleapis.com/v1/documents/${docId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      const docData = await res.json();
      const rawText = extractTextFromStructuralElements(docData?.body?.content);
      const cleanText = rawText.replace(/\n{3,}/g, '\n\n').trim();
      const title = docData?.title || 'Documento sem título';

      return {
        documentId: docId,
        title,
        text: cleanText,
        url: `https://docs.google.com/document/d/${docId}/edit`,
      };
    }

    if (res.status === 401) {
      cachedAccessToken = null;
      throw new Error('AUTH_REQUIRED');
    }
  }

  // Fallback for shared links
  const proxyRes = await fetch('/api/google-doc-public', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ docIdOrUrl: docId }),
  });

  const payload = await proxyRes.json().catch(() => ({}));
  if (!proxyRes.ok) {
    throw new Error(
      payload?.error ||
        'Não foi possível abrir este Google Doc. Verifique se você está conectado com a conta Google que tem acesso ao arquivo.'
    );
  }

  return {
    documentId: payload.documentId || docId,
    title: payload.title || 'Documento do Paciente',
    text: payload.text || '',
    url: payload.url || `https://docs.google.com/document/d/${docId}/edit`,
  };
}

/**
 * Creates a brand-new Google Doc in the connected user's account and inserts the provided clinical text.
 */
export async function createGoogleDocWithContent(
  title: string,
  content: string
): Promise<{ documentId: string; title: string; url: string }> {
  const token = getGoogleAccessToken();
  if (!token) {
    throw new Error('AUTH_REQUIRED');
  }

  const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  });

  if (createRes.status === 401 || createRes.status === 403) {
    cachedAccessToken = null;
    throw new Error('AUTH_REQUIRED');
  }

  if (!createRes.ok) {
    throw new Error('Erro ao criar novo documento no Google Docs.');
  }

  const created = await createRes.json();
  const documentId = created.documentId as string;

  if (content.trim()) {
    const updateRes = await fetch(
      `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: content,
              },
            },
          ],
        }),
      }
    );

    if (!updateRes.ok) {
      throw new Error('Documento criado, mas houve erro ao inserir o texto.');
    }
  }

  return {
    documentId,
    title: created.title || title,
    url: `https://docs.google.com/document/d/${documentId}/edit`,
  };
}

/**
 * Appends a new clinical note/evolution at the end of an existing Google Doc.
 */
export async function appendTextToGoogleDoc(
  documentId: string,
  contentToAppend: string
): Promise<{ documentId: string; title: string; url: string }> {
  const token = getGoogleAccessToken();
  if (!token) {
    throw new Error('AUTH_REQUIRED');
  }

  const getRes = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (getRes.status === 401 || getRes.status === 403) {
    cachedAccessToken = null;
    throw new Error('AUTH_REQUIRED');
  }

  if (!getRes.ok) {
    throw new Error('Não foi possível acessar o Google Doc para atualização.');
  }

  const docData = await getRes.json();
  const bodyContent = docData?.body?.content;
  const lastElement = Array.isArray(bodyContent) && bodyContent.length > 0
    ? bodyContent[bodyContent.length - 1]
    : null;
  const insertIndex = Math.max(1, (lastElement?.endIndex || 2) - 1);

  const separator = insertIndex > 1 ? '\n\n────────────────────────────────────────\n\n' : '';
  const textPayload = `${separator}${contentToAppend.trim()}\n`;

  const updateRes = await fetch(
    `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              location: { index: insertIndex },
              text: textPayload,
            },
          },
        ],
      }),
    }
  );

  if (!updateRes.ok) {
    throw new Error('Erro ao anexar evolução no Google Doc.');
  }

  return {
    documentId,
    title: docData?.title || 'Documento do Paciente',
    url: `https://docs.google.com/document/d/${documentId}/edit`,
  };
}
