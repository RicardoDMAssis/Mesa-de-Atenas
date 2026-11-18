# Modelo do Esqueleto 3D

O plugin lê dois arquivos de `public/modelo/`:

- `esqueleto.glb`: uma malha por osso, com o **id** do osso como nome (ex.: `femur-esquerdo`)
- `ossos.json`: para cada id, o nome em português (já com o lado), o latim, a região e o lado

## Situação atual: modelo provisório

Hoje o modelo é **provisório**: um bloco por osso (33 ossos), gerado por
`node tools/modelo-provisorio.mjs`. Ele serve para desenvolver e testar o plugin, e a tela mostra
"Modelo provisório". Os nomes já vêm da Terminologia Anatômica (TA2, coluna em português do
Z-Anatomy).

## Preparar o modelo real (Z-Anatomy)

Fonte: [Z-Anatomy](https://github.com/Z-Anatomy/Models-of-human-anatomy) (CC BY-SA 4.0),
derivado do BodyParts3D (DBCLS, CC BY-SA 2.1 Japão). O `Z-Anatomy.zip` traz um
`Startup.blend` (cerca de 300 MB) e o repositório traz a `TA2.csv` com os nomes.

1. Baixar o Blender 4.2 LTS (portátil), `Z-Anatomy.zip` e `TA2.csv`, e extrair o `Startup.blend`.
2. Exportar o esqueleto, **sem rodar os scripts embutidos do .blend** (`--disable-autoexec`):

   ```bash
   blender -b --disable-autoexec Startup.blend --python tools/exportar_esqueleto.py -- \
     --saida /tmp/esqueleto --ta2 TA2.csv
   ```

   Na primeira execução, conferir a lista de coleções que o script imprime e ajustar `COLECOES`,
   os sufixos de lado (`.l`/`.r`) e as palavras-chave de região, se preciso.

3. Simplificar e compactar até a meta de **8 MB**:

   ```bash
   npx @gltf-transform/cli simplify /tmp/esqueleto/esqueleto-bruto.glb /tmp/esqueleto/s.glb --ratio 0.25 --error 0.001
   npx @gltf-transform/cli meshopt /tmp/esqueleto/s.glb public/modelo/esqueleto.glb
   cp /tmp/esqueleto/ossos.json public/modelo/ossos.json
   ```

   O plugin já decodifica Meshopt (WebAssembly liberado na Fase 4).

4. Conferir a aparência, os nomes em `ossos.json` (o script lista os que ficaram sem tradução) e
   **medir no Galaxy A52** antes de seguir: abrir em até 3 s e girar sem travar.

## Licença

O modelo e o `ossos.json` derivado ficam sob **CC BY-SA 4.0**, com a atribuição exibida no
plugin. O código do plugin segue a licença do projeto.
