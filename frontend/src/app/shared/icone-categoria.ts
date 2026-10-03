import type { LucideIconData } from '@lucide/angular';
import {
  Ban,
  Bell,
  Bike,
  BuildingComplex,
  Camera,
  Car,
  Check,
  Cigarette,
  CircleParkingOff,
  CircleQuestionMark,
  Dog,
  Eye,
  Flag,
  Flame,
  Footprints,
  Hammer,
  HandFist,
  House,
  Info,
  Languages,
  Lightbulb,
  List,
  LocateFixed,
  LogOut,
  Map,
  MapPin,
  MegaphoneOff,
  Moon,
  Package,
  Phone,
  Pill,
  Plus,
  Search,
  Settings,
  ShieldAlert,
  Siren,
  Skull,
  SprayCan,
  Sun,
  SunMoon,
  Swords,
  Trash,
  TriangleAlert,
  User,
  Users,
  VenetianMask,
  Volume2,
  Wallet,
  Wine,
  Wrench,
  X,
} from 'lucide';

/*
 * Icone dell'app (interfaccia e categorie), registrate per nome con provideLucideIcons in
 * app.config.ts e rese da LucideDynamicIcon (`<svg lucideIcon="nome">`).
 *
 * Si importano i soli dati SVG dal pacchetto `lucide`, non i componenti di `@lucide/angular`:
 * ogni componente porta con sé una copia del template (~3 kB), e 50 icone pesavano ~170 kB nel
 * bundle iniziale. I dati sono poche centinaia di byte per icona.
 *
 * Per aggiungerne una: importarla da 'lucide' (nome PascalCase) e aggiungere qui
 * `icona('nome-kebab', Componente)`, con gli eventuali alias. Il nome è quello usabile nel campo
 * "icona" delle categorie; deve coincidere con il nome canonico Lucide (https://lucide.dev/icons).
 */

type NodoLucide = LucideIconData['node'];

function icona(name: string, node: unknown, aliases: string[] = []): LucideIconData {
  return { name, node: node as NodoLucide, aliases };
}

export const ICONE_CATEGORIA_DISPONIBILI: readonly LucideIconData[] = [
  icona('ban', Ban),
  icona('bell', Bell),
  icona('bike', Bike),
  icona('building-complex', BuildingComplex),
  icona('camera', Camera),
  icona('car', Car),
  icona('check', Check),
  icona('cigarette', Cigarette),
  icona('circle-parking-off', CircleParkingOff),
  icona('circle-question-mark', CircleQuestionMark, ['help-circle', 'circle-help']),
  icona('dog', Dog),
  icona('eye', Eye),
  icona('flag', Flag),
  icona('flame', Flame),
  icona('footprints', Footprints),
  icona('hammer', Hammer),
  icona('hand-fist', HandFist),
  icona('house', House, ['home']),
  icona('info', Info),
  icona('languages', Languages),
  icona('lightbulb', Lightbulb),
  icona('list', List),
  icona('locate-fixed', LocateFixed),
  icona('log-out', LogOut),
  icona('map', Map),
  icona('map-pin', MapPin),
  icona('megaphone-off', MegaphoneOff),
  icona('moon', Moon),
  icona('package', Package),
  icona('phone', Phone),
  icona('pill', Pill),
  icona('plus', Plus),
  icona('search', Search),
  icona('settings', Settings),
  icona('shield-alert', ShieldAlert),
  icona('siren', Siren),
  icona('skull', Skull),
  icona('spray-can', SprayCan),
  icona('sun', Sun),
  icona('sun-moon', SunMoon),
  icona('swords', Swords),
  icona('trash', Trash, ['trash-2']),
  icona('triangle-alert', TriangleAlert, ['alert-triangle']),
  icona('user', User),
  icona('users', Users),
  icona('venetian-mask', VenetianMask),
  icona('volume-2', Volume2),
  icona('wallet', Wallet),
  icona('wine', Wine),
  icona('wrench', Wrench),
  icona('x', X),
];

/** Nomi (kebab-case) delle icone disponibili: usati per il suggerimento nel form e per validare l'input. */
export const NOMI_ICONE_DISPONIBILI: readonly string[] = ICONE_CATEGORIA_DISPONIBILI.map(
  (dati) => dati.name,
);

/** Icona mostrata quando il valore salvato non corrisponde a nessuna icona disponibile. */
export const NOME_ICONA_FALLBACK = 'circle-help';

/** Dati di un'icona per nome o alias (es. 'home' → 'house'), oppure undefined. */
function trovaIcona(nome: string | null | undefined): LucideIconData | undefined {
  return ICONE_CATEGORIA_DISPONIBILI.find(
    (dati) => dati.name === nome || dati.aliases?.includes(nome ?? ''),
  );
}

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
  const dati = trovaIcona(nome) ?? trovaIcona(NOME_ICONA_FALLBACK)!;
  const contenuto = (dati.node as readonly NodoIcona[]).map(nodoInSvg).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${classe}" aria-hidden="true">${contenuto}</svg>`;
}
