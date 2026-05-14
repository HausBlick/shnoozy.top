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

**Aktueller Stand (Phase 8.x):** Sticky Notes Deck-Widget, ToDo-Widget, 14-Tage-Kalender, WLAN-Button, Push-Opt-in.

**Geplantes Redesign (Phase 11):**
*   **Fix oben:** Sticky Notes als großes Widget (immer an erster Stelle)
*   **Fix darunter:** Kalender-Widget mit 4–7 kommenden Terminen
*   **Anpassbarer User-Block:** Pro User konfigurierbar — Widgets können hinzugefügt, entfernt und per Drag & Drop sortiert werden. Konfiguration in `dashboard_widgets`-JSON-Spalte in `profiles`. Mögliche Widgets: ToDo-Übersicht, Wetter+KI-Empfehlung, Tages-Quote, Budget-Übersicht, etc.
*   **Fix unten:** WLAN-Sharing Button
*   **Fix ganz unten:** Aktivitäts-Log ("Niko hat Milch zur Einkaufsliste hinzugefügt", "Heron hat Aufgabe X erledigt") — Realtime-Echtzeit-Updates, klickbar, verlinkt direkt zum Modul. Backend: `activity_log`-Tabelle.

**Tool-unabhängige Widgets (für den anpassbaren Block):**
*   Wetter + Luftqualität + Pollen mit KI-Tagesempfehlung (OpenWeatherMap API + Gemini; Live-Location via Geolocation API)
*   Tages-Quote/Inspiration (Gemini oder quotable.io, tägliches Caching)

### 2.6 User-Settings (geplant — Phase 8.3)
*   **Notification Preferences:** Toggles pro Modul — für welche Tools soll der User Push-Benachrichtigungen erhalten? (Shopping, ToDo, Kalender, Dokumente). Gespeichert als JSON in `profiles.notification_preferences`.
*   **Profil bearbeiten:** Display-Name (bereits in DB), Avatar-Foto (Supabase Storage Bucket `avatars`, `avatar_url` in `profiles`). Platzhalter-Avatar aus Initialien wenn kein Foto.
*   **Benachrichtigungszeit:** Individuell pro User einstellbar (erfordert Umbau von `send-daily-push` auf stündlichen Cron + Preference-Check — höherer Aufwand, spätere Phase).
*   **Weitere Kandidaten:** Dark/Light Mode, Standard-Kalenderansicht, Wochenstartag (Mo/So).

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
    *   **Mit Google verknüpft:** Der Nutzer verbindet sein eigenes Google-Konto via OAuth. Die Edge Function `sync-google-tasks` synchronisiert dann nur für diesen Nutzer (seine gespeicherten OAuth-Tokens). Die KI-Kategorisierung greift auch hier. **Niko: Ersteinmal on hold**
*   Google Home Nest: Items per Sprache zu "Shopping list" in Google Tasks → automatisch in App (nur bei aktivierter Google-Integration) **Niko: Ersteinmal on hold**

### 3.3 Luna Portal (Pet Management)
*   **Status:** Placeholder (Coming soon)
*   **Geplant:** Info-Dashboard für Luna (Chipnummer, Versicherung, Futterplan), Termine (Impfungen, Entwurmung, etc.)

### 3.4 Document Storage
*   **Status:** Nicht gestartet
*   **Geplant:** Ordnerstruktur (Apartment, Car, Insurances, Luna), Google Drive oder Supabase Storage

### 3.5 Post-it Board (Änderungen Design/UI)
*   **Neues UI-Konzept:** Die Post-its werden als quadratischer Stapel ("Deck") auf dem Dashboard dargestellt. Sie liegen leicht "unordentlich" (mit leichter, zufälliger Rotation) übereinander, um das physische Gefühl echter Post-its zu imitieren.
*   **Interaktion:** Durch Wischgesten (Swipe links/rechts) wird das jeweils oberste Post-it "umgeblättert" und wandert animiert an das Ende des Stapels (Carousel/Stack-Effekt). Das funktioniert endlos rotierend mit allen Post-its im Stapel. Darunter befindet sich ein "See all"-Button, der zur Vollansicht führt.
*   **Technisches Backend:** Supabase-Tabelle `sticky_notes` mit RLS. Ersteller-basiert gefärbt (Primary für Niko, Luxe für Partner). Sichtbarkeit: "For both" / "For partner". Realtime Toast-Notification bei neuer Note vom Partner. **Niko: Muss noch auf Multiuser angepasst werden**

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

