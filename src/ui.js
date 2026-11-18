// Interface d'Eurekaïe ! — partie sur un seul appareil (chacun son tour, écran de passage pour les choix secrets).
// Rendu par innerHTML ; tous les clics passent par [data-a] → handle(a, d). Toutes les règles sont dans EK (engine.js).
const UI = (() => {
  const C = CARTES, E = EK, DOM = C.DOMAINES, D = d => C.NOM_DOMAINE[d];
  const CLE = "eurekaie-partie", CLE_THEME = "eurekaie-theme", CLE_STATS = "eurekaie-stats";
  const COUL_J = ["#f59f00", "#82c91e", "#f06595", "#4dabf7", "#e9ecef"];
  let S = null;
  let ui = { voit: null, sel: { r: null, c: null, jetons: [] }, conv: null, msg: "", nbj: 4, noms: ["", "", "", "", ""],
    ia: [false, true, true, true, true], vitesse: 600, minuteur: null,
    page: null, statsIA: true, statsVer: null, statsOuvert: null,
    pause: false, unPas: false, bulles: [], aide: null, jFiltre: null, jTout: false, snap: null, snapS: null };
  const CLE_ANIM = "eurekaie-animations", CLE_DECOUV = "eurekaie-decouverte", CLE_VUS = "eurekaie-conseils-vus";
  const estIA = p => !!S.joueurs[p].ia;
  const humains = () => S.joueurs.filter(j => !j.ia).length;

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const stocker = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const lire = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const sauver = () => stocker(CLE, JSON.stringify(S));
  const charger = () => { try { const t = lire(CLE); return t ? JSON.parse(t) : null; } catch (e) { return null; } };
  const nomJ = p => esc(S.joueurs[p].nom);
  // lettre du pion : l'initiale, ou le numéro du joueur si deux joueurs ont la même initiale
  const initiale = p => (S.joueurs[p].nom.trim()[0] || "").toUpperCase();
  const lettre = p => (initiale(p) && S.joueurs.filter((_, q) => initiale(q) === initiale(p)).length === 1 ? initiale(p) : String(p + 1));
  const pion = p => `<span class="pion" style="--pj:${COUL_J[p]}" title="${nomJ(p)}">${esc(lettre(p))}</span>`;
  const NOM_JETON = {}; for (const k of Object.keys(C.JETONS)) NOM_JETON[C.JETONS[k].k] = C.JETONS[k];

  // ---------- qui doit voir l'écran en secret ----------
  function secretPour() {
    if (!S || S.gagnant !== null) return null;
    let p = null;
    if (S.attente && S.attente.demande.prive) p = S.attente.p;
    else if (S.phase === "prog" && !S.attente) { const L = E.attendus(S).filter(q => !estIA(q)); p = L.length ? L[0] : null; }
    if (p === null || estIA(p)) return null;
    if (humains() <= 1) ui.voit = p; // un seul humain : pas besoin d'écran de passage
    return p;
  }
  // l'IA joue toute seule, avec un petit délai pour qu'on puisse suivre
  function tourIA() {
    if (ui.minuteur || !S || S.gagnant !== null || (ui.pause && !ui.unPas)) return;
    const p = E.attendus(S).find(q => estIA(q));
    if (p === undefined) return;
    const delai = ui.unPas ? 0 : S.phase === "prog" && !S.attente ? 50 : ui.vitesse;
    ui.minuteur = setTimeout(() => {
      ui.minuteur = null; ui.unPas = false;
      const avant = { attente: S.attente, visibles: { ...S.visibles }, phase: S.phase };
      try { const act = IA.jouer(S, p); if (act) bulle(p, act, avant); } catch (e) { ui.msg = String(e.message || e); }
      sauver(); render();
    }, delai);
  }
  // bulle « ce que l'IA vient de faire » (sans rien révéler de secret)
  function bulle(p, act, avant) {
    let t = "";
    if (act.type === "programmer") t = "a programmé ses cartes";
    else if (act.type === "choisir") t = avant.attente && avant.attente.demande.prive ? "fait un choix secret"
      : `choisit ${act.args.v === null ? "de passer" : libelle(avant.attente ? avant.attente.demande.type : "", act.args.v).replace(/<[^>]+>/g, "")}`;
    else if (act.type === "acquerir") t = `acquiert « ${esc(E.carte(avant.visibles[act.args.dom]).nom)} »${act.args.gratuit ? " (Progrès gratuit)" : ""}`;
    else if (act.type === "passer") t = "n'acquiert rien";
    else if (act.type === "convertir") t = `convertit ses Veilles : +1 XP ${D(act.args.dom)}`;
    else if (act.type === "jeton") t = "utilise Regard vers l'avenir";
    ui.bulles = ui.bulles.concat([{ p, t, quand: Date.now() }]).slice(-4);
    setTimeout(() => { ui.bulles = ui.bulles.filter(b => Date.now() - b.quand < 4000); if (S && !document.querySelector(".voile-aide")) render(); }, 4100);
  }

  // ---------- morceaux de rendu ----------
  function cout(c) {
    return Object.entries(c.cout).map(([d, v]) => `<span class="pastille d-${d}" title="${D(d)} ${v}">${v}</span>`).join("");
  }
  // moment où l'effet d'une carte s'applique
  function quand(id) {
    const c = E.carte(id);
    if (c.depart) return null;
    if (id === "BIO-1-5") return { t: "Au vote", k: "vote" };
    if (E.A_VENIR.includes(id)) return { t: "Pas encore programmé", k: "avenir" };
    const f = E.FX[id];
    if (!f) return null;
    return { censure: { t: "Si votre Censure touche", k: "censure" }, recherche: { t: "Si votre Recherche passe", k: "recherche" },
      censure_r: { t: "Si votre Recherche est censurée", k: "censure_r" }, base: { t: "À la place du +1 XP", k: "recherche" } }[f.quand] || null;
  }
  function carteHTML(id, opt = {}) {
    if (!id) return `<div class="carte vide">Pile vide</div>`;
    const c = E.carte(id), tag = opt.bouton ? "button" : "div", q = quand(id);
    const attrs = opt.bouton ? ` data-a="${opt.a}" data-d="${esc(opt.d)}"${opt.off ? " disabled" : ""}` : "";
    const effet = c.depart ? `<span class="doux">Carte de base</span>` : esc(c.effet);
    return `<${tag} class="carte ${c.type} d-${c.dom}${opt.choisie ? " choisie" : ""}${opt.verrou ? " verrou" : ""}"${attrs}>
      <div class="haut"><span>${c.type === "R" ? "Recherche" : "Censure"}</span><span>${D(c.dom)}</span></div>
      <div class="nomc">${esc(c.nom)}</div>${q ? `<div class="quand q-${q.k}">${q.t}</div>` : ""}<div class="effet">${effet}${opt.verrou ? "<br><b>Verrouillée</b>" : ""}</div>
      <div class="bas">${cout(c)}<span class="niv">${"★".repeat(c.niveau)}</span></div></${tag}>`;
  }
  // domaine censuré à montrer sur le plateau : celui du tour en cours une fois les votes comptés, sinon celui du tour précédent
  function censureAffichee() {
    if (S.t && S.t.censure) return { dom: S.t.censure, votes: S.t.votes, tour: S.tour, encours: true };
    if (S.dernier && S.dernier.censure) return { dom: S.dernier.censure, votes: S.dernier.votes, tour: S.tour - 1, encours: false };
    return null;
  }
  function hierarchie() {
    const derniere = S.dernier && S.dernier.censure;
    let h = `<div class="hier" title="Le domaine le plus haut est prioritaire : ses chercheurs jouent en premier. En cas d'égalité de votes, le domaine le plus bas est censuré. Le domaine censuré passe tout en haut à la fin du tour.">
      <span class="doux">Hiérarchie :</span><span class="fleche">▲ prioritaire</span>${S.hier.map((d, i) =>
      `<span class="rang d-${d}">${i + 1}. ${D(d)}${d === derniere ? " <small>(censuré au tour précédent)</small>" : ""}${i === S.hier.length - 1 ? " <small>· censuré en cas d'égalité</small>" : ""}</span>`).join("")}</div>
      <p class="aide-ligne">Le plus haut joue en premier ; en cas d'égalité de votes, le plus bas est censuré ; le domaine censuré passe en haut à la fin du tour.</p>`;
    const histo = (S.histo || []).concat(S.t && S.t.censure ? [{ tour: S.tour, dom: S.t.censure }] : []);
    if (histo.length) h += `<div class="frise"><span class="doux">Censures :</span>${histo.slice(-14).map(x =>
      `<span class="d-${x.dom}" title="Tour ${x.tour} : ${D(x.dom)} censuré"><b>T${x.tour}</b> ${D(x.dom)}</span>`).join("")}</div>`;
    return h;
  }
  function pistes() {
    let h = "";
    for (const d of DOM) {
      const ce = censureAffichee(), cens = ce && ce.dom === d;
      const nbv = ce && ce.votes ? ce.votes[d] : 0;
      const vote = ce && ce.votes ? `<small>${nbv} vote${nbv > 1 ? "s" : ""}</small>` : "";
      h += `<div class="piste d-${d}${cens ? " censuree" + (ce.encours ? "" : " passee") : ""}"><div class="nom">${D(d)}${cens ? `<span class="bandeau">Censuré · T${ce.tour}</span>` : ""}${vote}</div>`;
      for (let v = 0; v <= 7; v++) {
        const cle = d + "-" + v, J = C.JETONS[cle];
        let inner = "";
        if (J) {
          const pris = S.paliers[cle];
          inner += `<div class="jeton-palier${pris !== null ? " pris" : ""}" title="${esc(J.texte)}">${esc(J.nom)}${pris !== null && pris >= 0 ? " " + nomJ(pris) : ""}</div>`;
        }
        S.joueurs.forEach((j, p) => { if (j.xp[d] === v) inner += pion(p).replace('class="pion"', `class="pion${v === 6 ? " proche" : ""}" data-p="${p}" data-d="${d}"`); });
        h += `<div class="case${J ? " palier" : ""}${v === 7 ? " sept" : ""}">${inner}<span class="num">${v === 7 ? "7 ★" : v}</span></div>`;
      }
      h += `</div>`;
    }
    return h;
  }
  function marche() {
    let h = `<div class="cartes">`;
    for (const d of DOM) {
      const reste = S.piles[d].length, suiv = S.piles[d][0] ? E.carte(S.piles[d][0]).type : null;
      h += `<div>${carteHTML(S.visibles[d])}<div class="sous">${reste} carte${reste > 1 ? "s" : ""} dessous${suiv ? " · suivante : " + (suiv === "R" ? "Recherche" : "Censure") : ""}</div></div>`;
    }
    h += `</div><p class="doux" style="margin:8px 0 0">Pioche d'objectifs : ${S.objPile.length} carte${S.objPile.length > 1 ? "s" : ""}${S.objDefausse.length ? ` · défausse : ${S.objDefausse.map(id => esc(C.OBJ[id].nom)).join(", ")}` : ""}</p>`;
    return h;
  }
  function etatJoueur(p) {
    const j = S.joueurs[p];
    if (S.phase === "prog") return j.prog ? "a programmé ✓" : "réfléchit…";
    if (S.t && S.t.jouees) {
      const jj = S.t.jouees[p], cens = S.t.censure && S.t.censures.includes(p);
      return `a joué ${esc(E.carte(jj.r).nom)}${cens ? " (censurée)" : ""} + ${esc(E.carte(jj.c).nom)}`;
    }
    return "";
  }
  function joueurHTML(p) {
    const j = S.joueurs[p], actif = E.attendus(S).includes(p);
    const gemme = E.jetonUtilisable(S, p, "gemmeOr") ? "Gemme d'or" : `gemme ${j.gemme}`;
    const coutConv = E.jetonUtilisable(S, p, "conversion") ? 2 : 3;
    let h = `<div class="bloc joueur${actif ? " actif" : ""}" style="--pj:${COUL_J[p]}">
      <div class="ligne">${pion(p)}<span class="nomj">${nomJ(p)}</span>${j.ia ? '<span class="pastille-ia">IA</span>' : ""}<span class="doux">${gemme} · <span class="veilles" data-veille="${p}">${j.veille} Veille${j.veille > 1 ? "s" : ""}</span></span></div>
      ${DOM.filter(d => j.xp[d] === 6).map(d => `<div class="alerte d-${d}">Proche de 7 en ${D(d)} : au prochain point, ${j.sept[d] ? "+2 Veilles" : "pioche d'un objectif"}</div>`).join("")}
      <div class="doux" style="font-size:13px">${etatJoueur(p)}</div><div class="mini">`;
    // une ligne de 4 Recherches, une ligne de 4 Censures (dans l'ordre des domaines)
    for (const t of ["R", "C"]) {
      h += `<b class="lib">${t === "R" ? "Rech." : "Cens."}</b>`;
      for (const d of DOM) {
        const s = t + "-" + d, c = E.carte(j.cartes[s]), lock = j.verrou.includes(s);
        h += `<span class="${t} d-${d}${lock ? " lock" : ""}" title="${esc(c.nom)} — ${esc(c.effet || "Carte de base")}${lock ? " (verrouillée)" : ""}">${esc(c.depart ? D(d) : c.nom)}</span>`;
      }
    }
    h += `</div>`;
    for (const o of j.objectifs) {
      const pr = progression(p, o);
      h += `<div class="obj"><b>${esc(C.OBJ[o.id].nom)}</b> — ${esc(C.OBJ[o.id].texte)}
        <div class="barre"><span style="width:${Math.round(100 * Math.min(1, pr.v / pr.max))}%"></span></div><small class="doux">${esc(pr.t)}</small></div>`;
    }
    if (j.jetons.length) h += `<div class="jetons">${j.jetons.map(t => `<span class="${t.used ? "use" : ""}" title="${esc(NOM_JETON[t.k] ? NOM_JETON[t.k].texte : "")}">${esc(NOM_JETON[t.k] ? NOM_JETON[t.k].nom : t.k)}${S.tour <= t.tour ? " (au prochain tour)" : ""}</span>`).join("")}</div>`;
    const libre = S.gagnant === null && !S.attente;
    h += `<div class="options">`;
    if (!j.ia && S.gagnant === null && j.veille >= coutConv) h += `<button class="petit" data-a="conv" data-d="${p}">Convertir ${coutConv} Veilles → 1 XP</button>`;
    if (!j.ia && libre && E.jetonUtilisable(S, p, "regard")) h += `<button class="petit" data-a="regard" data-d="${p}">Regard vers l'avenir</button>`;
    h += `</div>`;
    if (ui.conv === p) h += `<div class="options">${DOM.map(d => `<button class="petit d-${d}" data-a="convDom" data-d="${p}:${d}"${j.xp[d] >= 7 ? " disabled" : ""}>${D(d)}</button>`).join("")}<button class="petit" data-a="conv" data-d="-1">Annuler</button></div>`;
    return h + `</div>`;
  }
  // où en est un joueur de son objectif : { v, max, t }
  function progression(p, o) {
    const j = S.joueurs[p], x = j.xp, cartes = Object.values(j.cartes).map(id => E.carte(id));
    switch (o.id) {
      case "O-MARTYR": return { v: o.n, max: 2, t: `${o.n}/2 tours censuré d'affilée` };
      case "O-CENS2": return { v: o.n, max: 2, t: `${o.n}/2 censures efficaces d'affilée` };
      case "O-HAUT": return { v: 0, max: 1, t: `à faire : censurer ${D(S.hier[0])} (en haut en ce moment)` };
      case "O-SEUL": return { v: 0, max: 1, t: "à faire : être le seul à voter pour le domaine censuré" };
      case "O-PAIRE": {
        const sept = DOM.filter(d => x[d] >= 7);
        if (!sept.length) return { v: 0, max: 1, t: "aucune piste à 7" };
        const autres = DOM.filter(d => d !== sept[0]).map(d => x[d]);
        return { v: autres.filter(y => y === Math.max(...autres)).length - 1, max: 2, t: `pistes hors 7 : ${autres.join(" / ")} (doivent être égales, au moins 1)` };
      }
      case "O-VEILLE6": return { v: j.veille, max: 6, t: `${j.veille}/6 Veilles` };
      case "O-VOL4": return { v: o.n, max: 4, t: `${o.n}/4 Veilles prises aux adversaires` };
      case "O-SANSBASE": { const n = cartes.filter(c => c.depart).length; return { v: 8 - n, max: 8, t: `encore ${n} carte${n > 1 ? "s" : ""} de base en main` }; }
      case "O-NIV3": { const n = cartes.filter(c => c.niveau === 3).length; return { v: n, max: 2, t: `${n}/2 cartes de niveau 3` }; }
      case "O-SEPTHAUT": { const L = DOM.filter(d => x[d] >= 7); return { v: L.includes(S.hier[0]) ? 1 : 0, max: 1, t: L.length ? `à 7 : ${L.map(D).join(", ")} ; en haut : ${D(S.hier[0])}` : "aucune piste à 7" }; }
      case "O-XP2": return { v: o.v.length, max: 2, t: `${o.v.length}/2 joueurs touchés${o.v.length ? " (" + o.v.map(q => S.joueurs[q].nom).join(", ") + ")" : ""}` };
      case "O-QUATRE": { const n = DOM.filter(d => x[d] >= 4).length; return { v: n, max: 4, t: `${n}/4 pistes à 4 ou plus` }; }
      case "O-SABOTEUR": return { v: o.n, max: 1, t: o.n ? "fait" : "à faire : Sabotage sur un adversaire" };
      default: return { v: 0, max: 1, t: "" };
    }
  }
  function libelle(type, v) {
    if (v === true) return "Oui";
    if (v === false) return "Non";
    if (type === "joueur") return nomJ(v);
    if (type === "domaine") return D(v);
    if (type === "jeton") return esc(NOM_JETON[v] ? NOM_JETON[v].nom : v);
    if (type === "objectif") return `${esc(C.OBJ[v].nom)} <span class="doux">— ${esc(C.OBJ[v].texte)}</span>`;
    return esc(v);
  }
  function action() {
    let h = `<div class="bloc action">${ui.msg ? `<div class="toast">${esc(ui.msg)}</div>` : ""}${conseil()}`;
    if (S.gagnant !== null) return h + `<div class="consigne">Partie terminée : ${nomJ(S.gagnant)} gagne !</div><button class="prim" data-a="menu">Nouvelle partie</button></div>`;
    const a = S.attente;
    const auxIA = E.attendus(S).filter(q => estIA(q));
    if (auxIA.length && (a ? estIA(a.p) : S.phase === "acq" || E.attendus(S).every(q => estIA(q))))
      return h + `<div class="consigne">${auxIA.map(nomJ).join(", ")} (IA) ${S.phase === "prog" && !a ? "programme" : "réfléchit"}…</div></div>`;
    if (a) {
      const carteSrc = E.PAR_ID[a.ctx.id] ? `« ${esc(E.carte(a.ctx.id).nom)} »` : "Jeton";
      h += `<div class="consigne">${nomJ(a.p)} — ${carteSrc} : ${esc(a.demande.texte)}</div><div class="options">`;
      for (const v of a.demande.options) h += `<button data-a="choix" data-d="${esc(JSON.stringify(v))}">${libelle(a.demande.type, v)}</button>`;
      if (a.demande.passer) h += `<button data-a="choix" data-d="null">Passer</button>`;
      return h + `</div></div>`;
    }
    if (S.phase === "prog") {
      const p = ui.voit, j = S.joueurs[p], libres = E.disponibles(S, p);
      h += `<div class="consigne">${nomJ(p)}, programmez une Recherche et une Censure (en secret)</div>`;
      for (const t of ["R", "C"]) {
        h += `<div class="rangee"><h3>${t === "R" ? "Recherche : le domaine où vous voulez progresser" : "Censure : le domaine que vous voulez priver de financement"}</h3><div class="cartes">`;
        for (const d of DOM) {
          const s = t + "-" + d, verrou = !libres.includes(s);
          h += carteHTML(j.cartes[s], { bouton: true, a: "sel" + t, d, off: verrou, verrou, choisie: ui.sel[t === "R" ? "r" : "c"] === d });
        }
        h += `</div></div>`;
      }
      h += apercu(p);
      const ann = ["vote2", "immunite"].filter(k => E.jetonUtilisable(S, p, k));
      if (ann.length) h += `<div class="options">${ann.map(k => `<label><input type="checkbox" data-a="jet" data-d="${k}"${ui.sel.jetons.includes(k) ? " checked" : ""}> Utiliser « ${esc(NOM_JETON[k].nom)} »</label>`).join("")}</div>`;
      return h + `<div class="options"><button class="prim" data-a="valider"${ui.sel.r && ui.sel.c ? "" : " disabled"}>Valider ma programmation</button></div></div>`;
    }
    if (S.phase === "acq") {
      const p = S.ordre[S.acq], j = S.joueurs[p];
      const gratuit = E.jetonUtilisable(S, p, "achat2");
      h += `<div class="consigne">${nomJ(p)} : acquisition d'une carte Progrès${S.t.normalFait ? " (acquisition normale faite)" : ""}</div>
        <p class="doux" style="margin:0 0 6px">L'XP n'est pas dépensée : il suffit d'atteindre le coût. La carte remplace celle du même type et du même domaine.${S.t.gel ? ` <b>Gel des fonds : la carte ${D(S.t.gel)} est bloquée ce tour.</b>` : ""}</p><div class="cartes">`;
      for (const d of DOM) {
        const id = S.visibles[d];
        if (!id) { h += carteHTML(null); continue; }
        const k = E.carte(id), slot = k.type + "-" + k.dom, ancien = E.carte(j.cartes[slot]);
        h += `<div>${carteHTML(id, { bouton: true, a: "acq", d, off: S.t.normalFait || S.t.gel === d || !E.peutPayer(j, k.cout) })}
          <div class="sous">Remplacerait : <b>${esc(ancien.depart ? (k.type === "R" ? "Recherche " : "Censure ") + D(k.dom) + " (base)" : ancien.nom)}</b>${j.verrou.includes(slot) ? " — emplacement verrouillé ce tour, la nouvelle carte le restera" : ""}</div></div>`;
      }
      h += `</div>`;
      if (gratuit) h += `<div class="rangee" style="margin-top:8px"><b>Progrès gratuit</b> <span class="doux">(une fois, en plus de l'acquisition normale, sans condition de coût) :</span>
        <div class="options">${DOM.filter(d => S.visibles[d]).map(d => `<button class="petit" data-a="acqGratuit" data-d="${d}"${S.t.gel === d ? " disabled" : ""}>${esc(E.carte(S.visibles[d]).nom)}</button>`).join("")}</div></div>`;
      return h + `<div class="options"><button data-a="passerAcq">${S.t.normalFait ? "Terminer mon acquisition" : "Ne rien acquérir"}</button></div></div>`;
    }
    return h + `<div class="consigne">…</div></div>`;
  }

  // ---------- aperçu de la programmation (ce que donnerait le choix) ----------
  function apercu(p) {
    const j = S.joueurs[p], r = ui.sel.r, c = ui.sel.c, L = [];
    if (!r && !c) return "";
    if (r) {
      const x = j.xp[r], id = j.cartes["R-" + r], q = quand(id), rang = S.hier.indexOf(r);
      let t = x < 7 ? `<b>Recherche ${D(r)}</b> : si elle passe, ${x} → ${x + 1}` : `<b>Recherche ${D(r)}</b> : piste déjà à 7, le point donne +2 Veilles`;
      const J = C.JETONS[r + "-" + (x + 1)];
      if (J && S.paliers[r + "-" + (x + 1)] === null) t += ` — jeton « ${esc(J.nom)} » à prendre`;
      if (x + 1 === 7 && !j.sept[r]) t += " — vous piochez un objectif";
      L.push(t);
      if (!E.carte(id).depart && q) L.push(`« ${esc(E.carte(id).nom)} » : ${q.t.toLowerCase()} — ${esc(E.carte(id).effet)}`);
      L.push(`Si ${D(r)} est censurée : pas d'XP, mais 2 Veilles.`);
      if (rang === S.hier.length - 1) L.push(`<span class="risque">${D(r)} est en bas de la hiérarchie : censurée en cas d'égalité de votes.</span>`);
      if (rang === 0) L.push(`${D(r)} est en haut de la hiérarchie : protégée en cas d'égalité de votes.`);
      if (x >= 3 && S.joueurs.every((k, i) => i === p || k.xp[r] < x)) L.push(`<span class="risque">Vous menez en ${D(r)} : les autres pourraient la viser.</span>`);
      if (j.objectifs.length && x >= 7) L.push(`<span class="risque">Vous avez un objectif et 7 en ${D(r)} : chaque Censure efficace contre ce domaine rapporte 1 Veille de plus (chasse au leader).</span>`);
    }
    if (c) {
      const id = j.cartes["C-" + c], q = quand(id);
      let t = `<b>Censure ${D(c)}</b> : si ${D(c)} est censurée, +1 Veille`;
      const cibles = S.joueurs.map((k, i) => i).filter(i => i !== p && S.joueurs[i].objectifs.length && S.joueurs[i].xp[c] >= 7);
      if (cibles.length) t += ` (+1 de plus : chasse au leader sur ${cibles.map(nomJ).join(", ")})`;
      L.push(t);
      if (!E.carte(id).depart && q) L.push(`« ${esc(E.carte(id).nom)} » : ${q.t.toLowerCase()} — ${esc(E.carte(id).effet)}`);
      if (r && c === r) L.push(`<span class="risque">Vous censurez le domaine que vous recherchez.</span>`);
    }
    return `<div class="apercu"><b>Aperçu</b><ul>${L.map(x => `<li>${x}</li>`).join("")}</ul></div>`;
  }

  // ---------- récapitulatif du tour (votes, cartes jouées, gains) ----------
  function recap() {
    const encours = !!(S.t && S.t.censure), T = encours ? S.t : S.dernier;
    if (!T || !T.censure || !T.jouees) return "";
    const tour = encours ? S.tour : (T.tour || S.tour - 1), fin = T.arrivee || S.joueurs.map(j => ({ xp: j.xp, veille: j.veille }));
    const max = Math.max(1, ...DOM.map(d => T.votes[d]));
    let h = `<div class="bloc recap"><h2>${encours ? `Tour ${tour} : ce qui s'est passé` : `Tour précédent (${tour}) : ce qui s'est passé`}</h2><div class="votes">`;
    for (const d of DOM) h += `<div class="vote d-${d}${d === T.censure ? " cens" : ""}"><span class="lib">${D(d)}</span><span class="b"><span style="width:${100 * T.votes[d] / max}%"></span></span><span>${T.votes[d]} vote${T.votes[d] > 1 ? "s" : ""}${d === T.censure ? " → <b>censuré</b>" : ""}</span></div>`;
    h += `</div><div class="tableau"><table><tr><th>Joueur</th><th>Recherche</th><th>Censure</th><th>Gains du tour</th></tr>`;
    S.joueurs.forEach((j, p) => {
      const jj = T.jouees[p], rc = E.carte(jj.r), cc = E.carte(jj.c);
      const censure = T.censures.includes(p), immun = T.immunes.includes(p) && rc.dom === T.censure, annule = T.annules.includes(p), efficace = T.actives.includes(p);
      const d0 = T.depart ? T.depart[p] : null, d1 = fin[p];
      const gains = d0 ? DOM.filter(d => d1.xp[d] !== d0.xp[d]).map(d => `<span class="d-${d} gain">${d1.xp[d] > d0.xp[d] ? "+" : ""}${d1.xp[d] - d0.xp[d]} ${D(d)}</span>`).join(" ")
        + (d1.veille !== d0.veille ? ` <span class="gain">${d1.veille > d0.veille ? "+" : ""}${d1.veille - d0.veille} Veille${Math.abs(d1.veille - d0.veille) > 1 ? "s" : ""}</span>` : "") : "";
      h += `<tr><td>${pion(p)} ${nomJ(p)}</td>
        <td><span class="pastille d-${rc.dom}">${D(rc.dom)}</span> ${esc(rc.nom)} ${censure ? '<b class="ko">✖ censurée</b>' : immun ? '<b class="ok">🛡 immunisée</b>' : '<span class="ok">✔ passe</span>'}</td>
        <td><span class="pastille d-${cc.dom}">${D(cc.dom)}</span> ${esc(cc.nom)} ${annule ? '<b class="ko">annulée (Veto)</b>' : efficace ? '<span class="ok">✔ efficace</span>' : '<span class="doux">sans effet</span>'}</td>
        <td>${gains || '<span class="doux">rien</span>'}</td></tr>`;
    });
    return h + `</table></div></div>`;
  }

  // ---------- journal regroupé par tour et par partie du tour ----------
  function icone(t) {
    if (/gagne la partie/.test(t)) return "🏆";
    if (/\+\d+ XP/.test(t)) return "▲";
    if (/-\d+ XP/.test(t)) return "▼";
    if (/Veille/.test(t)) return "◆";
    if (/acquiert/.test(t)) return "✚";
    if (/objectif/.test(t)) return "★";
    if (/jeton/i.test(t)) return "●";
    if (/votes/.test(t)) return "⚖";
    return "·";
  }
  function journal() {
    const f = ui.jFiltre !== null && S.joueurs[ui.jFiltre] ? S.joueurs[ui.jFiltre].nom : null;
    const L = S.log.filter(l => !f || l.txt.includes(f));
    const tours = [...new Set(L.map(l => l.tour))].sort((a, b) => b - a);
    let h = `<div class="options filtre"><button class="petit${ui.jFiltre === null ? " prim" : ""}" data-a="jFiltre" data-d="">Tous</button>${S.joueurs.map((j, p) => `<button class="petit${ui.jFiltre === p ? " prim" : ""}" data-a="jFiltre" data-d="${p}">${nomJ(p)}</button>`).join("")}</div><div class="journal">`;
    for (const t of tours.slice(0, ui.jTout ? 999 : 3)) {
      h += `<div class="jtour">Tour ${t}</div>`;
      let sec = null;
      for (const l of L.filter(x => x.tour === t)) {
        if ((l.sec || "") !== sec) { sec = l.sec || ""; if (sec) h += `<div class="jsec">${esc(sec)}</div>`; }
        h += `<div class="jl"><span class="ic">${icone(l.txt)}</span>${esc(l.txt)}</div>`;
      }
    }
    if (tours.length > 3) h += `<button class="petit" data-a="jTout">${ui.jTout ? "Masquer les anciens tours" : `Voir les ${tours.length - 3} tours précédents`}</button>`;
    return h + `</div>`;
  }

  // ---------- mode découverte : conseils au fil de la partie ----------
  const TIPS = [
    { id: "prog1", si: () => S.phase === "prog" && S.tour === 1, t: "Choisissez une Recherche (le domaine où vous progressez) et une Censure (le domaine à faire censurer). Le domaine le plus voté est censuré : ceux qui le recherchaient ne progressent pas, mais gagnent 2 Veilles. Chaque Censure qui a visé ce domaine rapporte 1 Veille." },
    { id: "verrou", si: () => S.phase === "prog" && S.tour >= 2, t: "Les 2 cartes jouées au tour précédent sont verrouillées (grisées) : vous choisissez parmi les 6 autres. Elles reviennent au tour suivant." },
    { id: "hier", si: () => S.phase === "prog" && S.tour >= 2, t: "La hiérarchie compte : en cas d'égalité de votes, le domaine le plus bas est censuré ; le plus haut joue en premier. Le domaine censuré passe en haut à la fin du tour." },
    { id: "acq", si: () => S.phase === "acq", t: "Acquisition : il suffit d'atteindre le coût en XP (l'XP n'est pas dépensée). La carte remplace celle du même type et du même domaine dans votre main. Le badge sous le nom indique quand son effet s'applique." },
    { id: "veilles", si: () => S.joueurs.some(j => !j.ia && j.veille >= 3), t: "Avec 3 Veilles, vous pouvez acheter 1 XP dans la piste de votre choix, à tout moment (bouton « Convertir » sur votre fiche)." },
    { id: "palier", si: () => S.joueurs.some(j => !j.ia && j.jetons.length), t: "Jeton de palier : le premier à atteindre 3 ou 5 sur une piste le prend. Il s'utilise à partir du tour suivant. Survolez-le pour voir son effet." },
    { id: "proche7", si: () => S.joueurs.some(j => DOM.some(d => j.xp[d] === 6)), t: "Un joueur est à 6 : au prochain point, il pioche un objectif public. Censurer son domaine le freine, et rapporte 1 Veille de plus s'il a déjà un objectif (chasse au leader)." },
    { id: "objectif", si: () => S.joueurs.some(j => j.objectifs.length), t: "Les objectifs sont publics : on gagne dès qu'un objectif est rempli. Prémonition, Compost, Sabotage et Mimétisme permettent de jouer avec la pioche et les objectifs des autres." },
  ];
  const vus = () => { try { return JSON.parse(lire(CLE_VUS) || "[]"); } catch (e) { return []; } };
  const decouverte = () => lire(CLE_DECOUV) !== "non";
  function conseil() {
    if (!decouverte() || S.gagnant !== null || humains() === 0) return "";
    const V = vus(), tip = TIPS.find(x => !V.includes(x.id) && x.si());
    return tip ? `<div class="conseil"><b>Conseil</b> ${tip.t}<div class="options"><button class="petit" data-a="vu" data-d="${tip.id}">Compris</button><button class="petit" data-a="decouverte">Désactiver les conseils</button></div></div>` : "";
  }

  // ---------- aide intégrée ----------
  function aide() {
    const ong = [["tour", "Un tour"], ["cartes", "Cartes"], ["veilles", "Veilles et hiérarchie"], ["jetons", "Jetons de palier"], ["objectifs", "Objectifs"]];
    let c = "";
    if (ui.aide === "tour") c = `<ol>
      <li><b>Programmation secrète</b> : chacun choisit 1 Recherche et 1 Censure parmi ses cartes non verrouillées.</li>
      <li><b>Révélation et vote</b> : chaque Censure est un vote. Le domaine le plus voté est censuré (égalité : le plus bas dans la hiérarchie).</li>
      <li><b>Censure</b> : les Censures qui ont visé le domaine censuré appliquent leur effet et rapportent 1 Veille. Les joueurs qui recherchaient ce domaine ne progressent pas et gagnent 2 Veilles.</li>
      <li><b>Recherche</b> : les autres avancent de 1 sur leur piste et appliquent l'effet de leur Recherche.</li>
      <li><b>Acquisition</b> : dans l'ordre de la hiérarchie, chacun peut acheter une carte Progrès dont il atteint le coût.</li>
      <li><b>Fin du tour</b> : les 2 cartes jouées sont verrouillées pour le tour suivant ; le domaine censuré passe en haut de la hiérarchie.</li></ol>
      <p>Une piste qui atteint 7 fait piocher un <b>objectif</b> public : on gagne dès qu'il est rempli.</p>`;
    if (ui.aide === "cartes") c = `<p>Chaque joueur a 8 emplacements : une Recherche et une Censure par domaine. Une carte Progrès achetée remplace celle du même type et du même domaine.</p>
      <p>Le coût est un <b>seuil</b> : l'XP n'est pas dépensée. Les 2 premières cartes de chaque pile coûtent 1 XP. Le dos de la carte suivante indique son type.</p>
      <p>Le badge sous le nom dit <b>quand l'effet s'applique</b> :</p><ul>
      <li><span class="quand q-censure">Si votre Censure touche</span> : seulement si votre Censure visait le domaine censuré.</li>
      <li><span class="quand q-recherche">Si votre Recherche passe</span> : seulement si votre Recherche n'est pas censurée.</li>
      <li><span class="quand q-censure_r">Si votre Recherche est censurée</span> : seulement dans ce cas.</li>
      <li><span class="quand q-vote">Au vote</span> : agit sur le décompte des votes.</li>
      <li><span class="quand q-avenir">Pas encore programmé</span> : effet pas encore disponible dans le prototype.</li></ul>`;
    if (ui.aide === "veilles") c = `<p><b>Gagner des Veilles</b> : +1 pour une Censure efficace (+1 de plus contre le domaine à 7 d'un adversaire qui a un objectif), +2 quand votre Recherche est censurée, +2 pour chaque point gagné sur une piste déjà à 7, et certaines cartes.</p>
      <p><b>Dépenser</b> : 3 Veilles = 1 XP dans la piste de votre choix, à tout moment (2 avec Conversion améliorée).</p>
      <p><b>Hiérarchie</b> : le domaine le plus haut est prioritaire (ses chercheurs jouent et achètent en premier). En cas d'égalité de votes, le plus bas est censuré. Le domaine censuré passe tout en haut à la fin du tour.</p>
      <p><b>Gemmes</b> : quand plusieurs joueurs recherchent le même domaine, la plus grande gemme passe d'abord, puis ils échangent leurs gemmes. La Gemme d'or gagne toujours.</p>`;
    if (ui.aide === "jetons") c = `<p>Le premier joueur qui atteint 3 ou 5 sur une piste prend le jeton. Il s'utilise à partir du tour suivant.</p><ul>${Object.entries(C.JETONS).map(([k, J]) => `<li><span class="pastille d-${k.split("-")[0]}">${D(k.split("-")[0])} ${k.split("-")[1]}</span> <b>${esc(J.nom)}</b> : ${esc(J.texte)}</li>`).join("")}</ul>`;
    if (ui.aide === "objectifs") c = `<p>Chaque piste qui atteint 7 (la première fois) fait piocher un objectif, visible de tous. On gagne <b>dès qu'un objectif est rempli</b>, même au moment de la pioche. Les objectifs marqués * ne comptent qu'à partir de la pioche.</p><ul>${Object.values(C.OBJ).map(o => `<li><b>${esc(o.nom)}</b> : ${esc(o.texte)}</li>`).join("")}</ul>`;
    return `<div class="voile voile-aide"><div class="boite-aide"><div class="ligne"><h2 style="flex:1;margin:0">Aide</h2><button class="petit" data-a="aide" data-d="">Fermer</button></div>
      <div class="options">${ong.map(([k, t]) => `<button class="petit${ui.aide === k ? " prim" : ""}" data-a="aide" data-d="${k}">${t}</button>`).join("")}</div><div class="contenu-aide">${c}</div></div></div>`;
  }

  // ---------- statistiques (gardées dans ce navigateur) ----------
  const lireStats = () => { try { return JSON.parse(lire(CLE_STATS) || "[]"); } catch (e) { return []; } };
  function enregistrer() {
    if (!S || S.gagnant === null || S.enregistre) return;
    const r = BILAN.resume(S), L = lireStats();
    L.push({ r, svg: BILAN.plateau(S) });
    stocker(CLE_STATS, JSON.stringify(L.slice(-300)));
    S.enregistre = r.id; sauver();
  }
  function pageStats() {
    const tout = lireStats();
    const L = tout.filter(x => ui.statsIA || x.r.ia < x.r.n).filter(x => !ui.statsVer || x.r.version === ui.statsVer).reverse();
    const moy = (a, b) => (b ? (a / b).toFixed(1) : "–");
    const V = BILAN.parVersion(tout.filter(x => ui.statsIA || x.r.ia < x.r.n).map(x => x.r));
    let h = `<div class="entete"><span class="titre">Statistiques des parties</span><span class="infos">${tout.length} partie${tout.length > 1 ? "s" : ""} enregistrée${tout.length > 1 ? "s" : ""} dans ce navigateur</span>
      <span class="outils"><button class="petit" data-a="statsRetour">Retour</button></span></div>`;
    h += `<div class="bloc"><h2>Par version</h2><div class="tableau"><table><tr><th>Version</th><th>Parties</th><th>Tours (moy.)</th><th>Cartes achetées / joueur</th><th>Victoires d'une IA</th><th>Victoires par objectif</th></tr>
      ${V.map(v => `<tr class="${ui.statsVer === v.version ? "sel" : ""}" data-a="statsVer" data-d="${esc(v.version)}"><td><b>v${esc(v.version)}</b></td><td>${v.n}</td><td>${moy(v.tours, v.n)}</td><td>${moy(v.achats, v.joueurs)}</td><td>${Math.round(100 * v.ia / v.n)} %</td>
        <td>${Object.entries(v.victoires).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${esc(k)} ×${n}`).join(", ")}</td></tr>`).join("") || `<tr><td colspan="6" class="doux">Aucune partie terminée pour l'instant.</td></tr>`}</table></div>
      <div class="options"><button class="petit" data-a="statsIA">Parties 100 % IA : ${ui.statsIA ? "affichées" : "masquées"}</button>
      ${ui.statsVer ? `<button class="petit" data-a="statsVer" data-d="">Toutes les versions</button>` : ""}
      <button class="petit" data-a="statsCsv"${tout.length ? "" : " disabled"}>Exporter en CSV</button><button class="petit" data-a="statsEffacer"${tout.length ? "" : " disabled"}>Effacer les statistiques</button></div></div>`;
    h += `<div class="bloc"><h2>${ui.statsVer ? "Parties de la v" + esc(ui.statsVer) : "Dernières parties"}</h2>`;
    for (const { r, svg } of L.slice(0, 60)) {
      const ouvert = ui.statsOuvert === r.id;
      h += `<div class="partie"><div class="ligne"><span class="doux">${new Date(r.date).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span>
        <span>v${esc(r.version)} · ${r.n} joueurs${r.ia ? ` (dont ${r.ia} IA)` : ""} · ${r.tours} tours</span>
        <span><b>${esc(r.gagnantNom)}</b>${r.gagnantIA ? " (IA)" : ""} gagne${r.victoire ? ` — ${esc(r.victoire)}` : ""}</span>
        <button class="petit" data-a="statsDetail" data-d="${esc(r.id)}">${ouvert ? "Masquer" : "Détails"}</button></div>`;
      if (ouvert) {
        h += `<div class="detail"><img class="plan" alt="Plateau en fin de partie" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}">
          <div class="frise"><span class="doux">Censures :</span>${r.censures.map((d, i) => `<span class="d-${d}"><b>T${i + 1}</b> ${C.NOM_DOMAINE[d]}</span>`).join("")}</div>
          <div class="tableau"><table><tr><th>Joueur</th><th>Bio / Phys / Éco / Chim</th><th>Veilles</th><th>Cartes achetées</th><th>Objectifs</th><th>Jetons</th><th>Main finale</th></tr>
          ${r.joueurs.map((j, q) => `<tr><td><span class="pion" style="--pj:${COUL_J[q]}">${q + 1}</span> ${esc(j.nom)}${j.ia ? " (IA)" : ""}</td><td>${DOM.map(d => j.xp[d]).join(" / ")}</td><td>${j.veille}</td><td>${j.achats}</td>
            <td>${j.objectifs.map(esc).join(", ") || "–"}</td><td>${j.jetons.map(esc).join(", ") || "–"}</td><td class="main">${j.main.map(esc).join(", ")}</td></tr>`).join("")}</table></div></div>`;
      }
      h += `</div>`;
    }
    if (!L.length) h += `<p class="doux">Aucune partie à afficher.</p>`;
    return h + `</div>`;
  }

  // ---------- écrans ----------
  function accueil() {
    const sauve = charger();
    let noms = "";
    for (let i = 0; i < ui.nbj; i++) noms += `<div class="ligne-nom"><input data-nom="${i}" placeholder="${ui.ia[i] ? "IA " + (i + 1) : "Joueur " + (i + 1)}" value="${esc(ui.noms[i])}">
      <button data-a="basculeIA" data-d="${i}"${ui.ia[i] ? ' class="prim"' : ""}>${ui.ia[i] ? "IA" : "Humain"}</button></div>`;
    return `<div class="ecran"><div class="boite"><h1>Eurekaïe !</h1><p class="doux">La course au savoir — prototype numérique, sur un seul appareil.</p>
      <div class="options" style="justify-content:center">${[2, 3, 4, 5].map(n => `<button data-a="nbj" data-d="${n}"${n === ui.nbj ? ' class="prim"' : ""}>${n} joueurs</button>`).join("")}</div>
      <div class="noms">${noms}</div>
      <div class="options" style="justify-content:center"><span class="doux">Vitesse de l'IA :</span>${[[1200, "lente"], [600, "normale"], [150, "rapide"]].map(([v, t]) => `<button class="petit${ui.vitesse === v ? " prim" : ""}" data-a="vitesse" data-d="${v}">${t}</button>`).join("")}</div>
      <div class="options" style="justify-content:center"><button class="prim" data-a="nouvelle">Nouvelle partie</button>
      ${sauve && sauve.gagnant === null ? `<button data-a="reprendre">Reprendre la partie (tour ${sauve.tour})</button>` : ""}</div>
      <div class="options" style="justify-content:center"><button class="petit" data-a="decouverte">Mode découverte (conseils) : ${decouverte() ? "oui" : "non"}</button>${decouverte() && vus().length ? '<button class="petit" data-a="revoir">Revoir les conseils</button>' : ""}</div>
      <div class="options" style="justify-content:center"><button class="petit" data-a="stats">Statistiques (${lireStats().length})</button></div></div></div>`;
  }
  function passage(p) {
    const pourquoi = S.attente ? "fait un choix secret" : "programme ses cartes";
    return `<div class="ecran"><div class="boite"><h1>${pion(p)} ${nomJ(p)}</h1><p>Passez l'appareil à <b>${nomJ(p)}</b>, qui ${pourquoi}.</p>
      <p class="doux">Les autres joueurs ne regardent pas l'écran.</p><button class="prim" data-a="voir" data-d="${p}">Je suis ${nomJ(p)}, afficher</button></div></div>`;
  }
  function jeu() {
    const ph = { prog: "programmation secrète", resol: "résolution", acq: "acquisition", fin: "partie terminée" }[S.phase];
    let h = `<div class="entete"><span class="titre">Eurekaïe !</span><span class="infos">Tour ${S.tour} · ${ph}</span>
      <span class="outils">${S.joueurs.some(j => j.ia) && S.gagnant === null ? `<button class="petit${ui.pause ? " prim" : ""}" data-a="pause">${ui.pause ? "▶ Reprendre l'IA" : "⏸ Pause IA"}</button>${ui.pause ? '<button class="petit" data-a="unPas">Pas à pas</button>' : ""}` : ""}
      <button class="petit" data-a="anim">Animations : ${animations() ? "oui" : "non"}</button><button class="petit" data-a="aide" data-d="tour">? Aide</button><button class="petit" data-a="theme">Thème</button><button class="petit" data-a="menu">Menu</button></span></div>
      <div class="grille"><div>${action()}${recap()}
      <div class="bloc"><h2>Plateau</h2>${hierarchie()}${pistes()}<p class="doux" style="margin:6px 0 0">Cases encadrées : jetons de palier (le premier joueur qui atteint la case le prend). Case 7 : on pioche un objectif.</p></div>
      <div class="bloc"><h2>Cartes Progrès disponibles</h2>${marche()}</div></div>
      <div>${S.joueurs.map((_, p) => joueurHTML(p)).join("")}
      <div class="bloc"><h2>Journal</h2>${journal()}</div></div></div>`;
    if (ui.bulles.length) h += `<div class="bulles">${ui.bulles.map(b => `<div class="bulle${Date.now() - b.quand < 300 ? " neuve" : ""}">${pion(b.p)} <b>${nomJ(b.p)}</b> ${b.t}</div>`).join("")}</div>`;
    if (ui.aide) h += aide();
    if (S.gagnant !== null) h += `<div class="voile"><div class="ecran" style="min-height:0"><div class="boite"><h1>${pion(S.gagnant)} ${nomJ(S.gagnant)} gagne !</h1>
      <p>${esc((S.log.slice().reverse().find(l => /gagne/.test(l.txt)) || { txt: "" }).txt)}</p><div class="options" style="justify-content:center"><button data-a="fermer">Voir le plateau</button><button data-a="stats" data-d="bilan">Bilan de la partie</button><button class="prim" data-a="menu">Nouvelle partie</button></div></div></div></div>`;
    return h;
  }
  function render() {
    const app = document.getElementById("app");
    enregistrer();
    if (ui.page === "stats") { app.innerHTML = `<div class="app">${pageStats()}</div>`; return; }
    if (!S) { app.innerHTML = `<div class="app">${accueil()}</div>`; return; }
    const sp = secretPour();
    if (sp !== null && ui.voit !== sp) { app.innerHTML = `<div class="app">${passage(sp)}</div>`; return; }
    app.innerHTML = `<div class="app">${jeu()}</div>`;
    if (ui.ferme) { const v = app.querySelector(".voile:not(.voile-aide)"); if (v) v.remove(); }
    animer(app);
    tourIA();
  }

  // ---------- animations sobres : pions qui bougent, Veilles qui changent, hiérarchie modifiée ----------
  function animations() {
    const v = lire(CLE_ANIM);
    if (v) return v === "oui";
    return !(typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function flotte(el, txt, cls) {
    const b = document.createElement("span"); b.className = "flotte " + cls; b.textContent = txt;
    el.appendChild(b); setTimeout(() => b.remove(), 1400);
  }
  function animer(app) {
    const snap = { xp: S.joueurs.map(j => ({ ...j.xp })), veille: S.joueurs.map(j => j.veille), hier: S.hier.join(), jetons: S.joueurs.map(j => j.jetons.length) };
    const avant = ui.snapS === S ? ui.snap : null;
    ui.snap = snap; ui.snapS = S;
    if (!avant || !animations()) return;
    S.joueurs.forEach((j, p) => {
      for (const d of DOM) {
        const dx = snap.xp[p][d] - avant.xp[p][d];
        if (!dx) continue;
        const el = app.querySelector(`.pion[data-p="${p}"][data-d="${d}"]`);
        if (el) { el.classList.add("bouge"); flotte(el, (dx > 0 ? "+" : "") + dx, dx > 0 ? "plus" : "moins"); }
      }
      const dv = snap.veille[p] - avant.veille[p], ev = app.querySelector(`[data-veille="${p}"]`);
      if (dv && ev) { ev.classList.add("eclat"); flotte(ev, (dv > 0 ? "+" : "") + dv, dv > 0 ? "plus" : "moins"); }
      if (snap.jetons[p] > avant.jetons[p]) { const ej = app.querySelectorAll(".joueur")[p]; if (ej) ej.classList.add("eclat-bloc"); }
    });
    if (snap.hier !== avant.hier) { const h = app.querySelector(".hier"); if (h) h.classList.add("eclat"); }
  }

  // ---------- actions ----------
  function jouer(p, type, args) {
    const r = E.apply(S, p, type, args);
    ui.msg = r || "";
    return !r;
  }
  function handle(a, d) {
    ui.msg = "";
    if (a === "nbj") ui.nbj = +d;
    else if (a === "basculeIA") ui.ia[+d] = !ui.ia[+d];
    else if (a === "vitesse") ui.vitesse = +d;
    else if (a === "nouvelle") {
      const noms = []; for (let i = 0; i < ui.nbj; i++) noms.push((ui.noms[i] || "").trim() || (ui.ia[i] ? "IA " : "Joueur ") + (i + 1));
      S = E.newGame({ noms }); S.joueurs.forEach((j, i) => { j.ia = ui.ia[i]; }); ui.voit = null; ui.ferme = false; ui.pause = false; ui.bulles = []; ui.jFiltre = null;
    }
    else if (a === "reprendre") { S = charger(); ui.voit = null; }
    else if (a === "menu") { if (!S || S.gagnant !== null || confirm("Quitter la partie en cours ? Elle reste sauvegardée et pourra être reprise.")) { S = null; clearTimeout(ui.minuteur); ui.minuteur = null; } }
    else if (a === "theme") {
      const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = t; stocker(CLE_THEME, t);
    }
    else if (a === "fermer") ui.ferme = true;
    else if (a === "pause") ui.pause = !ui.pause;
    else if (a === "unPas") ui.unPas = true;
    else if (a === "anim") stocker(CLE_ANIM, animations() ? "non" : "oui");
    else if (a === "aide") ui.aide = d || null;
    else if (a === "jFiltre") ui.jFiltre = d === "" ? null : +d;
    else if (a === "jTout") ui.jTout = !ui.jTout;
    else if (a === "vu") stocker(CLE_VUS, JSON.stringify(vus().concat([d])));
    else if (a === "decouverte") stocker(CLE_DECOUV, decouverte() ? "non" : "oui");
    else if (a === "revoir") stocker(CLE_VUS, "[]");
    else if (a === "stats") { ui.page = "stats"; ui.statsOuvert = d === "bilan" && S ? S.enregistre : null; }
    else if (a === "statsRetour") ui.page = null;
    else if (a === "statsVer") ui.statsVer = d || null;
    else if (a === "statsIA") ui.statsIA = !ui.statsIA;
    else if (a === "statsDetail") ui.statsOuvert = ui.statsOuvert === d ? null : d;
    else if (a === "statsEffacer") { if (confirm("Effacer toutes les statistiques enregistrées dans ce navigateur ?")) stocker(CLE_STATS, "[]"); }
    else if (a === "statsCsv") {
      const url = URL.createObjectURL(new Blob(["\ufeff" + BILAN.csv(lireStats().map(x => x.r))], { type: "text/csv;charset=utf-8" }));
      const l = document.createElement("a"); l.href = url; l.download = "eurekaie-statistiques.csv"; l.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    else if (a === "voir") ui.voit = +d;
    else if (a === "selR") ui.sel.r = d;
    else if (a === "selC") ui.sel.c = d;
    else if (a === "jet") ui.sel.jetons = ui.sel.jetons.includes(d) ? ui.sel.jetons.filter(k => k !== d) : ui.sel.jetons.concat([d]);
    else if (a === "valider") {
      if (jouer(ui.voit, "programmer", { r: ui.sel.r, c: ui.sel.c, jetons: ui.sel.jetons })) { ui.sel = { r: null, c: null, jetons: [] }; ui.voit = null; }
    }
    else if (a === "choix") {
      const prive = S.attente && S.attente.demande.prive;
      if (jouer(S.attente.p, "choisir", { v: JSON.parse(d) }) && prive) ui.voit = null;
    }
    else if (a === "acq") jouer(S.ordre[S.acq], "acquerir", { dom: d });
    else if (a === "acqGratuit") jouer(S.ordre[S.acq], "acquerir", { dom: d, gratuit: true });
    else if (a === "passerAcq") jouer(S.ordre[S.acq], "passer");
    else if (a === "conv") ui.conv = +d >= 0 ? +d : null;
    else if (a === "convDom") { const [p, dom] = d.split(":"); if (jouer(+p, "convertir", { dom })) ui.conv = null; }
    else if (a === "regard") { if (jouer(+d, "jeton", { k: "regard" })) ui.voit = +d; }
    if (S) sauver();
    render();
  }
  function start() {
    document.addEventListener("click", e => {
      const t = e.target.closest("[data-a]");
      if (!t || t.disabled) return;
      handle(t.dataset.a, t.dataset.d);
    });
    document.addEventListener("input", e => { if (e.target.dataset.nom !== undefined) ui.noms[+e.target.dataset.nom] = e.target.value; });
    render();
  }
  return { start, handle, etat: () => S };
})();
if (typeof document !== "undefined") UI.start();
