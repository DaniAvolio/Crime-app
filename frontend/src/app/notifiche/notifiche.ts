import { NgClass } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';
import { Subject, debounceTime, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { nomeCategoria } from '../categorie/categoria-i18n';
import { CategorieStore } from '../categorie/categorie-store';
import { GRAVITA, Gravita } from '../models/gravita.model';
import { Notifica, PreferenzeNotifica, ZonaNotifica } from '../models/preferenze-notifica.model';
import { StatoSegnalazione } from '../models/segnalazione.model';
import { DialoghiService } from '../shared/dialoghi/dialoghi';
import { chiaveGravita, classePallinoGravita } from '../shared/gravita';
import { NOME_ICONA_FALLBACK, NOMI_ICONE_DISPONIBILI } from '../shared/icone-categoria';
import { LinguaService } from '../shared/lingua';
import { ToastService } from '../shared/toast/toast';
import { formattaTempoFa } from '../mappa/formattazione';
import { CampanellaService } from './campanella';
import { EditorZone } from './editor-zone';
import { NotificheApi, ZonaNotificaRequest } from './notifiche-api';
import { PushDispositivoService } from './push-dispositivo';

type Scheda = 'avvisi' | 'impostazioni';
const DIMENSIONE_PAGINA = 20;
const SALVATAGGIO_MS = 600;

/**
 * Notifiche dell'utente: avvisi ricevuti (campanella) e impostazioni (push su questo dispositivo,
 * zone, cosa ricevere, ore di silenzio). Le preferenze si salvano da sole a ogni modifica.
 */
@Component({
  selector: 'app-notifiche',
  standalone: true,
  imports: [TranslocoDirective, LucideDynamicIcon, NgClass, EditorZone],
  templateUrl: './notifiche.html',
})
export class Notifiche {
  private readonly api = inject(NotificheApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly lingua = inject(LinguaService);
  private readonly toast = inject(ToastService);
  private readonly dialoghi = inject(DialoghiService);
  private readonly categorieStore = inject(CategorieStore);
  private readonly campanella = inject(CampanellaService);
  protected readonly push = inject(PushDispositivoService);

  protected readonly scheda = signal<Scheda>(
    this.route.snapshot.queryParamMap.get('scheda') === 'impostazioni' ? 'impostazioni' : 'avvisi',
  );

  // ------------------------------------------------------------------ avvisi
  protected readonly avvisi = signal<Notifica[]>([]);
  protected readonly altre = signal(false);
  protected readonly caricandoAvvisi = signal(true);
  protected readonly erroreAvvisi = signal(false);
  private pagina = 0;

  // ------------------------------------------------------------------ impostazioni
  protected readonly zone = signal<ZonaNotifica[]>([]);
  protected readonly zoneCaricate = signal(false);
  protected readonly salvandoZona = signal(false);
  protected readonly preferenze = signal<PreferenzeNotifica | null>(null);
  protected readonly statoSalvataggio = signal<'salvato' | 'errore' | null>(null);
  private readonly daSalvare = new Subject<PreferenzeNotifica>();
  private readonly editor = viewChild(EditorZone);

  protected readonly livelliGravita = [...GRAVITA].reverse();
  protected readonly chiaveGravita = chiaveGravita;
  protected readonly pallino = classePallinoGravita;

  /** Categorie selezionabili: solo quelle con gravità almeno la minima scelta. */
  protected readonly gruppiCategorie = computed(() => {
    const minima = this.preferenze()?.gravitaMinima ?? 3;
    const lingua = this.lingua.attiva();
    return ([3, 2, 1] as Gravita[])
      .filter((g) => g >= minima)
      .map((gravita) => ({
        gravita,
        categorie: this.categorieStore
          .categorie()
          .filter((c) => c.gravita === gravita && c.attiva !== false)
          .map((c) => ({ id: c.id, nome: nomeCategoria(c, lingua) }))
          .sort((a, b) => a.nome.localeCompare(b.nome, lingua)),
      }));
  });

  constructor() {
    this.categorieStore.carica();
    this.caricaAvvisi();
    this.api.zone().subscribe({
      next: (zone) => {
        this.zone.set(zone);
        this.zoneCaricate.set(true);
      },
      error: () => this.zoneCaricate.set(true),
    });
    this.api.preferenze().subscribe({ next: (p) => this.preferenze.set(p) });
    this.push.aggiornaSeAttiva();

    this.daSalvare
      .pipe(
        debounceTime(SALVATAGGIO_MS),
        switchMap((p) => this.api.salvaPreferenze(p)),
        takeUntilDestroyed(),
      )
      .subscribe({
        next: () => this.statoSalvataggio.set('salvato'),
        error: () => this.statoSalvataggio.set('errore'),
      });
  }

  protected apriScheda(scheda: Scheda): void {
    this.scheda.set(scheda);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { scheda: scheda === 'avvisi' ? null : scheda },
      replaceUrl: true,
    });
  }

  // ------------------------------------------------------------------ avvisi
  private caricaAvvisi(): void {
    this.caricandoAvvisi.set(true);
    this.api.notifiche(this.pagina, DIMENSIONE_PAGINA).subscribe({
      next: (p) => {
        this.avvisi.update((a) => [...a, ...p.contenuto]);
        this.altre.set(p.pagina + 1 < p.totalePagine);
        this.caricandoAvvisi.set(false);
      },
      error: () => {
        this.erroreAvvisi.set(true);
        this.caricandoAvvisi.set(false);
      },
    });
  }

  protected caricaAltri(): void {
    this.pagina++;
    this.caricaAvvisi();
  }

  protected testoAvviso(avviso: Notifica): string {
    this.lingua.attiva();
    const categoria = this.categorieStore.perId().get(avviso.categoriaId);
    return this.transloco.translate(`notifiche.avviso.${avviso.tipo}`, {
      categoria: categoria ? nomeCategoria(categoria, this.lingua.attiva()) : '',
      zona: avviso.zonaNome ?? '',
    });
  }

  protected iconaAvviso(avviso: Notifica): string {
    const icona = this.categorieStore.perId().get(avviso.categoriaId)?.icona;
    return icona && NOMI_ICONE_DISPONIBILI.includes(icona) ? icona : NOME_ICONA_FALLBACK;
  }

  protected gravitaAvviso(avviso: Notifica): Gravita {
    return this.categorieStore.perId().get(avviso.categoriaId)?.gravita ?? 1;
  }

  protected tempoFa(iso: string): string {
    return formattaTempoFa(iso, this.lingua.attiva());
  }

  /** Si apre sulla mappa solo se la segnalazione è ancora attiva. */
  protected apribile(avviso: Notifica): boolean {
    return avviso.stato === StatoSegnalazione.ATTIVA;
  }

  protected apri(avviso: Notifica): void {
    this.segnaLetta(avviso);
    if (this.apribile(avviso)) {
      void this.router.navigate(['/mappa'], {
        queryParams: { segnalazione: avviso.segnalazioneId },
      });
    }
  }

  private segnaLetta(avviso: Notifica): void {
    if (avviso.letta) {
      return;
    }
    this.avvisi.update((a) => a.map((x) => (x.id === avviso.id ? { ...x, letta: true } : x)));
    this.api.segnaLetta(avviso.id).subscribe({ next: () => this.campanella.aggiorna() });
  }

  protected readonly nonLette = computed(() => this.avvisi().some((a) => !a.letta));

  protected segnaTutteLette(): void {
    this.avvisi.update((a) => a.map((x) => ({ ...x, letta: true })));
    this.api.segnaTutteLette().subscribe({ next: () => this.campanella.aggiorna() });
  }

  // ------------------------------------------------------------------ push
  protected async attivaPush(): Promise<void> {
    const attivata = await this.push.attiva();
    if (attivata) {
      this.toast.successo(this.transloco.translate('notifiche.dispositivo.attivate'));
    } else if (this.push.stato() !== 'bloccato') {
      this.toast.errore(this.transloco.translate('notifiche.dispositivo.errore'));
    }
  }

  protected async disattivaPush(): Promise<void> {
    await this.push.disattiva();
    this.toast.info(this.transloco.translate('notifiche.dispositivo.disattivate'));
  }

  // ------------------------------------------------------------------ zone
  protected salvaZona(evento: { id: number | null; zona: ZonaNotificaRequest }): void {
    this.salvandoZona.set(true);
    const richiesta =
      evento.id === null
        ? this.api.creaZona(evento.zona)
        : this.api.aggiornaZona(evento.id, evento.zona);
    richiesta.subscribe({
      next: (salvata) => {
        this.zone.update((zone) =>
          evento.id === null
            ? [...zone, salvata]
            : zone.map((z) => (z.id === salvata.id ? salvata : z)),
        );
        this.salvandoZona.set(false);
        this.editor()?.chiudiBozza();
        this.toast.successo(
          this.transloco.translate('notifiche.zone.salvata', { nome: salvata.nome }),
        );
      },
      error: (err: HttpErrorResponse) => {
        this.salvandoZona.set(false);
        this.toast.errore(
          err.error?.messaggio ?? this.transloco.translate('notifiche.zone.errore'),
        );
      },
    });
  }

  protected async eliminaZona(zona: ZonaNotifica): Promise<void> {
    const conferma = await this.dialoghi.conferma({
      titolo: this.transloco.translate('notifiche.zone.eliminaTitolo', { nome: zona.nome }),
      messaggio: this.transloco.translate('notifiche.zone.eliminaMessaggio'),
      conferma: this.transloco.translate('notifiche.zone.elimina'),
      pericolo: true,
    });
    if (!conferma) {
      return;
    }
    this.api.eliminaZona(zona.id).subscribe({
      next: () => this.zone.update((zone) => zone.filter((z) => z.id !== zona.id)),
      error: () => this.toast.errore(this.transloco.translate('notifiche.zone.errore')),
    });
  }

  // ------------------------------------------------------------------ preferenze
  protected modifica(cambi: Partial<PreferenzeNotifica>): void {
    const attuali = this.preferenze();
    if (!attuali) {
      return;
    }
    const nuove = { ...attuali, ...cambi };
    // Alzando la gravità minima, le categorie scelte sotto la soglia non contano più.
    if (cambi.gravitaMinima !== undefined) {
      const perId = this.categorieStore.perId();
      nuove.categorieId = nuove.categorieId.filter(
        (id) => (perId.get(id)?.gravita ?? 0) >= nuove.gravitaMinima,
      );
    }
    this.preferenze.set(nuove);
    this.statoSalvataggio.set(null);
    this.daSalvare.next(nuove);
  }

  protected tutteLeCategorie(): boolean {
    return (this.preferenze()?.categorieId.length ?? 0) === 0;
  }

  protected categoriaScelta(id: number): boolean {
    return this.preferenze()?.categorieId.includes(id) ?? false;
  }

  protected alternaCategoria(id: number): void {
    const scelte = this.preferenze()?.categorieId ?? [];
    this.modifica({
      categorieId: scelte.includes(id) ? scelte.filter((x) => x !== id) : [...scelte, id],
    });
  }

  protected alternaSilenzio(attivo: boolean): void {
    this.modifica(
      attivo
        ? { oreSilenzioDa: '23:00', oreSilenzioA: '07:00' }
        : { oreSilenzioDa: null, oreSilenzioA: null },
    );
  }

  protected oraSilenzio(campo: 'oreSilenzioDa' | 'oreSilenzioA', valore: string): void {
    if (/^\d{2}:\d{2}$/.test(valore)) {
      this.modifica({ [campo]: valore });
    }
  }

  /** "23:00:00" dal backend -> "23:00" per l'input time. */
  protected ora(valore: string | null): string {
    return valore ? valore.slice(0, 5) : '';
  }
}