### 3.14 Foto-Notizen (neu — bestätigt 2026-05-14)
*   **Konzept:** Couple-Feature — ein Partner nimmt ein Foto auf (oder wählt aus der Galerie) und fügt optional eine kurze Caption hinzu. Der andere Partner sieht es sofort in der App via Realtime-Notification (Toast, analog Sticky Notes).
*   **Backend:** Supabase Storage Bucket `photo_notes` + Tabelle `photo_notes` (`home_id`, `sender_id`, `storage_path`, `caption`, `created_at`) + RLS (`is_home_member`).
*   **Frontend:** Foto aufnehmen via Camera-API des Browsers oder aus Galerie wählen; chronologischer Foto-Feed; Löschen eigener Fotos.
*   **Homescreen-Widget-Variante (on hold):** Erst umsetzbar mit nativer App (Capacitor) — verschoben in Native-App-Phase.

### 3.11 Smart Home Control (Tuya Integration)
*   **Konzept:** Direkte Ansteuerung lokaler Smart-Home-Geräte (LSC Smart Home Steckdosen/Lampen, Lunvon, Honysmart Saugroboter) über die Tuya IoT Plattform API, ohne Umweg über Google Home.
*   **UI/Dashboard:** Ein zentrales Widget auf dem Dashboard, das alle Geräte auflistet.
*   **Funktionen:** Direkte Toggle-Schalter (An/Aus) für Lampen und Steckdosen. Für den Saugroboter zusätzlich die Anzeige von Batteriestand und Status des Staubbehälters. **Niko: Ersteinmal on hold**

## Projektnotizen von Niko

*   **User-Settings:**
    * Hier müssen wir die Benachrichtigungen für die Kategorien einstellen können. (für welche Tools möchte der User eine Benachrichtigung erhalten, pro Tool und evtl unterkategorien)
      > **Claude:** Vollständig umsetzbar. Eine `notification_preferences`-JSON-Spalte in `profiles` (z. B. `{"shopping": true, "todos": true, "calendar": true}`) reicht als Datenbasis. UI: Toggles in User-Settings. Die Edge Functions (`send-daily-push`, `send-todo-push`) prüfen die Preference vor dem Senden. **Aufwand: Mittel.** → Neue Phase „User-Settings Erweiterungen" (Phase 8.3).
      > **Eingetragen:** In PROJECT_PLAN.md unter „Phase 8.3.1 Notification Preferences" / In project-overview.md unter „2.6 User-Settings".
    * Name und Profilbild (Avatar) bearbeiten (Platzhalter, wenn kein Foto-Upload stattgefunden hat)
      > **Claude:** `display_name` existiert bereits in `profiles` — Bearbeiten ist trivial. Avatar-Upload braucht Supabase Storage Bucket (`avatars`) + `avatar_url`-Spalte in `profiles`. Platzhalter-Avatar (Initial aus display_name) ist als `Avatar`-Komponente in `Todos.tsx` bereits vorhanden und wiederverwendbar. **Aufwand: Name = Einfach, Avatar-Upload = Mittel.** → Gleiche Phase wie Notification-Settings.
      > **Eingetragen:** In PROJECT_PLAN.md unter „Phase 8.3.2 Profil-Bearbeitung" / In project-overview.md unter „2.6 User-Settings".
    * Brainstorming, was noch in die User-Settings gehört
        * Uhrzeit für Terminbenachrichtigungen individuell pro User setzen möglich?
          > **Claude:** Technisch möglich, aber Architektur-Umbau nötig: Der aktuelle `send-daily-push` ist ein fixer pg_cron-Job (8:30 MESZ). Für per-User-Zeiten müsste er stündlich laufen und selbst prüfen, wer jetzt dran ist (`preferred_push_time` in `profiles`). **Aufwand: Hoch.** → Eigener Unterpunkt, erst nach dem Rest der User-Settings angehen.
          > **Eingetragen:** In PROJECT_PLAN.md unter „Phase 8.3.3 Weitere Settings-Kandidaten" / In project-overview.md unter „2.6 User-Settings".
        * Weitere Punkte mit Claude oder Gemini finden.
          > **Claude:** Weitere sinnvolle Kandidaten: Dark/Light Mode Toggle, Standard-Kalenderansicht (Schedule/Monat), Wochenstartag (Mo/So). Alles einfache Felder in `profiles`.
          > **Eingetragen:** In PROJECT_PLAN.md unter „Phase 8.3.3 Weitere Settings-Kandidaten" / In project-overview.md unter „2.6 User-Settings".

