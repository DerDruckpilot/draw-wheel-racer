# Prüfung von FORMDRIVE 2.0

Stand: 24. September 2026. Geprüft wurde der Produktionsbuild auf diesem Entwicklungsrechner, mit Chromium und WebKit im Querformat. Das ist kein Test auf einem echten iPhone.

## Reproduzierbare Prüfungen

| Prüfung | Ergebnis |
|---|---|
| `npm test` | 40 bestanden, keine fehlgeschlagenen oder übersprungenen Tests |
| `npm run build` | TypeScript und Produktionsbuild erfolgreich |
| `npm run test:browser` | 10 bestanden, 4 bewusst plattformabhängig übersprungen |
| Offlinecache | 128 Einträge, rund 80 MB einschließlich Modelle, Texturen und Physik |

Die Browserprüfungen decken beide Zeichenfelder, mehrere Striche, explizite Montage mit anschließend leerem Entwurf, Pedale, Tempomat, Bremsen, Bildschirmdrehung, Fortschritt, Zielfreigabe und Speicherung ab. Sensorberechtigung und Kalibrierung werden in WebKit simuliert; diese beiden Fälle sind in Chromium ausgelassen. Offline-Kaltstart und Service-Worker-Update laufen in Chromium; diese beiden Fälle sind in WebKit ausgelassen.

## Physisch geprüfte Rätsel

- Fahrzeuge schieben bereitgestellte Kisten tatsächlich auf Druckplatten. Last muss erhalten bleiben; zwei Platten müssen bei entsprechenden Toren gleichzeitig belegt sein. Schließende Tore halten vor dem Fahrzeug an.
- Alle vier Schleusenbecken verhindern den Zugriff auf die versunkene Energiezelle im gefüllten Zustand. Nach bewusst betätigtem Ventil und abgestelltem Gewicht sind die Zellen erreichbar. Der anschließende Ausstieg über die Kiesrampe wird mit dem Fahrzeug gefahren.
- Alle drei Lastenaufzüge transportieren das Fahrzeug zur erforderlichen Versorgungskiste.
- In allen drei Gegengewichtsgebieten schiebt das Fahrzeug die bereitgestellte Last auf die Wippe, stellt sie dort ab und erreicht danach die erhöhte Insel. Der entsprechende Versuch ohne Last scheitert.
- Kleine Radformen passen durch niedrige Felsgewölbe; große runde Formen bleiben davor hängen. Dünne Strichräder können das Fahrzeug anheben und antreiben. Paddelräder erzeugen Vortrieb in Wasser, ohne das Fahrzeug im geprüften Wellengang umzuwerfen.
- Spielstände stellen auch belastete, geneigte Wippen wieder her. Beschädigte oder unbekannte Daten können keine Generatoren, Checkpoints oder Gegenstände freischalten.

## Zusätzliche lokale Kontrolle

Alle 21 Karten wurden auf Platzierung und Erreichbarkeit von Zielen, Lagern, Anlagen und ebenerdig erreichbaren Fundstücken untersucht. Die Rasterprüfung berücksichtigt feste Geometrie und Steigung, setzt Tore für die Prüfung ihrer geöffneten Zufahrt voraus und ersetzt keine vollständige Durchfahrt. Hohe beziehungsweise versunkene Rätselziele werden in den eigenen Fahrtests geprüft.

Eine steile Zufahrt im letzten Gebiet fiel im konservativen Raster zunächst durch. Ein anschließender physischer Versuch durch das geöffnete Tor erreichte die Zelle mit einem gezackten Profil; runde und kleine runde Räder scheiterten am selben Ansatz. Die Schwierigkeit wurde daher erhalten.

Neun Produktionsansichten wurden auf Ladefehler, fehlende Flächen und Materialdarstellung geprüft: Wald, Felsbogen, Höhle, Wasserbecken, Gletscherbecken, Matsch, Eislandschaft, Ziellager und Wippe. Dabei traten keine JavaScript-, Konsolen- oder HTTP-Fehler auf. Die letzte Bildkorrektur betrifft ausschließlich die sichtbare Holzauflage der Wippe. Wiederholte Gebietswechsel zeigten keine fortlaufende Zunahme der Geometrie- und Texturanzahl.

## Grenzen

Nicht gemessen sind Bildrate, Akkulast und Sensorverhalten auf dem iPhone 16 Pro Max mit iOS 27. Automatische Grafikreduktion und ein sparsamer Grafikmodus sind vorhanden. Nicht jedes Gebiet wurde von einem Menschen vom Start bis zum Ziel durchgespielt; die tatsächliche Spieldauer und die subjektive Schwierigkeit müssen beim Spielen beurteilt werden. Die Tests belegen die genannten Fälle, keine allgemeine Fehlerfreiheit.
