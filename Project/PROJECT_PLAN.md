# Project Plan: Shnoozy.top

> **⚙️ Doku-Info für KI-Agenten:**
> Dieses Dokument (`PROJECT_PLAN.md`) ist das **technische Datenblatt** des Projekts. Es enthält die ToDo-Listen, technische Details, durchgeführte Migrationen (SQLs), verwendete externe Tools, Edge Functions sowie ganz unten das **technische Log**. 
> Für das fachliche Konzept siehe zwingend die Datei `project-overview.md`.

## Current Status
**Live unter:** https://shnoozy.top
**Phase:** Phase 6 — Multi-Tenancy Implementierung (Datenbank-Reset)

---

## 🗺️ Roadmap

### 🟡 Phase 6: Multi-Tenancy Implementierung (in Arbeit)
> **Wichtig:** Datenbank wurde komplett zurückgesetzt (2026-05-07). Alle Tabellen neu aufgebaut. 142 Events (50 Geburtstage + 92 Müllabfuhr-Termine 2026) wurden wiederhergestellt.

#### 6.1 Neue Kerntabellen anlegen ✅
- [x] Tabelle `homes` erstellt
- [x] Tabelle `home_members` erstellt (mit Trigger: Ersteller wird automatisch als Admin eingetragen)
- [x] Tabelle `home_settings` erstellt
- [x] Tabelle `home_invitations` erstellt

#### 6.2 Bestehende Tabellen um `home_id` erweitern ✅
- [x] `events`, `sticky_notes`, `shopping_items`, `push_subscriptions` — alle mit `home_id` (NOT NULL, FK → `homes.id`)
- [x] `app_settings` → ersetzt durch `home_settings`
- [x] `shopping_items`: Spaltenrename `title` → `name`, `user_id` nullable (für Google Tasks Sync ohne User-Kontext)

#### 6.3 RLS Policies neu implementieren ✅
- [x] Alle Tabellen mit neuer Policy-Logik via `is_home_member(home_id)` Helper-Funktion (SECURITY DEFINER)
- [x] Realtime-Publication für `shopping_items`, `sticky_notes`, `events` neu aktiviert (ging beim Reset verloren)

#### 6.4 Einladungssystem (Link-Generator) ⬜ OFFEN
- [x] Tabelle `home_invitations` angelegt (Schema bereit)
- [x] Frontend `HomeOnboarding.tsx`: "Join Home"-Tab vorhanden, ruft `accept-invite` auf
- [ ] **Edge Function `accept-invite`**: Noch nicht gebaut — "Join Home"-Button in der App führt aktuell ins Leere
- [ ] **Edge Function `generate-invite`**: Noch nicht gebaut — kein UI zum Erstellen von Einladungslinks

#### 6.5 Google Tasks Integration ✅ (vereinfacht)
- [x] `sync-google-tasks` angepasst: `title` → `name`, `home_id` aus Env-Var `DEFAULT_HOME_ID`
- [x] `add-shopping-item` bereinigt: IFTTT-Pfad entfernt, nur noch JWT-Auth, `user_id` aus JWT
- [ ] `DEFAULT_HOME_ID` Secret in Supabase setzen: `89cd774f-b26e-40ce-9362-7589ded42c8d` (**manueller Schritt**)

#### 6.6 Frontend-Anpassungen (Home-Kontext) ✅
- [x] `App.tsx`: Home aus `home_members` laden, Onboarding-Guard, `homeId` an alle Komponenten
- [x] `Calendar.tsx`, `Lists.tsx`, `StickyNotes.tsx`: alle Queries mit `home_id` gefiltert
- [x] `home_settings` für WiFi-Credentials statt `app_settings`

#### 6.7 Manuelle Nacharbeiten nach DB-Reset ⬜ OFFEN
- [ ] **WiFi-Credentials** neu eintragen (SSID + Passwort) — App-Einstellungen
- [ ] **Push Notifications** neu aktivieren — für beide Nutzer in der App (alte Subscriptions gelöscht)
- [ ] **`DEFAULT_HOME_ID`** Supabase Secret setzen (siehe 6.5)

---

