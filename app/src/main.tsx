import { Component, StrictMode } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

function RecoveryScreen() {
  return <main className="boot-screen" role="alert">
    <h1>Dungeon Core couldn’t open</h1>
    <button onClick={() => window.location.reload()}>Reload game</button>
  </main>
}

class GameBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <RecoveryScreen /> : this.props.children; }
}

const root = createRoot(document.getElementById("root")!);
void import("./ui/App").then(({ default: App }) => {
  root.render(<StrictMode><GameBoundary><App /></GameBoundary></StrictMode>);
}).catch((error) => {
  console.error("Dungeon Core startup failed.", error);
  root.render(<RecoveryScreen />);
});
