"use client";

import { useEffect, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { unmarriedPeople, useFamily, type PersonDraft } from "@/lib/family";
import Panel from "./Panel";
import PhotoCropper from "./PhotoCropper";

interface AddPersonPanelProps {
  open: boolean;
  editPersonId: string | null; // set → edit mode: prefilled, no relationship fields
  onClose: () => void;
  onSaved: (personId: string) => void;
}

interface FormState {
  name: string;
  birthYear: string;
  deathYear: string;
  bio: string;
  photoUrl: string; // display only: data URL, blob URL, or signed URL. "" = none
  photoKey: string; // what persists in server mode: a Storage path. "" = none
  gender: "" | "male" | "female"; // "" = not specified
  relKind: "child" | "spouse";
  relTarget: string;
}

const EMPTY: FormState = {
  name: "",
  birthYear: "",
  deathYear: "",
  bio: "",
  photoUrl: "",
  photoKey: "",
  gender: "",
  relKind: "child",
  relTarget: "",
};
const FIELD_IDS: Record<string, string> = {
  name: "add-name",
  birthYear: "add-birth",
  deathYear: "add-death",
  gender: "add-gender",
  relTarget: "add-rel-target",
};
const NOW = new Date().getFullYear();

function validate(f: FormState, isEdit: boolean): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!f.name.trim()) errors.name = "Name is required.";
  const birth = Number(f.birthYear);
  if (!f.birthYear.trim()) errors.birthYear = "Birth year is required.";
  else if (!Number.isInteger(birth) || birth < 1200 || birth > NOW)
    errors.birthYear = `Enter a year between 1200 and ${NOW}.`;
  if (f.deathYear.trim()) {
    const death = Number(f.deathYear);
    if (!Number.isInteger(death) || death > NOW) errors.deathYear = `Enter a year up to ${NOW}.`;
    else if (!errors.birthYear && death < birth) errors.deathYear = "Death year can't be before birth year.";
  }
  if (!f.gender) errors.gender = "Choose Male or Female.";
  if (!isEdit && !f.relTarget)
    errors.relTarget = f.relKind === "child" ? "Choose a couple." : "Choose a member.";
  return errors;
}

const inputCls =
  "h-11 w-full rounded-xl border border-border bg-background px-3 text-sm placeholder:text-muted-foreground aria-[invalid=true]:border-accent";
const labelCls = "mb-1.5 block text-sm font-medium";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-sm text-accent">
      {message}
    </p>
  );
}

