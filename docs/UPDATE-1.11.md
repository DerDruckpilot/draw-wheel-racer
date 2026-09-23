# FORMDRIVE 1.11 — Abzweigungen und Brandung

## Neue Strecken

Alle 21 Expeditionen und das Testgelände besitzen jetzt breite Verzweigungen. Die nutzbare Strecke wächst von 4,4 auf 19,6 Spieleinheiten. Drei Wege liegen nebeneinander, mit eigenen Bodenhöhen, Felskontakten, Durchfahrten, Wasser- und Lehmbecken. Die Landschaft verläuft weiterhin räumlich geschwungen.

Normale Expeditionen haben vier Hindernisgruppen, Expertenstrecken fünf und das Testgelände sechs. An jeder Gruppe stehen zwei unterschiedliche Kombinationen zur Wahl. Ein dritter Arm endet in einem massiven Felssturz. Seine Zufahrt enthält bewusst keine unumkehrbaren Sprünge oder einstürzenden Brücken: Zurückfahren bleibt möglich. Breite, ebene Bereiche verbinden die Gruppen; die Lager liegen davor. Es gibt keine automatische Wegwahl und keine eingeblendete Lösung.

Die Auswahl kombiniert enge Durchfahrten, hohe Kanten, versetzte Stufen, nachgebende Brücken, Schlamm, Schalter, Eis und Wasser. Die Transportmission verwendet Durchfahrten mit Platz für die physische Ladung. Unterschiedliche Anforderungen an Radgröße, Kontur, Anfahrt und Fahrzeugneigung bleiben erhalten. Hindernisse erhalten keine versteckten Boni abhängig von einem Radnamen.

## Wasser mit körperlicher Wirkung

Der bisherige Wasserfall entfällt in den neuen Expeditionen. Flussarme erhalten zwei sich überlagernde Wellenzüge, Gegenströmung und geschützte Bereiche. Darstellung, Eintauchtiefe, Auftrieb, lokale Wasserbewegung und Spritzer verwenden dieselben Wellenparameter und dieselbe Simulationszeit. Lange Konturkanten werden für die Wasserberechnung unterteilt. Bug und Heck erfahren damit unterschiedliche Kräfte.

In einem reproduzierbaren 24-Sekunden-Schwimmversuch mit gleicher Paddelzeichnung und gleichem Gas erzeugt die Brandung deutliches Stampfen: maximal rund 42° ohne Gewichtsregelung gegenüber rund 29° mit aktiver Gegenverlagerung. Der mittlere quadratische Kippwinkel sinkt dabei von 0,357 auf 0,267 Radiant. Das sind Vergleichswerte eines festgelegten Versuchs, keine Zusage für jede Zeichnung oder Fahrweise.

Grundlagen: [GPU Gems – überlagerte Wellenfunktionen](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models), [NOAA – Wellen und Wasserbewegung](https://oceanexplorer.noaa.gov/ocean-fact/waves/). Das Modell verwendet vorgegebene, begrenzte Wellenenergie. Es berechnet keine vollständige freie Strömung, brechende Wellen oder gegenseitige Verdrängung aller Wasserzellen.

## Kontakte, Darstellung und Grenzen

Rapier simuliert weiterhin Längsbewegung, Achsen, Fahrzeugneigung und Höhe im Seitenprofil. Seitliches Lenken wählt anhand der tatsächlichen Querposition die passenden Bodenkontakte und Hindernisse. Eine seitliche Kollisionsprüfung verhindert das Eindringen in Felswände. Bewegliche Steine, Eis, Tore und Wippen kollidieren mit ihrem eigenen Untergrund. Versenkte Druckplatten bleiben unabhängig voneinander beweglich.

Das ist ein Modell aus mehreren räumlich angeordneten Profilen mit Querbewegung, keine vollständige 3D-Fahrzeugphysik. Es simuliert weiterhin zwei Achsen; vier unabhängige Radlasten und seitlicher Überschlag sind nicht enthalten. Die Neigungssteuerung bleibt unverändert.

Geschlossene Geländeabschnitte verbinden die Wege mit ihren Ufern. Felsseiten erhalten räumlich projizierte Texturen, damit senkrechte Flächen nicht langgezogen erscheinen. Höhlenschultern besitzen auch an unterschiedlich hohen Nachbarwegen eine positive Materialdicke. Die Kamera zeigt mehr von der breiten Strecke; die bestehende Fahrzeugsilhouette hilft bei Verdeckung durch Felsen.

## Prüfung

- Automatisierte Profil-, Kollisions-, Wasser-, Geometrie- und Bedienregressionen.
- Vollständige Fahrten mit Formwechseln und Lenkung über beide Wegkombinationen: `npm run test:expeditions` und `npm run test:expeditions -- --alternative`.
- Rückfahrt vom Felssturz und anschließender Wechsel in einen anderen Arm ohne Bergung.
- Große Ringe, kleine Ringe und offene Haken mit unveränderter Form, aber korrekter Wegwahl: `npm run test:balance`. Die Prüfung lässt sie keine absichtlichen Sackgassen wählen.
- Mobile WebKit-Darstellung und Chromium-PWA-Regressionen; ein echter iPhone-Leistungstest bleibt dem Gerätetest vorbehalten.

Bestehende Spielstände und Level-IDs bleiben erhalten. Bereits vergebene Sterne werden beim Umbau nicht gelöscht. Eine installierte PWA online öffnen und unter Einstellungen **Neue Version laden** wählen; der Versionsstand lautet **1.11.0**.
