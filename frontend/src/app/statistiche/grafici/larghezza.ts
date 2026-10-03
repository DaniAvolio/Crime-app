import { DestroyRef, ElementRef, inject, signal } from '@angular/core';

/**
 * Larghezza in px dell'elemento host, aggiornata quando cambia (rotazione, finestra): i grafici
 * SVG disegnano in pixel reali invece di scalare un viewBox, così testi e barre non si deformano.
 */
export function larghezzaHost(iniziale = 320) {
  const larghezza = signal(iniziale);
  const host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
  const osservatore = new ResizeObserver(([voce]) => {
    const nuova = Math.floor(voce.contentRect.width);
    if (nuova > 0 && nuova !== larghezza()) {
      larghezza.set(nuova);
    }
  });
  osservatore.observe(host);
  inject(DestroyRef).onDestroy(() => osservatore.disconnect());
  return larghezza.asReadonly();
}

/** Massimo "tondo" dell'asse e passo dei tick (1, 2 o 5 × 10^k), per circa `tick` tacche. */
export function scalaTonda(massimo: number, tick = 4): { massimo: number; passo: number } {
  if (massimo <= 0) {
    return { massimo: tick, passo: 1 };
  }
  const grezzo = massimo / tick;
  const potenza = 10 ** Math.floor(Math.log10(grezzo));
  const passo = [1, 2, 5, 10].map((m) => m * potenza).find((p) => p >= grezzo) ?? 10 * potenza;
  const intero = Math.max(1, Math.round(passo));
  return { massimo: Math.ceil(massimo / intero) * intero, passo: intero };
}
