import { useSubjects } from "../data/hooks";
import { Select } from "./ui";

/** Escolha de matéria/tópico, com a hierarquia indicada por recuo. */
export function SubjectSelect({
  id,
  value,
  onChange,
  exclude = [],
  emptyLabel = "Sem matéria",
}: {
  id?: string;
  value: string | null;
  onChange: (subjectId: string | null) => void;
  /** Ids que não podem ser escolhidos (ex.: a própria matéria ao movê-la). */
  exclude?: string[];
  emptyLabel?: string;
}) {
  const { flat } = useSubjects();
  return (
    <Select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{emptyLabel}</option>
      {flat
        .filter((node) => !exclude.includes(node.item.id))
        .map((node) => (
          <option key={node.item.id} value={node.item.id}>
            {"  ".repeat(node.depth)}
            {node.depth > 0 ? "› " : ""}
            {node.item.name}
          </option>
        ))}
    </Select>
  );
}
