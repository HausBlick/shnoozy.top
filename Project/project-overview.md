# Project Overview: Home-App

> **📄 Doku-Info für KI-Agenten:**
> Dieses Dokument (`project-overview.md`) ist das **Konzept-Dokument**. Hier werden alle gewünschten Funktionen und fachlichen Anforderungen konzeptioniert und festgehalten. 
> Für technische Details, ToDos, Datenbank-Migrationen und das technische Log, siehe zwingend die Datei `PROJECT_PLAN.md`.

## 1. Grundprinzipien & Regeln für die KI
*   **Interconnected-First Architektur:** Die gesamte App ist tiefgreifend miteinander verknüpft. Informationen aus verschiedenen Modulen sind übergreifend anklickbar und referenziert. *Beispielhafte Umsetzung:* Die Dokumentenablage ist ordnerbasiert. Alle Dokumente und Unterordner, die physisch im Verzeichnis "Luna" liegen, werden automatisch auch im "Luna Portal" dynamisch aggregiert und sind dort direkt abrufbar.
*   **Design-Konformität:** Jede generierte UI-Komponente MUSS sich strikt an die Vorgaben in der `DESIGN.md` halten (Farben, Typografie 'Airbnb Cereal VF' / Fallbacks, Radius-Werte, Shadow-Tiers). Keine Accent-Border verwenden!
*   **Architektur:** Cloud-native SPA (Single Page Application) als PWA (Progressive Web App). Frontend gehostet auf GitHub Pages (`shnoozy.top`), Backend über Supabase (Free Tier).
*   **Setup-Transparenz:** Bevor Code für externe Dienste (Supabase Edge Functions, Webhooks, Google APIs) generiert wird, muss der Nutzer eine präzise, schrittweise Anleitung zur manuellen Einrichtung im jeweiligen Dashboard erhalten.
*   **Sprache:** UI ist auf Englisch (mit gelegentlichen deutschen Begriffen in den Kategorien).

## 2. Kerninfrastruktur

### 2.1 Multi-Tenancy Architektur (Mandantenfähigkeit)
Die App ist grundlegend als Multi-Home-Plattform konzipiert. Mehrere unabhängige Haushalte ("Homes") können die App nutzen, vollständig voneinander isoliert.

**Kerntabellen:**
*   **`homes`** — Repräsentiert einen Haushalt (Name, Icon, Erstellungsdatum).
*   **`home_members`** — Verknüpfungstabelle zwischen Nutzern und Homes. Enthält eine `role`-Spalte (`'admin'` oder `'member'`). Ein Nutzer kann theoretisch Mitglied mehrerer Homes sein; das Frontend beschränkt ihn vorerst auf ein einziges aktives Home.
*   **`home_settings`** — Key-Value-Store pro Home. Steuert, welche Module (z. B. `luna_enabled`, `shopping_enabled`) für diesen Haushalt aktiviert sind.

**Strikte Datentrennung via `home_id`:**
Alle Datentabellen (`events`, `sticky_notes`, `shopping_items`, etc.) tragen eine `home_id`-Spalte als Foreign Key auf `homes`. Die Isolation der Haushalte wird **zwingend** über Supabase Row Level Security (RLS) Policies sichergestellt — kein Datensatz eines Homes ist jemals für Mitglieder eines anderen Homes lesbar oder schreibbar.

### 2.2 Einladungssystem (Share-Links)
Neue Mitglieder werden vom Home-Admin über **sichere, zeitlich begrenzte Share-Links** eingeladen. Es gibt keinen E-Mail-Versand durch das System.

*   Der Admin generiert im UI einen Einladungslink; dieser enthält ein serverseitig erzeugtes, kryptographisch zufälliges Token.
*   Das Token wird in einer `home_invitations`-Tabelle gespeichert (`token`, `home_id`, `role`, `expires_at`, `used_at`).
*   Einladungslinks sind **7 Tage** gültig und verfallen nach einmaliger Nutzung.
*   Ein neuer Nutzer, der dem Link folgt, registriert sich (oder loggt sich ein) und wird anschließend automatisch dem entsprechenden Home mit der definierten Rolle zugewiesen.

### 2.3 Modulares Dashboard & Konfigurierbare Navigation
Das Frontend liest beim Start die `home_settings` des aktiven Homes und rendert **ausschließlich** die Module, die der Haushalt aktiviert hat. Module wie das Luna-Portal erscheinen im Dashboard und der Navigation nur dann, wenn `luna_enabled = true` in den Settings des Homes gesetzt ist. Dies vermeidet totes UI für Homes, die bestimmte Features nicht nutzen.

