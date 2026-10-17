import { useState } from "react";

const TOKEN_KEY = "smartcoworking_token";
const USER_KEY = "smartcoworking_user";

export default function WorkspaceBookingPanel({ workspace, workspaceId, availableCount }) {
  const [open, setOpen] = useState(false);
  const [teamSize, setTeamSize] = useState("1");
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  });
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");
  const [purpose, setPurpose] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    const token = localStorage.getItem(TOKEN_KEY);
    let user = null;

    try {
      user = JSON.parse(localStorage.getItem(USER_KEY) || "null");
    } catch {}

    if (!token || !user) {
      setError("Please sign in with your workspace user account first.");
      return;
    }

    if (user.role !== "user") {
      setError("Please sign out and sign in with a workspace user account. Owner accounts manage bookings.");
      return;
    }

    const id = workspaceId || workspace?._id;
    if (!id) {
      setError("Workspace ID is missing. Refresh the app and try again.");
      return;
    }

    const people = Number(teamSize);
    const durationHours =
      (Number(endTime.split(":")[0]) * 60 + Number(endTime.split(":")[1]) -
       Number(startTime.split(":")[0]) * 60 - Number(startTime.split(":")[1])) / 60;

    if (!Number.isInteger(people) || people < 1 || people > Number(workspace?.capacity || 0)) {
      setError(`Enter a team size between 1 and ${workspace?.capacity || 0}.`);
      return;
    }

    if (date < new Date().toLocaleDateString("en-CA")) {
      setError("Choose today or a future date.");
      return;
    }

    if (durationHours <= 0) {
      setError("End time must be later than start time.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${(import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "")}/api/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          workspaceId: id,
          teamSize: people,
          bookingDate: date,
          startTime,
          endTime,
          durationHours,
          purpose: purpose.trim(),
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.message || result.error || `Request failed (${response.status}).`);
      }

      setMessage(result.message || "Booking request submitted. Waiting for owner approval.");
      setPurpose("");
      setOpen(false);
    } catch (err) {
      setError(err.message || "Could not submit the booking.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel" style={{ marginTop: 20, padding: 24 }}>
      <h3>{workspace?.name || "Workspace details"}</h3>
      <p>{workspace?.address || "Address unavailable"}</p>
      <p>{workspace?.type || "Workspace"} · {workspace?.capacity ?? 0} seats</p>
      <p><strong>{workspace?.price ?? "Price unavailable"}{workspace?.period || ""}</strong></p>
      <p>Live availability: {typeof availableCount === "number" ? `${availableCount} seats available` : "Unavailable"}</p>

      {message && <p role="status">{message}</p>}
      {error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}

      {!open ? (
        <button type="button" onClick={() => { setError(""); setOpen(true); }}>
          Book This Workspace
        </button>
      ) : (
        <form onSubmit={submit}>
          <div style={{ display: "grid", gap: 12, maxWidth: 420 }}>
            <label>Team size
              <input type="number" min="1" max={workspace?.capacity || 1} required value={teamSize} onChange={e => setTeamSize(e.target.value)} />
            </label>
            <label>Booking date
              <input type="date" min={new Date().toLocaleDateString("en-CA")} required value={date} onChange={e => setDate(e.target.value)} />
            </label>
            <label>Start time
              <input type="time" required value={startTime} onChange={e => setStartTime(e.target.value)} />
            </label>
            <label>End time
              <input type="time" required value={endTime} onChange={e => setEndTime(e.target.value)} />
            </label>
            <label>Purpose (optional)
              <textarea rows="3" maxLength="500" value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="Meeting, team work, interview..." />
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" disabled={loading}>{loading ? "Submitting..." : "Submit Booking Request"}</button>
              <button type="button" disabled={loading} onClick={() => { setOpen(false); setError(""); }}>Cancel</button>
            </div>
          </div>
        </form>
      )}
    </section>
  );
}
