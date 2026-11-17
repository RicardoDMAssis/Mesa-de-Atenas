// ---- Ponte com o app (o que o futuro plugin-sdk vai encapsular) ----
const app = (() => {
  let port;
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();
  const ready = new Promise((resolve) => {
    addEventListener("message", (event) => {
      if (event.data?.type !== "estudarella:init" || !event.ports[0]) return;
      port = event.ports[0];
      port.onmessage = ({ data }) => {
        if (data.type === "response") {
          const waiter = pending.get(data.id);
          pending.delete(data.id);
          if (data.ok) waiter?.resolve(data.result);
          else waiter?.reject(Object.assign(new Error(data.error.message), data.error));
        } else if (data.type === "event") {
          for (const fn of listeners.get(data.event) ?? []) fn(data.payload);
        }
      };
      resolve();
    });
  });
  return {
    async call(method, params) {
      await ready;
      return new Promise((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        port.postMessage({ type: "request", id, method, params });
      });
    },
    on(event, fn) {
      listeners.set(event, [...(listeners.get(event) ?? []), fn]);
    },
  };
})();
