# FORMDRIVE 1.8 — Welt und Herausforderungen

## Durchgänge und Ziel

Die früheren Felsdurchgänge bestanden aus getrennten Hälften und darübergelegten Böschungsflächen. Eine Sichtfreistellung blendete außerdem Teile des Felsens aus. Das erzeugte offene Kanten und unplausible Anschnitte.

`structure-mesh.ts` erzeugt jetzt einen gemeinsamen geschlossenen Körper: Oberseite, Unterseite, beide Portalflächen und beide im Boden verankerten Füße teilen ihre Randpunkte. Die Geometrie läuft seitlich gerundet aus. Die äußere Dachform stimmt an den Radspuren mit der physischen Kontur überein. Ein Topologietest prüft jede Struktur aller Strecken auf endliche Koordinaten, positive Schalendicke, korrektes Volumen und genau zwei angrenzende Dreiecke je Kante.

Fels bleibt deckend. Nur wenn ein Strahl von der Kamera zur Fahrzeugmitte tatsächlich auf das Dach trifft, wird eine blasse Fahrzeugdarstellung hinter verdeckenden Flächen sichtbar. Es werden keine Felsflächen entfernt. Dreiachsige Texturprojektion vermeidet gedehnte UVs an Steilflächen. Brücken tragen gemauerte Ränder; Bögen und Höhlen besitzen gerundete, unregelmäßige Außenformen. Hintergrundfelsen sind korrekt zentriert und über ihre tatsächlichen Begrenzungen im Boden verankert.

Das Zielschild verwendet zwei korrekt ausgerichtete Vorderseiten. Beide erhalten eigene Geometrie, damit die Streckenverformung nicht zweimal auf denselben Puffer wirkt. Der offene Zeltkegel wurde durch geerdete Versorgungskisten und eine Laterne ersetzt.

## Winterwelten

Eis liegt in den regulären Expeditionen ausschließlich in den Gletscherwelten: den vier Winterstrecken und „Am Eisbruch“. Canyon und Steinbruch erhalten passende Stein-, Lehm- und Wasserabschnitte. Nur das frei wählbare Testgelände mischt weiterhin alle Untergründe.

Die Winterumgebung besitzt durchgehenden Schnee, schneebedeckte Felsen und weniger gesättigtes Eis. Die sehr geringe physische Eishaftung bleibt erhalten. Bedienelemente und Zeichenfelder erhalten vor Schnee mehr Kontrast.

## Aufgaben statt automatischer Kisten

Alle automatischen Sammelobjekte entfallen. Ein Stern gilt für das Erreichen des Lagers, ein zweiter für eine Fahrt ohne Bergung. Der HUD-Zähler zeigt Bergungen. Abgeschlossene Fahrten, frühere Ergebnisse und Einstellungen bleiben gespeichert. Das alte Sammlerfeld wird beim Lesen weiterhin akzeptiert, aber nicht mehr gewertet.

## Zwölf neue Hindernistypen

Felsspalt, hohe Felswand, Felsschleuse, Lehmausstieg, Gezeitenhöhle, gebrochener Holzsteg, Auswaschungen, Krater, Gletscherspalten, Gletscherbruch, Wechselstufen und Messergrat ergänzen die bisherigen 31 Typen.

Alle 15 Expeditionen wurden aus sechs bis neun Gruppen neu aufgebaut. Unterschiede entstehen durch Durchfahrtshöhe, Höhe und Abstand der Auflagen, Hohlräume unter den Achsen, bewegliche Bretter, Wasser, Eis und Lehm. Nach einer niedrigen Decke bleibt genug Platz, damit auch die Hinterachse den Fels vollständig verlassen kann, bevor größere Räder für die nächste Wand nötig werden. Zwischenlager sichern die Gruppen, nicht jede einzelne Kante. Die Übergangslängen variieren.

Das hohe Anfahrmoment bleibt unverändert. Keine Kontur bekommt einen Bonus wegen ihres Namens, ihrer Punktzahl oder der gerade befahrenen Zone. Die abweichenden Formen des Referenzfahrers sind nur gezeichnete Konturen im Prüfsystem; sie werden weder im Spiel angeboten noch als Lösung eingeblendet.

## Nachgewiesene Unterschiede

- Ein langer Felsspalt hält große Ringe, Zacken und offene Haken auf. Eine kleine Zeichnung passiert ihn.
- An der hohen Felswand scheitern kleine und normale Ringe. Gezeichnete Hebel schaffen den Aufstieg.
- Gegenprobe über alle 15 Expeditionen: Keine der 45 Fahrten mit unverändertem großem Ring, kleinem Ring oder offenen Haken erreichte das Ziel. Diese Prüfung läuft auch bei jeder Veröffentlichung.
- Der Referenzfahrer erreicht alle 15 Ziele mit Formwechseln, Gas, Bremse und gelegentlichem Rückwärtsrangieren. Die Fahrzeiten liegen bei 67–224 simulierten Sekunden. 14 Expeditionen gelangen ohne Bergung; „Die Lehmklamm“ benötigte eine reguläre Checkpoint-Bergung. Das Testgelände mit allen 43 Typen gelang ebenfalls ohne Bergung.

## Prüfung und Grenzen

57 Physik-, Geometrie- und Fortschrittstests sowie die historischen Streckenregressionen. Mobile Browserprüfungen decken getrennte Zeichnungen, Montage, lange Linien, Eingaben, Pause, Schatten-/Texturprogramme, sämtliche Durchgangsarten, Winterdarstellung, Schildausrichtung und den Ergebnisdialog ab. Offline-Neustart und PWA-Aktualisierung werden in Chromium geprüft.

Die Fahrt bleibt eine seitliche Starrkörpersimulation auf einer räumlich gebogenen Strecke. Die Silhouette im Tunnel ist eine Orientierungshilfe. Schnee ist eine Darstellung fester Oberflächen, kein verformbares Material. Die automatischen Fahrer beweisen konkrete Lösungswege und konkrete Gegenbeispiele, nicht die Unmöglichkeit jeder denkbaren Universalform. Die tatsächliche Bildrate auf einem iPhone wird durch Desktop-WebKit und Chromium nicht belegt.
