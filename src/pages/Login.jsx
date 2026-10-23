import { useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { getApiUrl, saveApiUrl } from "../services/api.js";
import { Capacitor } from "@capacitor/core";

export default function Login() {
  const { signIn } = useApp();
  const isNative = Capacitor.isNativePlatform();
  const [role, setRole] = useState("doctor");
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [apiUrl, setApiUrl] = useState(() => getApiUrl());
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [apiSaved, setApiSaved] = useState(Boolean(getApiUrl()));

  const saveServer = () => {
    setErr("");
    try {
      saveApiUrl(apiUrl);
      setApiUrl(getApiUrl());
      setApiSaved(true);
    } catch (error) {
      setApiSaved(false);
      setErr(error.message || "Enter a valid HTTPS API URL.");
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (isNative && !apiSaved) return setErr("Save your secure API URL before signing in.");
    try {
      await signIn(role, id, pw);
    } catch (error) {
      setErr(error.message);
    }
  };

  return (
    <div className="app" style={{ paddingTop: 40 }}>
      {isNative && (
        <div className="card">
          <h2>Connect to your server</h2>
          <p className="sub">Enter the HTTPS address of your deployed ReHabRep API. The address should end in /api.</p>
          <label htmlFor="api-url">Secure API URL</label>
          <input
            id="api-url"
            type="url"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            value={apiUrl}
            onChange={(event) => { setApiUrl(event.target.value); setApiSaved(false); }}
            placeholder="https://your-server.example/api"
          />
          <button className="btn ghost" style={{ marginTop: 10 }} type="button" onClick={saveServer}>
            {apiSaved ? "Server saved" : "Save server"}
          </button>
        </div>
      )}

      <div className="card">
        <h2>Select your role</h2>
        <p className="sub">Choose the profile you want to continue with.</p>
        <div className="role">
          {["patient", "doctor"].map((r) => (
            <button key={r} className={role === r ? "on" : ""} onClick={() => { setRole(r); setErr(""); }}>
              {r[0].toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <form className="card" onSubmit={submit}>
        <h2>{role === "doctor" ? "Doctor" : "Patient"} login</h2>
        <p className="sub">
          {role === "doctor"
            ? "Sign in to access patient records and exercise prescriptions."
            : "Sign in to see your exercises and start a session."}
        </p>
        <label htmlFor="uid">User ID</label>
        <input id="uid" value={id} onChange={(e) => setId(e.target.value)} placeholder="Enter your user ID" autoComplete="username" />
        <label htmlFor="pw">Password</label>
        <div className="pw">
          <input id="pw" type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Enter your password" autoComplete="current-password" />
          <button type="button" onClick={() => setShow(!show)}>{show ? "Hide" : "Show"}</button>
        </div>
        {err && <p className="err" role="alert">{err}</p>}
        <div style={{ height: 16 }} />
        <button className="btn" type="submit">Login</button>
        <p className="sub" style={{ marginTop: 12, fontSize: 12 }}>
          Demo doctor: doctor / doctor123. Demo patients: asha or ravi / patient123.
        </p>
      </form>
    </div>
  );
}
