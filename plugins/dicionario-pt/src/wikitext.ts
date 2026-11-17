/** Uma classe gramatical de uma palavra (ex.: Substantivo), como no Wikcionário. */
export interface WordClass {
  name: string;
  definitions: { text: string; example?: string }[];
  synonyms: string[];
  antonyms: string[];
}

export interface Entry {
  word: string;
  classes: WordClass[];
}

/** Seções de nível 2 que não são classes gramaticais. */
const NOT_A_CLASS = /^(ver também|ligações externas|referências|tradução|anagramas|fontes|notas)/i;

/** Remove marcação do Wikcionário, deixando texto legível. */
export function cleanWikitext(input: string): string {
  let s = input
    .replace(/<ref[^>]*\/>/g, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  // Templates (inclusive aninhados): "{{escopo|…|Brasil}}" vira "(Brasil)"; os demais somem.
  for (let guard = 0; guard < 10 && s.includes("{{"); guard++) {
    s = s.replace(/\{\{([^{}]*)\}\}/g, (_, body: string) => {
      const parts = body.split("|").map((p) => p.trim());
      const name = (parts[0] ?? "").toLowerCase();
      if (name.startsWith("escopo")) {
        const label = parts
          .slice(1)
          .filter((p) => p && !/^[a-z]{2,3}$/.test(p) && !p.includes("="));
        return label.length ? `(${label.join(", ")}) ` : "";
      }
      return "";
    });
  }
  return s
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/'''?/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Alvos dos links [[...]] de uma linha (ex.: "* [[alegre]], [[contente]]"). */
function linkTargets(line: string): string[] {
  return [...line.matchAll(/\[\[([^\]|#]+)(?:[^\]]*)\]\]/g)].map((m) => (m[1] ?? "").trim());
}

/**
 * Extrai da seção de português ({{-pt-}}) as classes gramaticais, com definições
 * (e o primeiro exemplo de cada), sinônimos e antônimos. `null` se não houver
 * verbete em português.
 */
export function parseEntry(word: string, wikitext: string): Entry | null {
  const start = wikitext.indexOf("{{-pt-}}");
  if (start < 0) return null;
  const after = wikitext.indexOf("\n={{-", start + 8);
  const section = wikitext.slice(start, after < 0 ? undefined : after);

  const classes: WordClass[] = [];
  let current: WordClass | null = null;
  let sub: "synonyms" | "antonyms" | null = null;

  for (const raw of section.split("\n")) {
    const line = raw.trimEnd();
    const h2 = /^==(?!=)(.+?)==\s*$/.exec(line);
    if (h2) {
      const name = cleanWikitext((h2[1] ?? "").replace(/<sup>.*?<\/sup>/g, ""));
      current = null;
      sub = null;
      if (name && !h2[1]?.trim().startsWith("{{") && !NOT_A_CLASS.test(name)) {
        current = { name, definitions: [], synonyms: [], antonyms: [] };
        classes.push(current);
      }
      continue;
    }
    const h3 = /^===(?!=)(.+?)===\s*$/.exec(line);
    if (h3) {
      const name = (h3[1] ?? "").toLowerCase();
      sub = name.startsWith("sinônimo")
        ? "synonyms"
        : name.startsWith("antônimo")
          ? "antonyms"
          : null;
      continue;
    }
    if (!current) continue;
    if (sub && line.startsWith("*")) {
      for (const target of linkTargets(line)) {
        if (target && !current[sub].includes(target)) current[sub].push(target);
      }
      continue;
    }
    if (/^#(?![*:#])/.test(line)) {
      const text = cleanWikitext(line.slice(1));
      if (text) current.definitions.push({ text });
      continue;
    }
    if (/^#\*(?!:)/.test(line)) {
      const last = current.definitions.at(-1);
      const example = cleanWikitext(line.slice(2));
      if (last && !last.example && example) last.example = example;
    }
  }
  const useful = classes.filter(
    (c) => c.definitions.length || c.synonyms.length || c.antonyms.length,
  );
  return useful.length ? { word, classes: useful } : null;
}
