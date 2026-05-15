# Project Plan: Shnoozy.top

> **⚙️ Doku-Info für KI-Agenten:**
> Dieses Dokument (`PROJECT_PLAN.md`) ist das **technische Datenblatt** des Projekts. Es enthält die ToDo-Listen, technische Details, durchgeführte Migrationen (SQLs), verwendete externe Tools, Edge Functions sowie ganz unten das **technische Log**. 
> Für das fachliche Konzept siehe zwingend die Datei `project-overview.md`.

## Current Status
**Live unter:** https://shnoozy.top
**Phase:** Phase 16 ✅ — Wiederkehrende Ausgaben + Geplante Änderungen (Session 9, 2026-05-15)
**Nächste Phase:** Nächste Schritte nach Absprache — offen

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

#### 6.4 Einladungssystem (Link-Generator) ✅ FERTIG (2026-05-14)
- [x] Tabelle `home_invitations` angelegt (Schema bereit)
- [x] Frontend `HomeOnboarding.tsx`: "Join Home"-Tab vorhanden, ruft `accept-invite` auf
- [x] **Edge Function `accept-invite`**: JWT-auth'd, Token validieren, `home_members` INSERT, Token als used markieren
- [x] **Edge Function `generate-invite`**: JWT-auth'd, Admin-Check, Token erzeugen, `home_invitations` INSERT, Link zurückgeben
- [x] **Frontend `HomeSettings.tsx`**: Invite-Sektion (nur Admin), Web Share API + Clipboard-Fallback, Link-Anzeige, i18n (en/de)

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

#### 8.3.2 Profil-Bearbeitung ✅ FERTIG (2026-05-14)
- [x] `display_name` editierbar in User-Settings (Textfeld + Save-Button)
- [x] `avatar_color` — Farb-Picker mit 8 vordefinierten Farben in User-Settings
- [x] Avatar-Preview in User-Settings (Kreis mit Initial + gewählter Farbe)
- [x] Farbe wird in Todos-Avatar-Komponente genutzt (aus `profiles.avatar_color` statt hardcoded)
- [x] Sticky Notes zeigen Strip + Hintergrund in der Farbe des Erstellers (`hexToLight` + `memberColors`-Prop)
- [x] `memberColors` + `memberAvatarUrls`-State in App.tsx — bereit für Activity-Widget (Phase 11)
- [x] Avatar-Upload: Supabase Storage Bucket `avatars` + `avatar_url`-Spalte in `profiles`; Bild ersetzt Farb-Kreis in Settings + Todos; Kamera-Badge zum Auslösen; "Foto entfernen"-Link

#### 8.3.3 Weitere Settings-Kandidaten ✅ TEILFERTIG (2026-05-14)
- [x] Dark/Light Mode Toggle (`theme`-Feld in `profiles`) — `[data-theme="dark"]` CSS-Variablen, Toggle in Settings
- [x] Standard-Kalenderansicht (`default_calendar_view` in `profiles`) — Segmented Control in User-Settings, sofort gespeichert
- [ ] Wochenstartag Mo/So (`week_start` in `profiles`) — nicht benötigt (Woche ist immer Mo-So)
- [ ] Push-Uhrzeit individuell pro User (`preferred_push_time` in `profiles`) — erfordert Architektur-Umbau von `send-daily-push` (Hoch-Aufwand, zurückgestellt)

---

### 🟢 Phase 9: Kalender-Erweiterungen

#### 9.1 Kalender-Ansichten ✅ FERTIG (2026-05-14)
- [x] Segmented Control im Kalender-Header: Agenda | Monat | Woche
- [x] **Agenda-Ansicht:** ab heute (keine Vergangenheit), farbige Category-Chips mit pastelMedium-Fill + linkem Border
- [x] **Monatsansicht:** 7-Spalten-Grid (Mo-So), Event-Chips (11px, gefärbt, max. ~2 pro Tag), Tap → Tagesdetail
- [x] **Wochenansicht:** KW-Header, 7-Tage-Strip, Event-Chips (10px), Tap → Tagesdetail (identisch mit Monat)
- [x] Sticky Header (h1 + Export-Button + View-Toggle) mit `position: sticky; top: 0`
- [x] `getCatChipStyle()` mit rgba-Fills + dunklem Text + linkem Accent-Border
- [x] `window.scrollTo(0, 0)` on mount (kein Scroll-Jump bei View-Wechsel)

