import { Alert } from "./alert";

export type FormState = { error?: string; ok?: string; fieldErrors?: Record<string, string> } | undefined;

export function FormMessage({ state }: { state: FormState }) {
  if (!state) return null;
  if (state.error) return <Alert tone="danger">{state.error}</Alert>;
  if (state.ok) return <Alert tone="ok">{state.ok}</Alert>;
  return null;
}
