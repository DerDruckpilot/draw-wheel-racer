# Recherche

Stand: 22. September 2026. Quellen sind verlinkt; Vorschläge und technische Einschätzungen werden als solche bezeichnet. Noch keine Implementierung oder Leistungsprüfung.

## 1. Was die Referenz zeigt

Das bereitgestellte Bild zeigt mehrere kleine Fahrzeuge, eine felsige Rennstrecke, unregelmäßige schwarze Räder und ein großes Zeichenfeld im unteren Bildschirmbereich. Der Strich im Feld ist offen, ungefähr C-förmig. Das spricht für einen verdickten Zeichenstrich als Rad, statt ausschließlich geschlossener, ausgefüllter Konturen.

Ein einzelnes Bild belegt weder die tatsächliche Simulation noch Details wie Radwechsel, Steuerung, Federung oder Rennregeln. Die offizielle Beschreibung von [Pocket Champs](https://hub.pocketchamps.com/about) betont Training, Werte und Gadgets. Deshalb ist die sichtbare Werbeidee die Produktreferenz; eine identische Mechanik der beworbenen App ist nicht verifiziert.

## 2. Technische Optionen

| Ansatz | Eignung für dieses Projekt | Bewertung |
| --- | --- | --- |
| Three.js + Rapier + TypeScript | Freie Kontrolle über Zeichenfeld, Geometrie, Physik und PWA | Vorläufige Empfehlung |
| Babylon.js mit Havok | Umfangreichere Browser-Engine mit integrierter Physikanbindung | Gute Alternative bei stärkerem Bedarf an Engine-Werkzeugen |
| Godot mit Webexport | Editor, Szenen und Exportfunktionen in einem Werkzeug | Möglich, aber zusätzliche Abstimmung zwischen Weboberfläche und Engine nötig |

Diese Bewertung ist projektspezifisch, kein gemessener Geschwindigkeitsvergleich. [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html) nutzt WebGL 2. [Rapier](https://rapier.rs/docs/user_guides/javascript/getting_started_js/) bietet JavaScript-Anbindung an seine WebAssembly-Physik. [Babylon.js](https://www.babylonjs.com/specifications/) nennt Havok als Physiklösung. Die aktuelle [Godot-Dokumentation](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html) beschreibt den seit 4.3 verfügbaren Ein-Thread-Webexport als auch auf iOS nutzbar; alte Aussagen, Godot 4 laufe grundsätzlich nicht im iPhone-Browser, sind deshalb keine geeignete Entscheidungsgrundlage.

Vorschlag für den späteren Aufbau: TypeScript, Vite, Three.js und Rapier; schlanke HTML-Oberfläche mit eigenem Zeichen-Canvas; Manifest, Service Worker und lokaler Spielstand. Konkrete Paketversionen und PWA-Buildwerkzeuge werden bei Implementierungsbeginn geprüft und festgeschrieben. Heute werden keine Pakete installiert.

## 3. Echte Radgeometrie

[Rapier-Collider](https://rapier.rs/docs/user_guides/javascript/colliders/) können an einem gemeinsamen starren Körper befestigt werden. Für bewegliche konkave Objekte empfiehlt die Dokumentation zusammengesetzte konvexe Formen; dynamische Dreiecksnetze und dünne Polylinien sind problematisch. Eine einzige konvexe Hülle wäre ebenfalls ungeeignet: Sie würde beispielsweise die Öffnung einer C-Form überbrücken.

Unser Entwurf ist daher ein verdickter Strich, dessen begrenzte Anzahl kurzer Abschnitte gemeinsam ein starres Rad bildet. Der sichtbare Strich und seine Kollisionsform stammen aus denselben vereinfachten Punkten. Geschlossene ausgefüllte Flächen wären eine alternative Zeichenregel und erfordern eine andere Verarbeitung.

## 4. Antrieb und Bewegung

[Rapier-Gelenke](https://rapier.rs/docs/user_guides/javascript/joints/) unterstützen rotierende Achsverbindungen und Motoren. Alternativ können [Kräfte und Drehmomente](https://rapier.rs/docs/user_guides/javascript/rigid_body_forces_and_impulses/) angewandt werden. Für unser Spiel wird ein begrenzter Antrieb entworfen: Das Fahrzeug bewegt sich aufgrund der Kontaktkräfte vorwärts. Ein idealer Motor, der eine Drehzahl unabhängig von jeder Last erzwingt, wäre für die gewünschte Wirkung ungeeignet.

[Rapier-Rigid-Bodies](https://rapier.rs/docs/user_guides/javascript/rigid_bodies/) besitzen Masse, Trägheit und Möglichkeiten zur Bewegungseinschränkung. Die dort beschriebene kontinuierliche Kollisionserkennung berücksichtigt auch Rotation und ist ein Kandidat gegen das Durchschlagen schnell drehender Radspitzen. Sie ersetzt weder eine ausreichend feine Zeitschrittwahl noch korrekte Geometrie. Der konkrete Aufwand ist im Prototyp zu messen.

## 5. Was „physikalisch korrekt“ hier bedeuten kann

Die geplante Basis ist eine Starrkörpersimulation mit tatsächlicher Geometrie, Schwerkraft, Reibung, Trägheit, Motorlast und Stößen. Eine feste Fahrspur ist eine bewusst vereinfachte, ebene Welt. Eine solche Welt kann körperlich konsistent reagieren, simuliert aber kein seitliches Umkippen oder Lenken.

Sand und Schlamm sind keine bloß anders eingefärbten festen Böden. [Project Chrono](https://api.chrono.projectchrono.org/vehicle_terrain_crm_api_.html) unterscheidet beispielsweise deformierbare Höhenfelder und aufwendigere Kontinuumsmodelle. Daraus folgt für unser Projekt: Reibung allein bildet Einsinken nicht ab. Ein vereinfachtes Modell mit Einsinktiefe und geschwindigkeitsabhängigen Widerstandskräften wäre für das iPhone ein sinnvoller Untersuchungsansatz. Seine Qualität und Leistung sind unbewiesen, bis der Prototyp getestet ist. Eine Simulation jedes Sandkorns wird nicht als Startumfang empfohlen.

Auch das plötzliche Ersetzen eines Rades ist keine natürliche physikalische Bewegung. Dafür brauchen wir eine ausdrücklich festgelegte Spielregel für Überlappungen, Masse und Rotationsenergie. Dauerhaft perfekte Energieerhaltung beim beliebigen Formwechsel wird nicht versprochen.

## 6. iPhone-PWA

[WebKit](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/) beschreibt das Öffnen von Websites als Home-Screen-Web-Apps. Die geplante PWA erhält eine HTTPS-Adresse, App-Icon und Hochformatoberfläche. Eine erzwungene [Orientierungssperre](https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/lock) darf wegen unterschiedlicher Browserunterstützung keine Voraussetzung sein; die Oberfläche benötigt auch eine brauchbare Reaktion auf Querformat.

[Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events) sind die Basis für Finger- und Mauseingabe. Die Zeichenfläche muss Scrollgesten passend unterbinden, einen laufenden Strich zuverlässig erfassen und abgebrochene Gesten sauber behandeln.

[Offlinebetrieb](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation) wird durch einen Service Worker und vorab gespeicherte Ressourcen ermöglicht. Dafür müssen auch Physik-WASM, Modelle und Sounds vorhanden sein. Ein erstmaliger Online-Aufruf und vollständiger Download sind erforderlich. Offlineverfügbarkeit und Spielstandspeicherung sind getrennt zu testen; eine Web-App kann keine unbegrenzte Aufbewahrung durch das Betriebssystem garantieren.

Vorgeschlagene Prüfungen auf dem tatsächlichen iPhone: Start aus Safari und vom Home-Screen, Flugmodus-Neustart, Fingerzeichnen, Appwechsel, Audiostart nach Berührung, sichere Abstände zum Home-Indikator sowie eine längere Spielsession. Ein Desktop-Browser im Mobilformat ersetzt diese Prüfung nicht.

## 7. Offene Nachweise

- Welche Bildrate erreicht das konkrete iPhone bei mehreren Fahrzeugen und komplexen Radformen?
- Bleiben wechselnde Radformen auf Stufen und in engen Kontakten stabil?
- Wie viel Federung ist spielerisch hilfreich, bevor sie Formunterschiede verdeckt?
- Liefert das vereinfachte Bodenmodell nachvollziehbare Unterschiede ohne versteckte Formboni?
- Wie schnell wird die Zeichnung übernommen, einschließlich aufwendiger Formen?

Diese Punkte sind spätere Prototypaufgaben. Aus der Dokumentationsrecherche allein lassen sie sich nicht beantworten.

## 8. Ergänzung nach der Rückmeldung

Zielgerät ist laut Auftraggeber ein iPhone 16 Pro Max mit iOS 27. Wasser wird ein verbindlicher Streckenbestandteil; sein genaues Spielverhalten ist noch abzustimmen. Die Grafik soll möglichst realistisch und detailliert werden. Die ursprüngliche Empfehlung eines freundlichen stilisierten Looks ist damit ersetzt.

Der Auftraggeber erlaubt ein öffentliches Repository. [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) kann statische Webanwendungen aus einem Repository bereitstellen und ist bei GitHub Free für öffentliche Repositories verfügbar. Das ist ein geeigneter Kandidat für die spätere Spielveröffentlichung. Nach den [PWA-Installationsanforderungen](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable) wird eine geeignete Webanwendung über HTTPS benötigt. Eine Änderung der Repository-Sichtbarkeit allein veröffentlicht daher noch kein installierbares Spiel. Bei einem Hosting unter einem Unterpfad müssen Assetpfade, Manifest und Service-Worker-Bereich darauf abgestimmt werden.
