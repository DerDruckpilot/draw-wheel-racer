# FORMDRIVE

Ein eigenständiges Physik-Abenteuer für das iPhone im Querformat: Während der Fahrt zeichnest du getrennte Radformen für Vorder- und Hinterachse. Die tatsächliche Form beeinflusst, wie das Fahrzeug über verschiedene Untergründe und Hindernisse fährt.

**Version 1.8.0 – geschlossene Felsdurchgänge, eigene Winterwelten und 15 neu aufgebaute Expeditionen.**

[Spiel im Browser öffnen](https://derdruckpilot.github.io/draw-wheel-racer/) · [Implementierung und Grenzen](docs/IMPLEMENTIERUNG.md)

## Auf dem iPhone spielen

1. Öffne die Spieladresse in Safari.
2. Tippe auf **Teilen → Zum Home-Bildschirm** und lasse **Als Web-App öffnen** eingeschaltet.
3. Starte das neue Icon und warte beim ersten Start auf **Offline bereit**.
4. Drehe das Gerät quer. Zeichne links die Hinterräder und rechts die Vorderräder; mehrere abgesetzte Striche sind möglich. Tippe jeweils auf das **Häkchen**; danach ist das Feld für den nächsten Entwurf leer.
5. Das rechte Pedal halten; nach oben wischen aktiviert den Tempomaten. Gas antippen oder links bremsen löst ihn. Halte das linke Pedal nach dem Stillstand weiter, um rückwärts zu fahren.

Zielgerät ist ein iPhone 16 Pro Max mit iOS 27. Die Browserprüfung ersetzt keinen Leistungstest auf dem tatsächlichen iPhone.

## Enthalten

- 15 Solo-Expeditionen in drei Landschaften, darunter drei Expertenstrecken, und ein freies Testgelände.
- Gas, Bremse, Rückwärtsgang und optionaler Tempomat; keine Gegner und kein Zeitlimit.
- Ein Stern für das Ziellager, ein zweiter für eine Fahrt ohne Bergung; keine automatischen Sammelkisten.
- Checkpoints vor den Hindernisgruppen; freies Experimentieren ohne Zeitlimit.
- Zwei unabhängige Freihand-Entwürfe mit mehreren Strichen, manueller Montage, Strich-Rückgängig und Leeren; keine fertige Radauswahl.
- 43 Gelände- und Hindernistypen, einschließlich zusammenhängendem Felsgrat, erhöhtem Felsgang, Flutpassage und Schlucht mit Sprung und Gegenanstieg; darunter frei drehende Walzen, Kippplatten, Quergräben, Wellenhügel, Sägezahnfelsen, Waschbrett, Felstore, versunkene Stege und Eisanstiege.
- Flache Furten und tiefe Seen: Der Geländetruck schwimmt, die gezeichneten Räder paddeln.
- Geschwungene Strecken, steinerne Brücken, natürliche Felsbögen und Höhlen mit integrierten Felsen.
- Vollflächige Spielwelt hinter zwei quadratischen, transparenten Zeichenfeldern im Querformat, Pedale an den Bildschirmrändern.
- Wasser mit HDR-Reflexionen, Ufer- und Kielwasserschaum sowie Spritzern aus der tatsächlichen Bewegung der Radkontur.
- Durchgehende Landschaft mit Uferböschungen, Photogrammetrie-Felsen, PBR-Texturen, HDR-Himmel, Schatten und drei Grafikprofilen.
- Lokale Spielstände, Offlinebetrieb, Pause und optionaler Ton; keine Werbung oder Anmeldung.

Zwölf neue Hindernistypen kombinieren lange Engstellen, hohe Kletterwände, wechselnde Stufen, Auswaschungen, Krater, gebrochene Holzstege, Lehmausstiege, überflutete Höhlen und Gletscherbrüche. Alle 15 Expeditionen haben neue Abfolgen mit sechs bis neun Gruppen. Eis liegt außerhalb des Testgeländes ausschließlich in Winterwelten. [Änderungen in Version 1.8](docs/UPDATE-1.8.md).

Die Physik arbeitet im seitlichen Profil. Wasser und Schlamm nutzen die tatsächlich eingetauchten Konturen. Schlamm ergänzt viskosen Widerstand und eine regularisierte Fließgrenze; es gibt kein verformbares Bodenmodell. Details stehen in der Implementierungsdokumentation und im Spiel unter „Quellen & Physik“.

Version 1.4 erhöht das maximale Achsdrehmoment von 160 auf 420 normalisierte Einheiten. Eine Lastregelung baut auch beim langsamen Klettern das volle Moment auf. Die Übersetzung berücksichtigt den Höhenhub der gezeichneten Kontur: Ein gerader Strich hebt den Buggy wiederholt an und bewegt ihn vorwärts. Konturen erhalten keinen pauschalen Vortrieb. Neue Felsblöcke besitzen eigene Kollisionsumrisse; Felskanten, Mulden, Rillen und Inseln variieren in Höhe und Abstand. [Änderungen und Messwerte](docs/UPDATE-1.4.md).

Die Verbesserungen aus [Version 1.3](docs/BALANCING-1.3.md) bleiben erhalten: geringe Eishaftung, 21 Hindernistypen, bis zu 512 Konturpunkte und keine separate Linienlängenbegrenzung. Sehr dichte Zeichnungen werden adaptiv vereinfacht und im Hintergrund vorbereitet. Die hydrodynamischen Kräfte aus [Version 1.2](docs/BALANCING-1.2.md) bleiben bestehen; die neue Wasserdarstellung ergänzt sie visuell.

Bei einer bereits installierten PWA: Spiel online öffnen und in den Einstellungen **Neue Version laden** wählen, sobald das Update angeboten wird. Danach zeigen die Einstellungen **FORMDRIVE 1.8.0**. Einstellungen, gespeicherte Radform und alte Rennergebnisse bleiben erhalten. Die neuen Expeditionen haben eine eigene Sterne-Wertung.

Die Fahrsteuerung verändert die gewünschte Raddrehzahl. Version 1.6 bietet 1.200 Einheiten Anfahrmoment je Achse und nimmt auf Land nicht mehr wegen eines festen Kippwinkels das Gas weg. Bremsen erzeugen entgegengesetzte Achsmomente und geben auf Eis keine zusätzliche Haftung. Neue Bedienelemente unterstützen gleichzeitiges Fahren und Zeichnen. [Änderungen in Version 1.5](docs/UPDATE-1.5.md).

Der Geländetruck stammt aus [Cesium GroundVehicle](https://github.com/CesiumGS/cesium/tree/main/Apps/SampleData/models/GroundVehicle), Copyright 2018 Analytical Graphics, Inc., Apache-2.0. Originalräder wurden entfernt, Proportionen angepasst und PBR-Texturen für Mobilgeräte komprimiert. [Änderungen in Version 1.6](docs/UPDATE-1.6.md).

## Lokal entwickeln

Node.js 24 verwenden.

```sh
npm ci
npm run dev
```

Lokale Adresse: `http://127.0.0.1:5173/draw-wheel-racer/`.

```sh
npm test
npm run test:courses
npm run test:expeditions
npm run test:balance
npm run test:races
npm run build
npm run preview -- --port 4173
```

In einem zweiten Terminal kann der produktive Build getestet werden:

```sh
npx playwright install chromium webkit
npm run test:browser
```

Die GitHub-Actions-Pipeline prüft Physik und vollständige Streckenfahrten, baut und veröffentlicht über GitHub Pages. Alle Laufzeitassets sind im Repository enthalten. `scripts/fetch-assets.mjs` und `scripts/prepare-assets.mjs` dokumentieren die optionale erneute Beschaffung und Aufbereitung.

## Vorgaben

- Freihand-Zeichenfeld während des Spiels dauerhaft sichtbar.
- Mehrere Striche pro Achse; Montage erst über den jeweiligen Knopf.
- Unterschiedliche Untergründe und Hindernisse, ausdrücklich einschließlich Wasser.
- Möglichst plausible Physik, insbesondere tatsächliche Wechselwirkung zwischen Radform und Gelände.
- iPhone 16 Pro Max mit iOS 27 (Angabe des Auftraggebers), Querformat, installierbare PWA.
- Möglichst detaillierte, realistische 3D-Grafik mit hochwertigen kostenlosen Modellen und Texturen.
- Fremdcode und 3D-Modelle dürfen unter passenden Lizenzen verwendet werden.

## Dokumentation

- [Recherche und technische Empfehlung](docs/RECHERCHE.md)
- [Spielkonzept und Physikentwurf](docs/KONZEPT.md)
- [Produktentscheidungen](docs/ENTSCHEIDUNGEN.md)
- [Tatsächliche Implementierung](docs/IMPLEMENTIERUNG.md)
- [Umsetzungsschritte und Abnahmekriterien](docs/ROADMAP.md)
- [Mögliche Bibliotheken und Asset-Quellen](docs/DRITTANBIETER.md)

## Technik

Three.js für die 3D-Darstellung, Rapier für die Physik, polygon-clipping für Konturvereinigungen, TypeScript für die Spiellogik und Vite mit Workbox für den PWA-Build. Die Simulation hat feste Schritte von 1/120 Sekunde, begrenztes Motordrehmoment, gefederte Achsträger und strichbasierte Kollisionsformen mit bis zu 512 Punkten.

Fremdassets: Poly Haven (CC0) und Cesium/Analytical Graphics (Apache-2.0). Bibliotheken und Lizenzhinweise: [Quellen & Physik](public/credits.html). Die Werbeabbildung diente als Referenz; sie und die Marken/Spielassets des beworbenen Spiels wurden nicht übernommen.

Das Repository ist öffentlich. Die Spieladresse wird über GitHub Pages bereitgestellt. Quellcode und statischer Build benötigen keine geheimen Schlüssel und keinen eigenen Backendserver.
