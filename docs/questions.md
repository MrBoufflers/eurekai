# Eurekaïe ! — points à valider par Oni

Sources : cartes et Inventions = `cartes_data (1).json` (kurzgui, v2.0) ; déroulement du tour = livret V3 (texte v2.0) et « Aide de jeu ».
Le générateur `cartes_eurekaia.html` contient une ancienne liste (v1.0) : non utilisée.

Chaque point ci-dessous a reçu une interprétation **provisoire** dans le moteur (repère « À VALIDER » dans `src/engine.js`).

## Décisions d'Oni (07/11/2026, appliquées)
- Le domaine censuré passe **tout en haut** de la hiérarchie, **à la fin du tour** (l'ordre du tour en cours garde l'ancienne hiérarchie).
- Égalité de votes : le domaine **le plus bas** est censuré (inchangé).
- Égalité entre joueurs ayant recherché le même domaine : **gemmes** (numéros 1 à n tirés au hasard) ; la plus grande passe d'abord, puis les joueurs à égalité échangent leurs gemmes.
- **+1 Veille** pour chaque carte Censure qui a visé le domaine censuré ; un joueur censuré reçoit **2 Veilles** (au lieu de 1).

## Décisions d'Oni (08/11/2026, appliquées)
- **Fin de partie** : les Inventions Ultimes sont remplacées par des **objectifs** publics. Chaque piste qui atteint 7 (la première fois) fait piocher 1 objectif ; on peut en avoir plusieurs. On gagne **dès qu'un objectif est rempli**, à n'importe quel moment (déjà rempli à la pioche = victoire immédiate). Les objectifs « d'affilée » ou cumulatifs ne comptent qu'à partir de la pioche. Retomber sous 7 ne fait pas perdre l'objectif.
- Chaque XP gagnée sur une piste déjà à 7 rapporte **2 Veilles**.
- **Chasse au leader** : une Censure efficace sur un domaine à 7 chez un adversaire qui a un objectif rapporte 1 Veille de plus.
- **Jetons de palier** (premier joueur à atteindre 3 ou 5 sur une piste) : Bio 3 +2 Veilles, Bio 5 Conversion améliorée ; Phys 3 Gemme d'or, Phys 5 Regard vers l'avenir ; Éco 3 Veto, Éco 5 Immunité ; Chim 3 Vote double, Chim 5 Double achat. Vote double et Immunité s'annoncent face cachée avec la programmation ; Veto après la révélation, avant le décompte, dans l'ordre de jeu ; Gemme d'or : gagne toutes les égalités, hors échange ; même palier atteint au même tour : ordre de jeu ; jeton gardé si on redescend ; utilisable à partir du tour suivant.
- Noms des objectifs et des nouvelles cartes : validés pour l'instant.
- **Début de partie** : dans chaque domaine, les 2 cartes qui ne coûtent que 1 XP (une Recherche, une Censure) sont toujours les 2 premières de la pile, dans un ordre tiré au hasard.
- 4 nouvelles cartes de niveau 2 autour des objectifs : Mimétisme (Bio, R), Prémonition (Phys, R), Compost (Éco, C), Sabotage (Chim, C).

- **Équilibre** (08/11/2026) : les 3 autres pistes (hors une piste à 7) doivent être exactement au même niveau.

