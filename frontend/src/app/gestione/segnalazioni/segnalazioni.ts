import { DecimalPipe, SlicePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { CategoriaApi } from '../../categorie/categoria-api';
import { Categoria } from '../../models/categoria.model';
import { Segnalazione, StatoSegnalazione } from '../../models/segnalazione.model';
import {
  EsitoAbuso,
  MotivoAbuso,
  SegnalazioneAbuso,
  TipoViolazione,
  Violazione,
} from '../../models/segnalazione-abuso.model';
import {
  FiltriGestioneSegnalazioni,
  SegnalazioneApi,
  SegnalazioneRequest,
  SegnalazioneTransizioneRequest,
} from './segnalazione-api';
import { IntestazioneOrdinabile } from '../../shared/tabella/intestazione-ordinabile';
import { IndicatoreCaricamento } from '../../shared/tabella/indicatore-caricamento';
import { Paginazione } from '../../shared/tabella/paginazione';
import { TabellaRemota } from '../../shared/tabella/tabella';
import { DialoghiService } from '../../shared/dialoghi/dialoghi';
import { ToastService } from '../../shared/toast/toast';

@Component({
  selector: 'app-segnalazioni',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    SlicePipe,
    DecimalPipe,
    IntestazioneOrdinabile,
    Paginazione,
    IndicatoreCaricamento,
  ],
  templateUrl: './segnalazioni.html',
})
export class Segnalazioni implements OnInit {
  private readonly segnalazioneApi = inject(SegnalazioneApi);
  private readonly categoriaApi = inject(CategoriaApi);
  private readonly fb = inject(FormBuilder);
  private readonly dialoghi = inject(DialoghiService);
  private readonly toast = inject(ToastService);

  protected readonly StatoSegnalazione = StatoSegnalazione;
  protected readonly stati = [
    { valore: StatoSegnalazione.ATTIVA, etichetta: 'Attiva' },
    { valore: StatoSegnalazione.SCADUTA, etichetta: 'Scaduta' },
    { valore: StatoSegnalazione.SOSPESA, etichetta: 'Sospesa' },
    { valore: StatoSegnalazione.RIMOSSA, etichetta: 'Rimossa' },
  ];

  protected readonly revisioni = [
    { valore: 'DA_RIVEDERE', etichetta: 'Da rivedere' },
    { valore: 'CON_ABUSI', etichetta: 'Con abusi' },
    { valore: 'AUTOMATICA', etichetta: 'Controlli automatici' },
  ];
  protected readonly motivi: Record<MotivoAbuso, string> = {
    FALSA: 'Falsa o non più vera',
    OFFENSIVA: 'Offensiva o discriminatoria',
    DATI_PERSONALI: 'Dati personali',
    SPAM: 'Spam',
    CATEGORIA_ERRATA: 'Categoria sbagliata',
    ALTRO: 'Altro',
  };
  /** Controlli soft che mettono una segnalazione in coda alla creazione. */
  private readonly controlliAutomatici: Partial<Record<TipoViolazione, string>> = {
    MAIUSCOLE: 'tutto maiuscolo',
    RIPETIZIONI: 'ripetizioni',
  };

  protected readonly categorie = signal<Categoria[]>([]);
  /** Quante segnalazioni sono in coda "da rivedere" (contatore accanto al titolo). */
  protected readonly daRivedere = signal<number | null>(null);
  /** Riga con il pannello di revisione aperto e i suoi abusi (null mentre si caricano). */
  protected readonly revisioneAperta = signal<number | null>(null);
  protected readonly abusiRevisione = signal<SegnalazioneAbuso[] | null>(null);
  protected readonly errore = signal<string | null>(null);

  /** Paginata, filtrata e ordinata dal backend; di default le più recenti in alto. */
  protected readonly tabella = new TabellaRemota<FiltriGestioneSegnalazioni, Segnalazione>(
    (richiesta) => this.segnalazioneApi.pagina(richiesta),
    {
      id: '',
      categoriaId: '',
      anonima: '',
      stato: '',
      creataDal: '',
      creataAl: '',
      scadeDal: '',
      scadeAl: '',
      revisione: '',
    },
    { campo: 'dataCreazione', direzione: 'desc' },
  );
  protected readonly erroreTabella = computed(() => {
    const err = this.tabella.errore();
    return err ? this.estraiMessaggio(err) : null;
  });

