import { Route, Routes } from "react-router";
import { AppShell } from "./components/AppShell";
import { Ajustes } from "./routes/Ajustes";
import { Baralho } from "./routes/Baralho";
import { Baralhos } from "./routes/Baralhos";
import { Busca } from "./routes/Busca";
import { Diagnostico } from "./routes/Diagnostico";
import { EmBreve } from "./routes/EmBreve";
import { Estudar } from "./routes/Estudar";
import { Inicio } from "./routes/Inicio";
import { Nota } from "./routes/Nota";
import { Notas } from "./routes/Notas";

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
        <Route
          path="grafo"
          element={<EmBreve title="Grafo" phase="Fase 2" detail="Mapa das conexões entre notas." />}
        />
        <Route
          path="foco"
          element={<EmBreve title="Foco" phase="Fase 2" detail="Timer Pomodoro e progresso." />}
        />
        <Route
          path="plugins"
          element={
            <EmBreve title="Plugins" phase="Fase 3" detail="Instalar e gerenciar plugins." />
          }
        />
        <Route path="ajustes" element={<Ajustes />} />
        <Route path="ajustes/diagnostico" element={<Diagnostico />} />
        <Route path="*" element={<EmBreve title="Página não encontrada" />} />
      </Route>
    </Routes>
  );
}
