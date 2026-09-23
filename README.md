# FORMDRIVE

Ein eigenständiges Physik-Abenteuer für das iPhone im Hochformat: Während der Fahrt zeichnest du unten auf dem Bildschirm neue Radformen. Die tatsächliche Form beeinflusst, wie das Fahrzeug über verschiedene Untergründe und Hindernisse fährt.

**Version 1.5.0 – Solo-Expeditionen: Gas dosieren, bremsen, zurückfahren und das Ziellager erreichen. Ohne Gegner oder Zeitlimit.**

[Spiel im Browser öffnen](https://derdruckpilot.github.io/draw-wheel-racer/) · [Implementierung und Grenzen](docs/IMPLEMENTIERUNG.md)

## Auf dem iPhone spielen

1. Öffne die Spieladresse in Safari.
2. Tippe auf **Teilen → Zum Home-Bildschirm** und lasse **Als Web-App öffnen** eingeschaltet.
3. Starte das neue Icon und warte beim ersten Start auf **Offline bereit**.
4. Zeichne unten eine Form. Beim Loslassen wird sie zu den Rädern. Halte GAS zum Fahren; ziehe nach oben für mehr Gas oder nach unten zum Kriechen. AUTO hält das Gas beim Zeichnen. Bremse und Zurück helfen an schwierigen Stellen.

Zielgerät ist ein iPhone 16 Pro Max mit iOS 27. Die Browserprüfung ersetzt keinen Leistungstest auf dem tatsächlichen iPhone.

## Enthalten

- Zwölf Solo-Expeditionen in drei Landschaften und ein freies Testgelände.
- Gas, Bremse, Rückwärtsgang und optionaler Tempomat; keine Gegner und kein Zeitlimit.
- Sterne für das Erreichen des Ziellagers, eine Fahrt ohne Bergung und drei optionale Fundstücke.
- Checkpoints vor den Hindernisgruppen; gesammelte Fundstücke bleiben beim Bergen erhalten.
- Freihandräder, sechs Vorlagen einschließlich kleiner Räder und flacher Zacken, Rückgängig und gespeicherte Lieblingsform.
- 25 Gelände- und Hindernistypen, einschließlich zusammenhängendem Felsgrat, erhöhtem Felsgang, Flutpassage und Schlucht mit Sprung und Gegenanstieg; darunter frei drehende Walzen, Kippplatten, Quergräben, Wellenhügel, Sägezahnfelsen, Waschbrett, Felstore, versunkene Stege und Eisanstiege.
- Flache Furten und tiefe Seen: Der Buggy schwimmt, die gezeichneten Räder paddeln.
- Geschwungene Strecken, steinerne Brücken, natürliche Felsbögen und Höhlen mit integrierten Felsen.
- Vollflächige Spielwelt hinter einem schwebenden Zeichenfeld; kompakte Bedienelemente im Hochformat.
- Wasser mit HDR-Reflexionen, Ufer- und Kielwasserschaum sowie Spritzern aus der tatsächlichen Bewegung der Radkontur.
- Durchgehende Landschaft mit Uferböschungen, Photogrammetrie-Felsen, PBR-Texturen, HDR-Himmel, Schatten und drei Grafikprofilen.
- Lokale Spielstände, Offlinebetrieb, Pause und optionaler Ton; keine Werbung oder Anmeldung.

Die Physik arbeitet im seitlichen Profil. Wasserkräfte sind angenähert; Schlamm nutzt Widerstand, kein verformbares Bodenmodell. Details stehen in der Implementierungsdokumentation und im Spiel unter „Quellen & Physik“.

Version 1.4 erhöht das maximale Achsdrehmoment von 160 auf 420 normalisierte Einheiten. Eine Lastregelung baut auch beim langsamen Klettern das volle Moment auf. Die Übersetzung berücksichtigt den Höhenhub der gezeichneten Kontur: Ein gerader Strich hebt den Buggy wiederholt an und bewegt ihn vorwärts. Konturen erhalten keinen pauschalen Vortrieb. Neue Felsblöcke besitzen eigene Kollisionsumrisse; Felskanten, Mulden, Rillen und Inseln variieren in Höhe und Abstand. [Änderungen und Messwerte](docs/UPDATE-1.4.md).

Die Verbesserungen aus [Version 1.3](docs/BALANCING-1.3.md) bleiben erhalten: geringe Eishaftung, 21 Hindernistypen, bis zu 512 Konturpunkte und keine separate Linienlängenbegrenzung. Sehr dichte Zeichnungen werden adaptiv vereinfacht und im Hintergrund vorbereitet. Die hydrodynamischen Kräfte aus [Version 1.2](docs/BALANCING-1.2.md) bleiben bestehen; die neue Wasserdarstellung ergänzt sie visuell.

Bei einer bereits installierten PWA: Spiel online öffnen und in den Einstellungen **Neue Version laden** wählen, sobald das Update angeboten wird. Danach zeigen die Einstellungen **FORMDRIVE 1.5.0**. Einstellungen, gespeicherte Radform und alte Rennergebnisse bleiben erhalten. Die neuen Expeditionen haben eine eigene Sterne-Wertung.

Die Fahrsteuerung verändert die gewünschte Raddrehzahl; auch beim Kriechen bleibt das hohe Anfahrmoment verfügbar. Bremsen erzeugen entgegengesetzte Achsmomente und geben auf Eis keine zusätzliche Haftung. Neue Bedienelemente unterstützen gleichzeitiges Fahren und Zeichnen. [Änderungen in Version 1.5](docs/UPDATE-1.5.md).

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
- Zeichnungen werden beim Loslassen unmittelbar zu Fahrzeugrädern.
- Unterschiedliche Untergründe und Hindernisse, ausdrücklich einschließlich Wasser.
- Möglichst plausible Physik, insbesondere tatsächliche Wechselwirkung zwischen Radform und Gelände.
- iPhone 16 Pro Max mit iOS 27 (Angabe des Auftraggebers), Hochformat, installierbare PWA.
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

Fremdassets: Poly Haven, CC0. Bibliotheken und Lizenzhinweise: [Quellen & Physik](public/credits.html). Die Werbeabbildung diente als Referenz; sie und die Marken/Spielassets des beworbenen Spiels wurden nicht übernommen.

Das Repository ist öffentlich. Die Spieladresse wird über GitHub Pages bereitgestellt. Quellcode und statischer Build benötigen keine geheimen Schlüssel und keinen eigenen Backendserver.
