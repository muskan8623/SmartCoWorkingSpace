import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = "http://localhost:5000";

const WORKSPACE_ID = "6ac2342906386179cbd006ac";

function SocketTest() {
  const [connected, setConnected] = useState(false);
  const [availability, setAvailability] = useState(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);

      setConnected(true);

      socket.emit("joinWorkspace", WORKSPACE_ID);
    });

    socket.on("availabilityUpdated", (data) => {
      console.log("Availability update received:", data);

      setAvailability(data.availability);
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");

      setConnected(false);
    });

    return () => {
      socket.emit("leaveWorkspace", WORKSPACE_ID);
      socket.disconnect();
    };
  }, []);

  return (
    <div style={{ padding: "40px", fontFamily: "Arial" }}>
      <h1>Smart Co-Working Space</h1>

      <h2>Real-Time Monitoring Test</h2>

      <p>
        Socket status:{" "}
        <strong>
          {connected ? "CONNECTED" : "DISCONNECTED"}
        </strong>
      </p>

      <p>
        Workspace ID: <strong>{WORKSPACE_ID}</strong>
      </p>

      {availability ? (
        <div>
          <p>
            Total Capacity:{" "}
            <strong>{availability.totalCapacity}</strong>
          </p>

          <p>
            Occupied:{" "}
            <strong>{availability.occupiedCapacity}</strong>
          </p>

          <p>
            Available:{" "}
            <strong>{availability.availableCapacity}</strong>
          </p>

          <p>
            Status:{" "}
            <strong>{availability.status}</strong>
          </p>
        </div>
      ) : (
        <p>Waiting for an availability update...</p>
      )}
    </div>
  );
}

export default SocketTest;