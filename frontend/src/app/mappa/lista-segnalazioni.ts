import { NgClass } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';
import { LatLng } from 'leaflet';
import { distinctUntilChanged } from 'rxjs';
import { CategorieStore } from '../categorie/categorie-store';
import { NomeCategoriaPipe } from '../categorie/nome-categoria.pipe';
import { SegnalazioneApi } from '../gestione/segnalazioni/segnalazione-api';
import { Segnalazione } from '../models/segnalazione.model';
import { GRAVITA, Gravita } from '../models/gravita.model';
import { chiaveGravita, classeGravita, classePallinoGravita } from '../shared/gravita';
import { NOME_ICONA_FALLBACK } from '../shared/icone-categoria';
import { LinguaService } from '../shared/lingua';
import { formattaDistanza, formattaTempoFa } from './formattazione';

/** Raggi selezionabili attorno all'utente. */
const RAGGI_METRI = [500, 1000, 2000, 5000, 10000] as const;
const RAGGIO_PREDEFINITO_METRI = 2000;
/** Il raggio scelto si ricorda tra una visita e l'altra (solo comodità: se manca, si usa il default). */
const CHIAVE_RAGGIO = 'crime-lista-raggio';
/** Il GPS aggiorna di continuo: si ricarica solo se il centro si è spostato più di così. */
const SPOSTAMENTO_MINIMO_METRI = 100;
/** Segnalazioni per pagina: le successive arrivano scorrendo verso il fondo. */
const DIMENSIONE_PAGINA = 20;
/** Distanza dal fondo (px) entro cui si caricano le voci successive. */
const SOGLIA_CARICAMENTO_PX = 300;

interface VoceLista {
  segnalazione: Segnalazione;
  metri: number;
}

interface CategoriaConConteggio {
  id: number;
  nome: string;
  numero: number;
  gravita: Gravita;
}

interface GruppoCategorie {
  gravita: Gravita;
  categorie: CategoriaConConteggio[];
}

function leggiRaggioSalvato(): number {
  try {
    const salvato = Number(localStorage.getItem(CHIAVE_RAGGIO));
    return (RAGGI_METRI as readonly number[]).includes(salvato)
      ? salvato
      : RAGGIO_PREDEFINITO_METRI;
  } catch {
    return RAGGIO_PREDEFINITO_METRI;
  }
}

/**
 * Vista a lista delle segnalazioni attorno all'utente, dalla più vicina. Carica i propri dati
 * attorno a `centro` (la posizione dell'utente), indipendentemente da dove si trova la mappa,
 * entro il raggio scelto. Ordinamento per distanza e filtri (gravità, categoria) li fa il
 * backend, a pagine: la lista resta corretta anche con migliaia di segnalazioni nella zona,
 * mentre la mappa ne riceve al massimo 500 (le più gravi).
 */
@Component({
  selector: 'app-lista-segnalazioni',
  standalone: true,
  imports: [TranslocoDirective, LucideDynamicIcon, NgClass, NomeCategoriaPipe],
  templateUrl: './lista-segnalazioni.html',
})
export class ListaSegnalazioni {
  /** Posizione dell'utente; se non disponibile, il centro della mappa all'apertura della lista. */
  readonly centro = input.required<LatLng>();
  readonly centroUtente = input(false);
  readonly iconePerCategoria = input.required<Map<number, string>>();
  /** Filtro per gravità condiviso con la mappa (che lo possiede e lo ricorda); null = tutte. */
  readonly gravitaFiltro = input<Gravita | null>(null);

  readonly seleziona = output<Segnalazione>();
  readonly gravitaScelta = output<Gravita | null>();

  protected readonly livelliGravita = GRAVITA;
  protected readonly classeGravita = classeGravita;
  protected readonly classePallinoGravita = classePallinoGravita;
  protected readonly chiaveGravita = chiaveGravita;

  protected readonly raggi = RAGGI_METRI;
  protected readonly raggioMetri = signal(leggiRaggioSalvato());
  /** Categoria selezionata nelle chip; null = tutte. */
  protected readonly categoriaFiltro = signal<number | null>(null);
  /** Prima pagina in arrivo (lista vuota): mostra "Caricamento…". */
  protected readonly caricamento = signal(true);
  protected readonly errore = signal(false);
  /** Pagina successiva in arrivo, o fallita (in fondo alla lista compare "Riprova"). */
  protected readonly caricamentoAltre = signal(false);
  protected readonly erroreAltre = signal(false);
  private readonly segnalazioniCaricate = signal<Segnalazione[]>([]);
  private readonly totaleRisultati = signal(0);
  private prossimaPagina = 0;
  /** Ogni nuova ricerca invalida le risposte ancora in arrivo della precedente. */
  private generazione = 0;
  private readonly conteggi = signal<{ categoriaId: number; numero: number }[]>([]);

