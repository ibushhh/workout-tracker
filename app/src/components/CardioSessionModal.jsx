import { useState } from "react";
import Modal from "./Modal.jsx";
import { useToast } from "../context/ToastContext.jsx";

function parsePace(text) {
  if (!text || !text.trim()) return null;
  const m = text.trim().match(/^(\d+):([0-5]?\d)$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}
function formatPace(seconds) {
  if (seconds == null) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function CardioSessionModal({ activities, defaultDistanceUnit, initial, onSave, onClose }) {
  const toast = useToast();
  const [activityId, setActivityId] = useState(initial?.cardioActivityId || activities[0]?.id || "");
  const [customName, setCustomName] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);
  const [hours, setHours] = useState(initial ? Math.floor(initial.durationMinutes / 60) : 0);
  const [minutes, setMinutes] = useState(initial ? Math.round(initial.durationMinutes % 60) : "");
  const [calories, setCalories] = useState(initial?.caloriesBurned ?? "");
  const [avgHr, setAvgHr] = useState(initial?.averageHeartRate ?? "");
  const [maxHr, setMaxHr] = useState(initial?.maximumHeartRate ?? "");
  const [distance, setDistance] = useState(initial?.distanceKm ?? "");
  const [distanceUnit, setDistanceUnit] = useState(initial?.distanceUnit || defaultDistanceUnit);
  const [paceText, setPaceText] = useState(initial?.paceSecondsPerUnit ? formatPace(initial.paceSecondsPerUnit) : "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    const totalMinutes = Number(hours || 0) * 60 + Number(minutes || 0);
    if (!totalMinutes || totalMinutes <= 0) return setError("Enter a duration greater than zero.");
    if (addingCustom && !customName.trim()) return setError("Enter a name for the custom activity.");
    const pace = parsePace(paceText);
    if (paceText && pace == null) return setError("Pace must be in MM:SS format, e.g. 5:30.");

    setBusy(true);
    try {
      await onSave({
        cardioActivityId: addingCustom ? null : activityId || null,
        activityName: addingCustom ? customName.trim() : undefined,
        durationMinutes: totalMinutes,
        caloriesBurned: calories === "" ? null : Number(calories),
        averageHeartRate: avgHr === "" ? null : Number(avgHr),
        maximumHeartRate: maxHr === "" ? null : Number(maxHr),
        distance: distance === "" ? null : Number(distance),
        distanceUnit,
        pace,
        notes: notes || null,
      });
    } catch (err) {
      setError(err.message || "Could not save cardio session.");
      setBusy(false);
    }
  }

  return (
    <Modal title={initial ? "Edit cardio session" : "Add cardio session"} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label>Activity</label>
          {!addingCustom ? (
            <select value={activityId} onChange={(e) => setActivityId(e.target.value)}>
              {activities.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          ) : (
            <input autoFocus placeholder="Custom activity name" value={customName} onChange={(e) => setCustomName(e.target.value)} />
          )}
          <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start", padding: "4px 0" }} onClick={() => setAddingCustom((v) => !v)}>
            {addingCustom ? "Choose from list instead" : "+ Add custom activity"}
          </button>
        </div>

        <div className="field-row">
          <div className="field">
            <label>Hours</label>
            <input type="number" min="0" value={hours} onChange={(e) => setHours(e.target.value)} />
          </div>
          <div className="field">
            <label>Minutes</label>
            <input type="number" min="0" max="59" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label>Calories burned</label>
          <input type="number" min="0" value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="Optional" />
        </div>

        <div className="field-row">
          <div className="field">
            <label>Avg heart rate (bpm)</label>
            <input type="number" min="20" max="250" value={avgHr} onChange={(e) => setAvgHr(e.target.value)} placeholder="Optional" />
          </div>
          <div className="field">
            <label>Max heart rate (bpm)</label>
            <input type="number" min="20" max="250" value={maxHr} onChange={(e) => setMaxHr(e.target.value)} placeholder="Optional" />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label>Distance</label>
            <div className="input-suffix-group">
              <input type="number" min="0" step="0.01" value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="Optional" />
              <select value={distanceUnit} onChange={(e) => setDistanceUnit(e.target.value)}>
                <option value="km">km</option>
                <option value="mi">mi</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label>Pace (mm:ss / {distanceUnit})</label>
            <input value={paceText} onChange={(e) => setPaceText(e.target.value)} placeholder="Auto if blank" />
          </div>
        </div>

        <div className="field">
          <label>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
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
