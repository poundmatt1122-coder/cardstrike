"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GradeResult {
  grade_estimate: string;
  grade_range: [string, string];
  centering: string;
  corners: string;
  surfaces: string;
  edges: string;
  confidence: number;
  value_low: number;
  value_high: number;
  currency: string;
  notes: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function confidenceColor(c: number) {
  if (c >= 0.8) return "text-green-400";
  if (c >= 0.6) return "text-suns-gold";
  return "text-suns-orange";
}

function gradeColor(grade: string) {
  if (grade.includes("10")) return "bg-green-500/20 text-green-400 border-green-500/40";
  if (grade.includes("9")) return "bg-suns-gold/20 text-suns-gold border-suns-gold/40";
  if (grade.includes("8")) return "bg-suns-orange/20 text-suns-orange border-suns-orange/40";
  return "bg-white/10 text-white/60 border-white/20";
}

// ---------------------------------------------------------------------------
// Drop zone
// ---------------------------------------------------------------------------

function ImageDropZone({
  label,
  file,
  onFile,
}: {
  label: string;
  file: File | null;
  onFile: (f: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const previewUrl = file ? URL.createObjectURL(file) : null;

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const dropped = e.dataTransfer.files[0];
        if (dropped) onFile(dropped);
      }}
      className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
        dragging
          ? "border-suns-orange bg-suns-orange/10"
          : file
          ? "border-suns-gold/50 bg-suns-gold/5"
          : "border-white/20 bg-suns-purple/30 hover:border-suns-orange/50 hover:bg-suns-orange/5"
      } min-h-48 p-4`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={label}
          className="max-h-44 max-w-full rounded-lg object-contain"
        />
      ) : (
        <>
          <span className="text-3xl">🃏</span>
          <p className="mt-2 text-sm font-medium text-white/70">{label}</p>
          <p className="mt-1 text-xs text-white/30">
            Drag & drop or click to upload
          </p>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result card
// ---------------------------------------------------------------------------

function ResultCard({ result }: { result: GradeResult }) {
  const router = useRouter();

  async function addToPortfolio() {
    // TODO: wire to POST /api/portfolio once that route is built.
    alert("Add to portfolio coming soon!");
  }

  const detailRows = [
    { label: "Centering", value: result.centering },
    { label: "Corners", value: result.corners },
    { label: "Surfaces", value: result.surfaces },
    { label: "Edges", value: result.edges },
  ];

  return (
    <div className="space-y-6">
      {/* Grade badge + value range */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-suns-purple/40 p-5 text-center">
          <p className="text-xs text-white/40 uppercase tracking-wider">Grade Estimate</p>
          <div
            className={`mt-3 inline-block rounded-xl border px-5 py-2 text-3xl font-bold ${gradeColor(result.grade_estimate)}`}
          >
            {result.grade_estimate}
          </div>
          <p className="mt-2 text-xs text-white/40">
            Range: {result.grade_range[0]} – {result.grade_range[1]}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-suns-purple/40 p-5 text-center">
          <p className="text-xs text-white/40 uppercase tracking-wider">Confidence</p>
          <p className={`mt-3 text-4xl font-bold ${confidenceColor(result.confidence)}`}>
            {Math.round(result.confidence * 100)}%
          </p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-white/10">
            <div
              className="h-1.5 rounded-full bg-suns-orange"
              style={{ width: `${result.confidence * 100}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-suns-purple/40 p-5 text-center">
          <p className="text-xs text-white/40 uppercase tracking-wider">Value Range</p>
          <p className="mt-3 text-2xl font-bold text-suns-gold">
            ${result.value_low}–${result.value_high}
          </p>
          <p className="mt-2 text-xs text-white/40">{result.currency}</p>
        </div>
      </div>

      {/* Condition breakdown */}
      <div className="rounded-xl border border-white/10 bg-suns-purple/40 p-5">
        <h3 className="mb-4 font-semibold text-white">Condition Breakdown</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {detailRows.map(({ label, value }) => (
            <div key={label} className="rounded-lg bg-white/5 px-4 py-3">
              <p className="text-xs text-white/40 uppercase tracking-wider">{label}</p>
              <p className="mt-1 text-sm text-white">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      {result.notes && (
        <div className="rounded-xl border border-suns-gold/20 bg-suns-gold/5 p-5">
          <p className="text-xs font-semibold text-suns-gold uppercase tracking-wider mb-2">
            AI Notes
          </p>
          <p className="text-sm text-white/80">{result.notes}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={addToPortfolio}
          className="rounded-lg bg-suns-orange px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-suns-orange-soft"
        >
          Add to Portfolio
        </button>
        <button
          onClick={() => router.push("/dashboard/alerts")}
          className="rounded-lg border border-white/10 px-5 py-2.5 text-sm font-medium text-white/70 transition-colors hover:text-white"
        >
          Set Price Alert
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function GradeClient() {
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GradeResult | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!front) { setError("Please upload the front image."); return; }
    setError("");
    setLoading(true);
    setResult(null);

    const fd = new FormData();
    fd.append("front", front);
    if (back) fd.append("back", back);

    try {
      const res = await fetch("/api/grade", { method: "POST", body: fd });
      const data = (await res.json()) as GradeResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Unknown error");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Grading failed.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setFront(null);
    setBack(null);
    setResult(null);
    setError("");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">AI Card Grader</h1>
        <p className="mt-1 text-sm text-white/50">
          Upload photos of your card and get an instant PSA/BGS grade estimate
          powered by Claude AI.
        </p>
      </div>

      {!result ? (
        <form onSubmit={submit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium text-white/70">Front *</p>
              <ImageDropZone label="Card Front" file={front} onFile={setFront} />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-white/70">Back (optional)</p>
              <ImageDropZone label="Card Back" file={back} onFile={setBack} />
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading || !front}
            className="flex items-center gap-2 rounded-lg bg-suns-orange px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-suns-orange-soft disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Analyzing card…
              </>
            ) : (
              "⚡ Grade This Card"
            )}
          </button>
        </form>
      ) : (
        <>
          <ResultCard result={result} />
          <button
            onClick={reset}
            className="text-sm text-white/40 hover:text-white transition-colors"
          >
            ← Grade another card
          </button>
        </>
      )}
    </div>
  );
}
