import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';
import { LatLng } from 'leaflet';
import { environment } from '../../environments/environment';
import { SegnalazioneApi } from '../gestione/segnalazioni/segnalazione-api';
import { Categoria } from '../models/categoria.model';
import { Segnalazione } from '../models/segnalazione.model';
import { NOME_ICONA_FALLBACK, NOMI_ICONE_DISPONIBILI } from '../shared/icone-categoria';

const LUNGHEZZA_MASSIMA_DESCRIZIONE = 2000;
const SOGLIA_CHIUSURA_PX = 60;

/**
 * Form di nuova segnalazione. La posizione non è un campo: arriva dal pin trascinabile che
 * la pagina mappa mostra mentre il form è aperto (input `posizione`).
 */
@Component({
  selector: 'app-nuova-segnalazione',
  standalone: true,
  imports: [ReactiveFormsModule, TranslocoDirective, LucideDynamicIcon],
  templateUrl: './nuova-segnalazione.html',
})
export class NuovaSegnalazione {
  readonly categorie = input.required<Categoria[]>();
  readonly posizione = input.required<LatLng>();
  /** true finché il pin è ancora sulla posizione GPS dell'utente (non spostato a mano). */
  readonly suPosizioneUtente = input(false);
  /** Se la posizione GPS è nota, il form offre "La mia posizione" per riportarci il pin. */
  readonly posizioneUtenteNota = input(false);

  readonly annulla = output<void>();
  readonly pubblicata = output<Segnalazione>();
  readonly riportaSuUtente = output<void>();

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
    descrizione: ['', [Validators.required, Validators.maxLength(LUNGHEZZA_MASSIMA_DESCRIZIONE)]],
    anonima: [false],
  });

  private readonly descrizione = toSignal(this.form.controls.descrizione.valueChanges, {
    initialValue: '',
  });
  protected readonly caratteriUsati = computed(() => this.descrizione().length);

  /**
   * Chiusura "morbida" (tocco sulla mappa, Esc, X, maniglia): se non c'è nulla da perdere chiude
   * subito, altrimenti chiede conferma dentro il pannello invece di scartare il testo scritto.
   */
  richiediChiusura(): void {
    if (this.invio()) {
      return;
    }
    const { categoriaId, descrizione } = this.form.getRawValue();
    if (categoriaId === 0 && descrizione.trim() === '') {
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
    this.segnalazioneApi
      .crea({
        // Temporaneo, finché non c'è autenticazione: autore = utente di test.
        autoreId: environment.utenteCorrenteId,
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
        error: () => {
          this.invio.set(false);
          this.errore.set(true);
        },
      });
  }
}
