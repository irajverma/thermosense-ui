import React, { useState, useEffect } from "react";
import axios from "axios";

function App() {
  const [batteryTemp, setBatteryTemp] = useState(30);
  const [ambientTemp, setAmbientTemp] = useState(25);
  const [deviceState, setDeviceState] = useState("idle");
  const [prediction, setPrediction] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [filteredSeverity, setFilteredSeverity] = useState("all");

  const submitForm = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post("https://thermosense-api.onrender.com/api/advice", {
        battery_temp: batteryTemp,
        ambient_temp: ambientTemp,
        device_state: deviceState
      });
      setPrediction(response.data);

      // Add alert to log if danger or warning
      if (["danger", "warning"].includes(response.data.alert_level)) {
        addAlert({
          timestamp: new Date().toLocaleString(),
          message: `Alert: ${response.data.alert_level.toUpperCase()} - ${response.data.natural_language_tip}`,
          severity: response.data.alert_level
        });
      }
    } catch (error) {
      console.error("Prediction error:", error);
    }
  };

  const addAlert = (alert) => {
    setAlerts((prevAlerts) => [...prevAlerts, alert]);
  };

  const triggerTestAlert = () => {
    addAlert({
      timestamp: new Date().toLocaleString(),
      message: "Test Critical Battery Alert triggered!",
      severity: "critical"
    });
  };

  const clearAlerts = () => setAlerts([]);
  const filteredAlerts = alerts.filter(alert => filteredSeverity === "all" || alert.severity === filteredSeverity);

  return (
    <div className="container">
      <h1>ThermoSense Dashboard</h1>
      <form onSubmit={submitForm}>
        <label>Battery Temperature (°C)</label>
        <input type="number" value={batteryTemp} onChange={(e) => setBatteryTemp(parseFloat(e.target.value))} step="0.1" />

        <label>Ambient Temperature (°C)</label>
        <input type="number" value={ambientTemp} onChange={(e) => setAmbientTemp(parseFloat(e.target.value))} step="0.1" />

        <label>Device State</label>
        <select value={deviceState} onChange={(e) => setDeviceState(e.target.value)}>
          <option value="charging">Charging</option>
          <option value="discharging">Discharging</option>
          <option value="idle">Idle</option>
        </select>

        <button type="submit">Submit</button>
      </form>

      {prediction && (
        <div className="output">
          <div id="alert">⚠️ Alert Level: {prediction.alert_level}</div>
          <div>📊 Battery Health Impact: {prediction.predicted_health_impact}</div>
          <div>🧠 Tip: {prediction.natural_language_tip}</div>
          {prediction.optional_action && <div id="action">🔧 Action: {prediction.optional_action}</div>}
        </div>
      )}

      <hr />
      <h2>Alert & Notification Center</h2>
      <button onClick={clearAlerts}>Clear All</button>
      <button onClick={triggerTestAlert}>Test Alert</button>
      <div style={{ marginTop: "10px" }}>
        <button onClick={() => setFilteredSeverity("all")}>All</button>
        <button onClick={() => setFilteredSeverity("critical")}>Critical</button>
        <button onClick={() => setFilteredSeverity("warning")}>Warning</button>
        <button onClick={() => setFilteredSeverity("info")}>Info</button>
      </div>
      <ul>
        {filteredAlerts.map((alert, idx) => (
          <li key={idx}>
            ✅ {alert.timestamp} - {alert.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
