import { SNIPPET_CLOSE, SNIPPET_OPEN, search } from "@estudarella/db";
import { Layers, NotebookText } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { PageTitle } from "../components/Card";
import { EmptyState, Input } from "../components/ui";
import { useLiveQuery } from "../data/useLiveQuery";
import { noteLabel } from "../features/notes/titles";

/** Mostra o trecho com os termos encontrados destacados. */
function Snippet({ text }: { text: string }) {
  const parts = text.split(new RegExp(`(${SNIPPET_OPEN}[^${SNIPPET_CLOSE}]*${SNIPPET_CLOSE})`));
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith(SNIPPET_OPEN) ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: trechos estáticos
          <mark key={i} className="rounded bg-accent-soft px-0.5 text-accent">
            {part.slice(1, -1)}
          </mark>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: trechos estáticos
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export function Busca() {
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState(params.get("q") ?? "");
  const [query, setQuery] = useState(text);

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(text);
      setParams(text ? { q: text } : {}, { replace: true });
    }, 200);
    return () => clearTimeout(t);
  }, [text, setParams]);

  const results = useLiveQuery(["notes", "cards"], (db) => search(db, query), [query]);

  return (
    <>
      <PageTitle>Buscar</PageTitle>
      <Input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Buscar em notas e cards"
        aria-label="Buscar em notas e cards"
        autoFocus
      />
      <div className="mt-4">
        {!query.trim() ? null : results.data && results.data.length === 0 ? (
          <EmptyState title="Nada encontrado">
            Tente outras palavras ou só o começo delas.
          </EmptyState>
        ) : (
          <ul className="grid gap-2" aria-label="Resultados">
            {results.data?.map((hit) => (
              <li key={`${hit.kind}-${hit.id}`}>
                <Link
                  to={hit.kind === "note" ? `/notas/${hit.id}` : `/baralhos/${hit.deckId}`}
                  className="flex gap-3 rounded-xl border border-line bg-surface p-3 hover:border-accent"
                >
                  {hit.kind === "note" ? (
                    <NotebookText
                      size={18}
                      className="mt-0.5 shrink-0 text-muted"
                      aria-label="Nota"
                    />
                  ) : (
                    <Layers size={18} className="mt-0.5 shrink-0 text-muted" aria-label="Card" />
                  )}
                  <div className="min-w-0">
                    {hit.kind === "note" && (
                      <p className="truncate font-medium">{noteLabel(hit.title)}</p>
                    )}
                    <p className="line-clamp-2 text-sm text-muted">
                      <Snippet text={hit.snippet} />
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
