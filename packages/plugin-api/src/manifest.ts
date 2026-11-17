import { z } from "zod";

/** Versão do contrato app ↔ plugin. Muda apenas em quebras de compatibilidade. */
export const API_VERSION = "1";

export const PERMISSIONS = [
  "notes:read",
  "notes:write",
  "cards:read",
  "cards:write",
  "assets:write",
  "storage",
  "ai",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const contributesSchema = z.object({
  panel: z.object({ title: z.string().min(1).max(40) }).optional(),
  page: z.object({ title: z.string().min(1).max(40) }).optional(),
  commands: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z0-9][a-z0-9-.]{0,63}$/),
        title: z.string().min(1).max(60),
        /** Onde o comando aparece: no menu de seleção de texto ou na paleta. */
        context: z.enum(["selection", "palette"]),
      }),
    )
    .default([]),
  /** Quadros que o usuário pode pôr no Início. */
  widgets: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z0-9][a-z0-9-.]{0,63}$/),
        title: z.string().min(1).max(40),
        /** Altura fixa: small 120 px, medium 200 px, large 320 px. */
        size: z.enum(["small", "medium", "large"]).default("medium"),
      }),
    )
    .max(5)
    .default([]),
  cardRenderer: z.boolean().default(false),
  noteEmbed: z.boolean().default(false),
  settings: z.boolean().default(false),
});

export const manifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/, "use letras minúsculas, números e hífen"),
  name: z.string().min(1).max(60),
  description: z.string().max(300).default(""),
  author: z.string().max(80).optional(),
  /** Ícone (nome de um conjunto fixo do app; desconhecido = peça de quebra-cabeça). */
  icon: z.string().max(40).optional(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "use o formato 1.2.3"),
  apiVersion: z.literal(API_VERSION),
  entry: z
    .string()
    .regex(/^[\w-][\w\-./]*\.html$/)
    .refine((p) => !p.includes(".."), "caminho inválido")
    .default("index.html"),
  contributes: contributesSchema.prefault({}),
  /** Condições que fazem o app carregar o plugin (ex.: "onSubjectTag:anatomia"). */
  activation: z.array(z.string().max(100)).default([]),
  permissions: z.array(z.enum(PERMISSIONS)).default([]),
  /** Origens HTTPS que o plugin pode acessar. Vazio = sem rede. */
  network: z
    .array(z.string().regex(/^https:\/\/[a-z0-9.-]+(:\d+)?$/, "use uma origem https, sem caminho"))
    .default([]),
});

export type Manifest = z.infer<typeof manifestSchema>;
