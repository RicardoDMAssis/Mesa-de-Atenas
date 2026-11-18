import { MoreHorizontal } from "lucide-react";
import { DropdownMenu, Dialog as RadixDialog } from "radix-ui";
import {
  type ButtonHTMLAttributes,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useEffect,
  useId,
  useState,
} from "react";

/*
 * Componentes de interface do app, no modelo do shadcn/ui: primitivos Radix para
 * comportamento e acessibilidade, estilo próprio sobre os tokens do tema.
 */

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-fg hover:opacity-90",
  secondary: "border border-line bg-surface text-fg hover:bg-bg",
  ghost: "text-muted hover:bg-bg hover:text-fg",
  danger: "bg-danger text-surface hover:opacity-90",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "md" | "sm";
}

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium disabled:pointer-events-none disabled:opacity-50 ${
        size === "sm" ? "min-h-9 px-3 text-sm" : "min-h-11 px-4 text-sm"
      } ${variants[variant]} ${focus} ${className}`}
      {...props}
    />
  );
}

export function IconButton({
  label,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-bg hover:text-fg ${focus} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

const field = `w-full rounded-lg border border-line bg-surface px-3 text-sm text-fg placeholder:text-muted ${focus}`;

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${field} min-h-11 ${className}`} {...props} />;
}

export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  return <textarea className={`${field} py-2.5 ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${field} min-h-11 ${className}`} {...props} />;
}

/** Rótulo + campo. O filho recebe o `id` por função para ligar os dois. */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}

/** Janela modal: folha inferior no celular, caixa centralizada no computador. */
export function Dialog({ open, onClose, title, description, children }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/45" />
        <RadixDialog.Content
          aria-describedby={description ? undefined : undefined}
          className="fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-fg shadow-xl outline-none md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-[calc(100%-2rem)] md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl"
        >
          <RadixDialog.Title className="text-lg font-semibold">{title}</RadixDialog.Title>
          {description ? (
            <RadixDialog.Description className="mt-1 text-sm text-muted">
              {description}
            </RadixDialog.Description>
          ) : (
            <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
          )}
          <div className="mt-4">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

export function DialogActions({ children }: { children: ReactNode }) {
  return <div className="mt-5 flex flex-wrap justify-end gap-2">{children}</div>;
}

/** Pede um texto curto (nome de matéria, de baralho...). */
export function PromptDialog({
  open,
  onClose,
  title,
  label,
  initial = "",
  confirmLabel = "Salvar",
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  label: string;
  initial?: string;
  confirmLabel?: string;
  onSubmit: (value: string) => void | Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    if (open) setValue(initial);
  }, [open, initial]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!value.trim()) return;
    await onSubmit(value.trim());
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <form onSubmit={submit}>
        <Field label={label}>
          {(id) => (
            <Input
              id={id}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
              maxLength={120}
            />
          )}
        </Field>
        <DialogActions>
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary" disabled={!value.trim()}>
            {confirmLabel}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  title,
  message,
  confirmLabel,
  onConfirm,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  /** Conteúdo extra acima dos botões (ex.: uma opção a marcar). */
  children?: ReactNode;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title} description={message}>
      {children}
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="danger"
          onClick={async () => {
            await onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export interface MenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
}

/** Menu de ações (botão "⋯"). */
export function Menu({ label, items }: { label: string; items: MenuItem[] }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <IconButton label={label}>
          <MoreHorizontal size={18} aria-hidden />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 min-w-44 rounded-xl border border-line bg-surface p-1 text-sm text-fg shadow-lg"
        >
          {items.map((item) => (
            <DropdownMenu.Item
              key={item.label}
              onSelect={item.onSelect}
              className={`flex min-h-10 cursor-pointer items-center rounded-lg px-3 outline-none data-[highlighted]:bg-bg ${
                item.danger ? "text-danger" : ""
              }`}
            >
              {item.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-line px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{children}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
