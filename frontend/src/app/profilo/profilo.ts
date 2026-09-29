import { NgClass } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
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
import { TemaMappa, TemaService } from '../shared/tema';
import { ToastService } from '../shared/toast/toast';
import { ProfiloApi } from './profilo-api';

type Scheda = 'attive' | 'concluse';

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

  /** Tema dello sfondo della mappa: segue l'app oppure resta fisso chiaro/scuro. */
  protected readonly opzioniTemaMappa: { valore: TemaMappa; icona: string }[] = [
    { valore: 'auto', icona: 'sun-moon' },
    { valore: 'chiaro', icona: 'sun' },
    { valore: 'scuro', icona: 'moon' },
  ];

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
  protected readonly segnalazioni = signal<Segnalazione[]>([]);
  protected readonly caricamentoSegnalazioni = signal(true);
  protected readonly erroreSegnalazioni = signal(false);
  protected readonly scheda = signal<Scheda>('attive');
  private readonly categorieStore = inject(CategorieStore);

  protected readonly attive = computed(() =>
    this.ordinaPerData(this.segnalazioni().filter((s) => s.stato === StatoSegnalazione.ATTIVA)),
  );
  protected readonly concluse = computed(() =>
    this.ordinaPerData(this.segnalazioni().filter((s) => s.stato !== StatoSegnalazione.ATTIVA)),
  );
  protected readonly elencoScheda = computed(() =>
    this.scheda() === 'attive' ? this.attive() : this.concluse(),
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
    this.caricaSegnalazioni();
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
          this.caricaSegnalazioni();
        },
        error: (err: HttpErrorResponse) =>
          this.toast.errore(err.error?.messaggio ?? this.t('profilo.segnalazioni.rimuovi.errore')),
      });
  }

  protected caricaSegnalazioni(): void {
    this.caricamentoSegnalazioni.set(true);
    this.erroreSegnalazioni.set(false);
    this.segnalazioneApi.elenca({ mie: true }).subscribe({
      next: (segnalazioni) => {
        this.segnalazioni.set(segnalazioni);
        this.caricamentoSegnalazioni.set(false);
      },
      error: () => {
        this.erroreSegnalazioni.set(true);
        this.caricamentoSegnalazioni.set(false);
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

  private ordinaPerData(elenco: Segnalazione[]): Segnalazione[] {
    return [...elenco].sort((a, b) => b.dataCreazione.localeCompare(a.dataCreazione));
  }

  private t(chiave: string): string {
    return this.transloco.translate(chiave);
  }
}
