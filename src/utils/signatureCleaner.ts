/**
 * Utilitário para limpeza e tratamento automático de assinaturas digitais.
 * - Remove bordas, molduras e retângulos de caixas de assinatura (como caixas de formulários/scans)
 * - Torna o fundo branco/acinzentado 100% transparente
 * - Realça o traço da tinta (caneta azul/preta)
 * - Recorta automaticamente apenas a área útil da assinatura (sem margens vazias)
 */
export async function cleanSignatureImage(sourceUrlOrData: string): Promise<string> {
  if (!sourceUrlOrData) return '';
  if (typeof window === 'undefined') return sourceUrlOrData;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const origW = img.naturalWidth || img.width || 400;
        const origH = img.naturalHeight || img.height || 150;

        if (origW === 0 || origH === 0) {
          resolve(sourceUrlOrData);
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = origW;
        canvas.height = origH;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(sourceUrlOrData);
          return;
        }

        ctx.drawImage(img, 0, 0, origW, origH);
        const imgData = ctx.getImageData(0, 0, origW, origH);
        const data = imgData.data;

        // 1. Detectar e tornar transparente qualquer pixel de fundo (branco, cinza claro, off-white)
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          if (a < 10) continue;

          // Luminosidade percebida
          const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

          // Fundo claro -> transparente
          if (brightness > 205 || (r > 195 && g > 195 && b > 195)) {
            data[i + 3] = 0;
          } else if (brightness > 165) {
            // Suavização anti-aliasing nas bordas do traço
            const factor = (205 - brightness) / 40; // 0 a 1
            data[i + 3] = Math.round(a * Math.max(0, Math.min(1, factor)));
          }
        }

        // 2. Detecção e remoção de bordas/caixas retangulares de moldura
        // Verifica linhas horizontais nas extremidades (top 20% e bottom 20%) que tenham densidade de traço contínuo
        const isPixelDark = (x: number, y: number): boolean => {
          if (x < 0 || x >= origW || y < 0 || y >= origH) return false;
          const idx = (y * origW + x) * 4;
          return data[idx + 3] > 40;
        };

        const clearPixel = (x: number, y: number) => {
          if (x < 0 || x >= origW || y < 0 || y >= origH) return;
          const idx = (y * origW + x) * 4;
          data[idx + 3] = 0;
        };

        // Procurar linhas horizontais de borda no topo e base (até 25% da altura)
        const topLimit = Math.floor(origH * 0.25);
        const bottomStart = Math.floor(origH * 0.75);

        for (let y = 0; y < topLimit; y++) {
          let darkCount = 0;
          for (let x = 0; x < origW; x++) {
            if (isPixelDark(x, y)) darkCount++;
          }
          // Se mais de 35% da linha for preenchida perto da borda superior, é uma linha de moldura
          if (darkCount > origW * 0.35) {
            for (let dy = Math.max(0, y - 2); dy <= Math.min(origH - 1, y + 2); dy++) {
              for (let x = 0; x < origW; x++) clearPixel(x, dy);
            }
          }
        }

        for (let y = bottomStart; y < origH; y++) {
          let darkCount = 0;
          for (let x = 0; x < origW; x++) {
            if (isPixelDark(x, y)) darkCount++;
          }
          // Se mais de 35% da linha for preenchida perto da borda inferior, é uma linha de moldura
          if (darkCount > origW * 0.35) {
            for (let dy = Math.max(0, y - 2); dy <= Math.min(origH - 1, y + 2); dy++) {
              for (let x = 0; x < origW; x++) clearPixel(x, dy);
            }
          }
        }

        // Procurar linhas verticais de borda na esquerda e direita (até 25% da largura)
        const leftLimit = Math.floor(origW * 0.25);
        const rightStart = Math.floor(origW * 0.75);

        for (let x = 0; x < leftLimit; x++) {
          let darkCount = 0;
          for (let y = 0; y < origH; y++) {
            if (isPixelDark(x, y)) darkCount++;
          }
          if (darkCount > origH * 0.35) {
            for (let dx = Math.max(0, x - 2); dx <= Math.min(origW - 1, x + 2); dx++) {
              for (let y = 0; y < origH; y++) clearPixel(dx, y);
            }
          }
        }

        for (let x = rightStart; x < origW; x++) {
          let darkCount = 0;
          for (let y = 0; y < origH; y++) {
            if (isPixelDark(x, y)) darkCount++;
          }
          if (darkCount > origH * 0.35) {
            for (let dx = Math.max(0, x - 2); dx <= Math.min(origW - 1, x + 2); dx++) {
              for (let y = 0; y < origH; y++) clearPixel(dx, y);
            }
          }
        }

        // Limpar pixels isolados nas margens externas (1 a 3px da borda)
        for (let y = 0; y < origH; y++) {
          for (let x = 0; x < Math.min(4, origW); x++) clearPixel(x, y);
          for (let x = Math.max(0, origW - 4); x < origW; x++) clearPixel(x, y);
        }
        for (let x = 0; x < origW; x++) {
          for (let y = 0; y < Math.min(4, origH); y++) clearPixel(x, y);
          for (let y = Math.max(0, origH - 4); y < origH; y++) clearPixel(x, y);
        }

        ctx.putImageData(imgData, 0, 0);

        // 3. Encontrar Bounding Box exata da tinta
        let minX = origW;
        let minY = origH;
        let maxX = 0;
        let maxY = 0;
        let hasInk = false;

        for (let y = 0; y < origH; y++) {
          for (let x = 0; x < origW; x++) {
            const a = data[(y * origW + x) * 4 + 3];
            if (a > 30) {
              hasInk = true;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        if (!hasInk || minX > maxX || minY > maxY) {
          resolve(sourceUrlOrData);
          return;
        }

        // Adicionar pequeno padding de 4px
        const pad = 4;
        const cropX = Math.max(0, minX - pad);
        const cropY = Math.max(0, minY - pad);
        const cropW = Math.min(origW - cropX, maxX - minX + pad * 2);
        const cropH = Math.min(origH - cropY, maxY - minY + pad * 2);

        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = cropW;
        cropCanvas.height = cropH;
        const cropCtx = cropCanvas.getContext('2d');
        if (!cropCtx) {
          resolve(canvas.toDataURL('image/png'));
          return;
        }

        cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        resolve(cropCanvas.toDataURL('image/png'));
      } catch (err) {
        console.warn('Erro ao limpar assinatura:', err);
        resolve(sourceUrlOrData);
      }
    };

    img.onerror = () => {
      resolve(sourceUrlOrData);
    };

    img.src = sourceUrlOrData;
  });
}
