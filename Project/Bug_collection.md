# Bug Collection
## Anweisung für Claude
Niko nimmt hier im Verlauf immer wieder kleinere und größere Bugs auf. 
Claude liest die Datei immer komplett durch und evaluiert, ob es sich um einen Main-Bug oder einen kleinen Bug handelt.
Sobald der Bug behoben wurde, vermerkt Claude das in einem Kommetar direkt unter dem Bug. (Wann behoben, was wurde gefixt, haben wir hier etwas geändert)


### Bug Collection V1

 1. Profilbild/Avatar für jeden User eigenes Bild (derzeit haben alle mein hochgeladenes Bild) und in den Tools, widgets etc. auch wirklich anzeigen, derzeit ist der Platzhalter überall zu sehen.
 2. Pushbenachrichtigungen bei Neuen Sticky-Notes, Shopping List, Calendar, Tasks kommen nicht mehr durch, fehler finden und fixen (dauerhaft)
 3. Budget-Settings: Wenn Split individually eingestellt ist, dann kann ich nirgends den Split eingeben, wann bringt mir das Setting etwas?
 4. Budget: Bei keinem Gemeinsamen Konto wäre ein "Who Paid" cool.
 5. Zurück-Button bei Profile und Home Settings auf "<"-Icon ändern (wie monatsswitcher)
    > ✅ Behoben Session 12/13 — ChevronLeft SVG in App.tsx (UserSettings, home-info, car) und HomeSettings.tsx ersetzt.
 6. Bei Budget alle Felder mit Datum fix auf DD.MM.YYYY statt MM/DD/YYY ändern und Geldbeträge immer fix auf 37,99 statt 37.99 (Komma statt punkt und smart erkennen, wenn ein Punkt in der eingabe genutzt wird - Automatisch in Komma umwandeln)
    > ✅ Behoben Session 12/13 — formatAmt() immer de-DE Locale; alle Budget-Inputs auf type="text"/inputMode="decimal" mit auto dot→comma; parseFloat-Aufrufe mit comma→dot Normalisierung; Datumsfelder auf DD.MM.YYYY.
 7. Gemini KI Erkennung bei Budgets funktioniert noch nicht. Testen
    > ⏸️ On Hold — Gemini API-Key hat keinen Zugriff auf gemini-2.5-flash (403 PERMISSION_DENIED). UI-Button in Budget-FAB und BudgetQuickExpenseModal deaktiviert bis API-Zugriff geklärt. EF-Fix (maxOutputTokens 256→1024, non-thought part extraction) ist bereits deployed (v9).

### Bug Collection V2
 1. Ich habe Kalendereinträge in meiner Home-ID. ein Anderer Nutzer erhält aber die Notifications meiner Einträge, obwohl er eine andere Home-ID hat.
 Meine Home-ID: 89cd774f-b26e-40ce-9362-7589ded42c8d
 Die andere Home-ID, die meine Kalendereinträge als Push-Benachrichtigung bekommt: 01302f88-5d75-4e01-b96d-e1684e968021
 **Wichtig:** Nur Benachrichtigungen, die aus der eigenen Home-ID kommen, sollen an den user gesendet werden, auf keinen Fall aus anderen Home-IDs.
 2. 