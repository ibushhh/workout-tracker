import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, PlusCircle, Dumbbell, HeartPulse, Trash2, Pencil, Copy, Star, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";
import { todayISO, addDaysISO, fmtDateLong, isToday } from "../lib/dates.js";
import { fmtDuration, fmtCalories, fmtWeight, fmtDistance, fmtPace, weightFromKg, round } from "../lib/units.js";
import Spinner from "../components/Spinner.jsx";
import Modal from "../components/Modal.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import ExercisePicker from "../components/ExercisePicker.jsx";
import CardioSessionModal from "../components/CardioSessionModal.jsx";
import StrengthExerciseModal from "../components/StrengthExerciseModal.jsx";
import RatingInput from "../components/RatingInput.jsx";
import EmptyState from "../components/EmptyState.jsx";

const DAY_TYPE_LABEL = { workout: "Workout day", cardio_only: "Cardio day", strength_only: "Strength day", rest: "Rest day" };

function draftKey(date) {
  return `wt_draft_${date}`;
}

export default function LogWorkout() {
  const { date: dateParam } = useParams();
  const navigate = useNavigate();
  const date = dateParam || todayISO();
  const { user } = useAuth();
  const toast = useToast();

  const [day, setDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exercises, setExercises] = useState([]);
  const [recentExercises, setRecentExercises] = useState([]);
  const [cardioActivities, setCardioActivities] = useState([]);

  const [details, setDetails] = useState({
    notes: "", bodyWeight: "", weightUnit: user.defaultWeightUnit,
    sleepRating: null, sorenessRating: null, energyRating: null, difficultyRating: null,
    manualStrengthDurationMinutes: "", manualStrengthCalories: "",
  });
  const [restDay, setRestDay] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);

  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [strengthModal, setStrengthModal] = useState(null); // { exercise } | { initial }
  const [cardioModal, setCardioModal] = useState(null); // {} | { initial }
  const [confirmDelete, setConfirmDelete] = useState(null); // { kind, id, label }
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [duplicateFrom, setDuplicateFrom] = useState(addDaysISO(date, -1));

  // Snapshot of the values as last loaded from the server (or draft),
  // compared against current state to decide whether to autosave a draft.
  // A plain "skip the first effect run" ref breaks under StrictMode's
  // double-invoked effects in dev, so we compare values instead of counting runs.
  const loadedSnapshot = useRef(null);

  const loadDay = useCallback(() => {
    setLoading(true);
    return api.get(`/daily-logs/${date}`).then((d) => {
      setDay(d);
      const draftRaw = localStorage.getItem(draftKey(date));
      const draft = draftRaw ? JSON.parse(draftRaw) : null;
      const nextDetails = {
        notes: draft?.notes ?? d.notes ?? "",
        bodyWeight: draft?.bodyWeight ?? (d.bodyWeightKg != null ? round(weightFromKg(d.bodyWeightKg, user.defaultWeightUnit), 1) : ""),
        weightUnit: draft?.weightUnit ?? user.defaultWeightUnit,
        sleepRating: draft?.sleepRating ?? d.sleepRating ?? null,
        sorenessRating: draft?.sorenessRating ?? d.sorenessRating ?? null,
        energyRating: draft?.energyRating ?? d.energyRating ?? null,
        difficultyRating: draft?.difficultyRating ?? d.difficultyRating ?? null,
        manualStrengthDurationMinutes: draft?.manualStrengthDurationMinutes ?? d.manualStrengthDurationMinutes ?? "",
        manualStrengthCalories: draft?.manualStrengthCalories ?? d.manualStrengthCalories ?? "",
      };
      const nextRestDay = draft?.restDay ?? d.dayType === "rest";
      loadedSnapshot.current = JSON.stringify({ ...nextDetails, restDay: nextRestDay });
      setDetails(nextDetails);
      setRestDay(nextRestDay);
      setDirty(!!draft);
      setLoading(false);
    });
  }, [date, user.defaultWeightUnit]);

  useEffect(() => {
    loadDay();
    api.get("/exercises").then((d) => setExercises(d.exercises));
    api.get("/daily-logs/recent-exercises").then((d) => setRecentExercises(d.recentExercises));
    api.get("/cardio-activities").then((d) => setCardioActivities(d.cardioActivities));
  }, [loadDay]);

  useEffect(() => {
    // Nothing has been loaded for this date yet — skip, otherwise this
    // would autosave a "draft" made of the component's placeholder initial
    // state before the real data ever arrives.
    if (loadedSnapshot.current == null) return;
    const current = JSON.stringify({ ...details, restDay });
    if (current === loadedSnapshot.current) return;
    setDirty(true);
    localStorage.setItem(draftKey(date), current);
  }, [details, restDay, date]);

  async function saveDetails() {
    setSavingDetails(true);
    try {
      await api.put(`/daily-logs/${date}`, {
        dayType: restDay ? "rest" : undefined,
        notes: details.notes || null,
        bodyWeight: details.bodyWeight === "" ? null : Number(details.bodyWeight),
        weightUnit: details.weightUnit,
        sleepRating: details.sleepRating,
        sorenessRating: details.sorenessRating,
        energyRating: details.energyRating,
        difficultyRating: details.difficultyRating,
        manualStrengthDurationMinutes: details.manualStrengthDurationMinutes === "" ? null : Number(details.manualStrengthDurationMinutes),
        manualStrengthCalories: details.manualStrengthCalories === "" ? null : Number(details.manualStrengthCalories),
      });
      localStorage.removeItem(draftKey(date));
      setDirty(false);
      toast.success("Workout saved.");
      loadDay();
    } catch (err) {
      toast.error(err.message || "Could not save.");
    } finally {
      setSavingDetails(false);
    }
  }

  async function addCardio(payload) {
    await api.post(`/daily-logs/${date}/cardio-sessions`, payload);
    toast.success("Cardio session added.");
    setCardioModal(null);
    loadDay();
  }
  async function editCardio(id, payload) {
    await api.patch(`/daily-logs/cardio-sessions/${id}`, payload);
    toast.success("Cardio session updated.");
    setCardioModal(null);
    loadDay();
  }
  async function deleteCardio(id) {
    await api.del(`/daily-logs/cardio-sessions/${id}`);
    toast.success("Cardio session removed.");
    setConfirmDelete(null);
    loadDay();
  }

  async function addStrength(payload) {
    await api.post(`/daily-logs/${date}/strength-exercises`, payload);
    toast.success("Exercise added.");
    setStrengthModal(null);
    setShowExercisePicker(false);
    loadDay();
  }
  async function editStrength(id, payload) {
    await api.patch(`/daily-logs/strength-exercises/${id}`, { notes: payload.notes });
    toast.success("Exercise updated.");
    setStrengthModal(null);
    loadDay();
  }
  async function deleteStrength(id) {
    await api.del(`/daily-logs/strength-exercises/${id}`);
    toast.success("Exercise removed.");
    setConfirmDelete(null);
    loadDay();
  }

  async function duplicateWorkout() {
    try {
      await api.post(`/daily-logs/${date}/duplicate`, { fromDate: duplicateFrom });
      toast.success(`Copied workout from ${duplicateFrom}.`);
      setShowDuplicate(false);
      loadDay();
    } catch (err) {
      toast.error(err.message || "Nothing to copy from that date.");
    }
  }

  async function copyLastFor(exerciseId) {
    const d = await api.get(`/daily-logs/last-strength/${exerciseId}`);
    return d.strengthExercise;
  }

  function goToDate(newDate) {
    navigate(`/log/${newDate}`);
  }

  const favoriteExercises = exercises.filter((e) => e.isFavorite && !e.isArchived).slice(0, 6);
  const weightUnit = user.defaultWeightUnit;

  if (loading) return <Spinner page />;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Log Workout</div>
          <div className="page-subtitle">{fmtDateLong(date)}</div>
        </div>
        <div className="flex gap-8 items-center">
          <button className="icon-btn" onClick={() => goToDate(addDaysISO(date, -1))} aria-label="Previous day"><ChevronLeft size={20} /></button>
          <input type="date" value={date} max={todayISO()} onChange={(e) => goToDate(e.target.value)} style={{ width: 160 }} />
          <button className="icon-btn" onClick={() => goToDate(addDaysISO(date, 1))} aria-label="Next day"><ChevronRight size={20} /></button>
          {!isToday(date) && <button className="btn btn-secondary btn-sm" onClick={() => goToDate(todayISO())}>Today</button>}
        </div>
      </div>

      <div className="card section">
        <div className="flex justify-between items-center">
          <div>
            <div style={{ fontWeight: 700 }}>Rest day</div>
            <div className="text-faint" style={{ fontSize: 12 }}>Skip workout entries — you can still log body weight and notes.</div>
          </div>
          <label className="switch">
            <input type="checkbox" checked={restDay} onChange={(e) => setRestDay(e.target.checked)} />
            <span className="switch-track" />
          </label>
        </div>
      </div>

      {!restDay && (
        <>
          <div className="section">
            <div className="section-title">
              <span className="flex items-center gap-8"><HeartPulse size={17} color="var(--cardio)" /> Cardio sessions</span>
              <button className="btn btn-primary btn-sm" onClick={() => setCardioModal({})}><PlusCircle size={14} /> Add cardio session</button>
            </div>
            {day.cardioSessions.length === 0 ? (
              <div className="card"><EmptyState icon={HeartPulse} title="No cardio logged today" message="Add a run, ride, swim, or walk." /></div>
            ) : (
              <div className="card">
                {day.cardioSessions.map((c) => (
                  <div key={c.id} className="list-row">
                    <div>
                      <div style={{ fontWeight: 600 }}>{c.activityName}</div>
                      <div className="text-faint" style={{ fontSize: 12 }}>
                        {fmtDuration(c.durationMinutes)}
                        {c.caloriesBurned != null && ` · ${fmtCalories(c.caloriesBurned)}`}
                        {c.distanceKm != null && ` · ${fmtDistance(c.distanceKm, user.defaultDistanceUnit)}`}
                        {c.paceSecondsPerUnit != null && ` · ${fmtPace(c.paceSecondsPerUnit, user.defaultDistanceUnit)}`}
                        {c.averageHeartRate != null && ` · ${c.averageHeartRate} bpm avg`}
                      </div>
                    </div>
                    <div className="flex gap-8">
                      <button className="icon-btn" onClick={() => setCardioModal({ initial: c })}><Pencil size={15} /></button>
                      <button className="icon-btn" onClick={() => setConfirmDelete({ kind: "cardio", id: c.id, label: c.activityName })}><Trash2 size={15} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="section">
            <div className="section-title">
              <span className="flex items-center gap-8"><Dumbbell size={17} color="var(--strength)" /> Strength exercises</span>
              <button className="btn btn-primary btn-sm" onClick={() => setShowExercisePicker(true)}><PlusCircle size={14} /> Add strength exercise</button>
            </div>

            {favoriteExercises.length > 0 && (
              <div className="flex gap-8" style={{ flexWrap: "wrap", marginBottom: 12 }}>
                {favoriteExercises.map((e) => (
                  <button key={e.id} className="chip" onClick={() => setStrengthModal({ exercise: e })}>
                    <Star size={12} fill="var(--accent)" color="var(--accent)" /> {e.name}
                  </button>
                ))}
              </div>
            )}

            {day.strengthExercises.length === 0 ? (
              <div className="card"><EmptyState icon={Dumbbell} title="No strength exercises today" message="Add an exercise and log your sets." /></div>
            ) : (
              <div className="flex flex-col gap-12">
                {day.strengthExercises.map((se) => (
                  <div key={se.id} className="card">
                    <div className="flex justify-between items-center">
                      <div>
                        <div style={{ fontWeight: 700 }}>{se.exerciseName}</div>
                        <div className="text-faint" style={{ fontSize: 12 }}>{se.muscleGroup}</div>
                      </div>
                      <div className="flex gap-8">
                        <button className="icon-btn" onClick={() => setConfirmDelete({ kind: "strength", id: se.id, label: se.exerciseName })}><Trash2 size={15} /></button>
                      </div>
                    </div>
                    <div className="divider" />
                    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr auto", gap: "4px 12px", fontSize: 13 }}>
                      <span className="text-faint" style={{ fontWeight: 700 }}>Set</span>
                      <span className="text-faint" style={{ fontWeight: 700 }}>Reps</span>
                      <span className="text-faint" style={{ fontWeight: 700 }}>Weight</span>
                      <span className="text-faint" style={{ fontWeight: 700 }}>✓</span>
                      {se.sets.map((s) => (
                        <Fragment key={s.id}>
                          <span>{s.setNumber}</span>
                          <span>{s.reps}</span>
                          <span>{fmtWeight(s.weightKg, weightUnit)}</span>
                          <span>{s.completed ? "✓" : "–"}</span>
                        </Fragment>
                      ))}
                    </div>
                    <div className="divider" />
                    <div className="flex gap-12 text-muted" style={{ fontSize: 12 }}>
                      <span>Volume: <b>{fmtWeight(se.totals.totalVolumeKg, weightUnit)}</b></span>
                      <span>Top set: <b>{se.totals.highestWeightKg != null ? fmtWeight(se.totals.highestWeightKg, weightUnit) : "—"}</b></span>
                      <span>Est. 1RM: <b>{se.totals.estimated1RMKg != null ? fmtWeight(se.totals.estimated1RMKg, weightUnit) : "—"}</b></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button className="btn btn-secondary btn-sm section" onClick={() => { setDuplicateFrom(addDaysISO(date, -1)); setShowDuplicate(true); }}><Copy size={14} /> Duplicate a previous workout</button>
        </>
      )}

      <div className="card section">
        <div className="card-title">Day details</div>
        <div className="field-row">
          <div className="field">
            <label>Body weight</label>
            <div className="input-suffix-group">
              <input type="number" min="0" step="0.1" value={details.bodyWeight} onChange={(e) => setDetails((d) => ({ ...d, bodyWeight: e.target.value }))} placeholder="Optional" />
              <select value={details.weightUnit} onChange={(e) => setDetails((d) => ({ ...d, weightUnit: e.target.value }))}>
                <option value="kg">kg</option>
                <option value="lb">lb</option>
              </select>
            </div>
          </div>
        </div>
        {!restDay && (
          <div className="field-row">
            <div className="field">
              <label>Manual strength duration (min)</label>
              <input type="number" min="0" value={details.manualStrengthDurationMinutes} onChange={(e) => setDetails((d) => ({ ...d, manualStrengthDurationMinutes: e.target.value }))} placeholder="Optional" />
            </div>
            <div className="field">
              <label>Manual strength calories</label>
              <input type="number" min="0" value={details.manualStrengthCalories} onChange={(e) => setDetails((d) => ({ ...d, manualStrengthCalories: e.target.value }))} placeholder="Optional" />
            </div>
          </div>
        )}
        <div className="field">
          <label>Notes</label>
          <textarea value={details.notes} onChange={(e) => setDetails((d) => ({ ...d, notes: e.target.value }))} placeholder={restDay ? "e.g. sore legs, travel, recovery day" : "Optional"} />
        </div>

        <button type="button" className="btn btn-ghost btn-sm" style={{ padding: "4px 0", marginBottom: showRecovery ? 8 : 0 }} onClick={() => setShowRecovery((v) => !v)}>
          {showRecovery ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Recovery & readiness
        </button>
        {showRecovery && (
          <div className="grid grid-2">
            <RatingInput label="Sleep quality" value={details.sleepRating} onChange={(v) => setDetails((d) => ({ ...d, sleepRating: v }))} />
            <RatingInput label="Soreness" value={details.sorenessRating} onChange={(v) => setDetails((d) => ({ ...d, sorenessRating: v }))} />
            <RatingInput label="Energy" value={details.energyRating} onChange={(v) => setDetails((d) => ({ ...d, energyRating: v }))} />
            <RatingInput label="Workout difficulty" value={details.difficultyRating} onChange={(v) => setDetails((d) => ({ ...d, difficultyRating: v }))} />
          </div>
        )}

        <button className="btn btn-primary btn-block mt-16" onClick={saveDetails} disabled={savingDetails}>
          {savingDetails ? "Saving..." : dirty ? "Save workout*" : "Save workout"}
        </button>
        {dirty && <p className="text-faint" style={{ fontSize: 11, marginTop: 6, textAlign: "center" }}>Unsaved changes are kept locally until you save.</p>}
      </div>

      {showExercisePicker && (
        <Modal title="Choose an exercise" onClose={() => setShowExercisePicker(false)}>
          <ExercisePicker exercises={exercises} recentExercises={recentExercises} onSelect={(e) => { setShowExercisePicker(false); setStrengthModal({ exercise: e }); }} />
        </Modal>
      )}

      {strengthModal && (
        <StrengthExerciseModal
          exercise={strengthModal.exercise}
          initial={strengthModal.initial}
          weightUnit={weightUnit}
          onCopyLast={strengthModal.exercise ? () => copyLastFor(strengthModal.exercise.id) : null}
          onClose={() => setStrengthModal(null)}
          onSave={(payload) => (strengthModal.initial ? editStrength(strengthModal.initial.id, payload) : addStrength(payload))}
        />
      )}

      {cardioModal && (
        <CardioSessionModal
          activities={cardioActivities}
          defaultDistanceUnit={user.defaultDistanceUnit}
          initial={cardioModal.initial}
          onClose={() => setCardioModal(null)}
          onSave={(payload) => (cardioModal.initial ? editCardio(cardioModal.initial.id, payload) : addCardio(payload))}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Remove entry?"
          message={`This will permanently remove "${confirmDelete.label}" from this day.`}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => (confirmDelete.kind === "cardio" ? deleteCardio(confirmDelete.id) : deleteStrength(confirmDelete.id))}
        />
      )}

      {showDuplicate && (
        <Modal title="Duplicate a previous workout" onClose={() => setShowDuplicate(false)} width="380px">
          <div className="field">
            <label>Copy workout from</label>
            <input type="date" max={todayISO()} value={duplicateFrom} onChange={(e) => setDuplicateFrom(e.target.value)} />
          </div>
          <p className="text-faint" style={{ fontSize: 12 }}>This adds all cardio sessions and strength exercises from that date onto {fmtDateLong(date)}.</p>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setShowDuplicate(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={duplicateWorkout}>Copy workout</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
