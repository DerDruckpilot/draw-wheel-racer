# Balancing 1.1

Auslöser: Unrunde Räder hatten zu wenig Anfahrkraft; große Rundräder erledigten die ersten Strecken ohne Wechsel und flache Wasserpassagen bremsten kaum.

## Änderungen

- Maximaler Antrieb pro physikalischem Rad: 58 statt 20. Stärkere Drehzahlregelung bei unveränderter Zieldrehzahl. Das Gegenmoment wirkt weiterhin auf das Chassis.
- Stufenhöhe abhängig von der Streckenschwierigkeit: 0,72 bis 0,84 statt rund 0,31 bis 0,41. Felsprofile und Baumstämme sind ebenfalls ausgeprägter.
- Niedrige, längere Durchfahrten mit 1,81 Einheiten freier Höhe; markierter Eingang. Große Rundräder passen geometrisch nicht hindurch. Kleine Räder bewältigen die neuen Stufen wiederum schlechter.
- Schon die erste Strecke kombiniert Stufen, eine niedrige Durchfahrt, Furt und Schwimmen. Die anderen Strecken enthalten ebenfalls gegensätzliche Anforderungen.
- Furten sind länger und etwas tiefer, bleiben jedoch über den Grund befahrbar. Tiefe Abschnitte sind länger; der Boden ist dort außer Reichweite der Räder.
- Mehr Rumpfwiderstand; mehr Druckwiderstand quer zu Radsegmenten und deutlich weniger tangentiale Reibung. Die Radform bestimmt die Paddelwirkung geometrisch. Es gibt keine Abfrage, die runde Formen pauschal bestraft oder benannte Paddelvorlagen bevorzugt.
- Neue Vorlage „Klein“ und Hinweise vor Stufen, Furten und niedrigen Durchfahrten. Computergegner wechseln ihre Formen passend zur Strecke und unterliegen derselben Physik.
- Bestehende lokale Spielstände bleiben erhalten. Frühere Bestzeiten können aus den leichteren Strecken von Version 1.0 stammen.

## Gemessene Vergleiche

Deterministische Simulation mit 120 Schritten pro Sekunde, gleicher Masse-/Materialregel und identischen Startbedingungen. Das sind Simulationswerte, keine Messungen am Ziel-iPhone.

| Versuch | Version 1.0 | Version 1.1 |
| --- | ---: | ---: |
| Dreiecksrad auf flachem Boden, Weg nach 15 s | −0,43 | 29,48 |
| Größtes Rundrad im tiefen Wasser, mittlere Geschwindigkeit nach dem Einschwingen | 1,17 | 0,42 |
| Paddelrad im tiefen Wasser, mittlere Geschwindigkeit nach dem Einschwingen | 2,03 | 1,31 |

Paddeln ist unter den neuen Bedingungen rund 3,1-mal so schnell wie der größtmögliche glatte Rundreifen. Beide Formen sind im Wasser langsamer als auf Land.

Das Durchqueren derselben Furt mit maximal großen Rundrädern dauert trocken 2,54 s, mit Wasser 4,43 s: rund 74 % längere Durchquerung beziehungsweise 43 % weniger Durchschnittsgeschwindigkeit.

## Abgesicherte Spielbarkeit

- Elf Physiktests prüfen unter anderem, dass Dreiecksräder auf ebener Strecke nicht mehr stehen bleiben, die Furt messbar bremst und Paddelformen einen deutlichen Vorteil gegenüber großen Ringen besitzen.
- An einer echten Durchfahrt bleibt das große Rundrad hängen; an echten Stufen das kleine Rad. Eine passende neue Zeichnung befreit das Fahrzeug jeweils ohne Bergung.
- Alle zwölf Rennen und das Testgelände sind mit einer einfachen Formwechselstrategie ohne Bergung durchfahrbar. Die Fahrzeiten liegen bei 62,5 bis 109,8 Sekunden.
- Physische Kollisionen und Wasserkräfte bleiben die Ursache für Vor- und Nachteile. Neue ungewöhnliche Zeichnungen können weitere brauchbare Lösungen ergeben; es gibt keine vorgeschriebene einzig richtige Form.