#### 9.1b ICS-Export ✅ FERTIG (2026-05-14)
- [x] Edge Function `ics-feed` deployed (verify_jwt: false, Token-Auth via `home_settings.ical_token`)
- [x] Token-Generierung + Reset in HomeSettings (alle Mitglieder)
- [x] Copy-URL + Web Share API, REFRESH-INTERVAL PT1H im ICS-Header
- [x] i18n en/de für alle ICS-Strings

#### 9.2 Kalender-Abonnements (ICS-URL Import) ✅ FERTIG (2026-05-14)
- [x] SQL-Migration: `calendar_subscriptions` + `external_events`, RLS, Realtime-Publication
- [x] Edge Function `sync-ical-subscriptions` (pg_cron alle 6h, verify_jwt: false): RFC 5545 Parser (Line-Unfolding, DATE/DATETIME, Timezone-Heuristik), Upsert via Delete+Insert-Batch, max 2000 Events/Feed. Aufruf per `{ subscription_id }` für sofortige Erstsynchronisierung nach Hinzufügen.
- [x] HomeSettings: Abonnements-Liste mit Farbpunkt + Name + letzter Sync-Zeit; Add-Formular (ICS-URL, Name, 8-Farb-Picker); Löschen mit 2-Tap-Bestätigung; sofortiger Sync nach Hinzufügen
- [x] Kalenderansichten: externe Events in allen 3 Views (Agenda, Monat, Woche) mit Subscription-Farbe als Chip/Karte; Tag-Detail zeigt externe Events unterhalb regulärer Events; schreibgeschützt (kein Edit-Modal)

---

### ✅ Phase 10: Budgeting-Tool MVP (abgeschlossen 2026-05-14)

#### 10.1 Haushaltsbuch — Manuelle Eingabe (MVP) ✅
- [x] SQL-Migration: `budget_categories` + `budget_entries`, RLS, Default-Kategorien eingefügt
- [x] `Budget.tsx` MVP: Overview + Entries Tabs, Monat-Navigation, Add/Edit-Modal, i18n

### ✅ Phase 12: Budget v2 (abgeschlossen Session 8, 2026-05-15)

#### 12.1 DB-Migration ✅
- [x] `budget_categories`: + `budget_limit`, `period` ('weekly'|'monthly'|'yearly'), `category_type` ('expense'|'income')
- [x] `budget_entries`: + `entry_type` ('expense'|'income'), `paid_by uuid → profiles`, `receipt_url text`; `split_mode` Default auf 'shared' gesetzt
- [x] Neue Tabelle `budget_entry_splits` (entry_id, home_id, user_id, amount, is_settled) + RLS
- [x] Neue Tabelle `budget_savings_goals` (home_id, name, icon, color, target_amount, current_amount, sort_order) + RLS

#### 12.2 Setup-Wizard ✅
- [x] `BudgetWizard`-Komponente: 9 Schritte (shared account → split mode → Kategorien → Periode → Budget-Limits → Sparziel → KI-Belege → Summary)
- [x] Erkennung via `home_settings.budget_setup_done`
- [x] Admin-only: Members sehen "Setup ausstehend"-Karte
- [x] Wizard schreibt alle Settings (`budget_shared_account`, `budget_split_mode`, `budget_default_period`, `budget_ai_receipts`) + legt Kategorien + Sparziel an

