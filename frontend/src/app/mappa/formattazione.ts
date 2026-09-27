/**
 * "350 m" sotto il chilometro (arrotondato a 10 m), sopra "1,4 km" / "2 km" con il separatore
 * decimale della lingua attiva e senza ",0" superflui.
 */
export function formattaDistanza(metri: number, lingua?: string): string {
  if (metri < 1000) {
    return `${Math.round(metri / 10) * 10} m`;
  }
  const km = new Intl.NumberFormat(lingua, { maximumFractionDigits: 1 }).format(metri / 1000);
  return `${km} km`;
}

export function formattaData(iso: string, lingua: string): string {
  return new Intl.DateTimeFormat(lingua, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

/** "5 minuti fa", "2 ore fa", "ieri"… nella lingua attiva. */
export function formattaTempoFa(iso: string, lingua: string, adesso = Date.now()): string {
  const secondi = Math.round((new Date(iso).getTime() - adesso) / 1000);
  const formato = new Intl.RelativeTimeFormat(lingua, { numeric: 'auto' });
  const unita: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  for (const [nome, durata] of unita) {
    if (Math.abs(secondi) >= durata) {
      return formato.format(Math.round(secondi / durata), nome);
    }
  }
  return formato.format(0, 'minute');
}
