# FORMDRIVE 1.3 – Antrieb, Eis, Hindernisse und Zeichnungen

23. September 2026. Messungen aus der festen 120-Hz-Simulation, keine auf dem iPhone gemessenen Bildraten. Reproduzierbare Regressionen in `tests/revision.test.ts`, übrige Physiktests und vollständige Streckenfahrten über `npm test` und `npm run test:courses`.

## Antrieb unter Last

Die Paddelkontur blieb in der alten Stufenprobe über 30 Sekunden bei etwa 3,2 Metern innerhalb des Hindernisses stehen. Die Hinterachse stand nahezu still, während das Vorderrad drehte. Neben dem begrenzten Moment griff die alte Leistungsrücknahme bereits bei stabiler Kletterschräglage ein.

Das maximale Achsdrehmoment steigt von 96 auf 160 (+66,7 %). Unabhängige Drehzahlregler erlauben der Hinterachse volle Leistung, wenn vorne die Zieldrehzahl erreicht ist. Bei steiler Chassislage wird langsamer übersetzt, ohne das Anfahrmoment zu verringern. Der Kippschutz nutzt eine kurze Gasunterbrechung mit Hysterese; die vorherige Teilgasregelung konnte das Fahrzeug dauerhaft auf der Hinterachse im Gleichgewicht halten. Nach Entlastung fällt das Drehmoment schneller ab, als es aufgebaut wird. Das Reaktionsmoment auf das Chassis bleibt erhalten.

Die Regression fährt dieselbe Paddelvorlage auf den Stufen von Strecke 1 und Nordpass: jeweils zwei Anfahrpositionen und drei Anfangswinkel. Alle zwölf Fälle gelangen ohne Bergung über die Stufen. Die belastete Hinterachse erreicht 160 Momenteneinheiten, während vorne das Rad frei dreht. Wasser behält die sanftere Kennlinie und die Stabilitätsprüfungen aus 1.2.

## Eis als Kontaktproblem

Eisreibung: 0,018 statt 0,065. Die Reibung des Kontaktpaars bleibt das Minimum der beiden Materialien; es gibt keinen Bonus für benannte Vorlagen. Die verwendete [Rapier-Reibungskombination](https://rapier.rs/docs/user_guides/javascript/colliders/#friction) wirkt auf die tatsächlichen Kontakte.

Ein langer gefrorener Anstieg mit kleinen versetzten Kanten lässt sich nicht nur mit Anlauf umgehen. Die normalen Kräfte an diesen Kanten ermöglichen passenden Zacken das Klettern. Ein glatter Abschnitt erlaubt Rutschen; die gebrochene Ausfahrt bietet nach Schwungverlust wieder Eingriffsmöglichkeiten. Optisch wird Eis mit Glanz, Frost und feinen Rissen vom Fels unterschieden.

| Vergleich am selben Eisanstieg | Ergebnis |
| --- | --- |
| Größtmöglicher Rundreifen auf Eis | Nach 30 s noch im unteren Anstieg, etwa 6,8 m ab Abschnittsbeginn |
| Derselbe Rundreifen, identische Geometrie aus Stein | Durchfahrt in etwa 14,4 s |
| Gezackte Kontur auf Eis | Durchfahrt in etwa 12,5 s |

Auf ebener Fläche schafft der Rundreifen in zehn Sekunden rund 49 m auf Stein und nur rund 4 m auf Eis, jeweils aus dem Stand. Das Eis bremst nicht künstlich: Es begrenzt den übertragbaren Vortrieb.

## Neun zusätzliche Hindernistypen

| Hindernis | Geometrische oder dynamische Eigenschaft |
| --- | --- |
| Waschbrett | Viele niedrige, eng stehende Rippen |
| Quergräben | Vier unterschiedlich breite Einschnitte |
| Freilaufwalzen | Sechs frei drehende Trommeln auf echten Drehgelenken pro Spur |
| Wellenhügel | Drei runde Hügel mit wachsender Höhe |
| Sägezahnfelsen | Kurze steile Antritte, schmale Kronen und lange Abfahrten |
| Kippplatten | Drei unabhängig um ihre Lager kippende Platten pro Spur |
| Felstor | Langes niedriges Dach über unebenem Boden |
| Versunkener Steg | Überflutete Lücken und einzelne erhöhte Trittsteine |
| Eisanstieg | Glatte Oberfläche mit gefrorenen Eingriffskanten |

Die zwölf Rennen kombinieren diese Elemente unterschiedlich. Das Testgelände umfasst alle 21 Typen. Ein großer Rundreifen scheitert in Vergleichsfahrten unter anderem an Walzen, Felstor, versunkenem Steg und Eisanstieg; er bleibt für Gräben und Waschbrett nützlich. Die Riffelrampe wurde auf das höhere Motormoment abgestimmt, die Sprungkante bekam eine längere ebene Anfahrt.

## Freihand ohne kurze Längengrenze

512 statt 128 physikalische Konturpunkte; keine separate Obergrenze für die Linienlänge. Bis zu 32.768 Pointer-Samples werden gesammelt, danach wird der bisherige Verlauf verdichtet und weiter aufgezeichnet. Normale Zeichnungen behalten die Toleranz von 0,003 Einheiten. Bei noch detailreicheren Konturen löst eine priorisierte Vereinfachung zuerst die größten Abweichungen auf, bis das mobile Berechnungsbudget erreicht ist. Das ist eine endliche Näherung und keine unbegrenzte Auflösung.

Eine Spirale mit 22 Windungen und 3.521 Eingabepunkten ergibt beispielsweise 512 Konturpunkte und rund 90 Einheiten Linienlänge. Sie lässt sich montieren, speichern und im Wasser simulieren. Die Polygonvereinigung läuft bei aufwendigen Formen in einem Web Worker. Die bisherigen Räder fahren bis zur Fertigstellung weiter. Neuere Eingaben überholen ältere Resultate; auch während des Vorbereitens kann eine Vorlage gewählt werden. Der zusätzliche Worker wird vom PWA-Cache erfasst.

## Landschaft

Die Fahrbahn geht an beiden Seiten mit identischen Randhöhen in Böschungen über. Das Vorderland reicht über 60 Welteinheiten bis weit hinter die Kamera. Wasserflächen setzen sich in den Böschungen fort und werden vom Land verdeckt. Die bisherige senkrechte Vorderwand entfällt. Das umgebende Gelände ist Kulisse; das Fahrzeug fährt weiterhin in der seitlichen 2D-Simulation auf seiner Spur.

## Prüfung und Grenzen

Alle 30 Physikprüfungen und alle 13 vollständigen Streckenfahrten bestanden. Die zwölf Rennen benötigen mit der Teststrategie rund 54–74 Sekunden; das erweiterte Testgelände rund 163 Sekunden. Zusätzlich wurden alle zwölf Rennen mit je vier Fahrzeugen geprüft: sämtliche 48 Fahrzeuge kamen ohne Bergung ins Ziel. Dieser Test ist mit `npm run test:races` wiederholbar.

Browserprüfungen in Chromium und WebKit sowie Sichtprüfung der Stufen, Eisflächen, Walzen, Kippplatten und Seen ergänzen die Simulation. Die Tests prüfen auch den Offlinecache einschließlich erstmaligem Start des Kontur-Workers ohne Netz, bestätigte PWA-Updates, lange Zeichnungen, Abbruch über eine neue Vorlage und den Erhalt gespeicherter Formen. Die Grafik- und Zeichnungsleistung auf dem tatsächlichen iPhone muss beim Spielen geprüft werden.
