# Physik und Balancing 1.2

Auslöser: Zu viel Widerstand und Kippmomente im Wasser, zu wenig Motorkraft sowie zu starke große Rundräder. Feine Zeichnungsdetails sollten deutlicher und plausibler wirken.

## Kontur, Masse und Kontakt

- Die Eingabe behält bis zu 128 statt 48 Konturpunkte. Vereinfachung mit maximal 0,003 Weltlängen Abweichung ersetzt die gleichmäßige Neuabtastung, die zuvor Ecken abschnitt. Eine zu komplexe Zeichnung wird zurückgewiesen, statt ihre Details weiter zu glätten. Die bisherige Radform bleibt dann erhalten.
- Vorlagen und Freihandlinien laufen durch dieselbe Physik. Gerade Abschnitte, Rundungen und offene Enden werden auch im 3D-Modell entsprechend dargestellt.
- Vereinigung der verdickten Striche verhindert doppelte Volumenberechnung an Kreuzungen und beim Nachzeichnen. Flächenmomente liefern Masse, Schwerpunkt und Trägheitsmoment einschließlich der Aussparungen. Speichen werden geometrisch bestimmt, unabhängig von Anzahl und zeitlichem Abstand der Eingabepunkte.
- Maximales Drehmoment: **96 statt 58 pro simuliertem Rad**, rund 66 % mehr. Die Drehzahl bleibt begrenzt. Das Gegenmoment wirkt weiterhin auf das Chassis. Der Motor baut sein Moment stetig auf und nimmt bei drohendem Aufbäumen anhand von Neigung und Drehrate Gas zurück. Es gibt keine künstliche Aufrichtkraft oder gesperrte Fahrzeugdrehung.
- Reibungskoeffizient aller Radkontakte einschließlich Nabe/Speichen: **0,34 statt 1,15 am Reifen**, rund 70 % weniger. Auf Eis begrenzt weiterhin dessen noch kleinerer Wert den Kontakt. Zacken erhalten keinen zusätzlichen Reibungsbonus: Ihr Vorteil entsteht aus den Kontaktflächen und den Normalkräften gegen eine Kante.
- Stufen sind 0,855 bis 0,9 Einheiten hoch. Steigungen besitzen ein steileres Profil mit Rippen, an denen passende Konturen angreifen können. Die zusätzliche Vorlage **Zacken** verwendet flachere, breite Zähne; **Paddel** besitzt tiefere Aussparungen.

## Wasserkräfte

Die überarbeiteten Berechnungen stehen in `src/hydrodynamics.ts` und verwenden dieselbe Kontur wie die festen Radkörper:

1. Verdickte Striche werden zu Polygonkonturen mit Aussparungen vereinigt. Wasser füllt die Innenöffnung eines Ringrads; sie zählt nicht als verdrängtes Material.
2. Die Konturen werden an Wasserspiegel und Ufergrenzen abgeschnitten. Aus nasser Fläche und effektiver Querschnittsbreite folgen eingetauchtes Volumen und dessen Schwerpunkt. Auftrieb ist `Dichte × Volumen × Schwerebeschleunigung` und greift an diesem Schwerpunkt an.
3. Nur tatsächlich benetzte, ursprüngliche Außenflächen erzeugen Bewegungswiderstand. Die durch das Abschneiden entstandene Wasserlinie wird nicht zu einer künstlichen Paddelfläche.
4. Lokale Geschwindigkeit berücksichtigt Translation und Rotation. Druck hängt quadratisch von der normalen Geschwindigkeit ab; tangentiale Oberflächenreibung ist wesentlich geringer. Dadurch erzeugt eine quer bewegte Fläche Vortrieb, während die Oberfläche eines Rundrings überwiegend durch das Wasser gleitet.
5. Integrationspunkte berücksichtigen die Geschwindigkeit entlang einer Fläche. Der Übergang zwischen anströmender und abströmender Seite wird aufgeteilt. Eine gemeinsame implizite Begrenzung des resultierenden Kraft-/Momentpaars verhindert, dass numerischer Wasserwiderstand Bewegungsenergie hinzufügt. Einzelne x-/y-Komponenten werden nicht mehr hart abgeschnitten.
6. Größere sichtbare Schwimmkörper, geometrisch berechneter Auftrieb und passiv dämpfende Rumpfkräfte stabilisieren das Fahrzeug. Der Längswiderstand des Rumpfs ist deutlich geringer als zuvor. Spritzer und die dargestellte Schaumspur richten ihre Stärke nach den berechneten Wasserkräften.

