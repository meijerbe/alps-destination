/* ==================================================================
   Trailrun: de wedstrijden en de knoppen van het rekenmodel.

   De afstanden en hoogtemeters komen van de officiële streckenpagina
   van Mayrhofen Ultraks Zillertal (editie 2026). Ze staan hier als
   startwaarde, niet als waarheid: elke wedstrijd is in de app zelf
   bij te stellen, want organisatoren schuiven nog wel eens met een
   route en de GPX telt vaak nét iets anders dan de folder.
================================================================== */

export const RACES = [
  {id:"rk50",  n:"RK50",  sub:"de lange lus",  dist:50.5, gain:3200, start:"07:00"},
  {id:"muz30", n:"MUZ30", sub:"Golden Trail",  dist:30.3, gain:2000, start:"08:30"},
  {id:"muz14", n:"MUZ14", sub:"Stillupklamm",  dist:14.5, gain:900,  start:"10:15"}
];
export const raceById = id => RACES.find(r => r.id === id) || RACES[1];

/* Hoeveel vlakke kilometers kost 100 hoogtemeter? De vuistregel op de trail
   is 1 km per 100 hm; hij zit er voor een goede klimmer te hoog en voor een
   vlaklandloper te laag in, dus het is een knop en geen constante. */
export const CLIMB = [
  {id:"licht",  cost:125, lab:"100 hm ≈ 0,8 km", note:"je loopt klimmen goed weg"},
  {id:"normaal", cost:100, lab:"100 hm ≈ 1 km",  note:"de gangbare vuistregel"},
  {id:"zwaar",  cost:75,  lab:"100 hm ≈ 1,3 km", note:"steil en technisch, je gaat wandelen"}
];
export const climbById = id => CLIMB.find(c => c.id === id) || CLIMB[1];

/* Riegel-exponent: hoeveel langzamer je per kilometer wordt als de afstand
   groeit. 1.06 komt van de baan (Riegel, 1977) en houdt alleen stand met een
   flinke duurbasis eronder; zonder lange duurlopen loopt het richting 1.15. */
export const DUUR = [
  {id:"veel",      exp:1.06, lab:"veel lange duur", note:"regelmatig 3 uur of langer op pad"},
  {id:"gemiddeld", exp:1.10, lab:"gemiddeld",       note:"af en toe een lange training"},
  {id:"weinig",    exp:1.15, lab:"weinig",          note:"vooral korte, snelle trainingen"}
];
export const duurById = id => DUUR.find(d => d.id === id) || DUUR[1];

/* Ondergrond van de referentieloop. Een kilometer asfalt is geen kilometer
   bergpad, ook niet als hij vlak is: los grind, stenen en wortels kosten tijd
   die geen enkele hoogtemeter verklaart. De factor rekent de referentie om
   naar het terrein van Mayrhofen, dus een bergtrail als referentie kost niets. */
export const GROND = [
  {id:"weg",    f:1.12, lab:"weg of vlak pad", note:"asfalt, fietspad, baan"},
  {id:"heuvel", f:1.06, lab:"bos- en heuvelpad", note:"onverhard, niet technisch"},
  {id:"berg",   f:1.00, lab:"bergtrail",        note:"vergelijkbaar met Mayrhofen"}
];
export const grondById = id => GROND.find(g => g.id === id) || GROND[1];

/* Techniek: durf je te dalen, en wat doen 2000 hoogtemeter met je benen. Kost
   tijd én maakt de voorspelling onzekerder, dus deze knop raakt allebei. */
export const TECH = [
  {id:"veel",      f:0.95, extra:0,    lab:"ervaren in de bergen", note:"daalt vrijuit, weet wat 2000 hm doet"},
  {id:"gemiddeld", f:1.00, extra:0.01, lab:"gemiddeld",            note:"loopt trails, geen specialist"},
  {id:"weinig",    f:1.07, extra:0.04, lab:"vooral vlak/weg",      note:"remt op de afdaling, ongewisse uitkomst"}
];
export const techById = id => TECH.find(t => t.id === id) || TECH[1];

/* Snelkeuzes voor de referentieprestatie — scheelt op de telefoon het
   opzoeken van afstand en hoogtemeters van een bekende loop. */
export const PRESETS = [
  {id:"10k",   lab:"10 km vlak",        dist:10,   gain:60},
  {id:"10trail", lab:"10 km heuvel",    dist:10,   gain:350},
  {id:"hm",    lab:"halve marathon",    dist:21.1, gain:80},
  {id:"marathon", lab:"marathon",       dist:42.2, gain:150},
  {id:"trail25", lab:"trail 25 km",     dist:25,   gain:1200},
  {id:"muz30",  lab:"MUZ30 eerder",     dist:30.3, gain:2000},
  {id:"rk50",   lab:"RK50 eerder",      dist:50.5, gain:3200}
];
