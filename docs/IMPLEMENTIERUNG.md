# FORMDRIVE 1.1 – Implementierung

Stand: 22. September 2026. Dieses Dokument beschreibt die tatsächliche Implementierung; ältere Konzept- und Roadmap-Dokumente sind die Recherchehistorie.

## Inhalt

- Zwölf Rennen in Canyon, Alpen und Steinbruch; ein separates Testgelände mit optionaler Zeitlupe.
- Automatischer Antrieb, drei Computergegner auf unabhängigen Fahrspuren.
- Freihandzeichnen mit Finger oder Maus. Ein durchgehender, auch offener oder selbstkreuzender Strich bestimmt alle Räder; Übernahme beim Loslassen.
- Größenlimit, sichtbare Achsmarkierung, fünf Formvorlagen, Rückgängig und lokal gespeicherte Lieblingsform.
- Straße, Fels, Eis, Schlamm, Stufen, Steigungen, Sprunglücken, Baumstämme, Wippen und niedrige Durchfahrten.
- Flache Furten und tiefe Schwimmabschnitte mit Auftrieb und formabhängiger Paddelwirkung.
- Pause, Checkpoint-Bergung, lokale Bestzeiten und Sterne, Auswahl aller Strecken für Tests.
- Abschaltbarer synthetischer Motorsound; automatische, hohe und sparsame Grafikqualität.
- Installierbare PWA mit vollständigem lokalem Asset-Cache und bewusst bestätigten App-Updates.

## Architektur

TypeScript, Vite, Three.js, Rapier 2D, vite-plugin-pwa/Workbox. Exakte Versionen stehen im Lockfile.

- `src/shapes.ts`: Begrenzung und Neuabtastung der Zeichnungen sowie Vorlagen.
- `src/courses.ts`: Streckenprofile, Oberflächen, Wasser und Hindernisse.
- `src/physics.ts`: Welt, Fahrzeuge, Achsen, Federung, Wasserkräfte, Radwechsel und Gegner.
- `src/renderer.ts`: 3D-Fahrzeuge, Terrain, Materialien, Felsmodelle, Beleuchtung und Wasseroberfläche.
- `src/drawing.ts`: Pointer-Eingabe und Zeichenvorschau.
- `src/main.ts`: Zustände, Oberfläche, Spielstand und PWA-Integration.
- `src/audio.ts`: lokal erzeugter Ton ohne zusätzliche Audiodateien.

## Physikmodell

Feste Schritte von 1/120 Sekunde. Ein Fahrzeug besitzt Chassis und Überrollkäfig als Kollisionsformen, zwei Radkörper und zwei leichte Achsträger. Prismenverbindungen mit Feder-Dämpfer-Motoren bilden die Federung; Drehgelenke verbinden die Räder mit den Trägern. Der Antrieb liefert seit Version 1.1 maximal 58 statt 20 Drehmomenteinheiten pro physikalischem Rad, mit Gegenwirkung auf das Chassis. Die Zieldrehzahl bleibt gleich. Es gibt keinen pauschalen Vorwärtsschub.

Der Strich wird in höchstens 48 Punkte umgesetzt. Kapseln bilden die verdickten Abschnitte; vier dünne Speichen verbinden diese mit der Nabe. Masse wächst mit Strichlänge. Oberfläche und Kollisionsform verwenden dieselben Punkte. Die vier sichtbaren Räder teilen sich zwei physikalische Achsen; seitliche Bewegung und Kollision zwischen Fahrspuren werden nicht simuliert.

Die niedrigere Reibung eines Kontaktpaars bestimmt die Traktion. Dadurch bleibt Eis trotz griffigem Radmaterial rutschig. Schlamm verwendet zusätzlichen Widerstand, jedoch kein verformbares Bodenmodell und kein physikalisches Einsinken.

Sechs Auftriebspunkte approximieren das verdrängte Chassisvolumen. Der Rumpfwiderstand berücksichtigt die lokale Bewegung der Punkte einschließlich Drehung. Untergetauchte Radabschnitte erfahren normalen Druckwiderstand und wesentlich kleineren tangentialen Widerstand; daraus entsteht die Paddelwirkung. Ein glatter Ring erzeugt entsprechend wenig Wasservortrieb. Die visuelle Wasseroberfläche nutzt animierte Wellen und Glanz. Es gibt keine vollständige Flüssigkeits- oder Wellensimulation.

