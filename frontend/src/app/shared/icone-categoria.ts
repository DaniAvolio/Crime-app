import {
  LucideBan,
  LucideBell,
  LucideBike,
  LucideBuilding2,
  LucideCamera,
  LucideCar,
  LucideCheck,
  LucideCigarette,
  LucideCircleHelp,
  LucideDog,
  LucideEye,
  LucideFlame,
  LucideFootprints,
  LucideHammer,
  LucideHandFist,
  LucideHome,
  LucideInfo,
  LucideLightbulb,
  LucideList,
  LucideLocateFixed,
  LucideLogOut,
  LucideMap,
  LucideMapPin,
  LucideMegaphoneOff,
  LucideMoon,
  LucidePackage,
  LucideParkingCircleOff,
  LucidePhone,
  LucidePill,
  LucidePlus,
  LucideSettings,
  LucideShieldAlert,
  LucideSiren,
  LucideSkull,
  LucideSearch,
  LucideSprayCan,
  LucideSun,
  LucideSunMoon,
  LucideSwords,
  LucideTrash2,
  LucideTriangleAlert,
  LucideUser,
  LucideUsers,
  LucideVenetianMask,
  LucideVolume2,
  LucideWallet,
  LucideWine,
  LucideWrench,
  LucideX,
} from '@lucide/angular';

/**
 * Componenti icona Lucide effettivamente registrati nell'app (vedi provideLucideIcons in app.config.ts).
 * Per aggiungerne una nuova: importarla da '@lucide/angular' e aggiungerla a questo array.
 * Il nome utilizzabile nel campo "icona" è quello kebab-case esposto da `<componente>.icon.name`
 * (es. LucideBell.icon.name === 'bell').
 */
export const ICONE_CATEGORIA_DISPONIBILI = [
  LucideBan,
  LucideBell,
  LucideBike,
  LucideBuilding2,
  LucideCamera,
  LucideCar,
  LucideCheck,
  LucideCigarette,
  LucideCircleHelp,
  LucideDog,
  LucideEye,
  LucideFlame,
  LucideFootprints,
  LucideHammer,
  LucideHandFist,
  LucideHome,
  LucideInfo,
  LucideLightbulb,
  LucideList,
  LucideLocateFixed,
  LucideLogOut,
  LucideMap,
  LucideMapPin,
  LucideMegaphoneOff,
  LucideMoon,
  LucidePackage,
  LucideParkingCircleOff,
  LucidePhone,
  LucidePill,
  LucidePlus,
  LucideSettings,
  LucideShieldAlert,
  LucideSiren,
  LucideSkull,
  LucideSearch,
  LucideSprayCan,
  LucideSun,
  LucideSunMoon,
  LucideSwords,
  LucideTrash2,
  LucideTriangleAlert,
  LucideUser,
  LucideUsers,
  LucideVenetianMask,
  LucideVolume2,
  LucideWallet,
  LucideWine,
  LucideWrench,
  LucideX,
] as const;

/** Nomi (kebab-case) delle icone disponibili: usati per il suggerimento nel form e per validare l'input. */
export const NOMI_ICONE_DISPONIBILI: readonly string[] = ICONE_CATEGORIA_DISPONIBILI.map(
  (componente) => componente.icon.name,
);

/** Icona mostrata quando il valore salvato non corrisponde a nessuna icona disponibile. */
export const NOME_ICONA_FALLBACK = 'circle-help';

type NodoIcona = readonly [string, Record<string, unknown>, (readonly NodoIcona[])?];

function nodoInSvg([tag, attributi, figli]: NodoIcona): string {
  const attr = Object.entries(attributi)
    .map(([nome, valore]) => `${nome}="${valore}"`)
    .join(' ');
  return `<${tag} ${attr}>${(figli ?? []).map(nodoInSvg).join('')}</${tag}>`;
}

/**
 * Markup SVG di un'icona registrata, per contesti fuori dai template Angular
 * (es. i divIcon dei marker Leaflet). Nomi non registrati ricadono su NOME_ICONA_FALLBACK.
 */
export function svgIcona(nome: string | null | undefined, classe = ''): string {
  const icona =
    ICONE_CATEGORIA_DISPONIBILI.find((c) => c.icon.name === nome) ??
    ICONE_CATEGORIA_DISPONIBILI.find((c) => c.icon.name === NOME_ICONA_FALLBACK)!;
  const contenuto = (icona.icon.node as readonly NodoIcona[]).map(nodoInSvg).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${classe}" aria-hidden="true">${contenuto}</svg>`;
}
