## Erweiterung 1.9

Der aktuelle Stand umfasst 21 Expeditionen und ein Testgelände mit 57 Hindernistypen. Die neuen Systeme, Prüfungen und ihre physikalischen Vereinfachungen sind in [UPDATE-1.9.md](UPDATE-1.9.md) beschrieben. Die folgenden historischen Angaben zur unverformbaren Bodenphysik beziehen sich auf die bisherigen Lehmfelder; die neuen weichen Felder verformen ihr tatsächliches Kollisionsprofil.

# FORMDRIVE 1.8 – Implementierung

Stand: 23. September 2026. Dieses Dokument beschreibt die tatsächliche Implementierung; ältere Konzept- und Roadmap-Dokumente sind die Recherchehistorie.

## Inhalt

- 15 Solo-Expeditionen in Canyon, Alpen und Steinbruch; ein separates Testgelände mit optionaler Zeitlupe.
- Gas mit dosierbarer Raddrehzahl, Bremse, Rückwärtsgang und optionaler Tempomat. Ein Fahrzeug, kein Zeitlimit.
- Freihandzeichnen mit Finger oder Maus. Mehrere offene oder selbstkreuzende Striche pro Achse; zwei unabhängige Entwürfe, Übernahme nur per Häkchen; der montierte Entwurf wird anschließend geleert.
- Größenlimit, sichtbare Achsmarkierung, Rückgängig je Strich und Leeren des Entwurfs. Keine Vorlagen oder Favoritenauswahl in der Oberfläche.
- Straße, Fels, Eis, Schlamm, Stufen, Steigungen, Sprunglücken, Baumstämme, Wippen und niedrige Durchfahrten.
- Flache Furten und tiefe Schwimmabschnitte mit Auftrieb und formabhängiger Paddelwirkung.
- Pause, Checkpoint-Bergung, dauerhafte Sterne für Zielankunft und bergungsfreie Fahrt. Alle Strecken sind frei wählbar.
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
- `src/drive-controls.ts`: unabhängige Pointer für Pedale und Zeichnen, Tastatur, Tempomat und Freigabe bei Pause/Abbruch.
- `src/expedition.ts`: Abschlusswertung und validierte Wiederherstellung der neuen Fortschrittsdaten.
- `src/drawing.ts`: Pointer-Eingabe und Zeichenvorschau.
- `src/shape-preparation.ts` und `src/shape-worker.ts`: Hintergrundberechnung aufwendiger Radkonturen.
- `src/route-layout.ts`: gemeinsame räumliche Abbildung der festen Fahrspur auf geschwungene Verläufe, mit Bogenlänge und seitlichem Abstand. Gelände, bewegliche Teile und Spritzer verwenden dieselbe Abbildung. Die Fahrphysik bleibt ein Längsprofil, ohne seitliches Lenken oder Querkräfte.
- `src/structures.ts`: Steinbrücke, natürlicher Bogen und Höhle mit bodenverbundenen Schultern und passendem physischem Dachprofil.
- `src/landscape.ts`: anschließende Landschaft beiderseits der einzelnen Fahrspur.
- `src/main.ts`: Zustände, Oberfläche, Spielstand und PWA-Integration.
- `src/audio.ts`: lokal erzeugter Ton ohne zusätzliche Audiodateien.

Die aktuelle Weltgeometrie, Winterdarstellung und Schwierigkeitsprüfung stehen in [UPDATE-1.8.md](UPDATE-1.8.md). Das Schlammmodell und Cockpit stehen in [UPDATE-1.7.md](UPDATE-1.7.md). Die Modellquelle und getrennten Achsen sind in [UPDATE-1.6.md](UPDATE-1.6.md) dokumentiert.

## Schlamm und Einzelspieler-Ansicht

Schlammbecken besitzen einen festen unregelmäßigen Untergrund unter dem sichtbaren Pegel. Die benetzte Rad- und Rumpfkontur erfährt Druck, viskosen Widerstand, Scherung und eine regularisierte Fließgrenze. Dissipation wird auf ein energiestabiles Impulsmaß begrenzt. Eine runde Kontur bekommt keinen besonderen Bonus; vorspringende Flächen können Material nach hinten bewegen. Die Oberfläche bewegt sich langsam, zeigt Radspuren und schleudert kurze braune Klumpen. Verformbare Erde und dauerhafte Spurrillen sind nicht simuliert.

