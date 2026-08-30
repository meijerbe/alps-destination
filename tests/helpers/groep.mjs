/** Selecteer een paklijst-groep op de exacte kop, niet op losse tekst erin —
 *  "Kleding" zit anders ook in "Hardloopkleding" van de Trailrunnen-groep. */
export function groep(page, naam) {
  return page.locator(".packgroup").filter({
    has: page.locator("h3", { hasText: new RegExp(`^${naam}(\\s|$)`) })
  });
}
