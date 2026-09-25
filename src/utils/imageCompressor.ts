/**
 * Client-side image compression utility to ensure images fit comfortably
 * within localStorage, Supabase rows/Storage and React state memory.
 */

export function fileToDataUrl(file: File | Blob | string): Promise<string> {
  if (typeof file === 'string') {
    return Promise.resolve(file);
  }
  return new Promise((resolve) => {
    try {
      if (!file) {
        resolve('');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string' && reader.result.length > 0) {
          resolve(reader.result);
        } else {
          resolve('');
        }
      };
      reader.onerror = () => {
        console.warn('[fileToDataUrl] FileReader error:', reader.error);
        resolve('');
      };
      reader.readAsDataURL(file);
    } catch (e) {
      console.warn('[fileToDataUrl] Exception reading file:', e);
      resolve('');
    }
  });
}

export async function compressImage(
  dataUrlOrFile: string | File | Blob,
  maxWidth = 1280,
  maxHeight = 960,
  quality = 0.75
): Promise<string> {
  // Step 1: Ensure we have a data URL string
  let originalDataUrl = '';
  if (typeof dataUrlOrFile === 'string') {
    originalDataUrl = dataUrlOrFile;
  } else if (dataUrlOrFile && typeof dataUrlOrFile === 'object') {
    originalDataUrl = await fileToDataUrl(dataUrlOrFile as Blob);
  }

  if (!originalDataUrl) {
    return '';
  }

  // Step 2: Try canvas compression
  return new Promise((resolve) => {
    try {
      const img = new Image();
      if (originalDataUrl.startsWith('http://') || originalDataUrl.startsWith('https://')) {
        img.crossOrigin = 'anonymous';
      }

      img.onload = () => {
        try {
          let { width, height } = img;
          if (!width || !height || width <= 0 || height <= 0) {
            resolve(originalDataUrl);
            return;
          }

          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.max(1, Math.round(width * ratio));
            height = Math.max(1, Math.round(height * ratio));
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(originalDataUrl);
            return;
          }

          // Fill white background in case of transparent PNGs
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);

          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', quality);
          if (compressed && compressed.length > 50) {
            resolve(compressed);
          } else {
            resolve(originalDataUrl);
          }
        } catch (e) {
          console.warn('[compressImage] Canvas compression fallback:', e);
          resolve(originalDataUrl);
        }
      };

      img.onerror = (err) => {
        console.warn('[compressImage] Image loading error, using original fallback:', err);
        resolve(originalDataUrl);
      };

      img.src = originalDataUrl;
    } catch (e) {
      console.warn('[compressImage] Unexpected error during compression:', e);
      resolve(originalDataUrl);
    }
  });
}


