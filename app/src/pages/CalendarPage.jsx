import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api.js";
import { todayISO } from "../lib/dates.js";
import { fmtDuration, fmtCalories, round } from "../lib/units.js";
import Spinner from "../components/Spinner.jsx";

const DAY_TYPE_COLOR = { workout: "var(--accent)", cardio_only: "var(--cardio)", strength_only: "var(--strength)", rest: "var(--text-faint)" };
const DAY_TYPE_LABEL = { workout: "Workout", cardio_only: "Cardio", strength_only: "Strength", rest: "Rest" };
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function CalendarPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [days, setDays] = useState({});
  const [loading, setLoading] = useState(true);

  const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, "0")}`;

  useEffect(() => {
    setLoading(true);
    api.get(`/daily-logs?start=${start}&end=${end}`).then((d) => {
      const map = {};
      d.days.forEach((day) => (map[day.date] = day));
      setDays(map);
      setLoading(false);
    });
  }, [start, end]);

  const cells = useMemo(() => monthMatrix(year, month), [year, month]);

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); } else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); } else setMonth((m) => m + 1);
  }

  const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const monthTotals = useMemo(() => {
    const list = Object.values(days);
    return {
      workouts: list.filter((d) => d.dayType !== "rest").length,
      duration: list.reduce((a, d) => a + d.totals.totalDurationMinutes, 0),
      calories: list.reduce((a, d) => a + d.totals.totalCaloriesBurned, 0),
      volume: list.reduce((a, d) => a + d.totals.totalStrengthVolumeKg, 0),
    };
  }, [days]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Calendar</div>
          <div className="page-subtitle">Browse your workout history</div>
        </div>
        <div className="flex gap-8 items-center">
          <button className="icon-btn" onClick={prevMonth} aria-label="Previous month"><ChevronLeft size={20} /></button>
          <div style={{ fontWeight: 700, minWidth: 140, textAlign: "center" }}>{monthLabel}</div>
          <button className="icon-btn" onClick={nextMonth} aria-label="Next month"><ChevronRight size={20} /></button>
        </div>
      </div>

      <div className="grid grid-stats section">
        <div className="stat-tile"><div className="stat-tile-label">Active days</div><div className="stat-tile-value">{monthTotals.workouts}</div></div>
        <div className="stat-tile"><div className="stat-tile-label">Total time</div><div className="stat-tile-value">{fmtDuration(monthTotals.duration)}</div></div>
        <div className="stat-tile"><div className="stat-tile-label">Calories</div><div className="stat-tile-value">{fmtCalories(monthTotals.calories)}</div></div>
        <div className="stat-tile"><div className="stat-tile-label">Strength volume</div><div className="stat-tile-value">{round(monthTotals.volume)} kg</div></div>
      </div>

      <div className="card">
        {loading ? <Spinner page /> : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 8 }}>
              {WEEKDAYS.map((w) => <div key={w} className="text-faint" style={{ fontSize: 11, fontWeight: 700, textAlign: "center" }}>{w}</div>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
              {cells.map((d, i) => {
                if (!d) return <div key={i} />;
                const dateISO = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                const info = days[dateISO];
                const isToday = dateISO === todayISO();
                return (
                  <button
                    key={i}
                    onClick={() => navigate(`/log/${dateISO}`)}
                    style={{
                      aspectRatio: "1",
                      borderRadius: 10,
                      border: isToday ? "2px solid var(--accent)" : "1px solid var(--border)",
                      background: "var(--bg-subtle)",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 3,
                      padding: 2,
                      color: "var(--text)",
                    }}
                    title={info ? `${DAY_TYPE_LABEL[info.dayType]} · ${fmtDuration(info.totals.totalDurationMinutes)}` : "No data"}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{d}</span>
                    {info && info.dayType !== "rest" && (
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: DAY_TYPE_COLOR[info.dayType] }} />
                    )}
                    {info && info.dayType === "rest" && info.notes && (
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: DAY_TYPE_COLOR.rest }} />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-12" style={{ marginTop: 16, flexWrap: "wrap" }}>
              {Object.entries(DAY_TYPE_LABEL).map(([key, label]) => (
                <div key={key} className="flex items-center gap-8" style={{ fontSize: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: DAY_TYPE_COLOR[key] }} />
                  {label}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
