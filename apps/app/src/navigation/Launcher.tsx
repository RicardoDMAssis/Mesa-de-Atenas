import { Pin, PinOff, Search } from "lucide-react";
import { Dialog as RadixDialog } from "radix-ui";
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { normalize, noteLabel, useNoteTitles } from "../features/notes/titles";
import { MAX_PINNED, type Screen, useLauncher, useNavPrefs, useScreens } from "./screens";

/** Celular/tablet: tela estreita ou toque como entrada principal. */
const isTouchLayout = () => window.matchMedia("(max-width: 767px), (pointer: coarse)").matches;

type Item = { kind: "screen"; screen: Screen } | { kind: "note"; id: string; title: string };

/**
 * Painel para ir a qualquer tela (do app ou de plugins) ou nota. Abre pelo botão
 * "Mais" no celular e por Ctrl+K / ⌘K no computador. Também permite escolher as
 * telas fixadas na barra inferior.
 */
export function Launcher() {
  const open = useLauncher((s) => s.open);
  const setOpen = useLauncher((s) => s.setOpen);
  const navigate = useNavigate();
  const screens = useScreens();
  const { pinned, recent, togglePin } = useNavPrefs();
  const titles = useNoteTitles((s) => s.titles);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(false);
  const [active, setActive] = useState(0);
  const list = useRef<HTMLDivElement>(null);

  // Ctrl+K / ⌘K abre de qualquer tela.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!useLauncher.getState().open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setEditing(false);
      // No celular nada começa destacado; no computador, o primeiro item (para o Enter).
      setActive(isTouchLayout() ? -1 : 0);
    }
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const q = normalize(query.trim());
    const matches = (text: string) => normalize(text).includes(q);
    const screenItems = screens
      .filter((s) => !q || matches(s.label) || (s.keywords && matches(s.keywords)))
      .map((screen) => ({ kind: "screen" as const, screen }));
    if (!q) return screenItems;
    const notes: Item[] = [];
    for (const [id, title] of titles) {
      if (notes.length >= 8) break;
      if (matches(noteLabel(title))) notes.push({ kind: "note", id, title });
    }
    return [...screenItems, ...notes];
  }, [query, screens, titles]);

  const recentScreens = recent
    .map((id) => screens.find((s) => s.id === id))
    .filter((s): s is Screen => Boolean(s))
    .slice(0, 4);

  const go = (item: Item) => {
    if (editing && item.kind === "screen") {
      togglePin(item.screen.id);
      return;
    }
    setOpen(false);
    navigate(item.kind === "screen" ? item.screen.to : `/notas/${item.id}`);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const from = active < 0 ? (e.key === "ArrowDown" ? -1 : 0) : active;
      const next =
        (from + (e.key === "ArrowDown" ? 1 : -1) + items.length) % Math.max(items.length, 1);
      setActive(next);
      list.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      const item = items[active];
      if (item) {
        e.preventDefault();
        go(item);
      }
    }
  };

  const screenItems = items.filter((i) => i.kind === "screen");
  const noteItems = items.filter((i) => i.kind === "note");

  return (
    <RadixDialog.Root open={open} onOpenChange={setOpen}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/45" />
        <RadixDialog.Content
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-2xl border border-line bg-surface pb-[env(safe-area-inset-bottom)] text-fg shadow-xl outline-none md:inset-x-auto md:top-[12vh] md:bottom-auto md:left-1/2 md:w-[calc(100%-2rem)] md:max-w-xl md:-translate-x-1/2 md:rounded-2xl"
          onKeyDown={onKeyDown}
          // No celular, não foca a busca ao abrir: o teclado cobriria metade do painel.
          onOpenAutoFocus={(e) => {
            if (isTouchLayout()) e.preventDefault();
          }}
        >
          <RadixDialog.Title className="sr-only">Ir para</RadixDialog.Title>
          <RadixDialog.Description className="sr-only">
            Escolha uma tela ou busque uma nota.
          </RadixDialog.Description>
          <div className="flex items-center gap-2 border-b border-line px-4">
            <Search size={18} className="shrink-0 text-muted" aria-hidden />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              placeholder="Ir para tela ou nota…"
              aria-label="Ir para tela ou nota"
              className="min-h-14 w-full bg-transparent text-base outline-none placeholder:text-muted"
            />
            <kbd className="hidden shrink-0 rounded border border-line px-1.5 text-xs text-muted md:inline">
              Esc
            </kbd>
          </div>

          <div ref={list} className="min-h-0 flex-1 overflow-y-auto p-3">
            {!query && recentScreens.length > 0 && !editing && (
              <section className="mb-3">
                <h3 className="px-1 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                  Recentes
                </h3>
                <div className="flex flex-wrap gap-2">
                  {recentScreens.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => go({ kind: "screen", screen: s })}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line px-3 text-sm hover:border-accent"
                    >
                      <s.icon size={15} aria-hidden />
                      {s.label}
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section>
              <div className="flex items-center justify-between px-1 pb-1.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {editing ? `Barra inferior (${pinned.length}/${MAX_PINNED})` : "Telas"}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditing(!editing)}
                  className="min-h-8 rounded-md px-2 text-xs font-medium text-accent md:hidden"
                >
                  {editing ? "Pronto" : "Personalizar barra"}
                </button>
              </div>
              {screenItems.length === 0 ? (
                <p className="px-1 py-2 text-sm text-muted">Nenhuma tela com esse nome.</p>
              ) : (
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Telas">
                  {screenItems.map((item) => {
                    if (item.kind !== "screen") return null;
                    const index = items.indexOf(item);
                    const isPinned = pinned.includes(item.screen.id);
                    const Icon = item.screen.icon;
                    return (
                      <li key={item.screen.id}>
                        <button
                          type="button"
                          data-index={index}
                          aria-pressed={editing ? isPinned : undefined}
                          disabled={editing && !isPinned && pinned.length >= MAX_PINNED}
                          onClick={() => go(item)}
                          onMouseEnter={() => setActive(index)}
                          className={`relative flex min-h-20 w-full flex-col items-center justify-center gap-1.5 rounded-xl border p-2 text-center text-xs disabled:opacity-40 ${
                            index === active && !editing
                              ? "border-accent bg-accent-soft text-accent"
                              : editing && isPinned
                                ? "border-accent text-accent"
                                : "border-line"
                          }`}
                        >
                          <Icon size={22} aria-hidden />
                          {item.screen.label}
                          {editing && (
                            <span className="absolute top-1.5 right-1.5" aria-hidden>
                              {isPinned ? (
                                <Pin size={13} />
                              ) : (
                                <PinOff size={13} className="text-muted" />
                              )}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {noteItems.length > 0 && (
              <section className="mt-3">
                <h3 className="px-1 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                  Notas
                </h3>
                <ul className="grid gap-1" aria-label="Notas encontradas">
                  {noteItems.map((item) => {
                    if (item.kind !== "note") return null;
                    const index = items.indexOf(item);
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          data-index={index}
                          onClick={() => go(item)}
                          onMouseEnter={() => setActive(index)}
                          className={`flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm ${
                            index === active ? "bg-accent-soft text-accent" : ""
                          }`}
                        >
                          {noteLabel(item.title)}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
