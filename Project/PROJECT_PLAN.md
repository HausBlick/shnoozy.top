# Project Plan: Shnoozy.top

> **⚙️ Doku-Info für KI-Agenten:**
> Dieses Dokument (`PROJECT_PLAN.md`) ist das **technische Datenblatt** des Projekts. Es enthält die ToDo-Listen, technische Details, durchgeführte Migrationen (SQLs), verwendete externe Tools, Edge Functions sowie ganz unten das **technische Log**. 
> Für das fachliche Konzept siehe zwingend die Datei `project-overview.md`.

## Current Status
**Live unter:** https://shnoozy.top
**Phase:** Phase 8 — Konfigurierbare Navigation & Modul-Manager

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

#### 6.5 Google Tasks Integration ⏸ ON HOLD
- [x] `sync-google-tasks` angepasst: `title` → `name`, `home_id` aus Env-Var `DEFAULT_HOME_ID`
- [x] `add-shopping-item` bereinigt: IFTTT-Pfad entfernt, nur noch JWT-Auth, `user_id` aus JWT
- [ ] ~~`DEFAULT_HOME_ID` Secret setzen~~ — **bewusst zurückgestellt**: globales Secret skaliert nicht für Multi-User/Multi-Home. Neukonzeption nötig (per-User OAuth + Home-Mapping). Siehe project-overview.md 3.2.

#### 6.6 Frontend-Anpassungen (Home-Kontext) ✅
- [x] `App.tsx`: Home aus `home_members` laden, Onboarding-Guard, `homeId` an alle Komponenten
- [x] `Calendar.tsx`, `Lists.tsx`, `StickyNotes.tsx`: alle Queries mit `home_id` gefiltert
- [x] `home_settings` für WiFi-Credentials statt `app_settings`

#### 6.7 Manuelle Nacharbeiten nach DB-Reset ✅
- [x] **WiFi-Credentials** neu eintragen (SSID + Passwort) — App-Einstellungen
- [x] **Push Notifications** neu aktivieren — für beide Nutzer in der App (alte Subscriptions gelöscht)
- [x] ~~**`DEFAULT_HOME_ID`** Supabase Secret setzen~~ — on hold, siehe 6.5

---