#### 12.3 Budget Dashboard ✅
- [x] Horizontale Kategorie-Bars mit monatsnormierten Limits (wöchentlich×Tage/7, jährlich/12)
- [x] Farbkodierung: grün (<80%), gelb (80–100%), rot (>100%)
- [x] Quick-Actions: ⚙ Einstellungen | + Ausgabe ▾ (Submenü: KI/Manuell) | + Einnahme (wenn shared account)
- [x] Savings Goals: Fortschrittsbalken + manuelle Einzahlung (mit Banking-Disclaimer) + Surplus-Vorschlag
- [x] Einnahmen/Ausgaben-Totals

#### 12.4 Expense/Income Entry Form ✅
- [x] Betrag (großes Eingabefeld, rot bei Ausgabe / grün bei Einnahme)
- [x] Kategorie-Chips nach `entry_type` gefiltert
- [x] Datum, Beschreibung, Paid-By-Picker (Avatare), Shared/Personal-Toggle
- [x] Behebt Silent-Save-Bug: war `is_shared boolean`, korrekt ist `split_mode 'shared'|'personal'`

#### 12.5 Budget-Settings ✅
- [x] CRUD für Budget-Kategorien: Name, Icon, Farbe, Limit, Periode, Typ (Ausgabe/Einnahme)
- [x] CRUD für Sparziele: Name, Icon, Farbe, Zielbetrag, aktueller Betrag

#### 12.6 Dashboard Mini-Widget ✅
- [x] `BudgetDashboardWidget` in App.tsx: zeigt bis zu 5 Kategorie-Bars mit period-normierten Limits + Farbkodierung
- [x] Setup-Pending-State wenn Wizard noch nicht abgeschlossen

#### 12.7 Einladungs-Hints ✅
- [x] `HomeOnboarding.tsx`: Admin-Hint (Create Home) + Member-Hint (Join Home) mit Rollen-Erklärung

#### 12.8 KI-Belegerfassung ✅ FERTIG (Session 8, 2026-05-15)
- [x] Edge Function `analyze-receipt` (Gemini 1.5 Flash Vision, base64-Input → amount + description + category_id, JWT-Auth, v2)
- [x] `AiScanModal`-Komponente in Budget.tsx: Datei/Kamera-Input, base64-Encoding, EF-Aufruf, Analyse-State, Fehler-State
- [x] Nach Analyse: vorausgefülltes Ausgaben-Formular (amount, description, category_id), User kann bearbeiten + speichern
- [x] Quick-Action Submenü im Dashboard: "🤖 KI-Scan" öffnet AiScanModal → bei Erfolg weiter in EntryModal

---

### ✅ Phase 14: UX-Polish Budget + Kalender (Session 8, 2026-05-15)
- [x] Ausgabe/Einnahme Quick-Actions im Budget-Dashboard 50/50 nebeneinander
- [x] "+ Neuer Eintrag"-Button bei Wiederkehrende Ausgaben im Dashboard (teal pill)
- [x] "+ Betrag einzahlen"-Button bei Sparzielen (teal pill)
- [x] `RecurringItemModal` extrahiert als eigenständige Komponente (wiederverwendbar aus Dashboard + Settings)
- [x] Kalender: FAB (floating) entfernt → "+ Termin"-Pill-Button im Header (vor Gear-Icon)
- [x] Kalender Event-Modal auf Bottom-Sheet-Pattern umgestellt (war `modal-overlay`/`modal-content`)
- [x] Gear-Icon vereinheitlicht: Budget, Kalender, Listen — alle 36×36 Kreis, `var(--color-surface-strong)`, SVG 17×17

### ✅ Phase 15: Shopping→Budget Bridge (Session 8, 2026-05-15)
- [x] `BudgetQuickExpenseModal` exportiert aus Budget.tsx — self-contained, fetcht eigene Kategorien/Mitglieder/Settings
- [x] Lists.tsx importiert + zeigt "Fertig mit dem Einkauf?"-Card am Ende der Liste (nur wenn `budget_setup_done`)
- [x] `budgetEnabled` State: liest `home_settings.budget_setup_done` beim Mounten
- [x] i18n: `shoppingBudgetPrompt` + `shoppingRecordExpense` (DE/EN)

