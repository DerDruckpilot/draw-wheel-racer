# Prüfung von FORMDRIVE 2.2

Stand: 24. September 2026. Entwicklungsrechner mit Chromium und WebKit; kein angeschlossenes iPhone.

## Fahrverhalten

Die neuen Fahrtests bewegen das Fahrzeug vorwärts und rückwärts, jeweils mit Links- und Rechtslenkung. Der Kurvenradius liegt beim langsamen Fahren mit Radgröße 0,55 unter 5,3 Spieleinheiten. Eine gesonderte Vergleichsfahrt mit Größe 1 und Gas 0,3 ergab rund 4,48 statt zuvor 7,68 Einheiten. Gemessen wird die gefahrene Strecke geteilt durch die aufsummierte Richtungsänderung; bei schneller Fahrt bleiben Reifenschlupf und ein größerer Radius möglich.

Die Räder besitzen eine tatsächliche Achsbreite von 0,42 statt 0,19 Einheiten. Der Geometrietest prüft die Breite, die unveränderte Strichdicke in der Zeichenebene sowie geschlossene Kollisionskörper ohne fehlende Stirnflächen. Die bestehenden Prüfungen für Radgrößen, Nachzeichnen, Wasserverdrängung und dünne Stabformen bleiben relevant.

Eine Fahrt durch mäßige Querrinnen prüft Fortbewegung ohne Bergung und ohne unmittelbares seitliches Umkippen. Eine anschließend stark überkippte Fahrzeuglage bleibt auf der Seite beziehungsweise dem Dach: Es gibt keine automatische Aufrichtung. Schwerpunkt und Rollträgheit ändern das Fahrverhalten; das Spiel ist keine vollständige Reifensimulation.

## Kamera

Ein reproduzierbarer Test über 300 Bilder überlagert kurze Höhenstöße und wechselnde Lenkwinkel bei Kriechgeschwindigkeit. Die Kamera reduziert diese Ausschläge deutlich und behält ihre Blickrichtung bei kleinen Korrekturen. Ein weiterer Test prüft langsames Ausfahren nach einer Verdeckung und unmittelbares Reagieren auf bewusstes manuelles Drehen.

Zusätzlich wurden kompakte Räder am Eingang und unter dem Felsbogen in Gebiet 1 sowie unter dem Bogen in Gebiet 12 im Produktionsbuild visuell geprüft. Die Kamera bleibt außerhalb der Felsflächen und zeigt das Fahrzeug aus einer flacheren Perspektive; dabei wurden keine Konsolenfehler erfasst.

Die früheren seitlichen Ausweichversuche pro Bild wurden entfernt. Hindernisse begrenzen weiterhin den Kameraarm, weshalb bei engem Kontakt eine notwendige Verkürzung sichtbar sein kann.

## Umgebung

Drei zusätzliche mobile Modellvarianten ergänzen die vorhandenen Assets: dichteres Gras, blühende Gazanien und eine vereinfachte Variante des Rooibos-Busches. Quellen, Autoren und Prüfsummen stehen im Assetmanifest. Kleine Pflanzen und Kies werden in acht Einheiten großen Kacheln aufgebaut, deterministisch wiederhergestellt und nach Entfernung begrenzt. Druckplatten und Wasserflächen bleiben frei. Es entstehen keine zusätzlichen unsichtbaren Kollisionskörper.

Sichtprüfung des Produktionsbuilds: Druckplattenumgebung, Canyon, Wald und Gletscher. In diesen vier Ansichten wurden keine JavaScript-, Konsolen- oder HTTP-Fehler protokolliert. Im detailreichen Modus enthielten die geprüften Canyonansichten etwa 8.100 kleine Instanzen, die Waldansicht etwa 7.100 und der Gletscher etwa 2.100. Mehrere Meshteile pro Pflanze und Schatten kommen zu deren Geometrieaufwand hinzu.

Die anfänglichen Chromium-Durchläufe überschritten das Zeitlimit. Ein Ablaufprofil zeigte rund 2,5 Sekunden je Bild in der Softwaregrafik. Daraufhin wurde die Anzahl entfernter Kleinteile im sparsamen Modus und in den reduzierten Stufen der automatischen Qualität begrenzt. Die volle Dichte bleibt in „Detailreich“ verfügbar; direkt nahe Details werden erhalten. Der anschließende vollständige Browserlauf ist erfolgreich.

## Abschließende Prüfläufe

Die 51 Physik-, Kamera-, Layout- und Speicherprüfungen sind bestanden: 49 im vollständigen Lauf, der letzte Brückenfall nach Anpassung des Fahrprotokolls und ein zusätzlicher Geometriefall im gezielten Nachtest. Auf den unterschiedlichen Anfahrten werden Gas und Gewichtsverlagerung angepasst; die Kiste wird weiterhin ausschließlich durch Fahrzeugkontakt verschoben. Die Prüfung verlangt echten Kontakt mit dem schwingenden Deck und die anschließende erfolgreiche Überfahrt. Die jeweils unbeladenen Gegenversuche scheitern weiterhin. Alle vier ablassbaren Becken lassen sich mit griffigen Konturen und dosiertem Gas verlassen.

Der zusätzliche Geometriefall reproduziert einen gefundenen Fehler beim Wechsel von 28 getrennten Strichen zu einem geschlossenen Ring. Beide Formen können dieselbe Anzahl an Grafikpunkten besitzen, benötigen aber unterschiedliche Dreiecksverbindungen. Wiederverwendete Radpuffer prüfen nun beide Größen; der Test vergleicht das Ergebnis mit einer frisch erzeugten Geometrie.

TypeScript, Vite und die PWA-Erzeugung sind erfolgreich. Der Offlinecache umfasst 138 Einträge mit ungefähr 84.507 KiB einschließlich Assets, Physik und Lizenznachweisen.

Browserlauf: **15 bestanden, 5 gezielt übersprungen**, Gesamtdauer 20 Minuten. Die fünf Ausnahmen sind ausschließlich Plattformzuordnungen: Service-Worker- und native Mehrfingerprüfungen laufen in Chromium, Sensorberechtigungen in WebKit. Zeichnen, Radgrößen, freie Kamera, Pedale, Speichern, Levelabschluss, Offline-Neustart und ein bestätigtes Update mit erhaltenem Fortschritt wurden geprüft.

## Grenzen

Die Tests simulieren Bildschirmgröße und Sensorereignisse. WebKit auf dem Rechner ersetzt keine Messung von Bildrate, Wärmeentwicklung oder Akkulast auf einem iPhone 16 Pro Max. Nicht jedes Gebiet wurde erneut von einem Menschen vollständig durchgespielt. Die Tests prüfen konkrete Fälle und belegen keine allgemeine Fehlerfreiheit. Die dichtere Umgebung orientiert sich an der Bildvorlage; sie ist keine grafisch identische Nachbildung.
