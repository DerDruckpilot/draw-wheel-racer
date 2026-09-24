# Prüfung von FORMDRIVE 2.1

Stand: 24. September 2026. Geprüft wurde der Produktionsbuild in Chromium und WebKit im Querformat auf dem Entwicklungsrechner. Ein echtes iPhone ist nicht angeschlossen.

## Automatisierte Prüfungen

| Prüfung | Ergebnis |
|---|---|
| `npm test` | 45 bestanden, keine fehlgeschlagenen oder übersprungenen Tests |
| `npm run build` | TypeScript, Vite und PWA-Erzeugung erfolgreich |
| `npm run test:browser` | 15 bestanden, 5 bewusst plattformabhängig übersprungen, keine fehlgeschlagenen Tests |
| Offlinecache | 132 Einträge, 83.044 KiB einschließlich Modelle, Texturen und Physik |

Die Physiktests prüfen unabhängige Radgrößen, echte Bodenfreiheit, Kollisionskonturen und Masse sowie die skalierte Wasserverdrängung. Die montierte Zeichnung bleibt bei Größenänderungen unverändert. Mehrfach nachgezogene Linien erzeugen weiterhin keine zusätzliche Masse oder zusätzliche Griffkanten.

Beide Browser prüfen Kamera-Wischen, getrennte Zeichenflächen, Größenänderungen, schnelle Pedaltipps ohne Textauswahl, Tempomat, Bildschirmdrehung, Speicherung und Zielfreigabe. Chromium prüft zusätzlich gleichzeitig gehaltenes Gas mit einem zweiten Kamerafinger sowie Offline-Kaltstart und Service-Worker-Updates. WebKit prüft Sensorfreigabe, Kalibrierung und den Touch-Ersatz bei verweigerter Freigabe. Diese fünf spezialisierten Fälle sind jeweils in der anderen Browser-Engine ausgelassen. Die automatische Veröffentlichung führt Physiktests und Produktionsbuild zusätzlich unter Linux aus.

Die verkleinerten Rätselkisten werden in sieben Gebieten mit dem Fahrzeug auf ihre Druckplatten geschoben und dort abgestellt. Dazu helfen kleinere Räder, damit die Stoßstange die Kiste schiebt. Alle drei Gegengewichtsbrücken werden mit ihrer bereitgestellten Last befahren; größere Vorderräder ermöglichen nach dem Schieben die Auffahrt. Die entsprechenden Versuche ohne Gegengewicht scheitern weiterhin. Die Metallplatten sitzen jetzt nahezu bündig im Boden, damit kleine Kisten nicht an einer unnötigen Kante hängen bleiben. Alle Schleusen und Lastenaufzüge bleiben physisch erreichbar und bedienbar.

Sensorprüfungen unterscheiden Rechts-/Linkslenkung und Gewichtsverlagerung nach vorne/hinten in beiden Querformatausrichtungen. Kalibrierung, veraltete Sensordaten, Pause und verweigerte Berechtigung bleiben berücksichtigt. Spielstände aus 2.0 behalten Fortschritt und Zeichnungen; frühere Steifigkeitswerte werden nicht in Radgrößen umgedeutet. Neue Größen werden pro Achse gespeichert und wiederhergestellt.

## Maßstab und Darstellung

Der 3,2 Einheiten lange Truck ist die Referenz. Generatoren haben jetzt 0,62 Einheiten maximale Ausdehnung, Fässer 0,59–0,70, Camp-Tische ungefähr 1,82. Auch Lampen, Ventile, Leitern, Versorgungskisten, Jungbäume, Stümpfe und niedrige Pflanzen werden mit demselben Maßstab eingeordnet. Große Felsformationen und tragende Bauwerke behalten ihre erforderlichen Abmessungen. Sichtbare und physische Gegenstände verwenden dieselbe Skalierung.

Die automatisierte Größenprüfung läuft über alle 21 Gebiete. Eine zusätzliche Sichtprüfung des Produktionsbuilds umfasst Generator, Camp, Canyon, Wald und Gletscher. In diesen fünf Ansichten traten keine JavaScript-, Konsolen- oder HTTP-Fehler auf. Bodenobjekte werden auf die tatsächlich gerenderten Geländedreiecke gesetzt, statt auf eine davon abweichende glatte Höhenfunktion.

Zusätzliche importierte Kiesvarianten haben jeweils 120 Dreiecke und behalten die fotografierten PBR-Texturen ihrer Quellmodelle. Im ersten Gebiet kommen 3.506 kleine Details hinzu, im zweiten Waldgebiet 6.330 und im ersten Gletschergebiet 2.227. Sie werden in räumlichen Gruppen instanziert und in der Ferne ausgeblendet. Kleine Gräser und Kies erhalten keine harten Kollisionskörper. Nur hohe Baumkronen werden bei Kameraverdeckung ausgeblendet; niedriges Gras bleibt sichtbar.

## Grenzen

WebKit prüft Browserverhalten, ersetzt aber keine Prüfung des nativen iOS-Auswahlmenüs, echter Gyrosensoren, Bildrate oder Akkulast auf dem iPhone 16 Pro Max. Die Spieloberfläche unterbindet Textauswahl, Touch-Callouts und Kontextmenüs; Einstellungsdialoge bleiben scrollbar. Nicht jedes Gebiet wurde erneut von einem Menschen vollständig durchgespielt. Die Prüfungen belegen die beschriebenen Fälle, keine allgemeine Fehlerfreiheit.
