/* ------------------------------------------------------------------
   De huttentocht zelf: welke etappes er zijn, waar ze langsgaan en wat
   je verder over die dag wil weten.

   De lijn op de kaart komt uit TOUR.gpx — onze komoot-planning van de
   hele tocht, die js/route-split.js per dag opknipt bij de hutten. Daar
   komen afstand, hoogtemeters en het profiel vandaan.

   De `punten` per etappe zijn de benoemde plekken onderweg: ze staan in
   de lijst "onderweg langs", zetten een speld op de kaart en markeren
   het profiel. Ze zijn op de track vastgeklikt, dus hun coördinaten en
   hoogtes zijn die van de route zelf. Valt het GPX-bestand weg, dan
   trekt js/route-build.js er weer een lijn doorheen — ruwer, maar de
   pagina blijft heel.

   `gepland.tijd` is komoots eigen schatting, uit de tijdstempels in de
   export. Staat er geen `gepland`, dan rekent de pagina een boektijd uit.
------------------------------------------------------------------- */

export const TOUR = {
  naam: "Greina — van hut naar hut",
  // De hele tocht in één komoot-export; js/route-split.js knipt 'm per dag
  // op, op de hutten die er als <wpt> in staan. Afstand, hoogtemeters en
  // profiel komen daarmee overal uit dit bestand.
  gpx: "routes/greina-2026.gpx",
  centrum: [46.622, 8.955],
  zoom: 12
};

/* De boekingen zoals ze op hut-reservation.org staan. */
export const HUTTEN = [
  {
    id: "medel",
    naam: "Medelserhütte SAC",
    ook: "Camona da Medel",
    hoogte: 2524,
    lat: 46.64005, lon: 8.91044,
    nacht: "2026-09-12",
    reservering: "6640519",
    personen: 2,
    status: "Bevestigd",
    site: "https://www.medelserhuette.ch/",
    note: "Staat op de Fuorcla da Lavaz, het zadel boven Val Plattas. Sectie Uto van de SAC."
  },
  {
    id: "motterascio",
    naam: "Capanna Motterascio CAS",
    ook: "Capanna Michela Motterascio",
    hoogte: 2171,
    lat: 46.59332, lon: 9.00539,
    nacht: "2026-09-13",
    reservering: "6640678",
    personen: 2,
    status: "Bevestigd",
    site: "https://capannamotterascio.casticino.ch/",
    tel: "+41 91 872 16 22",
    note: "Op de Alpe Motterascio, aan de zuidrand van de Greina — Ticino-kant van de waterscheiding. "
      + "Open van 13 juni tot 10 oktober 2026."
  },
  {
    id: "scaletta",
    naam: "Capanna Scaletta",
    ook: "SAT Lucomagno",
    hoogte: 2205,
    lat: 46.60778, lon: 8.94038,
    nacht: "2026-09-14",
    reservering: "6640829",
    personen: 2,
    status: "Bevestigd",
    site: "https://www.satlucomagno.ch/wordpress/capanna-scaletta/",
    note: "Boven Val Camadra, aan de westkant van de Greinapas. Herkenbaar aan het puntdak en de rode luiken."
  }
];

