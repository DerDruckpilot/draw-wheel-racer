# Umsetzung und spätere Abnahme

Entwurf vom 22. September 2026. Noch keine Umsetzung oder Tests durchgeführt.

## Phase 0 – Recherche und Klärung

- Privates Repository anlegen.
- Technische Optionen, Quellen, Grenzen und Ideen dokumentieren.
- Produktfragen beantworten lassen und daraus den tatsächlichen Umfang festlegen.

## Phase 1 – Physikprototyp

Ein Fahrzeug, Zeichenfeld, flacher Boden, Rampe und Stufe. Zuerst prüfen, ob beliebige Formen verlässlich fahren, bevor weitere Inhalte entstehen.

Geplante Nachweise:

- Kreis, Dreieck, gezackte Form und offenes C besitzen sichtbar passende Kollisionsformen.
- Dieselbe Form fährt bei derselben Versuchsanordnung reproduzierbar vergleichbar; verschiedene Renderbildraten ändern nicht absichtlich das Spielergebnis.
- Runde Räder haben auf einer glatten Strecke weniger geometrisch verursachte Vertikalbewegung als unregelmäßige Formen.
- Bei sehr geringer Reibung kann der Antrieb durchdrehen; das Chassis erhält keinen unsichtbaren Vorwärtsschub.
- Motor aus auf ebener Strecke: kein dauerhafter Energiegewinn aus Kontaktfehlern.
- Wiederholtes Zeichnen, Kreuzungen, winzige Eingaben, Abbruch einer Geste und Wechsel am Hindernis erzeugen keine ungültigen Körper oder Abstürze.
- Eine lange Radspitze schlägt im vorgesehenen Geschwindigkeitsbereich nicht durch eine Stufe.
- Radwechsel werden auf Durchdringung und künstliche Energiegewinne geprüft. Die endgültige Wechselregel wird dokumentiert.

## Phase 2 – Spielbare iPhone-PWA

Hochformatoberfläche, Installierbarkeit, lokaler Spielstand, Offline-Ressourcen, Pause, Neustart und erste fertige Strecke. Konkretes Zielgerät aus der Antwort des Auftraggebers verwenden.

Geplante Nachweise:

- Start aus Safari und vom Home-Screen; keine verdeckten Bedienelemente am Home-Indikator.
- Fingerzeichnen scrollt die Seite nicht und bleibt bei häufigen Radwechseln bedienbar.
- Nach vollständig abgeschlossenem Erstdownload funktioniert ein Neustart im Flugmodus.
- Appwechsel und Rückkehr setzen keine riesige verstrichene Zeit in einen einzigen Physikschritt um.
- Ein PWA-Update unterbricht kein laufendes Rennen und löscht den Spielstand nicht unbeabsichtigt.
- Zielwert zunächst 60 Bilder/s, bei Bedarf abgestufte Grafik; tatsächliche Bildzeiten und längeres Verhalten auf dem iPhone messen. Noch keine Zusage einer Mindestbildrate.

## Phase 3 – Bestätigter Spielumfang

Gegner oder Zeitfahren gemäß Entscheidung, zusätzliche Untergründe und Hindernisse, Strecken, Sound und Fortschritt. Gegner sollen denselben bestätigten Physikregeln folgen. Bodenmodelle werden isoliert verglichen, bevor Strecken davon abhängen.

## Phase 4 – Bereitstellung

HTTPS-Hosting, kurze Installationsanleitung, dokumentierte Quellen und Lizenzhinweise, abschließender Test auf dem Zielgerät. Veröffentlichung und Zugriffsmodell richten sich nach dem bestätigten Verwendungszweck. Hostingkosten sind aktuell nicht autorisiert.

## Technische Risiken und zugehörige Versuche

| Risiko | Geplanter Versuch |
| --- | --- |
| Unruhige Kontakte an vielen kurzen Segmenten | Segmentzahl, Glättung und Physikschritt an denselben Formen vergleichen |
| Katapult-Effekt beim Radwechsel | Wiederholte Wechsel direkt auf Stufe, Boden und unter Hindernis |
| Zu viele Körper bei Gegnern und Geröll | Längere Session mit endgültiger Fahrzeugzahl auf dem Zielgerät |
| Schlechte Verständlichkeit der Formwirkung | Einfache Vergleichsstrecke mit identischen Startbedingungen |
| Weicher Boden fühlt sich nur wie Geschwindigkeitsmalus an | Einsinken, Schlupf und Widerstand getrennt beobachten und abstimmen |
| Offline-App lädt einzelne Ressourcen nach | Flugmodus-Neustart nach Erstdownload einschließlich WASM und Audio |

Die Testliste beschreibt spätere Verifikation. Ein fertiger Prototyp oder bestandene Tests werden damit nicht behauptet.