  protected readonly form = this.fb.nonNullable.group({
    categoriaId: this.fb.control<number | null>(null, Validators.required),
    descrizione: ['', Validators.required],
    lat: [0, Validators.required],
    lng: [0, Validators.required],
    anonima: [false],
  });

  ngOnInit(): void {
    this.categoriaApi.elenca().subscribe({ next: (categorie) => this.categorie.set(categorie) });
    this.aggiornaContatore();
  }

  private aggiornaContatore(): void {
    this.segnalazioneApi.contaDaRivedere().subscribe({ next: (n) => this.daRivedere.set(n) });
  }

  /** Dopo un'azione: la tabella e il contatore della coda cambiano insieme. */
  private aggiornaTutto(): void {
    this.tabella.aggiorna();
    this.aggiornaContatore();
  }

  /** Mostra solo la coda (filtro "Da rivedere"), dalla più segnalata. */
  protected mostraCoda(): void {
    this.tabella.filtra('revisione', 'DA_RIVEDERE');
    this.tabella.ordinamento.set({ campo: 'pesoAbusi', direzione: 'desc' });
  }

  protected descriviControlli(codici: string | null | undefined): string {
    return (codici ?? '')
      .split(',')
      .filter(Boolean)
      .map((codice) => this.controlliAutomatici[codice as TipoViolazione] ?? codice)
      .join(', ');
  }

  /** Apre (o chiude) sotto la riga l'elenco degli abusi con le due decisioni possibili. */
  protected apriRevisione(segnalazione: Segnalazione): void {
    if (this.revisioneAperta() === segnalazione.id) {
      this.revisioneAperta.set(null);
      return;
    }
    this.revisioneAperta.set(segnalazione.id);
    this.abusiRevisione.set(null);
    this.segnalazioneApi.abusi(segnalazione.id).subscribe({
      next: (abusi) => {
        if (this.revisioneAperta() === segnalazione.id) {
          this.abusiRevisione.set(abusi);
        }
      },
      error: (err: HttpErrorResponse) => this.errore.set(this.estraiMessaggio(err)),
    });
  }

  /**
   * FONDATO: la segnalazione viene rimossa (se ancora attiva o sospesa), i segnalanti guadagnano
   * fiducia e l'autore la perde. INFONDATO: resta (o torna) attiva e i segnalanti perdono fiducia.
   */
  protected async decidi(segnalazione: Segnalazione, esito: EsitoAbuso): Promise<void> {
    const fondato = esito === 'FONDATO';
    const inCorso =
      segnalazione.stato === StatoSegnalazione.ATTIVA ||
      segnalazione.stato === StatoSegnalazione.SOSPESA;
    const abusi = segnalazione.numeroAbusi ?? 0;
    const effetti = fondato
      ? [
          inCorso ? 'La segnalazione verrà rimossa.' : 'La segnalazione è già conclusa.',
          "L'autore perderà fiducia.",
          abusi > 0 ? `Chi l'ha segnalata (${abusi}) ne guadagnerà.` : '',
        ]
      : [
          segnalazione.stato === StatoSegnalazione.SOSPESA
            ? 'La segnalazione tornerà attiva.'
            : "La segnalazione resta com'è e esce dalla coda.",
          abusi > 0 ? `Chi l'ha segnalata (${abusi}) perderà fiducia.` : '',
        ];
    const valori = await this.dialoghi.chiedi({
      titolo: fondato ? 'Accogliere gli abusi?' : 'Respingere gli abusi?',
      messaggio: effetti.filter(Boolean).join(' '),
      conferma: fondato ? (inCorso ? 'Accogli e rimuovi' : 'Accogli') : 'Respingi',
      pericolo: fondato,
      campi: [{ nome: 'motivazione', etichetta: 'Motivazione (facoltativa)', tipo: 'textarea' }],
    });
    if (!valori) {
      return;
    }
    const motivazione = valori['motivazione']?.trim() || null;
    this.errore.set(null);
    this.segnalazioneApi.decidiRevisione(segnalazione.id, { esito, motivazione }).subscribe({
      next: () => {
        this.toast.successo(fondato ? 'Abusi accolti.' : 'Abusi respinti.');
        this.revisioneAperta.set(null);
        this.aggiornaTutto();
      },
      error: (err: HttpErrorResponse) => {
        this.errore.set(this.estraiMessaggio(err));
        this.toast.errore('Non siamo riusciti a registrare la decisione.');
      },
    });
  }

