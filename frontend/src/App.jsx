
import { useEffect, useMemo, useState } from "react";
import { bookingApi, TOKEN_KEY, USER_KEY } from "./api";
import { io } from "socket.io-client";
import {
  Activity,
  ArrowUpRight,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  LayoutDashboard,
  MapPin,
  Menu,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Users,
  Wifi,
  X,
  Check,
  Trash2,
  RefreshCw,
} from "lucide-react";
import "./App.css";
import WorkspaceBookingPanel from "./WorkspaceBookingPanel";
import BookingManager from "./BookingManager";

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

const WORKSPACE_ID = "6ac2342906386179cbd006ac";

const navigation = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Workspaces", icon: Building2 },
  { label: "Bookings", icon: CalendarDays },
  { label: "Availability", icon: Activity },
  { label: "Notifications", icon: Bell },
];

const workspace = {
  id: WORKSPACE_ID,
  name: "SmartHub Business Center",
  type: "Private cabin",
  address: "Baner Road, Pune, Maharashtra",
  capacity: 8,
  price: "₹18,000",
  period: "/ month",
};

function readSavedUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

function getInitials(name) {
  return (name || "Guest")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getNotificationTitle(notification) {
  if (notification.title) return notification.title;

  return (notification.type || "Notification")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getNotificationMessage(notification) {
  return (
    notification.message ||
    notification.description ||
    "There is an update to your workspace activity."
  );
}

function getNotificationId(notification) {
  return notification._id || notification.id;
}

function formatNotificationDate(dateValue) {
  if (!dateValue) return "";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function App() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [search, setSearch] = useState("");
  const [connected, setConnected] = useState(false);
  const [availability, setAvailability] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Notification state
  const [notifications, setNotifications] = useState([]);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationActionId, setNotificationActionId] = useState(null);
  const [notificationActionLoading, setNotificationActionLoading] =
    useState(false);

  // Profile and authentication state
  const [currentUser, setCurrentUser] = useState(readSavedUser);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showProfileLogin, setShowProfileLogin] = useState(false);
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePassword, setProfilePassword] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  // Load initial workspace availability
  useEffect(() => {
    let cancelled = false;

    async function loadAvailability() {
      try {
        const response = await fetch(
          `${API_URL}/api/availability/${WORKSPACE_ID}`
        );
        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.message || "Failed to load availability."
          );
        }

        if (!cancelled && result.success && result.data?.availability) {
          setAvailability(result.data.availability);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load availability:", error);
        }
      }
    }

    loadAvailability();

    return () => {
      cancelled = true;
    };
  }, []);

  // Real-time workspace monitoring
  useEffect(() => {
    const socket = io(API_URL, {
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("joinWorkspace", WORKSPACE_ID);
    });

    socket.on("availabilityUpdated", (data) => {
      if (data?.availability) {
        setAvailability(data.availability);
      }
    });

    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));

    return () => {
      socket.emit("leaveWorkspace", WORKSPACE_ID);
      socket.disconnect();
    };
  }, []);

  // Keep profile and notification state in sync with login changes
  useEffect(() => {
    function handleAuthChanged() {
      setCurrentUser(readSavedUser());

      if (localStorage.getItem(TOKEN_KEY)) {
        loadNotifications();
      } else {
        setNotifications([]);
        setUnreadCount(0);
        setNotificationError("");
      }
    }

    window.addEventListener("authChanged", handleAuthChanged);

    return () => {
      window.removeEventListener("authChanged", handleAuthChanged);
    };
  }, []);

  // Load notifications whenever the full Notifications page opens
  useEffect(() => {
    if (activePage === "Notifications") {
      loadNotifications();
    }
  }, [activePage]);

  const filteredWorkspace = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return true;

    return [
      workspace.name,
      workspace.type,
      workspace.address,
    ].some((value) => value.toLowerCase().includes(query));
  }, [search]);

  const availableCount = availability?.availableCapacity;
  const occupiedCount = availability?.occupiedCapacity;
  const totalCapacity =
    availability?.totalCapacity ?? workspace.capacity;

  const occupancyPercent =
    totalCapacity > 0 && occupiedCount != null
      ? Math.min(
          100,
          Math.round((occupiedCount / totalCapacity) * 100)
        )
      : 0;

  const pageDescriptions = {
    Dashboard: "Here's what's happening in your workspace today.",
    Workspaces: "Discover and manage your workspaces.",
    Bookings: "Track booking requests and reservations.",
    Availability: "Monitor workspace capacity in real time.",
    Notifications: "Stay updated on booking and workspace activity.",
    Settings: "Manage your workspace preferences.",
  };

  function selectPage(label) {
    setActivePage(label);
    setSidebarOpen(false);
    setShowNotifications(false);
    setProfileMenuOpen(false);
  }

  // Load saved notifications from the authenticated backend
  async function loadNotifications() {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setNotifications([]);
      setUnreadCount(0);
      setNotificationError("");
      return;
    }

    setNotificationLoading(true);
    setNotificationError("");

    try {
      const result = await bookingApi.getNotifications();
      const data = result?.data;

      setNotifications(
        Array.isArray(data?.notifications) ? data.notifications : []
      );
      setUnreadCount(Number(data?.unreadCount) || 0);
    } catch (error) {
      setNotificationError(
        error.message || "Failed to load notifications."
      );
    } finally {
      setNotificationLoading(false);
    }
  }

  // Mark one notification as read
  async function handleMarkNotificationRead(id) {
    if (!id) {
      setNotificationError("This notification has no valid ID.");
      return;
    }

    setNotificationActionId(id);
    setNotificationError("");

    try {
      await bookingApi.markNotificationAsRead(id);
      await loadNotifications();
    } catch (error) {
      setNotificationError(
        error.message || "Could not mark notification as read."
      );
    } finally {
      setNotificationActionId(null);
    }
  }

  // Mark all notifications as read
  async function handleMarkAllNotificationsRead() {
    setNotificationActionLoading(true);
    setNotificationError("");

    try {
      await bookingApi.markAllNotificationsAsRead();
      await loadNotifications();
    } catch (error) {
      setNotificationError(
        error.message || "Could not mark all notifications as read."
      );
    } finally {
      setNotificationActionLoading(false);
    }
  }

  // Delete one notification
  async function handleDeleteNotification(id) {
    if (!id) {
      setNotificationError("This notification has no valid ID.");
      return;
    }

    setNotificationActionId(id);
    setNotificationError("");

    try {
      await bookingApi.deleteNotification(id);
      await loadNotifications();
    } catch (error) {
      setNotificationError(
        error.message || "Could not delete notification."
      );
    } finally {
      setNotificationActionId(null);
    }
  }

  // Sign in using the backend login API
  async function handleProfileSignIn(event) {
    event.preventDefault();

    setProfileError("");
    setProfileLoading(true);

    try {
      const response = await bookingApi.login({
        email: profileEmail.trim(),
        password: profilePassword,
      });

      const payload = response?.data ?? response;
      const result = payload?.data ?? payload;

      const token =
        result?.token ??
        result?.accessToken ??
        payload?.token ??
        response?.token;

      const user =
        result?.user ??
        payload?.user ??
        response?.user ??
        null;

      if (!token) {
        throw new Error(
          "Login response did not contain an authentication token."
        );
      }

      localStorage.setItem(TOKEN_KEY, token);

      if (user) {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(USER_KEY);
      }

      setCurrentUser(user);
      setProfilePassword("");
      setProfileEmail("");
      setShowProfileLogin(false);
      setProfileMenuOpen(false);

      window.dispatchEvent(new Event("authChanged"));
    } catch (error) {
      setProfileError(
        error.message || "Sign in failed. Please try again."
      );
    } finally {
      setProfileLoading(false);
    }
  }

  function handleProfileSignOut() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);

    setCurrentUser(null);
    setNotifications([]);
    setUnreadCount(0);
    setProfilePassword("");
    setProfileEmail("");
    setProfileError("");
    setShowProfileLogin(false);
    setProfileMenuOpen(false);
    setShowNotifications(false);

    window.dispatchEvent(new Event("authChanged"));
  }

  const displayName = currentUser?.name || "Guest";
  const displayRole = currentUser?.role || "Not signed in";
  const avatarText = getInitials(displayName);

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <button
          className="mobile-overlay"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <Building2 size={23} strokeWidth={2.2} />
          </div>

          <div className="brand-copy">
            <span className="brand-name">Flexora</span>
            <span className="brand-subtitle">
              WORKSPACE MANAGEMENT
            </span>
          </div>

          <button
            className="icon-button sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={19} />
          </button>
        </div>

        <div className="workspace-switcher">
          <div className="switcher-icon">
            <Building2 size={18} />
          </div>

          <div className="switcher-copy">
            <span>Workspace</span>
            <strong>SmartHub Center</strong>
          </div>

          <ChevronDown size={16} className="muted-icon" />
        </div>

        <div className="nav-label">MENU</div>

        <nav className="navigation" aria-label="Main navigation">
          {navigation.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${
                activePage === label ? "nav-item-active" : ""
              }`}
              onClick={() => selectPage(label)}
            >
              <Icon size={19} strokeWidth={1.9} />
              <span>{label}</span>

              {label === "Notifications" && unreadCount > 0 && (
                <span className="notification-count nav-notification-count">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />

        <div className="help-card">
          <div className="help-icon">
            <Activity size={20} />
          </div>

          <strong>Workspace insights</strong>
          <p>
            Keep an eye on occupancy and booking activity in one place.
          </p>

          <button onClick={() => selectPage("Availability")}>
            View availability <ArrowUpRight size={15} />
          </button>
        </div>

        <button
          className={`nav-item settings-link ${
            activePage === "Settings" ? "nav-item-active" : ""
          }`}
          onClick={() => selectPage("Settings")}
        >
          <Settings size={19} />
          <span>Settings</span>
        </button>

        <div className="profile-area">
          <div className="profile">
            <div className="avatar">
              {getInitials(currentUser?.name || "WO")}
            </div>

            <div className="profile-copy">
              <strong>
                {currentUser?.name || "Workspace Owner"}
              </strong>
              <span>
                {currentUser?.role || "Administrator"}
              </span>
            </div>

            <button
              type="button"
              className="icon-button profile-menu"
              aria-label="Open profile menu"
              aria-expanded={profileMenuOpen}
              onClick={() => {
                setProfileMenuOpen((open) => !open);
                setShowProfileLogin(false);
                setProfileError("");
              }}
            >
              <ChevronDown
                size={17}
                style={{
                  transform: profileMenuOpen
                    ? "rotate(180deg)"
                    : "rotate(0deg)",
                  transition: "transform 0.2s ease",
                }}
              />
            </button>
          </div>

          {profileMenuOpen && (
            <div className="profile-dropdown">
              {currentUser ? (
                <>
                  <div className="profile-account-details">
                    <strong>
                      {currentUser.name || "Workspace Owner"}
                    </strong>
                    <span className="profile-email">
                      {currentUser.email || ""}
                    </span>
                    <span className="profile-role">
                      {currentUser.role || "user"}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="profile-action-button"
                    onClick={handleProfileSignOut}
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <strong>Workspace account</strong>

                  {!showProfileLogin ? (
                    <>
                      <span className="profile-email">
                        You are currently signed out.
                      </span>

                      <button
                        type="button"
                        className="profile-action-button"
                        onClick={() => {
                          setShowProfileLogin(true);
                          setProfileError("");
                        }}
                      >
                        Sign in
                      </button>
                    </>
                  ) : (
                    <form
                      className="profile-login-form"
                      onSubmit={handleProfileSignIn}
                    >
                      <label htmlFor="profile-email">Email</label>
                      <input
                        id="profile-email"
                        type="email"
                        value={profileEmail}
                        onChange={(event) =>
                          setProfileEmail(event.target.value)
                        }
                        placeholder="Enter your email"
                        autoComplete="username"
                        required
                      />

                      <label htmlFor="profile-password">
                        Password
                      </label>
                      <input
                        id="profile-password"
                        type="password"
                        value={profilePassword}
                        onChange={(event) =>
                          setProfilePassword(event.target.value)
                        }
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        required
                      />

                      {profileError && (
                        <p className="profile-error">{profileError}</p>
                      )}

                      <button
                        type="submit"
                        className="profile-action-button"
                        disabled={profileLoading}
                      >
                        {profileLoading ? "Signing in..." : "Sign in"}
                      </button>

                      <button
                        type="button"
                        className="profile-cancel-button"
                        onClick={() => {
                          setShowProfileLogin(false);
                          setProfilePassword("");
                          setProfileError("");
                        }}
                      >
                        Cancel
                      </button>
                    </form>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={22} />
            </button>

            <div className="breadcrumb">
              <span>Workspace</span>
              <span className="breadcrumb-divider">/</span>
              <strong>{activePage}</strong>
            </div>
          </div>

          <div className="topbar-actions">
            <div
              className={`connection-pill ${
                connected ? "connection-live" : ""
              }`}
            >
              <span className="connection-dot" />
              <span>
                {connected ? "Live connection" : "Connecting..."}
              </span>
            </div>

            <div className="notification-wrap">
              <button
                className="icon-button notification-button"
                aria-label="Notifications"
                aria-expanded={showNotifications}
                onClick={() => {
                  const willOpen = !showNotifications;

                  setShowNotifications(willOpen);
                  setProfileMenuOpen(false);

                  if (willOpen) {
                    loadNotifications();
                  }
                }}
              >
                <Bell size={20} />

                {unreadCount > 0 && (
                  <span className="notification-badge">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="notification-popover">
                  <div className="notification-popover-header">
                    <strong>Notifications</strong>

                    <button
                      type="button"
                      className="notification-refresh"
                      aria-label="Refresh notifications"
                      onClick={loadNotifications}
                      disabled={notificationLoading}
                    >
                      <RefreshCw
                        size={15}
                        className={notificationLoading ? "spin" : ""}
                      />
                    </button>
                  </div>

                  {unreadCount > 0 && (
                    <span className="notification-count">
                      {unreadCount} unread
                    </span>
                  )}

                  {notificationLoading ? (
                    <p>Loading notifications...</p>
                  ) : notificationError ? (
                    <p className="profile-error">
                      {notificationError}
                    </p>
                  ) : notifications.length === 0 ? (
                    <p>
                      {localStorage.getItem(TOKEN_KEY)
                        ? "No notifications yet."
                        : "Sign in to view your notifications."}
                    </p>
                  ) : (
                    <div className="notification-list">
                      {notifications.slice(0, 5).map((notification) => {
                        const id = getNotificationId(notification);

                        return (
                          <div
                            key={id}
                            className={`notification-item ${
                              notification.isRead ? "read" : "unread"
                            }`}
                          >
                            <div className="notification-item-content">
                              <strong>
                                {getNotificationTitle(notification)}
                              </strong>
                              <p>
                                {getNotificationMessage(notification)}
                              </p>
                              <small>
                                {formatNotificationDate(
                                  notification.createdAt
                                )}
                              </small>
                            </div>

                            <div className="notification-item-actions">
                              {notification.isRead ? (
                                <span
                                  className="notification-read-indicator"
                                  title="Already read"
                                  aria-label="Notification already read"
                                >
                                  <Check size={15} />
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  title="Mark as read"
                                  aria-label="Mark notification as read"
                                  disabled={notificationActionId === id}
                                  onClick={() =>
                                    handleMarkNotificationRead(id)
                                  }
                                >
                                  <Check size={15} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="notification-popover-actions">
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllNotificationsRead}
                        disabled={notificationActionLoading}
                      >
                        {notificationActionLoading
                          ? "Updating..."
                          : "Mark all read"}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => selectPage("Notifications")}
                    >
                      Open notification center
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="topbar-avatar">{avatarText}</div>
          </div>
        </header>

        <div className="page-content">
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-line" />
                WORKSPACE OVERVIEW
              </div>

              <h1>
                {activePage === "Dashboard"
                  ? `Good evening, ${
                      currentUser?.name?.split(" ")[0] || "Owner"
                    }`
                  : activePage}
              </h1>

              <p>
                {pageDescriptions[activePage] ||
                  "Manage your workspace from here."}
              </p>
            </div>

            <button
              className="primary-button"
              onClick={() => selectPage("Bookings")}
            >
              <Plus size={18} />
              <span>View bookings</span>
            </button>
          </section>

          {activePage === "Dashboard" && (
            <>
              <section className="welcome-banner">
                <div className="welcome-content">
                  <div className="welcome-tag">
                    <span className="welcome-tag-dot" />
                    YOUR WORKSPACE AT A GLANCE
                  </div>

                  <h2>
                    A better way to manage
                    <br />
                    your workspace.
                  </h2>

                  <p>
                    Monitor capacity, manage reservations, and keep
                    your space running smoothly.
                  </p>

                  <button
                    className="banner-button"
                    onClick={() => selectPage("Workspaces")}
                  >
                    Explore workspace <ArrowUpRight size={16} />
                  </button>
                </div>

                <div className="banner-graphic" aria-hidden="true">
                  <div className="graphic-orbit orbit-one" />
                  <div className="graphic-orbit orbit-two" />
                  <div className="graphic-orbit orbit-three" />

                  <div className="graphic-center">
                    <Building2 size={43} strokeWidth={1.35} />
                  </div>

                  <div className="graphic-float float-one">
                    <Users size={17} />
                  </div>
                  <div className="graphic-float float-two">
                    <Wifi size={17} />
                  </div>
                  <div className="graphic-float float-three">
                    <Activity size={17} />
                  </div>
                </div>

                <div className="banner-decoration" />
              </section>

              <section
                className="stats-grid"
                aria-label="Workspace statistics"
              >
                <article className="stat-card">
                  <div className="stat-top">
                    <span className="stat-icon stat-icon-violet">
                      <Building2 size={19} />
                    </span>
                    <span className="stat-label">TOTAL CAPACITY</span>
                  </div>

                  <div className="stat-value">
                    {totalCapacity}
                    <span className="stat-unit"> seats</span>
                  </div>

                  <div className="stat-foot">
                    <span className="stat-foot-neutral">
                      Registered workspace
                    </span>
                  </div>
                </article>

                <article className="stat-card">
                  <div className="stat-top">
                    <span className="stat-icon stat-icon-green">
                      <CheckCircle2 size={19} />
                    </span>
                    <span className="stat-label">AVAILABLE SEATS</span>
                  </div>

                  <div className="stat-value">
                    {availableCount ?? "—"}
                    {availableCount != null && (
                      <span className="stat-unit"> seats</span>
                    )}
                  </div>

                  <div className="stat-foot">
                    <span className="status-indicator" />
                    <span className="stat-foot-neutral">
                      {availableCount == null
                        ? "Waiting for live update"
                        : "Latest live update"}
                    </span>
                  </div>
                </article>

                <article className="stat-card">
                  <div className="stat-top">
                    <span className="stat-icon stat-icon-orange">
                      <Users size={19} />
                    </span>
                    <span className="stat-label">OCCUPIED SEATS</span>
                  </div>

                  <div className="stat-value">
                    {occupiedCount ?? "—"}
                    {occupiedCount != null && (
                      <span className="stat-unit"> seats</span>
                    )}
                  </div>

                  <div className="stat-foot">
                    <span className="stat-foot-neutral">
                      Real-time monitoring
                    </span>
                  </div>
                </article>

                <article className="stat-card">
                  <div className="stat-top">
                    <span className="stat-icon stat-icon-blue">
                      <Activity size={19} />
                    </span>
                    <span className="stat-label">OCCUPANCY RATE</span>
                  </div>

                  <div className="stat-value">
                    {occupiedCount == null
                      ? "—"
                      : `${occupancyPercent}%`}
                  </div>

                  <div className="mini-progress">
                    <span style={{ width: `${occupancyPercent}%` }} />
                  </div>

                  <div className="stat-foot">
                    <span className="stat-foot-neutral">
                      Based on latest update
                    </span>
                  </div>
                </article>
              </section>

              <section className="content-grid">
                <article className="panel workspace-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>My workspace</h3>
                      <p>Your registered workspace details</p>
                    </div>

                    <button
                      className="text-button"
                      onClick={() => selectPage("Workspaces")}
                    >
                      View details <ArrowUpRight size={15} />
                    </button>
                  </div>

                  <div className="workspace-visual">
                    <div className="building-illustration">
                      <div className="building-sun" />

                      <div className="building-shape building-back">
                        <div className="window-grid">
                          {Array.from({ length: 8 }, (_, index) => (
                            <span key={index} />
                          ))}
                        </div>
                      </div>

                      <div className="building-shape building-front">
                        <div className="front-door" />
                        <div className="front-windows">
                          <span />
                          <span />
                        </div>
                      </div>

                      <div className="building-ground" />

                      <div className="plant plant-left">
                        <i />
                        <i />
                        <i />
                      </div>

                      <div className="plant plant-right">
                        <i />
                        <i />
                        <i />
                      </div>
                    </div>

                    <span className="workspace-type-badge">
                      <Building2 size={13} /> {workspace.type}
                    </span>
                  </div>

                  <div className="workspace-details">
                    <div className="workspace-title-row">
                      <div>
                        <h4
                          onClick={() => selectPage("Workspaces")}
                          role="button"
                          tabIndex={0}
                          style={{ cursor: "pointer" }}
                          onKeyDown={(event) => {
                            if (
                              event.key === "Enter" ||
                              event.key === " "
                            ) {
                              event.preventDefault();
                              selectPage("Workspaces");
                            }
                          }}
                        >
                          {workspace.name}
                        </h4>

                        <div className="workspace-location">
                          <MapPin size={14} />
                          {workspace.address}
                        </div>
                      </div>

                      <span className="active-badge">
                        <span /> Active
                      </span>
                    </div>

                    <div className="workspace-meta">
                      <div>
                        <Users size={16} />
                        <span>Capacity</span>
                        <strong>{workspace.capacity} seats</strong>
                      </div>

                      <div>
                        <Clock3 size={16} />
                        <span>Pricing</span>
                        <strong>
                          {workspace.price}
                          <small>{workspace.period}</small>
                        </strong>
                      </div>
                    </div>

                    <button
                      className="workspace-action"
                      onClick={() => selectPage("Availability")}
                    >
                      Monitor live availability <ArrowUpRight size={16} />
                    </button>
                  </div>
                </article>

                <article className="panel availability-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Live availability</h3>
                      <p>Capacity monitoring</p>
                    </div>

                    <span
                      className={`live-badge ${
                        connected ? "live-badge-on" : ""
                      }`}
                    >
                      <span /> {connected ? "LIVE" : "OFFLINE"}
                    </span>
                  </div>

                  <div className="availability-summary">
                    <div className="availability-number">
                      <strong>{availableCount ?? "—"}</strong>
                      <span>Available seats</span>
                    </div>

                    <div
                      className="capacity-ring"
                      style={{ "--progress": `${occupancyPercent}%` }}
                    >
                      <div className="capacity-ring-inner">
                        <strong>
                          {occupiedCount == null
                            ? "—"
                            : `${occupancyPercent}%`}
                        </strong>
                        <span>occupied</span>
                      </div>
                    </div>
                  </div>

                  <div className="capacity-legend">
                    <div>
                      <span className="legend-dot legend-available" />
                      Available{" "}
                      <strong>{availableCount ?? "—"}</strong>
                    </div>

                    <div>
                      <span className="legend-dot legend-occupied" />
                      Occupied{" "}
                      <strong>{occupiedCount ?? "—"}</strong>
                    </div>
                  </div>

                  <div className="availability-note">
                    <Wifi size={17} />
                    <div>
                      <strong>
                        {connected
                          ? "Real-time connection active"
                          : "Waiting for connection"}
                      </strong>
                      <p>
                        {connected
                          ? "Connected to the monitoring server. Capacity refreshes when the server sends an update."
                          : "Check that the backend is running on port 5000."}
                      </p>
                    </div>
                  </div>

                  <button
                    className="workspace-action"
                    onClick={() => selectPage("Availability")}
                  >
                    Open monitoring <ArrowUpRight size={16} />
                  </button>
                </article>
              </section>

              <section className="panel bookings-panel">
                <div className="panel-heading bookings-heading">
                  <div>
                    <h3>Workspace activity</h3>
                    <p>
                      Find workspaces and review recent booking activity
                    </p>
                  </div>

                  <button
                    className="text-button"
                    onClick={() => selectPage("Bookings")}
                  >
                    All bookings <ArrowUpRight size={15} />
                  </button>
                </div>

                <div className="search-toolbar">
                  <div className="search-field">
                    <Search size={18} />

                    <input
                      type="search"
                      placeholder="Search workspace, location or type..."
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />

                    {search && (
                      <button
                        aria-label="Clear search"
                        onClick={() => setSearch("")}
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>

                  <button
                    className="filter-button"
                    onClick={() => selectPage("Workspaces")}
                  >
                    <SlidersHorizontal size={16} /> Filters
                  </button>
                </div>

                {filteredWorkspace ? (
                  <div className="activity-row">
                    <div className="activity-workspace-icon">
                      <Building2 size={19} />
                    </div>

                    <div className="activity-main">
                      <strong>{workspace.name}</strong>
                      <span>
                        <MapPin size={13} /> {workspace.address}
                      </span>
                    </div>

                    <span className="activity-type">
                      {workspace.type}
                    </span>

                    <span className="activity-capacity">
                      <Users size={15} /> {workspace.capacity} seats
                    </span>

                    <button
                      className="row-action"
                      aria-label="View workspace"
                      onClick={() => selectPage("Workspaces")}
                    >
                      <ArrowUpRight size={17} />
                    </button>
                  </div>
                ) : (
                  <div className="empty-state">
                    <Search size={25} />
                    <strong>No matching workspaces</strong>
                    <p>
                      Try another name, location, or workspace type.
                    </p>

                    <button
                      className="text-button"
                      onClick={() => setSearch("")}
                    >
                      Clear search
                    </button>
                  </div>
                )}
              </section>
            </>
          )}

          {activePage === "Bookings" ? (
            <BookingManager />
          ) : activePage !== "Dashboard" ? (
            <section className="panel section-placeholder">
              <div className="placeholder-icon">
                {activePage === "Workspaces" && <Building2 size={28} />}
                {activePage === "Availability" && <Activity size={28} />}
                {activePage === "Notifications" && <Bell size={28} />}
                {activePage === "Settings" && <Settings size={28} />}
              </div>

              <h2>{activePage}</h2>
              <p>{pageDescriptions[activePage]}</p>

              {activePage === "Workspaces" && (
                <WorkspaceBookingPanel
                  workspace={workspace}
                  workspaceId={WORKSPACE_ID}
                  availableCount={availableCount}
                />
              )}

              {activePage === "Availability" && (
                <div className="placeholder-workspace">
                  <strong>
                    Socket.IO: {connected ? "Connected" : "Disconnected"}
                  </strong>

                  <span>Workspace ID: {WORKSPACE_ID}</span>

                  <span>
                    {availability
                      ? `${availableCount ?? "—"} available · ${
                          occupiedCount ?? "—"
                        } occupied · ${totalCapacity} total`
                      : "Waiting for an availabilityUpdated event from the backend."}
                  </span>
                </div>
              )}

              {activePage === "Notifications" && (
                <div className="notification-center">
                  <div className="notification-center-toolbar">
                    <div>
                      <strong>Notification center</strong>
                      <p>
                        {unreadCount} unread{" "}
                        {unreadCount === 1
                          ? "notification"
                          : "notifications"}
                      </p>
                    </div>

                    <div className="notification-center-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={loadNotifications}
                        disabled={notificationLoading}
                      >
                        <RefreshCw
                          size={16}
                          className={notificationLoading ? "spin" : ""}
                        />
                        Refresh
                      </button>

                      {unreadCount > 0 && (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={handleMarkAllNotificationsRead}
                          disabled={notificationActionLoading}
                        >
                          <Check size={16} />
                          {notificationActionLoading
                            ? "Updating..."
                            : "Mark all read"}
                        </button>
                      )}
                    </div>
                  </div>

                  {notificationError && (
                    <div className="notification-error" role="alert">
                      {notificationError}
                    </div>
                  )}

                  {!localStorage.getItem(TOKEN_KEY) ? (
                    <div className="notification-empty">
                      <Bell size={32} />
                      <strong>Sign in to view notifications</strong>
                      <p>
                        Use the profile menu to sign in to your workspace
                        account and retrieve your notifications.
                      </p>
                    </div>
                  ) : notificationLoading && notifications.length === 0 ? (
                    <div className="notification-empty">
                      <RefreshCw size={28} className="spin" />
                      <strong>Loading notifications...</strong>
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="notification-empty">
                      <Bell size={32} />
                      <strong>You're all caught up</strong>
                      <p>
                        New booking and workspace updates will appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="notification-center-list">
                      {notifications.map((notification) => {
                        const id = getNotificationId(notification);
                        const isBusy = notificationActionId === id;

                        return (
                          <article
                            key={id}
                            className={`notification-center-item ${
                              notification.isRead ? "read" : "unread"
                            }`}
                          >
                            <div className="notification-center-icon">
                              <Bell size={19} />
                            </div>

                            <div className="notification-center-content">
                              <div className="notification-center-title-row">
                                <strong>
                                  {getNotificationTitle(notification)}
                                </strong>

                                {notification.isRead ? (
                                  <span className="read-label">
                                    <Check size={13} />
                                    Read
                                  </span>
                                ) : (
                                  <span className="unread-label">
                                    Unread
                                  </span>
                                )}
                              </div>

                              <p>
                                {getNotificationMessage(notification)}
                              </p>

                              {notification.createdAt && (
                                <small>
                                  {formatNotificationDate(
                                    notification.createdAt
                                  )}
                                </small>
                              )}
                            </div>

                            <div className="notification-center-item-actions">
                              {!notification.isRead && (
                                <button
                                  type="button"
                                  className="secondary-button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    handleMarkNotificationRead(id)
                                  }
                                  title="Mark as read"
                                >
                                  <Check size={16} />
                                  <span>Mark read</span>
                                </button>
                              )}

                              <button
                                type="button"
                                className="notification-delete-button"
                                disabled={isBusy}
                                onClick={() =>
                                  handleDeleteNotification(id)
                                }
                                aria-label="Delete notification"
                                title="Delete notification"
                              >
                                <Trash2 size={17} />
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activePage === "Settings" && (
                <div className="placeholder-workspace">
                  <strong>Workspace preferences</strong>
                  <span>
                    Use the profile menu to sign in or sign out of your
                    workspace account.
                  </span>
                </div>
              )}

              <button
                className="primary-button"
                onClick={() => selectPage("Dashboard")}
              >
                <LayoutDashboard size={17} /> Back to dashboard
              </button>
            </section>
          ) : null}

          <footer className="page-footer">
            <span>© 2026 Flexora Workspace Management</span>

            <span>
              <span
                className={`footer-status ${
                  connected ? "footer-status-live" : ""
                }`}
              />{" "}
              {connected
                ? "Monitoring service connected"
                : "Monitoring service reconnecting"}
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default App;
