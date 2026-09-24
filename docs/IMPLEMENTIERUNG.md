# FORMDRIVE 2.0 — Implementierung

Stand: 24. September 2026. Frühere Update-Dokumente sind Entwicklungshistorie. Die zweidimensionale Streckenphysik und ihre seitlichen Fahrspuren wurden vollständig ersetzt.

## Architektur

TypeScript, Vite, Three.js, Rapier 3D und Workbox. Exakte Versionen stehen im Lockfile.

| Bereich | Datei | Aufgabe |
|---|---|---|
| Gebiete | `src/world-levels.ts` | 21 reproduzierbare Geländegebiete, Wege, Höhenfelder, Rätsel und Vegetation |
| Physik | `src/world-physics.ts` | Vier Räder, Gelenke, Federung, Lenken, Kontakte, Gewicht und Mechanismen |
| Wasser | `src/world-fluid.ts` | Eingetauchte Konturen, Volumen, Druck und Reibung im dreidimensionalen Raum |
| Radgeometrie | `src/wheel-geometry.ts` | Vereinigte Konturen, Schwerpunkt und Massenträgheit |
| Darstellung | `src/world-renderer.ts` | Instanzen, Kamera, Schatten, importierte Objekte und Effekte |
| Materialien | `src/world-materials.ts`, `src/world-water.ts` | PBR-Bodenmischung, Felshänge und Wasseroberflächen |
| Radpuffer | `src/wheel-mesh.ts` | Wiederverwendbare Grafikpuffer für elastische Konturen |
| Fahrspuren | `src/wheel-trails.ts` | Begrenzter Instanzpuffer für verblassende, tatsächliche Bodenkontakte |
| Steuerung | `src/drawing.ts`, `src/drive-controls.ts`, `src/tilt-controls.ts` | Mehrere Zeichenstriche, Pedale, Tastatur und kalibrierte Neigung |
| Speicherung | `src/world-save.ts` | Schema 2, Validierung, Migration und Fortsetzen ab Lager |

## Gelände und sichtbare Kontakte

Die Wege dienen der Gestaltung des Höhenfelds. Sie beschränken keine Positionen. Das Fahrzeug kann beliebig drehen und außerhalb der Wege fahren. Hügel verdecken die weiteren Verzweigungen; natürliche Geländeformen bilden die äußere Landschaft.

Darstellung und Kollision verwenden dieselben Dreiecke auf einem Raster mit einer Einheit Abstand. Benachbarte Kacheln teilen exakt gleiche Randpositionen und Normalen. Das Gelände wird um das Fahrzeug nachgeladen; der Boden unter beweglichen Gegenständen bleibt vorhanden. Importierte feste Gegenstände verwenden ihre sichtbare vereinfachte Dreiecksgeometrie. Bewegliche Gegenstände verwenden konvexe Hüllen. Gras und Laub haben keine harten Kollisionen, Baumstämme schon. Das Fahrzeug kollidiert mit drei aus dem importierten Modell gewonnenen Hüllen für Heck, Kabine und Front; keine übergroße unsichtbare Dachbox begrenzt Durchfahrten.

Die Kamera folgt der tatsächlichen Fahrzeugrichtung. Eine räumliche Kugelabfrage begrenzt sie vor Hindernissen, prüft seitliche Alternativen um Baumstämme und wechselt in niedrigen Durchgängen auf eine flachere Position. Nahe Blätter zwischen Fahrzeug und Kamera werden ausgeblendet; feste Stämme bleiben sichtbar.

Ein gemeinsamer Rand aus Höhensamples reduziert die Auswertung einer Bodenkachel von 3.125 auf 729 Aufrufe. Die Kollisionsgeometrie bleibt gleich; geglättete Normalen folgen nun dem tatsächlichen Raster. Leere Materialgruppen erzeugen keine Zeichenaufrufe. Im automatischen Grafikmodus werden bei anhaltend langsamen Bildern zuerst Auflösung, dann Schattenauflösung und zuletzt Schatten reduziert. Die explizite Einstellung „Detailreich“ behält die volle Darstellung.

## Fahrzeug und Zeichnungen

Rapier integriert mit 90 Hz und zehn Solver-Iterationen. Das Chassis besitzt vier Radkörper mit Federweg; die Vorderräder lenken über zusätzliche Drehgelenke. Die Motoren arbeiten als kraftbegrenzte Geschwindigkeitsregler. Die Kontaktreibung begrenzt übertragbare Kräfte. Gas beeinflusst die gewünschte Drehzahl, wobei hohes Anfahrmoment auch bei geringer Drehzahl verfügbar bleibt. Schwerpunktverlagerung verschiebt reale Masseneigenschaften, ohne die Gesamtmasse zu verändern.

Striche werden als Kapselabschnitte und dünne Nabenverbindungen dargestellt und kollidiert. Exakt übermalte Abschnitte werden dedupliziert. Ein Polygonverbund bestimmt Volumen, Schwerpunkt und Trägheit, damit Überlappungen nicht mehrfach zählen. Gezeichnete Formen bleiben offen; Löcher werden nicht als gefüllte Scheiben behandelt.

Normale Eingaben erhalten eine räumliche Vereinfachungstoleranz von 0,003. Sehr dichte Zeichnungen werden adaptiv auf höchstens 512 Konturpunkte reduziert, bis zu 32.768 Eingabepunkte werden akzeptiert. Konturen oberhalb von 128 Punkten oder 22 Längeneinheiten werden im Worker vorbereitet. Montage ist achsweise und ausdrücklich; der Entwurf wird danach geleert. Größere Räder erhalten keine kostenlose Lagekorrektur durch Decken oder Boden.