export const ETAPPES = [
  {
    id: "d1",
    datum: "2026-09-12",
    bestand: "dag1-curaglia-medelserhuette",
    punten: [
      { naam:"Curaglia, posta", ele:1267, lat:46.67556, lon:8.85569, type:"start", note:"Hier staat de auto; hier stappen we op 15 september ook weer uit het Postauto" },
      { naam:"Alp Sura", ele:1962, lat:46.64889, lon:8.88953, note:"Vlakte halverwege; hierna wordt het steil" },
      { naam:"Medelserhütte SAC", ele:2524, lat:46.64005, lon:8.91044, type:"hut", note:"Op de Fuorcla da Lavaz" }
    ],
    van: "Curaglia",
    naar: "Medelserhütte",
    slaap: "medel",
    zwaarte: "T2",
    zwaarteNote: "bergwandelpad, wit-rood gemarkeerd",
    gepland: { tijd: "3 u 32", bron: "komoot" },
    heenweg: "Met de auto naar Curaglia. Die blijft daar staan: op 15 september komen we er met het "
      + "Postauto over de Lukmanier weer uit.",
    verhaal: "Aanloopdag, en meteen de steilste van de vier: vanuit het dorp oostwaarts door de kloof "
      + "Val Plattas in, over de alpweg langs de brug bij Pardatsch (de laatste parkeerplek) en dan "
      + "smaller wordend langs de oostflank. Na Alp Sura wordt het steil, met de hut al in zicht.",
    let: "Ruim elfhonderd hoogtemeters met volle rugzak, en niets ertussen om af te breken — begin op tijd.",
    varianten: [
      {
        naam: "Noordelijk om, over twee passen",
        kort: "Dezelfde hut, maar aan de noordkant van de toppen langs — twee keer zo lang.",
        via: ["Curaglia 1267 m", "Pardatsch 1596 m", "Alp Cazirauns", "Fuorcla da Vallesa 2629 m",
          "Val Vallesa, P. 2478", "Fuorcla da Stavelatsch 2593 m", "Medelserhütte 2524 m"],
        tijd: "6 u 30",
        stijgen: "± 1.550 m",
        dalen: "± 300 m",
        zwaarte: "T3",
        markering: "wit-rood-wit alpine wandelweg",
        wat: "Bij Pardatsch links omhoog in plaats van Val Plattas in: langs Alp Cazirauns naar de "
          + "Fuorcla da Vallesa (2629 m), de pas tussen Piz Muraun en Piz Cazirauns. Aan de noordkant "
          + "steil omlaag Val Vallesa in, op ongeveer 2480 m westwaarts door het morenelandschap, en "
          + "dan over de Fuorcla da Stavelatsch (2593 m) van bovenaf op de hut af. Je loopt dus aan de "
          + "noordkant om de toppen heen die de gewone route aan de zuidkant passeert.",
        voor: "Twee passen boven de 2500 in plaats van één dalinloop, uitzicht op de Medelgletsjers "
          + "de hele middag, en vrijwel niemand tegen — hikr heeft er een handvol verslagen van.",
        tegen: "Drie uur en ruim driehonderd hoogtemeters meer dan de gewone route, T3 in plaats van "
          + "T2, met een steile noordafdaling en losse moreen ertussen. Eenmaal boven is er tot de hut "
          + "geen afsteker terug naar het dal, en het is de dag ná de autorit, met de rugzak op zijn "
          + "zwaarst — met dag 2 (8 u 19, T3) er meteen achteraan.",
        oordeel: "Mooi, maar niet voor deze tocht. Bewaar hem voor een keer dat de Medelserhütte het "
          + "doel zelf is en de rugzak licht — of loop hem als dagtocht vanuit de hut: Stavelatsch en "
          + "Vallesa zijn vanaf de hut een lus van een uur of vijf.",
        bronnen: [
          { naam: "medelserhuette.ch — zustiege ab Curaglia",
            url: "https://www.medelserhuette.ch/zustiege/sommer/ab-curaglia" },
          { naam: "fuorcla.ch — Fuorcla da Vallesa (2629 m)",
            url: "https://fuorcla.ch/fuorcla-da-vallesa/" },
          { naam: "gipfelbuch.ch — over de Fuorclas Stavelatsch en Vallesa",
            url: "https://www.gipfelbuch.ch/routen/11300-piz-muraun-2897m-von-der-medelserhuette-sac-ueber-die-fuorclas-stavelatsch-und-vallesa" }
        ]
      }
    ]
  },
  {
    id: "d2",
    datum: "2026-09-13",
    bestand: "dag2-medelserhuette-motterascio",
    punten: [
      { naam:"Medelserhütte SAC", ele:2524, lat:46.64005, lon:8.91044, type:"hut" },
      { naam:"Alp Lavaz", ele:2328, lat:46.64904, lon:8.93258, note:"Uitgestrekte alp onder de hut" },
      { naam:"Val Sumvitg, laagste punt", ele:1387, lat:46.65694, lon:8.98448, note:"Het diepste punt van de dag — hierna ruim 750 m weer omhoog" },
      { naam:"Terrihütte SAC", ele:2134, lat:46.63368, lon:9.00433, type:"hut", note:"Bewaakt; dé plek voor de middagpauze — terrihuette.ch" },
      { naam:"Muot la Greina", ele:2241, lat:46.62286, lon:8.99954, note:"Rand van de hoogvlakte" },
      { naam:"Plaun la Greina", ele:2230, lat:46.61532, lon:8.99498, note:"De vlakte zelf, met de meanders van de Rein da Sumvitg" },
      { naam:"Crap la Crusch", ele:2259, lat:46.61035, lon:8.99591, type:"pass", note:"Brede zadel naar de Ticino-kant" },
      { naam:"Alpe Motterascio", ele:2251, lat:46.59976, lon:9.00527 },
      { naam:"Capanna Motterascio CAS", ele:2171, lat:46.59332, lon:9.00539, type:"hut" }
    ],
    van: "Medelserhütte",
    naar: "Capanna Motterascio",
    slaap: "motterascio",
    zwaarte: "T3",
    zwaarteNote: "veeleisend bergwandelpad; korte blootgestelde stukken",
    gepland: { tijd: "8 u 19", bron: "komoot" },
    verhaal: "De lange dag, en onderschat hem niet: hij duikt Val Sumvitg in tot 1387 meter — elfhonderd "
      + "meter onder de hut — en klimt daarna in één ruk ruim 750 meter terug omhoog naar de Terrihütte. "
      + "Daarna om Muot la Greina heen de hoogvlakte op, over Plaun la Greina met de meanders van de Rein "
      + "da Sumvitg, en via het zadel Crap la Crusch naar de Alpe Motterascio.",
    let: "De hoogtemeters zitten bijna allemaal ná de lange afdaling, met een volle rugzak en een halve "
      + "dag in de benen. Plan de pauze bij de Terrihütte en beslis dáár of je doorgaat of blijft.",
    tip: "De hoge variant over de Fuorcla Sura da Lavaz (2703 m) is korter maar wit-blauw-wit en gaat over "
      + "de resten van de Lavaz-gletsjer. Niet met een volle rugzak en niet zonder goede omstandigheden."
  },
  {
    id: "d3",
    datum: "2026-09-14",
    bestand: "dag3-motterascio-scaletta",
    punten: [
      { naam:"Capanna Motterascio CAS", ele:2171, lat:46.59332, lon:9.00539, type:"hut" },
      { naam:"Alpe Motterascio", ele:2251, lat:46.59976, lon:9.00527, note:"Drassig; metalen trapje over de beek" },
      { naam:"Crap la Crusch", ele:2259, lat:46.61035, lon:8.99591, type:"pass" },
      { naam:"Passo della Greina", ele:2350, lat:46.61079, lon:8.96176, type:"pass", note:"Pass Crap — waterscheiding Rijn/Ticino" },
      { naam:"Capanna Scaletta", ele:2205, lat:46.60778, lon:8.94038, type:"hut", note:"Puntdak, rode luiken" }
    ],
    van: "Capanna Motterascio",
    naar: "Capanna Scaletta",
    slaap: "scaletta",
    zwaarte: "T2",
    zwaarteNote: "bergwandelpad over de hoogvlakte",
    gepland: { tijd: "2 u 52", bron: "komoot" },
    verhaal: "De korte dag, en de mooiste kilometers van de tocht. Over de Alpe Motterascio (drassig, een "
      + "metalen trapje over de beek) terug naar Crap la Crusch, dan langs de bovenloop van de Rein omhoog "
      + "naar de Passo della Greina. Vanaf de pas omlaag naar de Scaletta, met de hele Greina in de rug.",
    let: "Weinig hoogteverschil, maar volledig open en boven de boomgrens: bij onweer is er nergens te "
      + "schuilen. Vroeg weg als er buien in de verwachting staan.",
    tip: "Nog geen drie uur lopen — tijd zat voor een uitstapje de Greina-vlakte op, of een lus over de noordrand."
  },
  {
    id: "d4",
    datum: "2026-09-15",
    bestand: "dag4-scaletta-campo-blenio",
    punten: [
      { naam:"Capanna Scaletta", ele:2205, lat:46.60778, lon:8.94038, type:"hut" },
      { naam:"Pian Geirett", ele:1847, lat:46.59816, lon:8.93608, note:"Eind van de weg in Val Camadra; in het hoogseizoen rijdt hier een bus" },
      { naam:"Campo (Blenio)", ele:1208, lat:46.55714, lon:8.93657, type:"finish", note:"Postauto naar Olivone en Biasca" }
    ],
    van: "Capanna Scaletta",
    naar: "Campo (Blenio)",
    zwaarte: "T2",
    zwaarteNote: "afdaling over een gemarkeerd pad en de dalweg",
    gepland: { tijd: "3 u 23", bron: "komoot" },
    verhaal: "Uitlopen: duizend meter omlaag door Val Camadra. Eerst in een klein uur naar Pian Geirett, "
      + "het eind van de weg, en vandaar het dal uit langs de Camadra naar Campo (Blenio).",
    let: "Hier is geen bed geboekt — dit is de dag dat we naar de auto terug lopen, en het Postauto over "
      + "de Lukmanier rijdt maar vier keer per dag. Om 14.45 uit Olivone is de te halen bus, 16.45 is de "
      + "laatste; reken vanaf Capanna Scaletta op ruim drie en een half uur naar Campo (Blenio) en vertrek "
      + "dus uiterlijk om acht uur.",
    tip: "Op Pian Geirett, na een klein uur lopen, is een halte van het Bus Alpin naar Olivone. Dat zou "
      + "de hele daling door Val Camadra schelen — maar 15 september is een dinsdag, en in september "
      + "rijdt die bus volgens de dienstregeling alleen nog in het weekend. Niet op rekenen; bel "
      + "GreinaBus als je het toch wil proberen.",
    terugweg: "Campo (Blenio) → Olivone met lijn 135, daar over op het Postauto over de Lukmanier naar "
      + "Curaglia. Zie hieronder, bij Terug naar de auto."
  }
];