### ✅ Phase 16: Wiederkehrende Ausgaben — Geplante Änderungen (Session 8, 2026-05-15)
- [x] DB-Migration: `budget_recurring_changes` (recurring_item_id, change_type: 'cancellation'|'price_change', effective_date, new_amount)
- [x] RLS via `is_home_member` durch JOIN auf `budget_recurring_items`
- [x] `effectiveRecurring(item, changes, monthStart)` Helper: berechnet effektiven Betrag + cancelled-Status für jeden Monat
- [x] Auto-Booking respektiert Kündigungen + Preisänderungen historisch korrekt
- [x] `RecurringItemModal`: "+ Vertrag kündigen" (Datum) + "+ Preisanpassung" (Datum + neuer Betrag) + Löschen einzelner Änderungen
- [x] Dashboard: Stift-Button ✏️ zum Bearbeiten, effektiver Betrag angezeigt, Upcoming-Change-Badges (⚠️ Kündigung / 📈 Preiserhöhung)
- [x] Datumsformat in Änderungs-Badges: DD.MM.YYYY (formatDate-Helper)

### ✅ Phase 17: Globale UX — Abgerundete Buttons + Notizen-Header (Session 9, 2026-05-15)
- [x] Alle Text-Aktionsbuttons: `borderRadius: var(--rounded-full)` → `var(--rounded-sm)` (8px) in Calendar, Budget, Lists, StickyNotes
- [x] Neuer i18n-Key `calNewEvent` (DE: "Termin", EN: "Event") — Kalender-Header-Button
- [x] StickyNotes: "+ Notiz"-Button von Board-Unterkante in Modul-Header verschoben; `onBack`-Prop für App.tsx-Navigation
- [x] App.tsx: Notizen-Tab rendert nur noch `<StickyNotes onBack=.../>` (kein separater Header mehr)
- [x] Unberührt (korrekte Pill-Form beibehalten): Farbswatches, Icon-Kreis-Buttons (Gear/Close/Add), Chips, AQI/Pollen-Badges, Member-Selector
- [x] TS6133-Bugfix: `PlusIcon`-Komponente aus Calendar.tsx entfernt (war nach FAB-Entfernung nicht mehr referenziert)
- [x] `.fab`-CSS-Klasse aus index.css entfernt (Dead Code seit Phase 14)

---

### ✅ Phase 11: Dashboard-Redesign (abgeschlossen Session 6, 2026-05-14)

#### 11.1 Neues Dashboard-Layout ✅ FERTIG
- [x] Sticky Notes fix an oberster Stelle
- [x] Kalender-Widget: nächste 7 Events (statt unlimitierter 14-Tage-Liste), 30-Tage-Range
- [x] Per-User anpassbarer Widget-Block: `dashboard_widgets`-JSON-Spalte in `profiles`; ▲/▼-Buttons in User-Settings
- [x] WLAN-Sharing Button fix vorletzte Position
- [x] Aktivitäts-Log fix als letztes Widget

#### 11.2 Aktivitäts-Log Widget ✅ FERTIG
- [x] SQL-Migration: `activity_log`-Tabelle (home_id, user_id, action_type, entity_type, entity_title, created_at) + RLS + Realtime
- [x] Instrumentation: Todos.tsx (add/edit/complete/delete), StickyNotes.tsx (add), Lists.tsx (add item), Budget.tsx (add/edit/delete)
- [x] Dashboard-Widget: letzte 8 Einträge, Realtime-Subscription, Avatar-Farbkreis + Display Name + Relativ-Zeit
- [x] "Alle anzeigen →" öffnet ActivityLogModal mit vollständiger Historie (bis 100 Einträge)
- [x] `lib/activityLog.ts` fire-and-forget Helper

