import { useEffect } from "react";
import "./ui.css";
import { useStore } from "../state/store";
import { Menu } from "./Menu";
import { GameScreen } from "./GameScreen";
import { initAuth } from "../net/auth";

export default function App() {
  const phase = useStore((s) => s.phase);
  const setUid = useStore((s) => s.setUid);

  useEffect(() => {
    initAuth((uid) => setUid(uid));
  }, [setUid]);

  if (phase === "menu") return <Menu />;
  return <GameScreen />;
}
