import type { AvatarMotion } from "open-bot-avatar";

/** O que o mascote sabe sobre o estudo agora. */
export interface StudyContext {
  /** Cards vencidos ou a vencer até o fim do dia de estudo. */
  due: number;
  /** Cards novos disponíveis. */
  fresh: number;
  /** Respostas dadas hoje. */
  reviewedToday: number;
  streak: number;
  studiedToday: boolean;
  focusMinutesToday: number;
  focusRunning: boolean;
  deckCount: number;
  /** Hora local (0–23). */
  hour: number;
  /** Dia da semana (0 = domingo). */
  weekday: number;
  /** Meta diária de respostas; `null` sem meta. */
  goal: number | null;
  /** Card mais errado, se algum passou de 3 esquecimentos. */
  leech: { front: string; lapses: number; deckId: string } | null;
  /** Uma nota sem nenhuma ligação com outras. */
  orphan: { id: string; title: string } | null;
  /** Dias desde o último backup; `null` se nunca foi feito. */
  backupDays: number | null;
  /** Quantas notas e cards existem (backup só importa quando há o que perder). */
  items: number;
  /** Últimos 7 dias, incluindo hoje. */
  week: { reviews: number; focusMinutes: number; daysStudied: number };
}

export type MascotAction =
  | "study"
  | "quiz"
  | "focus"
  | "tip"
  | "new-deck"
  | "new-note"
  | "open-deck"
  | "open-note"
  | "backup"
  | "week";

export type MessageKind =
  | "focus"
  | "streak-risk"
  | "due"
  | "fresh"
  | "done"
  | "goal-done"
  | "start"
  | "welcome"
  | "tip"
  | "celebrate"
  | "leech"
  | "orphan"
  | "backup"
  | "week"
  | "focus-done"
  | "break-done"
  | "plugin";

export interface MascotMessage {
  kind: MessageKind;
  text: string;
  mood: AvatarMotion;
  actions: MascotAction[];
  /** Alvo das ações "open-deck" e "open-note". */
  target?: string;
  /** Nome do plugin que pediu a fala. */
  from?: string;
}

export interface Persona {
  name: string;
  catchphrase: string;
}

export interface MessageOptions {
  reminders: boolean;
  tips: boolean;
  celebrate: boolean;
  /** Escolhe entre variações (0 ≤ r < 1). Fixo nos testes. */
  random?: () => number;
}

export const STUDY_TIPS = [
  "Tente lembrar a resposta antes de virar o card. O esforço de buscar na memória é o que fixa.",
  "Revisões curtas todo dia rendem mais do que uma maratona por semana.",
  "Errou? Ótimo: o card volta logo, e é nessa volta que você aprende.",
  "Explique o assunto com suas palavras, como se fosse ensinar alguém. Onde travar, é o que falta estudar.",
  "Um card, uma ideia. Cards curtos são mais fáceis de lembrar.",
  "Misture matérias numa mesma sessão: alternar ajuda a diferenciar os conceitos.",
  "Use o timer de foco: 25 minutos sem celular valem mais que uma hora distraído.",
  "Na pausa, levante, beba água e olhe para longe da tela.",
  "Ligue suas notas umas às outras com @. Conexões ajudam a lembrar.",
  "Antes de dormir é um bom momento para revisar: o sono ajuda a consolidar a memória.",
  "Transforme o que você leu hoje em 3 perguntas. Amanhã, responda sem olhar.",
  "Desenhe ou esquematize: imagens e diagramas ficam mais tempo na memória.",
  "Comece pelo que é mais difícil, quando a cabeça ainda está descansada.",
  "Seja honesto ao responder “Difícil” ou “Fácil”: é isso que ajusta quando o card volta.",
  "Estude com perguntas, não com marca-texto. Reler dá a ilusão de que você sabe.",
  "Defina uma meta pequena para hoje, como 20 cards. Começar é a parte mais difícil.",
  "Deixe o celular em outro cômodo enquanto estuda.",
  "Dormir bem faz parte do estudo. Memória cansada não grava.",
  "Revise a nota da aula no mesmo dia: o esquecimento é mais rápido nas primeiras horas.",
  "Crie exemplos próprios para cada conceito. Exemplos seus são mais fáceis de lembrar.",
] as const;

export const BREAK_TIPS = [
  "Beba um copo d’água.",
  "Levante e alongue os braços e as costas.",
  "Olhe para algo longe por 20 segundos para descansar os olhos.",
  "Dê uma volta curta e respire fundo.",
  "Fique longe das redes sociais: elas cansam mais do que descansam.",
] as const;

/** A partir de quantos dias sem backup o mascote lembra. */
export const BACKUP_AFTER_DAYS = 14;

const pick = <T>(items: readonly T[], random: () => number): T =>
  items[Math.floor(random() * items.length) % items.length] as T;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const short = (text: string, max = 50) =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;

