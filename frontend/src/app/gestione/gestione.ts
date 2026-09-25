import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';

interface VoceGestione {
  percorso: string;
  icona: string;
  titolo: string;
  descrizione: string;
}

@Component({
  selector: 'app-gestione',
  standalone: true,
  imports: [RouterLink, LucideDynamicIcon],
  templateUrl: './gestione.html',
})
export class Gestione {
  protected readonly voci: readonly VoceGestione[] = [
    {
      percorso: '/gestione/categorie',
      icona: 'shield-alert',
      titolo: 'Categorie',
      descrizione: 'Crea e modifica le categorie di segnalazione, con icona e durata di validità.',
    },
    {
      percorso: '/gestione/utenti',
      icona: 'users',
      titolo: 'Utenti',
      descrizione: 'Gestisci gli account: dati anagrafici, stato attivo/disattivo, eliminazione.',
    },
    {
      percorso: '/gestione/segnalazioni',
      icona: 'siren',
      titolo: 'Segnalazioni',
      descrizione: 'Crea segnalazioni e gestisci le transizioni di stato (rimuovi/riattiva).',
    },
  ];
}