#### 11.3 Wetter + KI-Empfehlung Widget ✅ FERTIG
- [x] Edge Function `get-weather` (OpenWeatherMap API + Air Pollution API parallel, Gemini-Empfehlung, Emoji-Mapping, CORS)
- [x] `OPENWEATHER_API_KEY` als Supabase Secret erforderlich (manuell setzen)
- [x] WeatherWidget: Geolocation API → Edge Function → localStorage-Cache (1h TTL, sprachspezifischer Cache-Key)
- [x] Anzeige: Emoji + Temp, Beschreibung, Stadt, Luftfeuchtigkeit, Wind, AQI-Badge (farbkodiert), PM2.5/PM10/O₃/NO₂, Gemini-Empfehlung (DE/EN)
- [x] Reload-Button (↺) neben Stadtname: löscht Cache, fetcht neu, Spin-Animation während Laden
- [x] Reorderable + togglebar: 'weather' in dashboardWidgets, User-Settings zeigt alle 5 Widgets mit Toggle + ▲/▼

#### 11.4 Tages-Quote Widget ✅ FERTIG
- [x] Edge Function `get-daily-quote`: Gemini generiert tägl. inspirierende Aussage in DE/EN (max 2 Sätze)
- [x] localStorage-Cache: Key = `shnoozy_quote_{lang}_{YYYY-MM-DD}`, TTL 24h (automatisch am nächsten Tag neu)
- [x] QuoteWidget: großes Anführungszeichen, kursiver Text, Error/Loading States
- [x] Standardmäßig deaktiviert — User aktiviert in User-Settings

#### 11.5 Pollen Widget ✅ FERTIG
- [x] Edge Function `get-pollen`: Google Pollen API (GRASS/TREE/WEED), Index 0–5 mit Farb- und DE/EN-Label-Mapping
- [x] `GOOGLE_MAPS_API_KEY` als Supabase Secret erforderlich (manuell setzen)
- [x] localStorage-Cache: 6h TTL analog WeatherWidget
- [x] PollenWidget: 3 Zeilen (🌿/🌳/🌱), farbkodierte Index-Badges (grün→rot)
- [x] Standardmäßig deaktiviert — User aktiviert in User-Settings

#### 11.6 User-Settings Dashboard-Widgets ✅ FERTIG
- [x] Alle 5 mittleren Widgets (Aufgaben, Budget, Wetter, Zitat, Pollen) mit Toggle-Schaltern in User-Settings
- [x] Enabled-Widgets werden in ihrer Reihenfolge gerendert (Bug fix: ALL_MIDDLE-Order → enabledWidgets-Order)
- [x] Disabled-Widgets unterhalb der enabled Widgets ohne Reorder-Pfeile
- [x] Kalender-Label in User-Settings: "Kalender: Standard-Ansicht" (DE) / "Calendar: Default View" (EN)

#### 11.7 Einmaliger Starter-Guide (Tour Modals) ✅ FERTIG
- [x] `profiles.tours_seen` JSONB-Array (Migration `add_tours_seen_to_profiles`)
- [x] `TourModal`-Komponente: Bottom-Sheet-Overlay, 👋-Header, Bullet-Liste, "Verstanden!"-Button
- [x] `TOURS`-Konstante in App.tsx mit DE+EN-Texten für 6 Tools: Dashboard, Aufgaben, Kalender, Notizen, Einkauf, Budget
- [x] Einmalig pro Tab beim ersten Besuch, in DB persistiert (geräteübergreifend)

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
| — | `phase11_activity_log_dashboard_widgets` | `activity_log`-Tabelle + RLS + Realtime; `profiles.dashboard_widgets` JSONB-Spalte (Default `["todos","budget","weather"]`) |
| — | `add_tours_seen_to_profiles` | `profiles.tours_seen` JSONB-Array (Default `[]`) für einmalige Tour-Modals |
| — | `seed_default_shopping_categories_on_home_create` | `handle_new_home()`-Trigger erweitert: seeded 5 Default-Kategorien (Fruits & Veggies, Drogerie, Cleaning, Groceries+9 Subs, Misc) für jedes neue Home |

## ⚙️ Supabase Edge Functions

