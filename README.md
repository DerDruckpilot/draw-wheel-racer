# Draw Wheel Racer

Ein eigenständiges Physik-Rennspiel für das iPhone im Hochformat: Während der Fahrt zeichnest du unten auf dem Bildschirm neue Radformen. Die tatsächliche Form beeinflusst, wie das Fahrzeug über verschiedene Untergründe und Hindernisse fährt.

**Status am 22. September 2026: Recherche und Konzept. Noch kein Spielcode.**

Der Auftrag dieser Phase ist Recherche, Repository anlegen und offene Fragen klären. Zielgerät, Wasser, realistische Grafik und die öffentliche Repository-Sichtbarkeit sind inzwischen geklärt. Vor dem Coding wird noch das Verhalten im Wasser abgestimmt. Nicht abweichend beantwortete Empfehlungen werden als Arbeitsannahmen übernommen.

## Vorgaben

- Freihand-Zeichenfeld während des Spiels dauerhaft sichtbar.
- Zeichnungen werden unmittelbar zu Fahrzeugrädern; der genaue Zeitpunkt des Wechsels ist noch abzustimmen.
- Unterschiedliche Untergründe und Hindernisse, ausdrücklich einschließlich Wasser.
- Möglichst plausible Physik, insbesondere tatsächliche Wechselwirkung zwischen Radform und Gelände.
- iPhone 16 Pro Max mit iOS 27 (Angabe des Auftraggebers), Hochformat, installierbare PWA.
- Möglichst detaillierte, realistische 3D-Grafik mit hochwertigen kostenlosen Modellen und Texturen.
- Fremdcode und 3D-Modelle dürfen unter passenden Lizenzen verwendet werden.

## Dokumentation

- [Recherche und technische Empfehlung](docs/RECHERCHE.md)
- [Spielkonzept und Physikentwurf](docs/KONZEPT.md)
- [Offene Entscheidungen vor dem Coding](docs/ENTSCHEIDUNGEN.md)
- [Umsetzungsschritte und Abnahmekriterien](docs/ROADMAP.md)
- [Mögliche Bibliotheken und Asset-Quellen](docs/DRITTANBIETER.md)

## Vorläufige Richtung

Three.js für die 3D-Darstellung, Rapier für die Physik, TypeScript für die Spiellogik. Eine feste Fahrspur mit seitlicher Physik und schräger 3D-Kamera erscheint für das Zeichnen auf dem iPhone besonders geeignet. Bei frei lenkbarem Fahrzeug müsste der Physikentwurf auf volle 3D-Bewegung ausgelegt werden.

Der Name ist ein technischer Arbeitstitel. Der Auftraggeber hat die öffentliche Sichtbarkeit des Repositories freigegeben. Es gibt noch keine installierten Abhängigkeiten, importierten Assets, veröffentlichte Spielversion oder spielbare PWA. Die Werbeabbildung dient als Referenz; sie ist nicht Teil dieses Repositories.

Für die Installation auf dem iPhone wird später eine HTTPS-Adresse der gebauten Anwendung benötigt. Ein öffentliches Repository allein ist noch keine installierbare PWA. GitHub Pages ist dafür ein kostenfreier Hosting-Kandidat.
