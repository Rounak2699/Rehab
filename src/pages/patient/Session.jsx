import { useEffect, useRef, useState } from "react";
import { num } from "../../utils/report.js";
import { startPoseStream } from "../../services/pose.js";
import ExerciseOutline from "../../components/ui/ExerciseOutline.jsx";

export default function Session({ ex, onFinish, onBack, saveError = "" }) {
  const target = ex.sets * num(ex.amount);
  const [run, setRun] = useState(false);
  const [reps, setReps] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [angle, setAngle] = useState(null);
  const [cue, setCue] = useState("Stand back and line up with the human-shaped guide.");
  const [bad, setBad] = useState(false);
  const [voice, setVoice] = useState(true);
  const [camOk, setCamOk] = useState(null);
  const [issue, setIssue] = useState("");
  const [modelStatus, setModelStatus] = useState("");
  const [stage, setStage] = useState("aligning");
  const [alignment, setAlignment] = useState(0);
  const video = useRef(null);
  const stream = useRef(null);
  const angleStats = useRef({ min: Infinity, max: -Infinity });
  const voiceEnabled = useRef(voice);
  const lastSpokenCue = useRef("");

  useEffect(() => { voiceEnabled.current = voice; }, [voice]);

  useEffect(() => () => {
    stream.current?.getTracks().forEach((track) => track.stop());
    window.speechSynthesis?.cancel();
  }, []);

  const startCamera = async () => {
    setIssue("");
    setModelStatus("");
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "user" }, width: { ideal: 720 }, height: { ideal: 1280 } },
      });
      if (video.current) video.current.srcObject = stream.current;
      setCamOk(true);
      setStage("aligning");
      setRun(true);
    } catch (error) {
      setCamOk(false);
      setIssue(error.message || "Camera permission is required for the posture guide.");
    }
  };

  useEffect(() => {
    if (!run || !video.current) return;
    return startPoseStream(
      video.current,
      ex,
      (frame) => {
        setAlignment(frame.alignment || 0);
        setStage(frame.ready ? "action" : "aligning");
        if (frame.angle !== null) {
          setAngle(frame.angle);
          angleStats.current = {
            min: Math.min(angleStats.current.min, frame.angle),
            max: Math.max(angleStats.current.max, frame.angle),
          };
        }
        setCue(frame.cue);
        setBad(frame.bad);
        if (frame.cue !== lastSpokenCue.current) {
          lastSpokenCue.current = frame.cue;
          if (voiceEnabled.current && window.speechSynthesis) {
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(new SpeechSynthesisUtterance(frame.cue));
          }
        }
        if (frame.rep) {
          setReps((count) => count + 1);
          if (frame.rep.correct) setCorrect((count) => count + 1);
          else setIssue(frame.rep.issue);
        }
      },
      setModelStatus
    );
  }, [run, ex]);

  useEffect(() => {
    if (reps >= target && run) {
      setRun(false);
      setStage("complete");
      setCue("Session complete. Well done!");
      setBad(false);
    }
  }, [reps, run, target]);

  const done = reps >= target;
  const result = {
    reps,
    correct,
    target,
    issue,
    angleMin: Number.isFinite(angleStats.current.min) ? angleStats.current.min : null,
    angleMax: Number.isFinite(angleStats.current.max) ? angleStats.current.max : null,
  };

  return (
    <main className="session-app">
      <div className="session-camera">
        <video
          ref={video}
          autoPlay
          playsInline
          muted
          className="session-video"
          style={{ display: camOk ? "block" : "none" }}
        />
        <div className="session-shade" />

        <header className="session-header">
          <button className="session-icon-button" aria-label="Exit exercise" onClick={onBack}>←</button>
          <div className="session-title">
            <strong>{ex.name}</strong>
            <span>{ex.sets} sets · {ex.amount}</span>
          </div>
          <button className="session-voice-button" onClick={() => setVoice(!voice)}>
            {voice ? "Voice on" : "Voice off"}
          </button>
        </header>

        <div className="session-stage-badge">
          <span className={stage === "action" || stage === "complete" ? "stage-dot ready" : "stage-dot"} />
          {stage === "action" ? "Exercise pose" : stage === "complete" ? "Finished" : "Line up"}
        </div>

        {camOk ? (
          <div className="session-guide" aria-hidden="true">
            <ExerciseOutline exercise={ex} pose={stage === "action" || stage === "complete" ? "action" : "start"} overlay aligned={stage !== "aligning"} />
          </div>
        ) : (
          <div className="session-camera-prompt">
            <ExerciseOutline exercise={ex} pose="start" overlay />
            <p>{camOk === false ? "Allow camera access to line up with the guide." : "The human outline will appear here over your camera."}</p>
            <button className="session-primary-button" onClick={startCamera}>Turn on camera</button>
          </div>
        )}

        {camOk && stage === "aligning" && (
          <div className="session-alignment" aria-label={`Alignment ${Math.round(alignment * 100)} percent`}>
            <div><span>Align with the outline</span><strong>{Math.round(alignment * 100)}%</strong></div>
            <i><b style={{ width: `${Math.round(alignment * 100)}%` }} /></i>
          </div>
        )}

        <div className="session-metrics">
          <div><strong>{reps}<span>/{target}</span></strong><small>Reps</small></div>
          <div><strong>{correct}</strong><small>Good form</small></div>
          <div><strong>{angle === null ? "--" : `${angle}°`}</strong><small>Target {ex.min}–{ex.max}°</small></div>
        </div>

        <div className={`session-cue${bad ? " is-warning" : ""}`} aria-live="polite">{cue}</div>

        <footer className="session-footer">
          {(modelStatus || issue || saveError) && (
            <p className={issue || saveError || modelStatus.startsWith("Pose model unavailable") ? "session-error" : "session-status"} role={issue || saveError ? "alert" : "status"}>
              {saveError || issue || modelStatus}
            </p>
          )}
          {done ? (
            <button className="session-primary-button" onClick={() => onFinish(result)}>Save session</button>
          ) : (
            <div className="session-actions">
              {camOk && <button className="session-primary-button" onClick={() => setRun(!run)}>{run ? "Pause" : "Resume"}</button>}
              {reps > 0 && <button className="session-secondary-button" onClick={() => onFinish(result)}>End session</button>}
            </div>
          )}
          <p className="session-disclaimer">AI posture guidance is an estimate, not a clinical assessment.</p>
        </footer>
      </div>
    </main>
  );
}