export default function AddPersonPanel({ open, editPersonId, onClose, onSaved }: AddPersonPanelProps) {
  const { people, unions, peopleById, addPerson, updatePerson, uploadPhoto } = useFamily();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null); // object URL of the picked file
  // Server-side failures: a duplicate spouse, a rate limit, a lost connection.
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const editing = editPersonId ? peopleById.get(editPersonId) : undefined;

  useEffect(() => {
    if (open) {
      setForm(
        editing
          ? {
              ...EMPTY,
              name: editing.name,
              birthYear: String(editing.birthYear),
              deathYear: editing.deathYear ? String(editing.deathYear) : "",
              bio: editing.bio ?? "",
              photoUrl: editing.photoUrl ?? "",
              photoKey: editing.photoKey ?? "",
              gender: editing.gender ?? "",
            }
          : EMPTY,
      );
      setTouched({});
      setSubmitted(false);
      setFormError(undefined);
      setSaving(false);
      setCropSrc(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only on open/target change
  }, [open, editPersonId]);

  const singles = unmarriedPeople({ people, unions });
  const errors = validate(form, !!editing);
  const show = (f: string) => Boolean(errors[f] && (touched[f] || submitted));

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));
  const blur = (f: string) => () => setTouched((t) => ({ ...t, [f]: true }));

  function cancelCrop() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  async function uploadCropped(file: File) {
    cancelCrop();
    setUploading(true);
    setFormError(undefined);
    try {
      // Local mode returns a data URL; server mode uploads to
      // Storage and returns the object path to persist.
      const ref = await uploadPhoto(file);
      set({ photoUrl: ref.photoUrl, photoKey: ref.photoKey ?? "" });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "That photo could not be uploaded.");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setFormError(undefined);
    const firstInvalid = ["name", "birthYear", "deathYear", "gender", "relTarget"].find(
      (f) => errors[f],
    );
    if (firstInvalid) {
      document.getElementById(FIELD_IDS[firstInvalid])?.focus();
      return;
    }
    const base = {
      name: form.name,
      birthYear: Number(form.birthYear),
      deathYear: form.deathYear.trim() ? Number(form.deathYear) : undefined,
      bio: form.bio,
      photoUrl: form.photoUrl || undefined,
      photoKey: form.photoKey || undefined,
      gender: form.gender || undefined,
    };

    // Saving is a round trip on /f/[slug]. Nothing stopped a double submit
    // before this, and a doubled submit means a duplicate person.
    setSaving(true);
    try {
      if (editing) {
        await updatePerson(editing.id, base);
        onSaved(editing.id);
        return;
      }
      const draft: PersonDraft = {
        ...base,
        relation:
          form.relKind === "child"
            ? { kind: "child", unionId: form.relTarget }
            : { kind: "spouse", personId: form.relTarget },
      };
      const person = await addPerson(draft);
      onSaved(person.id);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "That change could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel
      open={open}
      // Escape while cropping backs out of the crop, not the whole form
      onClose={cropSrc ? cancelCrop : onClose}
      role="dialog"
      label={editing ? "Edit profile" : "Add family member"}
      returnFocusTo={editing ? `[data-person-id="${editing.id}"]` : "[data-add-button]"}
    >
      <div className="flex items-center justify-between p-5 pb-0">
        <h2 className="font-display text-2xl font-semibold">
          {editing ? "Edit profile" : "Add family member"}
        </h2>
        <button
          type="button"
          aria-label="Close add person form"
          onClick={onClose}
          className="rounded-lg p-2 text-muted-foreground transition-colors duration-150 hover:bg-primary/10 hover:text-foreground"
        >
          <X className="size-5" />
        </button>
      </div>

      {cropSrc && <PhotoCropper src={cropSrc} onCancel={cancelCrop} onCropped={uploadCropped} />}

      <form
        onSubmit={onSubmit}
        noValidate
        className={`min-h-0 flex-1 space-y-4 overflow-y-auto p-5 pt-4 ${cropSrc ? "hidden" : ""}`}
      >
        <div>
          <span className={labelCls}>Photo</span>
          <div className="flex items-center gap-4">
            {form.photoUrl ? (
              <img
                src={form.photoUrl}
                alt="Selected portrait preview"
                className="size-20 rounded-xl border border-border object-cover"
              />
            ) : (
              <div
                aria-hidden
                className="flex size-20 items-center justify-center rounded-xl border border-dashed border-border text-muted-foreground"
              >
                <ImagePlus className="size-6" />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="flex h-11 w-fit cursor-pointer items-center rounded-xl border border-border px-4 text-sm font-medium transition-colors duration-150 hover:bg-primary/5">
                {uploading ? "Uploading…" : form.photoUrl ? "Change photo" : "Upload photo"}
                <input
                  id="add-photo"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setFormError(undefined);
                    setCropSrc(URL.createObjectURL(file)); // crop first, upload after
                    e.target.value = ""; // let the same file be re-picked
                  }}
                />
              </label>
              {form.photoUrl && (
                <button
                  type="button"
                  className="block text-sm text-muted-foreground hover:text-foreground"
                  onClick={() => set({ photoUrl: "", photoKey: "" })}
                >
                  Remove photo
                </button>
              )}
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="add-name" className={labelCls}>
            Full name <span aria-hidden className="text-accent">*</span>
          </label>
          <input
            id="add-name"
            className={inputCls}
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            onBlur={blur("name")}
            aria-required
            aria-invalid={show("name")}
            aria-describedby="add-name-error"
            placeholder="e.g. Aisyah Rahma"
          />
          <FieldError id="add-name-error" message={show("name") ? errors.name : undefined} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="add-birth" className={labelCls}>
              Birth year <span aria-hidden className="text-accent">*</span>
            </label>
            <input
              id="add-birth"
              inputMode="numeric"
              className={inputCls}
              value={form.birthYear}
              onChange={(e) => set({ birthYear: e.target.value })}
              onBlur={blur("birthYear")}
              aria-required
              aria-invalid={show("birthYear")}
              aria-describedby="add-birth-error"
              placeholder="1985"
            />
            <FieldError id="add-birth-error" message={show("birthYear") ? errors.birthYear : undefined} />
          </div>
          <div>
            <label htmlFor="add-death" className={labelCls}>
              Death year
            </label>
            <input
              id="add-death"
              inputMode="numeric"
              className={inputCls}
              value={form.deathYear}
              onChange={(e) => set({ deathYear: e.target.value })}
              onBlur={blur("deathYear")}
              aria-invalid={show("deathYear")}
              aria-describedby="add-death-error"
              placeholder="Leave empty if living"
            />
            <FieldError id="add-death-error" message={show("deathYear") ? errors.deathYear : undefined} />
          </div>
        </div>

        <fieldset>
          <legend className={labelCls}>
            Gender <span aria-hidden className="text-accent">*</span>
          </legend>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-describedby="add-gender-error">
            {(
              [
                ["male", "Male"],
                ["female", "Female"],
              ] as const
            ).map(([value, label], i) => (
              <label
                key={value}
                className={`flex h-11 cursor-pointer items-center justify-center rounded-xl border text-sm font-medium transition-colors duration-150 ${
                  form.gender === value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-primary/5"
                }`}
              >
                <input
                  type="radio"
                  name="gender"
                  id={i === 0 ? "add-gender" : undefined}
                  className="sr-only"
                  checked={form.gender === value}
                  onChange={() => set({ gender: value })}
                />
                {label}
              </label>
            ))}
          </div>
          <FieldError id="add-gender-error" message={show("gender") ? errors.gender : undefined} />
        </fieldset>

        {!editing && (
        <fieldset>
          <legend className={labelCls}>Relationship</legend>
          <div className="grid grid-cols-2 gap-2" role="radiogroup">
            {(
              [
                ["child", "Child of a couple", false],
                ["spouse", "Spouse of a member", singles.length === 0],
              ] as const
            ).map(([kind, label, disabled]) => (
              <label
                key={kind}
                className={`flex h-11 cursor-pointer items-center justify-center rounded-xl border text-sm font-medium transition-colors duration-150 ${
                  form.relKind === kind
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-primary/5"
                } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
              >
                <input
                  type="radio"
                  name="relKind"
                  className="sr-only"
                  checked={form.relKind === kind}
                  disabled={disabled}
                  onChange={() => set({ relKind: kind, relTarget: "" })}
                />
                {label}
              </label>
            ))}
          </div>
          {singles.length === 0 && (
            <p className="mt-1.5 text-sm text-muted-foreground">
              Everyone is currently part of a couple. Add a child instead.
            </p>
          )}
        </fieldset>
        )}

        {!editing && (
        <div>
          <label htmlFor="add-rel-target" className={labelCls}>
            {form.relKind === "child" ? "Parents" : "Marries"}{" "}
            <span aria-hidden className="text-accent">*</span>
          </label>
          <select
            id="add-rel-target"
            className={inputCls}
            value={form.relTarget}
            onChange={(e) => set({ relTarget: e.target.value })}
            onBlur={blur("relTarget")}
            aria-required
            aria-invalid={show("relTarget")}
            aria-describedby="add-rel-target-error"
          >
            <option value="">{form.relKind === "child" ? "Choose a couple…" : "Choose a member…"}</option>
            {form.relKind === "child"
              ? unions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {peopleById.get(u.partners[0])?.name} & {peopleById.get(u.partners[1])?.name}
                  </option>
                ))
              : singles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (b. {p.birthYear})
                  </option>
                ))}
          </select>
          <FieldError id="add-rel-target-error" message={show("relTarget") ? errors.relTarget : undefined} />
        </div>
        )}

        <div>
          <label htmlFor="add-bio" className={labelCls}>
            Short bio
          </label>
          <textarea
            id="add-bio"
            rows={3}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground"
            value={form.bio}
            onChange={(e) => set({ bio: e.target.value })}
            placeholder="A sentence about this person…"
          />
        </div>

        <button
          type="submit"
          disabled={saving || uploading}
          aria-busy={saving}
          className="flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-on-primary transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving…" : editing ? "Save changes" : "Add to family tree"}
        </button>
        {formError && (
          <p role="alert" className="mt-1.5 text-sm text-accent">
            {formError}
          </p>
        )}
      </form>
    </Panel>
  );
}