  private readonly transloco = inject(TranslocoService);
  private readonly segnalazioneApi = inject(SegnalazioneApi);
  private readonly categorieStore = inject(CategorieStore);
  private readonly lingua = inject(LinguaService);

  /** Le segnalazioni caricate (già dalla più vicina), con la distanza da mostrare. */
  protected readonly voci = computed<VoceLista[]>(() => {
    const centro = this.centro();
    return this.segnalazioniCaricate().map((segnalazione) => ({
      segnalazione,
      metri: centro.distanceTo([segnalazione.lat, segnalazione.lng]),
    }));
  });

  protected readonly ciSonoAltre = computed(
    () => this.segnalazioniCaricate().length < this.totaleRisultati(),
  );

  /** Chip delle categorie: quelle presenti nel raggio (con la gravità scelta), con il numero. */
  protected readonly categorie = computed<CategoriaConConteggio[]>(() => {
    const lingua = this.lingua.attiva();
    const perId = this.categorieStore.perId();
    return this.conteggi()
      .map(({ categoriaId, numero }) => {
        const categoria = perId.get(categoriaId);
        return {
          id: categoriaId,
          nome: categoria ? this.categorieStore.nome(categoria) : String(categoriaId),
          numero,
          gravita: (categoria?.gravita ?? 1) as Gravita,
        };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, lingua));
  });

  /** Voci del menu categorie, raggruppate per gravità dalla più alta (come nella guida). */
  protected readonly gruppiCategorie = computed<GruppoCategorie[]>(() =>
    [...GRAVITA]
      .sort((a, b) => b - a)
      .map((gravita) => ({
        gravita,
        categorie: this.categorie().filter((c) => c.gravita === gravita),
      }))
      .filter((gruppo) => gruppo.categorie.length > 0),
  );

  protected readonly totale = computed(() =>
    this.conteggi().reduce((somma, c) => somma + c.numero, 0),
  );

  /** Il centro cambia solo se ci si è spostati davvero (il GPS aggiorna di continuo). */
  private readonly centroStabile = toSignal(
    toObservable(this.centro).pipe(
      distinctUntilChanged((prima, dopo) => prima.distanceTo(dopo) < SPOSTAMENTO_MINIMO_METRI),
    ),
  );

  protected readonly nomeCategoriaFiltro = computed(
    () => this.categorie().find((c) => c.id === this.categoriaFiltro())?.nome ?? null,
  );

  /** Raggio successivo a quello scelto, proposto quando non ci sono risultati. */
  protected readonly raggioSuccessivo = computed(
    () => RAGGI_METRI.find((r) => r > this.raggioMetri()) ?? null,
  );

  constructor() {
    // Nuova ricerca (centro, raggio, gravità o categoria cambiati): si riparte dalla prima pagina.
    effect(() => {
      const centro = this.centroStabile();
      const raggio = this.raggioMetri();
      const gravita = this.gravitaFiltro();
      const categoria = this.categoriaFiltro();
      if (!centro) {
        return;
      }
      untracked(() => this.ricomincia(centro, raggio, gravita, categoria));
    });

    // I chip delle categorie non dipendono dalla categoria scelta, solo da zona e gravità.
    effect((onCleanup) => {
      const centro = this.centroStabile();
      const raggio = this.raggioMetri();
      const gravita = this.gravitaFiltro();
      if (!centro) {
        return;
      }
      const richiesta = this.segnalazioneApi
        .conteggiVicine(centro.lat, centro.lng, raggio, gravita)
        .subscribe({ next: (conteggi) => this.conteggi.set(conteggi), error: () => undefined });
      onCleanup(() => richiesta.unsubscribe());
    });

    // Se la categoria scelta non ha più segnalazioni (es. raggio ridotto) si torna a "Tutte".
    effect(() => {
      const categoria = this.categoriaFiltro();
      if (
        categoria !== null &&
        !this.caricamento() &&
        !this.categorie().some((c) => c.id === categoria)
      ) {
        this.categoriaFiltro.set(null);
      }
    });
  }

