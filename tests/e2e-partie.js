// Partie complète jouée en vrais clics dans Chromium (Playwright) : 3 joueurs (1 humain joué par le robot + 2 IA).
// Vérifie : aucune erreur JavaScript, aucun blocage, pas de défilement horizontal ; s'arrête à la victoire ou après N actions.
const { chromium } = require("playwright");
const path = require("path");
const largeur = +(process.argv[2] || 1280), MAX = +(process.argv[3] || 1500);
(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: largeur, height: 900 } });
  const erreurs = [];
  page.on("pageerror", e => erreurs.push(e.message));
  page.on("dialog", d => d.accept());
  await page.goto("file://" + path.resolve(__dirname, "../dist/eurekaie.html"));
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click('[data-a="nbj"][data-d="3"]');
  await page.fill('[data-nom="0"]', "Ada");
  await page.click('[data-a="vitesse"][data-d="150"]');
  await page.click('[data-a="nouvelle"]');
  let n = 0, tours = 0, bloque = 0;
  const clic = async sel => { const el = page.locator(sel).first(); if (await el.count() && await el.isEnabled()) { await el.click(); return true; } return false; };
  while (n++ < MAX) {
    const S = await page.evaluate(() => UI.etat());
    if (S.gagnant !== null) break;
    tours = S.tour;
    let fait = await clic('[data-a="voir"]');
    if (!fait && S.phase === "prog" && !S.attente) {
      // le robot varie ses choix selon le tour
      const r = await page.locator('button[data-a="selR"]:not([disabled])').all();
      const c = await page.locator('button[data-a="selC"]:not([disabled])').all();
      await r[(n + S.tour) % r.length].click();
      await c[(n * 7 + S.tour) % c.length].click();
      fait = await clic('[data-a="valider"]');
    }
    if (!fait && S.attente) {
      const o = await page.locator('[data-a="choix"]').all();
      if (o.length) { await o[n % o.length].click(); fait = true; }
    }
    if (!fait && S.phase === "acq") fait = (await clic('button[data-a="acq"]:not([disabled])')) || (await clic('[data-a="passerAcq"]'));
    if (!fait) { await page.waitForTimeout(200); if (++bloque > 60) { console.log("BLOCAGE", JSON.stringify({ phase: S.phase, attente: S.attente })); process.exit(1); } } else bloque = 0;
  }
  const S = await page.evaluate(() => UI.etat());
  let statsOK = true;
  if (S.gagnant !== null) { // bilan : la partie doit apparaître dans les statistiques, avec son plateau final
    await page.click('[data-a="stats"][data-d="bilan"]');
    statsOK = (await page.locator(".partie").count()) === 1 && (await page.locator("img.plan").count()) === 1;
    console.log("bilan de la partie :", statsOK ? "enregistré et affiché" : "ABSENT (problème)");
    await page.screenshot({ path: path.resolve(__dirname, `../dist/stats-${largeur}.png`), fullPage: true });
  }
  const deb = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  await page.screenshot({ path: path.resolve(__dirname, `../dist/capture-${largeur}.png`), fullPage: true });
  console.log(`${n} actions, tour ${tours}, gagnant : ${S.gagnant === null ? "aucun" : S.joueurs[S.gagnant].nom}`);
  console.log("objectifs :", S.joueurs.map(j => j.nom + " " + j.objectifs.map(o => o.id).join("/")).join(" ; "));
  console.log("défilement horizontal :", deb ? "OUI (problème)" : "non");
  console.log(erreurs.length ? "ERREURS JS :\n" + erreurs.join("\n") : "aucune erreur JS");
  await b.close();
  process.exit(erreurs.length || deb || !statsOK ? 1 : 0);
})();
