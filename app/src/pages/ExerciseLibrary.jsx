import { useEffect, useMemo, useState } from "react";
import { Search, Star, Plus, Pencil, Trash2, Archive, ArchiveRestore } from "lucide-react";
import { api } from "../lib/api.js";
import { useToast } from "../context/ToastContext.jsx";
import Spinner from "../components/Spinner.jsx";
import Modal from "../components/Modal.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import EmptyState from "../components/EmptyState.jsx";

const MUSCLE_GROUPS = ["Chest", "Back", "Shoulders", "Biceps", "Triceps", "Forearms", "Core / Abs", "Quadriceps", "Hamstrings", "Glutes", "Calves", "Full body", "Cardio"];
const CATEGORIES = ["Barbell", "Dumbbell", "Machine", "Cable", "Bodyweight", "Kettlebell", "Resistance band", "Other"];

export default function ExerciseLibrary() {
  const toast = useToast();
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [muscleFilter, setMuscleFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState(null); // {} for new, or exercise object
  const [confirmDelete, setConfirmDelete] = useState(null);

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (muscleFilter) params.set("muscleGroup", muscleFilter);
    if (showArchived) params.set("includeArchived", "true");
    api.get(`/exercises?${params}`).then((d) => { setExercises(d.exercises); setLoading(false); });
  }

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, muscleFilter, showArchived]);

  async function toggleFavorite(e) {
    await api.patch(`/exercises/${e.id}`, { isFavorite: !e.isFavorite });
    load();
  }
  async function toggleArchive(e) {
    await api.patch(`/exercises/${e.id}`, { isArchived: !e.isArchived });
    toast.success(e.isArchived ? "Exercise restored." : "Exercise archived.");
    load();
  }
  async function deleteExercise(id) {
    await api.del(`/exercises/${id}`);
    toast.success("Exercise deleted.");
    setConfirmDelete(null);
    load();
  }
  async function saveExercise(payload) {
    if (editing.id) {
      await api.patch(`/exercises/${editing.id}`, payload);
      toast.success("Exercise updated.");
    } else {
      await api.post(`/exercises`, payload);
      toast.success("Exercise added.");
    }
    setEditing(null);
    load();
  }

  const sorted = useMemo(() => [...exercises].sort((a, b) => (b.isFavorite - a.isFavorite) || a.name.localeCompare(b.name)), [exercises]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Exercise Library</div>
          <div className="page-subtitle">Manage the exercises you use to log strength workouts</div>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({})}><Plus size={16} /> Add exercise</button>
      </div>

      <div className="card section">
        <div className="flex gap-8" style={{ marginBottom: 12, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: 12, color: "var(--text-faint)" }} />
            <input placeholder="Search exercises..." style={{ paddingLeft: 36 }} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select value={muscleFilter} onChange={(e) => setMuscleFilter(e.target.value)} style={{ width: 180 }}>
            <option value="">All muscle groups</option>
            {MUSCLE_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <label className="flex items-center gap-8" style={{ fontSize: 13, fontWeight: 600 }}>
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived
          </label>
        </div>

        {loading ? <Spinner page /> : sorted.length === 0 ? (
          <EmptyState title="No exercises found" message="Try a different search or add a new exercise." />
        ) : (
          <div>
            {sorted.map((e) => (
              <div key={e.id} className="list-row">
                <div className="flex items-center gap-12" style={{ minWidth: 0 }}>
                  <button className="icon-btn" onClick={() => toggleFavorite(e)} aria-label="Toggle favorite">
                    <Star size={17} fill={e.isFavorite ? "var(--accent)" : "none"} color={e.isFavorite ? "var(--accent)" : "var(--text-faint)"} />
                  </button>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, opacity: e.isArchived ? 0.5 : 1 }}>{e.name} {e.isArchived && <span className="badge badge-neutral">Archived</span>}</div>
                    <div className="text-faint" style={{ fontSize: 12 }}>{e.primaryMuscleGroup}{e.category ? ` · ${e.category}` : ""}{e.equipmentType ? ` · ${e.equipmentType}` : ""}</div>
                  </div>
                </div>
                <div className="flex gap-8" style={{ flexShrink: 0 }}>
                  <button className="icon-btn" onClick={() => setEditing(e)}><Pencil size={15} /></button>
                  <button className="icon-btn" onClick={() => toggleArchive(e)}>{e.isArchived ? <ArchiveRestore size={15} /> : <Archive size={15} />}</button>
                  <button className="icon-btn" onClick={() => setConfirmDelete(e)}><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && <ExerciseModal exercise={editing.id ? editing : null} onClose={() => setEditing(null)} onSave={saveExercise} />}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete exercise?"
          message={`"${confirmDelete.name}" will be permanently removed from your library. Past workout history that used it is kept.`}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => deleteExercise(confirmDelete.id)}
        />
      )}
    </div>
  );
}

function ExerciseModal({ exercise, onClose, onSave }) {
  const [name, setName] = useState(exercise?.name || "");
  const [primaryMuscleGroup, setPrimaryMuscleGroup] = useState(exercise?.primaryMuscleGroup || MUSCLE_GROUPS[0]);
  const [secondary, setSecondary] = useState((exercise?.secondaryMuscleGroups || []).join(", "));
  const [category, setCategory] = useState(exercise?.category || "");
  const [equipmentType, setEquipmentType] = useState(exercise?.equipmentType || "");
  const [notes, setNotes] = useState(exercise?.notes || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return setError("Exercise name is required.");
    setBusy(true);
    try {
      await onSave({
        name: name.trim(),
        primaryMuscleGroup,
        secondaryMuscleGroups: secondary.split(",").map((s) => s.trim()).filter(Boolean),
        category: category || null,
        equipmentType: equipmentType || null,
        notes: notes || null,
      });
    } catch (err) {
      setError(err.message || "Could not save exercise.");
      setBusy(false);
    }
  }

  return (
    <Modal title={exercise ? "Edit exercise" : "Add exercise"} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label>Name</label>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Barbell Bench Press" />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Primary muscle group</label>
            <select value={primaryMuscleGroup} onChange={(e) => setPrimaryMuscleGroup(e.target.value)}>
              {MUSCLE_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">—</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Secondary muscle groups</label>
          <input value={secondary} onChange={(e) => setSecondary(e.target.value)} placeholder="Comma-separated, optional" />
        </div>
        <div className="field">
          <label>Equipment</label>
          <input value={equipmentType} onChange={(e) => setEquipmentType(e.target.value)} placeholder="Optional" />
        </div>
        <div className="field">
          <label>Notes / form cues</label>
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
