# Offene Entscheidungen vor dem Coding

Stand: 22. September 2026. Alle folgenden Produktentscheidungen sind noch offen. Die rechte Spalte ist eine Empfehlung, keine Zustimmung des Auftraggebers.

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

Die Engine-Auswahl bleibt bis zur Klärung von Fahrfreiheit und Physikanspruch vorläufig. Es wird kein Hosting angelegt und keine Softwarelizenz für das Gesamtprojekt ausgewählt, bevor der Verwendungszweck feststeht. Antworten und daraus folgende Entscheidungen werden hier nachgetragen.
