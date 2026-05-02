# Project Overview: Home-App

## 1. Grundprinzipien & Regeln für die KI
*   **Design-Konformität:** Jede generierte UI-Komponente MUSS sich strikt an die Vorgaben in der `DESIGN.md` halten (Farben, Typografie 'Airbnb Cereal VF' / Fallbacks, Radius-Werte, Shadow-Tiers). Keine Accent-Border verwenden!
*   **Architektur:** Cloud-native SPA (Single Page Application) als PWA (Progressive Web App). Frontend gehostet auf GitHub Pages (`shnoozy.top`), Backend über Supabase (Free Tier).
*   **Setup-Transparenz:** Bevor Code für externe Dienste (Supabase Edge Functions, Webhooks, Google APIs) generiert wird, muss der Nutzer eine präzise, schrittweise Anleitung zur manuellen Einrichtung im jeweiligen Dashboard erhalten.
*   **Sprache:** UI ist auf Englisch (mit gelegentlichen deutschen Begriffen in den Kategorien).

## 2. Kerninfrastruktur
*   **Authentifizierung:** Supabase Auth (E-Mail/Passwort) für 2 spezifische Nutzer. Row Level Security (RLS) schützt alle Tabellen.
*   **PWA-Features:** Install-Popup ("Add to Homescreen") für schnelle Erreichbarkeit auf dem Smartphone. Service Worker für Offline-Caching und Push-Mitteilungen.
*   **Deployment:** GitHub Actions → GitHub Pages → Custom Domain `shnoozy.top` (GoDaddy DNS). Auto-deploy bei jedem Push auf `main`.
*   **Nutzer:** nikolakrnic2@gmail.com (Farbe: Primary #14d8db), heromustafi@gmail.com (Farbe: Luxe #7a041f)
*   **Startseite (Dashboard):**
    *   Widget: Sticky Notes (oben, max. 2, mit "See all" Link)
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

### 3.2 Smart Shopping List ✅
*   Live-synchronisierte Checkliste via Supabase Realtime (`shopping_items` Tabelle)
*   Kategorien: Groceries 🛒, Drogerie 💊, Cleaning 🧹, Luna 🐕, Misc 📦
*   KI-Kategorisierung: Supabase Edge Function `add-shopping-item` mit Gemini API
*   Google Tasks Sync: Edge Function `sync-google-tasks` (OAuth2, alle 2 Min. via pg_cron)
*   Google Home Nest: Items per Sprache zu "Shopping list" in Google Tasks → automatisch in App
*   IFTTT-Alternative: `add-shopping-item` auch per IFTTT-Secret aufrufbar

### 3.3 Luna Portal (Pet Management)
*   **Status:** Placeholder (Coming soon)
*   **Geplant:** Info-Dashboard für Luna (Chipnummer, Versicherung, Futterplan), Termine

### 3.4 Document Storage
*   **Status:** Nicht gestartet
*   **Geplant:** Ordnerstruktur (Apartment, Car, Insurances, Luna), Google Drive oder Supabase Storage

### 3.5 Post-it Board ✅
*   Supabase-Tabelle `sticky_notes` mit RLS
*   Farben: Ersteller-basiert (Primary für Niko, Luxe für Partner)
*   Sichtbarkeit: "For both" oder "For partner" (Toggle beim Erstellen)
*   Eigene Notes editierbar und löschbar
*   Realtime: Toast-Notification wenn Partner eine Note erstellt
*   Dashboard-Widget: max. 2 Notes + "See all" Link zur Vollansicht
*   Vollansicht via More-Tab → Sticky Notes Card

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

---

## Log
*   **2026-05-01:** Grundgerüst fertiggestellt. Design-System (Airbnb) und Navigation implementiert.
*   **2026-05-01:** `PROJECT_PLAN.md` erstellt. Phase 2 (Infrastruktur & Auth) abgeschlossen.
*   **2026-05-01:** Phase 3 abgeschlossen: Kalender mit allen Kategorien, ICS Export, Web-Push Notifications. Müllabfuhr- und Geburtstagsimport. Push-Subscriptions via VAPID.
*   **2026-05-01:** Phase 4 abgeschlossen: Smart Shopping List mit Realtime, Gemini-Kategorisierung, Google Tasks Sync für Google Home Nest Sprachsteuerung.
*   **2026-05-01:** Deployment auf `shnoozy.top` via GitHub Pages + GoDaddy DNS + GitHub Actions CI/CD.
*   **2026-05-01:** Post-it Board (3.5) implementiert: farbcodierte Sticky Notes, Realtime Notifications, Dashboard-Widget.
*   **2026-05-02:** More-Tab mit Cards (Sticky Notes, Home, Car). WiFi-Modal mit QR-Code (qrcode.react) + editierbaren Credentials in `app_settings`. Events RLS geöffnet für beide User. Kalender-Bugfix (projected birthday update/delete). SVG-Icons statt Emojis.
