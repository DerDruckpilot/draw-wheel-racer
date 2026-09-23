# FORMDRIVE 1.6 – zwei Achsen im Querformat

## Bedienung

Die PWA fordert Querformat im Manifest an. Wenn Safari keine Ausrichtungssperre
unterstützt, zeigt Hochformat eine Drehaufforderung; es gibt keine künstlich
gedrehte Zeichenfläche. Eine Drehung während der Fahrt pausiert das Spiel.

Rechts halten gibt Gas. Eine Wischbewegung von mindestens 42 CSS-Pixeln nach oben
rastet den Tempomaten ein. Antippen des Gases, Bremsen, Pause, Fokusverlust oder
Abbruch des gehaltenen Pointers gibt die Steuerung frei. Das linke Pedal bremst
zunächst; nach mindestens 350 ms und unter 0,28 Einheiten Vorwärtsgeschwindigkeit
wechselt es in Rückwärtsfahrt. Tastatur: D/→ Gas, A/← zurück, Leertaste Bremse.

Zwei mittige Felder zeichnen Hinter- und Vorderräder. Absetzen fügt einen neuen
Strich hinzu. Das Ende eines Strichs wird niemals mit dem Anfang des nächsten
verbunden. Erst der Montageknopf übernimmt den Entwurf auf seine Achse. Rückgängig
entfernt einen Strich, Leeren nur den Entwurf; beide verändern montierte Räder
nicht. Vor dem ersten Start müssen beide Achsen selbst gezeichnet werden. Eine
Schnellauswahl fertiger Formen und der Favoritenknopf entfallen vollständig.

## Physik und Formen

Jede Achse besitzt eigene Konturen, Kollisionskörper, Masse, Trägheit,
Hydrodynamik, Revisionsnummer und Motorlastregelung. Der Montagevorgang der
Vorderachse baut die Hinterachse nicht neu auf. Lose Striche bekommen sichtbare,
physisch vorhandene dünne Speichen zur Nabe. Flächenvereinigung entfernt doppelt
überzeichnetes Material. Bis zu 512 Punkte gelten pro Radentwurf; längere Eingaben
werden adaptiv vereinfacht. Wasserverdrängung und Spritzer nutzen die jeweilige
Achskontur. Gegenüberliegende sichtbare Räder teilen GPU-Geometrie.

Das maximale Achsmoment an Land steigt von 420 auf 1.200 normalisierte Einheiten.
Die feste Abschaltung wegen eines steilen Fahrzeugwinkels entfällt auf Land.
Gegenmomente auf das Chassis bleiben erhalten. Schwerpunkt und Trägheit des
Geländetrucks sind auf einen niedrigen, leicht vorn liegenden Motor/Rahmen
abgestimmt. Die Wasserkennlinie bleibt auf 96 begrenzt. Grip, Hebelarm und Balance
bestimmen weiterhin, ob eine Form ein Hindernis bewältigt; viel Gas kann das
Fahrzeug aufbäumen und umwerfen. Es gibt keinen garantierten Vorwärtsschub.

## Modell und Welt

`public/assets/offroad.glb` basiert auf **GroundVehicle** aus CesiumJS,
Copyright 2018 Analytical Graphics, Inc., Apache-2.0. Quelle, Lizenz und
Prüfsummen liegen neben dem Asset bzw. unter `public/licenses/cesium-vehicle.txt`.
Die Spielvariante entfernt die Originalräder, passt die Proportionen an die beiden
gezeichneten Achsen an und komprimiert die PBR-Texturen auf höchstens 1K.
`scripts/prepare-vehicle.mjs` lädt die dokumentierte, festgeschriebene Revision
und reproduziert die mobile GLB-Datei (ca. 1,9 MB). Sie ist im Offlinecache.

Sprunglücken der Expeditionen bestehen jetzt aus Abbruchkante, schrägen
Grabenwänden und Felsboden rund vier Einheiten tiefer. Sichtbare Flächen und
Kollisionsprofil werden zusammen erzeugt; es gibt dort keine Öffnung zum Himmel.
Seitliche Verformung macht die freiliegenden Felskanten schräg, gebogen und
unregelmäßig. Fahrbahn und Ufer verwenden dieselbe Abbildung, damit ihre Nähte
geschlossen bleiben. Die markierten Radkontaktspuren behalten das physische
Profil; seitlich unterschiedliche Einzelradkontakte werden weiterhin nicht
simuliert. Übergänge zwischen festem Boden und Anfahrstück verwenden dieselbe
Materialfarbe. Die Kurven, Brücken, Felsbögen und Höhlen bleiben erhalten.

## Prüfung

Zusätzliche Tests prüfen getrennte Striche ohne Gummiverbindung, unabhängige
Achsmontage und Wassergeometrie, mehr als 1.100 Einheiten Drehmoment am blockierten
Antrieb bei steiler Fahrzeuglage, geschlossene Gräben und verzerrte Geländekanten.
Browserprüfungen decken explizite Montage, zwei Entwürfe, Rückgängig, Löschen,
Tempomat-Wischen, Bremsen/Rückwärtsfahrt, gleichzeitiges Fahren/Zeichnen,
Pointer-Abbruch, Drehaufforderung, drei Querformatgrößen, Modellcache, komplexe
Offlinezeichnungen und Updates mit erhaltenem Spielstand ab.

Die Tests verwenden Windows-WebKit und Chromium. Leistung und Installation auf
einem realen iPhone 16 Pro Max mit iOS 27 sind nicht hardwareseitig geprüft.
