import { NgClass } from '@angular/common';
import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';
import { LatLng } from 'leaflet';
import { nomeCategoria } from '../categorie/categoria-i18n';
import { SegnalazioneApi } from '../gestione/segnalazioni/segnalazione-api';
import { Categoria } from '../models/categoria.model';
import { Segnalazione } from '../models/segnalazione.model';
import { Violazione } from '../models/segnalazione-abuso.model';
import { classePallinoGravita } from '../shared/gravita';
import { LinguaService } from '../shared/lingua';
import { NOME_ICONA_FALLBACK, NOMI_ICONE_DISPONIBILI } from '../shared/icone-categoria';

const LUNGHEZZA_MASSIMA_DESCRIZIONE = 2000;
/** Stessa soglia del backend (ValidatoreDescrizione), sul testo senza spazi ai bordi. */
const LUNGHEZZA_MINIMA_DESCRIZIONE = 10;

function descrizioneAbbastanzaLunga(controllo: AbstractControl<string>): ValidationErrors | null {
  return controllo.value.trim().length >= LUNGHEZZA_MINIMA_DESCRIZIONE
    ? null
    : { troppoCorta: true };
}
const SOGLIA_CHIUSURA_PX = 60;

function normalizza(testo: string): string {
  return testo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * Form di nuova segnalazione. La posizione non è un campo: arriva dal pin trascinabile che
 * la pagina mappa mostra mentre il form è aperto (input `posizione`).
 */
@Component({
  selector: 'app-nuova-segnalazione',
  standalone: true,
  imports: [ReactiveFormsModule, TranslocoDirective, LucideDynamicIcon, NgClass],
  templateUrl: './nuova-segnalazione.html',
})
export class NuovaSegnalazione {
  readonly categorie = input.required<Categoria[]>();
  readonly posizione = input.required<LatLng>();
  readonly annulla = output<void>();
  readonly pubblicata = output<Segnalazione>();
  /** Torna al passo di scelta del punto; il form resta montato e conserva i dati inseriti. */
  readonly cambiaPosizione = output<void>();

  private readonly lingua = inject(LinguaService);

  /** Prima le più gravi (contro la persona), poi per nome: le urgenze si trovano subito. */
  protected readonly categorieOrdinate = computed(() => {
    const lingua = this.lingua.attiva();
    return this.categorie()
      .map((categoria) => ({ ...categoria, nome: nomeCategoria(categoria, lingua) }))
      .sort((a, b) => b.gravita - a.gravita || a.nome.localeCompare(b.nome, lingua));
  });
  protected readonly classePallinoGravita = classePallinoGravita;

  /** Testo cercato nell'elenco categorie e visibilità dell'elenco (chiuso una volta scelta). */
  protected readonly ricerca = signal('');
  protected readonly elencoAperto = signal(true);
  private readonly campoRicerca = viewChild<ElementRef<HTMLInputElement>>('campoRicerca');

  /** Filtro senza maiuscole né accenti sul nome già tradotto nella lingua attiva. */
  protected readonly categorieFiltrate = computed(() => {
    const testo = normalizza(this.ricerca());
    return this.categorieOrdinate().filter((categoria) =>
      normalizza(categoria.nome).includes(testo),
    );
  });

  protected readonly lunghezzaMassima = LUNGHEZZA_MASSIMA_DESCRIZIONE;
  protected readonly invio = signal(false);
  protected readonly errore = signal(false);
  /** Chiusura richiesta con dati già inseriti: si chiede conferma prima di scartarli. */
  protected readonly confermaScarto = signal(false);
  /** Spostamento verso il basso (px) mentre si trascina la maniglia su mobile. */
  protected readonly spostamento = signal(0);
  private inizioTrascinamentoY: number | null = null;

  private readonly pannello = viewChild<ElementRef<HTMLElement>>('pannello');
  private readonly bottoneContinua = viewChild<ElementRef<HTMLButtonElement>>('continua');
  private readonly injector = inject(Injector);

  private readonly segnalazioneApi = inject(SegnalazioneApi);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    categoriaId: [0, Validators.min(1)],
    descrizione: [
      '',
      [descrizioneAbbastanzaLunga, Validators.maxLength(LUNGHEZZA_MASSIMA_DESCRIZIONE)],
    ],
    anonima: [false],
  });

  private readonly categoriaId = toSignal(this.form.controls.categoriaId.valueChanges, {
    initialValue: 0,
  });
  protected readonly categoriaScelta = computed(() =>
    this.categorieOrdinate().find((categoria) => categoria.id === this.categoriaId()),
  );

  private readonly descrizione = toSignal(this.form.controls.descrizione.valueChanges, {
    initialValue: '',
  });
  protected readonly caratteriUsati = computed(() => this.descrizione().length);

  /**
   * Controlli di moderazione non superati (risposta 400 del backend), mostrati sotto il campo
   * con il frammento da correggere. Si azzerano appena l'utente modifica il testo.
   */
  protected readonly violazioni = signal<Violazione[]>([]);

  constructor() {
    effect(() => {
      this.descrizione();
      this.violazioni.set([]);
    });
  }

  /**
   * Chiusura "morbida" (tocco sulla mappa, Esc, X, maniglia): se non c'è nulla da perdere chiude
   * subito, altrimenti chiede conferma dentro il pannello invece di scartare il testo scritto.
   */
  richiediChiusura(): void {
    if (this.invio()) {
      return;
    }
    if (!this.haDati()) {
      this.annulla.emit();
      return;
    }
    this.confermaScarto.set(true);
    afterNextRender(
      () => {
        this.pannello()?.nativeElement.scrollTo({ top: 0 });
        this.bottoneContinua()?.nativeElement.focus();
      },
      { injector: this.injector },
    );
  }

  /** Categoria scelta o descrizione scritta: chiudere farebbe perdere qualcosa. */
  haDati(): boolean {
    const { categoriaId, descrizione } = this.form.getRawValue();
    return categoriaId !== 0 || descrizione.trim() !== '';
  }

  protected continuaAScrivere(): void {
    this.confermaScarto.set(false);
  }

  // Maniglia su mobile: trascinando in giù oltre la soglia si chiede di chiudere il form.
  protected iniziaTrascinamento(evento: PointerEvent): void {
    this.inizioTrascinamentoY = evento.clientY;
    (evento.currentTarget as HTMLElement).setPointerCapture(evento.pointerId);
  }

  protected trascina(evento: PointerEvent): void {
    if (this.inizioTrascinamentoY !== null) {
      this.spostamento.set(Math.max(0, evento.clientY - this.inizioTrascinamentoY));
    }
  }

  protected terminaTrascinamento(evento: PointerEvent): void {
    if (this.inizioTrascinamentoY === null) {
      return;
    }
    const delta = evento.clientY - this.inizioTrascinamentoY;
    this.inizioTrascinamentoY = null;
    this.spostamento.set(0);
    if (delta > SOGLIA_CHIUSURA_PX) {
      this.richiediChiusura();
    }
  }

  protected scegliCategoria(id: number): void {
    this.form.controls.categoriaId.setValue(id);
    this.form.controls.categoriaId.markAsTouched();
    this.elencoAperto.set(false);
    this.ricerca.set('');
  }

  /** Invio nel campo di ricerca sceglie il primo risultato (senza inviare il form). */
  protected scegliPrimaCategoria(evento: Event): void {
    evento.preventDefault();
    const prima = this.categorieFiltrate()[0];
    if (prima) {
      this.scegliCategoria(prima.id);
    }
  }

  protected cambiaCategoria(): void {
    this.elencoAperto.set(true);
    afterNextRender(() => this.campoRicerca()?.nativeElement.focus(), { injector: this.injector });
  }

  protected iconaCategoria(nome: string | undefined): string {
    return nome && NOMI_ICONE_DISPONIBILI.includes(nome) ? nome : NOME_ICONA_FALLBACK;
  }

  protected pubblica(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { categoriaId, descrizione, anonima } = this.form.getRawValue();
    const { lat, lng } = this.posizione();
    this.invio.set(true);
    this.errore.set(false);
    this.violazioni.set([]);
    this.segnalazioneApi
      .crea({
        categoriaId,
        descrizione: descrizione.trim(),
        lat,
        lng,
        anonima,
      })
      .subscribe({
        next: (segnalazione) => {
          this.invio.set(false);
          this.pubblicata.emit(segnalazione);
        },
        error: (err: HttpErrorResponse) => {
          this.invio.set(false);
          const violazioni: Violazione[] | undefined = err.error?.violazioni;
          if (err.status === 400 && violazioni?.length) {
            this.violazioni.set(violazioni);
            return;
          }
          this.errore.set(true);
        },
      });
  }
}
