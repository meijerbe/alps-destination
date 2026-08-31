/* ==================================================================
   Bestemmingen, weging, metrieken
   `drive` = rijtijd vanaf Mayrhofen in uren (schatting),
   `side`  = welke kant van de hoofdkam (informatief).
================================================================== */
export const REGIONS = [
  {n:"Zillertal",         r:"Tirol",            c:"AT", lat:47.20, lon:11.85, drive:0,   side:"noord",       base:true},
  {n:"Tirol Unterland", s:"Unterland",   r:"Kaisergebirge",    c:"AT", lat:47.52, lon:12.20, drive:1,   side:"noord"},
  {n:"Ötztal",            r:"Tirol",            c:"AT", lat:46.97, lon:11.00, drive:1.5, side:"noord"},
  {n:"Hohe Tauern",       r:"Pinzgau",          c:"AT", lat:47.20, lon:12.70, drive:1.5, side:"noord"},
  {n:"Eisacktal",         r:"Südtirol",         c:"IT", lat:46.68, lon:11.50, drive:1.5, side:"zuid"},
  {n:"Arlberg–Lechtal", s:"Arlberg",   r:"Tirol",            c:"AT", lat:47.20, lon:10.25, drive:2,   side:"noord"},
  {n:"Vinschgau",         r:"Südtirol",         c:"IT", lat:46.65, lon:10.72, drive:2.5, side:"zuid"},
  {n:"Osttirol",          r:"Karnische Alpen",  c:"AT", lat:46.83, lon:12.72, drive:2.5, side:"zuid"},
  {n:"Rätikon",           r:"Vorarlberg",       c:"AT", lat:47.10, lon:9.85,  drive:2.5, side:"noord"},
  {n:"Salzkammergut", s:"Salzkammer.",     r:"Dachstein",        c:"AT", lat:47.55, lon:13.60, drive:2.5, side:"noord"},
  {n:"Unterengadin",      r:"Graubünden",       c:"CH", lat:46.80, lon:10.28, drive:3,   side:"inneralpine"},
  {n:"Dolomieten",        r:"Belluno",          c:"IT", lat:46.45, lon:12.05, drive:3.5, side:"zuid"},
  {n:"Alta Valtellina", s:"Livigno",   r:"Livigno",          c:"IT", lat:46.50, lon:10.20, drive:3.5, side:"inneralpine"},
  {n:"Niedere Tauern", s:"N. Tauern",    r:"Steiermark",       c:"AT", lat:47.30, lon:14.20, drive:3.5, side:"noord"},
  {n:"Oberengadin",       r:"Graubünden",       c:"CH", lat:46.45, lon:9.80,  drive:4,   side:"inneralpine"},
  {n:"Surselva",          r:"Graubünden",       c:"CH", lat:46.72, lon:9.10,  drive:4,   side:"inneralpine"},
  {n:"Karawanken",        r:"Kärnten",          c:"AT", lat:46.60, lon:13.85, drive:4,   side:"zuid"},
  {n:"Ticino",            r:"Tessin",           c:"CH", lat:46.30, lon:8.80,  drive:4.5, side:"zuid"},
  {n:"Valtellina",        r:"Sondrio",          c:"IT", lat:46.15, lon:9.85,  drive:4.5, side:"zuid"},
  {n:"Zentralschweiz", s:"Zentralschw.",    r:"Uri",              c:"CH", lat:46.80, lon:8.55,  drive:4.5, side:"noord"},
  {n:"Julische Alpen", s:"Julische",    r:"Gorenjska",        c:"SI", lat:46.42, lon:13.75, drive:5,   side:"zuid"},
  {n:"Semmering",         r:"Niederösterreich", c:"AT", lat:47.62, lon:15.45, drive:5,   side:"noord"},
  {n:"Berner Oberland", s:"Berner Obl.",   r:"Bern",             c:"CH", lat:46.55, lon:7.90,  drive:5,   side:"noord"},
  {n:"Wallis",            r:"Valais",           c:"CH", lat:46.20, lon:7.60,  drive:6,   side:"inneralpine"},
  {n:"Valle d'Aosta", s:"Aosta",     r:"Aosta",            c:"IT", lat:45.75, lon:7.40,  drive:6,   side:"zuid"},
  {n:"Chablais",          r:"Haute-Savoie",     c:"FR", lat:46.05, lon:6.45,  drive:6.5, side:"noord"},
  {n:"Mont Blanc",        r:"Chamonix",         c:"FR", lat:45.90, lon:6.85,  drive:7,   side:"noord"},
  {n:"Vanoise",           r:"Tarentaise",       c:"FR", lat:45.45, lon:6.75,  drive:7.5, side:"inneralpine"},
  {n:"Écrins",            r:"Briançonnais",     c:"FR", lat:44.85, lon:6.45,  drive:8,   side:"zuid"},
  {n:"Vercors",           r:"Isère",            c:"FR", lat:45.15, lon:5.75,  drive:8,   side:"noord"},
  {n:"Cuneese",           r:"Piemonte",         c:"IT", lat:44.55, lon:7.25,  drive:8.5, side:"zuid"},
  {n:"Mercantour",        r:"Alpes-Maritimes",  c:"FR", lat:44.15, lon:7.05,  drive:9.5, side:"zuid"}
];

