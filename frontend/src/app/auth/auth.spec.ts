import { tokenScaduto } from './auth';
import { destinazioneSicura } from './login';

/** JWT non firmato con il solo payload indicato: tokenScaduto non verifica la firma. */
function tokenCon(payload: object): string {
  const base64Url = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `header.${base64Url}.firma`;
}

describe('tokenScaduto', () => {
  it('considera valido un token con exp nel futuro', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    expect(tokenScaduto(tokenCon({ sub: '1', exp }))).toBe(false);
  });

  it('considera scaduto un token con exp nel passato', () => {
    const exp = Math.floor(Date.now() / 1000) - 60;
    expect(tokenScaduto(tokenCon({ sub: '1', exp }))).toBe(true);
  });

  it('considera scaduto un token senza exp o malformato', () => {
    expect(tokenScaduto(tokenCon({ sub: '1' }))).toBe(true);
    expect(tokenScaduto('non-un-jwt')).toBe(true);
  });
});

describe('destinazioneSicura', () => {
  it('accetta i percorsi interni', () => {
    expect(destinazioneSicura('/gestione/categorie')).toBe('/gestione/categorie');
  });

  it('ripiega sulla mappa per valori assenti o esterni', () => {
    expect(destinazioneSicura(null)).toBe('/mappa');
    expect(destinazioneSicura('https://esempio.it')).toBe('/mappa');
    expect(destinazioneSicura('//esempio.it')).toBe('/mappa');
  });
});
