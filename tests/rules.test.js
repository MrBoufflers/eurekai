// Tests ciblés des règles (scénarios précis, pas de simulation de parties)
const EK = require("../src/engine.js");
let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log("ÉCHEC :", msg); } else console.log("ok   :", msg); };
const DOM = ["bio", "phys", "eco", "chim"];
// partie à n joueurs, hiérarchie fixée (du haut vers le bas) : bio, phys, eco, chim
const fresh = (n = 3) => { const S = EK.newGame({ noms: ["A", "B", "C", "D", "E"].slice(0, n) }); S.hier = [...DOM]; return S; };
const prog = (S, coups) => coups.forEach(([r, c], p) => { const e = EK.apply(S, p, "programmer", { r, c }); if (e) throw new Error("programmer " + p + " : " + e); });
const sansPaliers = S => { for (const k of Object.keys(S.paliers)) S.paliers[k] = -1; return S; }; // jetons déjà pris (neutres)
const donneJeton = (S, p, k) => S.joueurs[p].jetons.push({ k, cle: "test", tour: 0, used: false });
const donneObj = (S, p, id, extra = {}) => S.joueurs[p].objectifs.push(Object.assign({ id, n: 0, v: [], ok: false }, extra));
const passerTout = S => { while (S.phase === "acq") EK.apply(S, S.ordre[S.acq], "passer"); };

// 1. mise en place : nombre de cartes par domaine selon le nombre de joueurs, niveaux dans l'ordre
for (const n of [2, 3, 4, 5]) {
  const S = fresh(n);
  const total = DOM.map(d => S.piles[d].length + (S.visibles[d] ? 1 : 0));
  const attendu = DOM.map(d => Object.values(EK.PAR_ID).filter(c => !c.depart && c.dom === d && c.min <= n).length);
  ok(total.join() === attendu.join(), `${n} joueurs : cartes Progrès par domaine selon le nombre minimum de joueurs (${total.join("/")})`);
}
{
  const S = fresh(5);
  const niv = d => [S.visibles[d], ...S.piles[d]].map(id => EK.carte(id).niveau);
  ok(DOM.every(d => niv(d).every((v, i, a) => !i || a[i - 1] <= v)), "piles : niveau 1 dessus, puis 2, puis 3");
  const tete = d => [S.visibles[d], S.piles[d][0]].map(id => EK.carte(id));
  ok(DOM.every(d => tete(d).every(c => c.niveau === 1 && Object.keys(c.cout).length === 1 && c.cout[d] === 1)
    && new Set(tete(d).map(c => c.type)).size === 2), "chaque pile commence par ses 2 cartes à 1 XP (une Recherche, une Censure)");
  ok(S.objPile.length === 13 && new Set(S.objPile).size === 13, "pioche de 13 objectifs");
  ok(Object.keys(S.joueurs[0].cartes).length === 8, "8 cartes de départ par joueur");
}

