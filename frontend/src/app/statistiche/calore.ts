import type { GeoJSONSource, HeatmapLayerSpecification, Map as MaplibreMap } from 'maplibre-gl';
import { Tema } from '../shared/tema';
import { RAMPA } from './rampa';
import { CellaCalore } from './statistiche-api';

const ID = 'calore';

/** Stesso lato delle celle del backend (StatisticheService.latoCella): 8 celle per tassello, min ~200 m. */
export function latoCellaGradi(zoom: number): number {
  return Math.max(0.002, 360 / 2 ** zoom / 8);
}

/** Lato di una cella in pixel a uno zoom di Leaflet (tasselli da 256 px). */
function latoCellaPx(zoom: number): number {
  return (latoCellaGradi(zoom) / 360) * 256 * 2 ** zoom;
}

/** Lo stesso colore esadecimale con opacità zero. */
function trasparente(esadecimale: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(esadecimale.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, 0)`;
}

/** Il primo livello di etichette dello stile: la heatmap va sotto, così i nomi restano leggibili. */
function primoLivelloSimboli(glMap: MaplibreMap): string | undefined {
  return glMap.getStyle().layers.find((livello) => livello.type === 'symbol')?.id;
}

/**
 * Disegna (o aggiorna) la mappa di calore come livello `heatmap` nativo di MapLibre sulla mappa
 * dello sfondo. Ogni cella pesa il suo numero rispetto alla cella più piena; il raggio segue la
 * dimensione delle celle allo zoom attuale, così le macchie si fondono senza lasciare buchi.
 * Va richiamata anche a ogni 'style.load': setStyle toglie i livelli aggiunti.
 */
export function disegnaCalore(
  glMap: MaplibreMap,
  celle: CellaCalore[],
  zoom: number,
  tema: Tema,
): void {
  try {
    applica(glMap, celle, zoom, tema);
  } catch {
    // Stile non ancora caricato (apertura o cambio tema): ridisegna l'handler di 'style.load'.
    // isStyleLoaded() non serve allo scopo: resta falso anche mentre si caricano i tasselli.
  }
}

function applica(glMap: MaplibreMap, celle: CellaCalore[], zoom: number, tema: Tema): void {
  const dati: GeoJSON.FeatureCollection<GeoJSON.Point, { numero: number }> = {
    type: 'FeatureCollection',
    features: celle.map((cella) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [cella.lng, cella.lat] },
      properties: { numero: cella.numero },
    })),
  };
  const sorgente = glMap.getSource(ID) as GeoJSONSource | undefined;
  if (sorgente) {
    sorgente.setData(dati);
  } else {
    glMap.addSource(ID, { type: 'geojson', data: dati });
  }

  const massimo = Math.max(1, ...celle.map((cella) => cella.numero));
  const rampa = RAMPA[tema];
  const raggio = Math.min(90, Math.max(18, latoCellaPx(zoom) * 1.7));
  const paint: NonNullable<HeatmapLayerSpecification['paint']> = {
    // Radice quadrata: le zone con pochi episodi restano visibili accanto a quelle più piene.
    'heatmap-weight': ['sqrt', ['/', ['get', 'numero'], massimo]],
    'heatmap-intensity': 1.2,
    'heatmap-radius': raggio,
    'heatmap-opacity': tema === 'scuro' ? 0.85 : 0.75,
    'heatmap-color': [
      'interpolate',
      ['linear'],
      ['heatmap-density'],
      0,
      // Dal primo colore trasparente, non dal nero: i bordi non virano al grigio.
      trasparente(rampa[1]),
      0.08,
      rampa[1],
      0.25,
      rampa[2],
      0.45,
      rampa[3],
      0.65,
      rampa[4],
      0.85,
      rampa[5],
      1,
      rampa[6],
    ],
  };

  if (!glMap.getLayer(ID)) {
    glMap.addLayer({ id: ID, type: 'heatmap', source: ID, paint }, primoLivelloSimboli(glMap));
    return;
  }
  for (const [proprieta, valore] of Object.entries(paint)) {
    glMap.setPaintProperty(ID, proprieta as keyof typeof paint, valore);
  }
}
