import { useMemo, useState } from "react";
import { Search, Star } from "lucide-react";

export default function ExercisePicker({ exercises, recentExercises = [], onSelect, onClose }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const active = exercises.filter((e) => !e.isArchived);
    if (!q) return active;
    return active.filter((e) => e.name.toLowerCase().includes(q) || e.primaryMuscleGroup.toLowerCase().includes(q));
  }, [exercises, search]);

  const favorites = filtered.filter((e) => e.isFavorite);
  const recentIds = new Set(recentExercises.map((r) => r.exerciseId));
  const recent = !search && recentExercises.length ? exercises.filter((e) => recentIds.has(e.id) && !e.isFavorite && !e.isArchived) : [];
  const favIds = new Set(favorites.map((e) => e.id));
  const recentIdSet = new Set(recent.map((e) => e.id));
  const rest = filtered.filter((e) => !favIds.has(e.id) && !recentIdSet.has(e.id));

  function Row({ e }) {
    return (
      <button type="button" className="list-row" style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left" }} onClick={() => onSelect(e)}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{e.name}</div>
          <div className="text-faint" style={{ fontSize: 12 }}>{e.primaryMuscleGroup}{e.category ? ` · ${e.category}` : ""}</div>
        </div>
        {e.isFavorite && <Star size={15} fill="var(--accent)" color="var(--accent)" />}
      </button>
    );
  }

  return (
    <div>
      <div className="field" style={{ position: "relative", marginBottom: 8 }}>
        <Search size={16} style={{ position: "absolute", left: 12, top: 12, color: "var(--text-faint)" }} />
        <input autoFocus placeholder="Search exercises..." style={{ paddingLeft: 36 }} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div style={{ maxHeight: 360, overflowY: "auto" }}>
        {favorites.length > 0 && (
          <>
            <div className="field-label" style={{ margin: "10px 0 2px" }}>Favorites</div>
            {favorites.map((e) => <Row key={e.id} e={e} />)}
          </>
        )}
        {recent.length > 0 && (
          <>
            <div className="field-label" style={{ margin: "10px 0 2px" }}>Recent</div>
            {recent.map((e) => <Row key={e.id} e={e} />)}
          </>
        )}
        {rest.length > 0 && (
          <>
            <div className="field-label" style={{ margin: "10px 0 2px" }}>All exercises</div>
            {rest.map((e) => <Row key={e.id} e={e} />)}
          </>
        )}
        {filtered.length === 0 && <p className="text-muted" style={{ fontSize: 13, textAlign: "center", padding: 20 }}>No exercises found.</p>}
      </div>
    </div>
  );
}
