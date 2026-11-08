// Données des cartes d'Eurekaïe ! — source : « cartes_data (1).json » (kurzgui, Drive, 19/02/2026), version 2.0.
// Modifié par Oni : Lobby Vert 3 Veilles au lieu de 2 (07/11/2026).
// Ne pas modifier un effet ou un coût sans validation d'Oni.
// Domaines : bio, phys, eco, chim. Type : "R" (Recherche) ou "C" (Censure).
const CARTES = (() => {
  const DOMAINES = ["bio", "phys", "eco", "chim"];
  const NOM_DOMAINE = { bio: "Biologie", phys: "Physique", eco: "Écologie", chim: "Chimie" };
  const COULEUR = { bio: "#044F8B", phys: "#913089", eco: "#009882", chim: "#E83643" }; // couleurs du générateur de cartes
  const MAX_PISTE = 7;

  // [id, type, niveau, nom, effet, coût, joueurs min]
  const P = [
    ["BIO-1-1", "R", 1, "Sérum Lumineux", "+1 Veille", { bio: 1 }, 2],
    ["BIO-1-2", "C", 1, "Spore Parasite", "Voler un jeton Veille à un autre joueur (non censuré ce tour)", { bio: 1 }, 2],
    ["BIO-1-3", "R", 1, "Clone Express", "+1 XP si au moins 1 autre joueur recherche aussi Bio ce tour.", { bio: 2 }, 3],
    ["BIO-1-4", "R", 1, "Vaccin Adaptatif", "Dépensez 1 Veille : +1 XP Bio.", { bio: 1, chim: 1 }, 4],
    ["BIO-1-5", "C", 1, "Mutation Cachée", "Votre vote censure compte double.", { bio: 2 }, 5],
    ["BIO-2-1", "R", 2, "Hélice Parfaite", "+ 1 XP sur une piste au choix.", { bio: 3, chim: 1 }, 2],
    ["BIO-2-2", "C", 2, "Pandémie Ciblée", "Choisissez un joueur : il perd 1 XP dans le domaine censuré.", { bio: 3 }, 2],
    ["BIO-2-3", "R", 2, "Symbiose", "+2 XP Bio, puis perdez 1 XP dans un autre domaine de votre choix.", { bio: 3, eco: 2 }, 3],
    // Censures ajoutées le 08/11/2026 (Oni) pour se rapprocher de 50 % Recherche / 50 % Censure
    ["BIO-1-6", "C", 1, "Contagion", "Chaque joueur censuré ce tour reçoit 1 Veille de moins.", { bio: 1 }, 3],
    ["BIO-2-6", "C", 2, "Inoculation forcée", "Chaque autre joueur perd 1 XP dans sa piste la plus haute (hors 7).", { bio: 3, eco: 1 }, 3],
    ["BIO-3-4", "C", 3, "Expropriation", "Volez à un adversaire un jeton de palier non utilisé (Gemme d'or et Conversion améliorée comprises).", { bio: 5, chim: 2 }, 4],
    ["BIO-2-5", "R", 2, "Mimétisme", "Échangez un de vos objectifs avec celui d'un adversaire.", { bio: 3, phys: 1 }, 2], // ajoutée 08/11/2026 (À VALIDER : nom, coût)
    ["BIO-2-4", "C", 2, "Virus de Données", "Les joueurs avec une Recherche verrouillée dans le domaine censuré perdent 1 XP.", { bio: 3, phys: 1 }, 4],
    ["BIO-3-1", "R", 3, "Arbre-Monde", "+1 XP dans chaque domaine où vous avez au moins 3XP.", { bio: 5, eco: 2 }, 2],
    ["BIO-3-2", "R", 3, "Panacée", "Inverser 2 pions XP d'un joueur ciblé", { bio: 5, chim: 3 }, 2],
    ["BIO-3-3", "C", 3, "Contrôle Génétique", "A la fin du tour, échanger la possession de cette carte avec une autre sur le plateau. Vous devez remplacer cette carte avec celle du même type.", { bio: 5, phys: 2 }, 4],

    ["PHYS-1-1", "R", 1, "Accélérateur", "+1 XP si vous êtes seul à rechercher Physique ce tour.", { phys: 1 }, 2],
    ["PHYS-1-2", "C", 1, "Onde de Choc", "Choisissez un joueur : il perd 1 Veille.", { phys: 1 }, 2],
    ["PHYS-1-3", "R", 1, "Prisme Quantique", "+1 XP si votre carte Censure a été activée ce tour.", { bio: 1, phys: 1 }, 3],
    ["PHYS-1-4", "R", 1, "Téléporteur", "Ne s'active QUE si cette recherche a été censurée : Gagnez +1 XP dans chaque domaine.", { phys: 2, eco: 1 }, 4],
    ["PHYS-1-5", "C", 1, "Interférence", "Pour le prochain tour : vous pouvez choisir votre carte censure une fois après la révélation des autres censures.", { phys: 2 }, 5],
    ["PHYS-2-1", "R", 2, "Fusion Froide", "+2 XP Physique, puis perdez 1 XP dans un autre domaine de votre choix.", { phys: 3, chim: 1 }, 2],
    ["PHYS-2-2", "C", 2, "Trou Noir", "Prochain tour : Personne ne peut choisir de carte censure Physique", { phys: 3 }, 2],
    ["PHYS-2-3", "R", 2, "Supraconducteur", "Au prochain tour : si vous êtes censuré, appliquez quand même l'effet de votre carte Recherche", { phys: 3, eco: 2 }, 3],
    ["PHYS-1-6", "C", 1, "Interception", "Regardez la prochaine carte Progrès d'une pile et placez-la sous la pile.", { phys: 1 }, 3],
    ["PHYS-1-7", "C", 1, "Inversion des pôles", "Échangez votre gemme avec celle d'un joueur de votre choix.", { phys: 2 }, 2],
    ["PHYS-2-5", "R", 2, "Prémonition", "Regardez les 3 objectifs du dessus de la pioche et remettez-les dans l'ordre de votre choix.", { phys: 3, bio: 1 }, 2], // ajoutée 08/11/2026 (À VALIDER)
    ["PHYS-2-4", "C", 2, "Antimatière", "Inversez la hiérarchie complète.", { bio: 1, phys: 3 }, 4],
    ["PHYS-3-1", "R", 3, "Machine Temporelle", "Jouez une deuxième carte Recherche pendant ce tour (elle sera également verrouillée au prochain tour)", { bio: 2, phys: 5 }, 2],
    ["PHYS-3-2", "R", 3, "Dimension Parallèle", "Copiez l'effet Recherche d'un autre joueur ce tour.", { phys: 5, eco: 3 }, 2],
    ["PHYS-3-3", "C", 3, "Singularité", "Censurer les 2 domaines les plus votés.", { phys: 5, chim: 2 }, 4],

    ["ECO-1-1", "R", 1, "Jardin Vertical", "+1 Veille", { eco: 1 }, 2],
    ["ECO-1-2", "C", 1, "Moratoire", "Choisissez un domaine : sa carte Progrès visible est défaussée.", { eco: 1 }, 2],
    ["ECO-1-3", "R", 1, "Photovoltaïque", "+1 XP bonus si au moins 1 autre joueur recherche aussi Écologie ce tour.", { eco: 1, phys: 1 }, 3],
    ["ECO-1-4", "R", 1, "Recycleur", "Dépensez 1 Veille : +1 XP Éco.", { eco: 2, chim: 1 }, 4],
    ["ECO-1-5", "C", 1, "Lobby Vert", "Les joueurs censurés reçoivent 3 Veille au lieu de 2.\nProchain tour : choisissez votre carte censure à la fin de la phase censure", { eco: 2 }, 5],
    ["ECO-2-1", "R", 2, "Écosystème Clos", "+1 XP dans un domaine.", { phys: 1, eco: 3 }, 2],
    ["ECO-2-2", "C", 2, "Tempête Solaire", "+2 Veille", { eco: 3 }, 2],
    ["ECO-2-3", "R", 2, "Permaculture", "Tour suivant : si vous êtes censuré, vous gagnez 3 Veille.", { bio: 2, eco: 3 }, 3],
    ["ECO-2-6", "C", 2, "Gel des fonds", "La carte Progrès visible du domaine censuré ne peut pas être acquise ce tour.", { eco: 3, bio: 1 }, 3],
    ["ECO-2-5", "C", 2, "Compost", "Regardez l'objectif du dessus de la pioche ; vous pouvez le mettre sous la pioche.", { eco: 3, chim: 1 }, 2], // ajoutée 08/11/2026 (À VALIDER)
    ["ECO-2-4", "C", 2, "Déforestation", "Les joueurs avec une Recherche verrouillée dans le domaine censuré perdent 1 XP.", { eco: 3, chim: 2 }, 4],
    ["ECO-3-1", "R", 3, "Terra Genesis", "Gagnez 1 XP dans chaque domaine où au moins 1 autre joueur a recherché.", { bio: 2, eco: 5 }, 2],
    ["ECO-3-2", "R", 3, "Extinction de Masse", "Ne s'active QUE si cette recherche a été censuré : Vous gagnez immédiatement la partie", { phys: 3, eco: 5 }, 2],
    ["ECO-3-3", "C", 3, "Symbiocité", "Récupérer les jetons Veille de tous les joueurs (vous y compris) et redistribuez les équitablement en commençant par vous.", { eco: 5, chim: 2 }, 4],

    ["CHIM-1-1", "R", 1, "Catalyseur", "+1 XP si votre carte Censure a été activée ce tour.", { chim: 1 }, 2],
    ["CHIM-1-2", "C", 1, "Acide Corrosif", "+1 Veille", { chim: 1 }, 2],
    ["CHIM-1-3", "R", 1, "Cristallisation", "+1 XP si vous êtes seul à rechercher Chimie ce tour.", { bio: 2, chim: 1 }, 3],
    ["CHIM-1-4", "R", 1, "Alchimiste", "Gagnez votre XP sur la piste de votre choix au lieu de Chimie.", { phys: 1, chim: 1 }, 4],
    ["CHIM-1-5", "C", 1, "Réaction en chaine", "Défaussez une carte Projet visible.", { chim: 2 }, 5],
    ["CHIM-2-1", "R", 2, "Transmutation", "Déplacez 2 XP d'un domaine vers un autre", { phys: 1, chim: 3 }, 2],
    ["CHIM-2-2", "C", 2, "Gaz Soporifique", "Un joueur de votre choix ne peut pas acquérir de carte ce tour.", { chim: 3 }, 2],
    ["CHIM-2-3", "R", 2, "Polymère Intelligent", "Tour suivant : votre carte Recherche rapporte +1 XP.", { eco: 2, chim: 3 }, 3],
    ["CHIM-1-6", "C", 1, "Précipité", "Choisissez un joueur : il perd 1 Veille.", { chim: 2 }, 3],
    ["CHIM-2-5", "C", 2, "Sabotage", "Choisissez un adversaire : il défausse un de ses objectifs et en pioche un nouveau.", { chim: 3, eco: 1 }, 2], // ajoutée 08/11/2026 (À VALIDER)
    ["CHIM-2-4", "C", 2, "Bombe Fumigène", "Choisissez un joueur : ces cartes verrouillées ne se déverrouillent pas au prochain tour.", { bio: 1, chim: 3 }, 4],
    ["CHIM-3-1", "R", 3, "Pierre Philosophale", "Convertissez TOUTES vos Veilles en XP, 1 pour 1, répartis librement.", { bio: 2, chim: 5 }, 2],
    ["CHIM-3-2", "R", 3, "Nanotechnologie", "Acquérez gratuitement n'importe quelles cartes Progrès visibles.", { phys: 3, chim: 5 }, 2],
    ["CHIM-3-3", "C", 3, "Le Stimulant Divin", "Prochain tour : Jouez vos 4 cartes Recherche (sans carte Censure)", { eco: 2, chim: 5 }, 4],
  ];

  // Objectifs (Oni, 08/11/2026) : remplacent les Inventions Ultimes. Publics ; on en pioche un à chaque piste qui atteint 7.
  // Les objectifs marqués * ne comptent qu'à partir du moment où on les pioche. (Noms : À VALIDER)
  const OBJECTIFS = [
    ["O-MARTYR", "Le martyr", "Soyez censuré 2 tours d'affilée.*"],
    ["O-CENS2", "Censeur implacable", "Réussissez 2 censures d'affilée (votre Censure vise le domaine censuré).*"],
    ["O-HAUT", "Coup d'État", "Faites censurer le domaine en haut de la hiérarchie.*"],
    ["O-SEUL", "Voix solitaire", "Faites censurer un domaine en étant le seul à avoir voté pour lui.*"],
    ["O-PAIRE", "Équilibre", "Vos 3 autres pistes (hors une piste à 7) sont exactement au même niveau (au moins 1)."], // Oni, 08/11/2026
    ["O-VEILLE6", "Vigie", "Ayez 6 Veilles."],
    ["O-VOL4", "Pillard", "Volez ou faites perdre au moins 4 Veilles à vos adversaires.*"],
    ["O-SANSBASE", "Avant-garde", "N'ayez plus aucune carte de base."],
    ["O-NIV3", "Élite", "Possédez 2 cartes de niveau 3."],
    ["O-SEPTHAUT", "Consécration", "Un de vos domaines à 7 est en haut de la hiérarchie."],
    ["O-XP2", "Rivalité", "Faites perdre de l'XP à 2 joueurs différents.*"],
    ["O-QUATRE", "Polymathe", "Ayez au moins 4 sur chaque piste."],
    ["O-SABOTEUR", "Le saboteur", "Faites défausser l'objectif d'un adversaire.*"],
  ];
  // Jetons de palier (Oni, 08/11/2026) : le premier joueur qui atteint 3 ou 5 sur une piste prend le jeton.
  const JETONS = {
    "bio-3": { k: "veille2", nom: "+2 Veilles", texte: "Gagnez 2 Veilles immédiatement." },
    "bio-5": { k: "conversion", nom: "Conversion améliorée", texte: "Pour le reste de la partie, 2 Veilles suffisent pour 1 XP." },
    "phys-3": { k: "gemmeOr", nom: "Gemme d'or", texte: "Pour le reste de la partie, vous gagnez toutes les égalités entre joueurs." },
    "phys-5": { k: "regard", nom: "Regard vers l'avenir", texte: "Une fois : regardez les 3 objectifs du dessus et remettez-les dans l'ordre de votre choix." },
    "eco-3": { k: "veto", nom: "Veto", texte: "Une fois, après la révélation : annulez le vote de censure d'un adversaire." },
    "eco-5": { k: "immunite", nom: "Immunité", texte: "Une fois, annoncé avec votre programmation : votre Recherche ne peut pas être censurée." },
    "chim-3": { k: "vote2", nom: "Vote double", texte: "Une fois, annoncé avec votre programmation : votre Censure compte double." },
    "chim-5": { k: "achat2", nom: "Progrès gratuit", texte: "Une fois : en plus de votre acquisition normale, acquérez une carte Progrès visible sans en avoir le coût." }, // Oni, 08/11/2026
  };

  const PAR_ID = {};
  for (const [id, type, niveau, nom, effet, cout, min] of P) {
    const dom = { BIO: "bio", PHYS: "phys", ECO: "eco", CHIM: "chim" }[id.split("-")[0]];
    PAR_ID[id] = { id, type, dom, niveau, nom, effet, cout, min };
  }
  // cartes de départ : aucun effet
  for (const dom of DOMAINES) for (const type of ["R", "C"]) {
    const id = "S-" + type + "-" + dom;
    PAR_ID[id] = { id, type, dom, niveau: 0, nom: (type === "R" ? "Recherche " : "Censure ") + NOM_DOMAINE[dom], effet: "", cout: {}, min: 2, depart: true };
  }
  const OBJ = {};
  for (const [id, nom, texte] of OBJECTIFS) OBJ[id] = { id, nom, texte };

  return { DOMAINES, NOM_DOMAINE, COULEUR, MAX_PISTE, PAR_ID, OBJ, JETONS, PROGRES: P.map(p => p[0]) };
})();
if (typeof module !== "undefined") module.exports = CARTES;
