# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This is one repo (`Crime-app/`) with three parts, each versioned independently:

- `backend/` — Spring Boot 4.1.1 REST API (Java 21). This is the working directory for this CLAUDE.md.
- `frontend/` — Angular 22 standalone app.
- `docker-compose.yml` (repo root) — local PostGIS database + pgAdmin.

Crime App lets users report observable public-safety events ("segnalazioni") on a map, scoped by category, with automatic expiry and abuse-based moderation.

## Commands

### Backend (run from `backend/`)

```bash
./mvnw spring-boot:run          # start the API (localhost:8080), needs the DB running
./mvnw test                     # run all tests
./mvnw test -Dtest=ClassName    # run a single test class
./mvnw clean package            # build the jar
```

Database (repo root, needed before starting the backend):

```bash
docker compose up -d db         # PostGIS on localhost:5432 (db: crimeapp, user: crimeapp_user)
docker compose up -d pgadmin    # optional, pgAdmin on localhost:5050
```

Schema is managed entirely by Flyway migrations in `src/main/resources/db/migration/`; Hibernate is set to `ddl-auto: validate` (it never generates DDL). Any schema change goes through a new `V{n}__description.sql` migration, and the corresponding JPA entity must be kept in sync or the app fails to start.

### Frontend (run from `frontend/`)

```bash
ng serve      # dev server on localhost:4200, proxies API calls to localhost:8080/api
ng build      # production build to dist/
ng test       # unit tests via Vitest
```

## Backend architecture

Standard layered structure per feature: `entity` → `repository` (Spring Data JPA) → `service` → `mapper` (entity ↔ DTO, manual, no MapStruct) → `controller` (`@RestController`, routes under `/api/...`). DTOs are Java records; entities are never returned directly from controllers. Follow the `Categoria` slice (`entity/Categoria.java`, `repository/CategoriaRepository.java`, `service/CategoriaService.java`, `mapper/CategoriaMapper.java`, `controller/CategoriaController.java`, `dto/CategoriaDto.java` + `CategoriaRequest.java`) as the template for adding new resources.

Domain naming is Italian throughout (entities, fields, endpoints, variables) — match this convention for new code rather than mixing in English names.

