const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

export const TOKEN_KEY = "smartcoworking_token";
export const USER_KEY = "smartcoworking_user";

async function request(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);

  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });
  } catch (error) {
    console.error("API connection failed:", error);
    throw new Error(
      "Cannot connect to the backend. Ensure the server is running on port 5000."
    );
  }

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error(`The server returned an invalid response (${response.status}).`);
  }

  if (!response.ok || result.success === false) {
    if (response.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }

    throw new Error(
      result.message || `Request failed with status ${response.status}.`
    );
  }

  return result;
}


export const bookingApi = {
  login(credentials) {
    return request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
  },

  getOwnerBookings() {
    return request("/api/bookings/owner");
  },

  approveBooking(id) {
    return request(`/api/bookings/${encodeURIComponent(id)}/approve`, {
      method: "PATCH",
      body: JSON.stringify({}),
    });
  },

  rejectBooking(id, rejectionReason) {
    return request(`/api/bookings/${encodeURIComponent(id)}/reject`, {
      method: "PATCH",
      body: JSON.stringify({ rejectionReason }),
    });
  },

  // Notifications
  getNotifications() {
    return request("/api/notifications");
  },

  markNotificationAsRead(id) {
    return request(`/api/notifications/${encodeURIComponent(id)}/read`, {
      method: "PATCH",
      body: JSON.stringify({}),
    });
  },

  markAllNotificationsAsRead() {
    return request("/api/notifications/read-all", {
      method: "PATCH",
      body: JSON.stringify({}),
    });
  },

  deleteNotification(id) {
    return request(`/api/notifications/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },
};
