// Exercise library the doctor picks from. Move this to your backend when ready.
export const CATALOG = {
  Stretching: [
    { name: "Hamstring stretch", joint: "Hip", min: 60, max: 90 },
    { name: "Quadriceps stretch", joint: "Knee", min: 100, max: 130 },
    { name: "Calf stretch", joint: "Ankle", min: 10, max: 25 },
  ],
  Strengthening: [
    { name: "Straight leg raise", joint: "Hip", min: 30, max: 60 },
    { name: "Knee extension", joint: "Knee", min: 120, max: 170 },
    { name: "Shoulder raise", joint: "Shoulder", min: 80, max: 120 },
  ],
  "Range of motion": [
    { name: "Knee bend", joint: "Knee", min: 70, max: 110 },
    { name: "Elbow flexion", joint: "Elbow", min: 40, max: 130 },
  ],
  Cardio: [
    { name: "Running", joint: "Knee", min: 60, max: 120 },
    { name: "Cycling", joint: "Knee", min: 70, max: 110 },
  ],
};
