import {
  buildTree,
  flattenTree,
  studyDayEnd,
  studyDayStart,
  type TreeNode,
} from "@estudarella/core";
import { getSetting, listSubjects, type Subject } from "@estudarella/db";
import { useEffect, useMemo, useState } from "react";
import { useDatabase } from "./DatabaseProvider";
import { useLiveQuery } from "./useLiveQuery";

export const ROLLOVER_KEY = "estudo.viradaDoDia";
export const DEFAULT_ROLLOVER_HOUR = 4;

/** Hora em que o dia de estudo vira (preferência de estudo, guardada no banco). */
export function useRolloverHour(): number {
  const { data } = useLiveQuery(["settings"], (db) => getSetting<number>(db, ROLLOVER_KEY));
  return typeof data === "number" ? data : DEFAULT_ROLLOVER_HOUR;
}

/** Início e fim do dia de estudo atual, em milissegundos. Atualiza a cada minuto. */
export function useStudyDay(): { start: number; end: number } {
  const hour = useRolloverHour();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return useMemo(() => {
    const at = new Date(now);
    return { start: studyDayStart(at, hour).getTime(), end: studyDayEnd(at, hour).getTime() };
  }, [now, hour]);
}

export interface Subjects {
  list: Subject[];
  /** Árvore achatada, na ordem de exibição, com a profundidade de cada item. */
  flat: TreeNode<Subject>[];
  byId: Map<string, Subject>;
  loading: boolean;
}

export function useSubjects(): Subjects {
  const { data, loading } = useLiveQuery(["subjects"], listSubjects);
  return useMemo(() => {
    const list = data ?? [];
    return {
      list,
      flat: flattenTree(buildTree(list)),
      byId: new Map(list.map((s) => [s.id, s])),
      loading,
    };
  }, [data, loading]);
}

/** URL temporária para exibir um arquivo guardado (imagem de card). */
export function useAssetUrl(hash: string | undefined): string | undefined {
  const { assets } = useDatabase();
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!hash) {
      setUrl(undefined);
      return;
    }
    let cancelled = false;
    let created: string | undefined;
    assets.get(hash).then((blob) => {
      if (cancelled || !blob) return;
      created = URL.createObjectURL(blob);
      setUrl(created);
    });
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [assets, hash]);
  return url;
}
