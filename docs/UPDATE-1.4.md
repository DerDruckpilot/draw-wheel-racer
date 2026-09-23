# FORMDRIVE 1.4.0

## Ansicht und Wasser

Die Werbereferenzen bestimmen die Bildaufteilung: schräge Verfolgerkamera, große sichtbare Spielwelt, schwebendes transparentes Zeichenfeld mit heller Umrandung und schwarzer Kontur. Die bisherige deckende untere Fläche und die große Zeichenüberschrift entfallen. Die Formvorlagen sind als kompakte Symbolleiste weiter direkt verfügbar. Sichere Bildschirmränder werden berücksichtigt.

Türkisfarbenes Wasser besitzt eine tiefenabhängige Färbung, gefilterte Reflexionen des vorhandenen HDR-Himmels, gebrochene Lichtreflexe, Uferschaum und Schaumspuren hinter den Fahrzeugen. Ein Pool aus maximal 1.100 Partikeln erzeugt Tropfen, Gischt und auslaufenden Schaum. Emissionen erfolgen pro verstrichener Zeit. Ihr Ursprung und ihre Stärke werden aus tatsächlich benetzten Abschnitten der vereinigten Radkontur nahe der Wasseroberfläche berechnet. Rotation und Translation gehen in die lokale Normalgeschwindigkeit ein. Ein quer zur Bewegung stehender Abschnitt spritzt stärker als eine tangential vorbeilaufende Ringkontur. Mehrfaches Nachzeichnen derselben Linie verstärkt den Effekt nicht.

Wellen, Reflexionen und Partikel sind grafische Näherungen, keine räumliche Flüssigkeitssimulation. Die bestehenden Kräfte für Wasserverdrängung, Auftrieb und Druck bleiben erhalten. Die Grafikeffekte üben keinen zusätzlichen Vorwärtsschub aus. Alle Ressourcen bleiben offline verfügbar; es werden keine neuen fremden Assets oder Spielmodelle übernommen.

## Antrieb und Gelände

- Maximal 420 statt 160 normalisierte Drehmomenteinheiten pro Achse, also das 2,625-Fache. Im Schwimmen bleibt die schon abgestimmte sanftere Grenze von 96 erhalten.
- Unabhängige Achsregler mit begrenztem Lastintegrator. Bei Freigabe einer blockierten Achse wird gespeicherte Anforderung entladen. Gegenmomente wirken weiterhin auf das Chassis.
- Langsamere Übersetzung für Formen mit großem Höhenhub, berechnet aus der Kontur statt ihrem Vorlagennamen. Ein Strich kann als Zweifachpaddel bzw. Laufstange arbeiten.
- Der Kippschutz wartet bei solchen Formen lange genug auf das Absenken des Vorderwagens. Die bisherige Regelung konnte ihn auf dem Hinterrad halten.
- Beim Vergrößern wird die erforderliche Lagekorrektur vollständig ausgeführt. Die bisherige Begrenzung konnte die neue Kontur teilweise in einer Felskante belassen. Deckenprüfung und Begrenzung zusätzlicher Rotationsenergie bleiben erhalten.
- Reproduzierbar unterschiedliche Kantenhöhen, Stufenabstände, Rillen, Mulden und versunkene Inseln. Felsblöcke variieren pro Spur und besitzen zur sichtbaren Form passende konvexe Kollisionskörper.
- Der Mittelstreifen setzt sich auch hinter dem Start und über das Ziel hinaus fort, einschließlich Kollisionsboden. So entsteht in breiten Ansichten keine offene Kante zwischen den verlängerten Landschaftsflächen.
- Gegner behalten beim Verlassen von Furten und Seen die Paddelform bis zum Ufer.

## Messwerte

Fester Simulationsschritt: 1/120 Sekunde. Einheiten und Fahrzeugmassen sind Spielgrößen, keine kalibrierte Fahrzeugmessung.

| Prüfung | Ergebnis |
| --- | --- |
| Strich von −1,1 bis +1,1; Startwinkel 0 / 0,4 / 0,8 / 1,2 rad; jeweils 12 s auf ebenem Boden | 12,72 / 14,10 / 11,22 / 10,14 Einheiten Vortrieb, keine Bergung |
| Wiederholter Höhenhub beim selben Strichtest | 1,37–1,58 Einheiten; maximale Neigung 1,115 rad |
| Belastete Hinterachse, frei drehendes Vorderrad, zwölf Anfahrkonfigurationen | Alle Stufen überwunden; gemessenes hinteres Spitzenmoment 338,82 |
| Spritzaktivität bei gleicher Rotation, gemittelt über 48 Radwinkel | Ring 0,092; Paddel 10,285; gerader Strich 0,797 |
| Paddel mit 2 statt 5 rad/s im selben Spritztest | Aktivität 0,658 statt 10,285 |
| Tiefer-Wasser-Vergleich | Großes Rundrad ca. 0,76; Paddel ca. 3,00 Einheiten/s |
| Zwölf Strecken und Testgelände mit Formwechselstrategie | 13 von 13 Zielankünfte ohne Bergung |
| Zwölf Rennen mit vier Fahrzeugen | 48 von 48 Zielankünfte ohne Bergung |

34 automatisierte Physik-, Kontur- und Geometrietests. Browserprüfungen decken Zeichnen, lange Konturen im Worker, Favoriten, Pause, Spritzer, Mobilansicht, Ergebnisdialog, Offline-Neustart und bestätigtes PWA-Update ab. WebKit und Chromium sind Desktop-Testbrowser; Installation und Leistung auf dem tatsächlichen iPhone 16 Pro Max mit iOS 27 sind damit nicht nachgewiesen.