Ein Radwechsel ist eine nichtphysikalische Spielregel. Kleine Lagekorrekturen vermeiden Bodenüberlappungen; unter einer zu niedrigen Decke kann ein wachsendes Rad bis zum nächsten passenden Physikschritt warten. Die Winkelgeschwindigkeit wird so begrenzt, dass der Wechsel allein keine zusätzliche Rotationsenergie erzeugt. Checkpoint-Bergungen sind explizite Rücksetzungen.

## Grafik und Assets

Eigenes detailliertes Buggy-Modell mit Rahmen, Sitzen, Fahrer, Stoßdämpfern, Lichtkörpern und Schwimmkörpern. Photogrammetrie-Fels von Poly Haven, für wiederholte Hintergrunddarstellung auf rund 8.000 Dreiecke reduziert. Farb-, Normalen- und Rauheitstexturen in 1K; draußen aufgenommenes HDRI für Himmel und Umgebungslicht. Materialdetail und mobile Renderauflösung werden getrennt behandelt.

Hohes Profil: bis zu zweifache Pixelauflösung und Schatten. Automatik: startet mit maximal 1,6-facher Auflösung und kann bei langsamen Bildern reduzieren. Sparsam: einfache Pixelauflösung ohne Schatten. Das ist keine garantierte Bildrate auf dem Ziel-iPhone; Messungen am tatsächlichen Gerät sind noch erforderlich.

## Tests

- `npm test`: Eingabegrenzen, Vortrieb über Kontakt, Eis-Traktion, Energieverhalten ohne Antrieb, offene Formen, wiederholte Radwechsel, Auftrieb/Paddelantrieb und Instanziierung aller Strecken. Dazu Regressionstests für Anfahren mit Dreiecksrädern, den Vergleich Paddel/Rundrad in tiefem Wasser, die Durchquerungszeit einer Furt und gegensätzliche Formanforderungen an Stufen/Durchfahrten einschließlich Befreiung durch Zeichnen. Ein weiterer Test prüft das zurückgestellte Vergrößern unter einem niedrigen Dach bis zur sicheren Ausfahrt.
- `npm run test:courses`: vollständige Fahrten aller zwölf Rennen und des Testgeländes mit einer Wechselstrategie zwischen Rundrad, Klaue, kleinen Rädern und Paddeln. Erwartet Zielankunft ohne Bergung; protokolliert Zeit, Lage und Bergungen.
- `npm run test:browser`: produktiver Build in Chromium und WebKit mit 440 × 956 CSS-Pixeln; Zeichnen, Favoriten, Pause/Fortsetzen, Bergen, Wasserstrecke, Ergebnisdialog und Streckenauswahl. Ein separater Chromium-Test prüft den vollständigen Neustart ohne Netzwerk.
- `npm run build`: strenge TypeScript-Prüfung, Produktionsbuild und PWA-Precache-Erzeugung.

Alle 13 Strecken wurden mit echten Simulationsschritten bis zum Ziel gefahren, ohne Bergungen; die Fahrzeiten lagen nach dem Balancing zwischen 62,5 und 109,8 Sekunden. Die elf automatischen Physiktests bestanden. Vergleichswerte und Änderungen stehen in [BALANCING-1.1.md](BALANCING-1.1.md).

Playwrights Windows-WebKit bricht die simulierte Offline-Navigation mit einem internen Browserfehler ab. Die [Playwright-Dokumentation](https://playwright.dev/docs/service-workers) unterstützt Service-Worker-Werkzeuge ausschließlich für Chromium; der Offline-Test wird daher für WebKit ausdrücklich übersprungen. Das ist keine Bestätigung des Offlinebetriebs auf iOS.

Ein emulierter Mobilbrowser ist kein Test auf einem echten iPhone 16 Pro Max mit iOS 27. Installation über das iOS-Teilen-Menü, Offline-Neustart, thermisches Verhalten und längere Gerätesessions müssen auf dem tatsächlichen Zielgerät geprüft werden.

## Veröffentlichung und Betrieb

Die GitHub-Actions-Pipeline installiert mit `npm ci`, führt Physik- und vollständige Streckentests aus, baut und veröffentlicht `dist` über GitHub Pages. Es werden keine kostenpflichtigen Dienste genutzt. Alle Laufzeitassets liegen im Repository; externe Quellen sind nur für die optionale erneute Assetbeschaffung nötig.

Der Service Worker speichert die Anwendung einschließlich Physik, Bildern, Modell und HDRI. Der erstmalige Download benötigt Internet. Erst bei „Offline bereit“ ist der vollständige Offlinecache installiert. Ein Update wird über die Einstellungen bestätigt; ein laufendes Rennen wird nicht automatisch neu geladen. Fortschritt und Einstellungen liegen in `localStorage` und können durch Löschen von Browserdaten verloren gehen.