**Konfigurierbare Bottom-Navigation ✅ (implementiert):**
Die Bottom-Navigation hat **3 frei belegbare Slots** (2 links, 1 rechts des Home-Buttons). Der "More"-Button ist immer fix ganz rechts. Der Admin des Homes konfiguriert die Slots über "Home Einstellungen" (nur für Admins im More-Menü sichtbar).
*   `home_settings`-Key `nav_slots`: JSON-Array mit 3 Modul-IDs (z. B. `["calendar","lists","notes"]`).
*   `home_settings`-Key `modules_active`: geordnetes JSON-Array aller aktiven Module — bestimmt auch die Reihenfolge der Cards im More-Menü. Ersetzt separate Feature-Flags (`luna_enabled` etc.).
*   Module, die nicht in `modules_active` stehen, sind komplett inaktiv (erscheinen weder in Nav noch im More-Menü).
*   **Modul-Manager:** Drag & Drop (Pointer Events, keine externe Library) zum Umsortieren und Aktivieren/Deaktivieren. Aktive Module oben, inaktive unten — Trennlinie ist die Grenze.
*   Module mit eigenen Einstellungen (z. B. Shopping → Kategorien) erhalten im Bearbeiten-Modus ein ⚙️-Icon.

### 2.4 Authentifizierung & Deployment
*   **Authentifizierung:** Supabase Auth (E-Mail/Passwort). RLS auf allen Tabellen, ergänzt durch `home_id`-basierte Isolation.
*   **PWA-Features:** Install-Popup ("Add to Homescreen") für schnelle Erreichbarkeit auf dem Smartphone. Service Worker für Offline-Caching und Push-Mitteilungen.
*   **Deployment:** GitHub Actions → GitHub Pages → Custom Domain `shnoozy.top` (GoDaddy DNS). Auto-deploy bei jedem Push auf `main`.
*   **Gründungsnutzer:** nikolakrnic2@gmail.com (Farbe: Primary #14d8db), heromustafi@gmail.com (Farbe: Luxe #7a041f)

### 2.5 Startseite (Dashboard)
*   Widget: Sticky Notes (oben, max. 2, mit "See all" Link)
*   Widget: Letzte Aktivitäten (interaktive Echtzeit-Updates wie "[Name] hat Milch zur Einkaufsliste hinzugefügt" oder "Neues Post-it von [Name]", die direkt zum entsprechenden Modul verlinken)
*   Widget: Anstehende Termine (14 Tage)
*   Gast-WLAN Anzeige
*   Push-Notification Opt-in

## 3. Funktionsmodule (Tools)

### 3.1 Kalender & Erinnerungen ✅ + Erweiterungen geplant
*   Supabase-Tabelle `events` (Geburtstage, Trash, Sonstiges)
*   Kategorien: birthday (Luxe), event (Primary), reminder, trash (#bf7300)
*   Wiederkehrende Events: `recurrence_type = 'yearly'`
*   ICS-Export (RFC 5545, RRULE für Geburtstage)
*   Web-Push-Mitteilungen via Edge Function `send-daily-push` (pg_cron, 8:30 MESZ)
*   74 Müllabfuhr-Termine importiert, Geburtstage importiert

**Geplante Erweiterung A — Kalender-Abonnements (ICS-URL Import):**
Nutzer können externe Kalender (Google Calendar, iCloud, Outlook) per ICS-URL abonnieren. Alle Mitglieder des Homes sehen die importierten Einträge.
*   Neue Tabelle `calendar_subscriptions` (`id`, `home_id`, `name`, `ics_url`, `color` [Hex], `show_on_dashboard` [bool], `last_synced_at`).
*   Eine Edge Function `sync-calendar-subscriptions` (pg_cron, z. B. alle 6h) fetcht die ICS-URLs und schreibt die Events in eine separate Tabelle `external_events` (mit `subscription_id`).
*   Im UI: Kalender-Einstellungen → "Subscribe" → URL eingeben, Farbe wählen, Toggle "Auf Dashboard anzeigen".
*   Die Events werden in der eigenen Farbe der Subscription dargestellt und sind schreibgeschützt (kein Edit/Delete möglich).
*   **Anwendungsfall:** Private Google-Kalender-Termine (Urlaub, Arzttermine) für alle sichtbar machen, ohne sie manuell doppelt einzutragen.

**Geplante Erweiterung B — Mehrere Kalenderansichten:**
Neben der bestehenden Schedule-Ansicht (vertikale Listenansicht) werden Monats-, Wochen- und Tagesansicht ergänzt. Toggle oben im Kalender-Header (Segmented Control: Schedule | Monat | Woche | Tag).
*   **Monatsansicht:** Klassisches Grid (7 Spalten × 5–6 Reihen). Tage mit Events erhalten farbige Dots (nach Kategorie). Tap auf einen Tag → öffnet die Tagesansicht oder klappt die Events darunter auf.
*   **Wochenansicht:** Zeitstrahl (0–24 Uhr) mit 7 Spalten. Events als farbige Blöcke mit Dauer. Ganztägige Events als Banner oben.
*   **Tagesansicht:** Zeitstrahl für einen einzelnen Tag, mit allen Events als Blöcke.
*   Design-Referenz: Fantastical / Google Calendar — kompakt, farbkodiert, keine überladene Chrome.

### 3.2 Smart Shopping List
*   Live-synchronisierte Checkliste via Supabase Realtime (`shopping_items` Tabelle, mit `home_id`)
*   **KI-Kategorisierung ✅:** Jedes neu hinzugefügte Item wird automatisch über die Gemini API kategorisiert. Die Kategorien sind **per Home dynamisch** (`shopping_categories`-Tabelle): Name, Emoji-Icon, Farbe, `sort_order` und eine `description` (Freitext-Beschreibung für Gemini, z. B. "Tierbedarfsprodukte für unseren Hund Luna"). Neue Homes erhalten Standard-Kategorien (ohne Luna). Admins können Kategorien über das ⚙️-Icon in der Shopping-Liste erstellen, bearbeiten, umsortieren und löschen.
*   **Optionale Google Tasks Integration:** Die Synchronisation mit Google Tasks ist **optional** und wird pro Nutzer individuell über OAuth eingerichtet. Nutzer können wählen:
    *   **Nur intern:** Die Einkaufsliste läuft vollständig über Supabase — keine externe Verknüpfung.
    *   **Mit Google verknüpft:** Der Nutzer verbindet sein eigenes Google-Konto via OAuth. Die Edge Function `sync-google-tasks` synchronisiert dann nur für diesen Nutzer (seine gespeicherten OAuth-Tokens). Die KI-Kategorisierung greift auch hier.
*   Google Home Nest: Items per Sprache zu "Shopping list" in Google Tasks → automatisch in App (nur bei aktivierter Google-Integration)
*   IFTTT-Alternative: `add-shopping-item` auch per IFTTT-Secret aufrufbar

### 3.3 Luna Portal (Pet Management)
*   **Status:** Placeholder (Coming soon)
*   **Geplant:** Info-Dashboard für Luna (Chipnummer, Versicherung, Futterplan), Termine

### 3.4 Document Storage
*   **Status:** Nicht gestartet
*   **Geplant:** Ordnerstruktur (Apartment, Car, Insurances, Luna), Google Drive oder Supabase Storage

### 3.5 Post-it Board (Änderungen Design/UI)
*   **Neues UI-Konzept:** Die Post-its werden als quadratischer Stapel ("Deck") auf dem Dashboard dargestellt. Sie liegen leicht "unordentlich" (mit leichter, zufälliger Rotation) übereinander, um das physische Gefühl echter Post-its zu imitieren.
*   **Interaktion:** Durch Wischgesten (Swipe links/rechts) wird das jeweils oberste Post-it "umgeblättert" und wandert animiert an das Ende des Stapels (Carousel/Stack-Effekt). Das funktioniert endlos rotierend mit allen Post-its im Stapel. Darunter befindet sich ein "See all"-Button, der zur Vollansicht führt.
*   **Technisches Backend:** Supabase-Tabelle `sticky_notes` mit RLS. Ersteller-basiert gefärbt (Primary für Niko, Luxe für Partner). Sichtbarkeit: "For both" / "For partner". Realtime Toast-Notification bei neuer Note vom Partner.

### 3.9 Home Info (neu, Placeholder)
*   **Geplant:** Zählernummern (Strom, Gas, Wasser), Vertragsdaten, Vermieter-Kontakte, Dokumente
*   Erreichbar über More-Tab

### 3.10 Car (neu, Placeholder)
*   **Geplant:** Fahrzeugdaten, Versicherung, TÜV/HU-Datum, Service-Historie, Dokumente
*   Erreichbar über More-Tab

### 3.6 Moodboard & Wishlist
*   **Status:** Nicht gestartet
*   **Geplant:** Web Share Target API, visuelle Sammlung für Ideen und Produktwünsche

### 3.7 Entertainment & Dining
*   **Status:** Nicht gestartet
*   **Geplant:** Medien-Watchlist + "Spin the Wheel", Restaurant Favorites + "Spin the Wheel"

### 3.8 Custom Map (Places & Memories)
*   **Status:** Nicht gestartet
*   **Geplant:** Leaflet oder Google Maps API, eigene Pins mit Kategorien, Google Maps Import

### 3.12 ToDo-Listen & Aufgaben (geplant)
Gemeinsame, aufgabenbasierte Listen mit Projektkategorien und Zuweisung an Home-Mitglieder.

*   **Multi-Listen:** Pro Home können mehrere benannte Listen (Projekte) angelegt werden — z. B. "Wohnung renovieren", "Urlaub planen", "Einkäufe erledigen". Jede Liste hat Name, Icon und Farbe.
*   **Tasks:** Jede Aufgabe hat: Titel, optionale Beschreibung, Fälligkeitsdatum, Status (`open` | `in_progress` | `done`), optionale Zuweisung an ein Home-Mitglied.
*   **Zuweisung:** Beim Erstellen/Bearbeiten kann eine Aufgabe einem bestimmten Mitglied zugeteilt werden. Zugewiesene Aufgaben erscheinen mit Avatar/Farbindikator. Optional: Push-Notification bei neuer Zuweisung.
*   **Dashboard-Widget:** "Meine offenen Aufgaben" — zeigt die dem eingeloggten User zugewiesenen Tasks mit höchster Priorität.
*   **Realtime:** Supabase Realtime für Live-Sync. Abgehakte Tasks verschieben sich ans Ende (Soft-Done, analog zur Shopping-Liste).
*   **Backend:** Tabellen `todo_lists` (`id`, `home_id`, `name`, `icon`, `color`, `sort_order`) + `todo_items` (`id`, `list_id`, `home_id`, `title`, `description`, `due_date`, `status`, `assigned_to` [user_id], `created_by`, `sort_order`).

### 3.13 Haushaltsbuch / Budgeting-Tool (geplant)
Gemeinsames Tracking von Ausgaben und Einnahmen mit Kostensplitting und Übersicht.

**Ausbaustufe 1 — Manuelle Eingabe (MVP):**
*   Nutzer gibt Ausgaben manuell ein: Betrag, Kategorie (Lebensmittel, Miete, Freizeit, etc.), Bezahlt von (welcher User), Datum, Notiz.
*   **Kostensplitting:** Jede Ausgabe kann als "geteilt" (50/50 oder konfigurierbarer Split) oder "persönlich" (nur einer trägt es) markiert werden.
*   **Übersicht:** Monatliche/jährliche Auswertung nach Kategorie (Balken-/Kreisdiagramm). Bilanz: Wer hat wie viel beigetragen? Was wird noch ausgeglichen?
*   **Backend:** Tabellen `budget_categories` (per Home, ähnlich Shopping-Kategorien) + `budget_entries` (`id`, `home_id`, `user_id`, `amount`, `category_id`, `description`, `date`, `split_mode` [`shared`|`personal`], `split_ratio`).

**Ausbaustufe 2 — Foto-Scan (KI-gestützt):**
*   Nutzer fotografiert einen Kassenbon oder eine Rechnung.
*   Gemini Vision API analysiert das Bild und extrahiert: Gesamtbetrag, Händler/Name, Datum, einzelne Positionen (optional).
*   Vorausgefülltes Formular öffnet sich — Nutzer korrigiert ggf. und speichert mit einem Tap.
*   Einsatzbereich: Supermarktbons, Restaurantrechnungen, Online-Rechnungen (PDF-Upload).

### 3.11 Smart Home Control (Tuya Integration)
*   **Konzept:** Direkte Ansteuerung lokaler Smart-Home-Geräte (LSC Smart Home Steckdosen/Lampen, Lunvon, Honysmart Saugroboter) über die Tuya IoT Plattform API, ohne Umweg über Google Home.
*   **UI/Dashboard:** Ein zentrales Widget auf dem Dashboard, das alle Geräte auflistet.
*   **Funktionen:** Direkte Toggle-Schalter (An/Aus) für Lampen und Steckdosen. Für den Saugroboter zusätzlich die Anzeige von Batteriestand und Status des Staubbehälters.
