import { useEffect, useState } from "react";
import { useStore } from "../state/store";
import { IDLE_PROMOTION_WINS } from "../sim/idle";

export function IdleBar() {
  const { run, phase, idleReport, toggleIdle, increaseIdle, dismissIdleReport, finishWave } = useStore();
  const [now, setNow] = useState(Date.now);
  const idle = run?.idle;
  const nextAt = idle?.nextAt;

  useEffect(() => {
    if (nextAt == null) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [nextAt]);

  if (!idle || !run) return null;
  const paused = nextAt == null;
  const seconds = paused ? 0 : Math.max(0, Math.ceil((nextAt - now) / 1000));
  return (
    <div className="idle-hud">
      {idleReport && <div className="idle-report" role="status">
        <div><strong>While you were away</strong>
          <span>{idleReport.waves.toLocaleString()} waves · {idleReport.wins.toLocaleString()} wins · {idleReport.kills.toLocaleString()} invaders defeated · <b>+{idleReport.embers.toLocaleString()} Embers</b></span>
        </div>
        <button onClick={dismissIdleReport}>Dismiss</button>
      </div>}
      <div className="bottombar idle-bar">
        <button className="primary" onClick={toggleIdle}>{paused ? idle.attempts ? "Resume patrol" : "Start patrol" : "Pause to build"}</button>
        {phase === "wave" && <button onClick={finishWave}>Skip replay</button>}
        <span className="idle-countdown">{paused ? "Patrol paused" : `Next wave in ${seconds}s`}</span>
        <div className="idle-streak" aria-label={`${idle.streak} of ${IDLE_PROMOTION_WINS} consecutive wins`}>
          {Array.from({ length: IDLE_PROMOTION_WINS }, (_, index) => <i key={index} className={index < idle.streak ? "earned" : ""} />)}
          <span>{idle.streak}/{IDLE_PROMOTION_WINS} wins</span>
        </div>
        <button disabled={idle.streak < IDLE_PROMOTION_WINS} onClick={increaseIdle}>Try difficulty {run.wave + 1}</button>
        {idle.lastWave && <span className="idle-last">Last wave · {idle.lastWave.win ? "Defended" : "Overrun"} · +{idle.lastWave.embers} Embers</span>}
      </div>
    </div>
  );
}
