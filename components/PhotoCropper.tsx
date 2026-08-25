"use client";

import { useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";

const OUT_SIZE = 512;

interface PhotoCropperProps {
  src: string;
  onCancel: () => void;
  onCropped: (file: File) => void;
}

async function getCroppedFile(src: string, area: Area): Promise<File> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Could not load that image."));
    el.src = src;
  });
  const canvas = document.createElement("canvas");
  canvas.width = OUT_SIZE;
  canvas.height = OUT_SIZE;
  canvas
    .getContext("2d")!
    .drawImage(img, area.x, area.y, area.width, area.height, 0, 0, OUT_SIZE, OUT_SIZE);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not crop that image."))), "image/jpeg", 0.9),
  );
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}

export default function PhotoCropper({ src, onCancel, onCropped }: PhotoCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  async function apply() {
    if (!areaPixels) return;
    setBusy(true);
    try {
      onCropped(await getCroppedFile(src, areaPixels));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not crop that image.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 pt-4">
      <h3 className="text-sm font-medium">Crop photo</h3>
      <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border bg-background">
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          aspect={1}
          maxZoom={4}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(_, pixels) => setAreaPixels(pixels)}
        />
      </div>
      <p className="text-xs text-muted-foreground">Drag to reposition · pinch or scroll to zoom</p>
      <div>
        <label htmlFor="crop-zoom" className="mb-1.5 block text-sm font-medium">
          Zoom
        </label>
        <input
          id="crop-zoom"
          type="range"
          min={1}
          max={4}
          step={0.05}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="h-11 w-full accent-(--primary)"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex h-11 flex-1 items-center justify-center rounded-xl border border-border text-sm font-medium transition-colors duration-150 hover:bg-primary/5"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={apply}
          disabled={busy || !areaPixels}
          aria-busy={busy}
          className="flex h-11 flex-1 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-on-primary transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Cropping…" : "Use photo"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-accent">
          {error}
        </p>
      )}
    </div>
  );
}
