import { useEffect, useState } from "react";
import { Trophy, Scale, HeartPulse, Dumbbell } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api.js";
import { todayISO, addDaysISO } from "../lib/dates.js";
import { fmtWeight, fmtDistance, fmtDuration, fmtCalories, fmtPace, round, weightFromKg, distanceFromKm } from "../lib/units.js";
import TrendChart from "../components/charts/TrendChart.jsx";
import BarTrendChart from "../components/charts/BarTrendChart.jsx";
import Spinner from "../components/Spinner.jsx";
import EmptyState from "../components/EmptyState.jsx";

const BUCKET_RANGE = { day: 30, week: 84, month: 365 };

export default function Progress() {
  const { user } = useAuth();
  const weightUnit = user.defaultWeightUnit;
  const distanceUnit = user.defaultDistanceUnit;

  const [loading, setLoading] = useState(true);
  const [bodyWeight, setBodyWeight] = useState(null);
  const [bucket, setBucket] = useState("week");
  const [calories, setCalories] = useState([]);
  const [duration, setDuration] = useState([]);
  const [cardio, setCardio] = useState(null);
  const [strengthVolume, setStrengthVolume] = useState([]);
  const [records, setRecords] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [exerciseId, setExerciseId] = useState("");
  const [exerciseHistory, setExerciseHistory] = useState(null);

  useEffect(() => {
    const today = todayISO();
    Promise.all([
      api.get(`/progress/body-weight?end=${today}`),
      api.get(`/progress/cardio?start=${addDaysISO(today, -90)}&end=${today}`),
      api.get(`/progress/strength-volume?weeks=12`),
      api.get(`/progress/records`),
      api.get(`/exercises`),
    ]).then(([bw, c, sv, rec, ex]) => {
      setBodyWeight(bw);
      setCardio(c);
      setStrengthVolume(sv.series);
      setRecords(rec);
      setExercises(ex.exercises);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const today = todayISO();
    const start = addDaysISO(today, -BUCKET_RANGE[bucket]);
    Promise.all([
      api.get(`/progress/calories?start=${start}&end=${today}&bucket=${bucket}`),
      api.get(`/progress/duration?start=${start}&end=${today}&bucket=${bucket}`),
    ]).then(([cal, dur]) => {
      setCalories(cal.series);
      setDuration(dur.series);
    });
  }, [bucket]);

  useEffect(() => {
    if (!exerciseId) return setExerciseHistory(null);
    api.get(`/progress/exercise/${exerciseId}`).then(setExerciseHistory);
  }, [exerciseId]);

  if (loading) return <Spinner page />;

  const bucketFormatX = (v) => (bucket === "day" ? v?.slice(5) : bucket === "week" ? `Wk ${v?.slice(5)}` : v?.slice(0, 7));
  const exerciseChartData = exerciseHistory?.history.map((h) => ({ date: h.date, volume: round(weightFromKg(h.totalVolumeKg, weightUnit)), oneRm: h.estimated1RMKg != null ? round(weightFromKg(h.estimated1RMKg, weightUnit)) : null }));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Progress</div>
          <div className="page-subtitle">Trends, records, and exercise history</div>
        </div>
      </div>

      <div className="section card">
        <div className="flex justify-between items-center" style={{ marginBottom: 4 }}>
          <div className="card-title" style={{ marginBottom: 0, display: "flex", alignItems: "center", gap: 8 }}><Scale size={16} /> Body weight & BMI</div>
        </div>
        {bodyWeight.series.length === 0 ? (
          <EmptyState icon={Scale} title="No body weight logged yet" message="Log your weight from the Log Workout page or your Profile." />
        ) : (
          <>
            <div className="grid grid-stats" style={{ marginBottom: 16 }}>
              <MiniStat label="Current" value={fmtWeight(bodyWeight.currentWeightKg, weightUnit)} />
              <MiniStat label="7-day change" value={bodyWeight.change7dKg != null ? fmtWeight(bodyWeight.change7dKg, weightUnit, 2) : "—"} />
              <MiniStat label="30-day change" value={bodyWeight.change30dKg != null ? fmtWeight(bodyWeight.change30dKg, weightUnit, 2) : "—"} />
              <MiniStat label="Since first log" value={bodyWeight.changeSinceFirstKg != null ? fmtWeight(bodyWeight.changeSinceFirstKg, weightUnit, 2) : "—"} />
              {bodyWeight.targetWeightKg != null && (
                <MiniStat label="To target" value={bodyWeight.progressTowardTargetKg != null ? fmtWeight(Math.abs(bodyWeight.progressTowardTargetKg), weightUnit, 2) : "—"} />
              )}
            </div>
            <div className="grid grid-2">
              <div>
                <div className="field-label" style={{ marginBottom: 6 }}>Weight trend</div>
                <TrendChart data={bodyWeight.series} xKey="date" yKey="bodyWeightKg" formatY={(v) => round(weightFromKg(v, weightUnit))} formatX={(d) => d?.slice(5)} />
              </div>
              <div>
                <div className="field-label" style={{ marginBottom: 6 }}>BMI trend</div>
                <TrendChart data={bodyWeight.series.filter((s) => s.bmi != null)} xKey="date" yKey="bmi" color="var(--success)" formatX={(d) => d?.slice(5)} />
              </div>
            </div>
            <p className="text-faint" style={{ fontSize: 11, marginTop: 10 }}>BMI is a general screening metric — it doesn't account for muscle mass or body composition.</p>
          </>
        )}
      </div>

      <div className="section card">
        <div className="flex justify-between items-center" style={{ marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Calories & workout duration</div>
          <div className="toggle-group">
            {["day", "week", "month"].map((b) => (
              <button key={b} className={`toggle-option${bucket === b ? " active" : ""}`} onClick={() => setBucket(b)}>{b[0].toUpperCase() + b.slice(1)}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-2">
          <div>
            <div className="field-label" style={{ marginBottom: 6 }}>Calories burned</div>
            <BarTrendChart data={calories} xKey="bucket" yKey="value" color="var(--warning)" formatX={bucketFormatX} formatY={(v) => Math.round(v)} />
          </div>
          <div>
            <div className="field-label" style={{ marginBottom: 6 }}>Workout duration (min)</div>
            <BarTrendChart data={duration} xKey="bucket" yKey="value" color="var(--accent)" formatX={bucketFormatX} formatY={(v) => Math.round(v)} />
          </div>
        </div>
      </div>

      <div className="section card">
        <div className="card-title flex items-center gap-8"><HeartPulse size={16} color="var(--cardio)" /> Cardio: distance, pace & heart rate</div>
        {!cardio || cardio.sessions.length === 0 ? (
          <EmptyState icon={HeartPulse} title="No cardio logged in the last 90 days" />
        ) : (
          <>
            <div className="grid grid-stats" style={{ marginBottom: 16 }}>
              <MiniStat label="Total distance" value={fmtDistance(cardio.totalDistanceKm, distanceUnit)} />
              <MiniStat label="Total time" value={fmtDuration(cardio.totalMinutes)} />
              <MiniStat label="Avg heart rate" value={cardio.averageHeartRate ? `${cardio.averageHeartRate} bpm` : "—"} />
              <MiniStat label="Max heart rate" value={cardio.maxHeartRate ? `${cardio.maxHeartRate} bpm` : "—"} />
            </div>
            <div className="grid grid-2">
              <div>
                <div className="field-label" style={{ marginBottom: 6 }}>Distance per session</div>
                <TrendChart
                  data={cardio.sessions.filter((s) => s.distanceKm != null).map((s) => ({ date: s.date, distance: round(distanceFromKm(s.distanceKm, distanceUnit), 2) }))}
                  xKey="date" yKey="distance" color="var(--cardio)" formatX={(d) => d?.slice(5)}
                />
              </div>
              <div>
                <div className="field-label" style={{ marginBottom: 6 }}>Average heart rate per session</div>
                <TrendChart
                  data={cardio.sessions.filter((s) => s.averageHeartRate != null).map((s) => ({ date: s.date, hr: s.averageHeartRate }))}
                  xKey="date" yKey="hr" color="var(--danger)" formatX={(d) => d?.slice(5)}
                />
              </div>
            </div>
          </>
        )}
      </div>

      <div className="section card">
        <div className="card-title flex items-center gap-8"><Dumbbell size={16} color="var(--strength)" /> Strength training volume by week</div>
        <BarTrendChart data={strengthVolume} xKey="weekStart" yKey="totalVolumeKg" color="var(--strength)" formatX={(d) => d?.slice(5)} formatY={(v) => round(weightFromKg(v, weightUnit))} />
      </div>

      <div className="section card">
        <div className="card-title">Exercise progress</div>
        <select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)} style={{ marginBottom: 14 }}>
          <option value="">Select an exercise...</option>
          {exercises.filter((e) => !e.isArchived).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        {exerciseHistory && (
          exerciseHistory.history.length === 0 ? (
            <EmptyState icon={Dumbbell} title="No history for this exercise yet" />
          ) : (
            <>
              <div className="grid grid-stats" style={{ marginBottom: 16 }}>
                <MiniStat label="Highest weight" value={fmtWeight(exerciseHistory.highestWeightKgEver, weightUnit)} />
                <MiniStat label="Best est. 1RM" value={fmtWeight(exerciseHistory.best1RMKgEver, weightUnit)} />
                <MiniStat label="Sessions logged" value={exerciseHistory.history.length} />
              </div>
              <div className="grid grid-2" style={{ marginBottom: 16 }}>
                <div>
                  <div className="field-label" style={{ marginBottom: 6 }}>Volume ({weightUnit}) over time</div>
                  <TrendChart data={exerciseChartData} xKey="date" yKey="volume" color="var(--strength)" formatX={(d) => d?.slice(5)} />
                </div>
                <div>
                  <div className="field-label" style={{ marginBottom: 6 }}>Estimated 1RM ({weightUnit}) over time</div>
                  <TrendChart data={exerciseChartData} xKey="date" yKey="oneRm" color="var(--accent)" formatX={(d) => d?.slice(5)} />
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "var(--text-muted)" }}>
                      <th style={{ padding: "6px 8px" }}>Date</th>
                      <th style={{ padding: "6px 8px" }}>Sets</th>
                      <th style={{ padding: "6px 8px" }}>Volume</th>
                      <th style={{ padding: "6px 8px" }}>Best 1RM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...exerciseHistory.history].reverse().map((h, i) => (
                      <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                        <td style={{ padding: "6px 8px" }}>{h.date}</td>
                        <td style={{ padding: "6px 8px" }}>{h.sets.map((s) => `${s.reps}×${round(weightFromKg(s.weightKg, weightUnit))}`).join(", ")}</td>
                        <td style={{ padding: "6px 8px" }}>{fmtWeight(h.totalVolumeKg, weightUnit)}</td>
                        <td style={{ padding: "6px 8px" }}>{h.estimated1RMKg != null ? fmtWeight(h.estimated1RMKg, weightUnit) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )
        )}
      </div>

      <div className="section card">
        <div className="card-title flex items-center gap-8"><Trophy size={16} color="var(--warning)" /> Personal records</div>
        {!records || (records.exerciseRecords.length === 0 && !records.longestRunKm) ? (
          <EmptyState icon={Trophy} title="No records yet" message="Keep logging workouts to start setting personal bests." />
        ) : (
          <>
            <div className="grid grid-stats" style={{ marginBottom: 16 }}>
              <MiniStat label="Longest run" value={records.longestRunKm ? fmtDistance(records.longestRunKm, distanceUnit) : "—"} />
              <MiniStat label="Fastest pace" value={fmtPace(records.fastestPaceSecondsPerUnit, distanceUnit)} />
              <MiniStat label="Longest workout" value={records.longestWorkoutMinutes ? fmtDuration(records.longestWorkoutMinutes) : "—"} />
              <MiniStat label="Highest weekly volume" value={records.highestWeeklyVolumeKg ? fmtWeight(records.highestWeeklyVolumeKg, weightUnit) : "—"} />
            </div>
            {records.exerciseRecords.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "var(--text-muted)" }}>
                      <th style={{ padding: "6px 8px" }}>Exercise</th>
                      <th style={{ padding: "6px 8px" }}>Highest weight</th>
                      <th style={{ padding: "6px 8px" }}>Best est. 1RM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.exerciseRecords.map((r) => (
                      <tr key={r.exerciseName} style={{ borderTop: "1px solid var(--border)" }}>
                        <td style={{ padding: "6px 8px", fontWeight: 600 }}>{r.exerciseName}</td>
                        <td style={{ padding: "6px 8px" }}>{fmtWeight(r.highestWeightKg, weightUnit)}</td>
                        <td style={{ padding: "6px 8px" }}>{fmtWeight(r.best1RMKg, weightUnit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="stat-tile">
      <div className="stat-tile-label">{label}</div>
      <div className="stat-tile-value" style={{ fontSize: 18 }}>{value}</div>
    </div>
  );
}
