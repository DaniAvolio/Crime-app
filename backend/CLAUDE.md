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
- `Utente` — user accounts.
- `Categoria` — a **table**, not an enum, by design: admin-configurable taxonomy of report types without a redeploy. Each category has `durataValiditaOre` (validity duration in hours), used to compute a report's expiry at creation time, and `gravita` (1 = degrado/quiete, yellow; 2 = patrimonio, orange; 3 = contro la persona, red) that drives the marker color and the map's severity filter. A default set of categories is seeded by `V4__gravita_categoria.sql`. `nome`/`descrizione` are in Italian (base and fallback language); other languages live in `categoria_traduzione` (`V5__categoria_traduzione.sql`, one row per category and language code), mapped as the `traduzioni` map on the entity and exposed as `traduzioni: { en: { nome, descrizione } }` in the DTO/request. Adding a language needs no schema change.
- `Segnalazione` — a report: has an author (`autore`, never null — anonymity is display-only via the `anonima` flag), a `Categoria`, a PostGIS `Point` (`posizione`, geography SRID 4326), and a state machine driven by `StatoSegnalazione`: `ATTIVA -> SCADUTA` (scheduled job, expiry per category; or automatic when enough users vote "no longer happening") | `ATTIVA -> SOSPESA` (automatic, abuse threshold reached) | `ATTIVA -> RIMOSSA` (admin or author) | `SOSPESA -> ATTIVA|RIMOSSA` (admin only). There is no blocking human review step before a report goes live — only a reactive one (moderation happens after publication, via abuse reports and admin action).
- `SegnalazioneAbuso` — one abuse report per (user, report) pair, unique-constrained.
- `ConfermaSegnalazione` — a user's answer to "is it still happening?", one per (user, report) pair and changeable. YES pushes `dataScadenza` to now + category duration (never earlier) and sets `dataUltimaConferma`. NO votes cast after `dataUltimaConferma` count toward `crimeapp.segnalazioni.soglia-non-in-atto`; reaching it moves the report to `SCADUTA`. A NO from the report's own author closes it immediately (`SCADUTA`, event actor `AUTORE`, via `SegnalazioneService.concludiDaAutore`) without waiting for the threshold. Repeating a YES is a no-op (no endless extension); a user's YES only extends the report if their previous extending YES (`ConfermaSegnalazione.dataUltimoSi`) is older than the category duration, so toggling NO/YES cannot keep a report alive or reset the others' NO count; repeating a NO only counts again if the previous NO predates the last YES.
- `EventoModerazione` — audit trail of every state transition on a `Segnalazione` (previous/new state, actor type: `SISTEMA`/`AUTORE`/`ADMIN`).
- `PreferenzeNotifica`, `DeviceToken` — per-user notification preferences and push tokens.

Error handling is centralized in `exception/GlobalExceptionHandler.java` (`@RestControllerAdvice`): new controllers automatically get consistent error responses (`ErrorResponse`) without reimplementing exception handling. Existing mappings: `RisorsaNonTrovataException` → 404, `ConflittoException` → 409, `DataIntegrityViolationException` (e.g. FK violation on delete) → 409, `MethodArgumentNotValidException` → 400 with field messages joined. Reuse these exception types for new resources instead of introducing per-controller error handling.

Logging uses SLF4J/Logback via Lombok's `@Slf4j` (annotate the class, then `log.info(...)`); don't declare loggers manually with `LoggerFactory`. Always use `{}` placeholders instead of string concatenation, and pass the exception as the last argument to `log.error` to get the stack trace. Levels: `debug` for dev detail, `info` for domain events (create/update/state transitions), `warn` for client errors (already logged by `GlobalExceptionHandler`), `error` for unexpected exceptions (the catch-all handler logs them and returns a generic 500). Configuration lives in `application.yaml` under `logging:`: console + rolling file `logs/crime-app.log` (gitignored), SQL logged via `org.hibernate.SQL` instead of `show-sql`. `config/RequestLoggingFilter.java` logs one line per `/api/**` request (method, path, status, duration).

### Authentication and authorization

Stateless JWT auth (HS256) via `spring-boot-starter-security-oauth2-resource-server`; tokens are issued by the backend itself, no external IdP.
- `POST /api/auth/login`, `POST /api/auth/registrazione` (public, self-registration always creates a `UTENTE`) return `AuthResponse { token, scadenza, utente }`; `GET /api/auth/me` returns the current user. Token subject = user id, claim `ruolo` → authority `ROLE_UTENTE`/`ROLE_ADMIN`.
- Signing key: `crimeapp.auth.jwt-secret` (≥ 32 bytes, override with env `CRIMEAPP_JWT_SECRET` outside dev); lifetime `crimeapp.auth.jwt-durata-minuti`.
- Access rules live in `config/SecurityConfig.java`: GETs on `/api/segnalazioni/**` and `/api/categorie/**` are public (except abuse reports and moderation history, ADMIN only); category writes, `/api/utenti/**` (except `/api/utenti/me/**`) and `PATCH /api/segnalazioni/*/riattiva` are ADMIN only; everything else requires login. 401/403 from the filter chain are serialized as `ErrorResponse` by `config/ErroriSicurezzaHandler.java`.
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
