# FORMDRIVE 1.9 — Mechanik-Abenteuer

Die 15 vorhandenen Expeditionen bleiben unter ihren bisherigen IDs erhalten. Sechs zusätzliche Abenteuer (16–21) ergänzen sie: Das Schleusenwerk, Gegen den Strom, Auf dünnem Eis, Die Höhenlinie, Die Versorgungsfahrt und Das alte Wasserwerk. Das Testgelände enthält alle 57 Hindernistypen.

## Spielmechaniken

- **Wasserhöhlen:** Der freie Auslauf hinter der Gezeitenhöhle ist acht Einheiten länger. Zwischen Dachende und erster hoher Ausstiegsstufe liegen jetzt über elf Einheiten. Beide Achsen können ausfahren und größere Formen montieren.
- **Alternative Wege:** Erhöhte, unterbrochene Steinstege verlaufen über einem befahrbaren Wasserweg. Goldene Rauten kennzeichnen die optionale Meisterroute. Geometrie und Kontakte entscheiden, welcher Weg erreicht wird; es gibt keinen versteckten Routenbonus für bestimmte Zeichnungen.
- **Mechanismen:** Gewicht betätigt gefederte Druckplatten und echte Wippen mit versetztem Massenschwerpunkt. Sie lösen verriegelnde Torantriebe aus. Pendeltore müssen durch Fahrzeugkontakt aufgedrückt werden. Bewegliche Felsen besitzen eigene Starrkörper.
- **Wasserstand:** Eine ausgelöste Schleuse verändert den tatsächlichen Auftrieb und die sichtbare Oberfläche mit begrenzter Geschwindigkeit. Im Wasserwerk füllt das erste Gegengewicht das Becken. Die zweite Platte in der freien Auslaufbucht öffnet den Ablauf und das Ausgangstor. Wiederholte Paddelschläge können die Ratsche einer Unterwasserplatte betätigen.
- **Strömung:** Wasserkräfte berücksichtigen die Bewegung relativ zur Strömung. Eine geschützte Bucht reduziert die Strömung räumlich; ein felsiger Wasserfall erzeugt örtlich abwärts gerichtete Wasserbewegung und sichtbare Gischt.
- **Lehmspuren:** Die neuen weichen Lehmfelder verändern ihr kollidierbares Bodenprofil unter belasteten, rutschenden Radkontakten. Die Kontaktbreite verteilt die Last. Spuren bleiben innerhalb der Fahrt erhalten und sind auf der Oberfläche sichtbar. Die maximale Einsinktiefe ist begrenzt.
- **Radsteifigkeit:** Jede Achse hat einen eigenen Regler. Eine gefilterte Kontaktlast komprimiert die gezeichnete Kontur elastisch. Kollisionskapseln, sichtbare Kontur und Wasserflächen folgen derselben Verformung; die Masse bleibt konstant. Bei Entlastung entspannt sich die Form.
- **Gewicht:** Ein Regler verlagert den Massenschwerpunkt des Chassis langsam nach vorne oder hinten. Ein sichtbarer Ballast folgt der Verstellung. Die Gesamtmasse bleibt konstant; es gibt keinen zusätzlichen Vortrieb.
- **Sprünge:** Absprungrampen, kurze erhöhte Landeflächen und niedrigere Auswege erlauben unterschiedliche Ergebnisse. Gas und Bremse beeinflussen über entgegengesetzte Achsmomente auch die Neigung in der Luft.
- **Tragfähigkeit:** Morsche Bohlen und verankerte Eisschollen sammeln Kontaktlastschäden. Risse erscheinen vor dem Bruch. Bei Versagen löst sich die Halterung; das Teil fällt beziehungsweise schwimmt gemäß seiner Masse und Verdrängung weiter.
- **Fracht:** Auf der Versorgungsfahrt sitzt ein eigener, seitlich gefedert beweglicher Starrkörper auf dem Dach. Heftige Stöße beschädigen die Ladung. Das Ziel zählt nur mit intakter Fracht. Die niedrige Frachtpassage berücksichtigt die Ladung beim Radwechsel; Vergrößern wartet auf ausreichende Kopffreiheit.
- **Auszeichnungen:** Die zwei bisherigen Sterne bleiben erhalten. Meisterrouten erfordern mehrere Markierungen in der richtigen Reihenfolge und die anschließende Zielankunft. Erfolgreiche Lieferungen erhalten eine eigene Markierung in der Streckenauswahl.
- **Abschlussrätsel:** Das Wasserwerk verbindet Gegengewicht, Fluten, Höhlendurchfahrt, Ablaufplatte, Ausgangstor und bewegliche Auflage in einer zusammenhängenden Gruppe. Danach folgen Achsversatz, Strömung, Engstelle, optionale Höhenroute und Aufstieg.