### Phase 1: Core Setup ✅
> **📝 Notiz (2026-05-14):** Pull-to-Refresh auf iOS noch nicht getestet — kein iOS-Gerät vorhanden. In Safari-Browser nicht fixbar (kein `overscroll-behavior`-Support). In installierter PWA sollte es von Apple deaktiviert sein. Testen sobald erste iOS-User (Freunde) die App nutzen.
- [x] React + Vite + TypeScript Setup
- [x] Design System (Airbnb Cereal VF, teal #14d8db)
- [x] PWA-Struktur, Bottom Navigation (5 Tabs)
- [x] **Bugfix PWA-Manifest (2026-05-14):** `manifest.webmanifest` erstellt (name, icons, theme_color #14d8db, display standalone), Icons in `app/public/icons/` (192px, 512px, maskable 512px, apple-touch 180px), `index.html` um manifest-Link, theme-color, apple-touch-icon und Apple-PWA-Meta-Tags ergänzt. Hinweis: maskable Icon hat weißen statt teal Hintergrund — kann bei Gelegenheit nachgebessert werden.
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

### ✅ Phase 7: Dynamische Shopping-Kategorien & i18n (abgeschlossen 2026-05-13)

#### 7.1 Dynamische Shopping-Kategorien ✅
- [x] SQL-Migration `012_shopping_categories.sql` ausgeführt: `shopping_categories`, `shopping_subcategories`, `profiles.language`
- [x] Default-Kategorien für bestehendes Home eingefügt (inkl. Luna + Groceries-Subkategorien)
- [x] Edge Function `add-shopping-item` v15: Gemini-Prompt dynamisch aus DB, History-Lookup auf `home_id` gefiltert
- [x] Frontend `Lists.tsx`: Kategorien + Subkategorien aus DB, Emoji-Icons, dynamische Sortierung

#### 7.2 i18n — Per-User Spracheinstellung ✅
- [x] `profiles.language` (`'en' | 'de'`) in DB
- [x] `lib/i18n.ts` mit allen App-Strings (Navigation, Dashboard, Kalender, Shopping, Notizen, Settings)
- [x] Settings-Seite (More → Einstellungen) mit Language-Toggle
- [x] `Calendar.tsx`, `Lists.tsx`, `StickyNotes.tsx`, `App.tsx` vollständig übersetzt

#### 7.3 Kategorie-Editor UI ✅
- [x] ⚙️-Icon im Shopping-Header als direkter Einstieg in Kategorie-Verwaltung
- [x] `CategoryListView`: alle Kategorien mit Emoji, Name (Kategorie-Farbe), AI-Beschreibung (gekürzt), ▲▼-Sortierung (speichert `sort_order` in DB)
- [x] `CategoryEditForm`: Name, Emoji-Feld, 12 Farb-Swatches, Beschreibungsfeld für Gemini-Prompt, Live-Vorschau
- [x] Erstellen / Bearbeiten / Löschen (2-Tap-Bestätigung, rot hervorgehoben)
- [x] Kein neues Backend — nutzt bestehende `shopping_categories`-Tabelle

---

## 📋 Nächste Module — Priorisiert

> Priorisierung nach Aufwand/Nutzen. Konzepte werden vor Implementierung abgestimmt.

---

### ✅ Phase 8.1: Konfigurierbare Navigation & Modul-Manager (abgeschlossen 2026-05-13)

#### 8.1 Konfigurierbare Bottom-Navigation & More-Menü ✅
- [x] `home_settings`-Key `nav_slots` (JSON-Array, **3 Slots** — 2 links + 1 rechts von Home; More immer fix ganz rechts)
- [x] `home_settings`-Key `modules_active` (JSON-Array, geordnet — ersetzt separate Feature-Flags wie `luna_enabled`)
- [x] `HomeSettings.tsx` neu: Admin-Seite mit 3 Nav-Slot-Dropdowns + Modul-Manager
- [x] Modul-Manager: Drag & Drop (Pointer Events, keine Library) zum Umsortieren aktiver Module; Ziehen über Trennlinie deaktiviert ein Modul; `+`-Button aktiviert inaktive Module
- [x] Bearbeiten-Modus mit ⚙️-Icon bei Modulen mit eigenen Einstellungen (aktuell: Lists → Kategorien)
- [x] More-Menü komplett neu: aktive Module (nicht in Nav) als Cards oben; User-Settings + Home-Settings als Zeilen getrennt am Ende
- [x] `userRole` ('admin'|'member') aus `home_members.role` — Home-Settings nur für Admins sichtbar
- [x] Default-Werte in `home_settings` per SQL für bestehendes Home eingefügt

### ✅ Phase 8.2: ToDo-Listen & Aufgaben (abgeschlossen 2026-05-14)

#### 8.2 ToDo-Listen & Aufgaben (3.12)
- [x] SQL-Migration: `todo_lists` + `todo_items` mit allen Spalten, RLS (`is_home_member`), Realtime-Publication — bereits in DB vorhanden
- [x] Frontend: Listen-Übersicht, Task-Listenansicht, Add/Edit/Done Tasks (`Todos.tsx`)
- [x] Zuweisung an Home-Mitglied (Avatar mit Farb-Indikator)
- [x] Realtime-Sync via Supabase (Channels für beide Tabellen)
- [x] Dashboard-Widget: offene Aufgaben (`TodosDashboardWidget`), bedingt aktiv wenn Modul `todos` aktiviert
- [x] Push-Notification bei neuer Zuweisung → Edge Function `send-todo-push`

---

### 🟡 Phase 8.3: User-Settings Erweiterungen (MITTELPRIO, teilweise fertig)

#### 8.3.1 Notification Preferences ✅ FERTIG (2026-05-14)
- [x] `notification_preferences`-JSON-Spalte in `profiles` — 5 Keys: `calendar_daily`, `todo_assigned`, `todo_due_today`, `shopping_item_added`, `notes_new`
- [x] User-Settings UI: Toggles pro Notification-Typ mit Label + Beschreibung (DE/EN)
- [x] `send-daily-push` prüft `calendar_daily` + `todo_due_today` per User, sendet auch fällige Tasks
- [x] `send-todo-push` prüft `todo_assigned` vor dem Senden
- Tageszeit: Cron läuft 06:30 UTC = 08:30 CEST / 07:30 CET (kein User-konfigurierbarer Zeitpunkt — pg_cron unterstützt keine User-spezifischen Schedules)

#### 8.3.2 Profil-Bearbeitung 🟡 TEILFERTIG (2026-05-14)
- [x] `display_name` editierbar in User-Settings (Textfeld + Save-Button)
- [x] `avatar_color` — Farb-Picker mit 8 vordefinierten Farben in User-Settings
- [x] Avatar-Preview in User-Settings (Kreis mit Initial + gewählter Farbe)
- [x] Farbe wird in Todos-Avatar-Komponente genutzt (aus `profiles.avatar_color` statt hardcoded)
- [x] Sticky Notes zeigen Strip + Hintergrund in der Farbe des Erstellers (`hexToRgba` + `memberColors`-Prop)
- [x] `memberColors`-State in App.tsx — bereit für Activity-Widget (Phase 11)
- [ ] Avatar-Upload: Supabase Storage Bucket `avatars` + `avatar_url`-Spalte in `profiles` (separater Schritt)

#### 8.3.3 Weitere Settings-Kandidaten (niedrige Prio) ⬜ OFFEN
- [ ] Dark/Light Mode Toggle (`theme`-Feld in `profiles`)
- [ ] Standard-Kalenderansicht (`default_calendar_view` in `profiles`)
- [ ] Wochenstartag Mo/So (`week_start` in `profiles`)
- [ ] Push-Uhrzeit individuell pro User (`preferred_push_time` in `profiles`) — erfordert Architektur-Umbau von `send-daily-push` (stündlicher Cron statt fixer Zeit, Hoch-Aufwand)

---

### 🟡 Phase 9: Kalender-Erweiterungen (MITTELPRIO)

#### 9.1 Kalender-Ansichten (Monat / Woche / Tag) ⬜ OFFEN
- [ ] Segmented Control im Kalender-Header: Schedule | Monat | Woche | Tag
- [ ] **Monatsansicht:** 7×5-Grid, farbige Event-Dots pro Tag, Tap → Tagesdetail
- [ ] **Wochenansicht:** Zeitstrahl (0–24 Uhr), Events als farbige Blöcke mit Höhe = Dauer, Ganztages-Banner oben
- [ ] **Tagesansicht:** Zeitstrahl für einen Tag, Stundenraster
- [ ] Design-Referenz: Fantastical / Google Calendar — kompakt, farbkodiert, kein overengineering
- [ ] Kein neues Backend nötig — reine Frontend-Erweiterung

#### 9.2 Kalender-Abonnements (ICS-URL Import) ⬜ OFFEN
- [ ] SQL-Migration: `calendar_subscriptions` (`id`, `home_id`, `name`, `ics_url`, `color`, `show_on_dashboard`, `last_synced_at`) + `external_events` (`id`, `subscription_id`, `home_id`, `uid`, `title`, `start_time`, `end_time`, `is_all_day`, `description`)
- [ ] Edge Function `sync-calendar-subscriptions` (pg_cron alle 6h): fetcht ICS-URLs, parst RFC 5545, upsert in `external_events`
- [ ] Frontend: Kalender-Settings → "Abonnement hinzufügen" (URL, Name, Farbe, Dashboard-Toggle)
- [ ] `external_events` in Kalenderansichten integriert, schreibgeschützt, in eigener Farbe
- [ ] RLS: nur Home-Mitglieder sehen externe Events ihres Homes

---

### 🟡 Phase 10: Budgeting-Tool (MITTELPRIO)

#### 10.1 Haushaltsbuch — Manuelle Eingabe (MVP) ⬜ OFFEN
- [ ] SQL-Migration: `budget_categories` (per Home, analog Shopping-Kategorien) + `budget_entries` (`id`, `home_id`, `user_id`, `amount`, `category_id`, `description`, `date`, `split_mode` [`shared`|`personal`], `split_ratio`)
- [ ] Frontend: Ausgaben-Eingabe (Betrag, Kategorie, Datum, geteilt/persönlich)
- [ ] Monatsübersicht: Ausgaben nach Kategorie (Balkendiagramm), Gesamt, Bilanz zwischen Mitgliedern
- [ ] Kostensplitting-Anzeige: "Niko hat 120 € mehr bezahlt — Ausgleich ausstehend"

#### 10.2 Foto-Scan (KI-gestützt) — Konzept ausstehend ⬜ OFFEN
- [ ] Konzept mit Gemini Vision API abstimmen (Datenschutz, Genauigkeit, Flow)
- [ ] Upload von Kassenbon-Foto → Gemini extrahiert Betrag, Händler, Datum
- [ ] Vorausgefülltes Formular → 1-Tap-Speichern

---

### 🟡 Phase 11: Dashboard-Redesign (MITTELPRIO, offen)

#### 11.1 Neues Dashboard-Layout ⬜ OFFEN
- [ ] Sticky Notes fix an oberster Stelle (großes Widget)
- [ ] Kalender-Widget mit 4–7 kommenden Terminen (statt aktuell unlimitierter 14-Tage-Liste)
- [ ] Per-User anpassbarer Widget-Block: `dashboard_widgets`-JSON-Spalte in `profiles` (Array von Widget-IDs + Reihenfolge)
- [ ] Widget-Registry im Frontend: add/remove/reorder via Drag & Drop (analog zum bestehenden Modul-Manager)
- [ ] WLAN-Sharing Button fix unten
- [ ] Aktivitäts-Log fix ganz unten

#### 11.2 Aktivitäts-Log Widget ⬜ OFFEN
- [ ] SQL-Migration: `activity_log`-Tabelle (`home_id`, `user_id`, `action_type`, `entity_type`, `entity_title`, `created_at`) + RLS
- [ ] Frontend schreibt Einträge beim Speichern/Erledigen/Löschen (Shopping, ToDo, Notizen)
- [ ] Widget zeigt letzte 5–10 Einträge mit Realtime-Subscription

#### 11.3 Wetter + Luftqualität + KI-Empfehlung Widget ⬜ OFFEN
- [ ] Edge Function `get-weather`: OpenWeatherMap API (kostenlos: 1.000 Calls/Tag) für Wetter + Luftqualität + Pollendaten
- [ ] Live-Location via Browser Geolocation API; Fallback: gespeicherte Stadt/PLZ in `profiles`
- [ ] Gemini generiert aus Wetterdaten kurze Tagesempfehlung ("Schirm mitnehmen", "Sonnencreme nicht vergessen" etc.)

#### 11.4 Tages-Quote / Inspiration Widget ⬜ OFFEN
- [ ] Gemini-Prompt mit täglichem Caching (1x pro Tag generieren, in `home_settings` zwischenspeichern)
- [ ] Alternativ: freie Quotes-API (quotable.io)
- [ ] Fokus: Selbstverwirklichung/Optimierung + interessante Fakten zum Kalendertag

---

### ⚪ Weitere Module (niedrige Prio, Konzepte ausstehend)

### Document Storage (3.4) ⬜ OFFEN
- [ ] Supabase Storage Bucket (`documents`) anlegen inkl. RLS Policies.
- [ ] UI: Listenansicht mit festen Basis-Ordnern (`Apartment`, `Car`, `Insurances`, `Luna`, `Personal`, `Misc`) als **Accordion-Design** (flache Hierarchie, ausklappbar).
- [ ] UI: Funktionalität zum Anlegen von dynamischen Unterordnern innerhalb der Hauptordner.
- [ ] UI: Sticky Suchleiste ganz oben (Live-Filterung über alle Dateinamen).
- [ ] UI: Floating Action Button (FAB) unten rechts für Uploads (Kamera & File-Picker via Bottom-Sheet).
- [ ] UI: Drei-Punkte-Menü (`⋮`) pro Datei für Aktionen (Teilen via Web Share API, Löschen).
- [ ] **Smart Renaming (Zero-Friction Flow):** *Frage an Claude: Bitte den Upload-Flow so bauen, dass der Nutzer keine leeren Formulare ausfüllen muss. Nach Dateiauswahl soll im Hintergrund per Edge Function (Gemini) der Inhalt analysiert werden. Dann öffnet sich ein Dialog mit dem von der KI bereits vorausgefüllten Namensvorschlag. Zwingendes Format: `YYYYMMDD_KATEGORIE_Inhalt` (z.B. `20260501_Car_Leasing-Contract`). Der Nutzer muss nur noch "Speichern" tippen. Bitte Konzept skizzieren und implementieren.*

### Home Info (neu) ⬜ OFFEN
- [ ] Zählernummern (Strom, Gas, Wasser) (Homespezifisch anlegbar, historie der Zählerstände)
- [ ] Vertragsdaten (Anbieter, Vertragsnummer, Laufzeit, Kündigungsfrist)
- [ ] Vermieter-Kontakte
- [ ] Übergabeprotokoll / wichtige Dokumente
- [ ] Wiederkehrende Kosten (Nebenkosten, etc.) -> Evtl Einbindung in Budgeting-Tool

### Car (neu) ⬜ OFFEN
- [ ] Fahrzeugdaten (Kennzeichen, Modell, Erstzulassung, Fahrgestellnummer)
- [ ] Versicherungsdaten (Anbieter, Vertragsnummer, Ablaufdatum)
- [ ] TÜV / HU-Datum mit Kalender-Erinnerung
- [ ] Servicetermine & Kilometerstand-Verlauf
- [ ] Dokumente (Fahrzeugschein, Versicherungsnachweis)

### Luna Portal (3.3) ⬜ OFFEN
- [ ] Info-Dashboard (Chipnummer, Versicherung, Futterplan)
- [ ] Wiederkehrende Tierarzt-Termine → Hauptkalender

### Foto-Notizen (neu — bestätigt 2026-05-14)
- [ ] Supabase Storage Bucket `photo_notes` + Tabelle (`home_id`, `sender_id`, `storage_path`, `caption`, `created_at`) + RLS
- [ ] Frontend: Foto aufnehmen (Camera-API) oder aus Galerie wählen, Caption optional, Upload zu Storage
- [ ] Partner sieht neues Foto via Realtime-Subscription + Toast (analog Sticky Notes)
- [ ] Vollansicht: Foto-Feed chronologisch, Löschen eigener Fotos
- *Homescreen-Widget-Variante: On Hold bis Native-App-Phase*

### Moodboard & Wishlist (3.6) ⬜ OFFEN
- [ ] Web Share Target API
- [ ] Visuelle Sammlung für Ideen und Produktwünsche

### Entertainment & Dining (3.7) ⬜ OFFEN
- [ ] Medien-Watchlist + "Spin the Wheel"
- [ ] Restaurant Favorites + "Spin the Wheel"

### Custom Map (3.8) ⬜ OFFEN
- [ ] Leaflet oder Google Maps API
- [ ] Eigene Pins mit Kategorien
- [ ] Google Maps Listen-Import

### Native App (on hold — nach PWA-Abschluss)
- [ ] Evaluierung: Capacitor als nativer App-Wrapper für iOS & Android
- [ ] Homescreen-Widget für Einkaufsliste, Kalender, Todos (iOS WidgetKit / Android AppWidgets)
- [ ] Homescreen-Widget für Foto-Notizen (Partner sieht Foto direkt im Homescreen-Widget)
- *Erst relevant wenn der gesamte PWA-Ausbau abgeschlossen ist*

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
| — | `012_shopping_categories.sql` | `shopping_categories`, `shopping_subcategories`, `profiles.language`; Default-Kategorien für Home `89cd774f` |
| — | `nav_slots_modules_active` | `home_settings`: `nav_slots` + `modules_active` Default-Werte für Home `89cd774f` per SQL eingefügt |

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
*   **2026-05-13 (Session 1):** Architektur-Entscheidung: Shopping-Kategorien werden per-Home dynamisch in neuen Tabellen `shopping_categories` / `shopping_subcategories` gespeichert (nicht mehr hardcodiert). Jede Kategorie hat `name`, `icon` (Emoji), `color`, `description` (für Gemini-Prompt) und `sort_order`. `Luna` ist KEINE Default-Kategorie für neue Homes. Gemini-Prompt wird dynamisch aus DB gebaut. Per-User Spracheinstellung (`profiles.language`) für EN/DE-Unterstützung. Phase 7 in Roadmap verankert.
*   **2026-05-13 (Session 2):** Phase 8.1 abgeschlossen: Konfigurierbare Navigation + Modul-Manager. `HomeSettings.tsx` neu: 3 Nav-Slots per Dropdown, Modul-Manager mit Drag & Drop (Pointer Events, keine Library). `home_settings`-Keys `nav_slots` + `modules_active` ersetzen separate Feature-Flags. More-Menü komplett umgebaut: dynamische Modul-Cards oben, User-/Home-Settings als Zeilen getrennt. Admin-Rolle aus `home_members.role`. Phase 8.2 (ToDo-Listen) folgt als nächste HOCHPRIO-Aufgabe.
*   **2026-05-13 (Session 2):** Phase 7.3 abgeschlossen: Kategorie-Editor in Shopping-Liste. ⚙️-Icon im Header → Kategorien-Verwaltung. `CategoryEditForm` mit Emoji, 12 Farb-Swatches, AI-Beschreibungsfeld und Live-Vorschau. `CategoryListView` mit ▲▼-Reihenfolge-Buttons. 2-Tap-Löschen mit roter Bestätigung. Kein neues Backend erforderlich.
*   **2026-05-14:** Phase 8.2 verifiziert und abgeschlossen: `todo_lists` + `todo_items` waren bereits vollständig in Supabase vorhanden (alle Spalten, RLS aktiv, Realtime-Publication eingetragen). Frontend `Todos.tsx` war bereits komplett implementiert (Listen-CRUD, Task-CRUD, Inline-Add, Realtime, Push, Dashboard-Widget, i18n EN/DE). Kein weiterer Handlungsbedarf — Feature ist live.
