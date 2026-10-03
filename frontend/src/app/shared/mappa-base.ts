import { Map as LeafletMap, MaplibreGL } from 'leaflet';
import { maplibreGL } from '@maplibre/maplibre-gl-leaflet';
import { ExpressionSpecification, setWorkerUrl } from 'maplibre-gl';
import { Tema } from './tema';

/*
 * Sfondo vettoriale condiviso dalle pagine con una mappa (mappa principale, statistiche):
 * stile OpenFreeMap per tema, luoghi utili, etichette leggibili sullo stile scuro e crediti
 * compatti. Ogni pagina crea il proprio sfondo con sfondoOpenFreeMap e lo segue col tema mappa.
 */

// MapLibre ricava l'URL del suo web worker da import.meta.url, che il bundler di Angular
// non preserva: il worker (e il modulo condiviso che importa) vengono copiati da
// node_modules in assets/maplibre (vedi angular.json -> assets) e indicati qui.
setWorkerUrl('assets/maplibre/maplibre-gl-worker.mjs');

/**
 * Stili vettoriali OpenFreeMap (open source, gratuiti, senza chiave), resi da MapLibre GL
 * dentro un layer Leaflet: pallino e overlay restano layer Leaflet normali sopra la mappa.
 */
/** Stile vettoriale per tema: al cambio tema setStyle ricarica lo stile (vedi constructor). */
export const STILI_PER_TEMA: Record<Tema, string> = { chiaro: 'positron', scuro: 'fiord' };

export function urlStileOpenFreeMap(stile: string): string {
  return `https://tiles.openfreemap.org/styles/${stile}`;
}

export function sfondoOpenFreeMap(stile: string): MaplibreGL {
  // L'attribuzione (OpenFreeMap, OpenMapTiles, OSM) arriva dalle sorgenti dello stile: il
  // plugin la inserisce nel controllo di Leaflet al "load" di MapLibre.
  return maplibreGL({ style: urlStileOpenFreeMap(stile) });
}

/**
 * Lo stile Bright chiede icone (es. "gate", "bollard", "office") assenti dallo sprite di
 * OpenFreeMap, e MapLibre logga un warning per ognuna. Registrarle come immagine vuota non
 * cambia nulla a video (l'icona non esiste comunque) ma evita il rumore in console.
 * Il resolver resta valido anche dopo setStyle: basta impostarlo una volta.
 */
export function ignoraIconeMancanti(sfondo: MaplibreGL): void {
  const glMap = sfondo.getMaplibreMap();
  glMap.setMissingStyleImageResolver((id) => {
    if (!glMap.hasImage(id)) {
      glMap.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) });
    }
  });
}

/**
 * Luoghi utili in caso di emergenza, dal livello `poi` delle tile OpenMapTiles (classi con
 * icona nello sprite OpenFreeMap). In ordine di priorità: se si sovrappongono vince il primo.
 */
const CLASSI_LUOGHI_UTILI = [
  'hospital',
  'police',
  'fire_station',
  'doctors',
  'railway',
  'town_hall',
];
const ID_LIVELLO_LUOGHI_UTILI = 'luoghi-utili';

/**
 * Zone sensibili (scuole, parchi, parchi giochi): più numerose e meno urgenti dei luoghi di
 * emergenza, quindi compaiono solo da vicino, più discrete, e cedono il posto nelle collisioni.
 * Zoom in unità MapLibre (= zoom della mappa - 1, vedi il livello dei luoghi utili).
 */
const ZONE_SENSIBILI = [
  // Scuole: da zoom mappa 16.
  { id: 'zone-sensibili-scuole', classi: ['school', 'college'], minzoom: 15 },
  // Parchi e parchi giochi, i più numerosi: da zoom mappa 17.
  { id: 'zone-sensibili-svago', classi: ['playground', 'park'], minzoom: 16 },
];
/** Il nome delle zone sensibili compare solo da zoom mappa 17; prima solo l'icona. */
const ZOOM_NOMI_ZONE_SENSIBILI = 16;

