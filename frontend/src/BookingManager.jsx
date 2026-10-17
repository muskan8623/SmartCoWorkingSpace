
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  LogIn,
  Mail,
  RefreshCw,
  Users,
  XCircle,
} from "lucide-react";
import { bookingApi, TOKEN_KEY, USER_KEY } from "./api";
import "./BookingManager.css";

const FILTERS = ["All", "Pending", "Approved", "Rejected", "Cancelled"];

function formatDate(value) {
  if (!value) return "Date not provided";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getWorkspaceName(booking) {
  return typeof booking.workspace === "object"
    ? booking.workspace?.name || "Unknown workspace"
    : "Workspace";
}

function getCustomerName(booking) {
  return typeof booking.user === "object"
    ? booking.user?.name || "Unknown customer"
    : "Customer";
}

function normalizeStatus(status) {
  return String(status || "pending").toLowerCase();
}

function getErrorMessage(error) {
  return error instanceof Error
    ? error.message
    : "An unexpected error occurred.";
}

export default function BookingManager() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(false);
  const [submittingLogin, setSubmittingLogin] = useState(false);
  const [activeAction, setActiveAction] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadBookings = useCallback(async () => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setAuthenticated(false);
      setBookings([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await bookingApi.getOwnerBookings();
      const records = response?.data?.bookings;

      if (!Array.isArray(records)) {
        throw new Error(
          "The server response does not contain a valid bookings list."
        );
      }

      // Do not display protected data if the account was signed out
      // while the request was still running.
      if (!localStorage.getItem(TOKEN_KEY)) {
        setAuthenticated(false);
        setBookings([]);
        return;
      }

      setBookings(records);
      setAuthenticated(true);
    } catch (requestError) {
      setError(getErrorMessage(requestError));

      if (!localStorage.getItem(TOKEN_KEY)) {
        setAuthenticated(false);
        setBookings([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Synchronize the Bookings screen with the Profile dropdown.
  useEffect(() => {
    let disposed = false;

    const syncAuthentication = () => {
      if (disposed) return;

      if (localStorage.getItem(TOKEN_KEY)) {
        void loadBookings();
      } else {
        setAuthenticated(false);
        setBookings([]);
        setError("");
        setMessage("");
        setFilter("All");
        setActiveAction("");
        setLoading(false);
      }
    };

    syncAuthentication();
    window.addEventListener("authChanged", syncAuthentication);

    return () => {
      disposed = true;
      window.removeEventListener("authChanged", syncAuthentication);
    };
  }, [loadBookings]);

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setError("Enter your owner email and password.");
      return;
    }

    setSubmittingLogin(true);

    try {
      const response = await bookingApi.login({
        email: normalizedEmail,
        password,
      });

      const result = response?.data ?? response;
      const user = result?.user;
      const token = result?.token;

      if (!token || !user) {
        throw new Error(
          "The login response is missing the user or authentication token."
        );
      }

      if (user.role !== "owner") {
        throw new Error(
          "This account does not have the owner role. Sign in with your workspace owner account."
        );
      }

      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));

      setAuthenticated(true);
      setPassword("");
      setMessage("Owner authentication successful.");

      // Notify the rest of the app that authentication changed.
      window.dispatchEvent(new Event("authChanged"));

      await loadBookings();
    } catch (loginError) {
      setError(getErrorMessage(loginError));
    } finally {
      setSubmittingLogin(false);
    }
  }

  async function handleApprove(booking) {
    const id = booking._id || booking.id;

    if (!id) {
      setError("This booking has no valid ID.");
      return;
    }

    if (
      !window.confirm(
        `Approve the booking for ${getCustomerName(booking)}?`
      )
    ) {
      return;
    }

    setActiveAction(id);
    setError("");
    setMessage("");

    try {
      const response = await bookingApi.approveBooking(id);
      setMessage(response.message || "Booking approved successfully.");
      await loadBookings();
    } catch (actionError) {
      setError(getErrorMessage(actionError));
    } finally {
      setActiveAction("");
    }
  }

  async function handleReject(booking) {
    const id = booking._id || booking.id;

    if (!id) {
      setError("This booking has no valid ID.");
      return;
    }

    const rejectionReason = window.prompt(
      "Enter a reason for rejecting this booking:",
      "Rejected by workspace owner."
    );

    if (rejectionReason === null) return;

    if (!rejectionReason.trim()) {
      setError("Enter a rejection reason before continuing.");
      return;
    }

    setActiveAction(id);
    setError("");
    setMessage("");

    try {
      const response = await bookingApi.rejectBooking(
        id,
        rejectionReason.trim()
      );

      setMessage(response.message || "Booking rejected successfully.");
      await loadBookings();
    } catch (actionError) {
      setError(getErrorMessage(actionError));
    } finally {
      setActiveAction("");
    }
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);

    setAuthenticated(false);
    setBookings([]);
    setError("");
    setMessage("");
    setFilter("All");
    setActiveAction("");

    // Keep Profile and Bookings authentication in sync.
    window.dispatchEvent(new Event("authChanged"));
  }

  const filteredBookings = useMemo(() => {
    if (filter === "All") return bookings;

    return bookings.filter(
      (booking) =>
        normalizeStatus(booking.status) === filter.toLowerCase()
    );
  }, [bookings, filter]);

  const counts = useMemo(
    () =>
      bookings.reduce(
        (result, booking) => {
          const status = normalizeStatus(booking.status);
          result.total += 1;

          if (status === "pending") result.pending += 1;
          if (status === "approved") result.approved += 1;
          if (status === "rejected") result.rejected += 1;
          if (status === "cancelled") result.cancelled += 1;

          return result;
        },
        {
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          cancelled: 0,
        }
      ),
    [bookings]
  );

  if (!authenticated && !localStorage.getItem(TOKEN_KEY)) {
    return (
      <section className="panel booking-manager">
        <div className="booking-login">
          <div className="booking-login-icon">
            <CalendarDays size={28} />
          </div>

          <h2>Connect your bookings</h2>
          <p>
            Sign in with your workspace owner account to load and manage
            real booking requests.
          </p>

          <form className="booking-login-form" onSubmit={handleLogin}>
            <label htmlFor="booking-owner-email">Owner email</label>
            <div className="booking-input-wrap">
              <Mail size={17} />
              <input
                id="booking-owner-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="owner@example.com"
                required
              />
            </div>

            <label htmlFor="booking-owner-password">Password</label>
            <input
              id="booking-owner-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
            />

            {error && (
              <div
                className="booking-alert booking-alert-error"
                role="alert"
              >
                <AlertCircle size={17} />
                <span>{error}</span>
              </div>
            )}

            <button
              className="booking-primary-button"
              type="submit"
              disabled={submittingLogin}
            >
              <LogIn size={17} />
              {submittingLogin ? "Signing in..." : "Sign in as owner"}
            </button>
          </form>
        </div>
      </section>
    );
  }

  return (
    <section className="panel booking-manager">
      <div className="booking-toolbar">
        <div>
          <h2>Booking management</h2>
          <p>Review reservations and manage incoming requests.</p>
        </div>

        <div className="booking-toolbar-actions">
          <button
            type="button"
            className="booking-secondary-button"
            onClick={() => void loadBookings()}
            disabled={loading || Boolean(activeAction)}
          >
            <RefreshCw
              size={16}
              className={loading ? "booking-spinning" : ""}
            />
            Refresh
          </button>

          <button
            type="button"
            className="booking-secondary-button"
            onClick={handleLogout}
          >
            Sign out
          </button>
        </div>
      </div>

      {error && (
        <div className="booking-alert booking-alert-error" role="alert">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div className="booking-alert booking-alert-success" role="status">
          <CheckCircle2 size={17} />
          <span>{message}</span>
        </div>
      )}

      <div className="booking-stats">
        <article>
          <span>Total bookings</span>
          <strong>{counts.total}</strong>
        </article>
        <article>
          <span>Pending</span>
          <strong>{counts.pending}</strong>
        </article>
        <article>
          <span>Approved</span>
          <strong>{counts.approved}</strong>
        </article>
        <article>
          <span>Rejected</span>
          <strong>{counts.rejected}</strong>
        </article>
      </div>

      <div className="booking-filters" aria-label="Filter bookings">
        {FILTERS.map((item) => (
          <button
            type="button"
            key={item}
            className={filter === item ? "booking-filter-active" : ""}
            onClick={() => setFilter(item)}
          >
            {item}
            {item === "All" && <span>{counts.total}</span>}
            {item === "Pending" && <span>{counts.pending}</span>}
          </button>
        ))}
      </div>

      {loading && bookings.length === 0 ? (
        <div className="booking-state">
          <RefreshCw size={24} className="booking-spinning" />
          <strong>Loading bookings...</strong>
          <p>Retrieving reservations from your backend.</p>
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="booking-state">
          <CalendarDays size={30} />
          <strong>
            {bookings.length === 0
              ? "No bookings found"
              : `No ${filter.toLowerCase()} bookings`}
          </strong>
          <p>
            {bookings.length === 0
              ? "New booking requests will appear here when customers make reservations."
              : "Choose another status filter to view other bookings."}
          </p>
        </div>
      ) : (
        <div className="booking-list">
          {filteredBookings.map((booking) => {
            const id = booking._id || booking.id;
            const status = normalizeStatus(booking.status);
            const busy = activeAction === id;

            return (
              <article className="booking-card" key={id}>
                <div className="booking-card-header">
                  <div className="booking-card-icon">
                    <CalendarDays size={21} />
                  </div>

                  <div className="booking-card-title">
                    <h3>{getWorkspaceName(booking)}</h3>
                    <p>Booking ID: {id || "Unavailable"}</p>
                  </div>

                  <span className={`booking-status booking-status-${status}`}>
                    {status}
                  </span>
                </div>

                <div className="booking-details-grid">
                  <div>
                    <span>Customer</span>
                    <strong>{getCustomerName(booking)}</strong>
                    {typeof booking.user === "object" &&
                      booking.user?.email && (
                        <small>{booking.user.email}</small>
                      )}
                  </div>

                  <div>
                    <span>
                      <CalendarDays size={14} /> Booking date
                    </span>
                    <strong>{formatDate(booking.bookingDate)}</strong>
                  </div>

                  <div>
                    <span>
                      <Clock3 size={14} /> Time
                    </span>
                    <strong>
                      {booking.startTime || "—"} – {booking.endTime || "—"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      <Users size={14} /> Team size
                    </span>
                    <strong>{booking.teamSize ?? "—"} people</strong>
                  </div>

                  <div>
                    <span>Duration</span>
                    <strong>{booking.durationHours ?? "—"} hours</strong>
                  </div>
                </div>

                {booking.purpose && (
                  <div className="booking-purpose">
                    <span>Purpose</span>
                    <p>{booking.purpose}</p>
                  </div>
                )}

                {booking.ownerNote && (
                  <div className="booking-purpose">
                    <span>Owner note</span>
                    <p>{booking.ownerNote}</p>
                  </div>
                )}

                {booking.rejectionReason && (
                  <div className="booking-purpose">
                    <span>Rejection reason</span>
                    <p>{booking.rejectionReason}</p>
                  </div>
                )}

                {status === "pending" && (
                  <div className="booking-card-actions">
                    <button
                      type="button"
                      className="booking-approve-button"
                      onClick={() => void handleApprove(booking)}
                      disabled={Boolean(activeAction) || loading}
                    >
                      <CheckCircle2 size={16} />
                      {busy ? "Processing..." : "Approve booking"}
                    </button>

                    <button
                      type="button"
                      className="booking-reject-button"
                      onClick={() => void handleReject(booking)}
                      disabled={Boolean(activeAction) || loading}
                    >
                      <XCircle size={16} />
                      Reject
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
