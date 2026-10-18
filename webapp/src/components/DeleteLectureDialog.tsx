import { useEffect, useRef, useState } from "react";

export function DeleteLectureDialog({ lectureTitle, returnFocus, onCancel, onConfirm }: {
  lectureTitle: string;
  returnFocus: HTMLElement | null;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    cancelRef.current?.focus();
    return () => { if (dialog.open) dialog.close(); };
  }, []);

  function close() {
    if (busy) return;
    onCancel();
    requestAnimationFrame(() => returnFocus?.focus());
  }

  async function confirm() {
    if (busy) return;
    setBusy(true); setError("");
    try { await onConfirm(); }
    catch { setError("Could not delete this lecture. Please try again."); setBusy(false); }
  }

  return <dialog ref={dialogRef} className="confirm-dialog" aria-labelledby="delete-title" onCancel={(event) => { event.preventDefault(); close(); }} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); close(); } }}>
    <h2 id="delete-title">Delete “{lectureTitle}”?</h2>
    <p>This removes the lecture from teacher and student dashboards. This action cannot be undone.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="dialog-actions">
      <button ref={cancelRef} className="secondary" type="button" disabled={busy} onClick={close}>Cancel</button>
      <button className="danger solid" type="button" disabled={busy} onClick={() => void confirm()}>{busy ? "Deleting…" : "Delete lecture"}</button>
    </div>
  </dialog>;
}