Weiche Räder verformen ihre Kontur in Richtung gemessener Kontakte. Das Modell ist eine begrenzte, lastabhängige Approximation, keine Finite-Elemente-Reifensimulation. Grafikpuffer und physische Kollisionsobjekte werden bei gleichbleibender Topologie wiederverwendet. Die Masse bleibt beim Nachgeben gleich. Pausierte Ansichten werden nur neu gerendert, wenn sich die Szene oder ihre Größe ändert.

## Wasser, Schlamm und Eis

Mehrere sich räumlich überlagernde Wellen besitzen an den Ufern abnehmende Amplituden. Dieselbe Höhenfunktion steuert sichtbare Wasserpunkte und Auftrieb. Der Shader berücksichtigt den tatsächlichen triangulierten Grund, unregelmäßige Ufer, lokale Radaktivität und Reflexionen. Schlamm ergänzt seine langsame Bewegung durch importierte Farb- und Normalentexturen. Spritzer und trockener Reifenstaub teilen einen begrenzten Partikelpuffer.

Die eingetauchte Radkontur wird in ihrer aktuellen dreidimensionalen Lage beschnitten. Vorzeichenbehaftete Polygonmomente erhalten Löcher. An angeströmten Flächen wirkt quadratischer Druckwiderstand; Oberflächenreibung wirkt zusätzlich. Kräfte greifen an den jeweiligen Orten an und erzeugen entsprechende Drehmomente. Eine gemeinsame implizite Dämpfung begrenzt den diskreten Energiezuwachs bei schnellen Kontakten. Rumpf und bewegliche Gegenstände erhalten getrennte Auftriebskräfte.

Strömung und Wellen sind vorgegebene Felder. Es gibt keine volumetrische Flüssigkeitsberechnung, brechende Brandung oder real berechnete Rückströmung. Schlamm verwendet höhere Dichte, stärkeren Druckwiderstand und deutlich höhere Viskosität. Der Boden bleibt geometrisch fest. Eis verändert die Reibung echter Bodenflächen; es ist keine zusätzliche glatte Grafikplatte.

## Rätsel und Fortschritt

- Druckplatten sammeln vertikale Kontaktkräfte tatsächlich aufliegender Körper, mit kurzer Stabilisierung und Hysterese. Ein darüber schwebendes Objekt zählt nicht.
- Tore benötigen ein oder mehrere Signale. Fehlende Last schließt sie wieder; eine Hindernisabfrage verhindert das Durchdringen von Fahrzeugen und Gegenständen.
- Ventile erfordern eine bewusste Bedienung im Stillstand. Schleusen kombinieren Ventil und dauerhafte Last; Becken laufen zeitabhängig leer oder voll. Ihre tief liegenden Versorgungskisten können vom schwimmenden Fahrzeug nicht erreicht werden. Nach dem Ablassen führen im Gelände geformte Kiesrampen wieder ans Ufer; sie sind auf bestehendes niedriges Gelände ausgerichtet.
- Wippen bestehen aus einem dynamischen Deck, einem Drehgelenk und einem sichtbaren festen Ballast. Verschobene Gegenstände und das Fahrzeug ändern das tatsächliche Moment. Begehbare Holzauflagen verbinden die Einfahrt und die Felslandung mit dem Deck. Eine freie Stellfläche erlaubt das Aufschieben der bereitgestellten Last. Die Tests bewegen diese Last mit dem Fahrzeug, bevor sie die Überfahrt prüfen.
- Hebebühnen benötigen eine belastete Platte und einen Schalter an der Plattform. Ihr Deck und die erhöhte Landung besitzen passende physische Maße.
- Energiezellen versorgen Generatoren. Alle Generatoren werden für das Ziel benötigt. Drei weitere Fundstücke pro Gebiet sind optional und ergeben einen Stern.
- Checkpoints werden ausschließlich beim Finden aktiviert. Bergen setzt das Fahrzeug dorthin; Rätsel bleiben erhalten. Ein lokaler Gegenstandsreset verhindert dauerhaft verlorene Kisten.

Das Layout wächst von zwei auf bis zu fünf Hauptanlagen, ergänzt durch charakteristische Zusatzrätsel. Die Karten verwenden verschiedene deterministische Seeds, Geländeformen, Verzweigungen und biomeabhängige Dekoration. Kein Zeitlimit erzwingt eine bestimmte Lösungsgeschwindigkeit.

## Speicherung, Offline und Prüfung

`formdrive.world.v2` speichert nur validierte bekannte IDs, endliche Werte und begrenzte Körperpositionen. Alte `formdrive.v1`-Fortschritte werden entfernt; Ton und Grafikqualität bleiben erhalten. Fortsetzen erfolgt am letzten gefundenen Lager, mit wiederhergestellten Formen, Gegenständen und Rätselzuständen. Auch die Winkel belasteter Wippen werden vor dem nächsten Physikschritt wiederhergestellt, damit Gewichte auf dem Deck bleiben. Das Speichern läuft periodisch, beim Pausieren und beim Verlassen der Seite.

Der Produktionsbuild enthält einen vollständigen Offlinecache einschließlich Worker, Physik, komprimierter Texturen, Modelle und Lizenznachweise. Updates warten auf die Aktion des Spielers. Eine bestehende Fahrt wird vorher gespeichert.

Automatisierte Prüfungen decken reale Fahr- und Schiebeversuche, Kontrollabhängigkeiten, lösbare Hebebühnen und Wippen, passive Wasserkräfte, komplexe Konturen, Terrainränder, alle 21 Layouts, Assetprüfsummen, Spielstandvalidierung und die Oberfläche in Chromium/WebKit ab. Bildschirmgröße und Sensorereignisse werden simuliert. Die Bildrate, Akkulast und Sensorqualität auf dem tatsächlichen iPhone sind damit nicht gemessen.
