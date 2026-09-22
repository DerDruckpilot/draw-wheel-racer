# Draw Wheel Racer

Ein eigenständiges Physik-Rennspiel für das iPhone im Hochformat: Während der Fahrt zeichnest du unten auf dem Bildschirm neue Radformen. Die tatsächliche Form beeinflusst, wie das Fahrzeug über verschiedene Untergründe und Hindernisse fährt.

**Status am 22. September 2026: Recherche und Konzept. Noch kein Spielcode.**

Der Auftrag dieser Phase ist Recherche, Repository anlegen und offene Fragen klären. Die Implementierung beginnt erst nach den Antworten des Auftraggebers. Empfehlungen in diesen Dokumenten sind noch keine bestätigten Produktentscheidungen.

## Vorgaben

- Freihand-Zeichenfeld während des Spiels dauerhaft sichtbar.
- Zeichnungen werden unmittelbar zu Fahrzeugrädern; der genaue Zeitpunkt des Wechsels ist noch abzustimmen.
- Unterschiedliche Untergründe und Hindernisse.
- Möglichst plausible Physik, insbesondere tatsächliche Wechselwirkung zwischen Radform und Gelände.
- iPhone, Hochformat, vorzugsweise als installierbare PWA.
- Fremdcode und 3D-Modelle dürfen unter passenden Lizenzen verwendet werden.

## Dokumentation

- [Recherche und technische Empfehlung](docs/RECHERCHE.md)
- [Spielkonzept und Physikentwurf](docs/KONZEPT.md)
- [Offene Entscheidungen vor dem Coding](docs/ENTSCHEIDUNGEN.md)
- [Umsetzungsschritte und Abnahmekriterien](docs/ROADMAP.md)
- [Mögliche Bibliotheken und Asset-Quellen](docs/DRITTANBIETER.md)

## Vorläufige Richtung

Three.js für die 3D-Darstellung, Rapier für die Physik, TypeScript für die Spiellogik. Eine feste Fahrspur mit seitlicher Physik und schräger 3D-Kamera erscheint für das Zeichnen auf dem iPhone besonders geeignet. Bei frei lenkbarem Fahrzeug müsste der Physikentwurf auf volle 3D-Bewegung ausgelegt werden.

Der Name ist ein technischer Arbeitstitel. Das Repository ist privat. Es gibt noch keine installierten Abhängigkeiten, importierten Assets, Veröffentlichung oder spielbare Version. Die Werbeabbildung dient als Referenz; sie ist nicht Teil dieses Repositories.