Die sichtbare Fahrbahn ist 4,4 Einheiten breit und enthält ausschließlich das Spielerfahrzeug. Seitliche Böschungen füllen weiterhin die Umgebung. Bauwerke bestehen aus einer vollständig geschlossenen, gemeinsam indizierten Oberfläche mit auslaufenden Füßen unterhalb des Geländes. Es gibt keine transparent ausgeschnittenen Felsflächen. Eine dezente Fahrzeugdarstellung hinter verdeckenden Flächen hält die Lage im Tunnel erkennbar. Hindernis-Lösungshinweise entfallen; Statusmeldungen erscheinen unter dem Spielnamen.

## Physikmodell

Feste Schritte von 1/120 Sekunde. Ein Fahrzeug besitzt Chassis und Überrollkäfig als Kollisionsformen, zwei Radkörper und zwei leichte Achsträger. Prismenverbindungen mit Feder-Dämpfer-Motoren bilden die Federung; Drehgelenke verbinden die Räder mit den Trägern. Der Antrieb liefert seit Version 1.6 maximal 1.200 statt 420 normalisierte Drehmomenteinheiten pro Achse, mit Gegenwirkung auf das Chassis. Jede Achse besitzt einen eigenen Drehzahlregler mit begrenztem Lastintegrator. Dieser kann auch bei geringer Zieldrehzahl das volle Anfahrmoment aufbauen. Er wird bei Freigabe der Achse oder Gaswegnahme entladen. Eine Übersetzung berücksichtigt Schräglage und geometrischen Höhenhub der Kontur. Ein gerader Strich rollt dadurch langsamer, kann den Buggy aber wiederholt anheben und vorwärts bewegen. Die feste winkelabhängige Gasabschaltung an Land entfällt. Gas und Bremse sowie der niedrigere, leicht vorn liegende Fahrzeugschwerpunkt bestimmen die Kippbalance; Überschläge bleiben möglich. Schnelle Momentfreigabe nach Überwinden einer Kante reduziert Überschläge. Beim Schwimmen gilt weiterhin die sanftere Antriebskennlinie mit 96 Einheiten. Es gibt keinen pauschalen Vorwärtsschub und keine Aufrichtkraft.

Ein Strich wird zunächst mit 0,003 Einheiten Toleranz vereinfacht. Bis zu 512 Konturpunkte bleiben erhalten; darüber werden die größten Konturabweichungen zuerst aufgelöst und kleinere Details adaptiv vereinfacht, statt die Zeichnung als zu komplex abzulehnen. Die frühere Linienlängengrenze von 22 entfällt. Bis zu 32.768 Eingabesamples werden erfasst; bei noch längeren Gesten wird der bisherige Verlauf verdichtet und weiter aufgezeichnet. Anfang und Ende bleiben erhalten. Aufwendige Polygonvereinigungen laufen in einem Web Worker. Bis zur Fertigstellung fahren die bisherigen Räder weiter; Leeren, Rückgängig oder eine neuere Zeichnung derselben Achse entwerten ein älteres Rechenergebnis. Bereits gespeicherte Konturen werden unverändert wiederhergestellt.

Kapseln bilden die verdickten Abschnitte; dünne Speichen verbinden diese mit der Nabe. Flächenmomente der vereinigten Konturen bestimmen Masse, Schwerpunkt und Trägheitsmoment. Oberfläche und Kollisionsform verwenden dieselben Punkte. Die vier sichtbaren Räder teilen sich zwei physikalische Achsen; seitliche Bewegung und Kollision zwischen Fahrspuren werden nicht simuliert.

Die niedrigere Reibung eines Kontaktpaars bestimmt die Traktion. Radmaterial, Nabe und Speichen verwenden 0,34; Eis begrenzt die Haftung weiter. Greifende Zacken profitieren von geometrischen Kontakten, nicht von einem Formbonus. Schlamm ergänzt einen zähen Mediumwiderstand und eine regularisierte Fließgrenze. Die Räder tauchen bis zum festen Beckengrund ein; der Boden selbst verformt sich nicht.

