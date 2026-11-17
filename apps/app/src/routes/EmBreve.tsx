import { PageTitle } from "../components/Card";

export function EmBreve({
  title,
  phase,
  detail,
}: {
  title: string;
  phase?: string;
  detail?: string;
}) {
  return (
    <>
      <PageTitle>{title}</PageTitle>
      <div className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
        {detail && <p>{detail}</p>}
        {phase && <p className="mt-1">Chega na {phase} do planejamento.</p>}
      </div>
    </>
  );
}
