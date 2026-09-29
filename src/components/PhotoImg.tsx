import React, { useEffect, useState } from 'react';
import { isLocalPhotoRef, resolvePhotoUrl } from '../services/photoStore';

type PhotoImgProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src?: string | null };

/**
 * <img> para fotos de ensaio: aceita endereço normal, data URL ou a
 * referência local "jvm-foto:<id>" (a imagem é lida do aparelho só agora).
 */
export const PhotoImg: React.FC<PhotoImgProps> = ({ src, alt = '', ...rest }) => {
  const [resolved, setResolved] = useState<string>(() => (src && !isLocalPhotoRef(src) ? src : ''));

  useEffect(() => {
    let cancelled = false;
    if (!src) {
      setResolved('');
    } else if (!isLocalPhotoRef(src)) {
      setResolved(src);
    } else {
      resolvePhotoUrl(src).then(url => { if (!cancelled) setResolved(url); });
    }
    return () => { cancelled = true; };
  }, [src]);

  if (!resolved) {
    return <span className={rest.className} role="img" aria-label={alt || 'Foto indisponível neste aparelho'} />;
  }
  return <img src={resolved} alt={alt} {...rest} />;
};
