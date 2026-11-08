// Interface d'Eurekaïe ! — partie sur un seul appareil (chacun son tour, écran de passage pour les choix secrets).
// Rendu par innerHTML ; tous les clics passent par [data-a] → handle(a, d). Toutes les règles sont dans EK (engine.js).
const UI = (() => {
  const C = CARTES, E = EK, DOM = C.DOMAINES, D = d => C.NOM_DOMAINE[d];
  const CLE = "eurekaie-partie", CLE_THEME = "eurekaie-theme", CLE_STATS = "eurekaie-stats";
  const COUL_J = ["#f59f00", "#82c91e", "#f06595", "#4dabf7", "#e9ecef"];
  let S = null;
  let ui = { voit: null, sel: { r: null, c: null, jetons: [] }, conv: null, msg: "", nbj: 4, noms: ["", "", "", "", ""],
    ia: [false, true, true, true, true], vitesse: 600, minuteur: null,
    page: null, statsIA: true, statsVer: null, statsOuvert: null };
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
    if (ui.minuteur || !S || S.gagnant !== null) return;
    const p = E.attendus(S).find(q => estIA(q));
    if (p === undefined) return;
    const delai = S.phase === "prog" && !S.attente ? 50 : ui.vitesse;
    ui.minuteur = setTimeout(() => {
      ui.minuteur = null;
      try { IA.jouer(S, p); } catch (e) { ui.msg = String(e.message || e); }
      sauver(); render();
    }, delai);
  }

  // ---------- morceaux de rendu ----------
  function cout(c) {
    return Object.entries(c.cout).map(([d, v]) => `<span class="pastille d-${d}" title="${D(d)} ${v}">${v}</span>`).join("");
  }
  function carteHTML(id, opt = {}) {
    if (!id) return `<div class="carte vide">Pile vide</div>`;
    const c = E.carte(id), tag = opt.bouton ? "button" : "div";
    const attrs = opt.bouton ? ` data-a="${opt.a}" data-d="${esc(opt.d)}"${opt.off ? " disabled" : ""}` : "";
    const effet = c.depart ? `<span class="doux">Carte de base</span>` : esc(c.effet);
    return `<${tag} class="carte ${c.type} d-${c.dom}${opt.choisie ? " choisie" : ""}${opt.verrou ? " verrou" : ""}"${attrs}>
      <div class="haut"><span>${c.type === "R" ? "Recherche" : "Censure"}</span><span>${D(c.dom)}</span></div>
      <div class="nomc">${esc(c.nom)}</div><div class="effet">${effet}${opt.verrou ? "<br><b>Verrouillée</b>" : ""}</div>
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
    let h = `<div class="hier"><span class="doux">Hiérarchie :</span>${S.hier.map((d, i) =>
      `<span class="rang d-${d}">${i + 1}. ${D(d)}${d === derniere ? " <small>(censuré au tour précédent)</small>" : ""}</span>`).join("")}</div>`;
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
        S.joueurs.forEach((j, p) => { if (j.xp[d] === v) inner += pion(p); });
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
      <div class="ligne">${pion(p)}<span class="nomj">${nomJ(p)}</span>${j.ia ? '<span class="pastille-ia">IA</span>' : ""}<span class="doux">${gemme} · ${j.veille} Veille${j.veille > 1 ? "s" : ""}</span></div>
      <div class="doux" style="font-size:13px">${etatJoueur(p)}</div><div class="mini">`;
    for (const t of ["R", "C"]) for (const d of DOM) {
      const s = t + "-" + d, c = E.carte(j.cartes[s]);
      h += `<span class="${t} d-${d}${j.verrou.includes(s) ? " lock" : ""}" title="${esc(c.effet || "Carte de base")}">${esc(c.depart ? (t === "R" ? "R " : "C ") + D(d) : c.nom)}</span>`;
    }
    h += `</div>`;
    for (const o of j.objectifs) h += `<div class="obj"><b>${esc(C.OBJ[o.id].nom)}</b> — ${esc(C.OBJ[o.id].texte)}${o.n ? ` <span class="doux">(${o.n})</span>` : ""}</div>`;
    if (j.jetons.length) h += `<div class="jetons">${j.jetons.map(t => `<span class="${t.used ? "use" : ""}" title="${esc(NOM_JETON[t.k] ? NOM_JETON[t.k].texte : "")}">${esc(NOM_JETON[t.k] ? NOM_JETON[t.k].nom : t.k)}${S.tour <= t.tour ? " (au prochain tour)" : ""}</span>`).join("")}</div>`;
    const libre = S.gagnant === null && !S.attente;
    h += `<div class="options">`;
    if (!j.ia && S.gagnant === null && j.veille >= coutConv) h += `<button class="petit" data-a="conv" data-d="${p}">Convertir ${coutConv} Veilles → 1 XP</button>`;
    if (!j.ia && libre && E.jetonUtilisable(S, p, "regard")) h += `<button class="petit" data-a="regard" data-d="${p}">Regard vers l'avenir</button>`;
    h += `</div>`;
    if (ui.conv === p) h += `<div class="options">${DOM.map(d => `<button class="petit d-${d}" data-a="convDom" data-d="${p}:${d}"${j.xp[d] >= 7 ? " disabled" : ""}>${D(d)}</button>`).join("")}<button class="petit" data-a="conv" data-d="-1">Annuler</button></div>`;
    return h + `</div>`;
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
    let h = `<div class="bloc action">${ui.msg ? `<div class="toast">${esc(ui.msg)}</div>` : ""}`;
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
        h += id ? carteHTML(id, { bouton: true, a: "acq", d, off: S.t.normalFait || S.t.gel === d || !E.peutPayer(j, E.carte(id).cout) }) : carteHTML(null);
      }
      h += `</div>`;
      if (gratuit) h += `<div class="rangee" style="margin-top:8px"><b>Progrès gratuit</b> <span class="doux">(une fois, en plus de l'acquisition normale, sans condition de coût) :</span>
        <div class="options">${DOM.filter(d => S.visibles[d]).map(d => `<button class="petit" data-a="acqGratuit" data-d="${d}"${S.t.gel === d ? " disabled" : ""}>${esc(E.carte(S.visibles[d]).nom)}</button>`).join("")}</div></div>`;
      return h + `<div class="options"><button data-a="passerAcq">${S.t.normalFait ? "Terminer mon acquisition" : "Ne rien acquérir"}</button></div></div>`;
    }
    return h + `<div class="consigne">…</div></div>`;
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
      <span class="outils"><button class="petit" data-a="theme">Thème</button><button class="petit" data-a="menu">Menu</button></span></div>
      <div class="grille"><div>${action()}
      <div class="bloc"><h2>Plateau</h2>${hierarchie()}${pistes()}<p class="doux" style="margin:6px 0 0">Cases encadrées : jetons de palier (le premier joueur qui atteint la case le prend). Case 7 : on pioche un objectif.</p></div>
      <div class="bloc"><h2>Cartes Progrès disponibles</h2>${marche()}</div></div>
      <div>${S.joueurs.map((_, p) => joueurHTML(p)).join("")}
      <div class="bloc"><h2>Journal</h2><div class="journal">${S.log.slice(-60).reverse().map(l => `<div><span class="doux">T${l.tour}</span> ${esc(l.txt)}</div>`).join("")}</div></div></div></div>`;
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
    if (ui.ferme) { const v = app.querySelector(".voile"); if (v) v.remove(); }
    tourIA();
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
      S = E.newGame({ noms }); S.joueurs.forEach((j, i) => { j.ia = ui.ia[i]; }); ui.voit = null; ui.ferme = false;
    }
    else if (a === "reprendre") { S = charger(); ui.voit = null; }
    else if (a === "menu") { if (!S || S.gagnant !== null || confirm("Quitter la partie en cours ? Elle reste sauvegardée et pourra être reprise.")) { S = null; clearTimeout(ui.minuteur); ui.minuteur = null; } }
    else if (a === "theme") {
      const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = t; stocker(CLE_THEME, t);
    }
    else if (a === "fermer") ui.ferme = true;
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
