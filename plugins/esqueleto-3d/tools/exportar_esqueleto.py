"""
Exporta o sistema esquelético do Z-Anatomy para o formato do plugin.

Carrega do Startup.blend SÓ a coleção "Skeletal system" (o arquivo inteiro passa de 4 GB de
memória), separa os ossos dos rótulos do atlas e grava:

  esqueleto-bruto.glb  uma malha por osso, nomeada pelo id (ex.: "femur-esquerdo")
  ossos.json           id -> nome em português (com o lado), latim, região e lado

Uso (Blender 4.2 LTS, sem interface e sem rodar os scripts embutidos do .blend):

    blender -b --factory-startup --disable-autoexec --python exportar_esqueleto.py -- \
        Startup.blend TA2.csv pasta-de-saida [--conferir]

Com --conferir, só imprime os nomes (nada é gravado). Depois, simplificar e compactar com
gltf-transform (ver LEIA-ME.md).
"""

import json
import re
import sys
import unicodedata
from pathlib import Path

import bpy  # type: ignore[import-not-found]

# Malhas que não são osso (ou que o recorte inicial deixa de fora).
EXCLUIR = re.compile(
    r"ligament|ligamenta|cartilage|disc |nucleus pulposus|symphysis|sinus of|"
    r"incisor|canine|molar|premolar|tooth",
    re.I,
)

REGIOES = {
    "Crânio": [
        "frontal", "parietal", "occipital", "temporal", "sphenoid", "ethmoid", "nasal bone",
        "lacrimal", "palatine", "maxilla", "zygomatic", "vomer", "concha", "mandible", "hyoid",
        "malleus", "incus", "stapes",
    ],
    "Membro superior": [
        "clavicle", "scapula", "humerus", "radius", "ulna", "scaphoid", "lunate", "triquetrum",
        "pisiform", "trapezium", "trapezoid", "capitate", "hamate", "metacarpal", "of hand",
    ],
    "Membro inferior": [
        "hip bone", "femur", "patella", "tibia", "fibula", "talus", "calcaneus", "navicular",
        "cuboid", "cuneiform", "metatarsal", "of foot",
    ],
}

ORDINAIS = {
    "first": ("primeiro", "primeira"), "second": ("segundo", "segunda"),
    "third": ("terceiro", "terceira"), "fourth": ("quarto", "quarta"),
    "fifth": ("quinto", "quinta"), "sixth": ("sexto", "sexta"), "seventh": ("sétimo", "sétima"),
    "eighth": ("oitavo", "oitava"), "ninth": ("nono", "nona"), "tenth": ("décimo", "décima"),
    "eleventh": ("décimo primeiro", "décima primeira"),
    "twelfth": ("décimo segundo", "décima segunda"),
}
ORDINAIS_LATIM = {
    "first": "I", "second": "II", "third": "III", "fourth": "IV", "fifth": "V", "sixth": "VI",
    "seventh": "VII", "eighth": "VIII", "ninth": "IX", "tenth": "X", "eleventh": "XI",
    "twelfth": "XII",
}
FALANGE = {"proximal": ("proximal", "proximalis"), "middle": ("média", "media"),
           "distal": ("distal", "distalis")}

# Ossos que a TA2 não tem com o nome usado no Z-Anatomy: (latim, português).
MANUAIS = {
    "atlas (c1)": ("Atlas", "Atlas (C1)"),
    "axis (c2)": ("Axis", "Áxis (C2)"),
    "sesamoid bones of foot": ("Ossa sesamoidea pedis", "Ossos sesamoides do pé"),
    # A tradução da TA2 deixou estes em latim.
    "talus": ("Os tali", "Tálus"),
    "incus": ("Incus", "Bigorna"),
}

# Erros de digitação encontrados no latim da TA2 distribuída pelo Z-Anatomy.
CORRECOES_LATIM = {"metarcapi": "metacarpi", "quatum": "quartum", "scundum": "secundum"}


def slug(texto: str) -> str:
    texto = unicodedata.normalize("NFD", texto)
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", texto.lower()).strip("-")


def ler_ta2(caminho: Path) -> dict[str, tuple[str, str]]:
    """Inglês (minúsculas) -> (latim, português), da TA2 distribuída pelo Z-Anatomy."""
    termos: dict[str, tuple[str, str]] = {}
    for linha in caminho.read_text(encoding="utf-8-sig").splitlines():
        campos = linha.strip().strip('"').split(";")
        if len(campos) > 5 and campos[1] and campos[5]:
            termos.setdefault(campos[1].lower(), (campos[2], campos[5]))
    return termos


