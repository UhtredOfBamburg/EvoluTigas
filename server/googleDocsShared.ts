export type PublicGoogleDocResult =
  | {
      ok: true;
      data: {
        documentId: string;
        title: string;
        text: string;
        url: string;
      };
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

export async function fetchPublicGoogleDoc(docIdOrUrl: unknown): Promise<PublicGoogleDocResult> {
  try {
    const rawInput = String(docIdOrUrl ?? '').trim();
    const match =
      rawInput.match(/\/document\/d\/([a-zA-Z0-9-_]+)/) ||
      rawInput.match(/[?&]id=([a-zA-Z0-9-_]+)/);
    const docId = match?.[1] || (/^[a-zA-Z0-9-_]{15,}$/.test(rawInput) ? rawInput : null);

    if (!docId) {
      return {
        ok: false,
        status: 400,
        error: 'Link do Google Docs inválido. Cole o link completo (docs.google.com/document/d/...).',
      };
    }

    const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
    const response = await fetch(exportUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Evolutigas/1.0)',
      },
      redirect: 'follow',
    });

    const finalUrl = response.url || '';
    if (
      !response.ok ||
      finalUrl.includes('accounts.google.com') ||
      finalUrl.includes('ServiceLogin')
    ) {
      return {
        ok: false,
        status: 403,
        error:
          'Este documento está privado. No Google Docs, clique em "Compartilhar" -> "Qualquer pessoa com o link" (Leitor) e tente novamente.',
      };
    }

    const rawText = await response.text();
    if (rawText.trim().startsWith('<!DOCTYPE html') || rawText.trim().startsWith('<html')) {
      return {
        ok: false,
        status: 403,
        error:
          'Este documento está restrito. No Google Docs, clique em "Compartilhar" e mude o acesso geral para "Qualquer pessoa com o link".',
      };
    }

    let title = 'Documento do Paciente';
    const disposition = response.headers.get('content-disposition') || '';
    const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    const asciiMatch = disposition.match(/filename="([^"]+)"/i);
    if (utf8Match?.[1]) {
      try {
        title = decodeURIComponent(utf8Match[1]).replace(/\.txt$/i, '');
      } catch {
        title = utf8Match[1].replace(/\.txt$/i, '');
      }
    } else if (asciiMatch?.[1]) {
      title = asciiMatch[1].replace(/\.txt$/i, '');
    }

    const cleanText = rawText
      .replace(/^\uFEFF/, '')
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return {
      ok: true,
      data: {
        documentId: docId,
        title,
        text: cleanText,
        url: `https://docs.google.com/document/d/${docId}/edit`,
      },
    };
  } catch (err) {
    console.error('Error fetching public Google Doc:', err);
    return {
      ok: false,
      status: 500,
      error: 'Erro ao acessar o link do Google Docs. Verifique se o link está correto.',
    };
  }
}
