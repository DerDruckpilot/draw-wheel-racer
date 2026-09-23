# FORMDRIVE 1.10 — Neigung und Entscheidungen

## Bedienung

Die Steifigkeit jeder Achse hat einen eigenen senkrechten Regler direkt außerhalb ihres Zeichenfelds. Oben ist die Kontur starr, unten maximal nachgiebig. Beide quadratischen Zeichenflächen bleiben vollständig für den Stift verfügbar.

Über das Achssymbol oben rechts lässt sich die Neigungssteuerung aktivieren. Auf Geräten mit einer Sensorfreigabe wird diese erst durch den bewussten Tastendruck angefragt. Das Spiel verarbeitet die Daten lokal. Eine bequeme Halteposition wird als Neutralstellung übernommen; sie kann jederzeit erneut kalibriert werden. Rechts/links kippen verlagert das Gewicht, vor/zurück kippen lenkt seitlich. Beide Querformatausrichtungen werden berücksichtigt. Eine Totzone und zeitabhängige Glättung unterdrücken Handzittern. Bei Pause, Fokusverlust, fehlenden Sensordaten und geänderter Bildschirmausrichtung wird die Eingabe neutralisiert beziehungsweise neu zentriert.

Ohne Sensorfreigabe bleiben Pedale, Zeichnen und die manuellen Regler verfügbar. W/S beziehungsweise Pfeil hoch/runter lenken; Q/E verlagern Gewicht. Die bisherigen Gas- und Bremsentasten bleiben erhalten. Der manuelle Lenkregler federt beim Loslassen auf neutral zurück.

Die Freigabe und Koordinatentransformation orientieren sich an der [W3C-Spezifikation für Device Orientation and Motion](https://w3c.github.io/deviceorientation/). Der Bildschirmwinkel ist gegen den Uhrzeigersinn definiert, auch beim älteren [Apple-Orientierungswert](https://developer.apple.com/documentation/webkitjs/domwindow/1632568-orientation). Die abgesenkte rechte Bildschirmkante verschiebt das Gewicht nach vorne, die linke nach hinten. Die emulierten Browserprüfungen ersetzen keinen Test der Sensoren und des Bediengefühls auf einem tatsächlichen iPhone.

## Spürbare Rad- und Gewichtsänderungen

Die maximale lastabhängige Stauchung steigt auf 62 Prozent. Eine leichte Ausdehnung quer zur Kontaktlast verbreitert die Auflage. Sichtbare Kontur, Kollisionskapseln und verdrängte Wasserflächen verwenden dieselbe Verformung. Die Masse bleibt konstant; die Änderung erfolgt gedämpft. Im stationären Rundradvergleich sinkt die Chassishöhe von etwa 1,08 auf 0,57 Spieleinheiten. Weiche Räder können sich anschmiegen, verlieren jedoch Höhe und wirksame Hebellänge. Starre Formen behalten ihre Reichweite.

Die Schwerpunktverlagerung des Hauptkörpers steigt von ±0,48 auf ±1,30 Einheiten und reagiert schneller. Das verändert die Last auf den Achsen deutlich, ohne Zusatzmasse oder eine unsichtbare Aufrichtkraft. Der Schwerpunkt bleibt auch bei maximalem Ausschlag ein Teil des vorhandenen Massemodells.

## Seitliche Wege und wählbare Wasserstände

Einzelne Felsblöcke und lose Steine belegen jetzt unterschiedliche Seiten der Fahrbahn. Der Spieler kann ihnen während der Fahrt ausweichen. Seitliche Eingabe beeinflusst Geschwindigkeit und Lage; Eis bietet wesentlich weniger seitliche Haftung. In engen Bauwerken verengt sich der Fahrkorridor allmählich. Räder, Fahrzeug, Ladung, Kielwasser und Partikel folgen der seitlichen Position.

Schleusenplatten liegen am Rand und reagieren erst, wenn eine Radspur sie tatsächlich überfährt. Die mittlere Linie löst keine der beiden Platten aus. Gegenüberliegende Platten wählen Füllen oder Ablassen, auch nach einer vorherigen Entscheidung. Der Pegel beeinflusst weiterhin Auftrieb, Widerstand und verfügbare Bodenhaftung. Schleusentore stehen seitlich am Becken. Das Gegengewichtstor bietet die Wahl zwischen dem betätigten Tor und einer steinigen Durchfahrt daneben. Damit gibt es örtliche Alternativen und bewusst anfahrbare Bedienelemente; kein automatisches Auslösen über den Streckenfortschritt.

## Physikgrenzen

Die Radkontakte und Höhenbewegung verwenden weiterhin Rapier 2D. Eine begrenzte zusätzliche Querbewegung steuert seitliche Kontakte mit Felsen und Mechanismen. Vor dem Einschalten eines seitlichen Kontakts wird das Eindringen von der Seite geprüft. Nicht berührte bewegliche Steine behalten ihre Kollision mit dem Boden. Dieses Modell erlaubt kleine Ausweichmanöver und örtliche Wegentscheidungen. Es ist keine frei befahrbare 3D-Fahrzeugphysik mit vier unabhängig belasteten Rädern, seitlichem Überschlag oder einem frei verzweigten Straßennetz.

Radnachgiebigkeit bleibt eine gedämpfte Konturverformung, keine FEM-Gummisimulation. Das Aufweiten beim Weichstellen und die Schwerpunktverlagerung sind begrenzte Näherungen für das mobile Spiel. Bestehende Grenzen des Wasser-, Materialbruch- und Lehmmodells bleiben bestehen.

## Prüfung

Neue Regressionen prüfen die zwei Querformatausrichtungen, Kalibrierung und Totzone, deutlichen Höhenverlust weicher Räder bei unveränderter Masse, den größeren Schwerpunktweg, bewusst gewählte oder ausgelassene Schleusenschalter, umkehrbare Wasserentscheidungen, tatsächliches Umfahren von Felsen und das Fortbestehen der Bodenauflage unberührter loser Steine. Mobile Browserprüfungen decken die senkrechten Regler, Sensorfreigabe und Ablehnung, Glättung, Kalibrierung, Pause, ausbleibende Sensordaten und Touchersatz ab.

Die vollständigen Streckentests verwenden weiterhin normale Steuerung und selbst gezeichnete Referenzformen. Der Prüffahrer lenkt nun zusätzlich gezielt zu den seitlichen Bedienelementen. Es wird nicht seitlich oder nach vorne teleportiert. Alte Fortschrittsdaten bleiben kompatibel.
