# FORMDRIVE 1.5 – Expeditionen

Die Spielaufgabe ist das Erreichen des Ziellagers. Zwölf neu zusammengestellte
Solo-Strecken ersetzen das Rennen gegen drei Gegner. Zeit wird nur nach der Fahrt
als Information angezeigt; sie entscheidet über keinen Stern.

## Fahren und Zeichnen

- GAS halten: normaler Antrieb. Den Finger hochziehen gibt mehr Gas, herunterziehen
  senkt die gewünschte Drehzahl. Das maximale Anfahrmoment bleibt auch beim
  langsamen Klettern verfügbar: 420 Einheiten auf Land, 96 im Wasser.
- BREMSE: Gegenmomente an beiden Achsen. Eis behält seine geringe Haftung.
- ZURÜCK: Rückwärtsgang, auch zum Befreien und erneuten Anfahren.
- AUTO: hält 65 % der gewünschten Drehzahl beim einhändigen Zeichnen. Jedes
  manuelle Pedal beendet den Tempomaten. Zwei unabhängige Pointer erlauben zugleich
  Fahren und Zeichnen.
- Tastatur: D/→, A/←, Leertaste, Esc. Pause, Seitenwechsel, Fokusverlust und
  abgebrochene Gesten dürfen kein gehaltenes Pedal zurücklassen.

Die bisherige Geometrie-, Kontakt- und Wasserphysik bleibt bestehen. Es gibt keine
zusätzliche Vorwärtskraft, keinen Formbonus und kein künstliches Festkleben beim
Bremsen. Die Bremse überträgt ein begrenztes Drehmoment zwischen Rad und Chassis.

## Strecken und Abschluss

Vier zusätzliche, zusammenhängende Hindernistypen ergänzen die bisherigen 21:

1. Felsgrat: neun unregelmäßige Anstiegsrippen, ein hoher Scheitel und eine längere
   Abfahrt mit wechselnder Neigung.
2. Erhöhter Felsgang: drei Stufen zum Absatz, niedrige Decke über leicht unebenem
   Boden, anschließend Abstieg. Eine große Rundform passt nicht durch das Dach.
3. Flutpassage: tiefes Schwimmbecken mit direktem Übergang zu vier unterschiedlich
   hohen und breiten Inseln. Paddeln und Klettern folgen ohne trockene Zwischenzone.
4. Schlucht: gerippter Aufstieg, Abfahrt, Sprunglücke und Gegenanstieg in einem Zug.

Jede Kombination hat einen Checkpoint an ihrem Eingang. Sichere Zwischenstücke
zwischen den Gruppen bleiben erhalten. Neustarts verwenden dieselbe Geometrie.
Das Testgelände enthält alle 25 Typen und bietet weiterhin Zeitlupe.

Pro Expedition gibt es drei optionale orange Fundstücke. Eine höhere Position
belohnt zusätzliche Reichweite der selbst gezeichneten Kontur oder einen Sprung.
Die Berührung durch Fahrzeug oder Rad sammelt die Kiste ein. Bergen behält die
Fundstücke innerhalb dieser Fahrt; ein Neustart beginnt neu.

Die drei unabhängigen Erfolge sind **Ziellager erreicht**, **ohne Bergung
angekommen** und **alle Fundstücke gesammelt**. Erreichte Sterne bleiben über
mehrere abgeschlossene Fahrten erhalten. Bestzeiten sind keine Wertungsbedingung.
Alle Expeditionen stehen zum Ausprobieren offen.

## Organische Durchfahrten und Kurven

Die frühere Platte wird durch drei Varianten ersetzt: eine kurze Steinbrücke mit
Brüstungen und Widerlagern, einen schmaleren natürlichen Felsbogen und eine längere
Höhle mit unregelmäßigem Felsmassiv. Scans echter Felsen ergänzen Portale und in den
Boden eingelassene Schultern. Der vordere Bereich wird bei Annäherung durchsichtig;
der hintere Teil und die Verankerung bleiben sichtbar. Der physische Dachkörper
besitzt das erhöhte obere Profil des jeweiligen Bauwerks. Die Durchfahrtshöhe
bleibt eindeutig und mit kompakten Formen befahrbar.

Die Expeditionen verlaufen auf sanften räumlichen Kurven. Eine gemeinsame
Bogenlängenabbildung hält Boden, Ufer, Hindernisse, Räder, Fahrzeug und Spritzer
zusammen. Wasser verwendet weiterhin die ursprünglichen Streckenkoordinaten für
Tiefenfarbe und Kielwasser, sodass die Ufer auch in Kurven stimmen. Die Kamera
folgt dem Verlauf und hält das Fahrzeug auch mit großen Rädern im Bild. Nach einer Bergung wird die Kamera direkt zum neuen Standort gesetzt. Das Fahrzeug folgt weiter einer
festen Spur; zusätzliche seitliche Fahrdynamik wird nicht simuliert.

## Darstellung und Spielstand

Der Hintergrund füllt weiter den Bildschirm. Das transparente Zeichenfeld bleibt
sichtbar, darunter liegen die vier kompakten Fahrtasten. Wegfortschritt, Fundstücke
und aktuelles Lager ersetzen Platzierung und Rennuhr. Checkpointfahnen, Sammelkisten
und ein Zelt am Ziellager kennzeichnen die Expedition. Dächer werden in der Nähe
des Fahrzeugs transparent, damit die Kontaktsituation sichtbar bleibt.

Einstellungen, Lieblingsform und historische Rennergebnisse bleiben unter dem
bestehenden Speicherschlüssel erhalten. Die Expeditionen bekommen eigene
Abschlussdaten; alte Rennsterne werden nicht als Expeditionsleistungen ausgegeben.
Die bisherige Rennsimulation bleibt als technische Regressionstest-Basis erhalten.

## Prüfung

- Die 34 bisherigen Physik-/Geometrietests bleiben erhalten. Acht neue Tests
  prüfen Neutral, Gasdosierung, Rückwärtsfahrt, Bremsen auf Eis, Fundstücke und
  Bergung, Fortschrittsspeicherung sowie die neue Geometrie.
- Im Bremsvergleich bei gleicher Startgeschwindigkeit: 2,31 m auf Stein und
  10,39 m auf Eis nach drei simulierten Sekunden.
- Alle zwölf Expeditionen plus Testgelände erreichen im vollständigen Fahrtest
  ohne Bergung das Ziel. Der Test wechselt Formen und reduziert das Gas am
  Felsgrat. Die Teststrategie ist kein Autopilot im Spiel.
- Im Felsgang bleibt die große Rundform vor der Decke stehen; die kompakte Form
  durchquert sie. Das optionale Sammeln aller Kisten ist nicht Voraussetzung des
  automatisierten Abschlusstests.
- Browserprüfungen ergänzen Gasdosierung per Pointer, Pointer-Abbruch, Bremse,
  Rückwärtsgang, Tempomat, gleichzeitiges Zeichnen und Tastaturantrieb,
  Freigabe bei Pause, alte Spielstände und erreichbare Pedale in Hoch-/Querformat.
- Produktionsbuild, bestehende Browserabläufe, komplexes Zeichnen, PWA-Offlinecache
  und bewusst ausgelöstes Update gehören weiter zu den Veröffentlichungstests.

Die Browserprüfungen verwenden Desktop-Chromium und Windows-WebKit mit emulierten
Mobilgrößen. Sie ersetzen keinen Test auf dem tatsächlichen iPhone. Wasserströmung,
verformbarer Boden, frei schwimmende Plattformen und Fahrzeugsprünge mit separater
Luftsteuerung sind in diesem Update nicht neu implementiert.