// 2. vote : le plus voté est censuré ; il passe en haut à la fin du tour ; les autres avancent de 1 ;
//    le censuré reçoit 2 Veilles, chaque Censure efficace 1 Veille (Oni, 07/11/2026)
{
  const S = fresh(3);
  prog(S, [["eco", "eco"], ["bio", "eco"], ["chim", "phys"]]);
  ok(S.dernier === undefined && S.phase === "acq", "après la programmation de tous : phase d'acquisition");
  ok(S.t.censure === "eco", "Écologie (2 votes) censurée");
  ok(S.hier.join(",") === "bio,phys,eco,chim", "hiérarchie inchangée pendant le tour : " + S.hier.join(","));
  ok(S.joueurs[0].xp.eco === 0 && S.joueurs[0].veille === 3, "A (recherche Éco censurée, Censure Éco efficace) : 0 XP, +3 Veilles");
  ok(S.joueurs[1].veille === 1 && S.joueurs[2].veille === 0, "B (Censure Éco efficace) +1 Veille ; C (Censure Phys) rien");
  ok(S.joueurs[1].xp.bio === 1 && S.joueurs[2].xp.chim === 1, "B et C avancent de 1");
  ok(S.ordre.join(",") === "1,0,2", "ordre d'acquisition selon la hiérarchie du domaine recherché : " + S.ordre.join(","));
  passerTout(S);
  ok(S.hier.join(",") === "eco,bio,phys,chim", "fin du tour : Écologie passe tout en haut : " + S.hier.join(","));
}
// 3. égalité de votes : le domaine le plus bas dans la hiérarchie est censuré
{
  const S = fresh(3);
  prog(S, [["bio", "bio"], ["bio", "phys"], ["bio", "chim"]]);
  ok(S.t.censure === "chim", "égalité 1-1-1 : Chimie (la plus basse) censurée");
  passerTout(S);
  ok(S.hier.join(",") === "chim,bio,phys,eco", "fin du tour : Chimie passe tout en haut");
}
// 4. verrouillage : les 2 cartes jouées sont indisponibles au tour suivant, puis reviennent
{
  const S = fresh(2);
  prog(S, [["bio", "phys"], ["eco", "chim"]]); passerTout(S);
  ok(S.tour === 2 && S.phase === "prog", "tour 2");
  ok(EK.disponibles(S, 0).length === 6, "6 cartes disponibles au tour 2");
  ok(EK.apply(S, 0, "programmer", { r: "bio", c: "eco" }) !== "", "Recherche Bio verrouillée : refusée");
  ok(EK.apply(S, 0, "programmer", { r: "eco", c: "phys" }) !== "", "Censure Phys verrouillée : refusée");
  prog(S, [["eco", "eco"], ["bio", "bio"]]); passerTout(S);
  ok(EK.disponibles(S, 0).includes("R-bio") && !EK.disponibles(S, 0).includes("R-eco"), "tour 3 : Bio revient, Éco verrouillée");
}
// 5. Veille : 3 jetons → 1 XP
{
  const S = fresh(2); S.joueurs[0].veille = 3;
  ok(EK.apply(S, 0, "convertir", { dom: "chim" }) === "" && S.joueurs[0].xp.chim === 1 && S.joueurs[0].veille === 0, "3 Veilles → +1 XP Chimie");
  ok(EK.apply(S, 0, "convertir", { dom: "chim" }) !== "", "conversion refusée sans 3 Veilles");
}
// 6. acquisition : seuil (l'XP n'est pas dépensée), remplacement, carte suivante révélée
{
  const S = fresh(2);
  S.visibles.bio = "BIO-1-1"; S.piles.bio = ["BIO-1-2", "BIO-2-1"];
  prog(S, [["bio", "chim"], ["eco", "phys"]]);
  ok(EK.apply(S, 1, "acquerir", { dom: "bio" }) !== "", "B ne peut pas acquérir avant son tour");
  ok(S.ordre[0] === 0, "A (Bio, en haut) acquiert en premier");
  ok(EK.apply(S, 0, "acquerir", { dom: "bio" }) === "", "A (1 XP Bio) acquiert Sérum Lumineux (coût Bio 1)");
  ok(S.joueurs[0].cartes["R-bio"] === "BIO-1-1" && S.joueurs[0].xp.bio === 1, "Sérum remplace la Recherche Bio, XP conservée");
  ok(S.visibles.bio === "BIO-1-2", "carte suivante révélée");
  ok(EK.apply(S, 1, "acquerir", { dom: "bio" }) !== "", "B (0 XP Bio) ne peut pas acquérir Spore Parasite");
}
// 8. Mutation Cachée : vote double
{
  const S = fresh(3); S.joueurs[0].cartes["C-bio"] = "BIO-1-5";
  prog(S, [["eco", "bio"], ["eco", "chim"], ["eco", "chim"]]);
  ok(S.t.votes.bio === 2 && S.t.censure === "chim", "Mutation Cachée : Bio 2 votes ; égalité avec Chimie → Chimie (plus basse)");
}
// 9. Fusion Froide : +1 de base, +2, puis -1 dans un autre domaine au choix
{
  const S = fresh(2); S.joueurs[0].cartes["R-phys"] = "PHYS-2-1"; S.joueurs[0].xp.eco = 2;
  prog(S, [["phys", "chim"], ["bio", "chim"]]);
  ok(S.attente && S.attente.p === 0 && S.attente.demande.type === "domaine", "Fusion Froide demande un domaine à A");
  ok(EK.apply(S, 0, "choisir", { v: "phys" }) !== "", "Physique refusée comme domaine perdu");
  ok(EK.apply(S, 0, "choisir", { v: "eco" }) === "", "Écologie choisie");
  ok(S.joueurs[0].xp.phys === 3 && S.joueurs[0].xp.eco === 1, "Physique 3, Écologie 1");
  ok(S.phase === "acq", "la résolution reprend jusqu'à l'acquisition");
}
// 10. Spore Parasite : ne vise qu'un joueur non censuré qui a de la Veille
{
  const S = fresh(3); S.joueurs[0].cartes["C-bio"] = "BIO-1-2";
  S.joueurs[1].veille = 2; S.joueurs[2].veille = 2;
  prog(S, [["eco", "bio"], ["bio", "bio"], ["phys", "eco"]]); // Bio censurée (2 votes) : B censuré
  ok(S.attente && S.attente.demande.options.join() === "2", "Spore Parasite : seul C (non censuré) est ciblable");
  EK.apply(S, 0, "choisir", { v: 2 });
  ok(S.joueurs[0].veille === 2 && S.joueurs[2].veille === 1, "A vole 1 Veille à C (+1 pour sa Censure efficace)");
}
// 11. Extinction de Masse : victoire si la Recherche est censurée
{
  const S = fresh(2); S.joueurs[0].cartes["R-eco"] = "ECO-3-2";
  prog(S, [["eco", "eco"], ["bio", "eco"]]);
  ok(S.gagnant === 0 && S.phase === "fin", "A gagne : sa Recherche Extinction de Masse est censurée");
}
// 12. Symbiocité : Veilles redistribuées en commençant par le joueur
{
  const S = fresh(3); S.joueurs[1].cartes["C-eco"] = "ECO-3-3";
  S.joueurs[0].veille = 4; S.joueurs[1].veille = 0; S.joueurs[2].veille = 1;
  prog(S, [["bio", "eco"], ["bio", "eco"], ["bio", "chim"]]);
  ok(S.joueurs.map(j => j.veille).join() === "2,3,2", "5 Veilles redistribuées depuis B (1,2,2), puis +1 aux Censures Éco de A et B → " + S.joueurs.map(j => j.veille).join());
}
// 13. Virus de Données : Recherche verrouillée dans le domaine censuré → -1 XP
{
  const S = fresh(2); S.joueurs[0].cartes["C-chim"] = "BIO-2-4"; // Censure sur l'emplacement Chimie, pour le test
  S.joueurs[1].verrou = ["R-chim", "C-bio"]; S.joueurs[1].xp.chim = 3;
  prog(S, [["bio", "chim"], ["eco", "chim"]]);
  ok(S.joueurs[1].xp.chim === 2, "B (Recherche Chimie verrouillée) perd 1 XP Chimie");
}
// 14. Antimatière : hiérarchie inversée
{
  const S = fresh(2); S.joueurs[0].cartes["C-phys"] = "PHYS-2-4";
  prog(S, [["bio", "phys"], ["eco", "phys"]]);
  ok(S.hier.join(",") === "chim,eco,phys,bio", "Antimatière inverse la hiérarchie : " + S.hier.join(","));
  ok(S.ordre[0] === 1, "l'ordre d'acquisition suit la nouvelle hiérarchie");
  passerTout(S);
  ok(S.hier.join(",") === "phys,chim,eco,bio", "fin du tour : Physique (censurée) passe tout en haut");
}
// 15. Gaz Soporifique : le joueur visé saute l'acquisition
{
  const S = fresh(2); S.joueurs[0].cartes["C-chim"] = "CHIM-2-2";
  prog(S, [["bio", "chim"], ["eco", "chim"]]);
  EK.apply(S, 0, "choisir", { v: 1 });
  ok(S.phase === "acq" && S.ordre[S.acq] === 0, "A acquiert");
  EK.apply(S, 0, "passer");
  ok(S.phase === "prog" && S.tour === 2, "B est sauté : tour suivant");
}
// 16. Alchimiste : l'XP de base va sur la piste choisie
{
  const S = fresh(2); S.joueurs[0].cartes["R-chim"] = "CHIM-1-4";
  prog(S, [["chim", "bio"], ["eco", "bio"]]);
  EK.apply(S, 0, "choisir", { v: "phys" });
  ok(S.joueurs[0].xp.phys === 1 && S.joueurs[0].xp.chim === 0, "Alchimiste : +1 Physique au lieu de Chimie");
}
// 16 bis. gemmes : numéros 1 à n ; à égalité de domaine, la plus grande gemme passe d'abord, puis échange
{
  const S = fresh(3);
  ok(S.joueurs.map(j => j.gemme).sort().join() === "1,2,3", "3 joueurs : gemmes 1, 2, 3");
  S.joueurs[0].gemme = 1; S.joueurs[1].gemme = 3; S.joueurs[2].gemme = 2;
  prog(S, [["bio", "chim"], ["bio", "chim"], ["phys", "eco"]]);
  ok(S.ordre.join(",") === "1,0,2", "A et B recherchent Bio : B (gemme 3) avant A (gemme 1)");
  ok(S.joueurs[0].gemme === 3 && S.joueurs[1].gemme === 1 && S.joueurs[2].gemme === 2, "A et B échangent leurs gemmes, C garde la sienne");
}
{
  const S = fresh(3);
  S.joueurs[0].gemme = 2; S.joueurs[1].gemme = 3; S.joueurs[2].gemme = 1;
  prog(S, [["eco", "chim"], ["eco", "chim"], ["eco", "phys"]]);
  ok(S.ordre.join(",") === "1,0,2", "3 joueurs en Éco : ordre B (3), A (2), C (1)");
  ok(S.joueurs.map(j => j.gemme).join() === "2,1,3", "gemmes inversées : B 1, A 2, C 3");
}
// 16 ter. Lobby Vert efficace : les joueurs censurés reçoivent 3 Veilles
{
  const S = fresh(2); S.joueurs[0].cartes["C-eco"] = "ECO-1-5";
  prog(S, [["bio", "eco"], ["eco", "eco"]]);
  ok(S.joueurs[1].veille === 4, "B censuré : 3 Veilles (Lobby Vert) + 1 pour sa Censure efficace");
}
// ===== Objectifs (Oni, 08/11/2026) =====
// 20. piste à 7 → pioche d'un objectif ; 2e piste à 7 → 2e objectif ; XP au-delà de 7 → 2 Veilles
{
  const S = sansPaliers(fresh(2)); S.objPile = ["O-QUATRE", "O-NIV3", "O-VEILLE6"];
  S.joueurs[0].xp.bio = 6; S.joueurs[0].xp.phys = 6;
  prog(S, [["bio", "chim"], ["eco", "chim"]]); passerTout(S);
  ok(S.joueurs[0].objectifs.map(o => o.id).join() === "O-QUATRE", "A atteint 7 en Biologie : pioche « Polymathe »");
  prog(S, [["phys", "eco"], ["chim", "eco"]]); passerTout(S);
  ok(S.joueurs[0].objectifs.map(o => o.id).join() === "O-QUATRE,O-NIV3", "A atteint 7 en Physique : deuxième objectif");
  const v = S.joueurs[0].veille;
  prog(S, [["bio", "chim"], ["eco", "chim"]]);
  ok(S.joueurs[0].xp.bio === 7 && S.joueurs[0].veille === v + 2 + 1, "+1 XP sur une piste à 7 → +2 Veilles (et +1 pour la Censure efficace)");
  ok(S.joueurs[0].objectifs.length === 2, "pas de nouvel objectif pour une piste déjà passée à 7");
}
// 21. objectif déjà rempli au moment de la pioche : victoire immédiate
{
  const S = sansPaliers(fresh(2)); S.objPile = ["O-QUATRE"];
  Object.assign(S.joueurs[0].xp, { bio: 6, phys: 4, eco: 4, chim: 4 });
  prog(S, [["bio", "chim"], ["eco", "chim"]]);
  ok(S.gagnant === 0 && S.phase === "fin", "A pioche « Polymathe » en ayant déjà 4 partout : victoire immédiate");
}
// 22. Le martyr : censuré 2 tours d'affilée (compté à partir de la pioche)
{
  const S = sansPaliers(fresh(2)); donneObj(S, 0, "O-MARTYR");
  prog(S, [["eco", "eco"], ["bio", "eco"]]); passerTout(S);
  ok(S.gagnant === null && S.joueurs[0].objectifs[0].n === 1, "1er tour censuré : compteur 1");
  prog(S, [["chim", "chim"], ["phys", "chim"]]);
  ok(S.gagnant === 0, "2e tour censuré d'affilée : A gagne");
}
// 23. Voix solitaire : le domaine censuré grâce à l'égalité, avec un seul vote
{
  const S = sansPaliers(fresh(3)); donneObj(S, 2, "O-SEUL");
  prog(S, [["chim", "bio"], ["chim", "phys"], ["chim", "eco"]]);
  ok(S.t.censure === "eco" && S.gagnant === 2, "égalité 1-1-1, Écologie censurée : C (seul à l'avoir votée) gagne");
}
// 24. Coup d'État : faire censurer le domaine en haut de la hiérarchie
{
  const S = sansPaliers(fresh(2)); donneObj(S, 0, "O-HAUT");
  prog(S, [["eco", "bio"], ["chim", "bio"]]);
  ok(S.gagnant === 0, "Biologie (en haut) censurée avec la Censure de A : A gagne");
}
// 25. Pillard : faire perdre 4 Veilles (Onde de Choc) ; Rivalité : faire perdre de l'XP à 2 joueurs (Pandémie Ciblée)
{
  const S = sansPaliers(fresh(2)); donneObj(S, 0, "O-VOL4", { n: 3 });
  S.joueurs[0].cartes["C-phys"] = "PHYS-1-2"; S.joueurs[1].veille = 2;
  prog(S, [["bio", "phys"], ["eco", "phys"]]);
  EK.apply(S, 0, "choisir", { v: 1 });
  ok(S.gagnant === 0, "Pillard : 3 + 1 Veille perdue par B → A gagne");
}
{
  const S = sansPaliers(fresh(3)); donneObj(S, 0, "O-XP2", { v: [2] });
  S.joueurs[0].cartes["C-bio"] = "BIO-2-2"; S.joueurs[1].xp.bio = 2;
  prog(S, [["eco", "bio"], ["chim", "bio"], ["phys", "eco"]]);
  EK.apply(S, 0, "choisir", { v: 1 });
  ok(S.joueurs[1].xp.bio === 1 && S.gagnant === 0, "Rivalité : B perd 1 XP Bio (C déjà touché) → A gagne");
}
// 26. Sabotage + Le saboteur
{
  const S = sansPaliers(fresh(3)); donneObj(S, 0, "O-SABOTEUR"); donneObj(S, 1, "O-NIV3");
  S.objPile = ["O-VEILLE6"]; S.joueurs[0].cartes["C-chim"] = "CHIM-2-5";
  prog(S, [["bio", "chim"], ["eco", "chim"], ["phys", "bio"]]);
  ok(S.attente && S.attente.demande.options.join() === "1", "Sabotage : seul B (qui a un objectif) est ciblable");
  EK.apply(S, 0, "choisir", { v: 1 });
  ok(S.joueurs[1].objectifs.map(o => o.id).join() === "O-VEILLE6" && S.objDefausse.includes("O-NIV3"), "B défausse « Élite » et pioche « Vigie »");
  ok(S.gagnant === 0, "A remplit « Le saboteur »");
}
// 27. Mimétisme : échange d'objectifs (compteurs remis à 0)
{
  const S = sansPaliers(fresh(2)); donneObj(S, 0, "O-NIV3"); donneObj(S, 1, "O-MARTYR", { n: 1 });
  S.joueurs[0].cartes["R-bio"] = "BIO-2-5";
  prog(S, [["bio", "chim"], ["eco", "phys"]]);
  EK.apply(S, 0, "choisir", { v: 1 });
  ok(S.joueurs[0].objectifs[0].id === "O-MARTYR" && S.joueurs[0].objectifs[0].n === 0 && S.joueurs[1].objectifs[0].id === "O-NIV3", "A et B échangent leurs objectifs");
}
// 28. Prémonition (choix secret) et Compost
{
  const S = sansPaliers(fresh(2)); S.objPile = ["O-NIV3", "O-HAUT", "O-SEUL", "O-PAIRE"];
  S.joueurs[0].cartes["R-phys"] = "PHYS-2-5";
  prog(S, [["phys", "chim"], ["eco", "bio"]]);
  ok(S.attente && S.attente.demande.options.length === 3, "Prémonition : A voit les 3 objectifs du dessus");
  ok(EK.viewFor(S, 1).attente.demande.options.length === 0, "B ne les voit pas");
  EK.apply(S, 0, "choisir", { v: "O-SEUL" }); EK.apply(S, 0, "choisir", { v: "O-NIV3" });
  ok(S.objPile.join() === "O-SEUL,O-NIV3,O-HAUT,O-PAIRE", "nouvel ordre : " + S.objPile.join());
  ok(EK.viewFor(S, 1).objPile.reste === 4 && !Array.isArray(EK.viewFor(S, 1).objPile), "la pioche d'objectifs reste cachée");
}
{
  const S = sansPaliers(fresh(2)); S.objPile = ["O-NIV3", "O-HAUT"];
  S.joueurs[0].cartes["C-eco"] = "ECO-2-5";
  prog(S, [["bio", "eco"], ["chim", "eco"]]);
  EK.apply(S, 0, "choisir", { v: true });
  ok(S.objPile.join() === "O-HAUT,O-NIV3", "Compost : l'objectif du dessus passe sous la pioche");
}
// 29. Chasse au leader : +1 Veille de plus pour une Censure efficace sur le domaine à 7 d'un adversaire qui a un objectif
{
  const S = sansPaliers(fresh(3)); donneObj(S, 1, "O-NIV3"); S.joueurs[1].xp.eco = 7; S.joueurs[1].sept.eco = true;
  prog(S, [["phys", "eco"], ["bio", "bio"], ["chim", "eco"]]);
  ok(S.joueurs[0].veille === 2 && S.joueurs[2].veille === 2, "A et C censurent l'Écologie de B : 2 Veilles chacun");
}
// 29 bis. Équilibre : les 3 autres pistes (hors une piste à 7) au même niveau, au moins 1
{
  const OK = (xp) => { const S = fresh(2); Object.assign(S.joueurs[0].xp, xp); return EK.OK["O-PAIRE"](S, 0, {}); };
  ok(OK({ bio: 7, phys: 3, eco: 3, chim: 3 }), "7-3-3-3 : Équilibre rempli");
  ok(!OK({ bio: 7, phys: 3, eco: 3, chim: 2 }), "7-3-3-2 : pas rempli");
  ok(!OK({ bio: 7, phys: 0, eco: 0, chim: 0 }), "7-0-0-0 : pas rempli (au moins 1)");
  ok(!OK({ bio: 6, phys: 3, eco: 3, chim: 3 }), "sans piste à 7 : pas rempli");
}
// ===== Jetons de palier (Oni, 08/11/2026) =====
// 30. le premier à atteindre 3 prend le jeton (ordre de jeu) ; +2 Veilles immédiates ; utilisable au tour suivant
{
  const S = fresh(2); S.joueurs[0].xp.bio = 2; S.joueurs[1].xp.bio = 2; S.joueurs[0].gemme = 2; S.joueurs[1].gemme = 1;
  prog(S, [["bio", "chim"], ["bio", "chim"]]);
  ok(S.paliers["bio-3"] === 0, "A (gemme 2) atteint 3 en Biologie avant B : jeton +2 Veilles");
  ok(S.joueurs[0].veille === 3 && S.joueurs[1].veille === 1, "A : +2 Veilles du jeton +1 de sa Censure ; B : +1");
}
{
  const S = fresh(2); S.joueurs[0].xp.phys = 2;
  prog(S, [["phys", "chim"], ["eco", "chim"]]);
  ok(S.paliers["phys-3"] === 0 && !EK.jetonUtilisable(S, 0, "gemmeOr"), "Gemme d'or obtenue, pas encore utilisable ce tour");
  passerTout(S);
  ok(EK.jetonUtilisable(S, 0, "gemmeOr"), "utilisable au tour suivant");
}
// 31. Gemme d'or : gagne l'égalité et ne participe pas à l'échange
{
  const S = sansPaliers(fresh(3)); donneJeton(S, 0, "gemmeOr");
  S.joueurs[0].gemme = 1; S.joueurs[1].gemme = 3; S.joueurs[2].gemme = 2;
  prog(S, [["bio", "chim"], ["bio", "chim"], ["bio", "chim"]]);
  ok(S.ordre.join() === "0,1,2", "A (Gemme d'or) passe devant B (3) et C (2)");
  ok(S.joueurs[0].gemme === 1 && S.joueurs[1].gemme === 2 && S.joueurs[2].gemme === 3, "B et C échangent, A garde sa gemme");
}
// 32. Veto, Immunité, Vote double
{
  const S = sansPaliers(fresh(2)); donneJeton(S, 0, "veto");
  prog(S, [["chim", "bio"], ["phys", "eco"]]);
  ok(S.attente && S.attente.ctx.id === "J-veto", "après la révélation, A peut utiliser son Veto");
  EK.apply(S, 0, "choisir", { v: 1 });
  ok(S.t.censure === "bio" && S.joueurs[1].veille === 0, "vote de B annulé : Biologie censurée (sinon Écologie) ; B ne gagne pas de Veille");
  ok(!EK.jetonUtilisable(S, 0, "veto"), "le Veto est dépensé");
}
{
  const S = sansPaliers(fresh(2));
  ok(EK.apply(S, 0, "programmer", { r: "eco", c: "eco", jetons: ["immunite"] }) !== "", "Immunité refusée sans le jeton");
  donneJeton(S, 0, "immunite");
  EK.apply(S, 0, "programmer", { r: "eco", c: "eco", jetons: ["immunite"] }); EK.apply(S, 1, "programmer", { r: "bio", c: "eco" });
  ok(S.t.censure === "eco" && S.joueurs[0].xp.eco === 1 && S.joueurs[0].veille === 1, "A immunisé : Écologie censurée mais A avance (+1 Veille de sa Censure seulement)");
}
{
  const S = sansPaliers(fresh(2)); donneJeton(S, 0, "vote2");
  EK.apply(S, 0, "programmer", { r: "eco", c: "bio", jetons: ["vote2"] }); EK.apply(S, 1, "programmer", { r: "chim", c: "phys" });
  ok(S.t.votes.bio === 2 && S.t.censure === "bio", "Vote double : Biologie 2 votes, censurée");
}
// 33. Conversion améliorée et Double achat
{
  const S = sansPaliers(fresh(2)); donneJeton(S, 0, "conversion"); S.joueurs[0].veille = 2;
  ok(EK.apply(S, 0, "convertir", { dom: "eco" }) === "" && S.joueurs[0].xp.eco === 1, "Conversion améliorée : 2 Veilles → 1 XP");
}
{
  // Progrès gratuit (Oni, 08/11/2026) : une acquisition en plus, sans condition de coût
  const S = sansPaliers(fresh(2)); donneJeton(S, 0, "achat2");
  S.visibles.bio = "BIO-1-1"; S.visibles.phys = "PHYS-3-1";
  prog(S, [["bio", "chim"], ["eco", "chim"]]);
  EK.apply(S, 0, "acquerir", { dom: "bio" });
  ok(S.phase === "acq" && S.ordre[S.acq] === 0, "après l'acquisition normale, A peut encore utiliser Progrès gratuit");
  ok(EK.apply(S, 0, "acquerir", { dom: "phys" }) !== "", "une 2e acquisition normale est refusée");
  ok(EK.apply(S, 0, "acquerir", { dom: "phys", gratuit: true }) === "" && S.joueurs[0].cartes["R-phys"] === "PHYS-3-1", "Progrès gratuit : Machine Temporelle (Phys 5, Bio 2) acquise sans en avoir le coût");
  ok(!EK.jetonUtilisable(S, 0, "achat2") && S.ordre[S.acq] === 1, "jeton dépensé, au tour de B");
}
// ===== Censures ajoutées le 08/11/2026 =====
// 34. Contagion : les censurés reçoivent 1 Veille de moins ; Précipité : un joueur perd 1 Veille
{
  const S = sansPaliers(fresh(2)); S.joueurs[0].cartes["C-bio"] = "BIO-1-6";
  prog(S, [["eco", "bio"], ["bio", "bio"]]);
  ok(S.joueurs[1].veille === 1 + 1, "B censuré : 1 Veille (Contagion) + 1 pour sa Censure efficace");
}
{
  const S = sansPaliers(fresh(2)); S.joueurs[0].cartes["C-chim"] = "CHIM-1-6"; S.joueurs[1].veille = 2;
  prog(S, [["eco", "chim"], ["bio", "chim"]]); EK.apply(S, 0, "choisir", { v: 1 });
  ok(S.joueurs[1].veille === 2, "Précipité : B perd 1 Veille (2 → 1) puis +1 pour sa Censure efficace");
}
// 35. Inoculation forcée : chaque autre joueur perd 1 XP dans sa piste la plus haute hors 7
{
  const S = sansPaliers(fresh(3)); S.joueurs[0].cartes["C-bio"] = "BIO-2-6";
  Object.assign(S.joueurs[1].xp, { bio: 7, phys: 4, eco: 2 }); Object.assign(S.joueurs[2].xp, { phys: 3, chim: 3 });
  prog(S, [["chim", "bio"], ["chim", "bio"], ["eco", "bio"]]);
  ok(S.joueurs[1].xp.phys === 3 && S.joueurs[1].xp.bio === 7, "B : 7 en Bio intouchable, perd 1 XP en Physique (4)");
  ok(S.attente && S.attente.p === 2 && S.attente.demande.options.join() === "phys,chim", "C (égalité Physique/Chimie à 3) choisit lui-même sa piste");
  EK.apply(S, 2, "choisir", { v: "chim" });
  ok(S.joueurs[2].xp.chim === 2 && S.joueurs[2].xp.phys === 3, "C perd 1 XP en Chimie, son choix");
}
// 36. Expropriation : vol d'un jeton non utilisé (Gemme d'or comprise)
{
  const S = sansPaliers(fresh(4)); S.joueurs[0].cartes["C-bio"] = "BIO-3-4";
  donneJeton(S, 1, "gemmeOr"); donneJeton(S, 1, "veto"); S.joueurs[1].jetons[1].used = true;
  prog(S, [["eco", "bio"], ["chim", "bio"], ["chim", "phys"], ["chim", "eco"]]);
  ok(S.attente && S.attente.demande.options.join() === "1", "seul B (qui a un jeton non utilisé) est ciblable");
  EK.apply(S, 0, "choisir", { v: 1 });
  ok(S.joueurs[0].jetons.some(t => t.k === "gemmeOr") && !S.joueurs[1].jetons.some(t => t.k === "gemmeOr"), "A vole la Gemme d'or de B");
  ok(!EK.jetonUtilisable(S, 0, "gemmeOr"), "utilisable seulement au tour suivant");
}
// 37. Interception, Inversion des pôles, Gel des fonds
{
  const S = sansPaliers(fresh(3)); S.joueurs[0].cartes["C-phys"] = "PHYS-1-6";
  S.piles.eco = ["ECO-1-3", "ECO-1-4", "ECO-2-1"];
  prog(S, [["bio", "phys"], ["chim", "phys"], ["chim", "eco"]]);
  EK.apply(S, 0, "choisir", { v: "eco" });
  ok(S.attente && S.attente.demande.prive, "A voit la prochaine carte en secret");
  EK.apply(S, 0, "choisir", { v: true });
  ok(S.piles.eco.join() === "ECO-1-4,ECO-2-1,ECO-1-3", "la carte part sous la pile");
}
{
  const S = sansPaliers(fresh(2)); S.joueurs[0].cartes["C-phys"] = "PHYS-1-7"; S.joueurs[0].gemme = 1; S.joueurs[1].gemme = 2;
  prog(S, [["bio", "phys"], ["chim", "phys"]]); EK.apply(S, 0, "choisir", { v: 1 });
  ok(S.joueurs[0].gemme === 2 && S.joueurs[1].gemme === 1, "Inversion des pôles : gemmes échangées");
}
{
  const S = sansPaliers(fresh(2)); S.joueurs[0].cartes["C-eco"] = "ECO-2-6"; S.visibles.eco = "ECO-1-1"; S.joueurs[0].xp.eco = 3;
  prog(S, [["bio", "eco"], ["chim", "eco"]]);
  ok(EK.apply(S, S.ordre[S.acq], "acquerir", { dom: "eco" }) !== "", "Gel des fonds : la carte Écologie ne peut pas être acquise");
}
// 17. vue d'un joueur : programmation des autres et ordre des piles cachés
{
  const S = fresh(3);
  EK.apply(S, 1, "programmer", { r: "bio", c: "eco" });
  const V = EK.viewFor(S, 0);
  ok(V.joueurs[1].prog.cache && !V.joueurs[1].prog.r, "A voit que B a programmé, sans voir ses cartes");
  ok(typeof V.piles.bio.reste === "number" && !Array.isArray(V.piles.bio), "piles : seul le nombre et le type de la suivante");
  ok(EK.viewFor(S, 1).joueurs[1].prog.r === "bio", "B voit sa propre programmation");
}
// 18. carte à effet pas encore programmé : signalée dans le journal, sans erreur
{
  const S = fresh(2); S.joueurs[0].cartes["C-phys"] = "PHYS-2-2";
  prog(S, [["bio", "phys"], ["eco", "phys"]]);
  ok(S.log.some(l => /pas encore programmé/.test(l.txt)), "Trou Noir : « effet pas encore programmé » dans le journal");
}
// 19. toutes les cartes Progrès ont un effet programmé ou prévu à l'étape 3
{
  const manquantes = Object.keys(EK.PAR_ID).filter(id => !id.startsWith("S-") && !EK.programme(id) && !EK.A_VENIR.includes(id));
  ok(manquantes.length === 0, "chaque carte est programmée ou listée pour plus tard " + manquantes.join(" "));
}

console.log(fails ? `\n${fails} échec(s)` : "\nTous les tests passent.");
process.exit(fails ? 1 : 0);