  /** Scorrendo verso il fondo della lista si caricano le segnalazioni successive. */
  protected alScroll(evento: Event): void {
    const contenitore = evento.target as HTMLElement;
    const vicinoAlFondo =
      contenitore.scrollTop + contenitore.clientHeight >=
      contenitore.scrollHeight - SOGLIA_CARICAMENTO_PX;
    // Dopo un errore non si riprova da soli a ogni scroll: c'è il pulsante.
    if (vicinoAlFondo && !this.erroreAltre()) {
      this.caricaAltre();
    }
  }

  protected caricaAltre(): void {
    if (this.caricamento() || this.caricamentoAltre() || !this.ciSonoAltre()) {
      return;
    }
    this.caricaPagina(this.generazione);
  }

  private ricomincia(
    centro: LatLng,
    raggio: number,
    gravita: Gravita | null,
    categoria: number | null,
  ): void {
    this.generazione++;
    this.prossimaPagina = 0;
    this.segnalazioniCaricate.set([]);
    this.totaleRisultati.set(0);
    this.caricamento.set(true);
    this.errore.set(false);
    this.erroreAltre.set(false);
    this.ricerca = { centro, raggio, gravita, categoria };
    this.caricaPagina(this.generazione);
  }

  private ricerca: {
    centro: LatLng;
    raggio: number;
    gravita: Gravita | null;
    categoria: number | null;
  } | null = null;

  /** Carica la pagina successiva della ricerca corrente e la aggiunge in coda. */
  private caricaPagina(generazione: number): void {
    const ricerca = this.ricerca;
    if (!ricerca) {
      return;
    }
    const prima = this.prossimaPagina === 0;
    if (!prima) {
      this.caricamentoAltre.set(true);
      this.erroreAltre.set(false);
    }
    this.segnalazioneApi
      .vicinePerDistanza(
        ricerca.centro.lat,
        ricerca.centro.lng,
        ricerca.raggio,
        { gravita: ricerca.gravita, categoriaId: ricerca.categoria },
        this.prossimaPagina,
        DIMENSIONE_PAGINA,
      )
      .subscribe({
        next: (pagina) => {
          if (generazione !== this.generazione) {
            return;
          }
          const presenti = this.segnalazioniCaricate();
          const nuove = pagina.contenuto.filter((s) => !presenti.some((p) => p.id === s.id));
          this.segnalazioniCaricate.set([...presenti, ...nuove]);
          this.totaleRisultati.set(pagina.totaleElementi);
          this.prossimaPagina++;
          this.caricamento.set(false);
          this.caricamentoAltre.set(false);
        },
        error: () => {
          if (generazione !== this.generazione) {
            return;
          }
          if (prima) {
            this.errore.set(true);
            this.caricamento.set(false);
          } else {
            this.erroreAltre.set(true);
            this.caricamentoAltre.set(false);
          }
        },
      });
  }

  protected scegliRaggio(raggio: number): void {
    this.raggioMetri.set(raggio);
    try {
      localStorage.setItem(CHIAVE_RAGGIO, String(raggio));
    } catch {
      // Storage non disponibile (es. navigazione privata): la scelta vale solo per questa visita.
    }
  }

  /** Frecce ←/→ tra i raggi, come in un gruppo di radio button. */
  protected muoviRaggio(evento: KeyboardEvent): void {
    const passo = evento.key === 'ArrowRight' ? 1 : evento.key === 'ArrowLeft' ? -1 : 0;
    if (passo === 0) {
      return;
    }
    evento.preventDefault();
    const indice = RAGGI_METRI.indexOf(this.raggioMetri() as (typeof RAGGI_METRI)[number]);
    const nuovo = RAGGI_METRI[Math.min(RAGGI_METRI.length - 1, Math.max(0, indice + passo))];
    this.scegliRaggio(nuovo);
    const gruppo = evento.currentTarget as HTMLElement;
    queueMicrotask(() => gruppo.querySelector<HTMLElement>(`[data-raggio="${nuovo}"]`)?.focus());
  }

  /** Dal menu a tendina: stringa vuota = tutte le categorie. */
  protected scegliCategoria(valore: string): void {
    this.categoriaFiltro.set(valore === '' ? null : Number(valore));
  }

  protected distanza(metri: number): string {
    return formattaDistanza(metri, this.transloco.getActiveLang());
  }

  protected tempoFa(iso: string): string {
    return formattaTempoFa(iso, this.transloco.getActiveLang());
  }

  protected icona(categoriaId: number): string {
    return this.iconePerCategoria().get(categoriaId) ?? NOME_ICONA_FALLBACK;
  }
}
