import { useState } from "react";
import { api } from "../../services/api.js";
import { useApp } from "../../context/AppContext.jsx";
import Hero from "../../components/ui/Hero.jsx";

const EMPTY_FORM = { name: "", email: "", phone: "", note: "", password: "" };

export default function PatientRegistration({ onRegistered }) {
  const { refreshDb } = useApp();
  const [form, setForm] = useState(EMPTY_FORM);
  const [created, setCreated] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setError("");
    setCreated(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setCreated(null);
    setSaving(true);
    try {
      const patient = await api("/patients", {
        method: "POST",
        body: JSON.stringify(form),
      });
      await refreshDb();
      onRegistered(patient.id);
      setCreated(patient);
      setForm(EMPTY_FORM);
    } catch (requestError) {
      setError(requestError.message || "Patient registration could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Hero>Register a patient</Hero>
      <form className="card" onSubmit={submit}>
        <p className="sub">Create a patient account linked to your doctor profile. Their exercise progress will appear in your patient reports.</p>

        <label htmlFor="registration-name">Full name</label>
        <input
          id="registration-name"
          required
          minLength="2"
          maxLength="120"
          autoComplete="name"
          value={form.name}
          onChange={update("name")}
          placeholder="Patient full name"
        />

        <label htmlFor="registration-email">Email (optional)</label>
        <input
          id="registration-email"
          type="email"
          maxLength="254"
          autoComplete="email"
          value={form.email}
          onChange={update("email")}
          placeholder="patient@example.com"
        />

        <label htmlFor="registration-phone">Phone (optional)</label>
        <input
          id="registration-phone"
          type="tel"
          maxLength="30"
          autoComplete="tel"
          value={form.phone}
          onChange={update("phone")}
          placeholder="Phone number"
        />

        <label htmlFor="registration-note">Recovery notes (optional)</label>
        <input
          id="registration-note"
          maxLength="2000"
          value={form.note}
          onChange={update("note")}
          placeholder="Condition or recovery focus"
        />

        <label htmlFor="registration-password">Initial password</label>
        <input
          id="registration-password"
          type="password"
          required
          minLength="8"
          maxLength="256"
          autoComplete="new-password"
          value={form.password}
          onChange={update("password")}
          placeholder="At least 8 characters"
        />

        {error && <p className="err" role="alert">{error}</p>}
        {created && (
          <div className="registration-success" role="status">
            <strong>Patient registered.</strong>
            <span>Login ID: <b>{created.id}</b></span>
            <span>Share the login ID and initial password securely with {created.name}.</span>
          </div>
        )}
        <div style={{ height: 14 }} />
        <button className="btn" type="submit" disabled={saving}>
          {saving ? "Registering…" : "Register patient"}
        </button>
      </form>
    </>
  );
}
