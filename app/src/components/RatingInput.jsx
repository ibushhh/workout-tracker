export default function RatingInput({ label, value, onChange }) {
  return (
    <div className="field">
      <label>{label} {value != null && <span style={{ color: "var(--accent)" }}>({value}/10)</span>}</label>
      <div className="flex gap-8" style={{ flexWrap: "wrap" }}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            type="button"
            key={n}
            onClick={() => onChange(value === n ? null : n)}
            className={`chip${value === n ? " active" : ""}`}
            style={{ padding: "6px 10px", minWidth: 34, textAlign: "center", justifyContent: "center" }}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