Konturen einschließlich Aussparungen werden am Wasserspiegel und an den Ufergrenzen abgeschnitten. Aus nasser Fläche und effektiver Querschnittsbreite folgen verdrängtes Volumen, Auftrieb und dessen Angriffspunkt. Druck auf tatsächlich benetzte Flächen berücksichtigt lokale Translation, Rotation, Flächennormale und Geschwindigkeit; tangentiale Reibung ist viel kleiner. Kräfte und Momente werden mit einer passiven impliziten Begrenzung integriert. Längere Schwimmkörper und dämpfende Rumpfkräfte stabilisieren das Fahrzeug bei geringerem Längswiderstand. Spritzer und Schaum folgen der normalen Bewegung benetzter Konturflächen nahe der Oberfläche. Ihre Aktivität skaliert mit der dritten Potenz der lokalen Normalgeschwindigkeit; das ist ein visueller Indikator für die an Wasser abgegebene Leistung. Rückströmungen, Turbulenz und gekoppelte Wellen werden nicht räumlich simuliert. Die Einheiten des Spiels sind normalisiert. Verfahren und Präzisionsgrenzen: [BALANCING-1.2.md](BALANCING-1.2.md).

Ein Radwechsel ist eine nichtphysikalische Spielregel. Beim Vergrößern wird die nötige vertikale Lagekorrektur vollständig ausgeführt, damit die neue Kontur nicht in einer Geländekante verbleibt. Unter einer zu niedrigen Decke kann ein wachsendes Rad bis zum nächsten passenden Physikschritt warten. Die Winkelgeschwindigkeit wird so begrenzt, dass der Wechsel allein keine zusätzliche Rotationsenergie erzeugt. Checkpoint-Bergungen sind explizite Rücksetzungen.

Felsprofile, Stufen, Rillen, Mulden und Inseln verwenden reproduzierbare unregelmäßige Abstände und Höhen. Einzelne Felsblöcke besitzen je Spur einen konvexen Kollisionsumriss. An beiden sichtbaren Radspuren entspricht der 3D-Querschnitt diesem Umriss; die äußeren Seiten laufen in abgeschrägte Facetten aus. Die frühere Rennsimulation bleibt ausschließlich für Regressionstests verfügbar; die Spieloberfläche verwendet Einzelspieler-Expeditionen.

## Expeditionen und Fahrsteuerung

Gas setzt die gewünschte Raddrehzahl; auch wenig Gas kann das maximale Anfahrmoment aufbauen. Rückwärtsfahrt spiegelt die Antriebsrichtung. Die Bremse wirkt durch begrenzte, gleich große Gegenmomente auf Rad und Chassis; die effektive Rotationsträgheit begrenzt ihren Impuls. Geschwindigkeit und Reibung werden nicht künstlich überschrieben. Neutral lässt das Fahrzeug rollen. Pause, Sichtbarkeitsverlust, Fokusverlust und Pointerabbruch lösen gehaltene Eingaben; nach einer Pause ist der Tempomat aus.

Alle 15 Expeditionen haben sechs bis neun kombinierte Hindernisgruppen. Zwölf neue Typen ergänzen die bisherigen 31. Das Testgelände enthält alle 43. Ein Checkpoint liegt vor jeder Gruppe; innerhalb zusammengesetzter Aufgaben muss die Lösung zusammenhängend gelingen. Die Umgebung folgt dem jeweiligen Biotop, mit Eis ausschließlich in Winterstrecken (Ausnahme: Testgelände).

Die bisherigen automatischen Fundstücke entfallen. Ein Stern gilt für Zielankunft, ein zweiter für eine Fahrt ohne Bergung. Frühere Sammlerfelder bleiben als kompatible Altdaten erhalten, erzeugen aber keinen dritten Stern mehr. Die Oberfläche zeigt die Zahl der Bergungen statt eines Sammelzählers.

Der bestehende lokale Speicher bekommt ein eigenes Feld `expeditions`. Alte `best`-Rennergebnisse, Lieblingsform, gewählte Strecke und Einstellungen bleiben erhalten. Es gibt keinen laufenden Checkpoint-Spielstand über einen Neustart der App hinweg.

