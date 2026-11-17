import { studyDay } from "@estudarella/core";
import { Link } from "react-router";
import { Card, PageTitle } from "../components/Card";
import { useDatabase } from "../data/DatabaseProvider";

export function Inicio() {
  const { info } = useDatabase();
  const today = new Date(`${studyDay(new Date())}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <>
      <PageTitle subtitle={today}>Início</PageTitle>
      <div className="grid gap-4">
        <Card title="Fundação pronta">
          <p className="text-sm text-muted">
            O app já abre o banco de dados local e o ambiente isolado de plugins. Notas e flashcards
            são o próximo passo.
          </p>
          <Link
            to="/ajustes/diagnostico"
            className="mt-3 inline-block text-sm font-medium text-accent"
          >
            Ver diagnóstico
          </Link>
        </Card>
        {!info.persistent && (
          <Card title="Seus dados não estão sendo salvos">
            <p className="text-sm text-danger">{info.reason}</p>
          </Card>
        )}
      </div>
    </>
  );
}
