// Nagebouwde supabase-js, geserveerd in plaats van de echte CDN-bundel.
//
// Belangrijk: hij bootst ook de dingen na waar we ooit op stukliepen —
// een `generated always as identity`-kolom weigert een expliciete id (428C9),
// een upsert schrijft alleen de meegestuurde kolommen, en je eigen insert
// echoot meteen terug via Realtime. Zonder die scherpe randjes toetst een
// stub alleen of de code zichzelf leuk vindt.
export const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js";

export const STUB = `
(function(){
  const tables = {};
  const T = n => (tables[n] ||= new Map());
  const nextId = { packing_state:1, packing_custom_items:1, shopping_items:1, race_runners:1 };
  const pk = (t,r) => t === "packing_state" ? r.trip+"|"+r.item_key+"|"+r.scope : String(r.id);
  const subs = [];

  window.__tables = tables;
  window.__upserts = [];
  window.__failNext = null;          // zet op een {message, code} om één call te laten falen
  window.__seed = row => { const t = row.__table; delete row.__table; T(t).set(pk(t,row), row); };
  window.__fire = (table, eventType, row, old) =>
    subs.filter(s => s.table === table).forEach(s => s.cb({eventType, new: row||{}, old: old||{}}));

  function fail(resolve){
    if(!window.__failNext) return false;
    const e = window.__failNext; window.__failNext = null;
    resolve({data:null, error:e});
    return true;
  }

  function query(table){
    const q = {_eq:{}};
    q.select = function(){ return this; };
    q.eq = function(c,v){ this._eq[c] = v; return this; };
    q.order = function(){ return this; };
    q.single = function(){ this._single = true; return this; };
    q.then = function(resolve){
      if(fail(resolve)) return;
      let rows = [...T(table).values()];
      Object.entries(this._eq).forEach(([c,v]) => { rows = rows.filter(r => String(r[c]) === String(v)); });
      resolve(this._single ? {data:rows[0]||null, error:null} : {data:rows, error:null});
    };
    return q;
  }

  window.supabase = { createClient(url, key){
    window.__client = {url, key};
    return {
      from(table){ return {
        select(){ return query(table); },
        insert(row){
          const b = query(table);
          b.then = function(resolve){
            if(fail(resolve)) return;
            const stored = {...row, id: nextId[table]++};
            T(table).set(pk(table, stored), stored);
            window.__fire(table, "INSERT", stored);       // echo vóór onze eigen await
            resolve({data: this._single ? stored : [stored], error:null});
          };
          return b;
        },
        update(patch){
          return {
            eq(col, val){
              return {
                then(resolve){
                  if(fail(resolve)) return;
                  const row = [...T(table).values()].find(r => String(r[col]) === String(val));
                  if(!row){ resolve({error:{message:"not found"}}); return; }
                  Object.assign(row, patch);
                  window.__fire(table, "UPDATE", row);
                  resolve({error:null});
                }
              };
            }
          };
        },
        delete(){
          return {
            eq(col, val){
              return {
                then(resolve){
                  if(fail(resolve)) return;
                  const row = [...T(table).values()].find(r => String(r[col]) === String(val));
                  if(row){ T(table).delete(pk(table,row)); window.__fire(table, "DELETE", null, row); }
                  resolve({error:null});
                }
              };
            }
          };
        },
        upsert(rowOrRows){
          return {
            then(resolve){
              if(fail(resolve)) return;
              const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
              window.__upserts.push(rows);
              for(const row of rows){
                if(Object.prototype.hasOwnProperty.call(row, "id")){
                  resolve({error:{message:'cannot insert a non-DEFAULT value into column "id"', code:"428C9"}});
                  return;
                }
                const key = pk(table, row), prev = T(table).get(key);
                // PostgREST zet alléén de meegestuurde kolommen
                T(table).set(key, {...prev, ...row, id: prev ? prev.id : nextId[table]++});
                window.__fire(table, "UPDATE", T(table).get(key));
              }
              resolve({error:null});
            }
          };
        }
      };},
      channel(){
        return {
          on(_e, opts, cb){ subs.push({table: opts.table, cb}); return this; },
          subscribe(){ window.__subscribed = true; return this; }
        };
      }
    };
  }};
})();`;

/** Serveer de nagebouwde client in plaats van de echte CDN-bundel. */
export async function mockSupabase(page) {
  await page.route(SUPABASE_CDN, r =>
    r.fulfill({ status: 200, contentType: "application/javascript", body: STUB }));
}

/** Laat de CDN-bundel mislukken, zodat de app terugvalt op localStorage. */
export async function withoutSupabase(page) {
  await page.route("https://cdn.jsdelivr.net/**", r => r.abort());
}
