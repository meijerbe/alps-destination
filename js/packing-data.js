/* ---------- paklijst: de inhoud, los van de logica die 'm rendert ---------- */
export const PACK = [
  {g:"Papieren & auto", items:[
    {t:"Paspoort of ID, rijbewijs, verzekeringspapieren"},
    {t:"Vignet Oostenrijk", why:()=>"vertrek en transit door AT"},
    {t:"Vignet Zwitserland (jaarvignet, 40 CHF)", when:c=>c.countries.has("CH"), why:c=>`${c.top.n} ligt in Zwitserland`},
    {t:"Contant geld voor Italiaanse tol", when:c=>c.countries.has("IT"), why:c=>`${c.top.n} ligt in Italië`},
    {t:"Vignet Slovenië", when:c=>c.countries.has("SI"), why:c=>`${c.top.n} ligt in Slovenië`},
    {t:"Fietsdrager, sleutel en extra spanband", when:c=>c.profile==="bike"},
    {t:"Reservelamp, gevarendriehoek, veiligheidshesjes (verplicht in IT/FR)"},
    {t:"Check winterbanden of kettingen", when:c=>c.minFrz<2100, why:c=>`vriespunt zakt tot ${Math.round(c.minFrz)} m`}
  ]},
  {g:"Kamp & slapen", items:[
    {t:"Tent, stokken, haringen, grondzeil"},
    {t:"Hamer en een paar reserveharingen"},
    {t:"Reparatieset voor tent en slaapmat (tape, plakkers)"},
    {t:"Slaapmat en slaapzak"},
    {t:"Kussen of opblaaskussen"},
    {t:"Extra deken of liner", when:c=>c.minTemp<15, why:c=>`koudste dag komt niet boven ${Math.round(c.minTemp)} °C`},
    {t:"Stormharingen en extra scheerlijnen", when:c=>c.maxWind>=30, why:c=>`wind tot ${Math.round(c.maxWind)} km/u`},
    {t:"Luifel of tarp voor de natte uurtjes", when:c=>c.maxRain>=4, why:c=>`natste dag ${c.maxRain.toFixed(1)} mm`},
    {t:"Hoofdlamp en reservebatterijen"},
    {t:"Campingstoel, tafeltje, waslijn"},
    {t:"Touw of paracord, wasknijpers"},
    {t:"Oordopjes"}
  ]},
  {g:"Kleding", personal:true, items:[
    {t:"Ondergoed en sokken voor de hele reis"},
    {t:"Nachtkleding"},
    {t:"Dagelijkse schoenen, naast de technische schoenen"},
    {t:"Lange broek en een warme trui voor 's avonds"},
    {t:"Regenjas"},
    {t:"Regenbroek en waterdichte schoenhoezen", when:c=>c.maxRain>=4, why:c=>`${c.wetDays} van ${c.n} dagen boven 2 mm`},
    {t:"Warme mid-layer of donsjas", when:c=>c.minTemp<17 || c.minFrz<2500, why:c=>`vriespunt tot ${Math.round(c.minFrz)} m`},
    {t:"Muts, buff en handschoenen", when:c=>c.minFrz<2400, why:c=>`sneeuwgrens rond ${Math.round(c.minFrz)} m`},
    {t:"Zonnebril, pet, zonnebrand factor 50", when:c=>c.sunAvg>=6, why:c=>`gemiddeld ${c.sunAvg.toFixed(1)} zonuren per dag`},
    {t:"Lichte shirts en korte broek", when:c=>c.maxTemp>=24, why:c=>`tot ${Math.round(c.maxTemp)} °C`},
    {t:"Slippers en iets schoons voor 's avonds"}
  ]},
  {g:"Op de fiets", when:c=>c.profile==="bike", personal:true, items:[
    {t:"Helm, fietsschoenen, twee bidons"},
    {t:"Reserveband, plakset, banden­lichters, mini-pomp"},
    {t:"Kettingolie, multitool, extra derailleurhanger"},
    {t:"Windjack en armstukken voor de afdalingen", why:c=>`boven 2000 m is het snel ${Math.round(c.minTemp-12)} °C`},
    {t:"Beenstukken", when:c=>c.minFrz<2600, why:c=>`koude lucht tot ${Math.round(c.minFrz)} m`},
    {t:"Fietscomputer, lader, routes offline gezet"},
    {t:"Achterlicht — verplicht in tunnels en galerijen"}
  ]},
  {g:"Op pad", when:c=>c.profile==="hike", personal:true, items:[
    {t:"Wandelschoenen ingelopen, wandelstokken"},
    {t:"Dagrugzak 25–30 l met regenhoes"},
    {t:"Kaart en GPX offline, kompas"},
    {t:"Microspikes of stijgijzers", when:c=>c.minFrz<2500, why:c=>`sneeuwresten boven ${Math.round(c.minFrz)} m`},
    {t:"Thermoskan en lunchpakket"},
    {t:"Alpenvereinlidmaatschap of hutreserveringen"}
  ]},
  {g:"Trailrunnen", when:c=>c.profile==="hike", personal:true, items:[
    {t:"Trailrunschoenen, ingelopen"},
    {t:"Hardloopvest met drinkblazen of flesjes"},
    {t:"Hardloopkleding die vocht afvoert, geen katoen"},
    {t:"Antichafing balsem of vaseline"},
    {t:"GPS-horloge, opgeladen"},
    {t:"Energiegels, zout of elektrolyten voor de lange afstand"},
    {t:"Vouwbekertje voor de bevoorradingsposten"},
    {t:"Windjack in het vest, ook bij zon", why:c=>`boven 2000 m is het snel ${Math.round(c.minTemp-12)} °C`}
  ]},
  {g:"Aan het water", when:c=>c.profile==="chill", personal:true, items:[
    {t:"Zwemkleding, snel drogende handdoek"},
    {t:"Waterschoenen — bergmeren zitten vol keien"},
    {t:"Koelbox of koeltas", when:c=>c.maxTemp>=24, why:c=>`tot ${Math.round(c.maxTemp)} °C`},
    {t:"Boek, spel, hangmat"},
    {t:"Muggenspul voor de avond bij het water"}
  ]},
  {g:"Eten & koken", items:[
    {t:"Brander, gasfles, aansteker"},
    {t:"Pannenset, bestek, snijplank, mes"},
    {t:"Koffiezetter en voorraad koffie"},
    {t:"Ontbijt voor de eerste ochtend, snacks voor onderweg"},
    {t:"Waterzak of jerrycan, afwasspullen"}
  ]},
  {g:"Elektronica", items:[
    {t:"Telefoon, lader, 12V-adapter"},
    {t:"Powerbank"},
    {t:"Adapter type J", when:c=>c.countries.has("CH"), why:()=>"Zwitserse stopcontacten nemen niet elke geaarde stekker"},
    {t:"Offline kaarten en deze pagina gebookmarkt"}
  ]},
  {g:"EHBO & klein", items:[
    {t:"EHBO-set, pleisters, tape, pijnstiller"},
    {t:"Europese zorgpas (EHIC)"},
    {t:"Reddingsdeken en fluitje"},
    {t:"Muggenspray en aftersun"},
    {t:"Vuilniszakken — alles gaat mee terug"}
  ]}
];
