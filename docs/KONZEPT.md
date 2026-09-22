# Spielkonzept und Physikentwurf

Unbestätigter Vorschlag vom 22. September 2026. Die Antworten in ENTSCHEIDUNGEN.md bestimmen den tatsächlichen Umfang.

## Spielerlebnis

Oben läuft ein gut lesbares 3D-Rennen mit schräger Seitenansicht. Unten bleibt etwa das untere Drittel des nutzbaren Hochformats zum Zeichnen frei. Eine Achsmarkierung hilft, die Radform bewusst um ihren Drehpunkt zu zeichnen. Das nächste Hindernis muss rechtzeitig erkennbar sein.

Die Grundschleife: Gelände ansehen, Form zeichnen, Fahrverhalten beobachten, Form anpassen. Fortschritt soll durch bessere Entscheidungen entstehen. Vorschlag: automatischer Antrieb, kurze Strecken, sofortiger Neustart und gespeicherte Lieblingsformen. Eine frei zugängliche Teststrecke macht Zusammenhänge leichter verständlich.

Der erste inhaltliche Vorschlag sind drei Themenwelten mit je vier kurzen Strecken: Canyon, Eis und Baustelle. Diese Zahl ist ein Umfangsvorschlag, keine bereits zugesagte Lieferung. Computergesteuerte Gegner, Zeitfahren und freies Experimentieren sind noch abzustimmen.

## Untergründe und Hindernisse

| Element | Geplante Wirkung | Idee für eine Herausforderung |
| --- | --- | --- |
| Ebene Straße | Ruhiger Vergleich von Rundlauf und Motorlast | Schnellste Form ohne große Sprünge finden |
| Fels und Geröll | Tatsächliche Kanten und unregelmäßige Auflagepunkte | Unebenheiten mit ausreichender Bodenfreiheit überwinden |
| Eis | Geringe Reibung, leichter Schlupf | Steigung mit begrenzter Traktion bewältigen |
| Stufen | Radspitzen können Kanten erreichen; Chassis kann aufsetzen | Rhythmus und Größe der Form auf Stufen abstimmen |
| Rampen und Lücken | Anlauf, Absprung und Landung | Sprung schaffen und fahrbereit landen |
| Balken und niedrige Durchfahrt | Platz nach oben und unten ist begrenzt | Größere Räder haben hier einen Nachteil |
| Wippe oder beweglicher Balken | Dynamischer Untergrund verändert die Lage | Kontakt und Balance halten |
| Sand oder Schlamm | Optionales Modell für Einsinken und Widerstand | Kontaktverteilung und Traktion untersuchen |

Die Effekte sind Entwurfsziele. „Stern ist auf Fels immer schneller“ oder ähnliche feste Zuordnungen sind nicht vorgesehen. Ob eine Form hilft, hängt von Geometrie, Antrieb, Gewicht, Reibung und Hindernisgröße ab. Auf hartem Untergrund erzeugt eine größere Auflagefläche allein keinen pauschalen Haftungsbonus.

## Von der Zeichnung zum Rad

1. Fingerpunkte relativ zur Zeichenfläche erfassen; Maus als zusätzliche Testeingabe.
2. Sehr nahe Punkte zusammenfassen und Messzittern glätten, ohne Ecken oder Öffnungen grundsätzlich zu entfernen.
3. Den Strich in eine begrenzte Zahl gleichmäßig verteilter Abschnitte überführen; Ausgangsziel etwa 24–48 Abschnitte, nach Messung anpassen.
4. Größe, Achsposition und Strichdicke entsprechend den bestätigten Regeln bestimmen.
5. Sichtbare Radgeometrie und verdickte Kollisionsabschnitte aus derselben Punktfolge bauen.
6. Die Abschnitte an einem gemeinsamen Radkörper befestigen. Überlappende Teilstücke dürfen die Masse nicht unbeabsichtigt mehrfach erhöhen.
7. Die neue Form an einer Grenze zwischen Physikschritten übernehmen.

Ein Vorschlag ist ein durchgehender Strich pro Radform. Selbstkreuzungen sind erlaubt; offene Enden bleiben offen. Mehrere getrennte Striche erfordern eine separate Eingabe- und Verbindungsregel. Kleine oder leere Eingaben lassen die letzte gültige Radform bestehen.

