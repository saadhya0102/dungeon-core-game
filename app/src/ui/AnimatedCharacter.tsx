import type { CSSProperties } from "react";
import { characterSheetUrl, FRAME_COUNT, FRAMES } from "../game/art/pixels";
import type { CharacterClip } from "../game/art/pixels";

export function AnimatedCharacter({ id, clip = "idle", period, delay = 0, label }: {
  id: string; clip?: CharacterClip; period?: number; delay?: number; label?: string;
}) {
  const sheet = characterSheetUrl(id);
  const { start, count, fps } = FRAMES[clip];
  const style = {
    backgroundImage: sheet ? `url("${sheet}")` : undefined,
    backgroundSize: `${FRAME_COUNT * 100}% 100%`,
    "--art-start": `${start * 100 / (FRAME_COUNT - 1)}%`,
    "--art-last": `${(start + count - 1) * 100 / (FRAME_COUNT - 1)}%`,
    "--art-steps": count - 1,
    "--art-duration": `${period ?? count / fps}s`,
    "--art-delay": `${delay}s`,
  } as CSSProperties;
  return <span className="animated-character" style={style} role={label ? "img" : undefined} aria-label={label} aria-hidden={!label || undefined} />;
}
