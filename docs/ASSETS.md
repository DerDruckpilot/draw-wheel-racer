# Assetaufbereitung

Alle für das Spiel benötigten Dateien liegen in `public/assets`. Ein normaler Build benötigt weder Blender noch einen externen Assetdienst.

## Quellen

- 38 ausgewählte Modellvarianten und neun PBR-Materialsets: [Poly Haven](https://polyhaven.com), CC0. Die genauen URLs, Urheber, Varianten, Änderungen und SHA-256-Prüfsummen stehen in `public/assets/world/manifest.json` und `textures.json`.
- Umgebungslicht: [Kloppenheim 06 Pure Sky](https://polyhaven.com/a/kloppenheim_06_puresky), CC0; Herkunft in `public/assets/sources.json`.
- Fahrzeug: CesiumJS GroundVehicle, Apache-2.0. Fixierte Quellrevision und Bearbeitung in `scripts/prepare-vehicle.mjs`, Nachweise in `public/assets/offroad-source.json`.
- Texturtranskodierung: Basis Universal über Three.js; vollständige Lizenz in `public/licenses/basis.txt`.

## Optionale Neuaufbereitung

Die Pipeline braucht die Entwicklungsabhängigkeiten aus `npm ci`. Originalmodelle und Zwischenbilder liegen ausschließlich in `.local/` und werden nicht veröffentlicht.

1. `node scripts/fetch-world-assets.mjs` lädt die ausgewählten Poly-Haven-Modelle, isoliert Varianten, normalisiert Maße und vereinfacht Geometrie. Einzelne IDs können als Argumente übergeben werden.
2. `node scripts/fetch-world-textures.mjs` lädt die neun Materialsets in `.local/world-textures/` und aktualisiert ihre Nachweise.
3. `scripts/bake-tree-canopies.py` rendert mit Blender die ursprünglichen dichten Baumkronen in neun räumliche Tiefenschichten. `node scripts/install-tree-canopies.mjs` kombiniert diese mit der erhaltenen Stammgeometrie.
4. `node scripts/compress-world-assets.mjs` verwendet `toktx` aus KTX-Software, komprimiert Materialtexturen in ETC1S und Normalen beziehungsweise Alpha-Materialien in UASTC, erzeugt Mipmaps und aktualisiert die Prüfsummen. `TOKTX_PATH` kann den Pfad zu `toktx` überschreiben; der Standard liegt in `.local/tools/ktx/bin/`.
5. `node scripts/prepare-ground-details.mjs` erzeugt aus den komprimierten Felsmodellen zwei Kiesvarianten mit jeweils 120 Dreiecken. Die fotografierten Texturen bleiben erhalten; Geometrie, Nachweise und Prüfsummen werden aktualisiert. Die Normierung erfolgt auf eine Einheit entlang der längsten Seite. Der Größenkatalog in `src/world-scale.ts` ordnet Gegenstände anschließend relativ zum Truck ein.
6. `node scripts/fetch-assets.mjs` aktualisiert ausschließlich das HDRI. `node scripts/prepare-vehicle.mjs` erzeugt das Fahrzeug aus der fixierten Cesium-Quelle neu und ruft anschließend `prepare-vehicle-collision.mjs` für drei passende Kollisionshüllen auf.
7. Anschließend `npm test` und `npm run build` ausführen und die betroffenen Objekte visuell prüfen.

Feste Gegenstände kollidieren auf denselben vereinfachten Dreiecken wie ihre sichtbare Geometrie. Bewegliche Gegenstände verwenden konvexe Hüllen. Bei Pflanzen werden Blätter aus den harten Kollisionen ausgeschlossen. Die zugeschnittene Holzdeck-Variante enthält ausschließlich die waagerechten Bohlen des ursprünglichen Stegs. Bei zwei Fels-Scans werden offene Unterseiten entlang ihrer originalen Konturen trianguliert; `repair-rock-bases.mjs` kann diese Reparatur auch auf bestehende komprimierte Modelle anwenden.

Für die Baumkronen werden keine frei erfundenen Texturen verwendet: Die mobilen Schichten stammen aus gerenderten Ansichten des importierten Originals. Ihre begrenzte räumliche Auflösung ist aus nächster Nähe erkennbar, spart aber die Millionen ursprünglichen Blattpolygone.

Die veröffentlichten Dateien enthalten nur Laufzeitmodelle, Kollisionen, KTX2-Texturen und Nachweise. Ursprüngliche hochauflösende Downloads und Zwischenformate gehören nicht in den Offlinecache.

Für den dichteren Bodenbewuchs ab 2.2 kommen die Variante `grass_medium_02_d` aus [Grass Medium 02](https://polyhaven.com/a/grass_medium_02), die blühende Variante `flower_gazania_h_LOD0` aus [Flower Gazania](https://polyhaven.com/a/flower_gazania) und eine zusätzliche vereinfachte Variante des vorhandenen [Rooibos-Busches](https://polyhaven.com/a/wild_rooibos_bush) hinzu. Die Pflanzen werden als räumliche Instanzen verteilt; Farne und die bisherigen Grasbüschel bleiben ebenfalls im Einsatz.
