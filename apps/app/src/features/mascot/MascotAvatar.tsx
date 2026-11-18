import type { AvatarDefinition, AvatarMotion } from "open-bot-avatar";
import { type AvatarOptions, type MountedAvatar, mountAvatar } from "open-bot-avatar/dom";
import { useEffect, useRef } from "react";

interface Props {
  definition: AvatarDefinition;
  color: string;
  size: number;
  mood?: AvatarMotion;
  followPointer?: boolean;
  lookAt?: { x: number; y: number } | null;
  /** Desenho parado (listas e miniaturas). */
  still?: boolean;
  /** Nome acessível; vazio marca como decorativo. */
  label?: string;
  className?: string;
}

/** O mascote animado (pisca, respira, olha para o ponteiro e muda de humor). */
export function MascotAvatar({ size, className = "", ...props }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const avatar = useRef<MountedAvatar | null>(null);
  const options: AvatarOptions = {
    definition: props.definition,
    color: props.color,
    mood: props.mood ?? "idle",
    followPointer: props.followPointer ?? false,
    lookAt: props.lookAt ?? null,
    still: props.still ?? false,
    label: props.label ?? "",
  };

  // `still` e a definição mudam o tipo de desenho: remonta nesses casos.
  // biome-ignore lint/correctness/useExhaustiveDependencies: as demais opções vão por `update`
  useEffect(() => {
    if (!host.current) return;
    avatar.current = mountAvatar(host.current, options);
    return () => {
      avatar.current?.destroy();
      avatar.current = null;
    };
  }, [props.definition, props.still]);

  useEffect(() => {
    avatar.current?.update(options);
  });

  return (
    <div
      ref={host}
      data-testid="mascot-avatar"
      data-mood={options.mood}
      className={`shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