Key domain entities (`entity/`):
- `Utente` — user accounts. Activity counters `segnalazioniFatte` / `segnalazioniConfermate` (received a first extending YES from someone other than the author) / `segnalazioniRimosse` (removed by an admin, not withdrawn by the author) are mapped `updatable = false` and only change through the atomic `UtenteRepository.incrementa*` updates, called in `SegnalazioneService.crea`/`rimuovi` and `ConfermaSegnalazioneService.vota`; never set them on the entity. They survive the anonymization of old reports, so per-user statistics don't depend on `segnalazione.autore_id`.
- `Categoria` — a **table**, not an enum, by design: admin-configurable taxonomy of report types without a redeploy. Each category has `durataValiditaOre` (validity duration in hours), used to compute a report's expiry at creation time, and `gravita` (1 = degrado/quiete, yellow; 2 = patrimonio, orange; 3 = contro la persona, red) that drives the marker color and the map's severity filter. A default set of categories is seeded by `V4__gravita_categoria.sql`. `nome`/`descrizione` are in Italian (base and fallback language); other languages live in `categoria_traduzione` (`V5__categoria_traduzione.sql`, one row per category and language code), mapped as the `traduzioni` map on the entity and exposed as `traduzioni: { en: { nome, descrizione } }` in the DTO/request. Adding a language needs no schema change.
- `Segnalazione` — a report: has an author (`autore`; anonymity is display-only via the `anonima` flag; null only once the report has been anonymized, see below — code reading `getAutore()` must handle null), a `Categoria`, a PostGIS `Point` (`posizione`, geography SRID 4326), and a state machine driven by `StatoSegnalazione`: `ATTIVA -> SCADUTA` (scheduled job, expiry per category; or automatic when enough users vote "no longer happening") | `ATTIVA -> SOSPESA` (automatic, abuse threshold reached) | `ATTIVA -> RIMOSSA` (admin or author) | `SOSPESA -> ATTIVA|RIMOSSA` (admin only). There is no blocking human review step before a report goes live: `SegnalazioneService.crea` runs deterministic description checks first (`service/moderazione/ValidatoreDescrizione`), then moderation is reactive (abuse reports and admin decisions).
  Description checks: blocking ones (too short < 10 chars, personal data — phone numbers ≥ 9 digits, emails, Italian plates —, links, offensive language, discriminatory references to origin/ethnicity/religion) make `crea` throw `DescrizioneNonValidaException` → 400 whose `ErrorResponse.violazioni` lists `{ tipo, frammento }` for the client; soft ones (`MAIUSCOLE`, `RIPETIZIONI`) publish the report with `daRivedere = true` and the codes in `revisioneAutomatica`. Word lists live in `src/main/resources/moderazione/<lang>.txt` (sections `[offensivo]` / `[discriminazione]`, trailing `*` = prefix, multi-word = phrase), all files apply to every text, so adding a language means adding a file; matching is whole-word on a normalized copy (lowercase, no accents, common leetspeak, repeated letters collapsed). Before adding a prefix entry, check it doesn't hit common words (`ValidatoreDescrizioneTest` has a list of texts that must pass).
  History retention: `SegnalazioneAnonimizzazioneJob` (cron `crimeapp.segnalazioni.anonimizzazione.cron`, nightly) anonymizes reports closed (`SCADUTA`/`RIMOSSA`, by `COALESCE(data_rimozione, data_scadenza)`) more than `anonimizzazione.mesi` (12) months ago, in batches of `dimensione-blocco` each in its own transaction (`AnonimizzazioneService.anonimizzaBlocco`): `autore_id` → NULL, `descrizione` → '', `posizione` snapped to a 0.001° grid (~100 m), votes and abuse reports deleted, moderation `motivazione` cleared, `data_anonimizzazione` set. `SOSPESA` reports are never anonymized. Partial indexes (`V7__storico_e_contatori.sql`) keep this cheap at any history size: the GIST index on `posizione` covers only `stato = 'ATTIVA'` (map queries must keep the literal `s.stato = 'ATTIVA'` condition to use it), and `idx_segnalazione_da_anonimizzare` serves the job.
