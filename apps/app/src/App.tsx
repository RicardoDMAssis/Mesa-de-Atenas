import { Route, Routes } from "react-router";
import { AppShell } from "./components/AppShell";
import { Ajustes } from "./routes/Ajustes";
import { Diagnostico } from "./routes/Diagnostico";
import { EmBreve } from "./routes/EmBreve";
import { Inicio } from "./routes/Inicio";

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Inicio />} />
        <Route
          path="notas"
          element={<EmBreve title="Notas" phase="Fase 1" detail="Editor com links entre notas." />}
        />
        <Route
          path="revisao"
          element={
            <EmBreve title="Revisão" phase="Fase 1" detail="Flashcards com repetição espaçada." />
          }
        />
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
