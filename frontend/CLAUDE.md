# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This directory (`frontend/`) is one part of the `Crime-app/` repo, versioned independently from its siblings:

- `frontend/` — Angular 22 standalone app (this directory).
- `../backend/` — Spring Boot 4.1.1 REST API (Java 21); see `../backend/CLAUDE.md`.
- `../docker-compose.yml` — local PostGIS database + pgAdmin, needed to run the backend.

Crime lets users report observable public-safety events ("segnalazioni") on a map, scoped by category, with automatic expiry and abuse-based moderation.

## Commands

```bash
ng serve      # dev server on localhost:4200
ng build      # production build to dist/
ng test       # unit tests via Vitest
```

For `ng serve` to work end-to-end, the backend must be running separately on `localhost:8080` (`../backend`, which itself needs the PostGIS container from `docker compose up -d db` at the repo root) — the dev API URL is hardcoded in `src/environments/environment.ts`, not proxied.

There is no lint script or ESLint config in this project; formatting is via Prettier (`.prettierrc`: `printWidth: 100`, single quotes, Angular parser for `.html` templates).

## Architecture

Angular 22, standalone components (no NgModules). Routes are declared flat in `src/app/app.routes.ts`; every page except the landing `Home` is lazy (`loadComponent`), so new pages should be added the same way to keep the initial bundle small; global providers (router, `HttpClient`, Lucide icon set) are wired in `src/app/app.config.ts`.

Feature folders under `src/app/` mirror backend resources (e.g. `categorie/`) and follow this pattern:
- An injectable `*Api` service (`providedIn: 'root'`) wrapping `HttpClient` calls against `${environment.apiUrl}/<resource>`.
- A component using Angular `signal()`s for local state (no NgRx or other store).
- `ReactiveFormsModule` for forms.

`categorie/` is the reference implementation for adding a new CRUD feature — follow `categoria-api.ts` / `categorie.ts` / `categorie.html` as the template.

Category names come from the DB, not from the Transloco JSON files: `Categoria.traduzioni` holds the non-Italian names. Public pages read categories from `CategorieStore` (`categorie/categorie-store.ts`, loaded once, also maps icons) and display names with the `nomeCategoria` pipe (`{{ categoria | nomeCategoria }}` or `{{ segnalazione | nomeCategoria }}`, resolved via `categoriaId`) or `nomeCategoria(categoria, lingua)` inside `computed`s, using `LinguaService.attiva()` (`shared/lingua.ts`) so they react to language changes. Never render `categoria.nome` / `segnalazione.categoriaNome` directly on user-facing pages. The admin form shows one translation row per language in Transloco's `availableLangs` except `it`.

Shared domain types live in `src/app/models/`: one file per entity, mirroring the backend JPA entities, plus a barrel `index.ts` that re-exports them all. `src/environments/environment.ts` / `environment.production.ts` hold `apiUrl` (`http://localhost:8080/api` in dev, `/api` in production, swapped via `fileReplacements` in `angular.json`).

Authentication (`src/app/auth/`): `AuthService` holds the session (JWT + user) in signals — `utente()`, `autenticato()`, `isAdmin()` — persisted in `localStorage` and discarded at startup if the token is expired. `authInterceptor` (registered in `app.config.ts` before the logging one) adds `Authorization: Bearer` to calls to `environment.apiUrl` and, on a 401 for a request sent with a token, logs out and redirects to `/login?redirect=...`. Route guards: `paginaInizialeGuard` on `/` sends logged-in users straight to `/mappa` (guests see the landing page), `adminGuard` protects `gestione/**`, `autenticatoGuard` is available for pages that require login, `ospiteGuard` keeps logged-in users off `/login` and `/registrati`. The map is public: publishing and voting call `verificaLogin()` in `mappa.ts`. `Nav` calls `AuthService.aggiornaUtente()` at startup to refresh the stored user (e.g. a role changed after login). Admins promote/demote users from `gestione/utenti`; demoting yourself logs you out. Never send user ids in payloads — the backend derives the acting user from the token. `/profilo` (`autenticatoGuard`) lets users edit their own name/password via `PUT /api/utenti/me` and `PATCH /api/utenti/me/password` and lists their reports (`GET /api/segnalazioni?mie=true`); the map opens a report from `/mappa?segnalazione=<id>`. Business-rule errors on authenticated calls (e.g. wrong current password) must be 400, never 401: `authInterceptor` treats any 401 as an expired session and logs out.

Logging: use `LoggerService` (`src/app/shared/logger.ts`, `debug`/`info`/`warn`/`error`) instead of calling `console.*` directly. The minimum level comes from `environment.logLevel` (`debug` in dev, `warn` in production). Unhandled errors are routed to it by `LoggerErrorHandler` and failed HTTP calls by `httpLoggingInterceptor`, both registered in `app.config.ts`, so API services don't need to log errors themselves.

Admin tables (`categorie/`, `gestione/segnalazioni/`, `gestione/utenti/`) all work the same way and share `src/app/shared/tabella/`: `th[appOrdinabile]` for sortable headers, `<app-paginazione>`, a filter row of `.filtro-tabella` inputs, and a `TabellaRemota` holding filters, sort and page. Filtering, sorting and pagination always happen in the backend, even for small tables, through `GET /api/{categorie,segnalazioni,utenti}/gestione` (admin only; params `pagina`, `dimensione` ≤ 100, `ordina=campo,asc|desc` plus one param per filter; response `Pagina<T>`). New admin tables should follow the same pattern rather than paginating in the browser. Sortable fields are a backend whitelist (`ORDINABILI_GESTIONE` in the services): a new sortable column needs an entry there, otherwise the backend answers 400. Categories are sorted by gravity 3 → 1, then name, both in `/gestione` and in the plain `GET /api/categorie` used by the map; after editing categories the page calls `CategorieStore.ricarica()` so the map sees the changes.

Feedback UI: never use the browser's `confirm()`/`prompt()`/`alert()`. Use `DialoghiService` (`src/app/shared/dialoghi/dialoghi.ts`) — `await conferma({ titolo, messaggio, conferma, pericolo })` returns a boolean, `await chiedi({ titolo, campi })` returns the field values or `null` — and `ToastService` (`src/app/shared/toast/toast.ts`) — `successo`/`errore`/`info(messaggio)`. Both render through single components mounted in `app.html` (`<app-dialogo />`, `<app-contenitore-toast />`); callers just inject the service.

Domain naming is Italian throughout (component/service names, form fields, model properties) to match the backend — keep new code consistent with this rather than mixing in English names.

### Notable libraries

- `@bluehalo/ngx-leaflet` + `leaflet` power the map view (`mappa/`). Leaflet's default marker icons are re-pointed to static assets copied from `public/assets/leaflet` (see `angular.json` → `assets` and the icon setup at the top of `mappa/mappa.ts`) because the bundler doesn't resolve Leaflet's CSS-relative icon paths.
- `@lucide/angular` provides icons. A Lucide icon component must be imported and added to `ICONE_CATEGORIA_DISPONIBILI` in `src/app/shared/icone-categoria.ts`, which is spread into `provideLucideIcons(...)` in `app.config.ts`, before it can be referenced elsewhere by its kebab-case name (e.g. a category's `icona` field, resolved via `LucideDynamicIcon`). `NOME_ICONA_FALLBACK` (`circle-help`) is used whenever a stored icon name doesn't match a registered one.
- Tailwind CSS v4 (via `@tailwindcss/postcss`), configured in `src/tailwind.css` and `.postcssrc.json`.