const NOME_LUOGO: ExpressionSpecification = ['coalesce', ['get', 'name:latin'], ['get', 'name']];

/** Alone scuro delle etichette sullo stile scuro: stacca il testo da strade e aree (sfondo #45516E). */
const ALONE_ETICHETTE_SCURO = 'rgba(22, 28, 44, 0.85)';

/** Colori di testo e alone dei nostri livelli di luoghi, per tema. */
const PALETTE_LUOGHI = {
  chiaro: { luoghi: '#555', zone: '#888', alone: '#ffffff' },
  scuro: { luoghi: '#dbe3ee', zone: '#aeb9c9', alone: ALONE_ETICHETTE_SCURO },
} as const;

/**
 * Fiord (stile scuro) ha etichette quasi dello stesso tono dello sfondo: nomi dei quartieri a
 * contrasto ~1,6:1, vie e acque poco sopra. Si schiariscono testo e alone di tutte le etichette
 * dello stile (non font, dimensioni o posizioni): luoghi abitati più chiari (~7:1), il resto ~5:1.
 */
function schiarisciEtichette(glMap: ReturnType<MaplibreGL['getMaplibreMap']>): void {
  for (const livello of glMap.getStyle().layers) {
    if (livello.type !== 'symbol' || !livello.layout?.['text-field']) {
      continue;
    }
    if (livello.id === ID_LIVELLO_LUOGHI_UTILI || ZONE_SENSIBILI.some((z) => z.id === livello.id)) {
      continue;
    }
    const abitato = livello.id.startsWith('place_');
    glMap.setPaintProperty(livello.id, 'text-color', abitato ? '#e8eef6' : '#c5cfdd');
    glMap.setPaintProperty(livello.id, 'text-halo-color', ALONE_ETICHETTE_SCURO);
    glMap.setPaintProperty(livello.id, 'text-halo-width', 1.5);
    glMap.setPaintProperty(livello.id, 'text-halo-blur', 0.5);
  }
}

/**
 * Positron (come gli altri stili minimali) non disegna i luoghi di interesse: si aggiunge un
 * livello con solo quelli utili per un'app di sicurezza. Gli stili ricchi (bright, liberty) li
 * hanno già. Va riaggiunto a ogni caricamento di stile: setStyle azzera i livelli aggiunti.
 * Sullo stile scuro, allo stesso momento, si schiariscono le etichette (vedi schiarisciEtichette).
 */
