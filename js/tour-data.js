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
      { naam:"Curaglia, halte", ele:1267, lat:46.67556, lon:8.85569, type:"start", note:"Postauto vanaf Disentis/Mustér" },
      { naam:"Alp Sura", ele:1962, lat:46.64889, lon:8.88953, note:"Vlakte halverwege; hierna wordt het steil" },
      { naam:"Medelserhütte SAC", ele:2524, lat:46.64005, lon:8.91044, type:"hut", note:"Op de Fuorcla da Lavaz" }
    ],
    van: "Curaglia",
    naar: "Medelserhütte",
    slaap: "medel",
    zwaarte: "T2",
    zwaarteNote: "bergwandelpad, wit-rood gemarkeerd",
    gepland: { tijd: "3 u 32", bron: "komoot" },
    heenweg: "Trein naar Disentis/Mustér, dan Postauto naar Curaglia.",
    verhaal: "Aanloopdag, en meteen de steilste van de vier: vanuit het dorp oostwaarts door de kloof "
      + "Val Plattas in, over de alpweg langs de brug bij Pardatsch (de laatste parkeerplek) en dan "
      + "smaller wordend langs de oostflank. Na Alp Sura wordt het steil, met de hut al in zicht.",
    let: "Ruim elfhonderd hoogtemeters met volle rugzak, en niets ertussen om af te breken — begin op tijd."
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
    let: "Hier is geen bed geboekt — dit is de dag dat we eruit lopen. Check de terugreis vóór je vertrekt: "
      + "vanaf Pian Geirett rijdt in het hoogseizoen een bus, maar half september kan dat al over zijn, en "
      + "dan zijn het nog twee uur langs de weg.",
    terugweg: "Vanaf Campo (Blenio) rijdt het Postauto via Olivone naar Biasca; daar op de trein."
  }
];

/* Punten die geen etappe zijn maar wel op de kaart horen. Op dit moment
   staan de Terrihütte en de Greinapas allebei als tussenpunt op de route
   zelf, dus is deze lijst leeg — hij blijft staan voor wat er later bij
   komt (een bushalte, een bron, een hut die je alleen passeert). */
export const POI = [];
