// Test de l'IA : quelques parties entièrement jouées par l'IA (hasard fixé), pour vérifier
// qu'elle ne joue jamais de coup refusé, ne bloque pas, et que les parties se terminent.
// Ce n'est pas une étude d'équilibrage (peu de parties).
const EK = require("../src/engine.js"), IA = require("../src/ia.js");
const graine = s => () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
let fails = 0;
for (const [n, s] of [[3, 1], [4, 2], [4, 3], [5, 4], [5, 5], [2, 6]]) {
  const rng = graine(s); EK.setRng(rng); IA.setRng(rng);
  const S = EK.newGame({ noms: ["A", "B", "C", "D", "E"].slice(0, n) });
  let replis = 0, actions = 0;
  while (S.gagnant === null && S.tour <= 60 && actions < 5000) {
    const p = EK.attendus(S)[0];
    const a = IA.jouer(S, p);
    if (!a) { console.log("ÉCHEC : IA sans action", n, s, S.phase); fails++; break; }
    if (a.repli) replis++;
    actions++;
  }
  const fin = S.gagnant !== null ? `${S.joueurs[S.gagnant].nom} gagne (${(S.log.slice().reverse().find(l => /objectif|Extinction/.test(l.txt) && /gagne/.test(l.txt)) || {}).txt || ""})` : "pas de vainqueur";
  console.log(`${n} joueurs (graine ${s}) : ${S.tour} tours, ${actions} actions, ${replis} coup(s) refusé(s) — ${fin}`);
  if (replis) fails++;
  if (S.gagnant === null) { console.log("ÉCHEC : partie non terminée en 60 tours"); fails++; }
}
console.log(fails ? `\n${fails} échec(s)` : "\nTous les tests de l'IA passent.");
process.exit(fails ? 1 : 0);