export function aggiungiLuoghiUtili(sfondo: MaplibreGL, scuro: () => boolean): void {
  const glMap = sfondo.getMaplibreMap();
  const aggiungi = () => {
    if (scuro()) {
      schiarisciEtichette(glMap);
    }
    const palette = PALETTE_LUOGHI[scuro() ? 'scuro' : 'chiaro'];
    const haGiaLuoghi = glMap
      .getStyle()
      .layers.some((livello) => 'source-layer' in livello && livello['source-layer'] === 'poi');
    if (haGiaLuoghi || glMap.getLayer(ID_LIVELLO_LUOGHI_UTILI)) {
      return;
    }
    glMap.addLayer({
      id: ID_LIVELLO_LUOGHI_UTILI,
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'poi',
      // Zoom MapLibre: il plugin lo tiene uno sotto quello di Leaflet (tile da 512 px), quindi
      // 13 qui = zoom 14 della mappa.
      minzoom: 13,
      filter: ['match', ['get', 'class'], CLASSI_LUOGHI_UTILI, true, false],
      layout: {
        'icon-image': ['get', 'class'],
        'icon-size': 0.9,
        'text-field': NOME_LUOGO,
        'text-font': ['Noto Sans Italic'],
        'text-size': 11,
        'text-anchor': 'top',
        'text-offset': [0, 0.8],
        'text-max-width': 9,
        // Se non c'è spazio si perde prima il nome, poi l'icona.
        'text-optional': true,
        'symbol-sort-key': ['index-of', ['get', 'class'], ['literal', CLASSI_LUOGHI_UTILI]],
      },
      paint: {
        'text-color': palette.luoghi,
        'text-halo-color': palette.alone,
        'text-halo-width': 1,
        'text-halo-blur': 0.5,
      },
    });
    // Aggiunte sotto i luoghi utili: MapLibre piazza prima i simboli dei livelli più in alto,
    // quindi in caso di sovrapposizione restano ospedali, polizia, ecc.
    for (const zona of ZONE_SENSIBILI) {
      glMap.addLayer(
        {
          id: zona.id,
          type: 'symbol',
          source: 'openmaptiles',
          'source-layer': 'poi',
          minzoom: zona.minzoom,
          filter: ['match', ['get', 'class'], zona.classi, true, false],
          layout: {
            'icon-image': ['get', 'class'],
            'icon-size': 0.8,
            'text-field': ['step', ['zoom'], '', ZOOM_NOMI_ZONE_SENSIBILI, NOME_LUOGO],
            'text-font': ['Noto Sans Italic'],
            'text-size': 10,
            'text-anchor': 'top',
            'text-offset': [0, 0.8],
            'text-max-width': 8,
            'text-optional': true,
          },
          paint: {
            'text-color': palette.zone,
            'text-halo-color': palette.alone,
            'text-halo-width': 1,
            'icon-opacity': 0.85,
          },
        },
        ID_LIVELLO_LUOGHI_UTILI,
      );
    }
  };
  glMap.on('style.load', aggiungi);
  if (glMap.isStyleLoaded()) {
    aggiungi();
  }
}

/**
 * Crediti della mappa compatti, come Google Maps e MapLibre: al posto del prefisso
 * "🇺🇦 Leaflet" (non richiesto dalla licenza) un pulsante "i" che mostra o nasconde i crediti
 * di OpenFreeMap / OpenMapTiles / OpenStreetMap, che invece vanno sempre resi accessibili.
 * Lo stato aperto/chiuso è solo una classe sul contenitore: l'HTML del controllo non va
 * rigenerato durante il click, o Leaflet non riconoscerebbe più il pulsante (staccato dal DOM)
 * come parte del controllo e tratterebbe il click come un tocco sulla mappa, che lo richiude.
 */
export function attribuzioneCompatta(map: LeafletMap, etichetta: string): void {
  const controllo = map.attributionControl;
  const contenitore = controllo?.getContainer();
  if (!controllo || !contenitore) {
    return;
  }
  controllo.setPrefix(
    `<button type="button" class="attribuzione-info" aria-label="${etichetta}" title="${etichetta}" aria-expanded="false">i</button>`,
  );
  contenitore.addEventListener('click', (evento) => {
    if ((evento.target as HTMLElement).closest('.attribuzione-info')) {
      const aperta = !contenitore.classList.contains('attribuzione-aperta');
      impostaAttribuzioneAperta(map, aperta);
    }
  });
  // Leaflet ricrea l'HTML quando cambiano i crediti (es. nuovo stile al cambio tema):
  // il nuovo pulsante riprende lo stato dal contenitore.
  new MutationObserver(() => impostaAttribuzioneAperta(map, null)).observe(contenitore, {
    childList: true,
  });
}

/** `null` riallinea solo `aria-expanded` allo stato attuale. */
export function impostaAttribuzioneAperta(map: LeafletMap, aperta: boolean | null): void {
  const contenitore = map.attributionControl?.getContainer();
  if (!contenitore) {
    return;
  }
  if (aperta !== null) {
    contenitore.classList.toggle('attribuzione-aperta', aperta);
  }
  const pulsante = contenitore.querySelector('.attribuzione-info');
  const stato = String(contenitore.classList.contains('attribuzione-aperta'));
  if (pulsante && pulsante.getAttribute('aria-expanded') !== stato) {
    pulsante.setAttribute('aria-expanded', stato);
  }
}
