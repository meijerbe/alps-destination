/* ------------------------------------------------------------------
   De huttentocht zelf: welke etappes er zijn, waar ze langsgaan en wat
   je verder over die dag wil weten.

   Een etappe is een rijtje benoemde `punten` — hut, alp, pas, beek —
   met hoogte erbij. De pagina trekt daar zelf een lijn doorheen
   (js/route-build.js), rekent afstand, stijgen en dalen uit, tekent het
   hoogteprofiel en schrijft er desgevraagd een GPX-bestand van om in
   komoot of swisstopo te openen.

   Een route toevoegen? Plak er hier een blok bij; meer is het niet.
   Heb je een échte opgenomen track, zet het GPX-bestand dan in routes/
   en geef `gpx: "routes/….gpx"` op — dat gaat vóór de punten, en dan
   komen afstand en profiel uit het bestand.

   `gepland` is wat de planning ervan maakte (komoot, boektijden);
   staat dat er niet, dan valt de pagina terug op haar eigen boektijd.
------------------------------------------------------------------- */

export const TOUR = {
  naam: "Greina — van hut naar hut",
  ondertitel: "Drie nachten boven de tweeduizend, dwars over de hoogvlakte",
  gebied: "Val Medel · Greina · Val Blenio",
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
    lat: 46.6405, lon: 8.9138,
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
    lat: 46.5942, lon: 9.0050,
    nacht: "2026-09-13",
    reservering: "6640678",
    personen: 2,
    status: "Bevestigd",
    site: "https://capannamotterascio.casticino.ch/",
    note: "Op de Alpe Motterascio, aan de zuidrand van de Greina — Ticino-kant van de waterscheiding."
  },
  {
    id: "scaletta",
    naam: "Capanna Scaletta",
    ook: "SAT Lucomagno",
    hoogte: 2205,
    lat: 46.6078, lon: 8.9403,
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
      { naam:"Curaglia, halte", ele:1329, lat:46.6733, lon:8.8568, type:"start", note:"Postauto vanaf Disentis/Mustér" },
      { naam:"Pardatsch, wandelparkeerplaats", ele:1391, lat:46.6690, lon:8.8790, note:"Laatste parkeerplek; hier begint Val Plattas" },
      { naam:"Val Plattas", ele:1600, lat:46.6620, lon:8.8890 },
      { naam:"Alp Sura", ele:1982, lat:46.6520, lon:8.9010, note:"Vlakte halverwege; hierna wordt het steiler" },
      { naam:"Slotklim", ele:2250, lat:46.6455, lon:8.9090, note:"Laatste ±500 hoogtemeters, hut in zicht" },
      { naam:"Medelserhütte SAC", ele:2524, lat:46.6405, lon:8.9138, type:"hut", note:"Op de Fuorcla da Lavaz" }
    ],
    van: "Curaglia",
    naar: "Medelserhütte",
    slaap: "medel",
    zwaarte: "T2",
    zwaarteNote: "bergwandelpad, wit-rood gemarkeerd",
    gepland: { afstand: "8 km", tijd: "3 u 30", stijgen: 1200, dalen: 0, bron: "boektijd van de hut" },
    heenweg: "Trein naar Disentis/Mustér, dan Postauto naar Curaglia (1329 m).",
    verhaal: "Aanloopdag. Vanuit het dorp meteen oostwaarts door de kloof Val Plattas in, "
      + "over de alpweg tot de brug bij Pardatsch, daarna smaller wordend langs de oostflank. "
      + "Na Alp Sura (1982 m) wordt het steil: de laatste ±500 hoogtemeters met de hut al in zicht.",
    let: "Ruim 1200 hoogtemeters met volle rugzak — begin op tijd, water is er onderweg genoeg."
  },
  {
    id: "d2",
    datum: "2026-09-13",
    bestand: "dag2-medelserhuette-motterascio",
    punten: [
      { naam:"Medelserhütte SAC", ele:2524, lat:46.6405, lon:8.9138, type:"hut" },
      { naam:"Alp Lavaz", ele:2270, lat:46.6440, lon:8.9330, note:"Uitgestrekte alp onder de hut" },
      { naam:"Val Lavaz omlaag", ele:2050, lat:46.6470, lon:8.9600 },
      { naam:"Val Sumvitg, laagste punt", ele:1875, lat:46.6500, lon:8.9850, note:"Beek oversteken; hierna weer omhoog" },
      { naam:"Klim naar Terri", ele:2050, lat:46.6420, lon:8.9980 },
      { naam:"Terrihütte SAC", ele:2170, lat:46.6344, lon:9.0051, type:"hut", note:"Bewaakt — de plek voor de middagpauze" },
      { naam:"Muot la Greina", ele:2220, lat:46.6230, lon:8.9980, note:"Rand van de hoogvlakte" },
      { naam:"Plaun la Greina", ele:2250, lat:46.6150, lon:8.9900, note:"De vlakte zelf, met de meanders van de Rein da Sumvitg" },
      { naam:"Crap la Crusch", ele:2268, lat:46.6040, lon:8.9880, type:"pass", note:"Brede zadel; links af, weg van de Greinapas" },
      { naam:"Alpe Motterascio", ele:2210, lat:46.5980, lon:8.9980 },
      { naam:"Capanna Motterascio CAS", ele:2171, lat:46.5942, lon:9.0050, type:"hut" }
    ],
    van: "Medelserhütte",
    naar: "Capanna Motterascio",
    slaap: "motterascio",
    zwaarte: "T3",
    zwaarteNote: "veeleisend bergwandelpad; korte blootgestelde stukken",
    gepland: { afstand: "18,5 km", tijd: "8 u 18", stijgen: 1080, dalen: 1350, bron: "komoot-planning" },
    verhaal: "De lange dag. Eerst omlaag over de uitgestrekte Alp Lavaz, dieper Val Sumvitg in tot het "
      + "laagste punt rond 1875 m, en dan weer omhoog naar de Terrihütte — dé plek voor de middagpauze. "
      + "Daarna om Muot la Greina heen de hoogvlakte op: Plaun la Greina met de meanders van de Rein da Sumvitg, "
      + "vlak vóór de Greinapas linksaf over Crap la Crusch (2268 m) en zo naar de Alpe Motterascio.",
    let: "Twee keer flink klimmen na een lange afdaling. De boektijden tellen op tot ±7 uur, komoot houdt "
      + "8 u 18 aan — plan de pauze bij de Terrihütte en beslis dáár of je doorgaat of blijft.",
    tip: "De hoge variant over de Fuorcla Sura da Lavaz (2703 m) is korter maar wit-blauw-wit en gaat over "
      + "de resten van de Lavaz-gletsjer. Niet met een volle rugzak en niet zonder goede omstandigheden."
  },
  {
    id: "d3",
    datum: "2026-09-14",
    bestand: "dag3-motterascio-scaletta",
    punten: [
      { naam:"Capanna Motterascio CAS", ele:2171, lat:46.5942, lon:9.0050, type:"hut" },
      { naam:"Alpe Motterascio", ele:2210, lat:46.5985, lon:8.9985, note:"Drassig; metalen trapje over de beek" },
      { naam:"Crap la Crusch", ele:2268, lat:46.6040, lon:8.9880 },
      { naam:"Bronnen van de Rein", ele:2300, lat:46.6090, lon:8.9750, note:"Langs de bovenloop omhoog naar de pas" },
      { naam:"Passo della Greina", ele:2355, lat:46.6125, lon:8.9606, type:"pass", note:"Pass Crap — waterscheiding Rijn/Ticino" },
      { naam:"Afdaling westzijde", ele:2280, lat:46.6105, lon:8.9500 },
      { naam:"Capanna Scaletta", ele:2205, lat:46.6078, lon:8.9403, type:"hut", note:"Puntdak, rode luiken" }
    ],
    van: "Capanna Motterascio",
    naar: "Capanna Scaletta",
    slaap: "scaletta",
    zwaarte: "T2",
    zwaarteNote: "bergwandelpad over de hoogvlakte",
    gepland: { afstand: "±9 km", tijd: "±3 u 30", stijgen: 350, dalen: 320, bron: "schatting op de landkaart" },
    verhaal: "Korte dag, en de mooiste kilometers van de tocht. Over de Alpe Motterascio (drassig, een metalen "
      + "trapje over de beek) naar de brede zadel Crap la Crusch, dan langs de bovenloop van de Rein omhoog naar "
      + "de Passo della Greina (2355 m). Vanaf de pas omlaag naar de Scaletta, met de hele Greina in de rug.",
    let: "Weinig hoogteverschil, maar volledig open en boven de boomgrens: bij onweer is er nergens te schuilen. "
      + "Vroeg weg als er buien in de verwachting staan.",
    tip: "Tijd over? Vanaf de pas is de Greina-vlakte zelf een uitstapje waard, of loop een lus terug over de noordrand."
  },
  {
    id: "d4",
    datum: "2026-09-15",
    bestand: "dag4-scaletta-pian-geirett",
    punten: [
      { naam:"Capanna Scaletta", ele:2205, lat:46.6078, lon:8.9403, type:"hut" },
      { naam:"Afdaling Val Camadra", ele:2050, lat:46.6020, lon:8.9330 },
      { naam:"Pian Geirett", ele:1890, lat:46.5975, lon:8.9270, type:"finish", note:"Eind van de weg in Val Camadra; bus in het hoogseizoen" }
    ],
    van: "Capanna Scaletta",
    naar: "Pian Geirett",
    zwaarte: "T2",
    zwaarteNote: "afdaling over een gemarkeerd pad",
    gepland: { afstand: "±3 km", tijd: "1 u", stijgen: 20, dalen: 330, bron: "hutbeschrijving" },
    verhaal: "Uitlopen. In een uurtje omlaag naar Pian Geirett (±1890 m), het eind van de weg in Val Camadra.",
    let: "Hier is geen bed geboekt — dit is de dag dat we eruit lopen. Check de bus vóór je vertrekt: in het "
      + "hoogseizoen rijdt er een buslijn vanaf Pian Geirett naar Ghirone, daarbuiten is het nog zo'n twee uur "
      + "langs de weg naar beneden, richting Ghirone, Campo Blenio en Olivone.",
    terugweg: "Vanaf Olivone rijdt het Postauto naar Biasca; daar op de trein."
  }
];

/* Punten die geen etappe zijn maar wel op de kaart horen. */
export const POI = [
  {
    naam: "Terrihütte SAC", ook: "Camona da Terri", hoogte: 2170,
    lat: 46.6344, lon: 9.0051, type: "hut-extra",
    note: "Bewaakt, aan het eind van Val Sumvitg. De pauzeplek van dag 2.",
    site: "https://terrihuette.ch/"
  },
  {
    naam: "Passo della Greina", ook: "Pass Crap", hoogte: 2355,
    lat: 46.6125, lon: 8.9606, type: "pas",
    note: "Waterscheiding: alles ten noorden gaat naar de Rijn, alles ten zuiden naar de Ticino."
  }
];
