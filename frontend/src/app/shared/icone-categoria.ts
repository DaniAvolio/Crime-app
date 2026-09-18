import {
  LucideBan,
  LucideBell,
  LucideBike,
  LucideBuilding2,
  LucideCamera,
  LucideCar,
  LucideCigarette,
  LucideCircleHelp,
  LucideDog,
  LucideEye,
  LucideFlame,
  LucideFootprints,
  LucideHandFist,
  LucideHome,
  LucideLightbulb,
  LucideMapPin,
  LucideMoon,
  LucidePackage,
  LucideParkingCircleOff,
  LucideSettings,
  LucideShieldAlert,
  LucideSiren,
  LucideSkull,
  LucideSun,
  LucideTrash2,
  LucideTriangleAlert,
  LucideUsers,
  LucideVolume2,
  LucideWine,
  LucideWrench,
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
  LucideCigarette,
  LucideCircleHelp,
  LucideDog,
  LucideEye,
  LucideFlame,
  LucideFootprints,
  LucideHandFist,
  LucideHome,
  LucideLightbulb,
  LucideMapPin,
  LucideMoon,
  LucidePackage,
  LucideParkingCircleOff,
  LucideSettings,
  LucideShieldAlert,
  LucideSiren,
  LucideSkull,
  LucideSun,
  LucideTrash2,
  LucideTriangleAlert,
  LucideUsers,
  LucideVolume2,
  LucideWine,
  LucideWrench,
] as const;

/** Nomi (kebab-case) delle icone disponibili: usati per il suggerimento nel form e per validare l'input. */
export const NOMI_ICONE_DISPONIBILI: readonly string[] = ICONE_CATEGORIA_DISPONIBILI.map(
  (componente) => componente.icon.name,
);

/** Icona mostrata quando il valore salvato non corrisponde a nessuna icona disponibile. */
export const NOME_ICONA_FALLBACK = 'circle-help';
