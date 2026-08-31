/* De laatst berekende weergave (`derive()`-resultaat), gedeeld tussen render.js
   (dat 'm zet) en alle modules die tussentijds — buiten een render() om —
   moeten weten wat er nu op het scherm staat (kaart-hover, paklijst-acties, …). */
let lastView = null;

export function getLastView(){ return lastView; }
export function setLastView(v){ lastView = v; return v; }