/* ------------------------------------------------------------------
   Terug naar de auto. De auto staat in Curaglia, wij komen op 15
   september in Campo (Blenio) het dal uit — de andere kant van de
   Lukmanier. Dat is één overstap in Olivone.

   De cijfers hieronder staan met opzet met hun herkomst erbij. Wat
   PostAuto zelf over de doorgaande bus publiceert (Biasca en Disentis)
   is hard; de tijden in Olivone en Curaglia zijn daaruit afgeleid en
   dus geen dienstregeling. Check ze op de dag zelf — dat kan nog in
   Olivone, bij de halte hangt het blad.
------------------------------------------------------------------- */
export const TERUGREIS = {
  datum: "2026-09-15",
  van: "Campo (Blenio)",
  naar: "Curaglia",
  auto: "De auto staat in Curaglia, aan de Lukmanierpasstraat — de bus zet je bij dezelfde halte af "
    + "als waar we op 12 september vertrokken.",
  mikpunt: "De bus van 14.45 uit Olivone, rond 15.45 in Curaglia. Lukt dat niet, dan is 16.45 de "
    + "laatste van de dag.",
  benen: [
    {
      naam: "Campo (Blenio), Paese → Olivone, Posta",
      lijn: "Lijn 135 (62.135), Autolinee Bleniesi",
      duur: "± 10 min",
      tijden: "Meerdere ritten per dag; stem hem af op de aansluiting in Olivone hieronder.",
      bron: "vast"
    },
    {
      naam: "Olivone → Lukmanier Passhöhe → Curaglia, posta",
      lijn: "Postauto Lukmanierpasslijn (dienstregelingsveld 90.481), de doorgaande bus Biasca–Disentis",
      duur: "± 1 u",
      tijden: "Vier ritten per dag, midden juni tot midden oktober. Richting Disentis vertrekken ze "
        + "uit Biasca om 8.11, 10.11, 14.11 en 16.11 en zijn in Disentis om 9.57, 11.57, 15.57 en 17.57. "
        + "Olivone ligt ongeveer 33 minuten na Biasca (dus ± 8.45, 10.45, 14.45 en 16.45) en Curaglia "
        + "elf minuten vóór Disentis (dus ± 9.46, 11.46, 15.46 en 17.46).",
      bron: "afgeleid"
    }
  ],
  /* Wat er tussen Scaletta en de bus in zit: komoots 3 u 23 voor dag 4,
     plus pauzes. Acht uur weg uit de hut haalt de bus van 14.45 ruim. */
  marge: "Capanna Scaletta → Campo (Blenio) is 3 u 23 volgens komoot. Om acht uur weg uit de hut "
    + "betekent rond half twaalf in Campo: tijd voor koffie én de bus van 14.45.",
  losdraad: {
    naam: "Bus Alpin vanaf Pian Geirett",
    tekst: "Lijn 135 rijdt in het hoogseizoen door tot Pian Geirett (1847 m), het eind van de weg in "
      + "Val Camadra — precies waar dag 4 na een klein uur langskomt. De bronnen spreken elkaar tegen "
      + "over september: Bus Alpin zet de Greina-lijn op dagelijks tot 27 september, de "
      + "dienstregeling van Autolinee Bleniesi op dagelijks tot eind augustus en daarna alleen zaterdag "
      + "en zondag. 15 september is een dinsdag, dus plan erop dat hij níét rijdt. Reserveren is "
      + "sowieso verplicht, tot een uur voor vertrek, via GreinaBus (+41 79 150 66 66) of SBB Mobile; "
      + "CHF 15 per persoon tot Pian Geirett."
  },
  checks: [
    { naam: "Dienstregeling 90.481 (Disentis–Lukmanier), jaar 2026",
      url: "https://widgets.oev-info.ch/publikation/jahresfpl/90.481.pdf" },
    { naam: "Orari Valle di Blenio 2026 (Autolinee Bleniesi, o.a. lijn 135)",
      url: "https://www.autolinee.ch/fileadmin/251214_Orari_VdBlenio_2026.pdf" },
    { naam: "PostAuto — de Lukmanierpasslijn",
      url: "https://www.postauto.ch/nl/uitstaptips/lijn-lukmanierpas" },
    { naam: "Campo (Blenio) → Curaglia opzoeken bij SBB",
      url: "https://www.sbb.ch/nl/kopen/pages/fahrplan/fahrplan.xhtml?von=Campo%20(Blenio)%2C%20Paese&nach=Curaglia%2C%20posta&datum=15.09.2026&zeit=12%3A00" }
  ]
};

/* Punten die geen etappe zijn maar wel op de kaart horen. Op dit moment
   staan de Terrihütte en de Greinapas allebei als tussenpunt op de route
   zelf, dus is deze lijst leeg — hij blijft staan voor wat er later bij
   komt (een bushalte, een bron, een hut die je alleen passeert). */
export const POI = [];
