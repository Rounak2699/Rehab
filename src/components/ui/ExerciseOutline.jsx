function person(name, target, x) {
  const seated = name === "Knee extension" || name === "Cycling";
  const lying = name === "Straight leg raise";
  const headY = seated ? 21 : 18;
  const shoulder = seated ? [x, 42] : [x, 40];
  const hip = seated ? [x, 77] : [x, 76];
  let arms = [
    [[x, shoulder[1]], [x - 12, 54], [x - 10, 69]],
    [[x, shoulder[1]], [x + 12, 54], [x + 10, 69]],
  ];
  let legs = [
    [[x, hip[1]], [x - 8, seated ? 87 : 104], [x - 8, seated ? 113 : 132]],
    [[x, hip[1]], [x + 8, seated ? 87 : 104], [x + 8, seated ? 113 : 132]],
  ];

  if (lying) {
    legs = [
      [[x, 82], [x + 20, 84], [x + 40, 84]],
      [[x, 82], [x + 16, target ? 65 : 84], [x + 38, target ? 40 : 84]],
    ];
    return {
      head: [x - 30, 82],
      shoulder: [x - 16, 82],
      hip: [x + 2, 82],
      arms: [[[x - 17, 84], [x - 5, 99], [x + 7, 99]]],
      legs,
      lying: true,
    };
  }

  if (name === "Shoulder raise" && target) {
    arms = [
      [[x - 5, shoulder[1]], [x - 18, 28], [x - 24, 10]],
      [[x + 5, shoulder[1]], [x + 18, 28], [x + 24, 10]],
    ];
  } else if (name === "Elbow flexion" && target) {
    arms[1] = [[x + 5, shoulder[1]], [x + 20, 56], [x + 8, 47]];
  } else if (name === "Knee bend" && target) {
    legs[1] = [[x + 3, hip[1]], [x + 21, 91], [x + 20, 119]];
  } else if (name === "Running" && target) {
    legs[1] = [[x + 3, hip[1]], [x + 19, 81], [x + 33, 104]];
    legs[0] = [[x - 3, hip[1]], [x - 18, 100], [x - 31, 116]];
    arms[0] = [[x - 4, shoulder[1]], [x - 17, 50], [x - 18, 65]];
  } else if (name === "Calf stretch" && target) {
    legs[1] = [[x + 3, hip[1]], [x + 18, 103], [x + 31, 130]];
  } else if (name === "Hamstring stretch" && target) {
    return {
      head: [x + 13, 35],
      shoulder: [x + 7, 47],
      hip: [x - 2, 78],
      arms: [
        [[x + 5, 48], [x + 18, 59], [x + 31, 67]],
        [[x + 9, 48], [x + 20, 60], [x + 32, 67]],
      ],
      legs: [
        [[x - 2, 78], [x - 13, 105], [x - 13, 132]],
        [[x + 1, 78], [x + 20, 91], [x + 38, 109]],
      ],
      leaning: true,
    };
  } else if (name === "Quadriceps stretch" && target) {
    legs[1] = [[x + 3, hip[1]], [x + 19, 92], [x + 3, 101]];
    arms[1] = [[x + 4, shoulder[1]], [x + 22, 55], [x + 3, 101]];
  } else if (name === "Knee extension" && target) {
    legs[0] = [[x - 3, hip[1]], [x - 8, 102], [x - 28, 102]];
    legs[1] = [[x + 3, hip[1]], [x + 8, 102], [x + 29, 102]];
  } else if (name === "Cycling" && target) {
    legs[0] = [[x - 3, hip[1]], [x - 18, 91], [x + 2, 107]];
    legs[1] = [[x + 3, hip[1]], [x + 18, 92], [x - 2, 108]];
    arms[1] = [[x + 4, shoulder[1]], [x + 20, 52], [x + 18, 65]];
  }

  return {
    head: [name === "Hamstring stretch" && target ? x + 13 : x, headY],
    shoulder,
    hip,
    arms,
    legs,
    seated,
    leaning: name === "Hamstring stretch" && target,
  };
}

