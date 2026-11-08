# Assemble dist/eurekaie.html : une seule page autonome (styles et scripts intégrés)
import pathlib
R = pathlib.Path(__file__).resolve().parent.parent
css = (R / "src/style.css").read_text(encoding="utf-8")
js = "\n".join((R / f"src/{n}.js").read_text(encoding="utf-8") for n in ["cartes", "engine", "ia", "bilan", "ui"])
assert "</script" not in js
html = f"""<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Eurekaïe !</title>
<script>try{{var t=localStorage.getItem("eurekaie-theme");if(t)document.documentElement.dataset.theme=t}}catch(e){{}}</script>
<style>{css}</style></head>
<body><div id="app"></div><script>{js}</script></body></html>
"""
(R / "dist").mkdir(exist_ok=True)
(R / "dist/eurekaie.html").write_text(html, encoding="utf-8")
print("dist/eurekaie.html", len(html), "octets")
