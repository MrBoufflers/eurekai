// Moteur de règles d'Eurekaïe ! — aucun accès au DOM (navigateur et Node).
// Règles : livret V3 (texte v2.0) + décisions d'Oni (docs/questions.md) ; cartes : JSON v2.0 de kurzgui (src/cartes.js).
// Les choix d'interprétation encore à valider par Oni sont marqués « À VALIDER » et listés dans docs/questions.md.
const EK = (() => {
  const C = typeof module !== "undefined" ? require("./cartes.js") : CARTES;
  const { DOMAINES, PAR_ID, OBJ, JETONS, MAX_PISTE, NOM_DOMAINE } = C;
  const VERSION = "0.6.1";

  let RNG = Math.random;
  const setRng = f => { RNG = f; };
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(RNG() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const carte = id => PAR_ID[id];
  const D = d => NOM_DOMAINE[d];

  // ---------- mise en place ----------
  // les 8 cartes d'origine à 1 XP (une Recherche, une Censure par domaine) ; les cartes ajoutées ensuite ne sont pas concernées
  const TETE = ["BIO-1-1", "BIO-1-2", "PHYS-1-1", "PHYS-1-2", "ECO-1-1", "ECO-1-2", "CHIM-1-1", "CHIM-1-2"];
  const estCarteTete = id => TETE.includes(id);
  function newGame(opts = {}) {
    const noms = opts.noms || ["Joueur 1", "Joueur 2", "Joueur 3"];
    const n = noms.length;
    if (n < 2 || n > 5) throw new Error("2 à 5 joueurs");
    const piles = {}, visibles = {};
    for (const dom of DOMAINES) {
      const ids = C.PROGRES.filter(id => PAR_ID[id].dom === dom && PAR_ID[id].min <= n);
      // Oni, 08/11/2026 : les 2 cartes qui ne coûtent que 1 XP (une Recherche, une Censure) sont toujours en tête de pile,
      // dans un ordre tiré au hasard ; le reste de chaque niveau est mélangé en dessous
      const tete = shuffle(ids.filter(estCarteTete));
      const pile = [...tete];
      for (const niv of [1, 2, 3]) pile.push(...shuffle(ids.filter(id => PAR_ID[id].niveau === niv && !tete.includes(id))));
      visibles[dom] = pile.shift() || null; // index 0 = dessus de la pile
      piles[dom] = pile;
    }
    const joueurs = noms.map(nom => {
      const cartes = {};
      for (const dom of DOMAINES) for (const t of ["R", "C"]) cartes[t + "-" + dom] = "S-" + t + "-" + dom;
      return { nom, xp: { bio: 0, phys: 0, eco: 0, chim: 0 }, veille: 0, cartes, verrou: [], prog: null, gemme: 0,
        objectifs: [], sept: {}, jetons: [] };
    });
    // gemmes (Oni, 07/11/2026) : numéros 1 à n tirés au hasard, départagent les joueurs qui recherchent le même domaine
    shuffle(noms.map((_, i) => i + 1)).forEach((g, i) => { joueurs[i].gemme = g; });
    const paliers = {};
    for (const k of Object.keys(JETONS)) paliers[k] = null;
    return {
      version: VERSION, n, joueurs,
      hier: shuffle([...DOMAINES]),            // du haut (index 0) vers le bas
      piles, visibles, defausse: [],
      objPile: shuffle(Object.keys(OBJ)), objDefausse: [], paliers,
      tour: 1, phase: "prog",                  // prog → resol → acq → (tour suivant) prog ; fin
      t: null,                                 // informations du tour en cours (votes, domaine censuré…)
      etapes: [], attente: null, ordre: [], acq: 0,
      gagnant: null, log: [],
    };
  }

  // ---------- outils ----------
  const log = (S, txt) => { S.log.push({ tour: S.tour, txt }); };
  const nom = (S, p) => S.joueurs[p].nom;
  const autres = (S, p) => S.joueurs.map((_, i) => i).filter(i => i !== p);
  const rechercheurs = (S, dom) => S.joueurs.map((j, i) => (j.prog && j.prog.r === dom ? i : -1)).filter(i => i >= 0);
  const carteJouee = (S, p, type) => { const j = S.joueurs[p]; return j.cartes[type + "-" + j.prog[type === "R" ? "r" : "c"]]; };
  const peutPayer = (j, cout) => Object.entries(cout).every(([d, v]) => j.xp[d] >= v);
  const disponibles = (S, p) => Object.keys(S.joueurs[p].cartes).filter(s => !S.joueurs[p].verrou.includes(s));
  function reveler(S, dom) { S.visibles[dom] = S.piles[dom].shift() || null; }
  const ask = (type, options, texte, passer = false) => ({ type, options, texte, passer });
  // pour les effets à plusieurs questions : la dernière réponse va dans le champ demandé (c.attendu)
  function lire(c) { if (c.attendu) { c[c.attendu] = c.choix[c.choix.length - 1]; c.attendu = null; } }

  // ---------- jetons de palier ----------
  const PERMANENTS = ["conversion", "gemmeOr"];
  // un jeton s'utilise à partir du tour qui suit son obtention
  const jetonUtilisable = (S, p, k) => S.joueurs[p].jetons.some(t => t.k === k && !t.used && S.tour > t.tour);
  function useJeton(S, p, k) {
    const t = S.joueurs[p].jetons.find(t => t.k === k && !t.used && S.tour > t.tour);
    if (t && !PERMANENTS.includes(k)) t.used = true;
  }
  const gemmeEff = (S, p) => (jetonUtilisable(S, p, "gemmeOr") ? 99 : S.joueurs[p].gemme);

  // ---------- XP, Veilles, paliers, objectifs ----------
  // cause affichée dans le journal à la suite de chaque gain ou perte (ex. « — Spore Parasite de IA 3 »)
  let CAUSE = "";
  const avecCause = (c, f) => { const avant = CAUSE; CAUSE = c; try { return f(); } finally { CAUSE = avant; } };
  const suffixe = () => (CAUSE ? ` — ${CAUSE}` : "");
  const nomSource = id => (PAR_ID[id] ? `« ${PAR_ID[id].nom} »` : { "J-veto": "Veto", "J-regard": "Regard vers l'avenir" }[id] || id);
  // src : joueur à l'origine d'une perte (compte pour les objectifs Pillard et Rivalité)
  function gainXP(S, p, dom, k, src) {
    const j = S.joueurs[p], avant = j.xp[dom];
    let surplus = 0;
    if (k > 0) { const monte = Math.min(k, MAX_PISTE - avant); surplus = k - monte; j.xp[dom] = avant + monte; }
    else j.xp[dom] = Math.max(0, avant + k);
    const d = j.xp[dom] - avant;
    if (d) log(S, `${j.nom} : ${d > 0 ? "+" : ""}${d} XP ${D(dom)} (${j.xp[dom]})${suffixe()}`);
    // Oni, 08/11/2026 : chaque XP gagnée sur une piste déjà à 7 rapporte 2 Veilles
    if (surplus) avecCause(`piste ${D(dom)} déjà à 7`, () => gainVeille(S, p, 2 * surplus));
    if (d < 0 && src !== undefined && src !== p) noteXP(S, src, p);
    if (d > 0) apresXP(S, p, dom);
    return d;
  }
  function gainVeille(S, p, k, src) {
    const j = S.joueurs[p], avant = j.veille;
    j.veille = Math.max(0, avant + k);
    const d = j.veille - avant;
    if (d) log(S, `${j.nom} : ${d > 0 ? "+" : ""}${d} Veille (${j.veille})${suffixe()}`);
    if (d < 0 && src !== undefined && src !== p) noteVeilles(S, src, -d);
    return d;
  }
  function apresXP(S, p, dom) {
    const j = S.joueurs[p];
    for (const v of [3, 5]) {
      const cle = dom + "-" + v;
      if (S.paliers[cle] === null && j.xp[dom] >= v) {
        const J = JETONS[cle];
        S.paliers[cle] = p;
        j.jetons.push({ k: J.k, cle, tour: S.tour, used: J.k === "veille2" });
        log(S, `${j.nom} atteint ${v} en ${D(dom)} le premier : jeton « ${J.nom} »`);
        if (J.k === "veille2") avecCause("jeton de palier", () => gainVeille(S, p, 2));
      }
    }
    if (j.xp[dom] >= MAX_PISTE && !j.sept[dom]) { j.sept[dom] = true; piocherObjectif(S, p, `atteint 7 en ${D(dom)}`); }
  }
  const nouvelObj = id => ({ id, n: 0, v: [], ok: false });
  function piocherObjectif(S, p, pourquoi) {
    if (!S.objPile.length) { S.objPile = shuffle(S.objDefausse); S.objDefausse = []; }
    const id = S.objPile.shift();
    if (!id) { log(S, "Plus aucun objectif à piocher"); return; }
    S.joueurs[p].objectifs.push(nouvelObj(id));
    log(S, `${nom(S, p)} ${pourquoi} et pioche l'objectif « ${OBJ[id].nom} » : ${OBJ[id].texte}`);
  }
  const objectifsDe = (S, p, id) => S.joueurs[p].objectifs.filter(o => o.id === id);
  function noteVeilles(S, src, n) { for (const o of objectifsDe(S, src, "O-VOL4")) o.n += n; }
  function noteXP(S, src, q) { for (const o of objectifsDe(S, src, "O-XP2")) if (!o.v.includes(q)) o.v.push(q); }

  // Conditions des objectifs (les compteurs n / v / ok partent de 0 au moment de la pioche)
  const OK = {
    "O-MARTYR": (S, p, o) => o.n >= 2,
    "O-CENS2": (S, p, o) => o.n >= 2,
    "O-HAUT": (S, p, o) => o.ok,
    "O-SEUL": (S, p, o) => o.ok,
    // Oni, 08/11/2026 : les 3 autres pistes (hors une piste à 7) au même niveau ; au moins 1 (À VALIDER : sinon 7-0-0-0 suffirait)
    "O-PAIRE": (S, p) => { const x = S.joueurs[p].xp; return DOMAINES.some(d => x[d] >= MAX_PISTE && (v => v.every(y => y === v[0]) && v[0] >= 1)(DOMAINES.filter(e => e !== d).map(e => x[e]))); },
    "O-VEILLE6": (S, p) => S.joueurs[p].veille >= 6,
    "O-VOL4": (S, p, o) => o.n >= 4,
    "O-SANSBASE": (S, p) => Object.values(S.joueurs[p].cartes).every(id => !carte(id).depart),
    "O-NIV3": (S, p) => Object.values(S.joueurs[p].cartes).filter(id => carte(id).niveau === 3).length >= 2,
    "O-SEPTHAUT": (S, p) => S.joueurs[p].xp[S.hier[0]] >= MAX_PISTE,
    "O-XP2": (S, p, o) => o.v.length >= 2,
    "O-QUATRE": (S, p) => DOMAINES.every(d => S.joueurs[p].xp[d] >= 4),
    "O-SABOTEUR": (S, p, o) => o.n >= 1,
  };
  // Victoire dès qu'un objectif est rempli, à n'importe quel moment (ordre de jeu si plusieurs à la fois)
  function verifier(S) {
    if (S.gagnant !== null) return;
    const ordre = S.ordre.length ? S.ordre : S.joueurs.map((_, i) => i);
    for (const p of ordre) for (const o of S.joueurs[p].objectifs) if (OK[o.id](S, p, o)) {
      S.gagnant = p; S.phase = "fin"; S.attente = null; S.etapes = []; S.victoire = { p, objectif: o.id };
      log(S, `${nom(S, p)} remplit l'objectif « ${OBJ[o.id].nom} » et gagne la partie !`);
      return;
    }
  }

  // ---------- ordre de jeu, hiérarchie, gemmes ----------
  // Oni, 07/11/2026 : le domaine censuré passe tout en haut de la hiérarchie, à la fin du tour
  function enHaut(S, dom) { S.hier = [dom, ...S.hier.filter(d => d !== dom)]; }
  // ordre : rang (dans la hiérarchie) du domaine recherché ; à égalité, la plus grande gemme (la Gemme d'or gagne toujours)
  const calcOrdre = (S, gemmes) => S.joueurs.map((_, i) => i).sort((a, b) =>
    (S.hier.indexOf(S.joueurs[a].prog.r) - S.hier.indexOf(S.joueurs[b].prog.r)) || gemmes[b] - gemmes[a]);
  // après une égalité, les joueurs concernés échangent leurs gemmes (inversion de l'ordre, À VALIDER à 3+) ;
  // le porteur de la Gemme d'or ne participe pas à l'échange
  function echangerGemmes(S) {
    for (const d of DOMAINES) {
      const tous = S.ordre.filter(p => S.joueurs[p].prog.r === d);
      if (tous.length < 2) continue;
      const g = tous.filter(p => !jetonUtilisable(S, p, "gemmeOr"));
      const vals = g.map(p => S.joueurs[p].gemme);
      g.forEach((p, i) => { S.joueurs[p].gemme = vals[vals.length - 1 - i]; });
      log(S, `Égalité en ${D(d)} : ${tous.map(p => nom(S, p)).join(" puis ")}${g.length > 1 ? " (gemmes échangées)" : ""}`);
    }
  }

  // ---------- effets des cartes Progrès et des jetons ----------
  // quand : "censure" (Censure ayant visé le domaine censuré), "recherche" (Recherche non censurée),
  //         "censure_r" (Recherche censurée), "base" (remplace le +1 XP de base), "jeton".
  // run(S, ctx) renvoie une demande de choix (ask) ou rien ; ctx.choix contient les réponses déjà données.
  const plusVeille = k => ({ quand: "recherche", run: (S, c) => { gainVeille(S, c.p, k); } });
  const siAutres = dom => ({ quand: "recherche", run: (S, c) => { if (rechercheurs(S, dom).some(q => q !== c.p)) gainXP(S, c.p, dom, 1); } });
  const siSeul = dom => ({ quand: "recherche", run: (S, c) => { if (!rechercheurs(S, dom).some(q => q !== c.p)) gainXP(S, c.p, dom, 1); } });
  const siCensureActive = dom => ({ quand: "recherche", run: (S, c) => { if (S.t.actives.includes(c.p)) gainXP(S, c.p, dom, 1); } });
  const depenseVeille = dom => ({ quand: "recherche", run: (S, c) => {
    if (!c.choix.length) return S.joueurs[c.p].veille ? ask("ouinon", [true, false], `Dépenser 1 Veille pour +1 XP ${D(dom)} ?`) : undefined;
    if (c.choix[0]) { gainVeille(S, c.p, -1); gainXP(S, c.p, dom, 1); }
  } });
  const xpAuChoix = { quand: "recherche", run: (S, c) => {
    if (!c.choix.length) return ask("domaine", [...DOMAINES], "+1 XP sur la piste de votre choix");
    gainXP(S, c.p, c.choix[0], 1);
  } };
  // « +2 XP dans le domaine, puis perdez 1 XP ailleurs » : +2 en plus du +1 de base (À VALIDER)
  const plusDeuxMoinsUn = dom => ({ quand: "recherche", run: (S, c) => {
    if (!c.choix.length) { gainXP(S, c.p, dom, 2); return ask("domaine", DOMAINES.filter(d => d !== dom), "Perdez 1 XP dans un autre domaine"); }
    gainXP(S, c.p, c.choix[0], -1);
  } });
  const verrouilleePerd = { quand: "censure", run: (S, c) => {
    S.joueurs.forEach((j, q) => { if (j.verrou.includes("R-" + S.t.censure)) gainXP(S, q, S.t.censure, -1, c.p); });
  } };
  const defausseVisible = { quand: "censure", run: (S, c) => {
    if (!c.choix.length) { const o = DOMAINES.filter(d => S.visibles[d]); return o.length ? ask("domaine", o, "Défaussez la carte Progrès visible d'un domaine") : undefined; }
    const d = c.choix[0]; log(S, `${nom(S, c.p)} défausse « ${carte(S.visibles[d]).nom} »`);
    S.defausse.push(S.visibles[d]); reveler(S, d);
  } };
  // Regard vers l'avenir (jeton Physique 5) et Prémonition : 3 objectifs du dessus remis dans l'ordre choisi (en secret)
  const regard = quand => ({ quand, run: (S, c) => {
    if (!c.cartes) {
      if (quand === "jeton") useJeton(S, c.p, "regard");
      c.cartes = S.objPile.slice(0, 3);
      if (c.cartes.length < 2) { log(S, `${nom(S, c.p)} regarde le dessus de la pioche d'objectifs`); return; }
    }
    const reste = c.cartes.filter(id => !c.choix.includes(id));
    if (reste.length > 1) return { ...ask("objectif", reste, `Quel objectif placez-vous en position ${c.choix.length + 1} (du dessus) ?`), prive: true };
    S.objPile.splice(0, c.cartes.length, ...c.choix, ...reste);
    log(S, `${nom(S, c.p)} a remis les ${c.cartes.length} objectifs du dessus dans l'ordre de son choix`);
  } });

  const FX = {
    "BIO-1-1": plusVeille(1),
    "BIO-1-2": { quand: "censure", run: (S, c) => {
      if (!c.choix.length) {
        const o = autres(S, c.p).filter(q => !S.t.censures.includes(q) && S.joueurs[q].veille > 0);
        return o.length ? ask("joueur", o, "Volez 1 Veille à un joueur non censuré ce tour") : log(S, "Spore Parasite : aucune Veille à voler");
      }
      gainVeille(S, c.choix[0], -1, c.p); gainVeille(S, c.p, 1);
    } },
    "BIO-1-3": siAutres("bio"),
    "BIO-1-4": depenseVeille("bio"),
    "BIO-1-5": { quand: "censure", run: () => {} }, // vote double : compté dans le décompte des votes
    "BIO-2-1": xpAuChoix,
    "BIO-2-2": { quand: "censure", run: (S, c) => {
      if (!c.choix.length) return ask("joueur", autres(S, c.p), `Un joueur perd 1 XP ${D(S.t.censure)}`);
      gainXP(S, c.choix[0], S.t.censure, -1, c.p);
    } },
    "BIO-2-3": plusDeuxMoinsUn("bio"),
    "BIO-2-4": verrouilleePerd,
    // Mimétisme : échanger un de ses objectifs avec celui d'un adversaire (facultatif ; compteurs remis à 0)
    "BIO-2-5": { quand: "recherche", run: (S, c) => {
      lire(c);
      const j = S.joueurs[c.p];
      if (c.cible === undefined) {
        const cibles = autres(S, c.p).filter(q => S.joueurs[q].objectifs.length);
        if (!j.objectifs.length || !cibles.length) { log(S, "Mimétisme : aucun échange d'objectif possible"); return; }
        c.attendu = "cible"; return ask("joueur", cibles, "Échangez un objectif avec quel joueur ?", true);
      }
      if (c.cible === null) return;
      const t = S.joueurs[c.cible];
      if (c.mien === undefined) { if (j.objectifs.length === 1) c.mien = j.objectifs[0].id; else { c.attendu = "mien"; return ask("objectif", j.objectifs.map(o => o.id), "Lequel de vos objectifs donnez-vous ?"); } }
      if (c.sien === undefined) { if (t.objectifs.length === 1) c.sien = t.objectifs[0].id; else { c.attendu = "sien"; return ask("objectif", t.objectifs.map(o => o.id), "Quel objectif prenez-vous ?"); } }
      j.objectifs = j.objectifs.filter(o => o.id !== c.mien).concat([nouvelObj(c.sien)]);
      t.objectifs = t.objectifs.filter(o => o.id !== c.sien).concat([nouvelObj(c.mien)]);
      log(S, `${j.nom} échange « ${OBJ[c.mien].nom} » contre « ${OBJ[c.sien].nom} » de ${t.nom}`);
    } },
    "BIO-3-1": { quand: "recherche", run: (S, c) => { for (const d of DOMAINES) if (S.joueurs[c.p].xp[d] >= 3) gainXP(S, c.p, d, 1); } },
    "BIO-3-2": { quand: "recherche", run: (S, c) => {
      if (c.choix.length === 0) return ask("joueur", S.joueurs.map((_, i) => i), "Choisissez le joueur dont vous inversez 2 pions XP", true);
      if (c.choix[0] === null) return;
      if (c.choix.length === 1) return ask("domaine", [...DOMAINES], "Premier pion à inverser");
      if (c.choix.length === 2) return ask("domaine", DOMAINES.filter(d => d !== c.choix[1]), "Second pion à inverser");
      const q = c.choix[0], j = S.joueurs[q], [a, b] = [c.choix[1], c.choix[2]];
      [j.xp[a], j.xp[b]] = [j.xp[b], j.xp[a]];
      log(S, `${j.nom} : pions ${D(a)} et ${D(b)} inversés (${j.xp[a]} / ${j.xp[b]})`);
      apresXP(S, q, a); apresXP(S, q, b);
    } },

    "PHYS-1-1": siSeul("phys"),
    "PHYS-1-2": { quand: "censure", run: (S, c) => {
      if (!c.choix.length) return ask("joueur", autres(S, c.p), "Un joueur perd 1 Veille");
      gainVeille(S, c.choix[0], -1, c.p);
    } },
    "PHYS-1-3": siCensureActive("phys"),
    "PHYS-1-4": { quand: "censure_r", run: (S, c) => { for (const d of DOMAINES) gainXP(S, c.p, d, 1); } },
    "PHYS-2-1": plusDeuxMoinsUn("phys"),
    "PHYS-2-4": { quand: "censure", run: S => { S.hier.reverse(); log(S, "Antimatière : hiérarchie inversée"); } },
    "PHYS-2-5": regard("recherche"), // Prémonition

    "ECO-1-1": plusVeille(1),
    "ECO-1-2": defausseVisible,
    "ECO-1-3": siAutres("eco"),
    "ECO-1-4": depenseVeille("eco"),
    "ECO-2-1": xpAuChoix,
    "ECO-2-2": { quand: "censure", run: (S, c) => { gainVeille(S, c.p, 2); } },
    "ECO-2-4": verrouilleePerd,
    // Compost : regarder l'objectif du dessus, et éventuellement le mettre sous la pioche (en secret)
    "ECO-2-5": { quand: "censure", run: (S, c) => {
      const top = S.objPile[0];
      if (!top) return;
      if (!c.choix.length) return { ...ask("ouinon", [true, false], `Objectif du dessus : « ${OBJ[top].nom} » (${OBJ[top].texte}). Le mettre sous la pioche ?`), prive: true, objet: top };
      if (c.choix[0]) { S.objPile.push(S.objPile.shift()); log(S, `${nom(S, c.p)} met l'objectif du dessus sous la pioche`); }
      else log(S, `${nom(S, c.p)} regarde l'objectif du dessus et le laisse en place`);
    } },
    "ECO-3-1": { quand: "recherche", run: (S, c) => {
      for (const d of DOMAINES) if (rechercheurs(S, d).some(q => q !== c.p)) gainXP(S, c.p, d, 1);
    } },
    "ECO-3-2": { quand: "censure_r", run: (S, c) => { S.gagnant = c.p; S.phase = "fin"; S.victoire = { p: c.p, carte: "ECO-3-2" }; log(S, `${nom(S, c.p)} gagne la partie (Extinction de Masse) !`); } },
    "ECO-3-3": { quand: "censure", run: (S, c) => {
      const avant = S.joueurs.map(j => j.veille);
      let total = 0; for (const j of S.joueurs) { total += j.veille; j.veille = 0; }
      for (let k = 0; k < total; k++) S.joueurs[(c.p + k) % S.n].veille++;
      log(S, `Symbiocité : ${total} Veille redistribuées`);
      S.joueurs.forEach((j, q) => { if (q !== c.p && avant[q] > j.veille) noteVeilles(S, c.p, avant[q] - j.veille); });
    } },

    "CHIM-1-1": siCensureActive("chim"),
    "CHIM-1-2": { quand: "censure", run: (S, c) => { gainVeille(S, c.p, 1); } },
    "CHIM-1-3": siSeul("chim"),
    "CHIM-1-4": { quand: "base", run: (S, c) => {
      if (!c.choix.length) return ask("domaine", [...DOMAINES], "Sur quelle piste gagnez-vous votre XP ?");
      gainXP(S, c.p, c.choix[0], 1);
    } },
    "CHIM-1-5": defausseVisible,
    "CHIM-2-1": { quand: "recherche", run: (S, c) => {
      const j = S.joueurs[c.p];
      if (c.choix.length === 0) { const o = DOMAINES.filter(d => j.xp[d] > 0); return o.length ? ask("domaine", o, "Déplacez 2 XP : domaine de départ", true) : undefined; }
      if (c.choix[0] === null) return;
      if (c.choix.length === 1) return ask("domaine", DOMAINES.filter(d => d !== c.choix[0]), "Domaine d'arrivée");
      const [a, b] = c.choix, k = Math.min(2, j.xp[a], MAX_PISTE - j.xp[b]);
      j.xp[a] -= k; j.xp[b] += k; log(S, `${j.nom} déplace ${k} XP de ${D(a)} vers ${D(b)}`);
      apresXP(S, c.p, b);
    } },
    "CHIM-2-2": { quand: "censure", run: (S, c) => {
      if (!c.choix.length) return ask("joueur", autres(S, c.p), "Un joueur ne pourra pas acquérir de carte ce tour");
      S.t.bloques.push(c.choix[0]); log(S, `${nom(S, c.choix[0])} ne peut pas acquérir de carte ce tour`);
    } },
    // Sabotage : un adversaire défausse un de ses objectifs et en pioche un nouveau
    "CHIM-2-5": { quand: "censure", run: (S, c) => {
      lire(c);
      if (c.cible === undefined) {
        const cibles = autres(S, c.p).filter(q => S.joueurs[q].objectifs.length);
        if (!cibles.length) { log(S, "Sabotage : aucun adversaire n'a d'objectif"); return; }
        c.attendu = "cible"; return ask("joueur", cibles, "Sabotage : quel joueur défausse un objectif ?");
      }
      const t = S.joueurs[c.cible];
      if (c.obj === undefined) { if (t.objectifs.length === 1) c.obj = t.objectifs[0].id; else { c.attendu = "obj"; return ask("objectif", t.objectifs.map(o => o.id), "Quel objectif défausse-t-il ?"); } }
      t.objectifs = t.objectifs.filter(o => o.id !== c.obj); S.objDefausse.push(c.obj);
      log(S, `${nom(S, c.p)} sabote : ${t.nom} défausse « ${OBJ[c.obj].nom} »`);
      for (const o of objectifsDe(S, c.p, "O-SABOTEUR")) o.n++;
      piocherObjectif(S, c.cible, "remplace son objectif");
    } },
    "CHIM-3-1": { quand: "recherche", run: (S, c) => {
      const j = S.joueurs[c.p];
      if (c.choix.length) { gainVeille(S, c.p, -1); gainXP(S, c.p, c.choix[c.choix.length - 1], 1); }
      const o = DOMAINES.filter(d => j.xp[d] < MAX_PISTE);
      if (j.veille > 0 && o.length) return ask("domaine", o, `Convertissez vos Veilles (${j.veille} restantes) : piste ?`);
    } },

    // ---- Censures ajoutées le 08/11/2026 ----
    "BIO-1-6": { quand: "censure", run: () => {} }, // Contagion : appliquée au calcul des Veilles des joueurs censurés
    // Inoculation forcée : chaque autre joueur perd 1 XP dans sa piste la plus haute hors 7 ;
    // en cas d'égalité, c'est le joueur touché qui choisit la piste (Oni, 08/11/2026)
    "BIO-2-6": { quand: "censure", run: (S, c) => {
      const L = autres(S, c.p);
      if (c.i === undefined) c.i = 0;
      if (c.touche !== undefined) { gainXP(S, c.touche, c.choix[c.choix.length - 1], -1, c.p); c.touche = undefined; c.i++; }
      while (c.i < L.length) {
        const q = L[c.i], x = S.joueurs[q].xp, P = DOMAINES.filter(d => x[d] > 0 && x[d] < MAX_PISTE);
        const m = P.length ? Math.max(...P.map(d => x[d])) : 0, hautes = P.filter(d => x[d] === m);
        if (hautes.length > 1) { c.touche = q; return { ...ask("domaine", hautes, `Inoculation forcée : ${nom(S, q)} choisit la piste qui perd 1 XP`), pour: q }; }
        if (hautes.length === 1) gainXP(S, q, hautes[0], -1, c.p);
        c.i++;
      }
    } },
    // Expropriation : voler un jeton de palier non utilisé (le voleur peut s'en servir à partir du tour suivant, À VALIDER)
    "BIO-3-4": { quand: "censure", run: (S, c) => {
      lire(c);
      const volables = q => S.joueurs[q].jetons.filter(t => !t.used);
      if (c.cible === undefined) {
        const L = autres(S, c.p).filter(q => volables(q).length);
        if (!L.length) { log(S, "Expropriation : aucun jeton à voler"); return; }
        c.attendu = "cible"; return ask("joueur", L, "Expropriation : à quel joueur volez-vous un jeton ?");
      }
      if (c.jeton === undefined) { const L = volables(c.cible).map(t => t.k); if (L.length === 1) c.jeton = L[0]; else { c.attendu = "jeton"; return ask("jeton", L, "Quel jeton volez-vous ?"); } }
      const t = S.joueurs[c.cible].jetons.find(x => x.k === c.jeton && !x.used);
      S.joueurs[c.cible].jetons = S.joueurs[c.cible].jetons.filter(x => x !== t);
      S.joueurs[c.p].jetons.push({ ...t, tour: S.tour });
      if (t.cle) S.paliers[t.cle] = c.p;
      log(S, `${nom(S, c.p)} vole le jeton « ${JETONS[t.cle] ? JETONS[t.cle].nom : t.k} » de ${nom(S, c.cible)}`);
    } },
    // Interception : regarder la prochaine carte d'une pile (en secret) et la placer sous la pile
    "PHYS-1-6": { quand: "censure", run: (S, c) => {
      if (!c.choix.length) { const L = DOMAINES.filter(d => S.piles[d].length >= 2); return L.length ? ask("domaine", L, "Interception : dans quelle pile ?") : log(S, "Interception : aucune pile assez grande"); }
      const d = c.choix[0];
      if (c.choix.length === 1) return { ...ask("ouinon", [true], `Prochaine carte de ${D(d)} : « ${carte(S.piles[d][0]).nom} ». Elle part sous la pile.`), prive: true };
      S.piles[d].push(S.piles[d].shift());
      log(S, `${nom(S, c.p)} place la prochaine carte ${D(d)} sous la pile`);
    } },
    // Inversion des pôles : échanger sa gemme avec celle d'un joueur
    "PHYS-1-7": { quand: "censure", run: (S, c) => {
      if (!c.choix.length) return ask("joueur", autres(S, c.p), "Inversion des pôles : avec qui échangez-vous votre gemme ?");
      const a = S.joueurs[c.p], b = S.joueurs[c.choix[0]];
      [a.gemme, b.gemme] = [b.gemme, a.gemme];
      log(S, `${a.nom} échange sa gemme avec ${b.nom} (${a.gemme} / ${b.gemme})`);
    } },
    // Gel des fonds : la carte visible du domaine censuré ne peut pas être acquise ce tour
    "ECO-2-6": { quand: "censure", run: S => { S.t.gel = S.t.censure; log(S, `Gel des fonds : la carte Progrès ${D(S.t.censure)} ne peut pas être acquise ce tour`); } },
    // Précipité : un joueur perd 1 Veille (même effet qu'Onde de Choc pour l'instant)
    "CHIM-1-6": { quand: "censure", run: (S, c) => {
      if (!c.choix.length) return ask("joueur", autres(S, c.p), "Un joueur perd 1 Veille");
      gainVeille(S, c.choix[0], -1, c.p);
    } },

    // jetons
    "J-regard": regard("jeton"),
    "J-veto": { quand: "veto", run: (S, c) => {
      if (!c.choix.length) {
        const o = autres(S, c.p).filter(q => !S.t.annules.includes(q));
        return ask("joueur", o, "Veto : annulez le vote de censure d'un adversaire (ou passez pour garder le jeton)", true);
      }
      if (c.choix[0] === null) return;
      useJeton(S, c.p, "veto"); S.t.annules.push(c.choix[0]);
      log(S, `${nom(S, c.p)} utilise son Veto : le vote de ${nom(S, c.choix[0])} est annulé`);
    } },
  };
  // Effets prévus pour l'étape 3 (effets « Tour suivant », cartes qui changent le déroulement du tour)
  const A_VENIR = ["BIO-3-3", "PHYS-1-5", "PHYS-2-2", "PHYS-2-3", "PHYS-3-1", "PHYS-3-2", "PHYS-3-3",
    "ECO-1-5", "ECO-2-3", "CHIM-2-3", "CHIM-2-4", "CHIM-3-2", "CHIM-3-3"];
  const programme = id => !!FX[id];

  // ---------- déroulement du tour ----------
  // 1. révélation : jetons annoncés, ordre de jeu, Vetos ; 2. décompte des votes (compterVotes) ; 3–4. résolution ; 5. acquisition
  function revelation(S) {
    const tous = S.joueurs.map((_, i) => i);
    S.t = { bloques: [], annules: [], vote2: [], immunes: [], normalFait: false, gel: null,
      jouees: tous.map(p => ({ r: carteJouee(S, p, "R"), c: carteJouee(S, p, "C") })) };
    for (const p of tous) for (const k of S.joueurs[p].prog.jetons || []) {
      useJeton(S, p, k);
      S.t[k === "vote2" ? "vote2" : "immunes"].push(p);
      log(S, `${nom(S, p)} révèle son jeton « ${k === "vote2" ? "Vote double" : "Immunité"} »`);
    }
    S.t.gemmes = tous.map(p => gemmeEff(S, p));
    S.ordre = calcOrdre(S, S.t.gemmes);
    echangerGemmes(S);
    const E = S.ordre.filter(p => jetonUtilisable(S, p, "veto")).map(p => ({ k: "fx", p, id: "J-veto", quand: "veto" }));
    E.push({ k: "vote" });
    S.etapes = E; S.phase = "resol";
    avancer(S);
  }

  function compterVotes(S) {
    const votes = { bio: 0, phys: 0, eco: 0, chim: 0 }, tous = S.joueurs.map((_, i) => i);
    // Mutation Cachée : vote double, quel que soit le résultat du vote (À VALIDER) ; jeton Vote double : ×2
    for (const p of tous) if (!S.t.annules.includes(p))
      votes[S.joueurs[p].prog.c] += (S.t.jouees[p].c === "BIO-1-5" ? 2 : 1) * (S.t.vote2.includes(p) ? 2 : 1);
    const max = Math.max(...Object.values(votes));
    const censure = DOMAINES.filter(d => votes[d] === max).sort((a, b) => S.hier.indexOf(b) - S.hier.indexOf(a))[0]; // égalité : le plus bas
    const haut = S.hier[0];
    log(S, `Tour ${S.tour} — votes : ${DOMAINES.map(d => D(d) + " " + votes[d]).join(", ")} → ${D(censure)} est censuré`);
    Object.assign(S.t, { votes, censure,
      actives: tous.filter(p => !S.t.annules.includes(p) && S.joueurs[p].prog.c === censure),
      censures: tous.filter(p => S.joueurs[p].prog.r === censure && !S.t.immunes.includes(p)) });
    for (const p of S.t.immunes) if (S.joueurs[p].prog.r === censure) log(S, `${nom(S, p)} est immunisé : sa Recherche n'est pas censurée`);
    // compteurs des objectifs liés au vote
    for (const p of tous) for (const o of S.joueurs[p].objectifs) {
      const active = S.t.actives.includes(p);
      if (o.id === "O-MARTYR") o.n = S.t.censures.includes(p) ? o.n + 1 : 0;
      if (o.id === "O-CENS2") o.n = active ? o.n + 1 : 0;
      if (o.id === "O-HAUT" && active && censure === haut) o.ok = true;
      if (o.id === "O-SEUL" && active && S.t.actives.length === 1) o.ok = true;
    }
    const E = [];
    const fx = (p, id, quand) => { const f = FX[id]; if (f && f.quand === quand) E.push({ k: "fx", p, id, quand }); else if (!f && A_VENIR.includes(id) && quand === (carte(id).type === "C" ? "censure" : "recherche")) E.push({ k: "avenir", p, id }); };
    // Phase 3 : effets des Censures ayant visé le domaine censuré, puis Veilles (Oni, 07/11/2026) :
    // +1 par Censure efficace (+1 de plus si le domaine censuré est à 7 chez un adversaire qui a un objectif : chasse au leader),
    // +2 par joueur censuré (3 si Lobby Vert est efficace). Veilles données après les effets des Censures (À VALIDER).
    for (const p of S.ordre) if (S.t.actives.includes(p)) fx(p, S.t.jouees[p].c, "censure");
    for (const p of S.ordre) if (S.t.actives.includes(p)) {
      const prime = autres(S, p).some(q => S.joueurs[q].objectifs.length && S.joueurs[q].xp[censure] >= MAX_PISTE);
      E.push({ k: "veille", p, n: prime ? 2 : 1, raison: prime ? "Censure efficace + chasse au leader" : "Censure efficace" });
    }
    const lobby = S.t.actives.some(p => S.t.jouees[p].c === "ECO-1-5"), contagion = S.t.actives.some(p => S.t.jouees[p].c === "BIO-1-6");
    const nV = (lobby ? 3 : 2) - (contagion ? 1 : 0);
    for (const p of S.ordre) if (S.t.censures.includes(p)) { E.push({ k: "veille", p, n: nV, raison: "Recherche censurée" + (lobby ? " (Lobby Vert)" : "") + (contagion ? " (Contagion)" : "") }); fx(p, S.t.jouees[p].r, "censure_r"); }
    // Phase 4 : Recherches non censurées (+1 XP de base, puis effet)
    for (const p of S.ordre) if (!S.t.censures.includes(p)) {
      const id = S.t.jouees[p].r;
      if (FX[id] && FX[id].quand === "base") fx(p, id, "base"); else E.push({ k: "xp", p });
      fx(p, id, "recherche");
    }
    E.push({ k: "acq" });
    S.etapes = E.concat(S.etapes);
  }

  function avancer(S) {
    verifier(S);
    while (!S.attente && S.gagnant === null && S.etapes.length) {
      const e = S.etapes.shift();
      if (e.k === "veille") avecCause(e.raison, () => gainVeille(S, e.p, e.n));
      else if (e.k === "xp") avecCause("Recherche", () => gainXP(S, e.p, S.joueurs[e.p].prog.r, 1));
      else if (e.k === "vote") compterVotes(S);
      else if (e.k === "avenir") log(S, `« ${carte(e.id).nom} » : effet pas encore programmé dans le prototype`);
      else if (e.k === "fx") { const ctx = { p: e.p, id: e.id, quand: e.quand, choix: [] }; poser(S, ctx, avecCause(`${nomSource(e.id)} de ${nom(S, e.p)}`, () => FX[e.id].run(S, ctx))); }
      else if (e.k === "acq") debutAcquisition(S);
      verifier(S);
    }
  }
  function poser(S, ctx, demande) {
    if (!demande || (!demande.options.length && !demande.passer)) { S.attente = null; return; }
    S.attente = { p: demande.pour !== undefined ? demande.pour : ctx.p, ctx, demande };
  }

  function debutAcquisition(S) {
    S.phase = "acq";
    S.ordre = calcOrdre(S, S.t.gemmes); // recalculé : la hiérarchie a pu changer (Antimatière) (À VALIDER)
    S.acq = -1; suivantAcq(S);
  }
  function suivantAcq(S) {
    S.t.normalFait = false;
    do S.acq++; while (S.acq < S.ordre.length && S.t.bloques.includes(S.ordre[S.acq]));
    if (S.acq >= S.ordre.length) finTour(S);
  }
  function finTour(S) {
    for (const j of S.joueurs) { j.verrou = ["R-" + j.prog.r, "C-" + j.prog.c]; j.prog = null; }
    enHaut(S, S.t.censure);
    (S.histo = S.histo || []).push({ tour: S.tour, dom: S.t.censure, votes: S.t.votes }); // historique des censures (affichage)
    S.dernier = S.t; S.t = null; S.tour++; S.phase = "prog"; S.ordre = [];
  }

  // ---------- point d'entrée unique des actions ----------
  // Renvoie "" si l'action est appliquée, sinon la raison du refus.
  const ANNONCES = ["vote2", "immunite"]; // jetons annoncés face cachée avec la programmation
  const ACTIONS = {
    programmer(S, p, { r, c, jetons = [] } = {}) {
      if (S.phase !== "prog") return "Ce n'est pas la phase de programmation";
      const j = S.joueurs[p];
      if (j.prog) return "Vous avez déjà programmé vos cartes";
      if (!DOMAINES.includes(r) || !DOMAINES.includes(c)) return "Choisissez une Recherche et une Censure";
      if (j.verrou.includes("R-" + r)) return "Cette Recherche est verrouillée ce tour";
      if (j.verrou.includes("C-" + c)) return "Cette Censure est verrouillée ce tour";
      if (!Array.isArray(jetons) || jetons.some(k => !ANNONCES.includes(k) || !jetonUtilisable(S, p, k)) || new Set(jetons).size !== jetons.length)
        return "Jeton non disponible";
      j.prog = { r, c, jetons };
      if (S.joueurs.every(x => x.prog)) revelation(S);
      return "";
    },
    annuler(S, p) {
      if (S.phase !== "prog" || !S.joueurs[p].prog) return "Rien à annuler";
      S.joueurs[p].prog = null; return "";
    },
    choisir(S, p, { v } = {}) {
      const a = S.attente;
      if (!a || a.p !== p) return "Aucun choix attendu de votre part";
      if (v === null || v === undefined) { if (!a.demande.passer) return "Un choix est obligatoire"; v = null; }
      else if (!a.demande.options.includes(v)) return "Choix impossible";
      a.ctx.choix.push(v);
      S.attente = null;
      poser(S, a.ctx, avecCause(`${nomSource(a.ctx.id)} de ${nom(S, a.ctx.p)}`, () => FX[a.ctx.id].run(S, a.ctx)));
      avancer(S);
      return "";
    },
    convertir(S, p, { dom } = {}) {
      const j = S.joueurs[p], cout = jetonUtilisable(S, p, "conversion") ? 2 : 3;
      if (j.veille < cout) return `Il faut ${cout} Veilles`;
      if (!DOMAINES.includes(dom) || j.xp[dom] >= MAX_PISTE) return "Piste invalide ou pleine";
      avecCause(`conversion de ${cout} Veilles`, () => { gainVeille(S, p, -cout); gainXP(S, p, dom, 1); });
      return "";
    },
    // jeton à usage libre (Regard vers l'avenir)
    jeton(S, p, { k } = {}) {
      if (k !== "regard") return "Ce jeton ne s'utilise pas ainsi";
      if (S.attente) return "Un choix est en cours";
      if (!jetonUtilisable(S, p, "regard")) return "Jeton non disponible";
      const ctx = { p, id: "J-regard", quand: "jeton", choix: [] };
      poser(S, ctx, FX["J-regard"].run(S, ctx));
      return "";
    },
    // acquisition normale (il faut atteindre le coût) ou, avec le jeton Progrès gratuit, une acquisition en plus sans condition de coût
    acquerir(S, p, { dom, gratuit = false } = {}) {
      if (S.phase !== "acq" || S.ordre[S.acq] !== p) return "Ce n'est pas votre tour d'acquérir";
      if (S.attente) return "Un choix est en cours";
      const id = S.visibles[dom];
      if (!id) return "Aucune carte visible dans ce domaine";
      if (S.t.gel === dom) return "Gel des fonds : cette carte ne peut pas être acquise ce tour";
      const k = carte(id), j = S.joueurs[p];
      if (gratuit) { if (!jetonUtilisable(S, p, "achat2")) return "Jeton Progrès gratuit non disponible"; }
      else if (S.t.normalFait) return "Vous avez déjà fait votre acquisition normale";
      else if (!peutPayer(j, k.cout)) return "Expérience insuffisante";
      const slot = k.type + "-" + k.dom, ancien = j.cartes[slot];
      // la nouvelle carte prend la place de l'ancienne, verrouillée ou non (À VALIDER)
      j.cartes[slot] = id; j.achats = (j.achats || 0) + 1;
      if (!carte(ancien).depart) S.defausse.push(ancien);
      log(S, `${j.nom} acquiert « ${k.nom} » (remplace « ${carte(ancien).nom} »)`);
      reveler(S, dom);
      if (gratuit) { useJeton(S, p, "achat2"); log(S, `${j.nom} utilise son jeton Progrès gratuit`); }
      else S.t.normalFait = true;
      // le tour d'acquisition continue tant que le joueur peut encore utiliser l'une des deux acquisitions
      if (S.t.normalFait && !jetonUtilisable(S, p, "achat2")) suivantAcq(S);
      return "";
    },
    passer(S, p) {
      if (S.phase !== "acq" || S.ordre[S.acq] !== p) return "Ce n'est pas votre tour";
      if (S.attente) return "Un choix est en cours";
      suivantAcq(S); return "";
    },
  };
  function apply(S, p, type, args) {
    if (S.gagnant !== null) return "Partie terminée";
    if (!(p >= 0 && p < S.joueurs.length)) return "Joueur inconnu";
    const f = ACTIONS[type];
    if (!f) return "Action inconnue";
    const r = f(S, p, args || {});
    if (!r) verifier(S);
    return r;
  }

  // Qui doit agir maintenant (liste d'indices de joueurs)
  function attendus(S) {
    if (S.gagnant !== null) return [];
    const L = [];
    if (S.attente) L.push(S.attente.p);
    if (S.phase === "prog") S.joueurs.forEach((j, i) => { if (!j.prog && !L.includes(i)) L.push(i); });
    if (S.phase === "acq" && !S.attente) L.push(S.ordre[S.acq]);
    return L;
  }

  // Vue envoyée à un joueur : programmation des autres cachée, ordre des piles et des objectifs caché,
  // choix secrets (Regard, Compost…) cachés aux autres joueurs
  function viewFor(S, p) {
    const V = JSON.parse(JSON.stringify(S));
    if (S.phase === "prog") V.joueurs.forEach((j, i) => { if (i !== p && j.prog) j.prog = { cache: true }; });
    for (const d of DOMAINES) V.piles[d] = { reste: S.piles[d].length, suivant: S.piles[d][0] ? carte(S.piles[d][0]).type : null };
    V.objPile = { reste: S.objPile.length };
    if (S.attente && S.attente.demande.prive && S.attente.p !== p)
      V.attente = { p: S.attente.p, ctx: { id: S.attente.ctx.id }, demande: { type: S.attente.demande.type, prive: true, options: [], texte: `${nom(S, S.attente.p)} fait un choix secret` } };
    return V;
  }

  return { VERSION, setRng, shuffle, newGame, apply, ACTIONS, attendus, viewFor, carte, disponibles, peutPayer,
    jetonUtilisable, programme, A_VENIR, FX, OK, DOMAINES, PAR_ID, OBJ, JETONS };
})();
if (typeof module !== "undefined") module.exports = EK;
