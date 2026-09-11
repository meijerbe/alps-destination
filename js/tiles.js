/* ------------------------------------------------------------------
   Welke kaarttegels horen bij deze tocht?

   Om de kaart offline mee te kunnen nemen moeten we van tevoren weten
   wélke tegels we nodig hebben. Niet het hele vierkant om de route —
   dat zijn er algauw duizenden, en negen van de tien liggen op een berg
   waar we niet komen — maar een strook langs de lijn: elke tegel waar
   de route doorheen loopt, plus een rand eromheen.

   Rekenen in het standaard slippy-map-raster (Web Mercator, XYZ), dus
   dit geldt net zo goed voor swisstopo als voor OpenTopoMap.
------------------------------------------------------------------- */

/* lon/lat → tegelcoördinaat op zoomniveau z. */
export function tegelVan(lon, lat, z){
  const n = 2 ** z;
  const x = Math.floor((lon + 180) / 360 * n);
  const lr = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(lr) + 1 / Math.cos(lr)) / Math.PI) / 2 * n);
  return { x: Math.min(n - 1, Math.max(0, x)), y: Math.min(n - 1, Math.max(0, y)), z };
}

/* Hoe breed is een tegel op deze zoom, in meters op deze breedtegraad? */
export function tegelBreedte(z, lat = 46.6){
  return 40075016.686 * Math.cos(lat * Math.PI / 180) / 2 ** z;
}

/* De strook tegels langs een route. `marge` is het aantal tegels rondom;
   1 betekent op z15 ongeveer een kilometer aan weerszijden. */
export function tegelsLangs(points, zooms = [12, 13, 14, 15], marge = 1){
  const uit = new Map();
  for(const z of zooms){
    const n = 2 ** z;
    for(const p of points){
      const t = tegelVan(p.lon, p.lat, z);
      for(let dy = -marge; dy <= marge; dy++){
        for(let dx = -marge; dx <= marge; dx++){
          const x = t.x + dx, y = t.y + dy;
          if(x < 0 || y < 0 || x >= n || y >= n) continue;
          uit.set(`${z}/${x}/${y}`, { z, x, y });
        }
      }
    }
  }
  return [...uit.values()];
}

/* {z}/{x}/{y} in een tegel-URL invullen. */
export const tegelUrl = (sjabloon, { z, x, y }) =>
  sjabloon.replace("{z}", z).replace("{x}", x).replace("{y}", y)
    .replace("{s}", "a");     // sommige sjablonen hebben een subdomein-plaats

/* Ruwe schatting van hoe groot dat wordt. Een topografische tegel is in de
   praktijk 15–25 kB; we rekenen met 20 en zeggen er "ongeveer" bij. */
export const schatBytes = aantal => aantal * 20 * 1024;

export function leesbaarBytes(b){
  if(b < 1024 * 1024) return `${Math.round(b / 1024)} kB`;
  return `${(b / (1024 * 1024)).toFixed(b > 10 * 1024 * 1024 ? 0 : 1).replace(".", ",")} MB`;
}
