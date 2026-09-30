import { NgClass } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';
import { map, startWith } from 'rxjs';
import { AuthService } from '../auth/auth';
import { CategorieStore } from '../categorie/categorie-store';
import { NomeCategoriaPipe } from '../categorie/nome-categoria.pipe';
import { SegnalazioneApi } from '../gestione/segnalazioni/segnalazione-api';
import { formattaData, formattaTempoFa } from '../mappa/formattazione';
import { Segnalazione, StatoSegnalazione } from '../models/segnalazione.model';
import { DialoghiService } from '../shared/dialoghi/dialoghi';
import { chiaveGravita, classeGravita } from '../shared/gravita';
import { NOME_ICONA_FALLBACK, NOMI_ICONE_DISPONIBILI } from '../shared/icone-categoria';
import { LinguaService } from '../shared/lingua';
import { Tema, TemaMappa, TemaService } from '../shared/tema';
import { ToastService } from '../shared/toast/toast';
import { ProfiloApi } from './profilo-api';

type Scheda = 'attive' | 'concluse';

/** Segnalazioni caricate alla volta in ogni scheda: le altre arrivano scorrendo. */
const DIMENSIONE_PAGINA_SEGNALAZIONI = 20;
/** Distanza dal fondo dell'elenco (px) entro cui si caricano le voci successive. */
const SOGLIA_CARICAMENTO_PX = 160;

/** Stato di una scheda: voci già caricate, quante ce ne sono in tutto e a che pagina siamo. */
interface ElencoScheda {
  voci: Segnalazione[];
  totale: number;
  prossimaPagina: number;
  caricato: boolean;
  caricando: boolean;
  errore: boolean;
}

const elencoVuoto = (): ElencoScheda => ({
  voci: [],
  totale: 0,
  prossimaPagina: 0,
  caricato: false,
  caricando: false,
  errore: false,
});

/** La conferma della nuova password deve coincidere con la nuova password. */
function passwordCoincidenti(gruppo: AbstractControl): ValidationErrors | null {
  const nuova = gruppo.get('nuovaPassword')?.value;
  const conferma = gruppo.get('confermaPassword')?.value;
  return conferma && nuova !== conferma ? { nonCoincidenti: true } : null;
}

/**
 * Profilo dell'utente autenticato: riepilogo, modifica di nome/cognome, cambio password e le
 * segnalazioni che ha aperto (attive e concluse), con apertura sulla mappa e rimozione.
 */
/** Nome di una lingua scritto nella lingua stessa ("italiano", "English"); il codice se non si sa. */
function nomeLingua(codice: string): string {
  try {
    const nome = new Intl.DisplayNames([codice], { type: 'language' }).of(codice);
    return nome ? nome.charAt(0).toLocaleUpperCase(codice) + nome.slice(1) : codice.toUpperCase();
  } catch {
    return codice.toUpperCase();
  }
}

interface OpzionePreferenza {
  id: string;
  /** Testo già pronto (es. nome della lingua) oppure chiave i18n da tradurre nel template. */
  testo?: string;
  chiaveTesto?: string;
  chiaveAiuto?: string;
  icona: string;
  attiva: boolean;
  scegli: () => void;
}

interface GruppoPreferenze {
  chiave: 'lingua' | 'tema' | 'mappa';
  opzioni: OpzionePreferenza[];
}