### Phase 1: Core Setup ✅
- [x] React + Vite + TypeScript Setup
- [x] Design System (Airbnb Cereal VF, teal #14d8db)
- [x] PWA-Struktur, Bottom Navigation (5 Tabs)
- [ ] **Bugfix PWA-Struktur:** Das `manifest.webmanifest` (bzw. `manifest.json`) und die Verlinkung in der `index.html` fehlen komplett. Dadurch greift das "Add to Homescreen" Popup auf Smartphones nicht. *Aufgabe an Claude: Bitte das Web App Manifest inkl. Theme-Color und den benötigten Icon-Größen (z.B. 192x192, 512x512) generieren, in `app/public` ablegen und in der `index.html` einbinden.*
- [x] Dashboard & Placeholder-Screens

### Phase 2: Infrastruktur & Auth ✅
- [x] Supabase Projekt, Datenbank-Schema
- [x] Supabase Auth (E-Mail Magic Link)
- [x] Row Level Security (RLS) auf allen Tabellen
- [x] Environment Config (.env, GitHub Secrets)

### Phase 3: Kalender & Notifications ✅
- [x] `events` Tabelle mit Kategorien (birthday, event, reminder, trash)
- [x] Kalender-UI: Schedule-View, Add/Edit/Delete Events
- [x] Wiederkehrende Events (yearly) mit Geburtstags-Projektion
- [x] ICS Export (RFC 5545, RRULE für Geburtstage)
- [x] Trash-Kategorie (#bf7300) + 74 Müllabfuhr-Termine importiert
- [x] Geburtstage importiert (aus ICS)
- [x] Web-Push Notifications (VAPID, Service Worker)
- [x] Edge Function `send-daily-push` (pg_cron, täglich 8:30 MESZ)
- [x] `push_subscriptions` Tabelle

### Phase 4: Smart Shopping List ✅
- [x] `shopping_items` Tabelle (shared, kein User-Scoping)
- [x] Shopping List UI mit Realtime-Sync
- [x] Kategorien: Groceries, Drogerie, Cleaning, Luna, Misc
- [x] Edge Function `add-shopping-item` (Gemini-Kategorisierung, JWT + IFTTT-Auth)
- [x] **Bugfix KI-Kategorisierung:** Modell `gemini-2.0-flash` (für neue User nicht verfügbar, HTTP 404) → `gemini-2.5-flash`. Beide Edge Functions `sync-google-tasks` und `add-shopping-item` aktualisiert und deployed (v9). `GEMINI_API_KEY` Secret in Supabase gesetzt.
- [x] Edge Function `sync-google-tasks` (OAuth2 Refresh, alle 2 Min. via pg_cron)
- [x] Google Home Nest Sprachsteuerung via Google Tasks API
- [x] Soft-Delete (`deleted_at`) für Shopping Items (Migration 010) — abgehakte Items bauen Kaufhistorie auf
- [x] "Erledigt"-Sektion (klappbar) statt Inline-Strikethrough — `clearChecked()` setzt `deleted_at` statt DELETE
- [x] Autocomplete-Dropdown im Add-Input aus Kaufhistorie (ab 2 Zeichen, filtert aktive Items raus)
- [x] Kategorie-Wiederverwendung in `add-shopping-item` Edge Function (History-Lookup vor Gemini-Call)

### Phase 5: Deployment & Post-it Board ✅
- [x] GitHub Actions CI/CD (`deploy.yml`, auto-deploy bei Push auf `main`)
- [x] GitHub Pages + Custom Domain `shnoozy.top`
- [x] GoDaddy DNS (A-Records → GitHub Pages IPs)
- [x] Supabase Auth URL auf `https://shnoozy.top` aktualisiert
- [x] `sticky_notes` Tabelle mit RLS
- [x] Post-it Board: farbcodiert (Primary/Luxe nach User), Edit/Delete eigene Notes
- [x] Sichtbarkeit-Toggle: "For both" / "For partner"
- [x] Realtime Toast-Notification bei neuer Note vom Partner
- [x] Dashboard-Widget (Alt): Top 2 Notes + "See all" Link
- [x] **UI-Refactoring Post-its:** Dashboard-Widget als wischbarer Deck/Stapel mit zufälliger Rotation. Kein Library-Overhead — reines CSS + Pointer Events. Swipe links/rechts schiebt oberstes Note ans Ende des Stapels. "See all →" führt zur Vollansicht.
- [ ] **Kaufhistorie-Funktion Shopping** erneut prüfen: Subkategorie-Wiederverwendung aus History verifizieren und ggf. optimieren.
- [x] More-Tab: Cards für Sticky Notes, Home, Car
- [x] Home & Car Placeholder-Seiten angelegt
- [x] WiFi-Modal: QR-Code (qrcode.react), editierbare Credentials via `app_settings`
- [x] Events RLS: alle User können alle Kalendereinträge sehen, bearbeiten und löschen
- [x] Kalender Bug-Fix: Update/Delete auf projizierten Geburtstags-Events (original_id)
- [x] SVG-Icons statt Emojis in Lists, Dashboard, More-Tab

---

## 📋 Nächste Module (offen)

### Document Storage (3.4)
- [ ] Supabase Storage Bucket (`documents`) anlegen inkl. RLS Policies.
- [ ] UI: Listenansicht mit festen Basis-Ordnern (`Apartment`, `Car`, `Insurances`, `Luna`, `Personal`, `Misc`) als **Accordion-Design** (flache Hierarchie, ausklappbar).
- [ ] UI: Funktionalität zum Anlegen von dynamischen Unterordnern innerhalb der Hauptordner.
- [ ] UI: Sticky Suchleiste ganz oben (Live-Filterung über alle Dateinamen).
- [ ] UI: Floating Action Button (FAB) unten rechts für Uploads (Kamera & File-Picker via Bottom-Sheet).
- [ ] UI: Drei-Punkte-Menü (`⋮`) pro Datei für Aktionen (Teilen via Web Share API, Löschen).
- [ ] **Smart Renaming (Zero-Friction Flow):** *Frage an Claude: Bitte den Upload-Flow so bauen, dass der Nutzer keine leeren Formulare ausfüllen muss. Nach Dateiauswahl soll im Hintergrund per Edge Function (Gemini) der Inhalt analysiert werden. Dann öffnet sich ein Dialog mit dem von der KI bereits vorausgefüllten Namensvorschlag. Zwingendes Format: `YYYYMMDD_KATEGORIE_Inhalt` (z.B. `20260501_Car_Leasing-Contract`). Der Nutzer muss nur noch "Speichern" tippen. Bitte Konzept skizzieren und implementieren.*

### Home Info (neu)
- [ ] Zählernummern (Strom, Gas, Wasser)
- [ ] Vertragsdaten (Anbieter, Vertragsnummer, Laufzeit, Kündigungsfrist)
- [ ] Vermieter-Kontakte
- [ ] Übergabeprotokoll / wichtige Dokumente
- [ ] Wiederkehrende Kosten (Nebenkosten, etc.)

### Car (neu)
- [ ] Fahrzeugdaten (Kennzeichen, Modell, Erstzulassung, Fahrgestellnummer)
- [ ] Versicherungsdaten (Anbieter, Vertragsnummer, Ablaufdatum)
- [ ] TÜV / HU-Datum mit Kalender-Erinnerung
- [ ] Servicetermine & Kilometerstand-Verlauf
- [ ] Dokumente (Fahrzeugschein, Versicherungsnachweis)

### Luna Portal (3.3)
- [ ] Info-Dashboard (Chipnummer, Versicherung, Futterplan)
- [ ] Wiederkehrende Tierarzt-Termine → Hauptkalender

### Moodboard & Wishlist (3.6)
- [ ] Web Share Target API
- [ ] Visuelle Sammlung für Ideen und Produktwünsche

### Entertainment & Dining (3.7)
- [ ] Medien-Watchlist + "Spin the Wheel"
- [ ] Restaurant Favorites + "Spin the Wheel"

### Custom Map (3.8)
- [ ] Leaflet oder Google Maps API
- [ ] Eigene Pins mit Kategorien
- [ ] Google Maps Listen-Import

---

## 🗄️ Datenbank-Migrationen

| # | Datei | Beschreibung |
|---|-------|-------------|
| 001 | `001_create_profiles_table.sql` | User-Profile |
| 002 | `002_create_events_table.sql` | Events-Tabelle |
| 003 | `003_enhance_events_table.sql` | Events erweitert (is_all_day, recurrence, category) |
| 004 | `004_import_birthdays.sql` | Geburtstage importiert |
| 005 | `005_import_trash_pickups.sql` | 74 Müllabfuhr-Termine |
| 006 | `006_create_push_subscriptions.sql` | Push-Subscriptions |
| 007 | `007_create_shopping_items.sql` | Shopping List |
| 008 | `008_create_sticky_notes.sql` | Sticky Notes |
| 009 | `009_create_app_settings.sql` | App-Settings (WiFi-Credentials) |
| 010 | `010_shopping_soft_delete.sql` | `deleted_at` Spalte + Index für Shopping-Kaufhistorie |
| — | `phase6_multi_tenancy_reset` | DB-Reset: alle App-Tabellen neu, `homes`/`home_members`/`home_settings`/`home_invitations`, RLS via `is_home_member()` |
| — | `import_events_backup` | 142 Events (50 Geburtstage + 92 Müllabfuhr 2026) in Home `89cd774f` importiert |
| — | `make_shopping_items_user_id_nullable` | `shopping_items.user_id` auf nullable gesetzt (Google Tasks Sync ohne User-Kontext) |
| — | `enable_realtime_on_tables` | Realtime-Publication für `shopping_items`, `sticky_notes`, `events` aktiviert |

## ⚙️ Supabase Edge Functions

| Function | Trigger | Zweck | Status |
|----------|---------|-------|--------|
| `add-shopping-item` | HTTP (Frontend, JWT-Auth) | Item hinzufügen + Gemini-Kategorisierung | ✅ aktiv |
| `sync-google-tasks` | pg_cron alle 2 Min | Google Tasks → Shopping List | ✅ aktiv (braucht `DEFAULT_HOME_ID` Secret) |
| `send-daily-push` | pg_cron täglich 8:30 MESZ | Push-Notifications für Kalender-Termine | ✅ aktiv |
| `accept-invite` | HTTP | Einladungslink einlösen → `home_members` eintragen | ⬜ noch nicht gebaut |
| `generate-invite` | HTTP | Einladungstoken erstellen (Admin) | ⬜ noch nicht gebaut |

---

## 📝 Log
*   **2026-05-01:** Grundgerüst fertiggestellt. Design-System (Airbnb) und Navigation implementiert.
*   **2026-05-01:** `PROJECT_PLAN.md` erstellt. Phase 2 (Infrastruktur & Auth) abgeschlossen.
*   **2026-05-01:** Phase 3 abgeschlossen: Kalender mit allen Kategorien, ICS Export, Web-Push Notifications. Müllabfuhr- und Geburtstagsimport. Push-Subscriptions via VAPID.
*   **2026-05-01:** Phase 4 abgeschlossen: Smart Shopping List mit Realtime, Gemini-Kategorisierung, Google Tasks Sync für Google Home Nest Sprachsteuerung.
*   **2026-05-01:** Deployment auf `shnoozy.top` via GitHub Pages + GoDaddy DNS + GitHub Actions CI/CD.
*   **2026-05-01:** Post-it Board (3.5) implementiert: farbcodierte Sticky Notes, Realtime Notifications, Dashboard-Widget.
*   **2026-05-02:** More-Tab mit Cards (Sticky Notes, Home, Car). WiFi-Modal mit QR-Code (qrcode.react) + editierbaren Credentials in `app_settings`. Events RLS geöffnet für beide User. Kalender-Bugfix (projected birthday update/delete). SVG-Icons statt Emojis.
*   **2026-05-03:** Shopping List erweitert: Soft-Delete + Kaufhistorie (Migration 010), klappbare "Erledigt"-Sektion, Autocomplete-Dropdown aus History, Kategorie-Wiederverwendung in Edge Function.
*   **2026-05-03:** Gemini-Kategorisierung gefixt: Modell `gemini-2.0-flash` war für neue API-User nicht verfügbar (HTTP 404), ersetzt durch `gemini-2.5-flash` in beiden Edge Functions.
*   **2026-05-03:** Shopping-Kategorien erweitert: 6 Hauptkategorien + 9 Subkategorien unter Groceries (Supermarkt-Reihenfolge). DB Migration 011 (`subcategory`-Spalte). Gemini liefert JSON mit `responseMimeType`.
*   **2026-05-03:** Post-it Dashboard-Widget als swipebarer Deck-Stapel umgebaut. Rotation, Swipe-Geste (Pointer Events), keine externe Library.
*   **2026-05-06:** Architektur-Entscheidung: Vollständiger Umbau auf Multi-Tenancy. Datenbank-Reset geplant. Neue Kerntabellen (`homes`, `home_members`, `home_settings`, `home_invitations`), `home_id` auf allen Datentabellen, RLS-Neuimplementierung, Einladungssystem via Share-Links (7 Tage, kein E-Mail-Versand), Google Tasks Integration auf optionales Pro-Nutzer-OAuth umgebaut. Phase 6 in Roadmap verankert.
*   **2026-05-07:** Datenbank-Reset durchgeführt (Migration `phase6_multi_tenancy_reset`). Tabellen `plantcare_page_views` und `plantcare_chats` unberührt. 142 Events (50 Geburtstage + 92 Müllabfuhr-Termine 2026) aus Backup wiederhergestellt (Migration `import_events_backup`). Home "Home" angelegt (ID: `89cd774f-b26e-40ce-9362-7589ded42c8d`), beide Nutzer als Admin eingetragen.
*   **2026-05-07:** Frontend Multi-Tenancy: `HomeOnboarding.tsx` neu, `App.tsx` mit Home-Lade-Logik und Onboarding-Guard, `Calendar.tsx`/`Lists.tsx`/`StickyNotes.tsx` mit `home_id`-Filterung. 2 TypeScript Build-Fehler behoben (unused `homeName` state).
*   **2026-05-07:** Edge Functions auf neues Schema aktualisiert: `title`→`name`, `home_id` ergänzt, `auth`→`auth_key` in `send-daily-push`. IFTTT-Pfad aus `add-shopping-item` entfernt (nur JWT-Auth). Realtime-Publication für `shopping_items`, `sticky_notes`, `events` neu aktiviert (ging beim Reset verloren). `shopping_items.user_id` nullable gemacht (Google Tasks Sync hat keinen User-Kontext).
