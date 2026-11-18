import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export interface ViewerOptions {
  /** Cor do osso destacado (CSS). */
  accent: string;
  /** Avisado quando o usuário toca num osso (ou em lugar nenhum: `null`). */
  onPick?: (id: string | null) => void;
  /** Só olhar: sem toque para selecionar (usado no card da revisão). */
  readOnly?: boolean;
}

const BONE = new THREE.Color("#e8e1d0");
/** Distância máxima (px) entre apertar e soltar para contar como toque, não como giro. */
const TAP_SLOP = 8;

/**
 * Visualizador do esqueleto: um `<canvas>` com o modelo, girar com o dedo ou o mouse,
 * zoom com pinça ou roda, toque para escolher um osso, destaque, isolar região e
 * miniatura em PNG.
 */
export class SkeletonViewer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.01, 50);
  private controls: OrbitControls;
  private meshes = new Map<string, THREE.Mesh>();
  private base = new THREE.MeshStandardMaterial({ color: BONE, roughness: 0.8 });
  private highlight: THREE.MeshStandardMaterial;
  private faded = new THREE.MeshStandardMaterial({
    color: BONE,
    roughness: 0.8,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
  });
  private selected: string | null = null;
  private visibleIds: Set<string> | null = null;
  private frame = 0;
  private resizeObserver: ResizeObserver;

  constructor(
    private container: HTMLElement,
    private options: ViewerOptions,
  ) {
    this.highlight = new THREE.MeshStandardMaterial({
      color: new THREE.Color(options.accent),
      emissive: new THREE.Color(options.accent),
      emissiveIntensity: 0.35,
      roughness: 0.6,
    });
    // `preserveDrawingBuffer` permite tirar a miniatura do que está na tela.
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.domElement.className = "viewer-canvas";
    container.append(this.renderer.domElement);

    this.scene.add(new THREE.HemisphereLight("#ffffff", "#8a8170", 1.6));
    const key = new THREE.DirectionalLight("#ffffff", 1.4);
    key.position.set(1.5, 2.5, 2);
    this.scene.add(key);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.minDistance = 0.15;
    this.controls.maxDistance = 6;
    this.controls.addEventListener("change", () => this.requestRender());

    if (!options.readOnly) this.listenForTaps();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  /** Carrega o modelo (um .glb com uma malha por osso, nomeada pelo id). */
  async load(bytes: ArrayBuffer): Promise<void> {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.parseAsync(bytes, "");
    gltf.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.material = this.base;
        this.meshes.set(obj.name, obj);
      }
    });
    this.scene.add(gltf.scene);
    // Limites de zoom proporcionais ao tamanho do modelo.
    const size = new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3()).length();
    if (size > 0) {
      this.controls.minDistance = size * 0.03;
      this.controls.maxDistance = size * 3;
      this.camera.near = size * 0.002;
      this.camera.far = size * 10;
      this.camera.updateProjectionMatrix();
    }
    this.frameAll();
  }

  get boneIds(): string[] {
    return [...this.meshes.keys()];
  }

  /** Destaca um osso (ou nenhum). */
  select(id: string | null): void {
    this.selected = id && this.meshes.has(id) ? id : null;
    this.applyMaterials();
  }

  /** Mostra só estes ossos (os demais ficam transparentes); `null` mostra todos. */
  isolate(ids: string[] | null): void {
    this.visibleIds = ids ? new Set(ids) : null;
    this.applyMaterials();
  }

  /** Aproxima a câmera de um osso, mantendo o ângulo atual. */
  focus(id: string): void {
    const mesh = this.meshes.get(id);
    if (!mesh) return;
    const box = new THREE.Box3().setFromObject(mesh);
    this.frameBox(box, 2.6);
  }

  frameAll(): void {
    const box = new THREE.Box3();
    for (const mesh of this.meshes.values()) box.expandByObject(mesh);
    if (!box.isEmpty()) this.frameBox(box, 1.15);
  }

  /** Posição da câmera, para guardar junto do card e reabrir no mesmo ângulo. */
  get view(): { position: number[]; target: number[] } {
    return {
      position: this.camera.position.toArray().map((n) => Math.round(n * 1000) / 1000),
      target: this.controls.target.toArray().map((n) => Math.round(n * 1000) / 1000),
    };
  }

  set view(v: { position: number[]; target: number[] }) {
    this.camera.position.fromArray(v.position);
    this.controls.target.fromArray(v.target);
    this.controls.update();
    this.requestRender();
  }

  /** Miniatura em PNG do que está na tela (quadrada, até 512 px). */
  async snapshot(size = 512): Promise<ArrayBuffer> {
    this.renderNow();
    const source = this.renderer.domElement;
    const side = Math.min(source.width, source.height);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = Math.min(size, side);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Sem 2D");
    ctx.fillStyle =
      getComputedStyle(document.documentElement).getPropertyValue("--surface") || "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      source,
      (source.width - side) / 2,
      (source.height - side) / 2,
      side,
      side,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (!blob) throw new Error("Falha ao gerar a miniatura");
    return blob.arrayBuffer();
  }

  /** Libera a memória da GPU (o iframe também é descartado pelo app ao fechar). */
  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
  }

  private applyMaterials(): void {
    for (const [id, mesh] of this.meshes) {
      mesh.material =
        id === this.selected
          ? this.highlight
          : this.visibleIds && !this.visibleIds.has(id)
            ? this.faded
            : this.base;
      // Ossos transparentes não devem roubar o toque dos que estão visíveis.
      mesh.userData.pickable = !this.visibleIds || this.visibleIds.has(id);
    }
    this.requestRender();
  }

  private frameBox(box: THREE.Box3, margin: number): void {
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    const dir = this.camera.position.clone().sub(this.controls.target);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0.1, 1);
    dir.normalize();
    const distance = (size * margin) / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    this.controls.target.copy(center);
    this.camera.position.copy(center).addScaledVector(dir, Math.max(distance, 0.2));
    this.controls.update();
    this.requestRender();
  }

  private listenForTaps(): void {
    const el = this.renderer.domElement;
    let down: { x: number; y: number } | null = null;
    el.addEventListener("pointerdown", (e) => {
      down = { x: e.clientX, y: e.clientY };
    });
    el.addEventListener("pointerup", (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > TAP_SLOP) return;
      down = null;
      const id = this.pick(e.clientX, e.clientY, e.pointerType === "touch" ? 14 : 0);
      this.select(id);
      this.options.onPick?.(id);
    });
  }

  /**
   * Osso sob o ponto. No toque, tenta também em volta (`radius` px): ossos pequenos
   * (mãos, pés) ficam mais fáceis de acertar com o dedo.
   */
  private pick(clientX: number, clientY: number, radius: number): string | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const raycaster = new THREE.Raycaster();
    const targets = [...this.meshes.values()].filter((m) => m.userData.pickable !== false);
    const offsets: [number, number][] = radius
      ? [
          [0, 0],
          [radius, 0],
          [-radius, 0],
          [0, radius],
          [0, -radius],
        ]
      : [[0, 0]];
    for (const [dx, dy] of offsets) {
      const ndc = new THREE.Vector2(
        ((clientX + dx - rect.left) / rect.width) * 2 - 1,
        -((clientY + dy - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, this.camera);
      const hit = raycaster.intersectObjects(targets, false)[0];
      if (hit) return hit.object.name;
    }
    return null;
  }

  private resize(): void {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  /** Desenha só quando algo muda (economiza bateria no celular). */
  private requestRender(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      // O amortecimento do giro continua por alguns quadros depois de soltar.
      if (this.controls.update()) this.requestRender();
      this.renderNow();
    });
  }

  private renderNow(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
