import { DOCUMENT } from '@angular/common';
import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';

/** Nome del file prodotto dal bundle "stili-mappa" in angular.json (leaflet + maplibre-gl). */
const FILE_STILI_MAPPA = 'stili-mappa.css';

let caricamento: Promise<void> | null = null;

/**
 * Guard delle pagine con una mappa (/mappa, /statistiche): carica una volta sola il CSS di
 * Leaflet e MapLibre (~90 kB), che non sta nel bundle iniziale perché le altre pagine non lo
 * usano. La pagina si apre solo a CSS pronto, così la mappa nasce già con il layout giusto.
 * Se il file non arriva (rete) si prosegue comunque: meglio una mappa scomposta che nessuna.
 */
export const stiliMappaGuard: CanActivateFn = () => {
  const documento = inject(DOCUMENT);
  caricamento ??= new Promise<void>((pronto) => {
    const link = documento.createElement('link');
    link.rel = 'stylesheet';
    link.href = FILE_STILI_MAPPA;
    link.onload = () => pronto();
    link.onerror = () => {
      caricamento = null;
      pronto();
    };
    // Prima degli stili dell'app, come quando era nel bundle globale: le nostre regole
    // (styles.scss) restano dopo e vincono a parità di specificità.
    documento.head.insertBefore(link, documento.head.querySelector('link[rel="stylesheet"]'));
  });
  return caricamento.then(() => true);
};