- **7 nouvelles Censures** (08/11/2026) : Contagion, Inoculation forcée (chaque autre joueur), Expropriation (Gemme d'or et Conversion améliorée comprises), Interception, Inversion des pôles, Gel des fonds, Précipité (1 Veille). Court-circuit refusé. Total : 30 Recherches / 29 Censures.
- **Jeton Chimie 5 « Progrès gratuit »** (remplace Double achat) : une acquisition en plus de l'acquisition normale, sans condition de coût.

## Questions ouvertes (08/11/2026)
- **Précipité** est désormais identique à Onde de Choc (un joueur perd 1 Veille) : à différencier ?
- **Il manque 1 Censure** pour 30/30 (Court-circuit retiré), de préférence en Physique.
- **Tête de pile** : réservée aux 8 cartes d'origine à 1 XP ; Contagion et Interception (1 XP aussi) sont mélangées avec le reste du niveau 1.
- **Inoculation forcée** : à égalité entre plusieurs pistes les plus hautes, le joueur touché choisit (Oni, 08/11/2026, appliqué).
- **Expropriation** : le jeton volé n'est utilisable qu'au tour suivant (comme un jeton gagné).
- **Interception** : le joueur voit la carte avant de la placer sous la pile (« Regardez »).
- **Seuils à 3 joueurs** : 26 Recherches / 16 Censures. Ouvrir à 3 joueurs Virus de Données, Déforestation, Antimatière et Bombe Fumigène donnerait 26 / 20.
- **Équilibre** : niveau commun d'au moins 1 (sinon un joueur à 7-0-0-0 gagnerait dès la pioche).
- **Nouvelles cartes** : domaine, type, coût (3 + 1 dans un autre domaine) et nom proposés par Claude. Compost permet de **regarder** l'objectif avant de décider de l'enterrer (la proposition initiale était à l'aveugle). Mimétisme est facultatif.
- **Chasse au leader** : la Veille de plus est donnée une seule fois par Censure, même si plusieurs adversaires sont à 7 dans ce domaine ; jamais pour son propre domaine.
- **Veto à 2 joueurs** : si les deux joueurs s'annulent mutuellement, il n'y a plus aucun vote et l'égalité générale censure le domaine le plus bas.
- **Double achat** : après une première carte, le joueur peut en prendre une seconde ou passer ; le jeton n'est dépensé que s'il prend la seconde.

## Règles du tour
1. **Échange des gemmes à 3 joueurs ou plus à égalité** : provisoirement, l'ordre des gemmes est inversé (la plus grande va à celui qui passe en dernier, la plus petite au premier ; celui du milieu garde la sienne à 3).
1 bis. **Moment des nouvelles Veilles** : données après les effets des Censures (donc après Spore Parasite ou Symbiocité).
1 ter. **Auto-censure** : un joueur qui recherche et censure le même domaine, s'il est censuré, reçoit 3 Veilles (2 + 1), soit 1 XP par tour. À surveiller en partie test (« stratégie tortue » des Retours Claude).
2. **Censures à 3 joueurs** : le livret V3 dit 1 Censure par joueur à 2 et 3 joueurs ; « Réponses de règles » (18/02) disait 2 à 3 joueurs. Le moteur suit le livret (plus récent).
3. **Acquérir une carte dont l'emplacement est verrouillé** (ex. j'achète une Recherche Bio alors que ma Recherche Bio vient d'être jouée) : la nouvelle carte prend la place de l'ancienne et reste verrouillée.
5. **Conversion 3 Veilles → 1 XP** (2 avec Conversion améliorée) : autorisée à tout moment de la partie (programmation, acquisition…).

## Effets de cartes
6. **Symbiose, Fusion Froide** (« +2 XP, puis −1 ailleurs ») : +2 en plus du +1 de base (donc +3 puis −1).
7. **Mutation Cachée** : le vote compte double même si Biologie n'est pas censurée (c'est un effet de vote).
8. **Cibles des Censures** (Pandémie Ciblée, Onde de Choc, Gaz Soporifique, Spore Parasite) : un autre joueur, jamais soi-même. **Panacée** : n'importe quel joueur, soi-même compris, et on peut renoncer.
9. **Prisme Quantique, Catalyseur** : le +1 XP va dans le domaine de la carte.
10. **Téléporteur, Extinction de Masse** (s'activent si la Recherche est censurée) : le joueur reçoit aussi sa Veille habituelle.
11. **Terra Genesis** : « a recherché » = a joué une Recherche dans ce domaine, censurée ou non.
12. **Virus de Données, Déforestation** : touchent aussi le joueur qui a joué la carte.
13. **Antimatière** : l'inversion est immédiate ; l'ordre d'acquisition de ce tour suit la hiérarchie inversée, puis le domaine censuré passe en haut à la fin du tour.
13 bis. **Lobby Vert** : passé à « 3 Veilles au lieu de 2 » (Oni, 07/11/2026), appliqué.
14. **Symbiocité** : les Veilles sont redistribuées une à une, en commençant par le joueur puis dans l'ordre des sièges.

## Incohérences entre le JSON et les principes du livret (le JSON est appliqué tel quel)
- Le livret dit qu'aucune carte ne modifie la hiérarchie : **Antimatière** l'inverse.
- Le livret dit que les Censures sont toujours des malus pour les adversaires : **Tempête Solaire** (+2 Veille) et **Acide Corrosif** (+1 Veille) sont des bonus pour soi.
- **Réaction en chaîne** parle de « carte Projet » : interprété comme « carte Progrès ».

## Effets prévus pour l'étape 3 (pas encore programmés)
Contrôle Génétique, Interférence, Trou Noir, Supraconducteur, Machine Temporelle, Dimension Parallèle, Singularité,
Lobby Vert, Permaculture, Polymère Intelligent, Bombe Fumigène, Nanotechnologie, Le Stimulant Divin.
Ces cartes peuvent être acquises ; leur effet est signalé « pas encore programmé » dans le journal.
