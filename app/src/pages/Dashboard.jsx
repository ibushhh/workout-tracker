import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, Flame, HeartPulse, Dumbbell, Scale, Activity, Flame as StreakIcon, Bed, TrendingUp, PlusCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api.js";
import { fmtDuration, fmtCalories, fmtWeight, round } from "../lib/units.js";
import { todayISO, fmtDateLong } from "../lib/dates.js";
import Spinner from "../components/Spinner.jsx";
import TrendChart from "../components/charts/TrendChart.jsx";
import EmptyState from "../components/EmptyState.jsx";

const DAY_TYPE_LABEL = { workout: "Workout day", cardio_only: "Cardio day", strength_only: "Strength day", rest: "Rest day" };
const DAY_TYPE_BADGE = { workout: "badge-workout", cardio_only: "badge-cardio", strength_only: "badge-strength", rest: "badge-rest" };

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [weightSeries, setWeightSeries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = todayISO();
    Promise.all([
      api.get(`/progress/dashboard?date=${today}`),
      api.get(`/progress/body-weight?end=${today}`),
    ])
      .then(([dash, weight]) => {
        setData(dash);
        setWeightSeries(weight.series.slice(-30));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner page />;
  if (!data) return null;

  const weightUnit = user.defaultWeightUnit;
  const hasAnyData = data.today.dayType !== "rest" || weightSeries.length > 0 || data.week.workoutCount > 0;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}</div>
          <div className="page-subtitle">{fmtDateLong(todayISO())}</div>
        </div>
        <Link to="/log" className="btn btn-primary"><PlusCircle size={16} /> Log workout</Link>
      </div>

      {!hasAnyData && (
        <div className="card section">
          <EmptyState
            icon={Activity}
            title="No workouts logged yet"
            message="Log your first cardio session, strength workout, or rest day to start seeing your progress here."
            action={<Link to="/log" className="btn btn-primary">Log your first workout</Link>}
          />
        </div>
      )}

      <div className="section">
        <div className="section-title">
          Today
          <span className={`badge ${DAY_TYPE_BADGE[data.today.dayType]}`}>{DAY_TYPE_LABEL[data.today.dayType]}</span>
        </div>
        <div className="grid grid-stats">
          <StatTile icon={Clock} label="Workout time" value={fmtDuration(data.today.totalDurationMinutes)} color="var(--accent)" />
          <StatTile icon={Flame} label="Calories burned" value={fmtCalories(data.today.totalCaloriesBurned)} color="var(--warning)" />
          <StatTile icon={HeartPulse} label="Cardio time" value={fmtDuration(data.today.cardioMinutes)} color="var(--cardio)" />
          <StatTile icon={Dumbbell} label="Strength volume" value={`${round(data.today.strengthVolumeKg)} kg`} color="var(--strength)" />
        </div>
      </div>

      <div className="section">
        <div className="section-title">Body metrics</div>
        <div className="grid grid-stats">
          <StatTile icon={Scale} label="Body weight" value={data.currentWeightKg ? fmtWeight(data.currentWeightKg, weightUnit) : "—"} color="var(--accent)" />
          <StatTile icon={Activity} label="BMI" value={data.currentBmi ?? "—"} sub={data.bmiCategory || "Log your height to see BMI"} color="var(--success)" />
          <StatTile icon={StreakIcon} label="Current streak" value={`${data.currentStreakDays} day${data.currentStreakDays === 1 ? "" : "s"}`} color="var(--warning)" />
          <StatTile icon={Bed} label="Rest days this month" value={data.restDaysThisMonth} color="var(--text-muted)" />
        </div>
        {data.currentBmi != null && (
          <p className="text-faint" style={{ fontSize: 12, marginTop: 10 }}>
            BMI is a general screening metric based on height and weight — it doesn't account for muscle mass or body composition.
          </p>
        )}
      </div>

      <div className="section">
        <div className="section-title">This week</div>
        <div className="grid grid-stats">
          <StatTile icon={Dumbbell} label="Workouts" value={data.week.workoutCount} color="var(--accent)" />
          <StatTile icon={Clock} label="Total time" value={fmtDuration(data.week.totalDurationMinutes)} color="var(--cardio)" />
          <StatTile icon={Flame} label="Calories" value={fmtCalories(data.week.totalCaloriesBurned)} color="var(--warning)" />
          <StatTile icon={TrendingUp} label="Strength volume" value={`${round(data.week.totalStrengthVolumeKg)} kg`} color="var(--strength)" />
        </div>
      </div>

      <div className="card section">
        <div className="flex justify-between items-center" style={{ marginBottom: 4 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Body weight trend</div>
          <Link to="/progress" className="text-muted" style={{ fontSize: 13, fontWeight: 600 }}>View all →</Link>
        </div>
        <TrendChart
          data={weightSeries}
          xKey="date"
          yKey="bodyWeightKg"
          formatY={(v) => round(weightUnit === "lb" ? v * 2.20462 : v, 1)}
          formatX={(d) => d?.slice(5)}
        />
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="stat-tile">
      <div className="stat-tile-label"><Icon size={14} color={color} /> {label}</div>
      <div className="stat-tile-value">{value}</div>
      {sub && <div className="stat-tile-sub">{sub}</div>}
    </div>
  );
}
