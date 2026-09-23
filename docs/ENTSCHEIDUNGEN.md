# Entscheidungen vor dem Coding

Stand: 22. September 2026, nach der abschließenden Rückmeldung und dem Implementierungsauftrag. Die Spielentwicklung und Veröffentlichung sind beauftragt.

## Weiterentwicklung am 23. September 2026

Der Auftraggeber wünscht eine Weiterentwicklung in Richtung Hindernis-Abenteuer, beispielsweise mit Anleihen an Hill Climb Racing, und legt den Schwerpunkt auf das Schaffen der Level. Dies ersetzt die bisherigen Annahmen zum automatischen Rennen gegen drei Gegner. Version 1.5 verwendet Solo-Expeditionen mit Gas, Bremse und Rückwärtsfahrt; ein optionaler Tempomat ermöglicht weiter einhändiges Zeichnen. Zielankunft, bergungsfreie Fahrt und optionale Fundstücke bilden die Wertung. Details stehen in [UPDATE-1.5.md](UPDATE-1.5.md).

## Ursprünglicher Stand

- Ausdrücklich genanntes Zielgerät: iPhone 16 Pro Max mit iOS 27.
- Wasser wird verbindlicher Streckenbestandteil.
- Möglichst detaillierte, realistische 3D-Grafik; hochwertige kostenlose Modelle und Texturen sind erwünscht. Dies ersetzt den ursprünglichen Vorschlag eines freundlichen stilisierten Looks.
- Das Repository darf öffentlich werden; die PWA soll auf dem eigenen iPhone installiert und getestet werden können.

Der Auftraggeber hat Abweichungen zu den Punkten 3, 8, 10 und 12 genannt. Die übrigen Empfehlungen werden als Arbeitsannahmen weitergeführt und in der Antwort transparent benannt. Es handelt sich nicht um separat protokollierte ausdrückliche Antworten auf jede frühere Frage.

Diese Arbeitsannahmen sind: automatische Fahrt auf fester Spur; verdickter offener Zeichenstrich; Radwechsel beim Loslassen bei weiterlaufendem Rennen; eine Form für alle Räder; gezeichnete Größe und Materialmenge wirken auf Größe und Gewicht; drei Computergegner und Teststrecke; fairer Checkpoint-Neustart; zunächst Physikprototyp, anschließend zwölf kurze Strecken in Canyon/Eis/Baustelle; offline nach Erstdownload, lokale Spielstände, Deutsch, abschaltbarer Ton, keine Werbung oder Kontopflicht; freie Assets und kostenfreies Hosting.

## Bestätigte Entscheidung: Wasser

Der Auftraggeber wünscht sowohl flache Furten als auch tiefe Abschnitte, in denen die Fahrzeuge schwimmen.

Umgesetzt werden Auftrieb am Chassis und von Bewegung und Ausrichtung abhängige Widerstandskräfte an den untergetauchten Radsegmenten. Die Räder können dadurch paddeln. Das Wasserphysikmodell ist vereinfacht; die visuelle Wasseroberfläche wird getrennt dargestellt.

## Bereitstellung

GitHub Pages wird für die ausdrücklich beauftragte HTTPS-Veröffentlichung verwendet. Quellcode und lokale Spielassets liegen im öffentlichen Repository. Eine öffentliche Repository-Sichtbarkeit ist keine Entscheidung für eine bestimmte Open-Source-Lizenz des Gesamtprojekts. Es werden keine kostenpflichtigen Dienste gebucht.

Die Zielangabe iOS 27 stammt vom Auftraggeber; Kompatibilität und Leistung gelten erst nach einem Test auf dem tatsächlichen Gerät als nachgewiesen.

## Ursprünglicher Fragenkatalog (historischer Stand)

Die folgende Tabelle dokumentiert die ursprünglich gestellten Fragen und Empfehlungen. Der aktuelle Stand oben hat Vorrang; die Tabelle ist keine Liste erneut zu beantwortender Fragen.

Die ersten drei Fragen wurden bereits als Eingabefragen gestellt. Die vollständige Liste dient dazu, die restlichen Unklarheiten vor Implementierungsbeginn gesammelt zu beantworten. Technische Details wie Datenstrukturen, Dateinamen oder Solverparameter entscheidet die Entwicklung anschließend anhand dieser Ziele und Messungen.