/* Grove omtrek van de Alpenboog (lon, lat), met de klok mee vanaf Nice.
   Schematisch: goed genoeg om de rasterkaart op te knippen, geen grens. */
export const ARC = [
  [7.30,43.72],[6.85,44.10],[6.10,44.55],[5.60,44.85],[5.45,45.25],[5.60,45.55],[5.85,45.90],[6.05,46.20],
  [6.75,46.55],[7.35,46.75],[8.00,46.95],[8.60,47.05],[9.30,47.25],[9.75,47.50],[10.30,47.60],[11.10,47.65],
  [11.60,47.70],[12.20,47.75],[12.90,47.80],[13.60,47.85],[14.40,47.85],[15.20,47.90],[15.90,47.85],
  [16.10,47.55],[15.90,47.10],[15.30,46.75],[14.80,46.45],[14.30,46.15],[13.80,46.10],[13.30,46.15],
  [12.60,46.10],[12.00,46.00],[11.40,45.85],[10.90,45.75],[10.55,45.75],[10.20,45.85],[9.70,45.85],
  [9.30,45.85],[8.90,45.90],[8.55,45.85],[8.20,45.70],[7.95,45.55],[7.70,45.25],[7.40,44.95],[7.25,44.55],
  [7.35,44.15]
];
export const GEO = {lon0:5.30, lon1:16.30, lat0:43.60, lat1:48.00, latStep:0.07, k:Math.cos(45.8*Math.PI/180), px:100};

export const WEIGHTS = {
  bike:  {dry:.34, prob:.18, sun:.20, wind:.18, temp:.10, snow:.00},
  hike:  {dry:.34, prob:.18, sun:.18, wind:.06, temp:.10, snow:.14},
  chill: {dry:.26, prob:.16, sun:.28, wind:.08, temp:.22, snow:.00}
};

export const PROFILE_LABEL = {bike:"Racefiets", hike:"Hiken", chill:"Meer"};

// volgorde en kleur van de opbouwbalk
export const PARTS = [
  {k:"dry",  label:"droogte",     c:"#E0742F"},
  {k:"prob", label:"neerslagkans",c:"#C9924F"},
  {k:"sun",  label:"zon",         c:"#E8B33C"},
  {k:"wind", label:"wind",        c:"#6E97A6"},
  {k:"temp", label:"temperatuur", c:"#C4553A"},
  {k:"snow", label:"vriespunt",   c:"#2E7EA0"}
];

export const PROFILES = Object.keys(WEIGHTS);
export const COUNTRY = {AT:"Oostenrijk", IT:"Italië", CH:"Zwitserland", FR:"Frankrijk", SI:"Slovenië"};
export const driveTxt = p => p.drive===0 ? "basis" : p.drive+" u rijden";
