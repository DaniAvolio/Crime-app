import { NgClass } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';
import { filter, map, startWith } from 'rxjs';
import { CategorieStore } from '../categorie/categorie-store';
import { nomeCategoria } from '../categorie/categoria-i18n';
import { GRAVITA, Gravita } from '../models/gravita.model';
import { classePallinoGravita } from '../shared/gravita';
import { NOME_ICONA_FALLBACK, NOMI_ICONE_DISPONIBILI } from '../shared/icone-categoria';
import { LinguaService } from '../shared/lingua';

/**
 * Sezioni e domande della guida: i testi stanno in i18n (`guida.sezioni.<sezione>.<domanda>.d|r`),
 * qui c'è solo l'ordine. Aggiungere una domanda = una chiave qui + il testo nei due JSON.
 */
const SEZIONI = [
  { chiave: 'cosa', domande: ['aCosaServe', 'emergenze', 'statistiche'] },
  { chiave: 'mappa', domande: ['simboli', 'alone', 'listaRaggio', 'posizione', 'tema'] },
  {
    chiave: 'segnalare',
    domande: ['come', 'account', 'anonima', 'scrivere', 'problema', 'rimuovere'],
  },
  { chiave: 'durata', domande: ['scadenza', 'voto', 'cambiareVoto'] },
  { chiave: 'categorie', domande: ['quali'] },
  { chiave: 'account', domande: ['registrazione', 'profilo', 'fiducia'] },
  { chiave: 'privacy', domande: ['dati', 'storico', 'moderazione'] },
] as const;

/** La domanda che elenca le categorie: la sua risposta include l'elenco letto dal database. */
const DOMANDA_CATEGORIE = 'quali';

interface CategoriaGuida {
  id: number;
  nome: string;
  descrizione: string | null;
  icona: string;
  durata: { chiave: 'ore' | 'giorni'; n: number };
}

interface GruppoCategorie {
  gravita: Gravita;
  categorie: CategoriaGuida[];
}

/** Senza maiuscole né accenti, per cercare "quiete" anche scrivendo "Quiète". */
function normalizza(testo: string): string {
  return testo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Pagina pubblica «Come funziona» (/come-funziona): istruzioni d'uso, categorie segnalabili. Accordion con
 * <details> nativi (tastiera e lettori di schermo gratis) e una ricerca che filtra le domande.
 */
@Component({
  selector: 'app-guida',
  standalone: true,
  imports: [NgClass, TranslocoDirective, LucideDynamicIcon],
  templateUrl: './guida.html',
})
export class Guida implements OnInit {
  private readonly store = inject(CategorieStore);
  private readonly transloco = inject(TranslocoService);
  private readonly lingua = inject(LinguaService);

  protected readonly ricerca = signal('');
  protected readonly classePallinoGravita = classePallinoGravita;
  protected readonly gravitaOrdinate: readonly Gravita[] = [...GRAVITA].sort((a, b) => b - a);

  /** Cambia quando arrivano le traduzioni: il filtro legge i testi da qui, non dal template. */
  private readonly traduzioniCaricate = toSignal(
    this.transloco.events$.pipe(
      filter((evento) => evento.type === 'translationLoadSuccess'),
      map(() => Date.now()),
      startWith(0),
    ),
  );

  /** Categorie attive per gravità (3 -> 1), con nome e descrizione nella lingua attiva. */
  protected readonly gruppiCategorie = computed<GruppoCategorie[]>(() => {
    const lingua = this.lingua.attiva();
    const attive = this.store.categorie().filter((c) => c.attiva);
    return this.gravitaOrdinate
      .map((gravita) => ({
        gravita,
        categorie: attive
          .filter((c) => c.gravita === gravita)
          .map((c) => ({
            id: c.id,
            nome: nomeCategoria(c, lingua),
            descrizione: c.traduzioni?.[lingua]?.descrizione ?? c.descrizione ?? null,
            icona:
              c.icona && NOMI_ICONE_DISPONIBILI.includes(c.icona) ? c.icona : NOME_ICONA_FALLBACK,
            durata:
              c.durataValiditaOre >= 48 && c.durataValiditaOre % 24 === 0
                ? { chiave: 'giorni' as const, n: c.durataValiditaOre / 24 }
                : { chiave: 'ore' as const, n: c.durataValiditaOre },
          }))
          .sort((a, b) => a.nome.localeCompare(b.nome, lingua)),
      }))
      .filter((gruppo) => gruppo.categorie.length > 0);
  });

  /** Sezioni con le sole domande che corrispondono alla ricerca (tutte se è vuota). */
  protected readonly sezioni = computed(() => {
    this.traduzioniCaricate();
    this.lingua.attiva();
    const cerca = normalizza(this.ricerca().trim());
    const nomiCategorie = this.gruppiCategorie()
      .flatMap((g) => g.categorie.map((c) => c.nome))
      .join(' ');
    return SEZIONI.map((sezione) => ({
      chiave: sezione.chiave,
      domande: sezione.domande.filter((domanda) => {
        if (!cerca) {
          return true;
        }
        const base = `guida.sezioni.${sezione.chiave}.${domanda}`;
        const testo = [
          this.transloco.translate(`${base}.d`),
          this.transloco.translate(`${base}.r`),
          domanda === DOMANDA_CATEGORIE ? nomiCategorie : '',
        ].join(' ');
        return normalizza(testo).includes(cerca);
      }),
    })).filter((sezione) => sezione.domande.length > 0);
  });

  protected readonly categoriaDomanda = DOMANDA_CATEGORIE;

  ngOnInit(): void {
    this.store.carica();
  }

  protected cerca(testo: string): void {
    this.ricerca.set(testo);
  }
}
