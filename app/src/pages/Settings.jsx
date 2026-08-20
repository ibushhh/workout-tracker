import { useEffect, useRef, useState } from "react";
import { Download, Upload, Trash2, Plus, Sun, Moon, Monitor } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { api, downloadFile, getToken } from "../lib/api.js";
import { todayISO } from "../lib/dates.js";
import ConfirmDialog from "../components/ConfirmDialog.jsx";

const GOAL_TYPES = [
  { value: "weekly_cardio_minutes", label: "Weekly cardio minutes" },
  { value: "weekly_workouts", label: "Weekly workout count" },
  { value: "weekly_strength_volume", label: "Weekly strength volume (kg)" },
  { value: "target_body_weight", label: "Target body weight" },
  { value: "exercise_milestone", label: "Exercise milestone (target weight)" },
];

export default function Settings() {
  const { user, updateProfile, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const toast = useToast();

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-subtitle">Units, appearance, goals, templates, and data</div>
        </div>
      </div>

      <div className="card section">
        <div className="card-title">Units</div>
        <div className="field-row">
          <div className="field">
            <label>Weight unit</label>
            <div className="toggle-group">
              <button className={`toggle-option${user.defaultWeightUnit === "kg" ? " active" : ""}`} onClick={() => updateProfile({ defaultWeightUnit: "kg" }).then(() => toast.success("Weight unit set to kg."))}>kg</button>
              <button className={`toggle-option${user.defaultWeightUnit === "lb" ? " active" : ""}`} onClick={() => updateProfile({ defaultWeightUnit: "lb" }).then(() => toast.success("Weight unit set to lb."))}>lb</button>
            </div>
          </div>
          <div className="field">
            <label>Distance unit</label>
            <div className="toggle-group">
              <button className={`toggle-option${user.defaultDistanceUnit === "km" ? " active" : ""}`} onClick={() => updateProfile({ defaultDistanceUnit: "km" }).then(() => toast.success("Distance unit set to km."))}>km</button>
              <button className={`toggle-option${user.defaultDistanceUnit === "mi" ? " active" : ""}`} onClick={() => updateProfile({ defaultDistanceUnit: "mi" }).then(() => toast.success("Distance unit set to mi."))}>mi</button>
            </div>
          </div>
        </div>
      </div>

      <div className="card section">
        <div className="card-title">Appearance</div>
        <div className="toggle-group">
          <button className={`toggle-option${theme === "light" ? " active" : ""}`} onClick={() => setTheme("light")}><Sun size={14} style={{ marginRight: 4, verticalAlign: -2 }} />Light</button>
          <button className={`toggle-option${theme === "dark" ? " active" : ""}`} onClick={() => setTheme("dark")}><Moon size={14} style={{ marginRight: 4, verticalAlign: -2 }} />Dark</button>
          <button className={`toggle-option${theme === "system" ? " active" : ""}`} onClick={() => setTheme("system")}><Monitor size={14} style={{ marginRight: 4, verticalAlign: -2 }} />System</button>
        </div>
      </div>

      <GoalsSection />
      <TemplatesSection />

      <ChangePasswordSection />

      <div className="card section">
        <div className="card-title">Export data</div>
        <p className="text-muted" style={{ fontSize: 13, marginBottom: 12 }}>Download your history as CSV, or a full JSON backup you can re-import later.</p>
        <div className="flex gap-8" style={{ flexWrap: "wrap" }}>
          <button className="btn btn-secondary btn-sm" onClick={() => downloadFile("/export/cardio.csv", "cardio-history.csv")}><Download size={14} /> Cardio CSV</button>
          <button className="btn btn-secondary btn-sm" onClick={() => downloadFile("/export/strength.csv", "strength-history.csv")}><Download size={14} /> Strength CSV</button>
          <button className="btn btn-secondary btn-sm" onClick={() => downloadFile("/export/body-measurements.csv", "body-measurements.csv")}><Download size={14} /> Body measurements CSV</button>
          <button className="btn btn-secondary btn-sm" onClick={() => downloadFile("/export/backup.json", "workout-tracker-backup.json")}><Download size={14} /> Full JSON backup</button>
        </div>
      </div>

      <ImportSection />

      <div className="card section">
        <div className="card-title">Account</div>
        <button className="btn btn-secondary" onClick={logout}>Sign out</button>
      </div>
    </div>
  );
}

