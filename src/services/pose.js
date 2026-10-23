import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const JOINTS = {
  hip: [[11, 23, 25], [12, 24, 26]],
  knee: [[23, 25, 27], [24, 26, 28]],
  ankle: [[25, 27, 31], [26, 28, 32]],
  shoulder: [[23, 11, 13], [24, 12, 14]],
  elbow: [[11, 13, 15], [12, 14, 16]],
};

function jointAngle(a, vertex, c) {
  const first = [a.x - vertex.x, a.y - vertex.y];
  const second = [c.x - vertex.x, c.y - vertex.y];
  const denominator = Math.hypot(...first) * Math.hypot(...second);
  if (!denominator) return null;
  const cosine = Math.max(-1, Math.min(1, (first[0] * second[0] + first[1] * second[1]) / denominator));
  return Math.round(Math.acos(cosine) * (180 / Math.PI));
}

function measurePose(landmarks, joint) {
  const candidates = JOINTS[joint.toLowerCase()];
  if (!candidates) return null;
  return candidates
    .map((indices) => {
      const points = indices.map((index) => landmarks[index]);
      if (points.some((point) => !point)) return null;
      const confidence = Math.min(...points.map((point) => point.visibility ?? point.presence ?? 0));
      return { angle: jointAngle(points[0], points[1], points[2]), confidence };
    })
    .filter((pose) => pose && pose.angle !== null)
    .sort((a, b) => b.confidence - a.confidence)[0] || null;
}

function checkAlignment(landmarks, exercise) {
  const keypoints = [0, 11, 12, 23, 24, 25, 26, 27, 28].map((index) => landmarks[index]);
  if (keypoints.some((point) => !point || (point.visibility ?? 0) < 0.45)) {
    return { aligned: false, score: 0, cue: "Step back until your head, hips and feet are visible." };
  }

  const centerX = (Math.min(...keypoints.map((point) => point.x)) + Math.max(...keypoints.map((point) => point.x))) / 2;
  const top = Math.min(...keypoints.map((point) => point.y));
  const bottom = Math.max(...keypoints.map((point) => point.y));
  const height = bottom - top;
  const width = Math.max(...keypoints.map((point) => point.x)) - Math.min(...keypoints.map((point) => point.x));
  const verticalCenter = (top + bottom) / 2;
  const horizontalExercise = exercise.name === "Straight leg raise";
  const centerOffset = Math.hypot(centerX - 0.5, verticalCenter - 0.5);
  const size = horizontalExercise ? width : height;
  const expectedSize = horizontalExercise ? 0.72 : 0.76;
  const score = Math.max(0, Math.min(1, 1 - centerOffset / 0.28)) *
    Math.max(0, Math.min(1, 1 - Math.abs(size - expectedSize) / 0.35));
  const centered = Math.abs(centerX - 0.5) < 0.12 && Math.abs(verticalCenter - 0.5) < 0.16;
  const rightSize = horizontalExercise ? width >= 0.5 && width <= 0.95 : height >= 0.58 && height <= 0.97;

  if (!centered) return { aligned: false, score, cue: "Move to the center and line up with the silhouette." };
  if (!rightSize) return { aligned: false, score, cue: "Step back or move closer until your silhouette fills the guide." };
  return { aligned: true, score, cue: "Hold still while we line up your starting posture." };
}

export function startPoseStream(video, exercise, onFrame, onStatus) {
  let stopped = false;
  let animationFrame = 0;
  let lastInference = 0;
  let wasInRange = false;
  let movementOrigin = null;
  let movementObserved = false;
  let lastRepAt = 0;
  let alignmentStartedAt = null;
  let landmarker;

  const stop = () => {
    stopped = true;
    cancelAnimationFrame(animationFrame);
    landmarker?.close();
  };

  const run = async () => {
    try {
      onStatus("Loading the on-device pose model…");
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      if (stopped) return;
      landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.55,
        minPosePresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
      });
      if (stopped) {
        landmarker.close();
        return;
      }
      onStatus("Pose model ready. Keep the target joint in view.");

      const detect = (now) => {
        if (stopped) return;
        animationFrame = requestAnimationFrame(detect);
        if (now - lastInference < 120 || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
        lastInference = now;
        const landmarks = landmarker.detectForVideo(video, now).landmarks[0];
        if (!landmarks) {
          wasInRange = false;
          alignmentStartedAt = null;
          onFrame({ angle: null, confidence: 0, alignment: 0, aligned: false, ready: false, cue: "Step into the frame so your full body is visible.", bad: true });
          return;
        }

        const alignment = checkAlignment(landmarks, exercise);
        if (!alignment.aligned) {
          wasInRange = false;
          alignmentStartedAt = null;
          onFrame({
            angle: null,
            confidence: 0,
            alignment: alignment.score,
            aligned: false,
            ready: false,
            cue: alignment.cue,
            bad: true,
          });
          return;
        }

        if (alignmentStartedAt === null) alignmentStartedAt = now;
        const ready = now - alignmentStartedAt >= 900;
        const measured = measurePose(landmarks, exercise.joint);
        if (!measured || measured.confidence < 0.4) {
          wasInRange = false;
          onFrame({
            angle: null,
            confidence: measured?.confidence || 0,
            alignment: alignment.score,
            aligned: true,
            ready,
            cue: "Keep the exercise joint visible to the camera.",
            bad: true,
          });
          return;
        }

        const { angle, confidence } = measured;
        const inRange = angle >= exercise.min && angle <= exercise.max;
        if (movementOrigin === null) movementOrigin = angle;
        if (Math.abs(angle - movementOrigin) >= 12) movementObserved = true;
        const cue = confidence < 0.65
          ? "Move closer or improve the lighting so your posture is visible."
          : angle < exercise.min
            ? "Move a little further into the prescribed range."
            : angle > exercise.max
              ? "Ease off; you are beyond the prescribed range."
              : "Good posture. Keep moving at a comfortable pace.";
        const rep = ready && inRange && !wasInRange && movementObserved && now - lastRepAt > 700
          ? { correct: confidence >= 0.65, issue: confidence >= 0.65 ? "" : "Posture not clearly visible" }
          : null;
        if (rep) {
          lastRepAt = now;
          movementOrigin = angle;
          movementObserved = false;
        }
        wasInRange = inRange;
        onFrame({ angle, confidence, alignment: alignment.score, aligned: true, ready, cue, bad: !inRange || confidence < 0.65, rep });
      };
      animationFrame = requestAnimationFrame(detect);
    } catch (error) {
      if (!stopped) onStatus(`Pose model unavailable: ${error.message}`);
    }
  };

  run();
  return stop;
}