  protected inviaForm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const valori = this.form.getRawValue();
    const payload: SegnalazioneRequest = {
      categoriaId: valori.categoriaId!,
      descrizione: valori.descrizione,
      lat: valori.lat,
      lng: valori.lng,
      anonima: valori.anonima,
    };
    this.errore.set(null);
    this.segnalazioneApi.crea(payload).subscribe({
      next: () => {
        this.resetForm();
        this.aggiornaTutto();
      },
      error: (err: HttpErrorResponse) => this.errore.set(this.estraiMessaggio(err)),
    });
  }

  protected async rimuovi(segnalazione: Segnalazione): Promise<void> {
    const richiesta = await this.chiediTransizione('Rimuovere la segnalazione?', 'Rimuovi', true);
    if (!richiesta) {
      return;
    }
    this.errore.set(null);
    this.segnalazioneApi.rimuovi(segnalazione.id, richiesta).subscribe({
      next: () => {
        this.toast.successo('Segnalazione rimossa.');
        this.aggiornaTutto();
      },
      error: (err: HttpErrorResponse) => {
        this.errore.set(this.estraiMessaggio(err));
        this.toast.errore('Non siamo riusciti a rimuovere la segnalazione.');
      },
    });
  }

  protected async riattiva(segnalazione: Segnalazione): Promise<void> {
    const richiesta = await this.chiediTransizione('Riattivare la segnalazione?', 'Riattiva');
    if (!richiesta) {
      return;
    }
    this.errore.set(null);
    this.segnalazioneApi.riattiva(segnalazione.id, richiesta).subscribe({
      next: () => {
        this.toast.successo('Segnalazione riattivata.');
        this.aggiornaTutto();
      },
      error: (err: HttpErrorResponse) => {
        this.errore.set(this.estraiMessaggio(err));
        this.toast.errore('Non siamo riusciti a riattivare la segnalazione.');
      },
    });
  }

  /**
   * Cancellazione definitiva dal database (voti, abusi e storico di moderazione compresi).
   * Diversa da "Rimuovi", che cambia solo lo stato: serve ad esempio per poter poi eliminare
   * una categoria, bloccata finché ha segnalazioni.
   */
  protected async elimina(segnalazione: Segnalazione): Promise<void> {
    const confermato = await this.dialoghi.conferma({
      titolo: 'Eliminare definitivamente la segnalazione?',
      messaggio: `"${segnalazione.categoriaNome}" #${segnalazione.id} verrà cancellata dal database insieme a voti, segnalazioni di abuso e storico di moderazione. L'operazione non è reversibile.`,
      conferma: 'Elimina',
      pericolo: true,
    });
    if (!confermato) {
      return;
    }
    this.errore.set(null);
    this.segnalazioneApi.eliminaDefinitivamente(segnalazione.id).subscribe({
      next: () => {
        this.toast.successo('Segnalazione eliminata definitivamente.');
        this.aggiornaTutto();
      },
      error: (err: HttpErrorResponse) => {
        this.errore.set(this.estraiMessaggio(err));
        this.toast.errore('Non siamo riusciti a eliminare la segnalazione.');
      },
    });
  }

  /** L'attore è l'admin autenticato (il backend lo ricava dal token): serve solo il perché. */
  private async chiediTransizione(
    titolo: string,
    conferma: string,
    pericolo = false,
  ): Promise<SegnalazioneTransizioneRequest | null> {
    const valori = await this.dialoghi.chiedi({
      titolo,
      conferma,
      pericolo,
      campi: [
        { nome: 'motivazione', etichetta: 'Motivazione', tipo: 'textarea', obbligatorio: true },
      ],
    });
    return valori ? { motivazione: valori['motivazione'] } : null;
  }

  private resetForm(): void {
    this.form.reset({
      categoriaId: null,
      descrizione: '',
      lat: 0,
      lng: 0,
      anonima: false,
    });
  }

  private estraiMessaggio(err: HttpErrorResponse): string {
    if (err.status === 0) {
      return 'Impossibile contattare il backend: controlla che sia avviato su localhost:8080.';
    }
    // Descrizione bloccata dalla moderazione: si elencano i pezzi di testo da correggere.
    const violazioni: Violazione[] | undefined = err.error?.violazioni;
    if (violazioni?.length) {
      return `${err.error.messaggio} ${violazioni.map((v) => `${v.tipo}: «${v.frammento}»`).join('; ')}`;
    }
    return err.error?.messaggio ?? `Errore ${err.status}: ${err.statusText}`;
  }
}
