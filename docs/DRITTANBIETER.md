# Kandidaten für Bibliotheken und Assets

Stand 22. September 2026. Die folgende ursprüngliche Kandidatenliste wird durch die tatsächliche Verwendung unten ergänzt.

| Kandidat | Geplanter Zweck | Vom Anbieter angegebene Lizenz / Quelle |
| --- | --- | --- |
| Three.js | 3D-Grafik | [MIT](https://github.com/mrdoob/three.js/blob/dev/LICENSE) |
| Rapier | Starrkörperphysik | [Apache-2.0](https://github.com/dimforge/rapier/blob/master/LICENSE) |
| Kenney Racing Kit | Einfache Fahrzeuge, Streckendekoration und mögliche Ausgangsmodelle | [CC0, Asset-Seite](https://kenney.nl/assets/racing-kit) |
| Poly Haven | Fels-/Bodenmaterialien, ausgewählte Modelle oder Beleuchtungsreferenzen | [CC0 für Assets, Anbieterangaben](https://polyhaven.com/license) |

Nach der Rückmeldung ist realistische, möglichst detaillierte Grafik die gestalterische Vorgabe. Entsprechend haben hochwertige Materialien und realistische Modelle Vorrang. Das stilisierte Kenney Racing Kit bleibt höchstens ein Kandidat für vorläufige Prototypobjekte und ist keine Referenz für die endgültige Grafik.

Für die iPhone-Fassung sollen ausgewählte Modelle und Texturen vereinfacht und lokal mit ausgeliefert werden. Ein hochaufgelöstes Asset ist nicht automatisch für eine mobile PWA geeignet. Die gezeichneten Räder werden aus der Eingabe erzeugt; dafür wird kein fertiges Radmodell benötigt.

Bei tatsächlicher Übernahme werden exakte Quelle, Autor, Version oder Downloadstand, Lizenzdatei, lokale Dateinamen und Änderungen dokumentiert. Bibliotheks-Lizenzhinweise werden in der ausgelieferten Anwendung berücksichtigt. Die Tabelle vergibt keine Lizenz für das Gesamtprojekt.

Das Werbebild sowie die Figuren, Namen und Marken des beworbenen Spiels sind keine übernommenen Spielassets. Die eigene Darstellung orientiert sich an der beschriebenen Mechanik.

## Tatsächlich verwendet

- Three.js 0.186.0, MIT, und Rapier 2D Compat 0.20.0, Apache-2.0. Lizenztexte unter `public/licenses/`.
- Workbox für Service Worker und Offlinecache, MIT. Lizenztext unter `public/licenses/`.
- [Boulder 01](https://polyhaven.com/a/boulder_01), Rico Cilliers: CC0-Felsmodell, auf rund 8.000 Dreiecke vereinfacht, kompakt als `public/assets/boulder.glb` mit eingebetteten 1K-Texturen.
- [Rock Face](https://polyhaven.com/a/rock_face), Greg Zaal/Dario Barresi: 1K-Farb-, Normalen- und Rauheitskarten unter `public/assets/rock_face/`.
- [Rocky Terrain](https://polyhaven.com/a/rocky_terrain), Poly Haven: 1K-Farb-, Normalen- und Rauheitskarten unter `public/assets/rocky_terrain/`.
- [Kloppenheim 06 Pure Sky](https://polyhaven.com/a/kloppenheim_06_puresky), Greg Zaal/Jarod Guest: 1K-HDRI als `public/assets/sky.hdr` für Himmel und Umgebungslicht.

Die Poly-Haven-Assets stehen unter CC0. Original-Downloadadressen und Prüfsummen sind in `public/assets/sources.json` dokumentiert; die Originalmodell-Dateien werden durch das daraus erzeugte GLB ersetzt. Die Aufbereitung ist mit den Skripten unter `scripts/` nachvollziehbar. Das Kenney Racing Kit wurde nicht verwendet. Fahrzeuge, Räder, UI, Icons und Sounds sind für dieses Projekt erstellt.
