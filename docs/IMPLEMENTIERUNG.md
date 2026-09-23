# FORMDRIVE 1.4 – Implementierung

Stand: 23. September 2026. Dieses Dokument beschreibt die tatsächliche Implementierung; ältere Konzept- und Roadmap-Dokumente sind die Recherchehistorie.

## Inhalt

- Zwölf Rennen in Canyon, Alpen und Steinbruch; ein separates Testgelände mit optionaler Zeitlupe.
- Automatischer Antrieb, drei Computergegner auf unabhängigen Fahrspuren.
- Freihandzeichnen mit Finger oder Maus. Ein durchgehender, auch offener oder selbstkreuzender Strich bestimmt alle Räder; Übernahme beim Loslassen.
- Größenlimit, sichtbare Achsmarkierung, sechs Formvorlagen, Rückgängig und lokal gespeicherte Lieblingsform.
- Straße, Fels, Eis, Schlamm, Stufen, Steigungen, Sprunglücken, Baumstämme, Wippen und niedrige Durchfahrten.
- Flache Furten und tiefe Schwimmabschnitte mit Auftrieb und formabhängiger Paddelwirkung.
- Pause, Checkpoint-Bergung, lokale Bestzeiten und Sterne, Auswahl aller Strecken für Tests.
- Abschaltbarer synthetischer Motorsound; automatische, hohe und sparsame Grafikqualität.
- Installierbare PWA mit vollständigem lokalem Asset-Cache und bewusst bestätigten App-Updates.

## Architektur

TypeScript, Vite, Three.js, Rapier 2D, vite-plugin-pwa/Workbox. Exakte Versionen stehen im Lockfile.

- `src/shapes.ts`: Begrenzung und konturerhaltende Vereinfachung der Zeichnungen sowie Vorlagen.
- `src/courses.ts`: Streckenprofile, Oberflächen, Wasser und Hindernisse.
- `src/physics.ts`: Welt, Fahrzeuge, Achsen, Federung, Wasserkräfte, Radwechsel und Gegner.
- `src/hydrodynamics.ts`: vereinigte Konturen, Flächenmomente, Wasserlinienbeschnitt, verdrängtes Volumen und integrierte Wasserkräfte.
- `src/renderer.ts`: 3D-Fahrzeuge, Terrain, Materialien, Felsmodelle, Beleuchtung und Wasseroberfläche.
- `src/water-visuals.ts`: türkisfarbener Wassershader mit HDR-Reflexionen, Uferschaum, Kielwasser und begrenztem Spritzer-Pool.
- `src/splash-activity.ts`: Aktivität benetzter Konturabschnitte in einer dünnen Schicht um den Wasserspiegel, unabhängig vom Namen der Radvorlage.
- `src/drawing.ts`: Pointer-Eingabe und Zeichenvorschau.
- `src/shape-preparation.ts` und `src/shape-worker.ts`: Hintergrundberechnung aufwendiger Radkonturen.
- `src/landscape.ts`: anschließende Landschaft vor und hinter den Fahrspuren.
- `src/main.ts`: Zustände, Oberfläche, Spielstand und PWA-Integration.
- `src/audio.ts`: lokal erzeugter Ton ohne zusätzliche Audiodateien.

## Physikmodell

Feste Schritte von 1/120 Sekunde. Ein Fahrzeug besitzt Chassis und Überrollkäfig als Kollisionsformen, zwei Radkörper und zwei leichte Achsträger. Prismenverbindungen mit Feder-Dämpfer-Motoren bilden die Federung; Drehgelenke verbinden die Räder mit den Trägern. Der Antrieb liefert seit Version 1.4 maximal 420 statt 160 normalisierte Drehmomenteinheiten pro Achse, mit Gegenwirkung auf das Chassis. Jede Achse besitzt einen eigenen Drehzahlregler mit begrenztem Lastintegrator. Dieser kann auch bei geringer Zieldrehzahl das volle Anfahrmoment aufbauen. Er wird bei Freigabe der Achse oder Gaswegnahme entladen. Eine Übersetzung berücksichtigt Schräglage und geometrischen Höhenhub der Kontur. Ein gerader Strich rollt dadurch langsamer, kann den Buggy aber wiederholt anheben und vorwärts bewegen. Der Kippschutz nimmt bei drohendem Aufbäumen kurz das Gas weg und wartet bei Konturen mit großem Höhenhub auf ein deutlicheres Absenken der Nase. Schnelle Momentfreigabe nach Überwinden einer Kante reduziert Überschläge. Beim Schwimmen gilt weiterhin die sanftere Antriebskennlinie mit 96 Einheiten. Es gibt keinen pauschalen Vorwärtsschub und keine Aufrichtkraft.