- Statistics (`StatisticheController` / `StatisticheService` / `StatisticheRepository`, native SQL via `NamedParameterJdbcTemplate`): `GET /api/statistiche/mappa` (heat-map grid cells `{lat, lng, numero}`, cell side `max(0.002°, 360 / 2^zoom / 8)` so public data never pinpoints an address, ≤ 2000 cells) and `/riepilogo` (totals, previous-period total, gravi, trend filled with empty periods — day ≤ 31 days, week ≤ 186, else month —, weekday × hour slots, per-category counts, top-5 hot cells) are public; `/moderazione` (abuses by reason/outcome, average review hours from `segnalazione_abuso.data_esito`, removals, suspensions, automatic flags, new users, queue size) is ADMIN only. Filters: `dal`/`al` inclusive days (default last 30, max 24 months), bbox `minLat/minLng/maxLat/maxLng` (required for map/riepilogo), optional `gravita`, `categoriaId`; invalid → 400. Only `ATTIVA` and `SCADUTA` reports count (anonymized included, `RIMOSSA`/`SOSPESA` excluded); every query filters first on `data_creazione` (`idx_segnalazione_data_creazione`, `V9__statistiche.sql`). Aggregation always happens in the database: never return single reports from these endpoints.
- `SegnalazioneAbuso` — "report a problem": one per (user, report) pair, unique-constrained, with a coded `motivo` (`MotivoAbuso`), optional `nota`, a `peso` = reporter's `punteggioFiducia` / 100 (min 0.25) and an `esito` (null = pending, `FONDATO`/`INFONDATO`). Not allowed on your own report (403) nor on non-`ATTIVA` ones (409). Pending abuses are denormalized on `Segnalazione` (`numeroAbusi`, `pesoAbusi`, `daRivedere`, `V8__moderazione.sql`): these columns are `updatable = false` and only change through atomic updates in `SegnalazioneRepository` (`registraAbuso`, `chiudiRevisione`), so a state change saving the entity never overwrites them. When `pesoAbusi` reaches `crimeapp.moderazione.soglia-peso-abusi` (4.0) the report is suspended. The admin decides with `PATCH /api/segnalazioni/{id}/abusi/esito` (`SegnalazioneService.decidiRevisione`): `FONDATO` removes it if still `ATTIVA`/`SOSPESA` (same path as an admin "Rimuovi"), `INFONDATO` reactivates a `SOSPESA` one; admin "Rimuovi" counts as `FONDATO` and "Riattiva" as `INFONDATO`. Trust (`Utente.punteggioFiducia`, 0–100, also `updatable = false`, changed only by `UtenteRepository.modificaFiducia`): reporters +2 on `FONDATO`, −10 on `INFONDATO`; the author −10 when an admin removes their report. The admin queue is `GET /gestione?revisione=DA_RIVEDERE|CON_ABUSI|AUTOMATICA` (sortable by `numeroAbusi`/`pesoAbusi`) plus `GET /api/segnalazioni/gestione/da-rivedere` (count). `SegnalazioneDto` exposes the queue fields only to admins, and `mioAbuso` (computed with one `IN` query per view, like `mioVoto`) to logged-in users.
- `ConfermaSegnalazione` — a user's answer to "is it still happening?", one per (user, report) pair and changeable. YES pushes `dataScadenza` to now + category duration (never earlier) and sets `dataUltimaConferma`. NO votes cast after `dataUltimaConferma` count toward `crimeapp.segnalazioni.soglia-non-in-atto`; reaching it moves the report to `SCADUTA`. A NO from the report's own author closes it immediately (`SCADUTA`, event actor `AUTORE`, via `SegnalazioneService.concludiDaAutore`) without waiting for the threshold. Repeating a YES is a no-op (no endless extension); a user's YES only extends the report if their previous extending YES (`ConfermaSegnalazione.dataUltimoSi`) is older than the category duration, so toggling NO/YES cannot keep a report alive or reset the others' NO count; repeating a NO only counts again if the previous NO predates the last YES.
- `EventoModerazione` — audit trail of every state transition on a `Segnalazione` (previous/new state, actor type: `SISTEMA`/`AUTORE`/`ADMIN`).
- `PreferenzeNotifica`, `DeviceToken` — per-user notification preferences and push tokens.

Error handling is centralized in `exception/GlobalExceptionHandler.java` (`@RestControllerAdvice`): new controllers automatically get consistent error responses (`ErrorResponse`) without reimplementing exception handling. Existing mappings: `RisorsaNonTrovataException` → 404, `ConflittoException` → 409, `DataIntegrityViolationException` (e.g. FK violation on delete) → 409, `MethodArgumentNotValidException` → 400 with field messages joined, `HttpMessageNotReadableException` (malformed JSON, unknown enum value) → 400, `DescrizioneNonValidaException` → 400 with `violazioni` (the field is omitted from every other error). Reuse these exception types for new resources instead of introducing per-controller error handling.

Logging uses SLF4J/Logback via Lombok's `@Slf4j` (annotate the class, then `log.info(...)`); don't declare loggers manually with `LoggerFactory`. Always use `{}` placeholders instead of string concatenation, and pass the exception as the last argument to `log.error` to get the stack trace. Levels: `debug` for dev detail, `info` for domain events (create/update/state transitions), `warn` for client errors (already logged by `GlobalExceptionHandler`), `error` for unexpected exceptions (the catch-all handler logs them and returns a generic 500). Configuration lives in `application.yaml` under `logging:`: console + rolling file `logs/crime-app.log` (gitignored), SQL logged via `org.hibernate.SQL` instead of `show-sql`. `config/RequestLoggingFilter.java` logs one line per `/api/**` request (method, path, status, duration).