*   **Notifications:**
    * Widget mit aktuellen Aktivitäten im Home ("User X hat XXX auf die Einkaufsliste gesetzt" oder "User X hat die Aufgabe XXX als 'erledigt markiert.")
      > **Claude:** Sehr sinnvoll, gut umsetzbar. Neue Tabelle `activity_log` (`home_id`, `user_id`, `action_type`, `entity_type`, `entity_title`, `created_at`). Frontend schreibt Einträge beim Speichern/Erledigen/Löschen. Widget zeigt letzte 5–10 Einträge mit Realtime-Sub. **Aufwand: Mittel.** → Sinnvoll als Teil des Dashboard-Redesigns.
      > **Eingetragen:** In PROJECT_PLAN.md unter „Phase 11.2 Aktivitäts-Log Widget" / In project-overview.md unter „2.5 Startseite (Dashboard) — Geplantes Redesign".
    * Opt-In Option in User-Settings für Push-Notifications bei Shopping List, ToDo, Dokumente (später)
      > **Claude:** Direkt abhängig vom Notification-Preferences-Punkt oben — kaum Mehraufwand wenn das Grundgerüst steht. Einfach weitere Toggle-Einträge in `notification_preferences`. **Aufwand: Gering (sobald Grundgerüst steht).** → In Phase 8.3 integrieren.
      > **Eingetragen:** In PROJECT_PLAN.md unter „Phase 8.3.1 Notification Preferences" / In project-overview.md unter „2.6 User-Settings".

*   **Home-Dashboard:**
    * Folgendes Konzept hat Niko im Kopf: Auf der Startseite sind die Sticky Notes immer als großes Widget an oberster Stelle, darunter das Kalender-Widget mit den kommenden 4-7 Terminen. Dann kommt ein großer Block, der individuell pro User anpassbar ist. In diesem Block, sollen die Widgets pro User anpassbar/Sortierbar sein. Widgets können hinzugefügt und entfernt werden. Konzept ob diese Widgets ein- oder zweispaltige Cards sind ist noch offen. Nach diesem User-individuellen Block kommt der WLAN-Sharing Button und darunter der Aktivitäten-Log. (Konzept muss noch genauer identifiziert werden.)
      > **Claude:** Umsetzbar, aber das aufwändigste Feature dieser Liste. Fester Teil oben (Sticky Notes + Kalender) = einfach, nur Reihenfolge im JSX ändern. Der per-User-Block braucht: `dashboard_widgets`-JSON-Spalte in `profiles` (Array von Widget-IDs + Reihenfolge), Widget-Registry im Frontend, Drag & Drop analog zum bestehenden Modul-Manager. **Aufwand: Hoch.** → Eigene Phase „Dashboard-Redesign" (Phase 11), erst nach User-Settings sinnvoll.
      > **Eingetragen:** In PROJECT_PLAN.md unter „Phase 11.1 Neues Dashboard-Layout" / In project-overview.md unter „2.5 Startseite (Dashboard) — Geplantes Redesign".
    * Weitere Ideen für Tool-Unabhängige Widgets:
        * Air-Qualit Index (für Allergiker mit angabe welche Pollen gerade unterwegs sind, wie bei der Google Wetter App), Kurze Übersicht über das tagesaktuelle Wetter mit AI-Empfehlung für den Tag: "Ich empfehle heute einen Regenschirm mitzunehmen" oder "Vergiss heute nicht, Sonnencreme zu benutzen" oder "Wenn du heute länger unterwegs bist, solltest du eine Jacke mitnehmen", etc.
          > **Claude:** Sehr gut umsetzbar. OpenWeatherMap API (kostenlos: 1.000 Calls/Tag) liefert Wetter + Luftqualität + Pollendaten. Eine Edge Function holt die Daten serverseitig (API Key bleibt geheim). Gemini generiert aus den Rohdaten die Tagesempfehlung — elegante, schlanke KI-Integration. Nutzer-Standort einmalig in `profiles` speichern (Stadt/PLZ reicht). **Aufwand: Mittel.** → Optionales Widget im per-User-Dashboard-Block.
          > **Niko:** Live-Location des Users möglich?
          > **Claude:** Ja, vollständig — der Browser stellt die Geolocation API bereit (`navigator.geolocation.getCurrentPosition()`), die auch in PWAs funktioniert. User erteilt einmalig eine Berechtigung. Der Vorteil: präziseres Wetter als mit einer gespeicherten Stadt (z. B. wenn man gerade unterwegs ist). Kein Storage nötig — Location wird direkt beim Widget-Laden abgefragt und live an die Edge Function übergeben. Fallback auf gespeicherte Stadt/PLZ wenn Berechtigung verweigert. **Aufwand: Gering** (ein einziger API-Call mehr).
          > **Eingetragen:** In PROJECT_PLAN.md unter „Phase 11.3 Wetter + Luftqualität + KI-Empfehlung Widget" / In project-overview.md unter „2.5 Startseite (Dashboard) — Tool-unabhängige Widgets".
        * Inspiration für den Tag: AI-Generierte oder gesuchte Quotes/facts zum aktuellen Tag. Kurze Quotes die Inspirieren (Fokus auf Selbstverwirklichung/Optimierung) oder interessante Fakten zum Kalendertag
          > **Claude:** Einfach. Freie Quotes-API (quotable.io o. ä.) oder Gemini-Prompt mit täglichem Caching (Ergebnis in `home_settings` zwischenspeichern, 1x pro Tag). Kein eigenes Backend nötig. **Aufwand: Gering.** → Kleinstes Widget, kann früh eingebaut werden.
          > **Eingetragen:** In PROJECT_PLAN.md unter „Phase 11.4 Tages-Quote / Inspiration Widget" / In project-overview.md unter „2.5 Startseite (Dashboard) — Tool-unabhängige Widgets".

