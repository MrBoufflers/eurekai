// IA basique (automa) d'Eurekaïe ! — sans DOM, utilisable dans la page et sous Node.
// Heuristiques simples + un peu de hasard ; aucune simulation de la suite de la partie.
// L'IA n'utilise que l'information publique et la sienne (jamais la programmation secrète des autres).
const IA = (() => {
  const E = typeof module !== "undefined" ? require("./engine.js") : EK;
  const C = typeof module !== "undefined" ? require("./cartes.js") : CARTES;
  const DOM = C.DOMAINES, MAX = C.MAX_PISTE;
  let RNG = Math.random;
  const setRng = f => { RNG = f; };
  const bruit = k => RNG() * k;
  const autres = (S, p) => S.joueurs.map((_, i) => i).filter(i => i !== p);
  const total = j => DOM.reduce((s, d) => s + j.xp[d], 0);
  const menace = (S, q) => { const j = S.joueurs[q]; return total(j) + 6 * j.objectifs.length + 3 * DOM.filter(d => j.xp[d] >= MAX).length; };
  const leader = (S, L) => L.slice().sort((a, b) => menace(S, b) - menace(S, a))[0];
  const aObj = (S, p, id) => S.joueurs[p].objectifs.some(o => o.id === id);
  const presDe7 = (S, p) => DOM.some(d => S.joueurs[p].xp[d] === MAX - 1 && !S.joueurs[p].sept[d]);
  const meilleur = (L, f) => L.slice().sort((a, b) => f(b) - f(a))[0];

  // domaine vers lequel l'IA pousse : la piste la plus avancée qui n'est pas encore à 7
  function focus(S, p) {
    const j = S.joueurs[p], L = DOM.filter(d => j.xp[d] < MAX);
    return L.length ? L.sort((a, b) => (j.xp[b] - j.xp[a]) || (S.hier.indexOf(a) - S.hier.indexOf(b)))[0] : DOM[0];
  }
  // intérêt d'un +1 XP dans un domaine
  function valeurGain(S, p, d) {
    const j = S.joueurs[p], x = j.xp[d];
    if (x >= MAX) return 1; // 2 Veilles
    let v = 2 + x * 0.5;
    if (aObj(S, p, "O-QUATRE") && x < 4) v += 3;
    if (aObj(S, p, "O-PAIRE")) { const L = DOM.filter(e => j.xp[e] < MAX); if (L.length && x < Math.max(...L.map(e => j.xp[e]))) v += 3; }
    if ((x + 1 === 3 || x + 1 === 5) && S.paliers[d + "-" + (x + 1)] === null) v += 1.5;
    return v;
  }
  const meilleurGain = (S, p, L) => meilleur(L, d => valeurGain(S, p, d));
  const pirePerte = (S, p, L) => {
    const j = S.joueurs[p], f = focus(S, p);
    return meilleur(L, d => (j.xp[d] === 0 ? -5 : 0) + (d === f ? -4 : 0) - j.xp[d] * 0.3 + (j.xp[d] >= MAX ? -3 : 0));
  };
  // facilité d'un objectif pour un joueur (plus c'est grand, mieux c'est)
  function facilite(S, p, id) {
    const j = S.joueurs[p];
    if (E.OK[id](S, p, { id, n: 0, v: [], ok: false })) return 20;
    switch (id) {
      case "O-QUATRE": return -DOM.reduce((s, d) => s + Math.max(0, 4 - j.xp[d]), 0);
      case "O-VEILLE6": return j.veille - 6;
      case "O-NIV3": return Object.values(j.cartes).filter(c => E.carte(c).niveau >= 2).length - 4;
      case "O-SANSBASE": return -Object.values(j.cartes).filter(c => E.carte(c).depart).length;
      case "O-SEPTHAUT": return 2;
      case "O-MARTYR": case "O-CENS2": case "O-HAUT": return 1;
      default: return 0;
    }
  }

  // ---------- programmation ----------
  function programmer(S, p) {
    const j = S.joueurs[p];
    const libresR = DOM.filter(d => !j.verrou.includes("R-" + d)), libresC = DOM.filter(d => !j.verrou.includes("C-" + d));
    // risque d'être censuré : domaine où l'IA mène (les autres la visent), bas de hiérarchie (égalités)
    const risque = d => {
      let r = 0;
      if (autres(S, p).every(q => S.joueurs[q].xp[d] < j.xp[d])) r += 1;
      if (S.hier.indexOf(d) === DOM.length - 1) r += 0.5;
      if (S.hier[0] === d) r -= 0.5;
      if (j.objectifs.length && j.xp[d] >= MAX) r += 1; // chasse au leader
      return r;
    };
    const r = meilleur(libresR, d => valeurGain(S, p, d) + 0.6 * E.carte(j.cartes["R-" + d]).niveau - 1.5 * risque(d) + bruit(1.5));
    // probabilité qu'un adversaire recherche d : selon ses Recherches libres et son XP
    const proba = (q, d) => {
      const k = S.joueurs[q], w = e => (k.verrou.includes("R-" + e) ? 0 : 1 + k.xp[e] * (k.xp[e] < MAX ? 1 : 0.3));
      const s = DOM.reduce((t, e) => t + w(e), 0);
      return s ? w(d) / s : 0;
    };
    const c = meilleur(libresC, d => {
      let v = autres(S, p).reduce((t, q) => t + proba(q, d) * (1 + menace(S, q) / 20), 0) * 3;
      if (autres(S, p).some(q => S.joueurs[q].objectifs.length && S.joueurs[q].xp[d] >= MAX)) v += 1.5;
      if (d === r) v += aObj(S, p, "O-MARTYR") ? 3 : -2;
      if (aObj(S, p, "O-HAUT") && d === S.hier[0]) v += 3;
      if (aObj(S, p, "O-SEPTHAUT") && j.xp[d] >= MAX && d !== r) v += 4;
      v += 0.3 * E.carte(j.cartes["C-" + d]).niveau;
      return v + bruit(1.5);
    });
    const jetons = [];
    if (E.jetonUtilisable(S, p, "immunite") && (j.xp[r] >= 5 || j.objectifs.length) && RNG() < 0.6) jetons.push("immunite");
    if (E.jetonUtilisable(S, p, "vote2") && RNG() < 0.5) jetons.push("vote2");
    return { type: "programmer", args: { r, c, jetons } };
  }

  // ---------- choix demandés par une carte ou un jeton ----------
  const GAINS = ["BIO-2-1", "ECO-2-1", "CHIM-1-4", "CHIM-3-1"], PERTES = ["BIO-2-3", "PHYS-2-1"];
  function choisir(S, p) {
    const a = S.attente, dm = a.demande, id = a.ctx.id, o = dm.options, n = a.ctx.choix.length;
    let v = o.length ? o[0] : null;
    if (dm.type === "ouinon") {
      if (id === "ECO-2-5") { // Compost : enterrer un objectif peu utile pour moi, ou utile à un adversaire proche de 7
        const top = dm.objet, moi = presDe7(S, p), lui = autres(S, p).find(q => presDe7(S, q));
        v = moi ? facilite(S, p, top) < 1 : lui !== undefined ? facilite(S, lui, top) >= 1 : RNG() < 0.3;
      } else v = true; // Vaccin, Recycleur : 1 Veille pour 1 XP, toujours rentable
    } else if (dm.type === "joueur") {
      if (id === "J-veto") { const vise = o.filter(q => S.joueurs[q].prog.c === S.joueurs[p].prog.r); v = vise.length ? vise[0] : null; }
      else if (id === "BIO-3-2") v = null; // Panacée : l'IA ne l'utilise pas (trop subtile)
      else if (id === "PHYS-1-7") v = meilleur(o, q => S.joueurs[q].gemme); // Inversion des pôles : prendre la plus grande gemme
      else if (id === "BIO-2-5") { // Mimétisme : prendre un objectif plus facile que le mien
        const mien = Math.max(...S.joueurs[p].objectifs.map(x => facilite(S, p, x.id)));
        const q = meilleur(o, q => Math.max(...S.joueurs[q].objectifs.map(x => facilite(S, p, x.id))));
        v = Math.max(...S.joueurs[q].objectifs.map(x => facilite(S, p, x.id))) > mien ? q : null;
      }
      else { const L = o.filter(q => q !== p); v = L.length ? leader(S, L) : (dm.passer ? null : o[0]); }
    } else if (dm.type === "domaine") {
      if (GAINS.includes(id)) v = meilleurGain(S, p, o);
      else if (PERTES.includes(id) || id === "BIO-2-6") v = pirePerte(S, p, o);
      else if (id === "CHIM-2-1") { // Transmutation
        if (n === 0) { const L = o.filter(d => d !== focus(S, p)); v = L.length ? pirePerte(S, p, L) : null; }
        else v = meilleurGain(S, p, o);
      }
      else if (id === "PHYS-1-6") { // Interception : la pile du domaine où le leader est le plus fort
        const q = leader(S, autres(S, p)); v = meilleur(o, d => S.joueurs[q].xp[d]);
      }
      else if (id === "ECO-1-2" || id === "CHIM-1-5") { // défausser la carte visible qui sert le leader
        const q = leader(S, autres(S, p));
        const L = o.filter(d => E.peutPayer(S.joueurs[q], E.carte(S.visibles[d]).cout));
        v = L.length ? meilleur(L, d => E.carte(S.visibles[d]).niveau) : o[Math.floor(RNG() * o.length)];
      }
      else v = o[Math.floor(RNG() * o.length)];
    } else if (dm.type === "jeton") { // Expropriation : le jeton le plus utile
      const pref = ["gemmeOr", "immunite", "conversion", "veto", "vote2", "regard", "achat2"];
      v = o.slice().sort((a, b) => pref.indexOf(a) - pref.indexOf(b))[0];
    } else if (dm.type === "objectif") {
      if (id === "J-regard" || id === "PHYS-2-5") { // ordre : le plus facile pour moi si je vais piocher, sinon le plus dur pour le suivant
        const moi = presDe7(S, p), lui = autres(S, p).find(q => presDe7(S, q));
        v = moi || lui === undefined ? meilleur(o, x => facilite(S, p, x)) : meilleur(o, x => -facilite(S, lui, x));
      }
      else if (id === "BIO-2-5") v = a.ctx.attendu === "mien" ? meilleur(o, x => -facilite(S, p, x)) : meilleur(o, x => facilite(S, p, x));
      else if (id === "CHIM-2-5") v = meilleur(o, x => facilite(S, a.ctx.cible, x));
    }
    return { type: "choisir", args: { v } };
  }

  // ---------- acquisition ----------
  function acquerir(S, p) {
    const j = S.joueurs[p];
    const val = id => {
      const c = E.carte(id), ancien = E.carte(j.cartes[c.type + "-" + c.dom]);
      let v = 2 * c.niveau - 2 * ancien.niveau + (ancien.depart ? 1 : 0) - (E.A_VENIR.includes(id) ? 1.5 : 0);
      if (aObj(S, p, "O-SANSBASE") && ancien.depart) v += 3;
      if (aObj(S, p, "O-NIV3") && c.niveau === 3) v += 4;
      return v;
    };
    const visibles = DOM.filter(d => S.visibles[d] && S.t.gel !== d).map(d => S.visibles[d]);
    // d'abord l'acquisition normale, puis le Progrès gratuit (sans condition de coût) s'il reste une carte intéressante
    const normal = S.t.normalFait ? [] : visibles.filter(id => E.peutPayer(j, E.carte(id).cout) && val(id) > 0);
    if (normal.length) return { type: "acquerir", args: { dom: E.carte(meilleur(normal, val)).dom } };
    const gratuit = E.jetonUtilisable(S, p, "achat2") ? visibles.filter(id => val(id) > 0) : [];
    if (gratuit.length) return { type: "acquerir", args: { dom: E.carte(meilleur(gratuit, val)).dom, gratuit: true } };
    return { type: "passer", args: {} };
  }

  // ---------- point d'entrée ----------
  // action que l'IA veut jouer pour le joueur p (ou null si elle n'a rien à faire)
  function decider(S, p) {
    if (S.gagnant !== null) return null;
    if (S.attente) return S.attente.p === p ? choisir(S, p) : null;
    const j = S.joueurs[p], cout = E.jetonUtilisable(S, p, "conversion") ? 2 : 3;
    const aMoi = (S.phase === "prog" && !j.prog) || (S.phase === "acq" && S.ordre[S.acq] === p);
    if (!aMoi) return null;
    if (j.veille >= cout) { const L = DOM.filter(d => j.xp[d] < MAX); if (L.length) return { type: "convertir", args: { dom: meilleurGain(S, p, L) } }; }
    if (E.jetonUtilisable(S, p, "regard") && presDe7(S, p)) return { type: "jeton", args: { k: "regard" } };
    return S.phase === "prog" ? programmer(S, p) : acquerir(S, p);
  }
  // joue une action ; si elle est refusée (cas imprévu), se rabat sur un coup légal simple. Renvoie l'action jouée ou null.
  function jouer(S, p) {
    const act = decider(S, p);
    if (!act) return null;
    let err = E.apply(S, p, act.type, act.args);
    if (!err) return act;
    let repli;
    if (S.attente && S.attente.p === p) repli = { type: "choisir", args: { v: S.attente.demande.passer ? null : S.attente.demande.options[0] } };
    else if (S.phase === "prog") { const L = E.disponibles(S, p); repli = { type: "programmer", args: { r: L.find(s => s[0] === "R").slice(2), c: L.find(s => s[0] === "C").slice(2) } }; }
    else repli = { type: "passer", args: {} };
    err = E.apply(S, p, repli.type, repli.args);
    if (err) throw new Error(`IA bloquée (${S.joueurs[p].nom}) : ${err}`);
    repli.repli = act;
    return repli;
  }
  return { setRng, decider, jouer, focus, facilite };
})();
if (typeof module !== "undefined") module.exports = IA;
