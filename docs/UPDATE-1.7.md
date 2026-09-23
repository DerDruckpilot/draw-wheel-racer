# FORMDRIVE 1.7 – Solo-Cockpit und Expertenexpeditionen

Die Zeichenfelder sind quadratisch, gleichmäßig um den Achsmittelpunkt skaliert und ohne sichtbare Beschriftung. Das Häkchen übernimmt ausschließlich seine Achse und leert danach den Entwurf. Ein neuer Strich beginnt eine neue Radform; das bereits montierte Rad bleibt unverändert. Abgesetzte Striche, Rückgängig und Leeren bleiben erhalten. Eine fehlgeschlagene oder abgebrochene Hintergrundvorbereitung löscht keinen Entwurf.

Gerippte Pedale mit Arm, Fußplatte, Schatten und Drehpunkt ersetzen die rechteckigen Schaltflächen. Halten drückt die Platte sichtbar herunter; Wischen nach oben hält den Tempomaten mit kleiner Kontrollanzeige. Semantische Buttons und deutsche ARIA-Beschreibungen bleiben für Tastatur und Bedienhilfen erhalten. Hindernis-Tipps sind entfernt. Statusmeldungen stehen unter dem Logo, einschließlich Checkpoints, Fundstücken und Fehlern.

## Landschaft

Die Fahrfläche reicht von −1,2 bis 3,2 in Querrichtung: ein 4,4 Einheiten breiter Korridor für die beiden Radspuren des Spielerfahrzeugs. Frühere Gegnerstreifen und Gegner-Felsblöcke werden für Expeditionen nicht erzeugt. Tor, Baumstämme und Markierungen passen zur schmalen Spur. Die Böschungen reichen weit genug unter Vordergrund und Hintergrund, damit der Himmel nicht durch offene Ränder sichtbar wird.

Brücke, Bogen und Höhle laufen bis 11–18 Einheiten seitlich aus und werden an die dortige Bodenhöhe angeschlossen. Zusätzliche Flanken entlang der Fahrtrichtung betten die Endflächen in Erde und Fels ein. Im eigentlichen Fahrkorridor bleibt die physische Dachkontur unverändert. Die Nahseite verschwindet nicht mehr als komplette Hälfte: Ein weiches lokales Sichtfenster zeigt bei Durchfahrt das Fahrzeug, während die übrige Felsmasse stehen bleibt.

## Schlamm

Normale Schlammbecken sind rund 0,6 Einheiten tief, die Lehmgruben rund 0,9. Der unregelmäßige Grund ist ein fester Kollisionskörper mit niedrigerer Reibung. Die tatsächlich eingetauchten Konturen erfahren normalisierten Druck, viskosen Widerstand, Scherung und eine geglättete Fließgrenze. Kräfte wirken der lokalen Materialbewegung entgegen und behalten das stabilisierte Impulsverfahren der Wasserkräfte. Es gibt keine Prüfung auf einen bestimmten Radnamen.

Im Vergleich auf gleich tiefem, ebenem Untergrund mit 80 % Gas nach zwölf Sekunden: großer Standardring auf trockenem Fels 50,5 Einheiten, derselbe Ring in Lehm 12,9, Schaufelkontur in Lehm 40,1, kleine Ringkontur 1,5. Der Unterschied entsteht aus dem Kontakt und der nassen Kontur. Die bestehenden Drehmomentgrenzen bleiben erhalten.

Der braune Shader bewegt sich langsamer als Wasser. Radkonturen erzeugen zäh auseinanderlaufende Oberflächenstrukturen, kurzlebige Spuren und schwere Spritzklumpen. Der Teilchenpool ist begrenzt und wird beim Streckenwechsel zurückgesetzt. Dies ist kein volumetrischer Bodensimulator; dauerhafte Rillen und seitliche Materialverdrängung werden nicht simuliert.

## Schwierigkeit

15 Expeditionen plus Testgelände. Die alten IDs bleiben unverändert. Neu sind:

- **Die Lehmklamm:** Blockhalde, tiefe Lehmgrube, Nadelöhr mit nachfolgender Kletterkante und versetzte Bruchstufen.
- **Am Eisbruch:** glatte Eisrinne mit Gegenanstieg, Nadelöhr, Schlucht und ungleichmäßige Treibholzfolge.
- **Kein leichter Weg:** sieben aufeinanderfolgende Gruppen aus den neuen Hindernissen und dem Flutpass.

Die sechs neuen Typen erhöhen die Gesamtzahl auf 31. Innerhalb einer Gruppe liegen keine Zwischenlager; Radwechsel und die Vorbereitung des nächsten Entwurfs werden wichtiger. Die Auswahl bleibt frei. Die automatische Referenzfahrt kann alle drei Expertenexpeditionen mit Formwechseln und ohne Bergung abschließen (45,3 / 67,0 / 104,0 Sekunden). Eine große gezackte Kontur scheitert am Nadelöhr; eine kompakte Kontur kommt hindurch. Diese Referenzstrategie wird nicht als Tipp im Spiel eingeblendet.

## Prüfung

52 automatisierte Tests einschließlich Schlamm-Dissipation, fehlender Kräfte außerhalb des Mediums, Formunterschieden, geschlossenen Geländenähten, bodenverbundenen Bauwerken und Expertenprofilen. Browserprüfungen kontrollieren leere Entwürfe nach Montage, quadratische Maße, Pedalbewegung, Tempomat, Meldungsposition, neue Streckenauswahl und Schlammteilchen. Bestehende Prüfungen für komplexe Zeichnungen, Updates, Offlinebetrieb und getrennte Achsen bleiben erhalten. Die Hardwareleistung auf einem echten iPhone wird durch Windows-WebKit und Chromium nicht abgedeckt.