Ein Strich wird zunächst mit 0,003 Einheiten Toleranz vereinfacht. Bis zu 512 Konturpunkte bleiben erhalten; darüber werden die größten Konturabweichungen zuerst aufgelöst und kleinere Details adaptiv vereinfacht, statt die Zeichnung als zu komplex abzulehnen. Die frühere Linienlängengrenze von 22 entfällt. Bis zu 32.768 Eingabesamples werden erfasst; bei noch längeren Gesten wird der bisherige Verlauf verdichtet und weiter aufgezeichnet. Anfang und Ende bleiben erhalten. Aufwendige Polygonvereinigungen laufen in einem Web Worker. Bis zur Fertigstellung fahren die bisherigen Räder weiter; eine neuere Zeichnung oder Vorlage hat Vorrang vor einem älteren Rechenergebnis. Bereits gespeicherte Konturen werden unverändert wiederhergestellt.

Kapseln bilden die verdickten Abschnitte; dünne Speichen verbinden diese mit der Nabe. Flächenmomente der vereinigten Konturen bestimmen Masse, Schwerpunkt und Trägheitsmoment. Oberfläche und Kollisionsform verwenden dieselben Punkte. Die vier sichtbaren Räder teilen sich zwei physikalische Achsen; seitliche Bewegung und Kollision zwischen Fahrspuren werden nicht simuliert.

Die niedrigere Reibung eines Kontaktpaars bestimmt die Traktion. Radmaterial, Nabe und Speichen verwenden 0,34; Eis begrenzt die Haftung weiter. Greifende Zacken profitieren von geometrischen Kontakten, nicht von einem Formbonus. Schlamm verwendet zusätzlichen Widerstand, jedoch kein verformbares Bodenmodell und kein physikalisches Einsinken.

Konturen einschließlich Aussparungen werden am Wasserspiegel und an den Ufergrenzen abgeschnitten. Aus nasser Fläche und effektiver Querschnittsbreite folgen verdrängtes Volumen, Auftrieb und dessen Angriffspunkt. Druck auf tatsächlich benetzte Flächen berücksichtigt lokale Translation, Rotation, Flächennormale und Geschwindigkeit; tangentiale Reibung ist viel kleiner. Kräfte und Momente werden mit einer passiven impliziten Begrenzung integriert. Längere Schwimmkörper und dämpfende Rumpfkräfte stabilisieren das Fahrzeug bei geringerem Längswiderstand. Spritzer und Schaum folgen der normalen Bewegung benetzter Konturflächen nahe der Oberfläche. Ihre Aktivität skaliert mit der dritten Potenz der lokalen Normalgeschwindigkeit; das ist ein visueller Indikator für die an Wasser abgegebene Leistung. Rückströmungen, Turbulenz und gekoppelte Wellen werden nicht räumlich simuliert. Die Einheiten des Spiels sind normalisiert. Verfahren und Präzisionsgrenzen: [BALANCING-1.2.md](BALANCING-1.2.md).

Ein Radwechsel ist eine nichtphysikalische Spielregel. Beim Vergrößern wird die nötige vertikale Lagekorrektur vollständig ausgeführt, damit die neue Kontur nicht in einer Geländekante verbleibt. Unter einer zu niedrigen Decke kann ein wachsendes Rad bis zum nächsten passenden Physikschritt warten. Die Winkelgeschwindigkeit wird so begrenzt, dass der Wechsel allein keine zusätzliche Rotationsenergie erzeugt. Checkpoint-Bergungen sind explizite Rücksetzungen.

Felsprofile, Stufen, Rillen, Mulden und Inseln verwenden reproduzierbare unregelmäßige Abstände und Höhen. Einzelne Felsblöcke besitzen je Spur einen konvexen Kollisionsumriss. An beiden sichtbaren Radspuren entspricht der 3D-Querschnitt diesem Umriss; die äußeren Seiten laufen in abgeschrägte Facetten aus. Gegner paddeln bis zum Ufer, bevor sie auf eine Landform wechseln.

## Grafik und Assets

Eigenes detailliertes Buggy-Modell mit Rahmen, Sitzen, Fahrer, Stoßdämpfern, Lichtkörpern und Schwimmkörpern. Photogrammetrie-Fels von Poly Haven, für wiederholte Hintergrunddarstellung auf rund 8.000 Dreiecke reduziert. Farb-, Normalen- und Rauheitstexturen in 1K; draußen aufgenommenes HDRI für Himmel und Umgebungslicht. Materialdetail und mobile Renderauflösung werden getrennt behandelt.

Die Spielwelt füllt die gesamte Bildschirmhöhe. Das Zeichenfeld liegt mit transparenter Füllung und heller Umrandung darüber; Rückgängig, Favorit und Formvorlagen bleiben erreichbar. Die Kamera hält das Fahrzeug oberhalb des Zeichenfelds. Der Wassershader kombiniert Tiefenfarbe, gefilterte HDR-Himmelsreflexion, kleine Wellen, Ufer- und Kielwasserschaum. Maximal 1.100 Partikel bilden feine Tropfen, Gischt und auslaufenden Schaum. Emissionen hängen von Kontur und Geschwindigkeit ab und sind zeitbasiert. Bei Pause bleiben die Effekte stehen; Streckenwechsel leeren den Partikelpool. Es gibt keine zusätzlichen Asset-Downloads und keine planaren Echtzeit- oder Bildschirmreflexionen.

