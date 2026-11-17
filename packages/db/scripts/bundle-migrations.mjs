// Empacota os .sql gerados pelo drizzle-kit em um módulo TypeScript, para que as
// migrações rodem igual no navegador e no Android (sem acesso ao sistema de arquivos).
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "drizzle");

const migrations = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => ({ id: f.replace(/\.sql$/, ""), sql: readFileSync(join(dir, f), "utf8") }));

const out = `// Arquivo gerado por scripts/bundle-migrations.mjs — não edite. Rode \`pnpm db:generate\`.
import type { Migration } from "./migrate";

export const migrations: Migration[] = ${JSON.stringify(migrations, null, 2)};
`;

writeFileSync(join(root, "src", "migrations.generated.ts"), out);
console.log(`${migrations.length} migração(ões) empacotada(s).`);
