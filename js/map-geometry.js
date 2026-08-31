/* ------------------------------------------------------------------
   Kaartgeometrie. De Alpenboog wordt als raster van vierkante cellen
   opgedeeld; elke cel gaat naar de dichtstbijzijnde regio (Voronoi).
   Eén keer berekend, daarna verandert alleen de kleur.
------------------------------------------------------------------- */
import { REGIONS, ARC, GEO } from "./regions.js";

const prj = (lon,lat) => [ (lon-GEO.lon0)*GEO.k*GEO.px, (GEO.lat1-lat)*GEO.px ];

function inArc(lon,lat){
  let inside = false;
  for(let i=0, j=ARC.length-1; i<ARC.length; j=i++){
    const [xi,yi]=ARC[i], [xj,yj]=ARC[j];
    if((yi>lat) !== (yj>lat) && lon < (xj-xi)*(lat-yi)/(yj-yi)+xi) inside = !inside;
  }
  return inside;
}

export const MAP = (()=>{
  const latStep = GEO.latStep, lonStep = latStep/GEO.k;
  const cols = Math.ceil((GEO.lon1-GEO.lon0)/lonStep);
  const rows = Math.ceil((GEO.lat1-GEO.lat0)/latStep);
  const cw = lonStep*GEO.k*GEO.px, ch = latStep*GEO.px;      // even breed als hoog
  const owner = new Int16Array(cols*rows).fill(-1);
  const cen = REGIONS.map(r=>prj(r.lon,r.lat));
  const f1 = v => +v.toFixed(1);

  for(let ry=0; ry<rows; ry++){
    const lat = GEO.lat1 - (ry+0.5)*latStep;
    for(let cx=0; cx<cols; cx++){
      const lon = GEO.lon0 + (cx+0.5)*lonStep;
      if(!inArc(lon,lat)) continue;
      const X=(lon-GEO.lon0)*GEO.k*GEO.px, Y=(GEO.lat1-lat)*GEO.px;
      let best=-1, bd=Infinity;
      for(let i=0;i<cen.length;i++){
        const dx=cen[i][0]-X, dy=cen[i][1]-Y, d=dx*dx+dy*dy;
        if(d<bd){ bd=d; best=i; }
      }
      owner[ry*cols+cx]=best;
    }
  }
  const own = (c,r) => (c<0||r<0||c>=cols||r>=rows) ? -1 : owner[r*cols+c];

  // horizontale runs: scheelt duizenden losse rects
  const runs=[];
  for(let ry=0; ry<rows; ry++){
    let cx=0;
    while(cx<cols){
      const o=own(cx,ry);
      if(o<0){ cx++; continue; }
      let e=cx; while(own(e+1,ry)===o) e++;
      runs.push({r:o, x:f1(cx*cw), y:f1(ry*ch), w:f1((e-cx+1)*cw+0.35), h:f1(ch+0.35)});
      cx=e+1;
    }
  }

  // omtrek van een cellenverzameling, samengevoegd tot lange lijnstukken
  function edgePath(test){
    const V=new Set(), H=new Set();
    for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
      if(!test(c,r)) continue;
      if(!test(c-1,r)) V.add(c+":"+r);
      if(!test(c+1,r)) V.add((c+1)+":"+r);
      if(!test(c,r-1)) H.add(c+":"+r);
      if(!test(c,r+1)) H.add(c+":"+(r+1));
    }
    let d="";
    for(const key of V){
      const [c,r]=key.split(":").map(Number);
      if(V.has(c+":"+(r-1))) continue;
      let r2=r; while(V.has(c+":"+(r2+1))) r2++;
      d += "M"+f1(c*cw)+" "+f1(r*ch)+"V"+f1((r2+1)*ch);
    }
    for(const key of H){
      const [c,r]=key.split(":").map(Number);
      if(H.has((c-1)+":"+r)) continue;
      let c2=c; while(H.has((c2+1)+":"+r)) c2++;
      d += "M"+f1(c*cw)+" "+f1(r*ch)+"H"+f1((c2+1)*cw);
    }
    return d;
  }

  const outlines = REGIONS.map((_,i)=>edgePath((c,r)=>own(c,r)===i));

  // labelpositie = zwaartepunt van de cellen van die regio
  const acc = REGIONS.map(()=>({n:0,x:0,y:0}));
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
    const o=own(c,r); if(o<0) continue;
    const a=acc[o]; a.n++; a.x+=(c+0.5)*cw; a.y+=(r+0.5)*ch;
  }
  const labels = acc.map((a,i)=> a.n>=16 ? {i, x:f1(a.x/a.n), y:f1(a.y/a.n), cells:a.n} : null).filter(Boolean);

  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  runs.forEach(r=>{ x0=Math.min(x0,r.x); y0=Math.min(y0,r.y); x1=Math.max(x1,r.x+r.w); y1=Math.max(y1,r.y+r.h); });
  const pad = 5;

  return {
    W:f1(cols*cw), H:f1(rows*ch), runs, outlines, labels,
    viewBox: [f1(x0-pad), f1(y0-pad), f1(x1-x0+2*pad), f1(y1-y0+2*pad)].join(" "),
    borders: outlines.join(""),
    base: prj(11.859, 47.162).map(f1),
    cells: acc.map(a=>a.n)
  };
})();
