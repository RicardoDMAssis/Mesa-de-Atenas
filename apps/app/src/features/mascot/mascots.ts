import { type AvatarDefinition, validateAvatar } from "open-bot-avatar";
import { useMemo } from "react";
import { usePlugins } from "../../plugin-host/registry";
import cerebro from "./avatars/cerebro.json";
import diabinho from "./avatars/diabinho.json";
import estrela from "./avatars/estrela.json";
import foguete from "./avatars/foguete.json";
import gatinho from "./avatars/gatinho.json";
import gatoDeLaco from "./avatars/gato-de-laco.json";
import livro from "./avatars/livro.json";
import sapinho from "./avatars/sapinho.json";

/*
 * Mascotes no formato do open-bot-avatar (https://github.com/DominikScholz/open-bot-avatar):
 * só o contorno e a posição dos olhos; cor, volume, piscar e humor são do renderizador.
 * Para adicionar um, coloque o JSON em `avatars/` e inclua na lista abaixo.
 */

export interface Mascot {
  id: string;
  name: string;
  /** Cor usada quando o usuário não escolhe outra. */
  color: string;
  /** Um jeitinho de falar, usado em algumas frases. */
  catchphrase: string;
  definition: AvatarDefinition;
  /** Recompensa: liberado quando a melhor sequência chega a este número de dias. */
  unlockAt?: number;
  /** Nome do plugin que trouxe o mascote. */
  plugin?: string;
}

function mascot(
  json: unknown,
  color: string,
  catchphrase: string,
  extra: Partial<Mascot> = {},
): Mascot {
  const result = validateAvatar(json);
  if (!result.ok) throw new Error(`Mascote inválido: ${result.errors.join("; ")}`);
  return {
    id: result.value.id,
    name: result.value.name,
    color,
    catchphrase,
    definition: result.value,
    ...extra,
  };
}

export const MASCOTS: Mascot[] = [
  mascot(gatoDeLaco, "#ff7eb6", "Miau!"),
  mascot(gatinho, "#ff7eb6", "Miau!"),
  mascot(sapinho, "#3cc26b", "Croac!"),
  mascot(diabinho, "#6b4fa8", "Hehe!"),
  // Recompensas por constância (galeria do open-bot-avatar, MIT).
  mascot(livro, "#a8693f", "Vamos ler!"),
  mascot(cerebro, "#ec4899", "Neurônios a mil!", { unlockAt: 7 }),
  mascot(estrela, "#f8a01c", "Brilhou!", { unlockAt: 14 }),
  mascot(foguete, "#1f7cf2", "Decolando!", { unlockAt: 30 }),
];

/** Mascotes enviados pelos plugins ativos (validados aqui; inválidos são ignorados). */
export function pluginMascots(plugins: ReturnType<typeof usePlugins.getState>["plugins"]) {
  return plugins
    .filter((p) => p.record.enabled)
    .flatMap((p) =>
      p.manifest.contributes.mascots.flatMap((m): Mascot[] => {
        const result = validateAvatar({
          version: 1,
          id: m.id,
          name: m.name,
          body: m.body,
          eyes: m.eyes,
        });
        if (!result.ok) return [];
        return [
          {
            id: `plugin:${p.manifest.id}:${m.id}`,
            name: result.value.name,
            color: m.color,
            catchphrase: m.catchphrase ?? "Oi!",
            definition: result.value,
            plugin: p.manifest.name,
          },
        ];
      }),
    );
}

/** Todos os mascotes disponíveis: os do app e os dos plugins ativos. */
export function useAllMascots(): Mascot[] {
  const plugins = usePlugins((s) => s.plugins);
  return useMemo(() => [...MASCOTS, ...pluginMascots(plugins)], [plugins]);
}
