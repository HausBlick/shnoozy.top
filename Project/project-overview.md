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

### 2.3 Modulares Dashboard
Das Frontend liest beim Start die `home_settings` des aktiven Homes und rendert **ausschließlich** die Module, die der Haushalt aktiviert hat. Module wie das Luna-Portal erscheinen im Dashboard und der Navigation nur dann, wenn `luna_enabled = true` in den Settings des Homes gesetzt ist. Dies vermeidet totes UI für Homes, die bestimmte Features nicht nutzen.

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

### 3.1 Kalender & Erinnerungen ✅
*   Supabase-Tabelle `events` (Geburtstage, Trash, Sonstiges)
*   Kategorien: birthday (Luxe), event (Primary), reminder, trash (#bf7300)
*   Wiederkehrende Events: `recurrence_type = 'yearly'`
*   ICS-Export (RFC 5545, RRULE für Geburtstage)
*   Web-Push-Mitteilungen via Edge Function `send-daily-push` (pg_cron, 8:30 MESZ)
*   74 Müllabfuhr-Termine importiert, Geburtstage importiert

### 3.2 Smart Shopping List
*   Live-synchronisierte Checkliste via Supabase Realtime (`shopping_items` Tabelle, mit `home_id`)
*   **KI-Kategorisierung (Wichtig):** Jedes neu hinzugefügte Item muss zwingend automatisch über die Gemini API in eine der Kategorien (Groceries 🛒, Drogerie 💊, Cleaning 🧹, Luna 🐕, Misc 📦) einsortiert werden.
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

### 3.11 Smart Home Control (Tuya Integration)
*   **Konzept:** Direkte Ansteuerung lokaler Smart-Home-Geräte (LSC Smart Home Steckdosen/Lampen, Lunvon, Honysmart Saugroboter) über die Tuya IoT Plattform API, ohne Umweg über Google Home.
*   **UI/Dashboard:** Ein zentrales Widget auf dem Dashboard, das alle Geräte auflistet.
*   **Funktionen:** Direkte Toggle-Schalter (An/Aus) für Lampen und Steckdosen. Für den Saugroboter zusätzlich die Anzeige von Batteriestand und Status des Staubbehälters.