## Grafik und Assets

Importierter Geländetruck: GroundVehicle aus CesiumJS, Copyright 2018 Analytical Graphics, Inc., Apache-2.0. Originalräder wurden entfernt, Proportionen für die gezeichneten Achsen angepasst und die PBR-Texturen auf höchstens 1K komprimiert. Die mobile GLB-Datei ist etwa 1,9 MB groß. Photogrammetrie-Fels von Poly Haven, für wiederholte Hintergrunddarstellung auf rund 8.000 Dreiecke reduziert. Farb-, Normalen- und Rauheitstexturen in 1K; draußen aufgenommenes HDRI für Himmel und Umgebungslicht. Materialdetail und mobile Renderauflösung werden getrennt behandelt.

Die Spielwelt füllt die gesamte Bildschirmhöhe. Zwei Zeichenfelder liegen mit transparenter Füllung und heller Umrandung mittig darüber. Jedes Feld besitzt Montieren, Strich-Rückgängig und Leeren. Die Kamera hält das Fahrzeug oberhalb der Felder. Gas liegt rechts, Bremse/Rückwärtsgang links. Ziellager und Checkpointfahnen ersetzen Rennmarkierungen. Felsdächer bleiben geschlossen und deckend. Beide Seiten des Zielschildes verwenden eigene Geometrie und korrekt ausgerichtete Vorderseiten; keine doppelte Verformung einer geteilten Schildgeometrie. Der Wassershader kombiniert Tiefenfarbe, gefilterte HDR-Himmelsreflexion, kleine Wellen, Ufer- und Kielwasserschaum. Maximal 1.100 Partikel bilden feine Tropfen, Gischt und auslaufenden Schaum. Emissionen hängen von Kontur und Geschwindigkeit ab und sind zeitbasiert. Bei Pause bleiben die Effekte stehen; Streckenwechsel leeren den Partikelpool. Laufzeitassets liegen vollständig im lokalen Offlinecache; es gibt keine externen Asset-Downloads und keine planaren Echtzeit- oder Bildschirmreflexionen.

Hohes Profil: bis zu zweifache Pixelauflösung und Schatten. Automatik: startet mit maximal 1,6-facher Auflösung und kann bei langsamen Bildern reduzieren. Sparsam: einfache Pixelauflösung ohne Schatten. Das ist keine garantierte Bildrate auf dem Ziel-iPhone; Messungen am tatsächlichen Gerät sind noch erforderlich.

## Tests

- `npm test`: Eingabegrenzen, Vortrieb über Kontakt, Eis-Traktion, Energieverhalten ohne Antrieb, offene Formen, wiederholte Radwechsel, Auftrieb/Paddelantrieb und Instanziierung aller Strecken. Dazu Regressionstests für Anfahren mit Dreiecksrädern, den Vergleich Paddel/Rundrad in tiefem Wasser, die Durchquerungszeit einer Furt und gegensätzliche Formanforderungen an Stufen/Durchfahrten einschließlich Befreiung durch Zeichnen. Ein weiterer Test prüft das zurückgestellte Vergrößern unter einem niedrigen Dach bis zur sicheren Ausfahrt.
- `npm run test:courses`: vollständige Fahrten aller zwölf Rennen und des Testgeländes mit einer Wechselstrategie zwischen Rundrad, flachen Zacken, kleinen Rädern und Paddeln. Erwartet Zielankunft ohne Bergung; protokolliert Zeit, Lage und Bergungen.
- `npm run test:expeditions`: sämtliche 21 Expeditionen und das Testgelände mit echten Physikschritten, Formwechseln, dosiertem Gas, Bremsen und kurzen Rückwärtsmanövern. Der Offline-Referenzfahrer darf ein umgekipptes Fahrzeug an seinem echten Checkpoint bergen; mehr als zwei Bergungen oder eine nicht erreichte Ziellinie lassen die Prüfung scheitern. Es wird nicht vorwärts teleportiert.
- `npm run test:balance`: alle 21 Expeditionen mit unverändertem großem Ring, kleinem Ring oder offenen Haken. Eine erfolgreiche Durchfahrt mit einer dieser unveränderten Referenzformen schlägt als Balancing-Regression fehl.
- `npm run test:browser`: produktiver Build in Chromium und WebKit mit 956 × 440 CSS-Pixeln; getrennte Entwürfe, Montage, Tempomat, Pause/Fortsetzen, Bergen, Wasserstrecke, Ergebnisdialog und Streckenauswahl. Separate Chromium-Tests prüfen den vollständigen Neustart ohne Netzwerk und das bestätigte Update nach einer Installation während desselben Seitenbesuchs, einschließlich Erhalt der Lieblingsform.
- `npm run build`: strenge TypeScript-Prüfung, Produktionsbuild und PWA-Precache-Erzeugung.

