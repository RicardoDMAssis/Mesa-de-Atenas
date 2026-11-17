import { Route, Routes } from "react-router";
import { AppShell } from "./components/AppShell";
import { Ajustes } from "./routes/Ajustes";
import { Baralho } from "./routes/Baralho";
import { Baralhos } from "./routes/Baralhos";
import { Busca } from "./routes/Busca";
import { Diagnostico } from "./routes/Diagnostico";
import { EmBreve } from "./routes/EmBreve";
import { Estudar } from "./routes/Estudar";
import { Foco } from "./routes/Foco";
import { Grafo } from "./routes/Grafo";
import { Inicio } from "./routes/Inicio";
import { Nota } from "./routes/Nota";
import { Notas } from "./routes/Notas";
import { PluginPage } from "./routes/PluginPage";
import { Plugins } from "./routes/Plugins";
import { Progresso } from "./routes/Progresso";

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Inicio />} />
        <Route path="notas" element={<Notas />} />
        <Route path="notas/:id" element={<Nota />} />
        <Route path="revisao" element={<Baralhos />} />
        <Route path="baralhos/:id" element={<Baralho />} />
        <Route path="estudar" element={<Estudar />} />
        <Route path="busca" element={<Busca />} />
        <Route path="grafo" element={<Grafo />} />
        <Route path="foco" element={<Foco />} />
        <Route path="progresso" element={<Progresso />} />
        <Route path="plugins" element={<Plugins />} />
        <Route path="plugins/:pluginId" element={<PluginPage />} />
        <Route path="ajustes" element={<Ajustes />} />
        <Route path="ajustes/diagnostico" element={<Diagnostico />} />
        <Route path="*" element={<EmBreve title="Página não encontrada" />} />
      </Route>
    </Routes>
  );
}