Grundlagen: [Archimedisches Prinzip, OpenStax](https://openstax.org/books/university-physics-volume-1/pages/14-4-archimedes-principle-and-buoyancy), [Widerstandsgleichung, NASA](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/), [Kontaktreibung, Rapier](https://rapier.rs/docs/user_guides/javascript/collider_friction/). Polygonoperationen: [polygon-clipping](https://github.com/mfogel/polygon-clipping), MIT; Lizenztexte liegen im veröffentlichten Spiel.

## Messungen und Regressionen

Deterministische Simulation bei 120 Hz, kein Leistungstest auf einem tatsächlichen iPhone. Geschwindigkeit wird nach zehn Sekunden Einschwingen über weitere fünf Sekunden gemittelt.

| Versuch | 1.1 | 1.2 |
| --- | ---: | ---: |
| Paddelrad im tiefen Wasser | 1,31 | 3,00 |
| Größtmögliches Rundrad im tiefen Wasser | 0,42 | 0,76 |
| Verhältnis Paddel / großer Rundring | 3,1 | 4,0 |

Die geringere Bremswirkung macht auch den Ring etwas schneller. Der Abstand zum geeigneten Paddel wächst dennoch: Der Paddelvortrieb muss nicht mehr gegen den überhöhten Rumpfwiderstand arbeiten.

- Schräger Wassereintritt mit Anfangsneigungen von −26°, 0° und +26°, horizontaler Geschwindigkeit 4 und vertikaler Geschwindigkeit −1; während der Fahrt wiederholte kleine Konturänderungen: kein Überschlag. Nach dem Einschwingen maximal etwa 6,4° Neigung.
- Tatsächliche Seequerung samt Ein- und Ausfahrt mit der Paddelform: etwa 16,9 Sekunden, maximal 15° Neigung im Wasser, keine Bergung.
- Größtes Rundrad scheitert an der ersten hohen Treppe aus drei verschiedenen Anfahrtdistanzen. Eine etwas kleinere gezackte Kontur befreit das Fahrzeug jeweils ohne Bergung.
- Auch an der Riffelrampe bleibt der größte Rundreifen trotz Anlauf hängen. Eine anschließend gezeichnete Zackenform bringt dasselbe Fahrzeug über die Steigung, ohne Bergung.
- Änderungen der inneren Paddeltiefe um 0,005 und 0,010 Einheiten verändern die berechneten Kräfte stetig und messbar. Es gibt keine Formklassifikation oder diskreten Bonus.
- Analytische Flächen-/Schwerpunktfälle mit Löchern, Ufer- und Wasserlinienübergänge, fehlender Energiegewinn durch Widerstand, mehrfach nachgezeichnete Linien, exzentrische Massen und 50 unregelmäßige beziehungsweise selbstkreuzende Konturen werden geprüft.
- Alle 25 Physik-/Geometrietests und alle zwölf Rennen samt Testgelände bestehen; die Streckenfahrten dauern 51,0 bis 85,1 Sekunden ohne Bergung. Die Gegner verwenden dieselben Körper, Kontakte, Motoren und Wasserkräfte. In zusätzlichen Rennen auf den Strecken 1, 7 und 12 kamen auch sämtliche Gegner ohne Bergung ins Ziel.
- Der Spielablauf wurde im Hochformat in Chromium und WebKit geprüft; Offline-Neustart und bestätigtes PWA-Update in Chromium. Ein bei langsamer Darstellung verlängerter Countdown wurde korrigiert und mit absichtlich niedriger Bildrate in WebKit abgesichert.

## Präzisionsgrenzen

Dies ist ein Modell für ein mobiles Spiel, keine vollständige CFD-Simulation. Die Bewegung bleibt zweidimensional mit 3D-Darstellung. Wasser hat einen ruhenden Bezugszustand; Rückströmungen, Turbulenz, Abschattung einer Paddelfläche durch eine andere, mitgeführte Wassermassen und gekoppelte Wellen werden nicht räumlich gelöst. Kreisquerschnitte werden mit effektiven Breiten angenähert; die sehr kleine Nabenverdrängung wird vernachlässigt. Masse-/Kraftgrößen verwenden die normalisierten Einheiten des Spiels.

Innerhalb der erhaltenen Kontur wirken Änderungen auf Kontakte, Masseverteilung und Wasserkräfte. Unterhalb der Eingabe- und Polygonauflösung können Änderungen jedoch verschwinden. Auch bei identischer grober Form können Anfahrttempo und Radstellung entscheiden, ob eine Kante überwunden wird. Eine Zusage, jede beliebig kleine Änderung exakt wie in der realen Welt abzubilden, wäre deshalb falsch.

Vorhandene Spielstände und Lieblingsformen bleiben erhalten. Frühere Bestzeiten wurden gegebenenfalls mit einer anderen Physik erzielt und sind nicht unmittelbar vergleichbar.
