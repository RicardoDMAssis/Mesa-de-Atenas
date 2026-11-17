// Avalia JavaScript na página do app rodando no Android (WebView de depuração).
// Antes: adb forward tcp:9333 localabstract:<webview_devtools_remote_PID>
// Uso: node scripts/android-cdp.mjs '<expressão JS>' [captura.png]
const [expr, shot] = process.argv.slice(2);
const targets = await (await fetch("http://localhost:9333/json")).json();
const page = targets.find((t) => t.type === "page" && t.url.startsWith("https://localhost"));
const ws = new WebSocket(page.webSocketDebuggerUrl);
let n = 0;
const waiting = new Map();
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = ++n;
    waiting.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && waiting.has(m.id)) {
    waiting.get(m.id)(m);
    waiting.delete(m.id);
  }
};
await new Promise((r) => (ws.onopen = r));
const r = await send("Runtime.evaluate", {
  expression: expr,
  awaitPromise: true,
  returnByValue: true,
});
console.log(JSON.stringify(r.result?.result?.value ?? r.result?.exceptionDetails ?? r, null, 1));
if (shot) {
  const img = await send("Page.captureScreenshot", { format: "png" });
  (await import("node:fs")).writeFileSync(shot, Buffer.from(img.result.data, "base64"));
}
ws.close();