| Function | Trigger | Zweck | Status |
|----------|---------|-------|--------|
| `add-shopping-item` | HTTP (Frontend, JWT-Auth) | Item hinzufügen + Gemini-Kategorisierung | ✅ aktiv |
| `sync-google-tasks` | pg_cron alle 2 Min | Google Tasks → Shopping List | ✅ aktiv (braucht `DEFAULT_HOME_ID` Secret) |
| `send-daily-push` | pg_cron täglich 8:30 MESZ | Push-Notifications für Kalender-Termine | ✅ aktiv |
| `send-note-push` | HTTP (Frontend) | Push-Notification bei neuer Sticky Note (prüft `notes_new`-Präferenz pro User) | ✅ aktiv |
| `accept-invite` | HTTP (Frontend, JWT-Auth) | Einladungslink einlösen → `home_members` eintragen | ✅ aktiv |
| `generate-invite` | HTTP (Frontend, JWT-Auth) | Einladungstoken erstellen (Admin) | ✅ aktiv |
| `ics-feed` | HTTP (public, Token-Auth) | ICS-Kalender-Feed für externe Abonnements | ✅ aktiv |
| `sync-ical-subscriptions` | HTTP (pg_cron alle 6h + Frontend) | Externe ICS-Feeds fetchen, parsen, in `external_events` speichern | ✅ aktiv |
| `send-todo-push` | HTTP (Frontend, JWT-Auth) | Push-Notification bei Task-Zuweisung (prüft `todo_assigned`-Präferenz) | ✅ aktiv |
| `get-weather` | HTTP (Frontend, JWT-Auth) | OpenWeatherMap + Air Pollution API + Gemini-Tagesempfehlung | ✅ aktiv (braucht `OPENWEATHER_API_KEY` Secret) |
| `get-daily-quote` | HTTP (Frontend, verify_jwt: false) | Gemini generiert tägl. Quote in DE/EN | ✅ aktiv |
| `get-pollen` | HTTP (Frontend, verify_jwt: false) | Google Pollen API (GRASS/TREE/WEED, Index 0–5) | ✅ aktiv (braucht `GOOGLE_MAPS_API_KEY` Secret) |
| `analyze-receipt` | HTTP (Frontend, JWT-Auth) | Gemini 1.5 Flash Vision → Betrag + Beschreibung + Kategorie aus Foto | ✅ aktiv |

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
*   **2026-05-14 (Session 3):** Phase 8.3.1 (Notification Preferences) abgeschlossen: `notification_preferences`-JSONB-Spalte in `profiles`, 5 Toggles in User-Settings (calendar_daily, todo_assigned, todo_due_today, shopping_item_added, notes_new). `send-daily-push` + `send-todo-push` prüfen Prefs per User. Cron 06:30 UTC = 08:30 MESZ.
*   **2026-05-14 (Session 3):** Phase 8.3.2 (Profil-Bearbeitung) vollständig abgeschlossen: Display-Name-Bearbeitung mit haptischem Save-Button ("Gespeichert"-Feedback), Avatar-Farb-Picker (8 Farben), Avatar-Foto-Upload via Supabase Storage Bucket `avatars` (max. 2 MB, JPEG/PNG/WebP, RLS). `avatar_color` + `avatar_url` überall: Todos-Avatare, `memberColors`-Map in App.tsx. DB: `avatar_url TEXT`, `theme TEXT DEFAULT 'light'` Spalten zu `profiles` migriert.
*   **2026-05-14 (Session 3):** Sticky Notes Sichtbarkeit neu: 3 Modi (`private`/`all`/`others`) statt bisher 2. `normalizeVisibility()` für Legacy-Kompatibilität (`both`→`all`, `partner`→`all`). DB CHECK-Constraint erweitert. `send-note-push` Edge Function deployed (prüft `notes_new`-Präferenz). `hexToLight()` für opake Pastell-Hintergründe. `visibleNotes` useMemo filtert nach Modus.
*   **2026-05-14 (Session 3):** Phase 8.3.3 (Erscheinungsbild) teilweise: Dark/Light Mode Toggle. `theme`-Spalte in `profiles`. `[data-theme="dark"]` CSS-Block mit 13 Farb-Variablen. Gespeichert in DB, wird beim Login geladen. Standard-Kalenderansicht + Wochenstartag zurückgestellt (warten auf Phase 9.1).
*   **2026-05-14 (Session 3):** Service Worker komplett überarbeitet: `skipWaiting()` + `clients.claim()` für sofortige Aktivierung. Network-first für HTML (immer aktueller Code), Cache-first für gehashte Assets (`/assets/*`). Behebt "PWA zeigt alten Stand"-Problem auf iOS/Android.
*   **2026-05-14 (Session 3):** Dark Mode Bug-Fixes: `button { color: inherit }` global (Button-Text war Browser-Standard-Schwarz). `.form-input` + `option` in Dark Mode mit explizitem `background`/`color`. `.sticky-note { color: #222 }` hardcoded (Pastell-Hintergründe brauchen immer dunkle Schrift). Logout-Button aus Dashboard-Header entfernt (nur noch in Mehr → Profil → Abmelden).
*   **2026-05-14 (Session 4):** Phase 9.2 (ICS-Import / Kalender-Abonnements) abgeschlossen: `calendar_subscriptions` + `external_events` Tabellen mit RLS + Realtime. EF `sync-ical-subscriptions` deployed (pg_cron alle 6h + manuell per `subscription_id`). RFC 5545 Parser in Deno (Line-Unfolding, DATE/DATETIME, CET-Fallback für nicht-UTC). HomeSettings: Abonnements verwalten (Add mit 8-Farb-Picker, Delete 2-Tap, Sofort-Sync). Kalender: externe Events in Agenda/Monat/Woche mit Subscription-Farb-Chips, schreibgeschützt.
*   **2026-05-14 (Session 4):** Phase 9.1 (Kalender-Ansichten + ICS-Export) abgeschlossen: Agenda/Monat/Woche-Views mit Sticky Header, farbigen Event-Chips (getCatChipStyle, rgba-Fill + linker Border). Agenda zeigt nur heute + Zukunft (kein Scroll-Jump). `ics-feed` Edge Function deployed (Token-Auth, REFRESH PT1H). ICS-Sektion in HomeSettings (Token generieren, URL kopieren/teilen/zurücksetzen). i18n en/de vollständig.
*   **2026-05-14 (Session 4):** Phase 6.4 Einladungssystem vollständig implementiert: EF `generate-invite` (JWT-auth'd, Admin-Check über `home_members.role`, `crypto.randomUUID()`-Token, INSERT in `home_invitations`, gibt `https://shnoozy.top?token=…` zurück), EF `accept-invite` (JWT-auth'd, Token-Validierung, idempotenter `home_members` INSERT, Token als used markieren). Frontend `HomeSettings.tsx`: Invite-Sektion nur für Admins sichtbar, Web Share API + Clipboard-Fallback, Link-Anzeige, "Neuen Link erstellen"-Reset. i18n en/de vollständig.
*   **2026-05-14 (Session 7):** WeatherWidget: Reload-Button (↺) neben Stadtname, löscht localStorage-Cache und fetcht live, Spin-Animation via `@keyframes spin`. AQI aus Air Pollution API integriert (farbkodiertes Badge + PM2.5/PM10/O₃/NO₂). Gemini-Empfehlung sprachabhängig (DE/EN, separater Cache-Key pro Sprache).
*   **2026-05-14 (Session 7):** Phase 11.4–11.5: QuoteWidget (Gemini, 24h localStorage-Cache nach Datum+Sprache) + PollenWidget (Google Pollen API, 6h Cache, Geolocation) als neue Dashboard-Widgets. EFs `get-daily-quote` + `get-pollen` deployed. Beide standardmäßig deaktiviert, in User-Settings aktivierbar.
*   **2026-05-14 (Session 7):** Phase 11.6: User-Settings Dashboard-Widget-Sektion komplett überarbeitet: alle 5 mittleren Widgets (Aufgaben, Budget, Wetter, Zitat, Pollen) mit Toggle-Schaltern; Enabled-Widgets in ihrer Reihenfolge gerendert (Bug fix für Reorder-Anzeige); Disabled-Widgets getrennt darunter. Kalender-Label präzisiert.
*   **2026-05-14 (Session 7):** Phase 11.7: Einmaliger Starter-Guide (Tour Modals). Migration `add_tours_seen_to_profiles` (`profiles.tours_seen` JSONB). `TourModal`-Komponente als Bottom-Sheet-Overlay. `TOURS`-Konstante mit DE+EN-Texten für 6 Tools. Erscheint einmalig beim ersten Besuch jedes Tabs, wird sofort in DB persistiert (geräteübergreifend kein zweites Mal).
*   **2026-05-14 (Session 7):** Bug fixes: (1) Shopping-Kategorien werden für DE-User übersetzt (`CAT_TRANSLATIONS`-Map in Lists.tsx — DB-Werte bleiben Englisch für Gemini). (2) `handle_new_home()`-Trigger erweitert: seeded ab sofort 5 Default-Kategorien + 9 Groceries-Subkategorien für jedes neue Home (ohne Luna — die ist nur für Home `89cd774f`).
*   **2026-05-15 (Session 8):** Phase 12.8 (KI-Belegerfassung) abgeschlossen: EF `analyze-receipt` deployed (Gemini 1.5 Flash Vision, base64-Input, JWT-Auth). `AiScanModal`-Komponente in Budget.tsx: Datei/Kamera-Picker, Analyse-State, Fehler-Fallback. Nach Analyse öffnet sich EntryModal mit vorausgefüllten Feldern. Quick-Action-Submenü im Dashboard mit "🤖 KI-Scan" Option.
*   **2026-05-15 (Session 8):** Phase 14 (UX-Polish): Budget Quick-Actions 50/50, "+ Neuer Eintrag" bei Wiederkehrenden + "+ Betrag einzahlen" bei Sparzielen als teal Buttons. `RecurringItemModal` als eigenständige Komponente extrahiert. Kalender: FAB entfernt → Header-Pill-Button; Event-Modal auf Bottom-Sheet umgestellt. Gear-Icon in Budget + Kalender + Listen vereinheitlicht (36×36, surface-strong Hintergrund).
*   **2026-05-15 (Session 8):** Phase 15 (Shopping→Budget Bridge): `BudgetQuickExpenseModal` in Budget.tsx exportiert (self-contained). Lists.tsx zeigt "Fertig mit dem Einkauf?"-Card am Listenende (nur wenn Budget aktiviert). i18n: `shoppingBudgetPrompt` + `shoppingRecordExpense`.
*   **2026-05-15 (Session 8):** Phase 16 (Wiederkehrende Ausgaben — Geplante Änderungen): DB-Tabelle `budget_recurring_changes` (RLS via JOIN auf recurring_items). `effectiveRecurring()`-Helper für monatsgenaue Betrag-/Kündigungs-Logik. `RecurringItemModal` erweitert: Kündigung (Datum) + Preisanpassung (Datum + neuer Betrag) + Löschen. Dashboard: ✏️-Bearbeiten-Button, effektive Beträge, Upcoming-Change-Badges (⚠️/📈). Datumsformat DD.MM.YYYY.
*   **2026-05-15 (Session 9):** Phase 17 (Globale Button-UX): Alle Text-Aktionsbuttons app-weit von `rounded-full` auf `rounded-sm` (8px) umgestellt (Calendar, Budget, Lists, StickyNotes). Neuer i18n-Key `calNewEvent` (Termin/Event). StickyNotes: "+ Notiz"-Button aus Board-Unterkante in Modul-Header verschoben, `onBack`-Prop für Zurück-Navigation. TS6133-Bugfix (PlusIcon in Calendar.tsx). Dead-Code `.fab`-CSS entfernt.
