# Eurekaïe !

Prototype numérique du jeu de plateau **Eurekaïe ! — la course au savoir** (2 à 5 joueurs), conçu par Oni.

Chaque tour, les joueurs programment en secret une **Recherche** (le domaine où ils progressent) et une **Censure** (le domaine qu'ils veulent priver de financement).
Le domaine le plus voté est censuré. Les pistes d'expérience vont de 0 à 7 ; les premiers à atteindre 3 et 5 prennent un jeton de palier ;
chaque piste à 7 fait piocher un **objectif** public, et on gagne dès qu'un objectif est rempli.

## Jouer

En ligne : https://jeurekai.netlify.app (mis à jour à chaque envoi sur `main`). Ou ouvrir `dist/eurekaie.html` dans un navigateur (aucune installation). Sur l'accueil : nombre de joueurs, et pour chaque place « Humain » ou « IA ».
La partie est sauvegardée dans le navigateur ; les statistiques des parties terminées aussi (bouton « Statistiques »).

## Règles

- Livret de règles et cartes d'origine : dossier « Eureka » sur le Drive d'Oni (livret V3, `cartes_data (1).json` de kurzgui).
- Décisions prises depuis et points encore à valider : [`docs/questions.md`](docs/questions.md).

## Développement

```
npm test        # tests des règles + parties jouées par l'IA
npm run build   # régénère dist/eurekaie.html à partir de src/
npm run e2e     # une partie complète en vrais clics dans Chromium (Playwright)
```

- `src/cartes.js` : données des cartes, objectifs et jetons
- `src/engine.js` : moteur de règles (sans DOM)
- `src/ia.js` : IA basique (automa)
- `src/bilan.js` : bilan de fin de partie et statistiques
- `src/ui.js`, `src/style.css` : interface
- `tools/build.py` : assemble la page autonome

Voir aussi `CLAUDE.md` (règles de travail et architecture).