Die zentrale Achse wird angezeigt. Für Formen, die diese Achse nicht berühren, ist eine leichte starre Trägerstruktur zwischen Nabe und Zeichenstrich vorzusehen. Ihre Sichtbarkeit, Masse und Kollisionswirkung müssen zusammenpassen; beliebig schwebende Einzelteile sollen nicht als reale Konstruktion ausgegeben werden.

## Physikarchitektur

Vorläufig bevorzugt: 2D-Physik in Fahrtrichtung und Höhe, dargestellt als räumliche 3D-Szene. Pro Fahrzeug werden zwei Räder im Seitenprofil simuliert; die gegenüberliegenden sichtbaren Räder folgen diesen Achsen. Fahrzeuge können in nebeneinander dargestellten unabhängigen Spuren fahren. Dadurch sind seitliche Fahrzeugkollisionen und freie Lenkung ausgeschlossen. Bei gewünschtem Drängeln oder seitlichem Umkippen ist stattdessen volle 3D-Physik erforderlich.

Chassis und Räder sind dynamische Körper. Die Achsen erlauben Rotation. Der Motor liefert begrenztes Drehmoment und berücksichtigt die Gegenwirkung auf das Chassis. Federung wird zunächst als gezielt zu prüfende Erweiterung behandelt. Es gibt keinen pauschalen Vorwärtsschub auf das Fahrzeug und keine Geschwindigkeitswertung nach erkannter Form.

Entwurfsziel sind feste Physikschritte, getrennt von der Darstellung: zunächst 60 Schritte pro Sekunde, bei Bedarf zusätzliche kleinere Schritte in kritischen Situationen. Renderinterpolation und begrenzte Aufholarbeit sollen unterschiedliche Bildraten und Appunterbrechungen behandeln. Zahlen sind Startwerte für Messungen, keine Performancezusage.

## Radwechsel und Grenzen der Simulation

Empfehlung zur Eingabe: Der neue Strich erscheint während des Zeichnens unmittelbar im Feld; die Räder wechseln beim Loslassen. Eine Änderung bereits während jeder Fingerbewegung ist möglich, führt aber ständig zu unfertigen und wechselnden Kollisionsformen. Der gewünschte Modus muss ausdrücklich geklärt werden.

Für den Wechsel werden Radkörper möglichst beibehalten und die zugehörigen Formen kontrolliert ersetzt. Der Entwurf muss festlegen, wie vorhandene Geschwindigkeit und neue Trägheit zusammengeführt werden. Gleichzeitig Drehzahl, Drehimpuls und Rotationsenergie zu erhalten, ist bei geänderter Trägheit im Allgemeinen unmöglich.

Vor einem Wechsel wird geprüft, ob die neue Geometrie Boden, Chassis oder Hindernisse durchdringt. Eine begrenzte Lagekorrektur oder ein kurz zurückgestellter Wechsel sind mögliche Regeln. Welche Variante akzeptabel ist, wird im Physikprototyp demonstriert. Wiederholtes Vergrößern darf keinen unbegrenzten Katapult-Effekt erlauben. Solche Korrekturen bleiben dokumentierte Spielhilfen.

Für die Masse wird konstante Materialdichte bei gleicher Strichdicke vorgeschlagen: Mehr gezeichnetes Material bedeutet mehr Masse und andere Trägheit. Eine alternative, leichter vergleichbare Spielregel wäre gleiche Gesamtmasse jeder Form. Beide Regeln gleichzeitig zu versprechen wäre widersprüchlich.

## Oberfläche und Darstellung

- Eigenständiger, heller 3D-Stil mit klaren Silhouetten und sichtbarem Bodenkontakt.
- Großer Zeichenbereich mit Achsmarkierung, letzter gültiger Form und Rückgängig/Neu-Zeichnen-Funktion.
- Fortschritt, Zeit oder Platzierung; wenige Bedienelemente außerhalb der Zeichenfläche.
- Pause und Neustart; im Experimentiermodus optional Zeitlupe.
- Vorschlag: deutsche Oberfläche, abschaltbarer Ton, keine Werbung und keine Kontopflicht.
- Lokale Speicherung von Einstellungen, Fortschritt und Lieblingsformen; Exportmöglichkeit als späterer Kandidat.

Der Arbeitstitel lautet Draw Wheel Racer. Figuren, Modelle und Gestaltung werden eigenständig erstellt oder aus geeigneten Asset-Bibliotheken gewählt.
