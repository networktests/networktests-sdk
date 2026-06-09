import { useEffect, useState } from "react";
import { useUdpTest } from "@networktests/sdk/react";
import type { UdpSession } from "@networktests/sdk";

const SESSION_ENDPOINT = "/my-backend/start-udp";

export default function App() {
  const [session, setSession] = useState<UdpSession | null>(null);
  const { run, isRunning, progress, result, error } = useUdpTest();

  useEffect(() => {
    fetch(SESSION_ENDPOINT)
      .then((r) => r.json())
      .then(setSession);
  }, []);

  if (!session) return <p>Loading session…</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div style={{ fontFamily: "system-ui", padding: 20 }}>
      <h1>Speed test</h1>
      <button onClick={() => run(session)} disabled={isRunning}>
        {isRunning ? "Running…" : "Start"}
      </button>
      {progress && (
        <p>
          {progress.packetsReceived}/{progress.packetsSent} packets
          ({progress.lossPercent}% loss, {progress.elapsedMs} ms elapsed)
        </p>
      )}
      {result && (
        <pre>{JSON.stringify(result, null, 2)}</pre>
      )}
    </div>
  );
}
