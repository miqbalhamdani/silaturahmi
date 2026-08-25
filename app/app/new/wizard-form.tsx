"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createFamilyAction, type WizardState } from "../actions";

const inputCls =
  "h-11 w-full rounded-xl border border-border bg-background px-3 text-sm placeholder:text-muted-foreground";
const labelCls = "mb-1.5 block text-sm font-medium";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-on-primary transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Creating…" : "Create family"}
    </button>
  );
}

export default function WizardForm() {
  const [state, formAction] = useActionState<WizardState, FormData>(createFamilyAction, {});
  const [gender, setGender] = useState<"" | "male" | "female">("");

  // React resets an uncontrolled form after a Server Action runs, so on an
  // error every field would blank out. The action echoes the submitted values
  // back and the reset lands on these defaults instead of on empty strings.
  const v = state.values;

  return (
    <form action={formAction} className="mt-8 space-y-6">
      <section className="space-y-4">
        <h2 className="font-display text-xl">Family settings</h2>
        <div>
          <label htmlFor="familyName" className={labelCls}>
            Family name <span aria-hidden className="text-accent">*</span>
          </label>
          <input
            id="familyName"
            name="familyName"
            defaultValue={v?.familyName}
            className={inputCls}
            placeholder="Santoso"
          />
        </div>
        <div>
          <label htmlFor="description" className={labelCls}>
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={v?.description}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground"
            placeholder="A few words about this family."
          />
        </div>
        <p className="text-sm text-muted-foreground">
          A cover image can be added from the family&rsquo;s settings once it exists.
        </p>
      </section>

      <section className="space-y-4 border-t border-border pt-6">
        <h2 className="font-display text-xl">First person</h2>
        <div>
          <label htmlFor="personName" className={labelCls}>
            Full name <span aria-hidden className="text-accent">*</span>
          </label>
          <input
            id="personName"
            name="personName"
            defaultValue={v?.personName}
            className={inputCls}
            placeholder="Haji Ahmad"
          />
        </div>
        <div>
          <label htmlFor="birthYear" className={labelCls}>
            Birth year <span aria-hidden className="text-accent">*</span>
          </label>
          <input
            id="birthYear"
            name="birthYear"
            inputMode="numeric"
            defaultValue={v?.birthYear}
            className={inputCls}
            placeholder="1938"
          />
        </div>
        <fieldset>
          <legend className={labelCls}>
            Gender <span aria-hidden className="text-accent">*</span>
          </legend>
          <input type="hidden" name="gender" value={gender} />
          <div className="grid grid-cols-2 gap-2" role="radiogroup">
            {(
              [
                ["male", "Male"],
                ["female", "Female"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={gender === value}
                onClick={() => setGender(value)}
                className={`flex h-11 items-center justify-center rounded-xl border text-sm font-medium transition-colors duration-150 ${
                  gender === value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-primary/5"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
      </section>

      {state.error && (
        <p role="alert" className="text-sm text-accent">
          {state.error}
        </p>
      )}

      <Submit />
    </form>
  );
}
