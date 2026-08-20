import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Scale } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";
import { todayISO } from "../lib/dates.js";
import { fmtWeight, weightFromKg, heightFromCm, round } from "../lib/units.js";
import Spinner from "../components/Spinner.jsx";
import Modal from "../components/Modal.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import EmptyState from "../components/EmptyState.jsx";

const GENDERS = ["", "Female", "Male", "Non-binary", "Prefer not to say"];
const ACTIVITY_LEVELS = ["", "Sedentary", "Lightly active", "Moderately active", "Very active", "Extremely active"];

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const toast = useToast();

  const [form, setForm] = useState(() => ({
    name: user.name || "",
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.slice(0, 10) : "",
    gender: user.gender || "",
    height: user.heightCm != null ? round(heightFromCm(user.heightCm, user.defaultWeightUnit === "lb" ? "in" : "cm"), 1) : "",
    heightUnit: user.defaultWeightUnit === "lb" ? "in" : "cm",
    fitnessGoal: user.fitnessGoal || "",
    activityLevel: user.activityLevel || "",
    targetWeight: user.targetWeightKg != null ? round(weightFromKg(user.targetWeightKg, user.defaultWeightUnit), 1) : "",
    targetWeeklyWorkouts: user.targetWeeklyWorkouts ?? "",
    targetDailyCalories: user.targetDailyCalories ?? "",
  }));
  const [saving, setSaving] = useState(false);

  const [measurements, setMeasurements] = useState([]);
  const [loadingMeasurements, setLoadingMeasurements] = useState(true);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  function loadMeasurements() {
    setLoadingMeasurements(true);
    api.get("/body-measurements").then((d) => { setMeasurements([...d.measurements].reverse()); setLoadingMeasurements(false); });
  }
  useEffect(loadMeasurements, []);

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({
        name: form.name,
        dateOfBirth: form.dateOfBirth || null,
        gender: form.gender || null,
        height: form.height === "" ? null : Number(form.height),
        heightUnit: form.heightUnit,
        defaultWeightUnit: user.defaultWeightUnit,
        fitnessGoal: form.fitnessGoal || null,
        activityLevel: form.activityLevel || null,
        targetWeight: form.targetWeight === "" ? null : Number(form.targetWeight),
        targetWeeklyWorkouts: form.targetWeeklyWorkouts === "" ? null : Number(form.targetWeeklyWorkouts),
        targetDailyCalories: form.targetDailyCalories === "" ? null : Number(form.targetDailyCalories),
      });
      toast.success("Profile saved.");
    } catch (err) {
      toast.error(err.message || "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  async function saveMeasurement(payload) {
    if (editing.id) {
      await api.patch(`/body-measurements/${editing.id}`, payload);
      toast.success("Measurement updated.");
    } else {
      await api.post(`/body-measurements`, payload);
      toast.success("Measurement logged.");
    }
    setEditing(null);
    loadMeasurements();
  }
  async function deleteMeasurement(id) {
    await api.del(`/body-measurements/${id}`);
    toast.success("Measurement removed.");
    setConfirmDelete(null);
    loadMeasurements();
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Profile & Body Metrics</div>
          <div className="page-subtitle">Personal info, goals, and body measurement history</div>
        </div>
      </div>

      <form onSubmit={saveProfile} className="card section">
        <div className="card-title">Personal information</div>
        <div className="field-row">
          <div className="field">
            <label>Name</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="field">
            <label>Date of birth</label>
            <input type="date" value={form.dateOfBirth} onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))} />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Gender (optional)</label>
            <select value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}>
              {GENDERS.map((g) => <option key={g} value={g}>{g || "Prefer not to say"}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Height</label>
            <div className="input-suffix-group">
              <input type="number" min="0" step="0.1" value={form.height} onChange={(e) => setForm((f) => ({ ...f, height: e.target.value }))} />
              <select value={form.heightUnit} onChange={(e) => setForm((f) => ({ ...f, heightUnit: e.target.value }))}>
                <option value="cm">cm</option>
                <option value="in">in</option>
              </select>
            </div>
          </div>
        </div>

        <div className="divider" />
        <div className="card-title">Goals</div>
        <div className="field">
          <label>Fitness goal</label>
          <input value={form.fitnessGoal} onChange={(e) => setForm((f) => ({ ...f, fitnessGoal: e.target.value }))} placeholder="e.g. Build strength, lose fat, run a 10K" />
        </div>
        <div className="field">
          <label>Activity level (optional)</label>
          <select value={form.activityLevel} onChange={(e) => setForm((f) => ({ ...f, activityLevel: e.target.value }))}>
            {ACTIVITY_LEVELS.map((l) => <option key={l} value={l}>{l || "Not set"}</option>)}
          </select>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Target weight ({user.defaultWeightUnit})</label>
            <input type="number" min="0" step="0.1" value={form.targetWeight} onChange={(e) => setForm((f) => ({ ...f, targetWeight: e.target.value }))} placeholder="Optional" />
          </div>
          <div className="field">
            <label>Target weekly workouts</label>
            <input type="number" min="0" value={form.targetWeeklyWorkouts} onChange={(e) => setForm((f) => ({ ...f, targetWeeklyWorkouts: e.target.value }))} placeholder="Optional" />
          </div>
          <div className="field">
            <label>Target daily calories burned</label>
            <input type="number" min="0" value={form.targetDailyCalories} onChange={(e) => setForm((f) => ({ ...f, targetDailyCalories: e.target.value }))} placeholder="Optional" />
          </div>
        </div>
        <button className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : "Save profile"}</button>
      </form>

      <div className="section">
        <div className="section-title">
          <span className="flex items-center gap-8"><Scale size={17} /> Body weight history</span>
          <button className="btn btn-primary btn-sm" onClick={() => setEditing({})}><Plus size={14} /> Log measurement</button>
        </div>
        <div className="card">
          {loadingMeasurements ? <Spinner page /> : measurements.length === 0 ? (
            <EmptyState icon={Scale} title="No measurements logged yet" message="Track your body weight over time to see BMI trends and progress toward your goal." />
          ) : (
            measurements.map((m) => (
              <div key={m.id} className="list-row">
                <div>
                  <div style={{ fontWeight: 600 }}>{fmtWeight(m.bodyWeightKg, user.defaultWeightUnit)}</div>
                  <div className="text-faint" style={{ fontSize: 12 }}>
                    {m.date}
                    {m.waistCm != null && ` · Waist ${round(m.waistCm, 1)} cm`}
                    {m.bodyFatPercentage != null && ` · ${m.bodyFatPercentage}% body fat`}
                    {m.notes && ` · ${m.notes}`}
                  </div>
                </div>
                <div className="flex gap-8">
                  <button className="icon-btn" onClick={() => setEditing(m)}><Pencil size={15} /></button>
                  <button className="icon-btn" onClick={() => setConfirmDelete(m)}><Trash2 size={15} /></button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {editing && <MeasurementModal measurement={editing.id ? editing : null} weightUnit={user.defaultWeightUnit} onClose={() => setEditing(null)} onSave={saveMeasurement} />}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete measurement?"
          message={`This will permanently remove the measurement from ${confirmDelete.date}.`}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => deleteMeasurement(confirmDelete.id)}
        />
      )}
    </div>
  );
}