| Nr. | Frage | Empfehlung / Auswahl |
| --- | --- | --- |
| 1 | Nur zeichnen bei automatischer Fahrt, zusätzlich Gas/Bremse oder frei lenken? | Automatisch, feste Fahrspur, schräge 3D-Ansicht; kein seitliches Drängeln |
| 2 | Wird der Strich selbst zum Rad, auch als offene Form, oder eine geschlossene ausgefüllte Fläche? | Verdickter offener Strich wie in der Werbung |
| 3 | Welches iPhone-Modell und welche iOS-Version sollen unterstützt werden? | Vom Auftraggeber anzugeben; weitere Geräte nur falls gewünscht |
| 4 | Wechseln die Räder schon während jeder Fingerbewegung oder sofort beim Loslassen? Läuft das Spiel beim Zeichnen normal weiter? | Beim Loslassen übernehmen, Rennen läuft weiter; Übungsmodus mit optionaler Zeitlupe |
| 5 | Eine Form für alle Räder oder getrennte Formen vorne/hinten? Ein Strich oder mehrere Striche? | Eine gemeinsame Form und ein durchgehender Strich; Kreuzungen erlaubt |
| 6 | Soll die Zeichengröße die Radgröße bestimmen? Soll mehr gezeichnetes Material mehr wiegen? | Fester Maßstab mit Größenlimit und markierter Achse; gleiche Materialdichte und Strichdicke |
| 7 | Rennen gegen Computer, Zeitfahren, freies Experimentieren oder Online-Mehrspieler? | Kurze Rennen gegen drei Computerfahrzeuge plus Teststrecke; online später |
| 8 | Welche Untergründe/Hindernisse sind unverzichtbar? Müssen Sand/Schlamm einsinken oder Wasser befahrbar sein? | Zuerst Straße, Fels, Eis, Stufen, Rampen, Lücken und Wippe; weicher Boden danach, Wasser optional |
| 9 | Strenge Herausforderung mit Steckenbleiben/Überschlägen oder deutliche Fahrhilfen? | Formfehler spürbar, fairer Checkpoint-Neustart; kein automatischer Sieg durch versteckte Boni |
| 10 | Welche Grafikrichtung und welcher Umfang für die erste vollständige Fassung? | Eigenständiger freundlicher 3D-Stil, Canyon/Eis/Baustelle, zwölf kurze Strecken und Teststrecke; erst ein Physikprototyp |
| 11 | Soll es offline ohne Konto funktionieren oder werden Cloud-Spielstände/Ranglisten benötigt? | Nach Erstdownload offline; Spielstand lokal, deutsche Oberfläche, abschaltbarer Ton, keine Werbung |
| 12 | Nur private Nutzung oder später öffentlich? Gibt es Wunschname, Wunschadresse oder ein Budget für Hosting/Assets? | Repository privat lassen, Arbeitstitel beibehalten, freie Assets und zunächst kostenfreie HTTPS-Veröffentlichung anstreben; keine kostenpflichtigen Dienste buchen |

Antwortformat: Nummern mit eigenen Antworten; für alle anderen Punkte kann ausdrücklich „Empfehlung übernehmen“ festgelegt werden. Auch eine kleinere erste Spielversion oder andere Schwerpunktsetzung ist möglich.

## Bereits festgelegt

- Installierbarkeit als iPhone-PWA im Hochformat wird angestrebt.
- Die Radform muss die tatsächliche Fortbewegung beeinflussen.
- Das Zeichenfeld bleibt während des Spiels sichtbar.
- Recherche und Repository sind vor Coding gewünscht.
- Passend lizenzierter Fremdcode und 3D-Modelle sind erlaubt.
- Das neue Repository wurde unter DerDruckpilot/draw-wheel-racer privat angelegt.

## Noch nicht entschieden

Three.js und Rapier werden für die feste Fahrspur verwendet. Die Wasserentscheidung ist geklärt. Interne Umsetzung, Tests und bekannte Grenzen stehen in IMPLEMENTIERUNG.md. Eine Softwarelizenz für das Gesamtprojekt wurde noch nicht ausgewählt; diese Entscheidung ist für die Bereitstellung des beauftragten Spiels nicht erforderlich.

## Änderung 1.6: Querformat und getrennte Achsen

Die jüngste Nutzervorgabe ersetzt Hochformat, automatische Montage beim Absetzen
und die gemeinsame Radform: Querformat, Bremse/Rückwärts links, Gas rechts,
Tempomat durch Aufwärtswischen; zwei mittige Zeichenfelder für hinten/vorne,
mehrere Striche und explizite Montage. Keine fertigen Radvorlagen in der
Oberfläche. Ein kostenloses importiertes Offroad-Modell ersetzt das generierte
Fahrzeug. Sprunglücken werden als geschlossene Gräben modelliert, freiliegende
Geländekanten seitlich unregelmäßig geformt. Details: [UPDATE-1.6.md](UPDATE-1.6.md).


## Version 1.7 – Einzelspieler und Expertenstrecken

- Keine eingeblendeten Lösungen für Hindernisse; Statusmeldungen links unter dem Spielnamen.
- Quadratische Felder ohne sichtbare Beschriftungen; Montage per Häkchen leert nur den Entwurf.
- Gerippte, sichtbar betätigte Pedale; Wisch-Tempomat bleibt erhalten, mit kleiner Kontrollanzeige.
- Eine einzelne Fahrspur mit Umgebung, längs und quer auslaufende Bauwerksflanken statt abgeschnittener Enden.
- Schlammkräfte hängen von benetzten Konturen und Materialgeschwindigkeit ab. Ein zähes Oberflächenmodell und braune Klumpen ergänzen die Physik.
- Bestehende Level- und Spielstand-IDs bleiben erhalten. Drei Expertenstrecken werden als IDs 13–15 ergänzt; das Testgelände bleibt ID 12 und steht am Ende der Auswahl.


## Überarbeitung 1.8

- Durchgänge vollständig geschlossen modellieren; keine Felsflächen für die Sicht entfernen. Verdeckt sichtbare Fahrzeugkonturen dienen nur der Orientierung.
- Eis als Teil zusammenhängender Winterlandschaften. Keine Eisstreifen in Canyon- und Steinbruchexpeditionen.
- Automatische Sammelkisten entfernen. Zwei nachvollziehbare Abschlussziele: ankommen und ohne Bergung ankommen.
- Alle 15 Expeditionen neu kombinieren, zwölf weitere Hindernistypen ergänzen und feste Allround-Konturen ausdrücklich als Gegenprobe testen.
- Hohes Motordrehmoment und geometrische Kontaktphysik erhalten; Schwierigkeit aus Platz, Auflage, Untergrund und Abfolge erzeugen. Keine Radnamen-Boni oder versteckten Formvorgaben.
