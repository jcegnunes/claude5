/**
 * Date and text formatting utilities with standard N/C (Não Consta) fallback for blank fields
 */

export function nc(value: any, fallback: string = 'N/C'): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (
      trimmed === '' || 
      trimmed === 'N/A' || 
      trimmed === 'N/D' || 
      trimmed === '-' || 
      trimmed === '--' ||
      trimmed.toLowerCase() === 'não especificado' || 
      trimmed.toLowerCase() === 'não informado' ||
      trimmed.toLowerCase() === 'não consta' ||
      trimmed.toLowerCase() === 'n/a' ||
      trimmed.toLowerCase() === 'n/d'
    ) {
      return fallback;
    }
    return trimmed;
  }
  if (typeof value === 'number') {
    if (isNaN(value)) return fallback;
    return String(value);
  }
  return String(value);
}

export const formatNC = nc;

export function formatDateBR(dateStr?: string | null): string {
  if (!dateStr || typeof dateStr !== 'string' || dateStr.trim() === '') {
    return 'N/C';
  }

  const trimmed = dateStr.trim();
  if (trimmed === '-' || trimmed === 'N/A' || trimmed === 'N/D' || trimmed === 'N/C') {
    return 'N/C';
  }

  // If already in DD/MM/AAAA format
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    return trimmed;
  }

  // If in YYYY-MM-DD format (standard ISO date part)
  const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymdMatch) {
    const [, year, month, day] = ymdMatch;
    return `${day}/${month}/${year}`;
  }

  // If ISO string with timezone or custom date
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${day}/${month}/${year}`;
  }

  return trimmed;
}

export function formatDateTimeBR(dateStr?: string | null): string {
  if (!dateStr || typeof dateStr !== 'string' || dateStr.trim() === '') {
    return 'N/C';
  }

  const trimmed = dateStr.trim();
  if (trimmed === '-' || trimmed === 'N/A' || trimmed === 'N/D' || trimmed === 'N/C') {
    return 'N/C';
  }

  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    const hours = String(parsed.getHours()).padStart(2, '0');
    const minutes = String(parsed.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} às ${hours}:${minutes}`;
  }

  return formatDateBR(dateStr);
}

export function getTodayBR(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `${day}/${month}/${year}`;
}

