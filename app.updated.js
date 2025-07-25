import axios from "axios";

export async function sendSensorData(batteryTemp, ambientTemp, deviceState) {
  try {
    const response = await axios.post(
      "https://thermosense-api.onrender.com/api/advice",
      {
        battery_temp: batteryTemp,
        ambient_temp: ambientTemp,
        device_state: deviceState.toLowerCase()
      },
      {
        headers: { "Content-Type": "application/json" }
      }
    );

    const result = response.data;

    // Update the DOM
    const adviceEl = document.getElementById("advice");
    const alertEl = document.getElementById("alert");
    const actionEl = document.getElementById("action");

    if (adviceEl) adviceEl.innerText = result.natural_language_tip;
    if (alertEl) alertEl.innerText = `Alert Level: ${result.alert_level}`;
    if (actionEl) actionEl.innerText = result.optional_action || "";

    return result;
  } catch (error) {
    console.error("Error from ThermoSense API:", error);

    const adviceEl = document.getElementById("advice");
    const alertEl = document.getElementById("alert");
    const actionEl = document.getElementById("action");

    if (adviceEl) adviceEl.innerText = "⚠️ Unable to fetch advice. Please try again later.";
    if (alertEl) alertEl.innerText = "Alert Level: error";
    if (actionEl) actionEl.innerText = "";

    return {
      predicted_health_impact: null,
      alert_level: "error",
      natural_language_tip: "⚠️ Unable to fetch advice. Please try again later.",
      optional_action: null
    };
  }
}

// Hook to window to call from HTML
window.submitSensorData = async function () {
  const battery = parseFloat(document.getElementById("battery_temp").value);
  const ambient = parseFloat(document.getElementById("ambient_temp").value);
  const state = document.getElementById("device_state").value;

  if (isNaN(battery) || isNaN(ambient) || !state) {
    alert("Please fill in all fields correctly.");
    return;
  }

  await sendSensorData(battery, ambient, state);
};
