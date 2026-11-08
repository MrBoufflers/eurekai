# Eurekaïe ! — prototype numérique

Jeu de plateau d'Oni (2 à 5 joueurs) : programmation secrète d'une Recherche et d'une Censure, vote de censure, pistes d'XP de 0 à 7, jetons de palier (3 et 5), objectifs piochés à chaque piste à 7 (fin de partie).
Tout est **en français**. Même organisation et mêmes règles de travail que Swarm & Steel (dépôt SWARM, qu'on ne modifie pas).

## Règles de travail
- Aucune modification de gameplay (valeurs, règles, effets) sans validation d'Oni. Signaler les incohérences au lieu de les corriger en silence.
- Interprétations provisoires : repère « À VALIDER » dans le code + `docs/questions.md`.
- Pas de simulation de parties en masse sans demande explicite.
- Vérifier avec `npm test` puis **une seule** partie robot (`npm run e2e`) avant de livrer.

## Sources
- Cartes et Inventions : `cartes_data (1).json` de kurzgui (Drive, dossier « Eureka », v2.0) → `src/cartes.js`.
- Déroulement du tour : « EUREKAÏE_livret de règles V3 » et « Aide de jeu » (Drive).

## Arborescence
```
src/cartes.js       Données des cartes (module CARTES)
src/engine.js       Moteur de règles pur, sans DOM (module EK)
src/ia.js           IA basique (automa), sans DOM : IA.decider(S, p) / IA.jouer(S, p) ; heuristiques + hasard, information publique seulement
src/bilan.js        Bilan de fin de partie (BILAN.resume, BILAN.plateau en SVG, agrégats par version, CSV), sans DOM
src/ui.js           Interface (une partie sur un seul appareil) : rendu innerHTML, clics délégués sur [data-a] → handle(a, d)
src/style.css       Styles (thèmes clair / sombre, mise en page ordinateur et téléphone)
tools/build.py      Assemble dist/eurekaie.html (page autonome) : `npm run build` ; ne pas éditer dist/ à la main.
                    `--site` écrit aussi site/index.html (publié par Netlify)
netlify.toml        Netlify (projet « jeurekai », https://jeurekai.netlify.app) : build `python3 tools/build.py --site`, publie site/
tests/rules.test.js Tests ciblés des règles
tests/ia.test.js    6 parties jouées par l'IA (graines fixes) : aucun coup refusé, parties terminées (pas une étude d'équilibrage)
tests/e2e-partie.js Partie complète jouée en vrais clics dans Chromium (`npm run e2e`)
docs/questions.md   Points de règles à valider par Oni
```

## Moteur
- État `S` sérialisable en JSON, créé par `EK.newGame({ noms })`.
- Toutes les actions passent par `EK.apply(S, joueur, type, args)` → `""` ou raison du refus :
  `programmer {r, c, jetons}`, `annuler`, `choisir {v}`, `convertir {dom}`, `jeton {k: "regard"}`, `acquerir {dom}`, `passer`.
- Phases : `prog` (programmation simultanée) → `resol` (Vetos, étape `vote` = `compterVotes`, puis effets, avec `S.attente` quand une carte demande un choix) → `acq` (acquisition dans l'ordre `S.ordre`) → tour suivant ; `fin`.
- Cartes d'un joueur : `cartes["R-bio"]`… (8 emplacements), `verrou` = emplacements verrouillés ce tour.
- Objectifs : `j.objectifs` (`{id, n, v, ok}` = compteurs depuis la pioche), conditions dans `OK`, `verifier(S)` après chaque étape et chaque action. Paliers : `S.paliers`, jetons du joueur `j.jetons` (`jetonUtilisable`).
- Effets : table `FX` (id → `{quand, run}`), `quand` = censure / recherche / censure_r / base. Effets pas encore codés : `A_VENIR`.
- `EK.attendus(S)` : qui doit agir ; `EK.viewFor(S, p)` : vue filtrée (programmation des autres et ordre des piles cachés).
- Hasard : `EK.setRng(f)`.

## Interface
- Écran de passage (`secretPour()`) pour la programmation et les choix secrets (`demande.prive`) ; `ui.voit` = joueur qui regarde.
- Partie sauvegardée dans `localStorage` (`eurekaie-partie`), thème dans `eurekaie-theme`.
- Joueurs IA : `S.joueurs[p].ia = true` (posé par l'interface) ; `tourIA()` fait jouer l'IA après chaque rendu (délai `ui.vitesse`).
  Avec un seul humain, pas d'écran de passage.
- Statistiques : à la fin d'une partie, `enregistrer()` ajoute `{ r: BILAN.resume(S), svg }` à `localStorage["eurekaie-stats"]` (300 dernières) ;
  page « Statistiques » (accueil, ou « Bilan de la partie » sur l'écran de victoire). Pas de serveur pour l'instant (≠ SWARM).
