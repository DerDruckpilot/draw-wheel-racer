# FORMDRIVE

Ein eigenständiges Physik-Rennspiel für das iPhone im Hochformat: Während der Fahrt zeichnest du unten auf dem Bildschirm neue Radformen. Die tatsächliche Form beeinflusst, wie das Fahrzeug über verschiedene Untergründe und Hindernisse fährt.

**Version 1.0 – iPhone-PWA mit 3D-Grafik, echter Radgeometrie und Wasserpassagen.**

[Spiel im Browser öffnen](https://derdruckpilot.github.io/draw-wheel-racer/) · [Implementierung und Grenzen](docs/IMPLEMENTIERUNG.md)

## Auf dem iPhone spielen

1. Öffne die Spieladresse in Safari.
2. Tippe auf **Teilen → Zum Home-Bildschirm** und lasse **Als Web-App öffnen** eingeschaltet.
3. Starte das neue Icon und warte beim ersten Start auf **Offline bereit**.
4. Zeichne unten eine Form. Beim Loslassen wird sie zu den Rädern. Das Fahrzeug fährt automatisch.

Zielgerät ist ein iPhone 16 Pro Max mit iOS 27. Die Browserprüfung ersetzt keinen Leistungstest auf dem tatsächlichen iPhone.

## Enthalten

- Zwölf Rennen in drei Landschaften und ein freies Testgelände.
- Drei Computergegner auf eigenen Spuren, Checkpoints, Bestzeiten und Sterne.
- Freihandräder, vier Vorlagen, Rückgängig und gespeicherte Lieblingsform.
- Fels, Eis, Schlamm, Stufen, Rampen, Lücken, Wippen, Baumstämme und Durchfahrten.
- Flache Furten und tiefe Seen: Der Buggy schwimmt, die gezeichneten Räder paddeln.
- Photogrammetrie-Felsen, PBR-Texturen, HDR-Himmel, Schatten und drei Grafikprofile.
- Lokale Spielstände, Offlinebetrieb, Pause und optionaler Ton; keine Werbung oder Anmeldung.

Die Physik arbeitet im seitlichen Profil. Wasserkräfte sind angenähert; Schlamm nutzt Widerstand, kein verformbares Bodenmodell. Details stehen in der Implementierungsdokumentation und im Spiel unter „Quellen & Physik“.

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

Three.js für die 3D-Darstellung, Rapier für die Physik, TypeScript für die Spiellogik und Vite mit Workbox für den PWA-Build. Die Simulation hat feste Schritte von 1/120 Sekunde, begrenztes Motordrehmoment, gefederte Achsträger und strichbasierte Kollisionsformen.

Fremdassets: Poly Haven, CC0. Bibliotheken und Lizenzhinweise: [Quellen & Physik](public/credits.html). Die Werbeabbildung diente als Referenz; sie und die Marken/Spielassets des beworbenen Spiels wurden nicht übernommen.

Das Repository ist öffentlich. Die Spieladresse wird über GitHub Pages bereitgestellt. Quellcode und statischer Build benötigen keine geheimen Schlüssel und keinen eigenen Backendserver.
