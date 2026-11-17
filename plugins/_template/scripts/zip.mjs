// Empacota a pasta dist/ em <id>-<versão>.zip, pronto para "Instalar de arquivo".
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { zipSync } from "fflate";

const dist = new URL("../dist/", import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(join(dist, "manifest.json"), "utf8"));
const files = {};
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else files[relative(dist, path).split("\\").join("/")] = readFileSync(path);
  }
};
walk(dist);
const out = new URL(`../${manifest.id}-${manifest.version}.zip`, import.meta.url).pathname;
writeFileSync(out, zipSync(files));
console.log(`Gerado: ${relative(process.cwd(), out)} (${Object.keys(files).length} arquivos)`);
