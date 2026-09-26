/** "350 m" sotto il chilometro (arrotondato a 10 m), "1.4 km" sopra. */
export function formattaDistanza(metri: number): string {
  return metri < 1000 ? `${Math.round(metri / 10) * 10} m` : `${(metri / 1000).toFixed(1)} km`;
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