*   **Externe Widgets: (außerhalb der App)**
    * Widgets die man ausserhalb der App auf dem Home-Screen platzieren kann: Ist das mit dem aktuellen Setup überhaupt möglich auf Android/iOS?
      > **Claude:** **Kurze Antwort: Nein, nicht mit dem aktuellen PWA-Setup.** iOS unterstützt keine Homescreen-Widgets für PWAs (nur native Apps via WidgetKit). Android hat seit Android 12 etwas bessere PWA-Unterstützung, aber Homescreen-Widgets sind auch dort nicht über den Browser erreichbar. Wäre nur mit einem nativen App-Wrapper möglich (z. B. Capacitor) — erheblicher Technologie-Sprung. **Empfehlung: On Hold / Out of Scope für PWA.**
      > **Niko:** Okay, dann stellen wir das nach hinten, wenn wir irgendwann nativ gehen.
      > **Claude:** Notiert. Homescreen-Widgets kommen in eine eigene „Native App"-Phase (Capacitor-Evaluation), die erst relevant wird wenn der PWA-Ausbau abgeschlossen ist.
      > **Eingetragen:** In PROJECT_PLAN.md unter „Native App (on hold — nach PWA-Abschluss)".
    * Ideen:
        * Widget für Einkaufsliste, Kalender, Todos
          > **Claude:** Nur mit nativem App-Wrapper realisierbar (siehe oben). Als PWA nicht machbar.
          > **Niko:** Okay, dann stellen wir das nach hinten, wenn wir irgendwann nativ gehen.
          > **Claude:** Notiert — fällt in dieselbe Native-App-Phase wie der Homescreen-Widget-Block oben.
          > **Eingetragen:** In PROJECT_PLAN.md unter „Native App (on hold — nach PWA-Abschluss)".
        * Widget für "Foto-Notizen": In der App kann ein Foto aufgenommen werden, das der Partner in seinem Homescreen-Widget sieht. (Süßes Couple-Feature)
          > **Claude:** Das **In-App**-Feature (Foto aufnehmen → Partner sieht es in der App) ist vollständig umsetzbar: Supabase Storage Bucket `photo_notes`, Camera-API des Browsers, Realtime-Subscription. Als Homescreen-Widget nicht machbar (PWA-Limitation). **Aufwand für In-App-Version: Mittel.** → Könnte als eigenständiges Modul „Foto-Notizen" in die Roadmap, unabhängig vom Homescreen-Widget-Thema.
          > **Niko:** Okay, dann machen wir das In-App.
          > **Claude:** Perfekt. Wird als Modul „Foto-Notizen" in den PROJECT_PLAN.md aufgenommen (niedrige Prio, Konzept ausstehend). Stack: Supabase Storage Bucket `photo_notes`, `photo_notes`-Tabelle (`home_id`, `sender_id`, `storage_path`, `caption`, `created_at`), Camera-API + Realtime-Sub im Frontend. Das Couple-Feature (Foto sehen sobald Partner es schickt) kommt via Realtime-Toast, analog zu den Sticky Notes.
          > **Eingetragen:** In PROJECT_PLAN.md unter „Foto-Notizen (neu — bestätigt 2026-05-14)" / In project-overview.md unter „3.14 Foto-Notizen".