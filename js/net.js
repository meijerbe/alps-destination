/* Kleine fetch-met-terugval, gedeeld door weather.js (forecast) en
   historical.js (archiefdata) — vandaar los, zodat geen van beide op de
   ander hoeft te leunen. */
export async function getJSON(url, tries = 3){
  for(let attempt = 1; ; attempt++){
    try{
      const res = await fetch(url, {signal: AbortSignal.timeout(15000)});
      if(!res.ok) throw new Error("Open-Meteo antwoordde met status " + res.status);
      return await res.json();
    }catch(err){
      if(attempt >= tries) throw err;
      await new Promise(r => setTimeout(r, 400 * 2 ** (attempt - 1)));
    }
  }
}
