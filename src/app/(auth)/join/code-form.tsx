import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

/** Plain GET form: /join?code=XXXX shows the class and its sign-in options. */
export function CodeForm() {
  return (
    <form method="get" action="/join" className="space-y-4">
      <Field label="קוד כיתה" htmlFor="code">
        <Input id="code" name="code" dir="ltr" className="h-12 text-center text-lg uppercase tracking-[0.3em]" required autoCapitalize="characters" autoComplete="off" />
      </Field>
      <Button type="submit" size="lg" className="w-full">
        המשך
      </Button>
    </form>
  );
}