function greeting(hour: number): string {
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function randomTip(random: () => number = Math.random): MascotMessage {
  return {
    kind: "tip",
    text: `Dica: ${pick(STUDY_TIPS, random)}`,
    mood: "thinking",
    actions: ["tip"],
  };
}

/** Resumo dos últimos 7 dias. */
export function weekMessage(ctx: StudyContext): MascotMessage {
  const { reviews, focusMinutes, daysStudied } = ctx.week;
  if (reviews === 0 && focusMinutes === 0) {
    return {
      kind: "week",
      text: "Nos últimos 7 dias ainda não houve estudo. Que tal começar hoje com poucos cards?",
      mood: "thinking",
      actions: [],
    };
  }
  const praise =
    daysStudied >= 6
      ? "Constância de campeão!"
      : daysStudied >= 4
        ? "Muito bom ritmo."
        : "Dá para estudar em mais dias: um pouco por dia rende mais.";
  return {
    kind: "week",
    text: `Sua semana: ${plural(reviews, "resposta", "respostas")}, ${focusMinutes} min de foco e ${plural(
      daysStudied,
      "dia",
      "dias",
    )} de estudo. ${praise}`,
    mood: daysStudied >= 4 ? "happy" : "idle",
    actions: [],
  };
}

/** Quanto falta para a meta, para completar uma frase. */
function goalHint(ctx: StudyContext): string {
  if (!ctx.goal || ctx.reviewedToday >= ctx.goal) return "";
  const missing = ctx.goal - ctx.reviewedToday;
  const available = ctx.due + ctx.fresh;
  // Com menos cards do que falta, a meta não fecha hoje: dizer isso em vez de cobrar.
  if (available === 0) {
    return ` Não há mais cards hoje para a meta de ${ctx.goal}. Crie cards novos para chegar lá.`;
  }
  if (available < missing) {
    return ` Hoje só ${available === 1 ? "há 1 card disponível" : `há ${available} cards disponíveis`}, então a meta de ${ctx.goal} não fecha. Crie mais cards para chegar lá.`;
  }
  return ` Faltam ${missing} para a sua meta de ${ctx.goal}.`;
}

/** Sugestões de manutenção (backup, cards difíceis, notas soltas), quando não há nada urgente. */
function suggestions(ctx: StudyContext, options: MessageOptions): MascotMessage[] {
  const out: MascotMessage[] = [];
  if (options.reminders && ctx.items >= 5) {
    const days = ctx.backupDays;
    if (days === null || days >= BACKUP_AFTER_DAYS) {
      out.push({
        kind: "backup",
        text:
          days === null
            ? "Você ainda não fez nenhum backup. Guarde uma cópia das suas notas e cards fora do aparelho!"
            : `Faz ${days} dias desde o último backup. Vamos guardar uma cópia nova?`,
        mood: "thinking",
        actions: ["backup"],
      });
    }
  }
  if (options.tips && ctx.leech) {
    out.push({
      kind: "leech",
      text: `O card “${short(ctx.leech.front)}” já foi esquecido ${ctx.leech.lapses} vezes. Que tal reescrevê-lo, dividi-lo em dois ou ligá-lo a uma nota?`,
      mood: "thinking",
      actions: ["open-deck"],
      target: ctx.leech.deckId,
    });
  }
  if (options.tips && ctx.orphan) {
    out.push({
      kind: "orphan",
      text: `A nota “${short(ctx.orphan.title)}” não está ligada a nenhuma outra. Use @ para conectá-la: ligações ajudam a lembrar.`,
      mood: "idle",
      actions: ["open-note"],
      target: ctx.orphan.id,
    });
  }
  return out;
}

/**
 * A mensagem mais útil para o momento, por prioridade: não atrapalhar o foco,
 * avisar que a sequência está em risco, lembrar dos cards, comemorar, sugerir
 * manutenção (backup, cards difíceis, notas soltas) ou dar uma dica.
 */
export function pickMessage(
  ctx: StudyContext,
  persona: Persona,
  options: MessageOptions,
): MascotMessage {
  const random = options.random ?? Math.random;
  const hello = `${greeting(ctx.hour)}! ${persona.catchphrase}`;
  const toStudy = ctx.due + ctx.fresh;

  if (ctx.focusRunning) {
    return {
      kind: "focus",
      text: pick(
        [
          "Modo foco ligado. Vou ficar em silêncio, torcendo por você.",
          "Foco! Eu cuido do relógio, você cuida do estudo.",
        ],
        random,
      ),
      mood: "thinking",
      actions: [],
    };
  }

  if (options.reminders && ctx.streak > 0 && !ctx.studiedToday && ctx.hour >= 18) {
    return {
      kind: "streak-risk",
      text: `Sua sequência de ${plural(ctx.streak, "dia", "dias")} ainda não conta hoje. ${
        toStudy > 0 ? "Que tal alguns cards para mantê-la?" : "Um bloco de foco já resolve!"
      }`,
      mood: "thinking",
      actions: toStudy > 0 ? ["quiz", "study"] : ["focus"],
    };
  }

  if (options.reminders && ctx.due > 0) {
    return {
      kind: "due",
      text:
        pick(
          [
            `${hello} Você tem ${plural(ctx.due, "card esperando", "cards esperando")} revisão. Vamos?`,
            `${plural(ctx.due, "card venceu", "cards venceram")} hoje. Revisar agora leva poucos minutos!`,
            `Hora de revisar: ${plural(ctx.due, "card", "cards")} para hoje. Eu acompanho você.`,
          ],
          random,
        ) + goalHint(ctx),
      mood: "idle",
      actions: ["study", "quiz"],
    };
  }

  // Segunda-feira: resumo da semana que passou.
  if (options.celebrate && ctx.weekday === 1 && ctx.week.reviews + ctx.week.focusMinutes > 0) {
    return weekMessage(ctx);
  }

  if (options.celebrate && ctx.goal && ctx.reviewedToday >= ctx.goal) {
    return {
      kind: "goal-done",
      text: `Meta do dia batida: ${ctx.reviewedToday} de ${ctx.goal}! ${persona.catchphrase}`,
      mood: "happy",
      actions: ctx.fresh > 0 ? ["quiz", "tip"] : ["tip"],
    };
  }

  if (options.celebrate && ctx.reviewedToday > 0 && ctx.due === 0) {
    return {
      kind: "done",
      text:
        pick(
          [
            `Tudo revisado por hoje: ${plural(ctx.reviewedToday, "resposta", "respostas")}! ${persona.catchphrase}`,
            `Revisões em dia! ${ctx.streak > 1 ? `São ${ctx.streak} dias seguidos. ` : ""}Que orgulho!`,
          ],
          random,
        ) + goalHint(ctx),
      mood: "happy",
      actions: ctx.fresh > 0 ? ["study", "tip"] : ["tip"],
    };
  }

  if (options.reminders && ctx.fresh > 0) {
    return {
      kind: "fresh",
      text: `${hello} Nenhuma revisão pendente, mas há ${plural(ctx.fresh, "card novo", "cards novos")} para aprender.${goalHint(ctx)}`,
      mood: "idle",
      actions: ["study", "quiz"],
    };
  }

  if (ctx.deckCount === 0) {
    return {
      kind: "welcome",
      text: `${hello} Eu sou ${persona.name}. Crie um baralho e eu lembro você de revisar na hora certa.`,
      mood: "happy",
      actions: ["new-deck", "new-note"],
    };
  }

  // Sem nada urgente: uma sugestão de manutenção ou uma dica.
  const pool = [...suggestions(ctx, options), ...(options.tips ? [randomTip(random)] : [])];
  if (pool.length > 0) return pick(pool, random);

  return {
    kind: "start",
    text: `${hello} Tudo em dia por aqui.`,
    mood: "happy",
    actions: ["focus"],
  };
}

/** Comemoração ao fim de uma sessão de revisão. */
export function sessionMessage(
  done: { again: number; total: number },
  persona: Persona,
  random: () => number = Math.random,
): MascotMessage {
  const rate = done.total ? 1 - done.again / done.total : 0;
  const text =
    rate >= 0.9
      ? pick(
          [
            `Mandou muito bem! ${Math.round(rate * 100)}% de acertos. ${persona.catchphrase}`,
            "Que sessão! Quase tudo certo.",
          ],
          random,
        )
      : rate >= 0.6
        ? pick(
            [
              "Boa sessão! Os que você errou voltam logo para reforçar.",
              `Sessão concluída! ${plural(done.total, "resposta", "respostas")} hoje.`,
            ],
            random,
          )
        : "Essa foi puxada, mas errar faz parte: é revisando o que erramos que a gente aprende.";
  return { kind: "celebrate", text, mood: "happy", actions: [] };
}

/** Reação ao fim de uma fase do timer de foco. */
export function focusPhaseMessage(
  ended: "focus" | "short" | "long",
  persona: Persona,
  random: () => number = Math.random,
): MascotMessage {
  if (ended === "focus") {
    return {
      kind: "focus-done",
      text: `Bloco de foco concluído! ${persona.catchphrase} Na pausa: ${pick(BREAK_TIPS, random).toLowerCase()}`,
      mood: "happy",
      actions: [],
    };
  }
  return {
    kind: "break-done",
    text:
      ended === "long"
        ? "Pausa longa encerrada. Descansou? Vamos para mais um ciclo!"
        : "Pausa encerrada. Vamos para mais um bloco de foco?",
    mood: "idle",
    actions: ["focus"],
  };
}