### Authentication and authorization

Stateless JWT auth (HS256) via `spring-boot-starter-security-oauth2-resource-server`; tokens are issued by the backend itself, no external IdP.
- `POST /api/auth/login`, `POST /api/auth/registrazione` (public, self-registration always creates a `UTENTE`) return `AuthResponse { token, scadenza, utente }`; `GET /api/auth/me` returns the current user. Token subject = user id, claim `ruolo` → authority `ROLE_UTENTE`/`ROLE_ADMIN`.
- Signing key: `crimeapp.auth.jwt-secret` (≥ 32 bytes, override with env `CRIMEAPP_JWT_SECRET` outside dev); lifetime `crimeapp.auth.jwt-durata-minuti`.
- Access rules live in `config/SecurityConfig.java`: GETs on `/api/segnalazioni/**` and `/api/categorie/**` are public (except abuse reports and moderation history, ADMIN only); category writes, `/api/utenti/**` (except `/api/utenti/me/**`) `PATCH /api/segnalazioni/*/riattiva`, `PATCH /api/segnalazioni/*/abusi/esito` and `GET /api/segnalazioni/gestione/da-rivedere` are ADMIN only; everything else requires login. 401/403 from the filter chain are serialized as `ErrorResponse` by `config/ErroriSicurezzaHandler.java`.
- **Never take the acting user's id from the request body/path.** Use `service/UtenteCorrenteService` (`utenteCorrente()` also rejects deactivated accounts, `idCorrenteOpzionale()` for public endpoints, `isAdmin()` from the token). Finer rules (e.g. only author or admin may remove a report) stay in the services and throw `AccessoNegatoException` (403); failed login throws `CredenzialiNonValideException` (401).
- Anonymous reports: `SegnalazioneMapper` nulls `autoreId` unless the requester is the author or an admin.
- Role and active state are **re-read from the DB on every request** by `config/JwtUtenteConverter.java` (the `ruolo` claim in the token is informational only): demoting or deactivating a user takes effect immediately; a deactivated user's token gets 401.
- Roles are a `ruolo` column on `utente` (`V3__ruolo_utente.sql`). The first admin is bootstrapped with `crimeapp.auth.admin-email` (env `CRIMEAPP_ADMIN_EMAIL`): that user becomes ADMIN on registration, or at startup if already registered (`config/AdminInizialeRunner.java`). Further admins are managed via `PATCH /api/utenti/{id}/ruolo` (ADMIN only). `UtenteService` refuses (409) to demote, deactivate or delete the last active admin.

CSRF is disabled (no cookies, bearer tokens only). CORS allows only `http://localhost:4200` and must be restricted to the real frontend origin before going to production.

## Frontend architecture

Angular 22, standalone components (no NgModules), routes declared flat in `app.routes.ts`. Global providers (router, `HttpClient`, Lucide icon set) are wired in `app.config.ts`.

Feature folders under `src/app/` mirror backend resources (e.g. `categorie/`) and follow this pattern: an injectable `*Api` service (`providedIn: 'root'`) wrapping `HttpClient` calls against `environment.apiUrl`, a component using Angular `signal()`s for local state (no NgRx/store), and `ReactiveFormsModule` for forms. `categorie/` is the reference implementation for adding a new CRUD feature.

Shared domain types live in `src/app/models/` (one file per entity, mirroring the backend entities, plus a barrel `index.ts`). `environments/environment.ts` / `environment.production.ts` hold `apiUrl`.

Notable libraries: `@bluehalo/ngx-leaflet` + `leaflet` for the map view (`mappa/`), `@lucide/angular` for icons — icon components must be explicitly registered in `shared/icone-categoria.ts` and provided via `provideLucideIcons(...)` in `app.config.ts` before they can be referenced by kebab-case name elsewhere (e.g. a category's `icona` field). Styling uses Tailwind CSS v4 (via `@tailwindcss/postcss`). Prettier is configured with `printWidth: 100`, single quotes, and the Angular parser for `.html` templates.
