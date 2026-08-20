import { useMemo, useState } from "react";
import { Plus, Trash2, Copy } from "lucide-react";
import Modal from "./Modal.jsx";

function buildSimpleSets(count, repsMode, reps, repsArray, weight) {
  const n = Math.max(1, Number(count) || 1);
  return Array.from({ length: n }, (_, i) => ({
    reps: repsMode === "uniform" ? Number(reps) || 0 : Number(repsArray[i]) || 0,
    weight: Number(weight) || 0,
    completed: true,
  }));
}

export default function StrengthExerciseModal({ exercise, initial, weightUnit: defaultUnit, onSave, onClose, onCopyLast }) {
  const [mode, setMode] = useState("simple");
  const [weightUnit, setWeightUnit] = useState(initial?.sets?.[0]?.weightUnit || defaultUnit);
  const [notes, setNotes] = useState(initial?.notes || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [setCount, setSetCount] = useState(initial?.sets?.length || 3);
  const [repsMode, setRepsMode] = useState("uniform");
  const [uniformReps, setUniformReps] = useState(initial?.sets?.[0]?.reps || 10);
  const [repsArray, setRepsArray] = useState(initial?.sets?.map((s) => s.reps) || [10, 10, 10]);
  const [uniformWeight, setUniformWeight] = useState(initial?.sets?.[0]?.weightKg || "");

  const [advancedSets, setAdvancedSets] = useState(
    initial?.sets?.map((s) => ({ reps: s.reps, weight: s.weightKg, completed: s.completed })) || buildSimpleSets(3, "uniform", 10, [], "")
  );

  const simpleSets = useMemo(
    () => buildSimpleSets(setCount, repsMode, uniformReps, repsArray, uniformWeight),
    [setCount, repsMode, uniformReps, repsArray, uniformWeight]
  );

  function switchToAdvanced() {
    setAdvancedSets(mode === "simple" ? simpleSets.map((s) => ({ ...s })) : advancedSets);
    setMode("advanced");
  }

  function updateAdvancedSet(i, patch) {
    setAdvancedSets((sets) => sets.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function addAdvancedSet() {
    const last = advancedSets[advancedSets.length - 1];
    setAdvancedSets((sets) => [...sets, last ? { ...last } : { reps: 10, weight: 0, completed: true }]);
  }
  function removeAdvancedSet(i) {
    setAdvancedSets((sets) => sets.filter((_, idx) => idx !== i));
  }

  async function copyLast() {
    const last = await onCopyLast();
    if (!last || !last.sets?.length) return;
    setAdvancedSets(last.sets.map((s) => ({ reps: s.reps, weight: s.weightKg, completed: s.completed })));
    setWeightUnit(last.sets[0].weightUnit || defaultUnit);
    setMode("advanced");
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    const sets = mode === "simple" ? simpleSets : advancedSets;
    if (sets.some((s) => !s.reps || s.reps <= 0)) return setError("Every set needs reps greater than zero.");
    if (sets.some((s) => s.weight == null || s.weight < 0 || s.weight === "")) return setError("Every set needs a weight of zero or more.");
    setBusy(true);
    try {
      await onSave({
        exerciseId: exercise?.id || initial?.exerciseId,
        exerciseName: exercise?.name || initial?.exerciseName,
        muscleGroup: exercise?.primaryMuscleGroup,
        notes: notes || null,
        sets: sets.map((s) => ({ reps: Number(s.reps), weight: Number(s.weight), weightUnit, completed: s.completed !== false })),
      });
    } catch (err) {
      setError(err.message || "Could not save exercise.");
      setBusy(false);
    }
  }

  const name = exercise?.name || initial?.exerciseName;

  return (
    <Modal title={name} onClose={onClose} width="460px">
      <form onSubmit={submit}>
        <div className="flex justify-between items-center" style={{ marginBottom: 14 }}>
          <div className="toggle-group">
            <button type="button" className={`toggle-option${mode === "simple" ? " active" : ""}`} onClick={() => setMode("simple")}>Simple</button>
            <button type="button" className={`toggle-option${mode === "advanced" ? " active" : ""}`} onClick={switchToAdvanced}>Advanced</button>
          </div>
          {onCopyLast && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={copyLast}><Copy size={14} /> Copy last</button>
          )}
        </div>

        <div className="field">
          <label>Weight unit</label>
          <div className="toggle-group">
            <button type="button" className={`toggle-option${weightUnit === "kg" ? " active" : ""}`} onClick={() => setWeightUnit("kg")}>kg</button>
            <button type="button" className={`toggle-option${weightUnit === "lb" ? " active" : ""}`} onClick={() => setWeightUnit("lb")}>lb</button>
          </div>
        </div>

        {mode === "simple" ? (
          <>
            <div className="field-row">
              <div className="field">
                <label>Sets</label>
                <input type="number" min="1" value={setCount} onChange={(e) => {
                  const n = Number(e.target.value) || 1;
                  setSetCount(n);
                  setRepsArray((arr) => Array.from({ length: n }, (_, i) => arr[i] ?? uniformReps));
                }} />
              </div>
              <div className="field">
                <label>Weight ({weightUnit})</label>
                <input type="number" min="0" step="0.5" value={uniformWeight} onChange={(e) => setUniformWeight(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label className="flex items-center gap-8">
                <input type="checkbox" checked={repsMode === "perSet"} onChange={(e) => setRepsMode(e.target.checked ? "perSet" : "uniform")} />
                Different reps per set
              </label>
            </div>
            {repsMode === "uniform" ? (
              <div className="field">
                <label>Reps (per set)</label>
                <input type="number" min="1" value={uniformReps} onChange={(e) => setUniformReps(e.target.value)} />
              </div>
            ) : (
              <div className="field">
                <label>Reps for each set</label>
                <div className="flex gap-8" style={{ flexWrap: "wrap" }}>
                  {repsArray.map((r, i) => (
                    <input key={i} type="number" min="1" style={{ width: 64 }} value={r} onChange={(e) => setRepsArray((arr) => arr.map((x, idx) => (idx === i ? e.target.value : x)))} />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="field">
            <label>Sets</label>
            <div className="flex flex-col gap-8">
              {advancedSets.map((s, i) => (
                <div key={i} className="flex items-center gap-8">
                  <span className="text-faint" style={{ fontSize: 12, width: 18 }}>{i + 1}</span>
                  <input type="number" min="1" placeholder="Reps" value={s.reps} onChange={(e) => updateAdvancedSet(i, { reps: e.target.value })} style={{ flex: 1 }} />
                  <input type="number" min="0" step="0.5" placeholder="Weight" value={s.weight} onChange={(e) => updateAdvancedSet(i, { weight: e.target.value })} style={{ flex: 1 }} />
                  <label className="flex items-center" style={{ flexShrink: 0 }} title="Completed">
                    <input type="checkbox" checked={s.completed !== false} onChange={(e) => updateAdvancedSet(i, { completed: e.target.checked })} />
                  </label>
                  <button type="button" className="icon-btn" onClick={() => removeAdvancedSet(i)} disabled={advancedSets.length <= 1}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 10 }} onClick={addAdvancedSet}><Plus size={14} /> Add set</button>
          </div>
        )}

        <div className="field" style={{ marginTop: 4 }}>
          <label>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Form cues, grip, incline angle, pain..." />
        </div>

        {error && <p className="field-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Saving..." : "Save"}</button>
        </div>
      </form>
    </Modal>
  );
}
