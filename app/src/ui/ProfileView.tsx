import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { signInEmail, signUpEmail, signInGoogle, doSignOut } from "../net/auth";

export function ProfileView({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<{ email: string | null; isAnonymous: boolean; uid: string } | null>(null);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => {
      setInfo(u ? { email: u.email, isAnonymous: u.isAnonymous, uid: u.uid } : null);
    });
  }, []);

  async function run(fn: () => Promise<void>) {
    setErr(null); setBusy(true);
    try { await fn(); } catch (e) { setErr((e as { code?: string; message?: string })?.code ?? (e as Error)?.message ?? "Failed"); }
    finally { setBusy(false); }
  }

  const signedIn = info && !info.isAnonymous;

  return (
    <div className="panel-modal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="panel" style={{ width: 420 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Profile</h2>
          <button onClick={onClose}>Close</button>
        </div>

        <div className="hint">
          {!info ? "Local mode (no cloud account)." :
            signedIn ? `Signed in as ${info.email}` :
              "Playing as a guest. Sign in to access your profile on other devices."}
        </div>

        {!auth && <p>Progress is stored in this browser.</p>}
        {auth && !signedIn && (
          <>
            <div className="section-title">Email</div>
            <input className="card" style={{ width: "100%", marginBottom: 6 }} placeholder="email"
              value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="card" style={{ width: "100%", marginBottom: 8 }} placeholder="password" type="password"
              value={pass} onChange={(e) => setPass(e.target.value)} />
            <div style={{ display: "flex", gap: 8 }}>
              <button className="primary" disabled={busy} onClick={() => run(() => signInEmail(email, pass))}>Sign In</button>
              <button disabled={busy} onClick={() => run(() => signUpEmail(email, pass))}>Create Account</button>
            </div>
            <div className="section-title">Or</div>
            <button disabled={busy} onClick={() => run(() => signInGoogle())}>Sign in with Google</button>
          </>
        )}

        {signedIn && (
          <button className="danger" style={{ marginTop: 10 }} disabled={busy} onClick={() => run(() => doSignOut())}>Sign Out</button>
        )}

        {err && <div className="toast" style={{ position: "static", marginTop: 10 }}>{err}</div>}
      </div>
    </div>
  );
}
