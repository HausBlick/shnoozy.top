# Project Overview: Home-App

## 1. Grundprinzipien & Regeln für die KI
*   **Design-Konformität:** Jede generierte UI-Komponente MUSS sich strikt an die Vorgaben in der `DESIGN.md` halten (Farben, Typografie 'Airbnb Cereal VF' / Fallbacks, Radius-Werte, Shadow-Tiers). Keine Accent-Border verwenden!
*   **Architektur:** Cloud-native SPA (Single Page Application) als PWA (Progressive Web App). Frontend gehostet auf GitHub Pages, Backend über Supabase (Free Tier).
*   **Setup-Transparenz:** Bevor Code für externe Dienste (Supabase Edge Functions, Webhooks, Google APIs) generiert wird, muss der Nutzer eine präzise, schrittweise Anleitung zur manuellen Einrichtung im jeweiligen Dashboard erhalten.
*   **Sprache:** UI ist auf Englisch (mit gelegentlichen deutschen Begriffen in den Kategorien).

## 2. Kerninfrastruktur
*   **Authentifizierung:** Supabase Auth (E-Mail/Passwort) für 2 spezifische Nutzer. Row Level Security (RLS) schützt alle Tabellen.
*   **PWA-Features:** Install-Popup ("Add to Homescreen") für schnelle Erreichbarkeit auf dem Smartphone. Service Worker für Offline-Caching und Push-Mitteilungen.
*   **Startseite (Dashboard):** 
    *   Quicklinks zu allen Tools.
    *   Widget: Anstehende Termine.
    *   Widget: Letzte Aktivitäten (Was wurde neu hinzugefügt/geändert).
    *   Gast-WLAN QR-Code-Anzeige.

## 3. Funktionsmodule (Tools)

### 3.1 Kalender & Erinnerungen
*   **Konzept:** Eigene Supabase-Tabelle für Termine (Geburtstage, Apartment, Luna, Abwesenheiten).
*   **Benachrichtigungen:** Web-Push-Mitteilungen über PWA Service Worker an die Smartphones.
*   **Export:** ICS-Feed-Generierung, um den Kalender in externen Apps (Tablet/Büro) "Read-Only" zu abonnieren.

### 3.2 Smart Shopping List
*   **Konzept:** Live-synchronisierte Checkliste via Supabase Realtime.
*   **Sprachsteuerung:** Todoist als unsichtbares Backend. Google Home fügt Items via Sprache zu Todoist hinzu, Webhook pusht diese in Supabase.
*   **KI-Kategorisierung:** Supabase Edge Function nutzt Google Gemini API (Free Tier). Neue Einträge werden in Millisekunden in 5 Kategorien sortiert: *Groceries, Cleaning Supplies, Luna, Drogerie, Misc*.

### 3.3 Luna Portal (Pet Management)
*   **Konzept:** Info-Dashboard für den Hund (Chipnummer, Versicherung, Futterplan).
*   **Termine:** Verwaltung wiederkehrender Termine (Impfungen, Entwurmung), die automatisch in den Hauptkalender (3.1) eingespeist werden.

### 3.4 Document Storage
*   **Konzept:** Klassische Ordner- und Unterordner-Struktur (Apartment, Car, Insurances, Luna).
*   **Verknüpfung:** Der "Luna"-Ordner ist direkt mit dem Luna Portal (3.3) verknüpft.
*   **Storage:** Google Drive API oder Supabase Storage.

### 3.5 Post-it Board
*   **Konzept:** Digitale Pinnwand für flüchtige Notizen und kurze Nachrichten an den Partner.

### 3.6 Moodboard & Wishlist
*   **Konzept:** Visuelle Sammlung für Ideen und Produktwünsche.
*   **Sharing:** Nutzt die Web Share Target API. Links (z. B. aus der Amazon-App) können direkt über das Smartphone-Teilen-Menü an das Moodboard gesendet werden.

### 3.7 Entertainment & Dining
*   **Medien-Watchlist:** Sammelstelle für Filme/Serien. Inklusive "Spin the Wheel" (Zufallsgenerator).
*   **Restaurant Favorites:** Kuratierte Liste lokaler Restaurants. Inklusive "Spin the Wheel".

### 3.8 Custom Map (Places & Memories)
*   **Konzept:** Interaktive Karte (via Leaflet oder Google Maps API).
*   **Funktionen:** Setzen eigener Pins mit eigenen Kategorien (z. B. "Been with Luna").
*   **Erweiterung:** Import-Möglichkeit von bestehenden Google-Maps-Listen.

---

## Log
*   **2024-05-01:** Grundgerüst fertiggestellt. Design-System (Airbnb) und Navigation implementiert.
*   **2024-05-01:** `PROJECT_PLAN.md` erstellt, um Fortschritt und nächste Schritte detailliert zu tracken. Start von Phase 2 (Infrastruktur) vorbereitet.