## Bedienung und Rücksetzen

Die beiden Zeichenfelder und die getrennte Montage bleiben bestehen. Im aufklappbaren Fahrwerkfenster liegen die drei neuen Regler. Das Gaspedal ist dosierbar: weiter oben drücken gibt mehr Gas, die obere Zone erreicht Vollgas. Wischen nach oben aktiviert weiterhin den Tempomat. Tastatur-Gas erreicht ebenfalls Vollgas.

Checkpoints speichern Mechanismen, Wasserstände, Bodenspuren, Meisterroutenfortschritt und Frachtzustand gemeinsam. Bergen stellt diesen Zustand wieder her. Kein Laufzeit-Checkpoint wird über einen App-Neustart hinweg gespeichert; abgeschlossene Expeditionen, Auszeichnungen und Einstellungen liegen weiterhin lokal auf dem Gerät. Alte Ergebnisse bleiben kompatibel.

## Physikalische Grenzen

Die Fahrbewegung bleibt eine 2D-Starrkörpersimulation innerhalb einer räumlich gebogenen 3D-Welt. Routen verzweigen in der Höhe; seitliches Lenken wurde nicht eingeführt. Strömungen sind vorgegebene räumliche Felder und Schleusen gesteuerte Pegel, keine vollständige Strömungssimulation. Torantriebe verwenden gefederte Gelenkmotoren nach Betätigung des Schalters; Seilrollen sind Darstellung, keine vollständige Seildynamik.

Die Radnachgiebigkeit ist eine begrenzte elastische Konturverformung entlang der Kontaktlast, keine FEM-Simulation einzelner Gummifasern oder frei knickender Speichen. Lehm verwendet ein begrenztes eindimensionales Bodenprofil und viskose Kräfte; verdrängte Erdklumpen sind Partikel. Materialbruch löst ganze vorgefertigte Platten. Frachtintegrität und Meisterrouten sind Spielregeln. Diese Vereinfachungen begrenzen Rechenzeit und Speicher auf Mobilgeräten.

## Prüfung

Zusätzlich zu den bisherigen Prüfungen testen die Mechaniktests druckbetätigte Tore, Füllen und Ablassen, Strömungsrelativität, schwimmendes Eis, Bruchvorwarnung und Wiederherstellung, echte Bodensenkung, lastabhängige Radverformung, ruhende weiche Räder, Schwerpunktverlagerung, Frachtstöße, Montage unter Decken und Luftkorrekturen. Beide Arten von Meisterroute werden durch echte Fahrten mit ausschließlich Kontaktkräften erreicht.

Vollständige Expeditionsfahrten nutzen gezeichnete Referenzkonturen, Gas, Bremsen, Rückwärtsrangieren und reguläre Checkpoint-Bergungen. Der Prüffahrer kann einen festgefahrenen Kletterversuch mit längeren Hebeln wiederholen. Die Vergleichsfahrten mit unverändertem großem Ring, kleinem Ring oder offenen Haken umfassen jetzt 63 Kombinationen. Diese Beispiele ersetzen keinen Beweis gegen jede denkbare Universalform.

Mobile Browserprüfungen decken neue Regler, Montage, Pedale, Levelwechsel, Schalter, Wasserstände, Eis, Fracht und Rendering ab. Offline-Neustart und PWA-Update werden in Chromium geprüft. Ein tatsächlicher iPhone-Leistungstest bleibt davon getrennt.

Lokale Abnahme: 74 von 74 Tests bestanden, 13 historische Strecken und alle 22 Expeditionen einschließlich Testgelände abgeschlossen. Keine der 63 Fahrten mit unveränderter Referenzform erreichte das Ziel. Die Browserläufe bestanden mit acht WebKit- und drei Chromium-Prüfungen; jeweils für den anderen Browser bestimmte Prüfungen wurden ausdrücklich übersprungen. TypeScript und Produktionsbuild sind erfolgreich.