Hohes Profil: bis zu zweifache Pixelauflösung und Schatten. Automatik: startet mit maximal 1,6-facher Auflösung und kann bei langsamen Bildern reduzieren. Sparsam: einfache Pixelauflösung ohne Schatten. Das ist keine garantierte Bildrate auf dem Ziel-iPhone; Messungen am tatsächlichen Gerät sind noch erforderlich.

## Tests

- `npm test`: Eingabegrenzen, Vortrieb über Kontakt, Eis-Traktion, Energieverhalten ohne Antrieb, offene Formen, wiederholte Radwechsel, Auftrieb/Paddelantrieb und Instanziierung aller Strecken. Dazu Regressionstests für Anfahren mit Dreiecksrädern, den Vergleich Paddel/Rundrad in tiefem Wasser, die Durchquerungszeit einer Furt und gegensätzliche Formanforderungen an Stufen/Durchfahrten einschließlich Befreiung durch Zeichnen. Ein weiterer Test prüft das zurückgestellte Vergrößern unter einem niedrigen Dach bis zur sicheren Ausfahrt.
- `npm run test:courses`: vollständige Fahrten aller zwölf Rennen und des Testgeländes mit einer Wechselstrategie zwischen Rundrad, flachen Zacken, kleinen Rädern und Paddeln. Erwartet Zielankunft ohne Bergung; protokolliert Zeit, Lage und Bergungen.
- `npm run test:browser`: produktiver Build in Chromium und WebKit mit 440 × 956 CSS-Pixeln; Zeichnen, Favoriten, Pause/Fortsetzen, Bergen, Wasserstrecke, Ergebnisdialog und Streckenauswahl. Separate Chromium-Tests prüfen den vollständigen Neustart ohne Netzwerk und das bestätigte Update nach einer Installation während desselben Seitenbesuchs, einschließlich Erhalt der Lieblingsform.
- `npm run build`: strenge TypeScript-Prüfung, Produktionsbuild und PWA-Precache-Erzeugung.

Die vollständigen Streckenfahrten prüfen alle zwölf Rennen und das Testgelände mit 21 Hindernistypen. Die 34 Physik- und Geometrietests umfassen außerdem die belastete Hinterachse bei frei drehendem Vorderrad, das wiederholte Anheben und Fahren mit einem geraden Strich aus vier Startwinkeln, form- und geschwindigkeitsabhängige Spritzaktivität, die Konvexität der sichtbaren Felsblöcke, den durchgehenden Boden hinter dem Start, Eis, Wasser und sehr lange Zeichnungen. `npm run test:races` prüft zusätzlich die Zielankunft aller vier Fahrzeuge in zwölf Rennen. Vergleichswerte: [UPDATE-1.4.md](UPDATE-1.4.md), vorheriger Stand: [BALANCING-1.3.md](BALANCING-1.3.md).

Der Countdown verwendet tatsächlich verstrichene Zeit unabhängig vom begrenzten Physik-Zeitschritt. Ein Browserregressionstest erzwingt eine niedrige Bildrate und prüft, dass die Startphase nicht künstlich länger wird.

Die Mobilansicht wird in 440 × 956, 390 × 844, 375 × 667 und 956 × 440 CSS-Pixeln geprüft. Nach Größenänderungen kontrolliert der Test auch Bilddaten aus dem WebGL-Zeichenpuffer. Im Windows-WebKit-Lauf blendete der Screenshot-Compositor die 3D-Schicht nach einer emulierten Größenänderung aus, obwohl der Zeichenpuffer weiter korrekt gerendert wurde. Deshalb entstehen die visuellen Layoutaufnahmen je Format nach einem frischen Seitenstart; dieser Test ersetzt keinen Rotationstest auf dem iPhone.

Playwrights Windows-WebKit bricht die simulierte Offline-Navigation mit einem internen Browserfehler ab. Die [Playwright-Dokumentation](https://playwright.dev/docs/service-workers) unterstützt Service-Worker-Werkzeuge ausschließlich für Chromium; der Offline-Test wird daher für WebKit ausdrücklich übersprungen. Das ist keine Bestätigung des Offlinebetriebs auf iOS.

Ein emulierter Mobilbrowser ist kein Test auf einem echten iPhone 16 Pro Max mit iOS 27. Installation über das iOS-Teilen-Menü, Offline-Neustart, thermisches Verhalten und längere Gerätesessions müssen auf dem tatsächlichen Zielgerät geprüft werden.

## Veröffentlichung und Betrieb

Die GitHub-Actions-Pipeline installiert mit `npm ci`, führt Physik- und vollständige Streckentests aus, baut und veröffentlicht `dist` über GitHub Pages. Es werden keine kostenpflichtigen Dienste genutzt. Alle Laufzeitassets liegen im Repository; externe Quellen sind nur für die optionale erneute Assetbeschaffung nötig.

Der Service Worker speichert die Anwendung einschließlich Physik, Bildern, Modell und HDRI. Der erstmalige Download benötigt Internet. Erst bei „Offline bereit“ ist der vollständige Offlinecache installiert. Ein Update wird über die Einstellungen bestätigt; ein laufendes Rennen wird nicht automatisch neu geladen. Fortschritt und Einstellungen liegen in `localStorage` und können durch Löschen von Browserdaten verloren gehen.