function MeasurementModal({ measurement, weightUnit, onClose, onSave }) {
  const [date, setDate] = useState(measurement?.date || todayISO());
  const [weight, setWeight] = useState(measurement ? round(weightFromKg(measurement.bodyWeightKg, weightUnit), 1) : "");
  const [waist, setWaist] = useState(measurement?.waistCm ?? "");
  const [bodyFat, setBodyFat] = useState(measurement?.bodyFatPercentage ?? "");
  const [notes, setNotes] = useState(measurement?.notes || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!weight || Number(weight) <= 0) return setError("Enter a body weight greater than zero.");
    setBusy(true);
    try {
      await onSave({ date, bodyWeight: Number(weight), weightUnit, waist: waist === "" ? null : Number(waist), waistUnit: "cm", bodyFatPercentage: bodyFat === "" ? null : Number(bodyFat), notes: notes || null });
    } catch (err) {
      setError(err.message || "Could not save.");
      setBusy(false);
    }
  }

  return (
    <Modal title={measurement ? "Edit measurement" : "Log measurement"} onClose={onClose} width="380px">
      <form onSubmit={submit}>
        <div className="field">
          <label>Date</label>
          <input type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} disabled={!!measurement} />
        </div>
        <div className="field">
          <label>Body weight ({weightUnit})</label>
          <input type="number" min="0" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Waist (cm, optional)</label>
            <input type="number" min="0" step="0.1" value={waist} onChange={(e) => setWaist(e.target.value)} />
          </div>
          <div className="field">
            <label>Body fat % (optional)</label>
            <input type="number" min="0" max="100" step="0.1" value={bodyFat} onChange={(e) => setBodyFat(e.target.value)} />
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