Die vollständigen Fahrprüfungen umfassen alle 21 Expeditionen und das Testgelände mit 57 Hindernistypen; zusätzlich bleiben die historischen Rennstrecken als Regression erhalten. Die 74 Physik-, Geometrie- und Fortschrittstests umfassen außerdem die belastete Hinterachse bei frei drehendem Vorderrad, das wiederholte Anheben und Fahren mit einem geraden Strich aus vier Startwinkeln, form- und geschwindigkeitsabhängige Spritzaktivität, die Konvexität der sichtbaren Felsblöcke, den durchgehenden Boden hinter dem Start, Eis, Wasser und sehr lange Zeichnungen. `npm run test:races` prüft zusätzlich die Zielankunft aller vier Fahrzeuge in zwölf Rennen. Neue Steuerungs- und Expeditionsprüfungen: [UPDATE-1.5.md](UPDATE-1.5.md). Vergleichswerte: [UPDATE-1.4.md](UPDATE-1.4.md), vorheriger Stand: [BALANCING-1.3.md](BALANCING-1.3.md).

Der Countdown verwendet tatsächlich verstrichene Zeit unabhängig vom begrenzten Physik-Zeitschritt. Ein Browserregressionstest erzwingt eine niedrige Bildrate und prüft, dass die Startphase nicht künstlich länger wird.

Die Mobilansicht wird in 956 × 440, 844 × 390 und 667 × 375; die Drehaufforderung in 440 × 956 CSS-Pixeln geprüft. Nach Größenänderungen kontrolliert der Test auch Bilddaten aus dem WebGL-Zeichenpuffer. Im Windows-WebKit-Lauf blendete der Screenshot-Compositor die 3D-Schicht nach einer emulierten Größenänderung aus, obwohl der Zeichenpuffer weiter korrekt gerendert wurde. Deshalb entstehen die visuellen Layoutaufnahmen je Format nach einem frischen Seitenstart; dieser Test ersetzt keinen Rotationstest auf dem iPhone.

Playwrights Windows-WebKit bricht die simulierte Offline-Navigation mit einem internen Browserfehler ab. Die [Playwright-Dokumentation](https://playwright.dev/docs/service-workers) unterstützt Service-Worker-Werkzeuge ausschließlich für Chromium; der Offline-Test wird daher für WebKit ausdrücklich übersprungen. Das ist keine Bestätigung des Offlinebetriebs auf iOS.

Ein emulierter Mobilbrowser ist kein Test auf einem echten iPhone 16 Pro Max mit iOS 27. Installation über das iOS-Teilen-Menü, Offline-Neustart, thermisches Verhalten und längere Gerätesessions müssen auf dem tatsächlichen Zielgerät geprüft werden.

## Veröffentlichung und Betrieb

Die GitHub-Actions-Pipeline installiert mit `npm ci`, führt Physik- und vollständige Streckentests aus, baut und veröffentlicht `dist` über GitHub Pages. Es werden keine kostenpflichtigen Dienste genutzt. Alle Laufzeitassets liegen im Repository; externe Quellen sind nur für die optionale erneute Assetbeschaffung nötig.

Der Service Worker speichert die Anwendung einschließlich Physik, Bildern, Modell und HDRI. Der erstmalige Download benötigt Internet. Erst bei „Offline bereit“ ist der vollständige Offlinecache installiert. Ein Update wird über die Einstellungen bestätigt; eine laufende Expedition wird nicht automatisch neu geladen. Fortschritt und Einstellungen liegen in `localStorage` und können durch Löschen von Browserdaten verloren gehen.