def traduzir(ingles: str, ta2: dict[str, tuple[str, str]]) -> tuple[str, str] | None:
    """(latim, português) do osso, pela TA2 ou por regras para os nomes numerados."""
    chave = ingles.lower()
    if chave in MANUAIS:
        return MANUAIS[chave]
    for tentativa in (chave, re.sub(r" bone$", "", chave), f"{chave} bone"):
        if tentativa in ta2:
            return ta2[tentativa]
    if m := re.fullmatch(r"vertebra ([ctl])(\d+)", chave):
        nivel = f"{m[1].upper()}{m[2]}"
        return (f"Vertebra {nivel}", f"Vértebra {nivel}")
    if m := re.fullmatch(r"(\w+) rib", chave):
        return (f"Costa {ORDINAIS_LATIM[m[1]]}", f"{ORDINAIS[m[1]][1].capitalize()} costela")
    if m := re.fullmatch(r"(\w+) (metacarpal|metatarsal) bone", chave):
        tipo = "metacarpal" if m[2] == "metacarpal" else "metatarsal"
        latim = "Os metacarpi" if tipo == "metacarpal" else "Os metatarsi"
        return (f"{latim} {ORDINAIS_LATIM[m[1]]}", f"{ORDINAIS[m[1]][0].capitalize()} osso {tipo}")
    if m := re.fullmatch(r"(proximal|middle|distal) phalanx of (\w+) finger of (hand|foot)", chave):
        pt, la = FALANGE[m[1]]
        onde = "da mão" if m[3] == "hand" else "do pé"
        latim = "manus" if m[3] == "hand" else "pedis"
        return (
            f"Phalanx {la} {latim} {ORDINAIS_LATIM[m[2]]}",
            f"Falange {pt} do {ORDINAIS[m[2]][0]} dedo {onde}",
        )
    return None


def regiao_de(ingles: str) -> str:
    nome = ingles.lower()
    for regiao, chaves in REGIOES.items():
        if any(c in nome for c in chaves):
            return regiao
    return "Tronco"


def main() -> None:
    args = sys.argv[sys.argv.index("--") + 1 :]
    blend, ta2_path, saida = Path(args[0]), Path(args[1]), Path(args[2])
    conferir = "--conferir" in args
    ta2 = ler_ta2(ta2_path)

    with bpy.data.libraries.load(str(blend), link=False) as (_src, dst):
        dst.collections = ["Skeletal system"]
    raiz = bpy.data.collections["Skeletal system"]
    bpy.context.scene.collection.children.link(raiz)
    # Sem isto, matrix_world ainda não reflete os pais (rótulos) e a posição sai errada.
    bpy.context.view_layer.update()

    ossos: dict[str, dict] = {}
    manter = []
    sem_traducao = []
    for obj in raiz.all_objects:
        # Rótulos (texto) e linhas indicadoras (.j/.i, 2 vértices) do atlas não são ossos.
        if obj.type != "MESH" or re.search(r"\.(j|i)$", obj.name) or len(obj.data.vertices) < 50:
            continue
        base = re.sub(r"\.\d{3}$", "", obj.name)
        lado = {"l": "esquerdo", "r": "direito"}.get(base[-1]) if re.search(r"\.[lr]$", base) else None
        ingles = re.sub(r"\.[lr]$", "", base)
        if EXCLUIR.search(ingles):
            continue
        nomes = traduzir(ingles, ta2)
        if nomes is None:
            sem_traducao.append(ingles)
            nomes = (ingles, ingles)
        latim, portugues = nomes
        for errado, certo in CORRECOES_LATIM.items():
            latim = latim.replace(errado, certo)
        ident = slug(f"{ingles} {lado or ''}")
        ossos[ident] = {
            "pt": f"{portugues} (lado {lado})" if lado else portugues,
            "la": latim,
            "regiao": regiao_de(ingles),
            "lado": lado,
            "_x": round(sum((obj.matrix_world @ v.co).x for v in obj.data.vertices[:200])
                        / min(200, len(obj.data.vertices)), 3),
        }
        manter.append((obj, ident))

    print(f"OSSOS {len(ossos)}; sem tradução: {sorted(set(sem_traducao))}")
    # Conferência do lado: no Z-Anatomy ".l" deve ser o lado esquerdo do corpo.
    for ident in ("femur-esquerdo", "femur-direito", "clavicle-esquerdo"):
        if ident in ossos:
            print("LADO", ident, "x =", ossos[ident]["_x"])
    if conferir:
        for ident, osso in sorted(ossos.items()):
            print(f"N|{ident}|{osso['pt']}|{osso['la']}|{osso['regiao']}")
        return

    # Solta cada osso do pai (rótulos do atlas) mantendo a posição no mundo, apaga o resto
    # e dá o id como nome.
    for obj, ident in manter:
        mundo = obj.matrix_world.copy()
        obj.parent = None
        obj.matrix_world = mundo
        obj.name = ident
        obj.data = obj.data.copy()
        obj.data.name = ident
    nomes_manter = {ident for _, ident in manter}
    for obj in list(bpy.data.objects):
        if obj.name not in nomes_manter:
            bpy.data.objects.remove(obj, do_unlink=True)
    bpy.context.view_layer.update()

    saida.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(saida / "esqueleto-bruto.glb"),
        export_format="GLB",
        export_materials="NONE",
        export_normals=True,
        export_texcoords=False,
        export_apply=True,
        export_animations=False,
        export_extras=False,
        export_yup=True,
    )
    for osso in ossos.values():
        osso.pop("_x", None)
    dados = {
        "provisorio": False,
        "fonte": "Modelo: Z-Anatomy (CC BY-SA 4.0), baseado em BodyParts3D (DBCLS, CC BY-SA 2.1 JP). "
        "Nomes: Terminologia Anatômica (TA2), tradução em português do Z-Anatomy; nomes numerados "
        "(vértebras, costelas, metacarpais, metatarsais e falanges) montados a partir dela.",
        "regioes": ["Crânio", "Tronco", "Membro superior", "Membro inferior"],
        "ossos": dict(sorted(ossos.items())),
    }
    (saida / "ossos.json").write_text(json.dumps(dados, ensure_ascii=False, indent=2) + "\n")
    print(f"EXPORTADO {len(manter)} malhas em {saida}")


main()
