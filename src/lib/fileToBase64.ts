/**
 * Optimizes an image File by resizing large dimensions (max 1400px)
 * and compressing to JPEG quality 0.78.
 * Immediately frees the <canvas> backing memory after encoding so iOS Safari
 * never hits its 224MB canvas memory limit when processing multiple photos.
 */
async function compressImageFile(file: File, maxDim = 1200, quality = 0.72): Promise<{ mimeType: string; data: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let canvas: HTMLCanvasElement | null = null;
      try {
        let { width, height } = img;
        if (!width || !height) {
          throw new Error('Invalid image dimensions');
        }
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.max(1, Math.round((height * maxDim) / width));
            width = maxDim;
          } else {
            width = Math.max(1, Math.round((width * maxDim) / height));
            height = maxDim;
          }
        }

        canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Canvas 2D context not available');
        }

        // Draw white background for transparency safety
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        // Free iOS Safari canvas memory immediately
        canvas.width = 0;
        canvas.height = 0;
        canvas = null;

        const base64 = (dataUrl.split(',')[1] || '').replace(/\s+/g, '');
        if (!base64 || base64.length < 50) {
          throw new Error('Canvas produced empty output');
        }
        resolve({ mimeType: 'image/jpeg', data: base64 });
      } catch (err) {
        if (canvas) {
          canvas.width = 0;
          canvas.height = 0;
        }
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for compression'));
    };
    img.src = url;
  });
}

function readRawFileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const raw = result.includes(',') ? result.split(',')[1] : result;
      resolve(raw.replace(/\s+/g, ''));
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Reads a File into base64 data.
 * Automatically compresses images to keep payloads lightweight and fast.
 */
export async function fileToBase64(file: File): Promise<string> {
  const mime = getFileMimeType(file);
  if (mime.startsWith('image/')) {
    try {
      const compressed = await compressImageFile(file);
      return compressed.data;
    } catch {
      // Fallback to standard FileReader if canvas compression fails
    }
  }
  return readRawFileBase64(file);
}

/**
 * Prepares file object with resolved mimeType and compressed base64 data.
 */
export async function prepareFileInlineData(file: File): Promise<{ mimeType: string; data: string }> {
  const mime = getFileMimeType(file);
  if (mime.startsWith('image/')) {
    try {
      return await compressImageFile(file);
    } catch {
      // Fallback to raw FileReader
    }
  }
  const data = await readRawFileBase64(file);
  const safeMime = mime === 'image/heic' || mime === 'image/heif' ? 'image/jpeg' : mime;
  return { mimeType: safeMime, data };
}

/**
 * Processes an array of files ONE BY ONE sequentially so mobile browsers (especially iOS Safari)
 * never exceed Canvas RAM limits when a user selects 10+ photos at once.
 */
export async function prepareFilesSequentially(
  files: File[],
  onProgress?: (current: number, total: number) => void
): Promise<Array<{ mimeType: string; data: string }>> {
  const results: Array<{ mimeType: string; data: string }> = [];
  for (let i = 0; i < files.length; i++) {
    onProgress?.(i + 1, files.length);
    const prepared = await prepareFileInlineData(files[i]);
    if (prepared && prepared.data && prepared.data.length > 16) {
      results.push(prepared);
    }
  }
  return results;
}

export function getFileMimeType(file: File): string {
  if (file.type && file.type.trim()) {
    return file.type.trim();
  }
  const ext = file.name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
    case 'heic':
    case 'heif':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'bmp':
      return 'image/bmp';
    default:
      return 'image/jpeg';
  }
}

export function dataUrlToBase64(dataUrl: string): string {
  const raw = dataUrl.split(',')[1] ?? dataUrl;
  return raw.replace(/\s+/g, '');
}



