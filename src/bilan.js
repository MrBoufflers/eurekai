// Bilan de fin de partie d'Eurekaïe ! (comme le bilan de Swarm & Steel) : résumé chiffré + plateau final en SVG.
// Aucun accès au DOM. Les statistiques sont gardées dans le navigateur (localStorage, clé « eurekaie-stats »).
const BILAN = (() => {
  const E = typeof module !== "undefined" ? require("./engine.js") : EK;
  const C = typeof module !== "undefined" ? require("./cartes.js") : CARTES;
  const DOM = C.DOMAINES;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const COUL_J = ["#f59f00", "#82c91e", "#f06595", "#4dabf7", "#e9ecef"];

  function causeVictoire(S) {
    const v = S.victoire;
    if (!v) return "";
    if (v.objectif) return C.OBJ[v.objectif].nom;
    if (v.carte) return E.carte(v.carte).nom;
    return "";
  }
  // résumé d'une partie terminée
  function resume(S) {
    return {
      id: Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
      date: new Date().toISOString(), version: S.version || E.VERSION, versionFin: E.VERSION,
      n: S.joueurs.length, ia: S.joueurs.filter(j => j.ia).length, tours: S.tour,
      gagnant: S.gagnant, gagnantNom: S.gagnant !== null ? S.joueurs[S.gagnant].nom : "", gagnantIA: S.gagnant !== null && !!S.joueurs[S.gagnant].ia,
      victoire: causeVictoire(S),
      censures: (S.histo || []).map(h => h.dom).concat(S.t && S.t.censure ? [S.t.censure] : []),
      hier: S.hier.slice(),
      joueurs: S.joueurs.map(j => ({
        nom: j.nom, ia: !!j.ia, xp: { ...j.xp }, veille: j.veille, achats: j.achats || 0, gemme: j.gemme,
        objectifs: j.objectifs.map(o => C.OBJ[o.id].nom),
        jetons: j.jetons.map(t => (C.JETONS[t.cle] ? C.JETONS[t.cle].nom : t.k) + (t.used ? " (utilisé)" : "")),
        main: ["R", "C"].map(t => DOM.map(d => { const c = E.carte(j.cartes[t + "-" + d]); return c.depart ? `${t === "R" ? "Recherche" : "Censure"} ${C.NOM_DOMAINE[d]} (base)` : c.nom; })).flat(),
      })),
    };
  }
  // plateau final : 4 pistes de 0 à 7, pions des joueurs, hiérarchie finale
  function plateau(S) {
    const L = 64, Wc = 34, H = 26, W = L + 8 * Wc + 8, haut = 22;
    const coul = { bio: "#2f7fc4", phys: "#b558ad", eco: "#19b39b", chim: "#f05763" };
    const p = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${haut + 4 * (H + 4) + 4}" width="${W}" font-family="Arial, sans-serif">`,
      `<rect width="100%" height="100%" rx="6" fill="#1f232b"/>`,
      `<text x="6" y="15" font-size="10" fill="#cfc8bb">Hiérarchie finale : ${S.hier.map((d, i) => `${i + 1}. ${esc(C.NOM_DOMAINE[d])}`).join("  ")}</text>`];
    DOM.forEach((d, r) => {
      const y = haut + r * (H + 4);
      p.push(`<rect x="4" y="${y}" width="${L - 6}" height="${H}" rx="4" fill="${coul[d]}"/><text x="8" y="${y + 17}" font-size="11" font-weight="bold" fill="#fff">${esc(C.NOM_DOMAINE[d])}</text>`);
      for (let v = 0; v <= 7; v++) {
        const x = L + v * Wc;
        p.push(`<rect x="${x}" y="${y}" width="${Wc - 3}" height="${H}" rx="3" fill="${v === 7 ? "#3a3f4a" : "#282d37"}" stroke="${v === 3 || v === 5 ? coul[d] : "#383e4a"}"/>`);
        p.push(`<text x="${x + Wc - 6}" y="${y + H - 3}" font-size="7" text-anchor="end" fill="#8f887c">${v}</text>`);
        S.joueurs.map((j, q) => [j, q]).filter(([j]) => j.xp[d] === v).forEach(([j, q], k) => {
          const cx = x + 7 + (k % 3) * 9, cy = y + 7 + Math.floor(k / 3) * 10;
          p.push(`<circle cx="${cx}" cy="${cy}" r="4.5" fill="${COUL_J[q]}" stroke="#000" stroke-width=".6"/><text x="${cx}" y="${cy + 2.5}" font-size="6" text-anchor="middle" font-weight="bold" fill="#111">${q + 1}</text>`);
        });
      }
    });
    p.push(`</svg>`);
    return p.join("");
  }
  // agrégats par version (parties, tours moyens, cartes achetées par joueur, victoires par objectif, part des victoires IA)
  function parVersion(liste) {
    const V = {};
    for (const r of liste) {
      const v = V[r.version] || (V[r.version] = { version: r.version, n: 0, tours: 0, achats: 0, joueurs: 0, ia: 0, victoires: {} });
      v.n++; v.tours += r.tours; v.ia += r.gagnantIA ? 1 : 0;
      for (const j of r.joueurs) { v.achats += j.achats; v.joueurs++; }
      v.victoires[r.victoire || "?"] = (v.victoires[r.victoire || "?"] || 0) + 1;
    }
    return Object.values(V).sort((a, b) => (a.version < b.version ? 1 : -1));
  }
  function csv(liste) {
    const tete = ["date", "version", "joueurs", "dont IA", "tours", "gagnant", "gagnant IA", "victoire", "censures", "cartes achetées (par joueur)", "XP finale (bio/phys/éco/chim par joueur)"];
    const q = s => `"${String(s).replace(/"/g, '""')}"`;
    return [tete.map(q).join(";")].concat(liste.map(r => [r.date, r.version, r.n, r.ia, r.tours, r.gagnantNom, r.gagnantIA ? "oui" : "non", r.victoire,
      r.censures.join(" "), r.joueurs.map(j => `${j.nom}:${j.achats}`).join(" "),
      r.joueurs.map(j => `${j.nom}:${DOM.map(d => j.xp[d]).join("/")}`).join(" ")].map(q).join(";"))).join("\n");
  }
  return { resume, plateau, parVersion, csv };
})();
if (typeof module !== "undefined") module.exports = BILAN;
