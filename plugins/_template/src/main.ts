import { app, PluginError } from "@estudarella/plugin-sdk";

const root = document.getElementById("app") as HTMLElement;

/** Cria um elemento só com texto (nunca use innerHTML com dados da nota). */
function line(text: string, className?: string) {
  const p = document.createElement("p");
  p.textContent = text;
  if (className) p.className = className;
  return p;
}

async function render() {
  const context = await app.ready(); // conecta, aplica o tema e diz onde o plugin está
  root.replaceChildren(line(`Aberto como: ${context.surface}`, "muted"));

  // Aberto pelo comando "Contar palavras" com um trecho selecionado:
  if (context.command) {
    const words = context.command.selection.split(/\s+/).filter(Boolean).length;
    root.append(line(`O trecho selecionado tem ${words} palavra(s).`));
    return;
  }

  try {
    const note = await app.notes.getCurrent(); // exige "notes:read"
    if (!note) {
      root.append(line("Abra uma nota para contar as palavras."));
      return;
    }
    const words = note.text.split(/\s+/).filter(Boolean).length;
    const total = ((await app.storage.get<number>("contagens")) ?? 0) + 1; // exige "storage"
    await app.storage.set("contagens", total);
    root.append(
      line(`“${note.title || "Sem título"}” tem ${words} palavra(s).`),
      line(`Você já contou ${total} vez(es).`, "muted"),
    );
  } catch (error) {
    if (error instanceof PluginError && error.code === "forbidden") {
      root.append(line("Sem permissão para ler a nota."));
    } else throw error;
  }

  const button = document.createElement("button");
  button.textContent = "Avisar no app";
  button.onclick = () => app.ui.toast("Olá do meu plugin!");
  root.append(button);
}

void render();
