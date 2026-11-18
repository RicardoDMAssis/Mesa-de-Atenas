/** Dados de um osso (de `modelo/ossos.json`). */
export interface Bone {
  /** Nome em português, já com o lado (ex.: "Fêmur esquerdo"). */
  pt: string;
  /** Nome em latim (Terminologia Anatômica). */
  la: string;
  regiao: string;
  lado: "esquerdo" | "direito" | null;
}

export interface BoneData {
  /** `true` enquanto o modelo for o provisório, feito de blocos. */
  provisorio: boolean;
  regioes: string[];
  ossos: Record<string, Bone>;
}

export async function loadBones(read: () => Promise<ArrayBuffer>): Promise<BoneData> {
  const json = JSON.parse(new TextDecoder().decode(await read())) as Partial<BoneData>;
  return {
    provisorio: Boolean(json.provisorio),
    regioes: json.regioes ?? [],
    ossos: json.ossos ?? {},
  };
}

/** Sem acento e em minúsculas, para a busca achar "femur" em "Fêmur". */
export const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** O osso combina com a busca (português ou latim, sem diferenciar acentos). */
export function matches(bone: Bone, query: string): boolean {
  const q = fold(query.trim());
  if (!q) return false;
  return fold(bone.pt).includes(q) || fold(bone.la).includes(q);
}

/** Nome para o verso do card: "Fêmur (lado esquerdo) · Os femoris". */
export function boneLabel(data: BoneData, id: string): string {
  const bone = data.ossos[id];
  return bone ? `${bone.pt} · ${bone.la}` : id;
}
