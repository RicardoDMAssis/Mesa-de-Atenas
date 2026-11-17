import { describe, expect, it } from "vitest";
import { cleanWikitext, parseEntry } from "./wikitext";

const SAMPLE = `{{-pt-}}=
==Adjetivo==
{{flex.pt|ms=feliz}}
# que [[sentir|sente]] '''[[alegria]]'''
#* ''Estou muito '''feliz''' hoje.''
#* ''Segundo exemplo, ignorado.''
# {{escopo|pt|Brasil}} bem-sucedido<ref>Fonte</ref>
#: '''2004''', citação ignorada

===Antônimo===
* [[infeliz]]

===Sinônimos===
{{dividir em colunas|3}}
* [[alegre]]
* [[contente]], [[alegre]]
{{dividir em colunas/fim}}

===Tradução===
* {{trad|en|happy}}

==Substantivo<sup>1</sup>==
# pessoa feliz

=={{pronúncia|pt}}==
* ignorado

==Ver também==
* [[felicidade]]

={{-es-}}=
==Adjetivo==
# feliz em espanhol
`;

describe("parseEntry", () => {
  it("extrai classes, definições com um exemplo, sinônimos e antônimos do português", () => {
    expect(parseEntry("feliz", SAMPLE)).toEqual({
      word: "feliz",
      classes: [
        {
          name: "Adjetivo",
          definitions: [
            { text: "que sente alegria", example: "Estou muito feliz hoje." },
            { text: "(Brasil) bem-sucedido" },
          ],
          synonyms: ["alegre", "contente"],
          antonyms: ["infeliz"],
        },
        {
          name: "Substantivo",
          definitions: [{ text: "pessoa feliz" }],
          synonyms: [],
          antonyms: [],
        },
      ],
    });
  });

  it("devolve null sem verbete em português", () => {
    expect(parseEntry("x", "={{-en-}}=\n==Noun==\n# thing")).toBeNull();
  });
});

describe("cleanWikitext", () => {
  it("remove links, negrito, templates aninhados e tags", () => {
    expect(cleanWikitext("[[a|b]] e '''[[c]]''' {{x|{{y}}}} <b>d</b>")).toBe("b e c d");
  });
});
