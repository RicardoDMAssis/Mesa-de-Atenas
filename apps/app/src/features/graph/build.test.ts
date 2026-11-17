import { describe, expect, it } from "vitest";
import { buildGraph, SUBJECT_PREFIX } from "./build";

const data = {
  subjects: [
    { id: "letras", name: "Letras", parentId: null },
    { id: "fono", name: "Fonologia", parentId: "letras" },
    { id: "hist", name: "História", parentId: null },
  ],
  notes: [
    { id: "a", title: "Fonema", subjectId: "fono" },
    { id: "b", title: "Sílaba", subjectId: "fono" },
    { id: "c", title: "Roma", subjectId: "hist" },
    { id: "d", title: "", subjectId: null },
  ],
  links: [
    { source: "a", target: "b" },
    { source: "b", target: "a" },
    { source: "a", target: "c" },
  ],
};
const base = { subjectIds: null, showSubjects: false, hideIsolated: false };

describe("buildGraph", () => {
  it("une links nos dois sentidos, calcula conexões e a matéria raiz", () => {
    const { nodes, edges } = buildGraph(data, base);
    expect(edges).toHaveLength(2);
    const a = nodes.find((n) => n.id === "a");
    expect(a).toMatchObject({ degree: 2, rootSubjectId: "letras", label: "Fonema" });
    expect(nodes.find((n) => n.id === "d")).toMatchObject({ label: "Sem título", degree: 0 });
  });

  it("filtra por matéria e esconde notas sem conexão", () => {
    const filtered = buildGraph(data, { ...base, subjectIds: new Set(["fono"]) });
    expect(filtered.nodes.map((n) => n.id).sort()).toEqual(["a", "b"]);
    expect(filtered.edges).toHaveLength(1);
    const noIsolated = buildGraph(data, { ...base, hideIsolated: true });
    expect(noIsolated.nodes.map((n) => n.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("inclui só as matérias que têm notas, ligadas a elas", () => {
    const { nodes, edges } = buildGraph(data, { ...base, showSubjects: true });
    const subjects = nodes
      .filter((n) => n.kind === "subject")
      .map((n) => n.id)
      .sort();
    expect(subjects).toEqual([`${SUBJECT_PREFIX}fono`, `${SUBJECT_PREFIX}hist`]);
    expect(edges.filter((e) => e.kind === "subject")).toHaveLength(3);
  });

  it("grafo local: só a nota e os vizinhos diretos", () => {
    const { nodes, edges } = buildGraph(data, { ...base, showSubjects: true, centerId: "b" });
    expect(nodes.map((n) => n.id).sort()).toEqual(["a", "b"]);
    expect(edges).toEqual([{ source: "a", target: "b", kind: "link" }]);
  });
});
