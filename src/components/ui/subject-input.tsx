import { SUBJECT_SUGGESTIONS } from "@/lib/exam-types";
import { Input } from "./field";

/** Free-text subject with common school subjects offered as suggestions. */
export function SubjectInput(props: Omit<React.InputHTMLAttributes<HTMLInputElement>, "list">) {
  return (
    <>
      <Input {...props} list="subject-suggestions" maxLength={60} autoComplete="off" />
      <datalist id="subject-suggestions">
        {SUBJECT_SUGGESTIONS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </>
  );
}