@Component({
  selector: 'app-profilo',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslocoDirective,
    LucideDynamicIcon,
    NgClass,
    NomeCategoriaPipe,
  ],
  templateUrl: './profilo.html',
})
export class Profilo {
  protected readonly auth = inject(AuthService);
  private readonly profiloApi = inject(ProfiloApi);
  private readonly segnalazioneApi = inject(SegnalazioneApi);
  private readonly dialoghi = inject(DialoghiService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  protected readonly tema = inject(TemaService);

  private readonly lingua = inject(LinguaService);

  /**
   * Preferenze dell'utente, salvate su questo dispositivo: lingua, tema dell'app e tema dello
   * sfondo della mappa (che può seguire l'app o restare fisso). Le lingue sono quelle di
   * Transloco, così aggiungerne una la fa comparire qui da sola.
   */
  protected readonly preferenze = computed<GruppoPreferenze[]>(() => {
    const linguaAttiva = this.lingua.attiva();
    const temaApp = this.tema.temaAttuale();
    const temaMappa = this.tema.temaMappaScelto();
    const scelteTema: { id: Tema; icona: string }[] = [
      { id: 'chiaro', icona: 'sun' },
      { id: 'scuro', icona: 'moon' },
    ];
    return [
      {
        chiave: 'lingua',
        opzioni: this.lingueDisponibili.map((codice) => ({
          id: codice,
          testo: nomeLingua(codice),
          icona: 'languages',
          attiva: codice === linguaAttiva,
          scegli: () => this.transloco.setActiveLang(codice),
        })),
      },
      {
        chiave: 'tema',
        opzioni: scelteTema.map(({ id, icona }) => ({
          id,
          chiaveTesto: `profilo.preferenze.tema.${id}`,
          icona,
          attiva: id === temaApp,
          scegli: () => this.tema.impostaTema(id),
        })),
      },
      {
        chiave: 'mappa',
        opzioni: (
          [
            { id: 'auto', icona: 'sun-moon' },
            { id: 'chiaro', icona: 'sun' },
            { id: 'scuro', icona: 'moon' },
          ] as { id: TemaMappa; icona: string }[]
        ).map(({ id, icona }) => ({
          id,
          chiaveTesto: `profilo.preferenze.mappa.${id}`,
          chiaveAiuto: `profilo.preferenze.mappa.${id}Aiuto`,
          icona,
          attiva: id === temaMappa,
          scegli: () => this.tema.impostaTemaMappa(id),
        })),
      },
    ];
  });

  private readonly lingueDisponibili = this.transloco
    .getAvailableLangs()
    .map((lingua) => (typeof lingua === 'string' ? lingua : lingua.id));

  /** Dopo il logout si torna alla home: come dal pannello impostazioni della nav. */
  protected esci(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/');
  }

  protected readonly StatoSegnalazione = StatoSegnalazione;
  protected readonly classeGravita = classeGravita;
  protected readonly chiaveGravita = chiaveGravita;

  protected readonly iniziali = computed(() => {
    const utente = this.auth.utente();
    return utente ? `${utente.nome.charAt(0)}${utente.cognome.charAt(0)}`.toUpperCase() : '';
  });

  // --- Dati personali
  protected readonly formDati = this.fb.nonNullable.group({
    nome: ['', [Validators.required, Validators.maxLength(100)]],
    cognome: ['', [Validators.required, Validators.maxLength(100)]],
  });
  protected readonly salvataggioDati = signal(false);
  /** "Salva" attivo solo se nome o cognome sono diversi da quelli salvati. */
  protected readonly datiModificati = toSignal(
    this.formDati.valueChanges.pipe(
      startWith(null),
      map(() => {
        const utente = this.auth.utente();
        const { nome, cognome } = this.formDati.getRawValue();
        return !!utente && (nome.trim() !== utente.nome || cognome.trim() !== utente.cognome);
      }),
    ),
    { initialValue: false },
  );

  // --- Password
  protected readonly formPassword = this.fb.nonNullable.group(
    {
      passwordAttuale: ['', Validators.required],
      nuovaPassword: ['', [Validators.required, Validators.minLength(8)]],
      confermaPassword: ['', Validators.required],
    },
    { validators: passwordCoincidenti },
  );
  protected readonly mostraPassword = signal(false);
  protected readonly salvataggioPassword = signal(false);

  // --- Le mie segnalazioni
  /** Le schede si caricano a pagine (dal backend) e solo quando servono. */
  private readonly elenchi = signal<Record<Scheda, ElencoScheda>>({
    attive: elencoVuoto(),
    concluse: elencoVuoto(),
  });
  /** Ogni richiesta invalida le precedenti della stessa scheda (es. dopo una rimozione). */
  private readonly generazione: Record<Scheda, number> = { attive: 0, concluse: 0 };
  protected readonly conteggi = signal({ attive: 0, concluse: 0 });
  protected readonly scheda = signal<Scheda>('attive');
  private readonly riquadroElenco = viewChild<ElementRef<HTMLElement>>('riquadroElenco');

  /** Cambiando scheda l'elenco (stesso riquadro scorrevole) riparte dall'alto. */
  protected apriScheda(scheda: Scheda): void {
    this.scheda.set(scheda);
    this.riquadroElenco()?.nativeElement.scrollTo({ top: 0 });
    const elenco = this.elenchi()[scheda];
    if (!elenco.caricato && !elenco.caricando) {
      this.caricaScheda(scheda);
    }
  }
  private readonly categorieStore = inject(CategorieStore);

  protected readonly statoScheda = computed(() => this.elenchi()[this.scheda()]);
  protected readonly elencoScheda = computed(() => this.statoScheda().voci);
  /** Caricamento della prima pagina (a elenco vuoto): il riquadro mostra "Caricamento…". */
  protected readonly caricamentoSegnalazioni = computed(
    () => this.statoScheda().caricando && this.statoScheda().voci.length === 0,
  );
  protected readonly erroreSegnalazioni = computed(
    () => this.statoScheda().errore && this.statoScheda().voci.length === 0,
  );
  protected readonly ciSonoAltre = computed(
    () => this.statoScheda().voci.length < this.statoScheda().totale,
  );

  constructor() {
    // Il form parte dai dati della sessione e si riallinea se questi cambiano (es. dopo il salvataggio).
    effect(() => {
      const utente = this.auth.utente();
      if (utente) {
        this.formDati.reset({ nome: utente.nome, cognome: utente.cognome });
      }
    });
    // Senza categorie si usano l'icona di ripiego e il nome italiano della segnalazione.
    this.categorieStore.carica();
    this.caricaConteggi();
    this.caricaScheda('attive');
  }

  protected salvaDati(): void {
    if (this.formDati.invalid) {
      this.formDati.markAllAsTouched();
      return;
    }
    const { nome, cognome } = this.formDati.getRawValue();
    this.salvataggioDati.set(true);
    this.profiloApi.aggiornaDati({ nome: nome.trim(), cognome: cognome.trim() }).subscribe({
      next: () => {
        this.salvataggioDati.set(false);
        // Riallinea la sessione (nome nell'header e nel menu) con i dati appena salvati.
        this.auth.aggiornaUtente();
        this.toast.successo(this.t('profilo.dati.salvati'));
      },
      error: (err: HttpErrorResponse) => {
        this.salvataggioDati.set(false);
        this.toast.errore(err.error?.messaggio ?? this.t('profilo.dati.errore'));
      },
    });
  }

  protected annullaDati(): void {
    const utente = this.auth.utente();
    if (utente) {
      this.formDati.reset({ nome: utente.nome, cognome: utente.cognome });
    }
  }

  protected cambiaPassword(): void {
    if (this.formPassword.invalid) {
      this.formPassword.markAllAsTouched();
      return;
    }
    const { passwordAttuale, nuovaPassword } = this.formPassword.getRawValue();
    this.salvataggioPassword.set(true);
    this.profiloApi.cambiaPassword({ passwordAttuale, nuovaPassword }).subscribe({
      next: () => {
        this.salvataggioPassword.set(false);
        this.formPassword.reset();
        this.mostraPassword.set(false);
        this.toast.successo(this.t('profilo.password.cambiata'));
      },
      error: (err: HttpErrorResponse) => {
        this.salvataggioPassword.set(false);
        const messaggio: string = err.error?.messaggio ?? this.t('profilo.password.errore');
        // Il backend risponde 400 con un messaggio: lo si mostra sul campo a cui si riferisce.
        if (err.status === 400 && /attuale non/i.test(messaggio)) {
          this.formPassword.controls.passwordAttuale.setErrors({ server: messaggio });
        } else if (err.status === 400) {
          this.formPassword.controls.nuovaPassword.setErrors({ server: messaggio });
        } else {
          this.toast.errore(messaggio);
        }
      },
    });
  }

  protected erroreCampo(
    nome: 'passwordAttuale' | 'nuovaPassword' | 'confermaPassword' | 'nome' | 'cognome',
  ): string | null {
    const controllo =
      nome === 'nome' || nome === 'cognome'
        ? this.formDati.controls[nome]
        : this.formPassword.controls[nome];
    if (
      nome === 'confermaPassword' &&
      controllo.touched &&
      this.formPassword.hasError('nonCoincidenti')
    ) {
      return this.t('profilo.password.nonCoincidenti');
    }
    if (!controllo.touched || controllo.valid) {
      return null;
    }
    if (controllo.hasError('server')) {
      return controllo.getError('server');
    }
    if (controllo.hasError('minlength')) {
      return this.t('profilo.password.troppoCorta');
    }
    return this.t('profilo.obbligatorio');
  }

  protected async rimuovi(segnalazione: Segnalazione): Promise<void> {
    const valori = await this.dialoghi.chiedi({
      titolo: this.t('profilo.segnalazioni.rimuovi.titolo'),
      messaggio: this.t('profilo.segnalazioni.rimuovi.messaggio'),
      conferma: this.t('profilo.segnalazioni.rimuovi.conferma'),
      pericolo: true,
      campi: [
        {
          nome: 'motivazione',
          etichetta: this.t('profilo.segnalazioni.rimuovi.motivazione'),
          tipo: 'textarea',
        },
      ],
    });
    if (!valori) {
      return;
    }
    this.segnalazioneApi
      .rimuovi(segnalazione.id, { motivazione: valori['motivazione'] ?? '' })
      .subscribe({
        next: () => {
          this.toast.successo(this.t('profilo.segnalazioni.rimuovi.fatto'));
          this.ricaricaSegnalazioni();
        },
        error: (err: HttpErrorResponse) =>
          this.toast.errore(err.error?.messaggio ?? this.t('profilo.segnalazioni.rimuovi.errore')),
      });
  }

  /** Riprova dopo un errore o dopo una modifica: riparte dalla prima pagina della scheda aperta. */
  protected caricaSegnalazioni(): void {
    this.caricaScheda(this.scheda(), true);
  }

  /** Dopo una rimozione cambiano entrambe le schede e i contatori: si riparte da zero. */
  private ricaricaSegnalazioni(): void {
    this.elenchi.set({ attive: elencoVuoto(), concluse: elencoVuoto() });
    this.caricaConteggi();
    this.caricaScheda(this.scheda(), true);
  }

  /** Scorrendo verso il fondo dell'elenco si caricano le voci successive. */
  protected alScroll(evento: Event): void {
    const riquadro = evento.target as HTMLElement;
    const vicinoAlFondo =
      riquadro.scrollTop + riquadro.clientHeight >= riquadro.scrollHeight - SOGLIA_CARICAMENTO_PX;
    // Dopo un errore non si riprova da soli a ogni scroll: c'è il pulsante.
    if (vicinoAlFondo && !this.statoScheda().errore) {
      this.caricaAltre();
    }
  }

  protected caricaAltre(): void {
    const scheda = this.scheda();
    const elenco = this.elenchi()[scheda];
    // Niente da chiedere se sta già caricando o se le voci sono tutte arrivate; dopo un errore
    // la pagina che mancava si richiede con lo stesso metodo.
    if (elenco.caricando || elenco.voci.length >= elenco.totale) {
      return;
    }
    this.caricaScheda(scheda);
  }

  private caricaConteggi(): void {
    this.segnalazioneApi.conteggiMie().subscribe({
      next: (conteggi) => this.conteggi.set(conteggi),
      // I contatori sono un'informazione di contorno: se mancano si vedono gli ultimi noti.
      error: () => undefined,
    });
  }

  private aggiornaElenco(scheda: Scheda, modifiche: Partial<ElencoScheda>): void {
    this.elenchi.update((elenchi) => ({
      ...elenchi,
      [scheda]: { ...elenchi[scheda], ...modifiche },
    }));
  }

  /** Carica una pagina della scheda (la prima se `ricomincia`) e la aggiunge in coda alle voci. */
  private caricaScheda(scheda: Scheda, ricomincia = false): void {
    if (ricomincia) {
      this.aggiornaElenco(scheda, { ...elencoVuoto() });
    }
    const pagina = this.elenchi()[scheda].prossimaPagina;
    const generazione = ++this.generazione[scheda];
    this.aggiornaElenco(scheda, { caricando: true, errore: false });
    this.segnalazioneApi
      .mie(scheda === 'attive' ? 'ATTIVE' : 'CONCLUSE', pagina, DIMENSIONE_PAGINA_SEGNALAZIONI)
      .subscribe({
        next: (risposta) => {
          if (generazione !== this.generazione[scheda]) {
            return;
          }
          const presenti = this.elenchi()[scheda].voci;
          const nuove = risposta.contenuto.filter((s) => !presenti.some((p) => p.id === s.id));
          this.aggiornaElenco(scheda, {
            voci: [...presenti, ...nuove],
            totale: risposta.totaleElementi,
            prossimaPagina: pagina + 1,
            caricato: true,
            caricando: false,
          });
        },
        error: () => {
          if (generazione === this.generazione[scheda]) {
            this.aggiornaElenco(scheda, { caricando: false, errore: true });
          }
        },
      });
  }

  protected icona(categoriaId: number): string {
    const nome = this.categorieStore.perId().get(categoriaId)?.icona;
    return nome && NOMI_ICONE_DISPONIBILI.includes(nome) ? nome : NOME_ICONA_FALLBACK;
  }

  protected data(iso: string): string {
    return formattaData(iso, this.transloco.getActiveLang());
  }

  protected tempoFa(iso: string): string {
    return formattaTempoFa(iso, this.transloco.getActiveLang());
  }

  protected meseAnno(iso: string): string {
    return new Intl.DateTimeFormat(this.transloco.getActiveLang(), {
      month: 'long',
      year: 'numeric',
    }).format(new Date(iso));
  }

  private t(chiave: string): string {
    return this.transloco.translate(chiave);
  }
}