function ChangePasswordSection() {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (next.length < 6) return setError("New password must be at least 6 characters.");
    setBusy(true);
    try {
      await api.post("/auth/change-password", { currentPassword: current, newPassword: next });
      toast.success("Password changed.");
      setCurrent("");
      setNext("");
    } catch (err) {
      setError(err.message || "Could not change password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card section" onSubmit={submit}>
      <div className="card-title">Change password</div>
      <div className="field-row">
        <div className="field">
          <label>Current password</label>
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div className="field">
          <label>New password</label>
          <input type="password" minLength={6} value={next} onChange={(e) => setNext(e.target.value)} />
        </div>
      </div>
      {error && <p className="field-error">{error}</p>}
      <button className="btn btn-primary" disabled={busy}>{busy ? "Saving..." : "Change password"}</button>
    </form>
  );
}

function ImportSection() {
  const toast = useToast();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const token = getToken();
      const res = await fetch("/api/export/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(json),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed.");
      toast.success(`Imported ${data.dailyLogsImported} day(s) of history.`);
    } catch (err) {
      toast.error(err.message || "That file couldn't be imported.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="card section">
      <div className="card-title">Import backup</div>
      <p className="text-muted" style={{ fontSize: 13, marginBottom: 12 }}>Restore from a JSON backup previously exported from this app. Importing is safe to re-run — it won't duplicate existing entries.</p>
      <input ref={fileRef} type="file" accept="application/json" onChange={handleFile} disabled={busy} style={{ display: "none" }} id="import-file" />
      <button className="btn btn-secondary" onClick={() => fileRef.current?.click()} disabled={busy}><Upload size={14} /> {busy ? "Importing..." : "Choose backup file"}</button>
    </div>
  );
}

function GoalsSection() {
  const { user } = useAuth();
  const toast = useToast();
  const [goals, setGoals] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [goalType, setGoalType] = useState(GOAL_TYPES[0].value);
  const [targetValue, setTargetValue] = useState("");
  const [exerciseId, setExerciseId] = useState("");

  function load() {
    api.get("/goals").then((d) => setGoals(d.goals));
  }
  useEffect(() => { load(); api.get("/exercises").then((d) => setExercises(d.exercises.filter((e) => !e.isArchived))); }, []);

  async function addGoal(e) {
    e.preventDefault();
    if (!targetValue || Number(targetValue) <= 0) return toast.error("Enter a target value greater than zero.");
    try {
      await api.post("/goals", { goalType, targetValue: Number(targetValue), exerciseId: goalType === "exercise_milestone" ? exerciseId : undefined });
      toast.success("Goal added.");
      setTargetValue("");
      load();
    } catch (err) {
      toast.error(err.message || "Could not add goal.");
    }
  }
  async function removeGoal(id) {
    await api.del(`/goals/${id}`);
    load();
  }

  return (
    <div className="card section">
      <div className="card-title">Goals</div>
      {goals.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          {goals.map((g) => (
            <div key={g.id} className="list-row">
              <div style={{ fontSize: 14 }}>
                {GOAL_TYPES.find((t) => t.value === g.goalType)?.label}{g.exerciseName ? ` — ${g.exerciseName}` : ""}: <b>{g.targetValue}{g.goalType.includes("weight") ? ` ${user.defaultWeightUnit}` : g.goalType === "weekly_cardio_minutes" ? " min" : ""}</b>
              </div>
              <button className="icon-btn" onClick={() => removeGoal(g.id)}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={addGoal} className="field-row" style={{ alignItems: "flex-end" }}>
        <div className="field">
          <label>Goal type</label>
          <select value={goalType} onChange={(e) => setGoalType(e.target.value)}>
            {GOAL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        {goalType === "exercise_milestone" && (
          <div className="field">
            <label>Exercise</label>
            <select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
              <option value="">Select...</option>
              {exercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
        )}
        <div className="field">
          <label>Target</label>
          <input type="number" min="0" step="0.1" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} style={{ width: 110 }} />
        </div>
        <button className="btn btn-primary btn-sm" style={{ marginBottom: 14 }}><Plus size={14} /> Add goal</button>
      </form>
    </div>
  );
}

function TemplatesSection() {
  const toast = useToast();
  const [templates, setTemplates] = useState([]);
  const [creating, setCreating] = useState(false);
  const [applyTarget, setApplyTarget] = useState(null);
  const [applyDate, setApplyDate] = useState(todayISO());

  function load() {
    api.get("/templates").then((d) => setTemplates(d.templates));
  }
  useEffect(load, []);

  async function removeTemplate(id) {
    await api.del(`/templates/${id}`);
    toast.success("Template deleted.");
    load();
  }
  async function applyTemplate() {
    await api.post(`/templates/${applyTarget.id}/apply`, { date: applyDate });
    toast.success(`Applied "${applyTarget.name}" to ${applyDate}.`);
    setApplyTarget(null);
  }

  return (
    <div className="card section">
      <div className="flex justify-between items-center" style={{ marginBottom: 10 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>Workout templates</div>
        <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}><Plus size={14} /> New template</button>
      </div>
      {templates.length === 0 ? (
        <p className="text-muted" style={{ fontSize: 13 }}>No templates yet — save a group of exercises (Push Day, Leg Day, etc.) to quickly apply them to any date.</p>
      ) : (
        templates.map((t) => (
          <div key={t.id} className="list-row">
            <div>
              <div style={{ fontWeight: 600 }}>{t.name}</div>
              <div className="text-faint" style={{ fontSize: 12 }}>{t.exercises.map((e) => e.exerciseName).join(", ") || "No exercises"}</div>
            </div>
            <div className="flex gap-8">
              <button className="btn btn-secondary btn-sm" onClick={() => { setApplyTarget(t); setApplyDate(todayISO()); }}>Apply</button>
              <button className="icon-btn" onClick={() => removeTemplate(t.id)}><Trash2 size={15} /></button>
            </div>
          </div>
        ))
      )}

      {creating && <TemplateModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />}
      {applyTarget && (
        <ConfirmDialog
          title={`Apply "${applyTarget.name}"`}
          danger={false}
          confirmLabel="Apply"
          message={<span>Adds this template's exercises to your log for the date below.<br /><input type="date" value={applyDate} max={todayISO()} onChange={(e) => setApplyDate(e.target.value)} style={{ marginTop: 10 }} /></span>}
          onCancel={() => setApplyTarget(null)}
          onConfirm={applyTemplate}
        />
      )}
    </div>
  );
}

function TemplateModal({ onClose, onSaved }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [exercises, setExercises] = useState([]);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get("/exercises").then((d) => setExercises(d.exercises.filter((e) => !e.isArchived))); }, []);

  function addRow() {
    setRows((r) => [...r, { exerciseId: exercises[0]?.id || "", targetSets: 3, targetReps: 8, targetWeightKg: "" }]);
  }
  function updateRow(i, patch) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function removeRow(i) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return setError("Template name is required.");
    setBusy(true);
    try {
      await api.post("/templates", {
        name: name.trim(),
        description: description || null,
        exercises: rows.map((r) => ({ exerciseId: r.exerciseId, targetSets: Number(r.targetSets) || 1, targetReps: Number(r.targetReps) || 8, targetWeightKg: r.targetWeightKg === "" ? null : Number(r.targetWeightKg) })),
      });
      toast.success("Template saved.");
      onSaved();
    } catch (err) {
      setError(err.message || "Could not save template.");
      setBusy(false);
    }
  }

  return (
    <ConfirmDialog
      title="New workout template"
      danger={false}
      confirmLabel={busy ? "Saving..." : "Save template"}
      onCancel={onClose}
      onConfirm={submit}
      message={
        <div style={{ textAlign: "left" }}>
          <div className="field">
            <label>Name</label>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Push Day" />
          </div>
          <div className="field">
            <label>Description (optional)</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {rows.map((row, i) => (
            <div key={i} className="flex gap-8 items-center" style={{ marginBottom: 8 }}>
              <select value={row.exerciseId} onChange={(e) => updateRow(i, { exerciseId: e.target.value })} style={{ flex: 2 }}>
                {exercises.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
              </select>
              <input type="number" min="1" value={row.targetSets} onChange={(e) => updateRow(i, { targetSets: e.target.value })} style={{ width: 50 }} title="Sets" />
              <input type="number" min="1" value={row.targetReps} onChange={(e) => updateRow(i, { targetReps: e.target.value })} style={{ width: 50 }} title="Reps" />
              <button type="button" className="icon-btn" onClick={() => removeRow(i)}><Trash2 size={14} /></button>
            </div>
          ))}
          <button type="button" className="btn btn-secondary btn-sm" onClick={addRow}><Plus size={14} /> Add exercise</button>
          {error && <p className="field-error">{error}</p>}
        </div>
      }
    />
  );
}
