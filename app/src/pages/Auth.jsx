import { useState } from "react";
import { Activity } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { ApiError } from "../lib/api.js";

export default function Auth() {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { login, register } = useAuth();
  const toast = useToast();

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(name, email, password);
        toast.success("Account created — welcome!");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="sidebar-brand-icon"><Activity size={19} /></span>
          Workout Tracker
        </div>
        <div className="card">
          <div className="toggle-group" style={{ width: "100%", marginBottom: 18 }}>
            <button type="button" className={`toggle-option${mode === "login" ? " active" : ""}`} style={{ flex: 1 }} onClick={() => setMode("login")}>Sign in</button>
            <button type="button" className={`toggle-option${mode === "register" ? " active" : ""}`} style={{ flex: 1 }} onClick={() => setMode("register")}>Create account</button>
          </div>
          <form onSubmit={submit}>
            {mode === "register" && (
              <div className="field">
                <label>Name</label>
                <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
              </div>
            )}
            <div className="field">
              <label>Email</label>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="field">
              <label>Password</label>
              <input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
            </div>
            {error && <p className="field-error" style={{ marginBottom: 12 }}>{error}</p>}
            <button className="btn btn-primary btn-block" disabled={busy} type="submit">
              {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
