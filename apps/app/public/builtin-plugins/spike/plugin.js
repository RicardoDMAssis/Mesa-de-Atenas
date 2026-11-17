const status = document.getElementById("status");
const applyTheme = (theme) => {
  for (const [name, value] of Object.entries(theme.tokens)) {
    document.documentElement.style.setProperty(name, value);
  }
};

// ---- Modelo 3D em WebGL puro, girável com o dedo ou o mouse ----
const canvas = document.getElementById("view");
const gl = canvas.getContext("webgl");
let rotX = 0.5,
  rotY = 0.7,
  dragging = false,
  lastX = 0,
  lastY = 0;

function startWebgl(mesh) {
  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  };
  const program = gl.createProgram();
  gl.attachShader(
    program,
    compile(
      gl.VERTEX_SHADER,
      `
    attribute vec3 pos; attribute vec3 col; uniform mat4 mvp; varying vec3 vCol;
    void main() { vCol = col; gl_Position = mvp * vec4(pos, 1.0); }`,
    ),
  );
  gl.attachShader(
    program,
    compile(
      gl.FRAGMENT_SHADER,
      `
    precision mediump float; varying vec3 vCol;
    void main() { gl_FragColor = vec4(vCol, 1.0); }`,
    ),
  );
  gl.linkProgram(program);
  // biome-ignore lint/correctness/useHookAtTopLevel: função do WebGL, não é um hook do React
  gl.useProgram(program);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, mesh, gl.STATIC_DRAW);
  const pos = gl.getAttribLocation(program, "pos");
  const col = gl.getAttribLocation(program, "col");
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 3, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(col);
  gl.vertexAttribPointer(col, 3, gl.FLOAT, false, 24, 12);
  gl.enable(gl.DEPTH_TEST);
  const mvp = gl.getUniformLocation(program, "mvp");

  const draw = () => {
    const w = canvas.clientWidth * devicePixelRatio,
      h = canvas.clientHeight * devicePixelRatio;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (!dragging) rotY += 0.006;
    const cx = Math.cos(rotX),
      sx = Math.sin(rotX),
      cy = Math.cos(rotY),
      sy = Math.sin(rotY);
    const f = 1 / Math.tan(0.4),
      aspect = canvas.width / Math.max(canvas.height, 1);
    const near = 0.1,
      far = 100,
      dist = 6;
    // Projeção * translação(0,0,-dist) * rotX * rotY, em ordem de colunas.
    const r = [cy, sx * sy, -cx * sy, 0, 0, cx, sx, 0, sy, -sx * cy, cx * cy, 0];
    const A = (far + near) / (near - far),
      B = (2 * far * near) / (near - far);
    const m = new Float32Array(16);
    for (let c = 0; c < 3; c++) {
      const x = r[c * 4],
        y = r[c * 4 + 1],
        z = r[c * 4 + 2];
      m[c * 4] = (f / aspect) * x;
      m[c * 4 + 1] = f * y;
      m[c * 4 + 2] = A * z;
      m[c * 4 + 3] = -z;
    }
    m[14] = A * -dist + B;
    m[15] = dist;
    gl.uniformMatrix4fv(mvp, false, m);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.length / 6);
    requestAnimationFrame(draw);
  };
  draw();

  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    rotY += (e.clientX - lastX) * 0.01;
    rotX += (e.clientY - lastY) * 0.01;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  canvas.addEventListener("pointerup", () => {
    dragging = false;
  });
}

// ---- Verificações de isolamento, relatadas ao app ----
async function checks() {
  let storageBlocked = false;
  try {
    localStorage.setItem("teste", "1");
  } catch {
    storageBlocked = true;
  }
  let cookiesBlocked = false;
  try {
    // biome-ignore lint/suspicious/noDocumentCookie: teste proposital de isolamento
    document.cookie = "teste=1";
    cookiesBlocked = document.cookie === "";
  } catch {
    cookiesBlocked = true;
  }
  let parentBlocked = false;
  try {
    void parent.document.title;
  } catch {
    parentBlocked = true;
  }
  let networkBlocked = false;
  try {
    await fetch("https://example.com/", { mode: "no-cors" });
  } catch {
    networkBlocked = true;
  }
  return { webgl: Boolean(gl), storageBlocked, cookiesBlocked, parentBlocked, networkBlocked };
}

(async () => {
  // O modelo é um arquivo binário da pasta do plugin, pedido ao app só agora.
  let fileLoaded = false;
  try {
    const mesh = new Float32Array(await app.call("plugin.readFile", { path: "cube.bin" }));
    fileLoaded = mesh.length === 216;
    if (gl) startWebgl(mesh);
  } catch {}
  let outsideBlocked = false;
  try {
    await app.call("plugin.readFile", { path: "../../index.html" });
  } catch (e) {
    outsideBlocked = e.code === "forbidden";
  }
  applyTheme(await app.call("host.getTheme"));
  app.on("theme.changed", applyTheme);
  await app.call("spike.report", { ...(await checks()), fileLoaded, outsideBlocked });
  status.textContent = "Conectado ao app.";

  let forbidden = "";
  try {
    await app.call("notes.deleteAll");
  } catch (e) {
    forbidden = e.code;
  }
  await app.call("spike.unknownMethodResult", { code: forbidden });
})();

document.getElementById("create").addEventListener("click", async () => {
  try {
    const { id } = await app.call("cards.create", {
      front: "Que sólido é este?",
      back: "Cubo",
      content: { rotX, rotY },
    });
    status.textContent = `Card criado: ${id.slice(0, 8)}`;
  } catch (e) {
    status.textContent = `Recusado: ${e.message}`;
  }
});
