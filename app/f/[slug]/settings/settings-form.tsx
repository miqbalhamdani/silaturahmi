"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, RefreshCw } from "lucide-react";
import { rotateSlugAction, updateFamilyAction } from "@/lib/actions/family";

const inputCls =
  "h-11 w-full rounded-xl border border-border bg-background px-3 text-sm placeholder:text-muted-foreground";
const labelCls = "mb-1.5 block text-sm font-medium";

export default function SettingsForm({
  slug,
  name,
  description,
  hasCover,
}: {
  slug: string;
  name: string;
  description: string;
  hasCover: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fields, setFields] = useState({ name, description });
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window === "undefined" ? "" : `${window.location.origin}/f/${slug}`;

  function save() {
    startTransition(async () => {
      try {
        await updateFamilyAction(slug, fields);
        setMessage({ text: "Saved." });
      } catch (e) {
        setMessage({ text: e instanceof Error ? e.message : "Could not save.", error: true });
      }
    });
  }

  function rotate() {
    const ok = window.confirm(
      "Rotating makes the current link stop working for everyone who has it — " +
        "including relatives you meant to keep. There is no other way to revoke access. Continue?",
    );
    if (!ok) return;

    startTransition(async () => {
      try {
        const next = await rotateSlugAction(slug);
        router.replace(`/f/${next}/settings`);
      } catch (e) {
        setMessage({ text: e instanceof Error ? e.message : "Could not rotate.", error: true });
      }
    });
  }

  return (
    <section className="mt-8 space-y-6">
      <div>
        <label htmlFor="name" className={labelCls}>
          Family name
        </label>
        <input
          id="name"
          className={inputCls}
          value={fields.name}
          onChange={(e) => setFields((f) => ({ ...f, name: e.target.value }))}
        />
      </div>

      <div>
        <label htmlFor="description" className={labelCls}>
          Description
        </label>
        <textarea
          id="description"
          rows={3}
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground"
          value={fields.description}
          onChange={(e) => setFields((f) => ({ ...f, description: e.target.value }))}
        />
      </div>

      <p className="text-sm text-muted-foreground">
        {hasCover ? "A cover image is set." : "No cover image yet."} Cover uploads are not wired up
        yet — the column and Storage bucket exist, the picker does not.
      </p>

      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-on-primary transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save settings"}
      </button>

      {message && (
        <p role="alert" className={`text-sm ${message.error ? "text-accent" : "text-muted-foreground"}`}>
          {message.text}
        </p>
      )}

      <div className="rounded-xl border border-border p-4">
        <h2 className="font-display text-lg">Share link</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Anyone with this link can view <strong>and edit</strong> this family. Rotating it is the
          only way to take that access back.
        </p>

        <div className="mt-3 flex items-center gap-2">
          <input readOnly value={shareUrl} className={`${inputCls} font-mono text-xs`} />
          <button
            type="button"
            aria-label="Copy share link"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(shareUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                /* clipboard unavailable */
              }
            }}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border transition-colors hover:bg-primary/5"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </button>
        </div>

        <button
          type="button"
          onClick={rotate}
          disabled={pending}
          className="mt-3 flex h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium transition-colors hover:bg-primary/5 disabled:opacity-60"
        >
          <RefreshCw aria-hidden className="size-4" />
          Rotate link
        </button>
      </div>
    </section>
  );
}