function limb(points, className) {
  const coordinates = points.map((point) => point.join(",")).join(" ");
  return <polyline className={className} points={coordinates} />;
}

function Figure({ pose, className = "" }) {
  const { head, shoulder, hip, arms, legs, seated, lying, leaning } = pose;
  const trunk = lying
    ? `M${shoulder[0] - 4} ${shoulder[1] - 7} Q${hip[0] - 1} ${hip[1] - 9} ${hip[0] + 10} ${hip[1] - 7} L${hip[0] + 11} ${hip[1] + 7} Q${shoulder[0]} ${shoulder[1] + 7} ${shoulder[0] - 4} ${shoulder[1] + 7}Z`
    : `M${shoulder[0] - 8} ${shoulder[1] - 2} Q${shoulder[0]} ${shoulder[1] - 7} ${shoulder[0] + 8} ${shoulder[1] - 2} L${hip[0] + 11} ${hip[1] - 2} Q${hip[0]} ${hip[1] + 9} ${hip[0] - 11} ${hip[1] - 2}Z`;

  return (
    <g className={`human-figure ${className}`}>
      <path className="figure-torso" d={trunk} />
      <path className="figure-neck" d={`M${head[0] - 4} ${head[1] + 7} L${head[0] - 4} ${shoulder[1] + 1} L${head[0] + 4} ${shoulder[1] + 1} L${head[0] + 4} ${head[1] + 7}Z`} />
      {!lying && <ellipse className="figure-pelvis" cx={hip[0]} cy={hip[1] - 2} rx="11" ry="8" />}
      <circle className="figure-head" cx={head[0]} cy={head[1]} r="8" />
      {arms.map((arm, index) => (
        <g key={`arm-${index}`}>
          {limb(arm, "figure-upper-arm")}
          {limb(arm.slice(1), "figure-lower-arm")}
          <circle className="figure-hand" cx={arm[arm.length - 1][0]} cy={arm[arm.length - 1][1]} r="4" />
        </g>
      ))}
      {legs.map((leg, index) => (
        <g key={`leg-${index}`}>
          {limb(leg, "figure-thigh")}
          {limb(leg.slice(1), "figure-calf")}
          <path
            className="figure-foot"
            d={`M${leg[2][0]} ${leg[2][1]} l${leg[2][0] >= hip[0] ? 8 : -8} 1`}
          />
        </g>
      ))}
      {seated && <path className="figure-seat" d={`M${hip[0] - 18} 86H${hip[0] + 17}M${hip[0] - 17} 86V119`} />}
      {leaning && <path className="figure-seat" d={`M${hip[0] - 17} 83V119M${hip[0] - 17} 83H${hip[0] + 9}`} />}
    </g>
  );
}

export default function ExerciseOutline({ exercise, compact = false, pose = "both", overlay = false, aligned = false }) {
  const showStart = pose === "start" || pose === "both";
  const showAction = pose === "action" || pose === "both";
  const startX = overlay ? 80 : 43;
  const actionX = overlay ? 80 : 116;
  const viewBox = overlay
    ? (exercise.name === "Straight leg raise" ? "28 22 104 100" : "40 4 80 140")
    : "0 0 160 145";

  return (
    <div className={`exercise-outline${compact ? " compact" : ""}${overlay ? " silhouette-overlay" : ""}${aligned ? " aligned" : ""}`}>
      <svg viewBox={viewBox} role="img" aria-label={`Human posture silhouette for ${exercise.name}`}>
        {showStart && <Figure pose={person(exercise.name, false, startX)} className="start-figure" />}
        {showAction && <Figure pose={person(exercise.name, true, actionX)} className="action-figure" />}
        {!compact && !overlay && (
          <g className="outline-labels">
            {showStart && <text x={startX} y="144" textAnchor="middle">Line up</text>}
            {showAction && <text x={actionX} y="144" textAnchor="middle">{showStart ? "Then move" : "Exercise pose"}</text>}
          </g>
        )}
      </svg>
    </div>
  );
}
