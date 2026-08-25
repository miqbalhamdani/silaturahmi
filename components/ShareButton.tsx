"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

interface ShareButtonProps {
  familyName: string;
  className: string;
}

/** Shares the family URL via the native sheet, or copies it with feedback. */
export default function ShareButton({ familyName, className }: ShareButtonProps) {
  const [shared, setShared] = useState(false);

  async function shareFamily() {
    const payload = {
      title: "Silaturahmi",
      // The slug grants view AND edit. This is the one moment a person decides
      // who can change their family, so the copy has to say so.
      text: `Anyone with this link can view and edit the ${familyName} family tree.`,
      url: window.location.origin + window.location.pathname,
    };
    if (navigator.share) {
      await navigator.share(payload).catch(() => {}); // user cancelling is fine
      return;
    }
    try {
      await navigator.clipboard.writeText(payload.url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch {
      /* clipboard unavailable — nothing sane to do without a toast system */
    }
  }

  return (
    <>
      <button type="button" aria-label="Share family tree" className={className} onClick={shareFamily}>
        {shared ? <Check className="size-4 text-primary" /> : <Share2 className="size-4" />}
      </button>
      <span aria-live="polite" className="sr-only">
        {shared ? "Link copied to clipboard" : ""}
      </span>
    </>
  );
}
