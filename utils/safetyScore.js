/**
 * Safety & Comfort Score Engine v3.0
 *
 * Dimensions:
 *   Speed        25%  — GPS speed vs safe limit
 *   Obstacle     20%  — IR proximity sensor
 *   Driving      25%  — MPU6050 rash driving detection
 *   Comfort      20%  — DHT22 cabin temp + humidity
 *   GPS Quality  10%  — Fix confidence
 *
 * Score bands:
 *   >= 7.0  GREEN  "Safe & Comfortable"
 *   >= 5.0  YELLOW "Moderate Concern"
 *   <  5.0  RED    "Unsafe Conditions"
 */

const WEIGHTS = {
  speed: 0.25,
  obstacle: 0.2,
  driving: 0.25,
  comfort: 0.2,
  gpsQuality: 0.1,
};

// Speed
function scoreSpeed(speedKmh) {
  if (speedKmh <= 0) return 10;
  if (speedKmh <= 40) return 10;
  if (speedKmh <= 60) return 10 - ((speedKmh - 40) / 20) * 4;
  if (speedKmh <= 80) return 6 - ((speedKmh - 60) / 20) * 4;
  return Math.max(0, 2 - ((speedKmh - 80) / 20) * 2);
}

// IR Obstacle
function scoreObstacle(distanceCm, obstacleDetected) {
  if (!obstacleDetected || distanceCm >= 60) return 10;
  if (distanceCm >= 40) return 7;
  if (distanceCm >= 20) return 4;
  return 1;
}

// MPU6050 Rash Driving
// Combines boolean rash flags + raw accel magnitude
// Each rash event subtracts from a base score of 10
function scoreDriving(telemetry) {
  const {
    rashHarshBrake = false,
    rashHarshAccel = false,
    rashHarshTurn = false,
    rashBump = false,
    accelMagnitude = 9.8, // at rest = 9.8 m/s² (gravity)
  } = telemetry;

  let score = 10;

  // Each rash event penalises the score
  if (rashHarshBrake) score -= 3.5; // Most dangerous
  if (rashHarshAccel) score -= 2.5;
  if (rashHarshTurn) score -= 3.0;
  if (rashBump) score -= 1.5; // Road condition, not driver's fault entirely

  // Extra penalty for extreme acceleration magnitude
  // Normal driving: 9.5–10.5 m/s² (just gravity)
  // Harsh event:    >13 m/s²
  const netAccel = Math.abs(accelMagnitude - 9.8);
  if (netAccel > 6) score -= 2;
  else if (netAccel > 3) score -= 1;

  return Math.max(0, Math.round(score * 10) / 10);
}

//DHT22 Comfort
function scoreComfort(temperature, humidity, dhtValid) {
  if (!dhtValid || temperature == null || humidity == null) return 7;

  let tempScore;
  if (temperature >= 18 && temperature <= 26) tempScore = 10;
  else if (temperature >= 15 && temperature < 18)
    tempScore = 10 - ((18 - temperature) / 3) * 3;
  else if (temperature > 26 && temperature <= 32)
    tempScore = 10 - ((temperature - 26) / 6) * 4;
  else if (temperature > 32 && temperature <= 38)
    tempScore = 6 - ((temperature - 32) / 6) * 4;
  else if (temperature < 15)
    tempScore = Math.max(1, 7 - ((15 - temperature) / 5) * 3);
  else tempScore = Math.max(0, 2 - ((temperature - 38) / 5) * 2);

  let humScore;
  if (humidity >= 30 && humidity <= 60) humScore = 10;
  else if (humidity >= 20 && humidity < 30)
    humScore = 10 - ((30 - humidity) / 10) * 2;
  else if (humidity > 60 && humidity <= 75)
    humScore = 10 - ((humidity - 60) / 15) * 3;
  else if (humidity > 75 && humidity <= 90)
    humScore = 7 - ((humidity - 75) / 15) * 4;
  else if (humidity < 20)
    humScore = Math.max(5, 8 - ((20 - humidity) / 10) * 2);
  else humScore = Math.max(1, 3 - ((humidity - 90) / 10) * 2);

  return Math.round(((tempScore + humScore) / 2) * 10) / 10;
}

//GPS Quality
function scoreGpsQuality(gpsFix, satellites, hdop) {
  if (!gpsFix) return 3;
  let score = 10;
  if (hdop > 5) score -= 4;
  else if (hdop > 2) score -= 2;
  else if (hdop > 1) score -= 1;
  if (satellites < 4) score -= 3;
  else if (satellites < 6) score -= 1;
  return Math.max(0, score);
}

//Main export
function computeSafetyScore(telemetry, speedHistory = []) {
  const {
    speed = 0,
    obstacleDistance = 80,
    obstacleDetected = false,
    temperature = null,
    humidity = null,
    dhtValid = false,
    gpsFix = true,
    satellites = 6,
    hdop = 1.0,
  } = telemetry;

  const subScores = {
    speed: Math.round(scoreSpeed(speed) * 10) / 10,
    obstacle:
      Math.round(scoreObstacle(obstacleDistance, obstacleDetected) * 10) / 10,
    driving: Math.round(scoreDriving(telemetry) * 10) / 10,
    comfort:
      Math.round(scoreComfort(temperature, humidity, dhtValid) * 10) / 10,
    gpsQuality: Math.round(scoreGpsQuality(gpsFix, satellites, hdop) * 10) / 10,
  };

  const raw =
    subScores.speed * WEIGHTS.speed +
    subScores.obstacle * WEIGHTS.obstacle +
    subScores.driving * WEIGHTS.driving +
    subScores.comfort * WEIGHTS.comfort +
    subScores.gpsQuality * WEIGHTS.gpsQuality;

  const score = Math.round(raw * 10) / 10;

  let band, label, color;
  if (score >= 7) {
    band = "green";
    label = "Safe & Comfortable";
    color = "#22c55e";
  } else if (score >= 5) {
    band = "yellow";
    label = "Moderate Concern";
    color = "#f59e0b";
  } else {
    band = "red";
    label = "Unsafe Conditions";
    color = "#ef4444";
  }

  // Human-readable flags — passengers see these, never raw sensor values
  const flags = [];
  if (subScores.speed < 6) flags.push("Bus is travelling at high speed");
  if (subScores.obstacle < 5) flags.push("Obstacle detected near bus");
  if (telemetry.rashHarshBrake) flags.push("Sudden braking detected");
  if (telemetry.rashHarshAccel) flags.push("Sudden acceleration detected");
  if (telemetry.rashHarshTurn) flags.push("Sharp turn detected");
  if (telemetry.rashBump) flags.push("Rough road or bump detected");
  if (!gpsFix) flags.push("GPS signal is weak");
  if (dhtValid && temperature > 32) flags.push("Cabin temperature is high");
  if (dhtValid && temperature < 15) flags.push("Cabin temperature is low");
  if (dhtValid && humidity > 75) flags.push("Cabin humidity is high");

  // Cabin status labels — no raw numbers
  const cabin = dhtValid
    ? {
        tempStatus:
          temperature > 32 ? "Hot" : temperature < 18 ? "Cold" : "Comfortable",
        humStatus: humidity > 75 ? "Humid" : humidity < 30 ? "Dry" : "Good",
      }
    : null;

  return {
    score,
    band,
    label,
    color,
    flags,
    subScores,
    cabin,
    timestamp: new Date().toISOString(),
  };
}

module.exports = { computeSafetyScore };
