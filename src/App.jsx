import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "./supabaseClient";

/* ============================================================
   UNFURL BINGO — MVP
   Design tokens (temporary — swap for Unfurl's exact brand kit)
   ============================================================ */
const T = {
  cream: "#F7F3EC",
  creamDeep: "#F1EBDF",
  teal: "#16264A",
  tealDeep: "#0E1830",
  tealTint: "#E7ECF4",
  clay: "#DA9C6E",
  clayTint: "#F5E7D8",
  ink: "#2B2620",
  inkSoft: "#6B6459",
  sand: "#E6DECF",
  sage: "#8FAE95",
  sageTint: "#E7EDE3",
  white: "#FFFFFF",
  navyCream: "#F4F1E8",
  navySoft: "#9AA3C0",
  navySurface: "#1C2747",
  navyBorder: "rgba(244,241,232,0.22)",
};

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500&family=Inter:wght@400;500;600;700&family=Mrs+Saint+Delafield&display=swap');
`;

/* ============================================================
   DEFAULT SEED DATA — editable later via Admin
   ============================================================ */
const DEFAULT_CHALLENGES = [
  { title: "Come to a coffee morning", short: "Coffee morning", description: "Come to a coffee morning.", icon: "☕" },
  { title: "Attend 3 classes in one week", short: "3 classes in a week", description: "Attend 3 classes in one week.", icon: "3️⃣" },
  { title: "Try a class style you've never done", short: "Something new", description: "Try a class style you've never done.", icon: "✨" },
  { title: "Bring a friend", short: "Bring a friend", description: "Bring a friend.", icon: "👯", verificationType: "code", verificationCode: "FRIEND1" },
  { title: "Try a restorative class (Breathwork, Yin, Slow Flow, Soundbath)", short: "Restorative class", description: "Try a restorative class (Breathwork, Yin, Slow Flow, Soundbath).", icon: "🕯️" },
  { title: "Do a class on a Sunday (Any Style)", short: "Sunday class", description: "Do a class on a Sunday (Any Style).", icon: "☀️" },
  { title: "Be an early riser (Classes before 8am)", short: "Early riser", description: "Be an early riser (Classes before 8am).", icon: "🌅" },
  { title: "Share an Unfurl post on your story", short: "Share our story", description: "Share an Unfurl post on your story.", icon: "📱" },
  { title: "Leave us a Google review", short: "Google review", description: "Leave us a Google review.", icon: "⭐" },
  { title: "Sign up to our newsletter", short: "Newsletter", description: "Sign up to our newsletter.", icon: "✉️" },
  { title: "Be an evening warrior (Classes after 6pm)", short: "Evening warrior", description: "Be an evening warrior (Classes after 6pm).", icon: "🌙" },
  { title: "Double up! (Two classes on one day)", short: "Double up!", description: "Double up! (Two classes on one day).", icon: "🔁" },
  { title: "Share a post class selfie", short: "Post class selfie", description: "Share a post class selfie.", icon: "🤳" },
  { title: "Download the Unfurl App", short: "Download the App", description: "Download the Unfurl App.", icon: "📲" },
  { title: "Try a class with Caroline", short: "Class with Caroline", description: "Try a class with Caroline.", icon: "🤝" },
  { title: "Give your teacher a praise note", short: "Praise note", description: "Give your teacher a praise note.", icon: "💌" },
].map((c, i) => ({ id: `c${i + 1}`, position: i, active: true, verificationType: "self", verificationCode: "", ...c }));

const DEFAULT_REWARDS = [
  { id: "r1", name: "£10 coffee voucher", milestone: "line1", description: "Complete 1 line for entry into the draw for a £10 voucher at a local coffee shop.", redemptionInstructions: "Screenshot your card and email it to hello@unfurlstudios.co.uk to confirm your entry." },
  { id: "r2", name: "Private class", milestone: "line3", description: "Complete 3 lines for entry into the draw for a private Yoga or Pilates session.", redemptionInstructions: "Screenshot your card and email it to hello@unfurlstudios.co.uk to confirm your entry." },
  { id: "r3", name: "£50 Sweaty Betty voucher", milestone: "fullhouse", description: "Complete a Full House for entry into the draw for a £50 Sweaty Betty voucher.", redemptionInstructions: "Screenshot your card and email it to hello@unfurlstudios.co.uk to confirm your entry." },
];

const DEFAULT_CAMPAIGN = {
  id: "camp1",
  name: "Unfurl Bingo",
  startDate: "2026-09-01",
  endDate: "2026-10-31",
  status: "active",
  introText: "Complete challenges. Discover something new. Unlock rewards.",
  challenges: DEFAULT_CHALLENGES,
  rewards: DEFAULT_REWARDS,
};

const LINES = [
  [0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15],
  [0, 4, 8, 12], [1, 5, 9, 13], [2, 6, 10, 14], [3, 7, 11, 15],
  [0, 5, 10, 15], [3, 6, 9, 12],
];

// Set VITE_ADMIN_PASSWORD in your .env / Vercel project settings.
// This check happens in the browser, so treat it as a light deterrent
// (keeping staff out of casual clicks) rather than real security.
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || "unfurl2026";

const uid = (p = "id") => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const nowISO = () => new Date().toISOString();
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

/* ============================================================
   STORAGE HELPERS
   ============================================================ */
// Shared data (campaigns + members) lives in Supabase, in a single
// two-row key/value table called bingo_data. See supabaseClient.js
// and DEPLOY.md for the table setup.
async function loadCampaigns() {
  try {
    const { data, error } = await supabase.from("bingo_data").select("value").eq("key", "campaigns").maybeSingle();
    if (error || !data) return [DEFAULT_CAMPAIGN];
    return data.value;
  } catch {
    return [DEFAULT_CAMPAIGN];
  }
}
async function saveCampaigns(campaigns) {
  try {
    const { error } = await supabase.from("bingo_data").upsert({ key: "campaigns", value: campaigns, updated_at: new Date().toISOString() });
    return !error;
  } catch {
    return false;
  }
}
async function loadMembers() {
  try {
    const { data, error } = await supabase.from("bingo_data").select("value").eq("key", "members").maybeSingle();
    if (error || !data) return {};
    return data.value;
  } catch {
    return {};
  }
}
async function saveMembers(members) {
  try {
    const { error } = await supabase.from("bingo_data").upsert({ key: "members", value: members, updated_at: new Date().toISOString() });
    return !error;
  } catch {
    return false;
  }
}

// No account system — email is the unique identifier that links a member
// to their saved progress (so it's reliable even across devices), and is
// remembered on this device via localStorage purely as a shortcut so they
// don't have to retype it every visit. Username is just their display name.
// The email is never used for marketing, newsletters, or anything beyond
// identifying their card — that's stated in the UI too.
function normalizeEmail(e) {
  return (e || "").trim().toLowerCase();
}
function loadDeviceMember() {
  try {
    const raw = localStorage.getItem("unfurl-bingo-device");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveDeviceMember(email) {
  try {
    localStorage.setItem("unfurl-bingo-device", JSON.stringify({ email }));
  } catch {}
}

/* ============================================================
   BINGO LOGIC
   ============================================================ */
function getCompletedSet(member, challenges) {
  const activeIds = new Set(challenges.filter((c) => c.active).map((c) => c.id));
  const done = new Set((member?.completions || []).map((c) => c.challengeId));
  return { done, activeIds };
}
function countLines(doneSet, challenges) {
  // map position -> challenge id
  const byPos = {};
  challenges.forEach((c) => (byPos[c.position] = c.id));
  let count = 0;
  const completedLineIdxs = [];
  LINES.forEach((line, idx) => {
    const complete = line.every((pos) => byPos[pos] && doneSet.has(byPos[pos]));
    if (complete) {
      count++;
      completedLineIdxs.push(idx);
    }
  });
  return { count, completedLineIdxs };
}
function milestoneForRewards(lineCount, fullHouse) {
  const unlocked = [];
  if (lineCount >= 1) unlocked.push("line1");
  if (lineCount >= 3) unlocked.push("line3");
  if (fullHouse) unlocked.push("fullhouse");
  return unlocked;
}

/* ============================================================
   SHARED UI ATOMS
   ============================================================ */
function ProgressBar({ value, max, color = T.teal }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div style={{ width: "100%", height: 8, background: T.sand, borderRadius: 999, overflow: "hidden" }}>
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: color,
          borderRadius: 999,
          transition: "width 0.5s cubic-bezier(.4,0,.2,1)",
        }}
      />
    </div>
  );
}

function Sheet({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(43,38,32,0.45)",
        display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50,
        animation: "unfurlFade 0.2s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.cream, width: "100%", maxWidth: 480, borderRadius: "24px 24px 0 0",
          padding: "10px 24px 32px", boxShadow: "0 -8px 30px rgba(0,0,0,0.15)",
          animation: "unfurlSlideUp 0.28s cubic-bezier(.16,1,.3,1)",
        }}
      >
        <div style={{ width: 40, height: 4, background: T.sand, borderRadius: 999, margin: "8px auto 20px" }} />
        {children}
      </div>
    </div>
  );
}

function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(18,49,45,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20,
        animation: "unfurlFade 0.25s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.navySurface, borderRadius: 20, padding: "36px 28px", maxWidth: 380, width: "100%",
          textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
          animation: "unfurlPop 0.35s cubic-bezier(.16,1,.3,1)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Button({ children, onClick, variant = "primary", style, disabled, small }) {
  const base = {
    fontFamily: "Inter, sans-serif", fontWeight: 600, border: "none", cursor: disabled ? "default" : "pointer",
    borderRadius: 999, transition: "transform 0.15s ease, opacity 0.15s ease",
    padding: small ? "10px 20px" : "15px 24px", fontSize: small ? 13 : 15, width: "100%",
    opacity: disabled ? 0.5 : 1,
  };
  const variants = {
    primary: { background: T.teal, color: T.white },
    clay: { background: T.clay, color: T.tealDeep },
    ghost: { background: "transparent", color: T.teal, border: `1.5px solid ${T.teal}` },
    text: { background: "transparent", color: T.inkSoft, padding: 6, width: "auto", fontWeight: 500, fontSize: 13 },
  };
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseDown={(e) => !disabled && (e.currentTarget.style.transform = "scale(0.97)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {children}
    </button>
  );
}

function TextField({ label, value, onChange, type = "text", placeholder }) {
  return (
    <label style={{ display: "block", marginBottom: 16, textAlign: "left" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: T.inkSoft, marginBottom: 6 }}>{label}</div>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%", padding: "13px 16px", borderRadius: 12, border: `1.5px solid ${T.sand}`,
          fontFamily: "Inter, sans-serif", fontSize: 15, background: T.white, color: T.ink, boxSizing: "border-box",
          outline: "none",
        }}
      />
    </label>
  );
}

/* ============================================================
   MEMBER: WELCOME
   ============================================================ */
function Welcome({ onStart, onAdminLogin, campaign }) {
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    const cleanEmail = email.trim();
    const cleanUsername = username.trim();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return setError("Please enter a valid email address.");
    if (!cleanUsername) return setError("Please make up a username.");
    if (!/^[a-zA-Z0-9_ ]{3,20}$/.test(cleanUsername)) return setError("Username: 3–20 characters — letters, numbers, spaces or underscores.");
    setError("");
    onStart(cleanEmail, cleanUsername);
  };

  const Sparkle = ({ top, left, right, size = 18, delay = 0 }) => (
    <span style={{
      position: "absolute", top, left, right, fontSize: size, color: T.clay,
      opacity: 0.85, animation: `unfurlTwinkle 2.6s ease-in-out ${delay}s infinite`,
    }}>✦</span>
  );

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center",
      padding: "40px 28px", boxSizing: "border-box", background: T.tealDeep, position: "relative", overflow: "hidden",
    }}>
      <style>{`@keyframes unfurlTwinkle { 0%,100% { opacity: 0.35; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1.1); } }`}</style>
      <Sparkle top={54} left={"14%"} size={20} delay={0.2} />
      <Sparkle top={110} right={"12%"} size={26} delay={0.9} />
      <Sparkle top={"38%"} right={"20%"} size={14} delay={1.5} />

      <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
        <div style={{
          fontFamily: "'Mrs Saint Delafield', cursive", fontSize: 46, color: T.navyCream, lineHeight: 1, marginBottom: -6,
        }}>
          Unfurl
        </div>
        <h1 style={{ fontFamily: "Fraunces, serif", fontWeight: 600, fontSize: 52, color: T.sage, margin: "0 0 22px", lineHeight: 1 }}>
          Bingo
        </h1>
        <p style={{ color: T.navySoft, fontSize: 16, lineHeight: 1.6, maxWidth: 300, margin: "0 auto 36px" }}>
          {campaign?.introText || "Complete challenges. Discover something new. Unlock rewards."}
        </p>
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>
        {!showForm ? (
          <Button onClick={() => setShowForm(true)} variant="clay">Start Playing</Button>
        ) : (
          <div style={{ background: T.navyCream, borderRadius: 20, padding: 24, boxShadow: "0 12px 40px rgba(0,0,0,0.35)" }}>
            <TextField label="Email address" value={email} onChange={setEmail} placeholder="you@email.com" type="email" />
            <TextField label="Choose a username" value={username} onChange={setUsername} placeholder="sunshineyogi" />
            {error && <div style={{ color: "#B5533C", fontSize: 13, marginBottom: 14 }}>{error}</div>}
            <Button onClick={submit} variant="clay">Continue</Button>
            <p style={{ fontSize: 11.5, color: T.inkSoft, textAlign: "center", marginTop: 14, lineHeight: 1.5 }}>
              Your email is only used to link you to your saved card, so you can pick it back up on any device — we don't use it for marketing, newsletters, or anything else.
            </p>
          </div>
        )}
      </div>

      <button
        onClick={onAdminLogin}
        style={{
          position: "relative", zIndex: 1, background: "transparent", border: "none", cursor: "pointer",
          color: T.navySoft, fontSize: 12.5, fontWeight: 600, fontFamily: "Inter, sans-serif", padding: "18px 0 4px",
          textAlign: "center", width: "100%", textDecoration: "underline",
        }}
      >
        Staff login
      </button>
    </div>
  );
}

/* ============================================================
   MEMBER: CHALLENGE SHEET
   ============================================================ */
function ChallengeSheet({ challenge, isDone, onClose, onComplete, onUndo }) {
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  if (!challenge) return null;

  const handleComplete = () => {
    if (challenge.verificationType === "code") {
      if (code.trim().toUpperCase() !== (challenge.verificationCode || "").toUpperCase()) {
        setCodeError("That code doesn't look right — check with a member of staff.");
        return;
      }
    }
    onComplete(challenge.id);
  };

  return (
    <Sheet open onClose={onClose}>
      <div style={{ fontSize: 34, marginBottom: 10 }}>{challenge.icon}</div>
      <h2 style={{ fontFamily: "Fraunces, serif", fontWeight: 500, fontSize: 24, color: T.teal, margin: "0 0 10px" }}>
        {challenge.title}
      </h2>
      <p style={{ color: T.inkSoft, fontSize: 15, lineHeight: 1.6, margin: "0 0 22px" }}>{challenge.description}</p>

      {isDone ? (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: T.sage, fontWeight: 600, fontSize: 15, marginBottom: 18 }}>
            <span style={{ fontSize: 18 }}>✓</span> Completed
          </div>
          <Button variant="text" onClick={() => onUndo(challenge.id)} style={{ margin: "0 auto", display: "block" }}>
            Undo completion
          </Button>
        </>
      ) : challenge.verificationType === "code" ? (
        <>
          <TextField label="Studio code" value={code} onChange={(v) => { setCode(v); setCodeError(""); }} placeholder="Enter code from reception" />
          {codeError && <div style={{ color: "#B5533C", fontSize: 13, marginBottom: 12, textAlign: "left" }}>{codeError}</div>}
          <Button onClick={handleComplete}>Confirm</Button>
        </>
      ) : (
        <Button onClick={handleComplete}>Mark as complete</Button>
      )}
    </Sheet>
  );
}

/* ============================================================
   MEMBER: BINGO GRID
   ============================================================ */
function BingoSquare({ challenge, done, justDone, onTap, number }) {
  return (
    <button
      onClick={() => onTap(challenge)}
      style={{
        minHeight: 108, borderRadius: 6, cursor: "pointer",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 6, padding: "10px 8px", textAlign: "center", position: "relative",
        background: done ? T.sage : "transparent",
        border: `1.5px solid ${done ? T.sage : T.navyBorder}`,
        transform: justDone ? "scale(1.05)" : "scale(1)",
        transition: "transform 0.35s cubic-bezier(.34,1.56,.64,1), background 0.3s ease, border-color 0.3s ease",
      }}
    >
      {done && (
        <div style={{
          position: "absolute", top: 6, right: 6, width: 17, height: 17, borderRadius: "50%",
          background: T.tealDeep, color: T.sage, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center",
        }}>✓</div>
      )}
      <div style={{
        fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 500,
        color: done ? T.tealDeep : T.sage, lineHeight: 1,
      }}>
        {number}
      </div>
      <div style={{ width: 18, height: 1.5, background: done ? T.tealDeep : T.clay, opacity: 0.8 }} />
      <div style={{
        fontSize: 11, fontWeight: 500, lineHeight: 1.3, color: done ? T.tealDeep : T.navyCream,
        fontFamily: "Inter, sans-serif",
      }}>
        {challenge.title}
      </div>
    </button>
  );
}

function GuideSheet({ open, onClose, challenges }) {
  return (
    <Sheet open={open} onClose={onClose}>
      <div style={{ maxHeight: "70vh", overflowY: "auto", padding: "0 2px" }}>
        <h2 style={{
          fontFamily: "Fraunces, serif", fontWeight: 700, fontSize: 30, color: T.teal,
          textAlign: "center", margin: "0 0 20px",
        }}>
          Bingo
        </h2>
        {challenges.map((c) => (
          <div key={c.id} style={{
            display: "flex", gap: 8, fontSize: 15, color: T.teal, lineHeight: 1.6, marginBottom: 4,
            fontFamily: "Inter, sans-serif",
          }}>
            <span style={{ minWidth: 20 }}>{c.position + 1}.</span>
            <span>• {c.title}</span>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

function MemberBingo({ member, campaign, onComplete, onUndo, username, onSaveNow, saveStatus }) {
  const [showGuide, setShowGuide] = useState(false);
  const [activeChallenge, setActiveChallenge] = useState(null);
  const [justDoneId, setJustDoneId] = useState(null);

  const challenges = useMemo(
    () => [...campaign.challenges].filter((c) => c.active).sort((a, b) => a.position - b.position),
    [campaign]
  );
  const { done } = getCompletedSet(member, campaign.challenges);
  const { count: lineCount } = countLines(done, campaign.challenges);
  const totalActive = challenges.length;
  const completedCount = done.size;

  const handleComplete = (challengeId) => {
    setJustDoneId(challengeId);
    onComplete(challengeId);
    setActiveChallenge(null);
    setTimeout(() => setJustDoneId(null), 500);
  };

  return (
    <div style={{ background: T.tealDeep, minHeight: "100vh", padding: "28px 18px 110px", boxSizing: "border-box" }}>
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ fontFamily: "'Mrs Saint Delafield', cursive", fontSize: 26, color: T.navyCream, lineHeight: 1, marginBottom: -4 }}>
            Unfurl
          </div>
          <h1 style={{ fontFamily: "Fraunces, serif", fontWeight: 600, fontSize: 30, color: T.sage, margin: "0 0 8px" }}>
            Bingo
          </h1>
          <button
            onClick={() => setShowGuide(true)}
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              color: T.clay, fontSize: 12.5, fontWeight: 600, textDecoration: "underline",
              fontFamily: "Inter, sans-serif", padding: 0,
            }}
          >
            View the full challenge list
          </button>
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 15, color: T.navyCream, fontWeight: 500, marginBottom: 10, textAlign: "center" }}>
            Hi, {username}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.navySoft }}>{completedCount} / {totalActive} completed</span>
            {lineCount > 0 && (
              <span style={{ fontSize: 13, color: T.clay, fontWeight: 600 }}>
                {lineCount} bingo line{lineCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div style={{ width: "100%", height: 6, background: "rgba(244,241,232,0.14)", borderRadius: 999, overflow: "hidden" }}>
            <div style={{
              width: `${Math.min(100, Math.round((completedCount / totalActive) * 100))}%`, height: "100%",
              background: T.sage, borderRadius: 999, transition: "width 0.5s cubic-bezier(.4,0,.2,1)",
            }} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {challenges.map((c) => (
            <BingoSquare
              key={c.id}
              challenge={c}
              number={c.position + 1}
              done={done.has(c.id)}
              justDone={justDoneId === c.id}
              onTap={setActiveChallenge}
            />
          ))}
        </div>

        <div style={{ marginTop: 22, textAlign: "center" }}>
          <button
            onClick={onSaveNow}
            disabled={saveStatus === "saving"}
            style={{
              background: "transparent", border: `1.5px solid ${T.sage}`, borderRadius: 999,
              color: T.sage, fontWeight: 600, fontSize: 13, padding: "10px 24px", cursor: "pointer",
              fontFamily: "Inter, sans-serif", opacity: saveStatus === "saving" ? 0.6 : 1,
            }}
          >
            {saveStatus === "saving" ? "Saving…" : "Save progress"}
          </button>
          <div style={{ marginTop: 8, fontSize: 12, minHeight: 16 }}>
            {saveStatus === "saved" && <span style={{ color: T.sage }}>✓ Saved</span>}
            {saveStatus === "error" && <span style={{ color: "#E08A6E" }}>Couldn't save — check your connection and try again</span>}
          </div>
        </div>
      </div>

      <ChallengeSheet
        challenge={activeChallenge}
        isDone={activeChallenge ? done.has(activeChallenge.id) : false}
        onClose={() => setActiveChallenge(null)}
        onComplete={handleComplete}
        onUndo={(id) => { onUndo(id); setActiveChallenge(null); }}
      />
      <GuideSheet open={showGuide} onClose={() => setShowGuide(false)} challenges={challenges} />
    </div>
  );
}

/* ============================================================
   MEMBER: REWARDS
   ============================================================ */
function MemberRewards({ member, campaign }) {
  const { done } = getCompletedSet(member, campaign.challenges);
  const { count: lineCount } = countLines(done, campaign.challenges);
  const totalActive = campaign.challenges.filter((c) => c.active).length;
  const fullHouse = done.size >= totalActive && totalActive > 0;
  const unlockedKeys = milestoneForRewards(lineCount, fullHouse);

  const rewardStatus = (reward) => {
    const mr = (member.memberRewards || []).find((r) => r.rewardId === reward.id);
    const isUnlocked = unlockedKeys.includes(reward.milestone);
    return { isUnlocked, mr };
  };

  return (
    <div style={{ background: T.tealDeep, minHeight: "100vh", padding: "28px 20px 110px", boxSizing: "border-box" }}>
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <div style={{ fontSize: 13, color: T.clay, fontWeight: 600, letterSpacing: 0.5, marginBottom: 4 }}>REWARDS</div>
        <h1 style={{ fontFamily: "Fraunces, serif", fontWeight: 500, fontSize: 26, color: T.navyCream, margin: "0 0 24px" }}>
          Your rewards
        </h1>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {campaign.rewards.map((reward) => {
            const { isUnlocked, mr } = rewardStatus(reward);
            return (
              <div key={reward.id} style={{
                background: T.navySurface, borderRadius: 14, padding: 18,
                border: `1.5px solid ${isUnlocked ? T.clay : T.navyBorder}`,
                opacity: isUnlocked ? 1 : 0.6,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div style={{ fontFamily: "Fraunces, serif", fontSize: 17, color: T.sage, fontWeight: 500 }}>{reward.name}</div>
                  <div style={{ fontSize: 15 }}>{isUnlocked ? "✓" : "🔒"}</div>
                </div>
                <p style={{ fontSize: 13.5, color: T.navySoft, margin: "0 0 8px", lineHeight: 1.5 }}>{reward.description}</p>
                {isUnlocked && mr && (
                  <div style={{ fontSize: 12, color: T.navySoft, marginTop: 8, borderTop: `1px solid ${T.navyBorder}`, paddingTop: 8 }}>
                    <div style={{ fontWeight: 600, color: T.sage, marginBottom: 4 }}>
                      You've been entered into the draw for this prize.
                    </div>
                    <div style={{ marginBottom: 6 }}>Unlocked {fmtDate(mr.unlockedAt)}</div>
                    {mr.confirmedAt ? (
                      <div style={{ fontWeight: 600, color: T.sage }}>Entry confirmed {fmtDate(mr.confirmedAt)}</div>
                    ) : (
                      <div style={{ lineHeight: 1.5 }}>{reward.redemptionInstructions}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   MEMBER: NAV + CELEBRATIONS
   ============================================================ */
function ProfileSheet({ open, onClose, currentUsername, onSave }) {
  const [value, setValue] = useState(currentUsername || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setValue(currentUsername || ""); setError(""); }
  }, [open, currentUsername]);

  const submit = async () => {
    const clean = value.trim();
    if (!/^[a-zA-Z0-9_ ]{3,20}$/.test(clean)) {
      setError("3–20 characters — letters, numbers, spaces or underscores.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(clean);
    } catch (e) {
      setError(e.message || "Couldn't save — try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose}>
      <h2 style={{ fontFamily: "Fraunces, serif", fontWeight: 500, fontSize: 22, color: T.teal, margin: "0 0 16px", textAlign: "center" }}>
        My profile
      </h2>
      <TextField label="Username" value={value} onChange={setValue} placeholder="sunshineyogi" />
      {error && <div style={{ color: "#B5533C", fontSize: 13, marginBottom: 12 }}>{error}</div>}
      <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
    </Sheet>
  );
}

function MemberNav({ tab, setTab, onAdmin, onProfile }) {
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, background: T.tealDeep,
      borderTop: `1px solid ${T.navyBorder}`, display: "flex", justifyContent: "center", zIndex: 30,
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
    }}>
      <div style={{ display: "flex", maxWidth: 480, width: "100%" }}>
        {["Bingo", "Rewards"].map((label) => (
          <button
            key={label}
            onClick={() => setTab(label.toLowerCase())}
            style={{
              flex: 1, border: "none", background: "transparent", padding: "14px 0",
              fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 13,
              color: tab === label.toLowerCase() ? T.sage : T.navySoft, cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
        <button onClick={onProfile} style={{ border: "none", background: "transparent", padding: "14px 10px", color: T.navySoft, fontSize: 15, cursor: "pointer" }} title="My profile">
          👤
        </button>
        <button onClick={onAdmin} style={{ border: "none", background: "transparent", padding: "14px 16px", color: T.navyBorder, fontSize: 13, cursor: "pointer" }} title="Staff">
          ⚙︎
        </button>
      </div>
    </div>
  );
}

function CelebrationModal({ type, onClose }) {
  if (!type) return null;
  const isFullHouse = type === "fullhouse";
  return (
    <Modal open onClose={onClose}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{isFullHouse ? "🌿" : "🔥"}</div>
      <h2 style={{ fontFamily: "Fraunces, serif", fontWeight: 500, fontSize: isFullHouse ? 28 : 24, color: T.navyCream, margin: "0 0 10px" }}>
        {isFullHouse ? "Full House" : "Bingo!"}
      </h2>
      <p style={{ color: T.navySoft, fontSize: 15, lineHeight: 1.6, margin: "0 0 24px" }}>
        {isFullHouse ? "You've completed the whole card. Beautifully done." : "You've completed a line — a reward is waiting for you."}
      </p>
      <Button onClick={onClose} variant="clay">View reward</Button>
    </Modal>
  );
}

/* ============================================================
   MEMBER APP ROOT
   ============================================================ */
function MemberApp({ campaigns, members, setMembers, onGoAdmin }) {
  const [stage, setStage] = useState("loading"); // loading | welcome | app
  const [tab, setTab] = useState("bingo");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [member, setMember] = useState(null);
  const [celebration, setCelebration] = useState(null);
  const [prevLineCount, setPrevLineCount] = useState(0);
  const [showProfile, setShowProfile] = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error

  const campaign = campaigns.find((c) => c.status === "active") || campaigns[0];

  useEffect(() => {
    (async () => {
      const device = await loadDeviceMember();
      const key = device?.email ? normalizeEmail(device.email) : null;
      if (key && members[key]) {
        setEmail(key);
        setUsername(members[key].username || "");
        setMember(members[key]);
        const { done } = getCompletedSet(members[key], campaign.challenges);
        setPrevLineCount(countLines(done, campaign.challenges).count);
        setStage("app");
      } else {
        setStage("welcome");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistMember = async (updated, key) => {
    const next = { ...members, [key || email]: updated };
    setMembers(next);
    setMember(updated);
    setSaveStatus("saving");
    const ok = await saveMembers(next);
    setSaveStatus(ok ? "saved" : "error");
  };

  const handleManualSave = async () => {
    if (!member) return;
    await persistMember(member);
  };

  const handleStart = async (newEmail, newUsername) => {
    const key = normalizeEmail(newEmail);
    let m = members[key];
    if (!m) {
      m = { email: key, username: newUsername, createdAt: nowISO(), completions: [], memberRewards: [] };
    } else {
      m = { ...m, username: newUsername };
    }
    saveDeviceMember(key);
    setEmail(key);
    setUsername(newUsername);
    await persistMember(m, key);
    const { done } = getCompletedSet(m, campaign.challenges);
    setPrevLineCount(countLines(done, campaign.challenges).count);
    setStage("app");
  };

  const handleUpdateUsername = async (newUsername) => {
    const updated = { ...member, username: newUsername };
    setUsername(newUsername);
    await persistMember(updated);
    setShowProfile(false);
  };

  const evaluateRewardsAndCelebrate = (updatedMember) => {
    const { done } = getCompletedSet(updatedMember, campaign.challenges);
    const totalActive = campaign.challenges.filter((c) => c.active).length;
    const { count: lineCount } = countLines(done, campaign.challenges);
    const fullHouse = done.size >= totalActive && totalActive > 0;
    const unlockedKeys = milestoneForRewards(lineCount, fullHouse);

    let mr = [...(updatedMember.memberRewards || [])];
    let newlyUnlocked = null;
    campaign.rewards.forEach((reward) => {
      if (unlockedKeys.includes(reward.milestone) && !mr.find((r) => r.rewardId === reward.id)) {
        mr.push({
          rewardId: reward.id,
          unlockedAt: nowISO(),
          confirmedAt: null,
        });
        newlyUnlocked = reward.milestone;
      }
    });

    const finalMember = { ...updatedMember, memberRewards: mr };

    if (lineCount > prevLineCount) {
      setCelebration(fullHouse ? "fullhouse" : "line");
    }
    setPrevLineCount(lineCount);
    return finalMember;
  };

  const handleComplete = async (challengeId) => {
    const withCompletion = {
      ...member,
      completions: [...(member.completions || []), { challengeId, completedAt: nowISO() }],
    };
    const finalMember = evaluateRewardsAndCelebrate(withCompletion);
    await persistMember(finalMember);
  };

  const handleUndo = async (challengeId) => {
    const withoutCompletion = {
      ...member,
      completions: (member.completions || []).filter((c) => c.challengeId !== challengeId),
    };
    await persistMember(withoutCompletion);
    const { done } = getCompletedSet(withoutCompletion, campaign.challenges);
    setPrevLineCount(countLines(done, campaign.challenges).count);
  };

  if (stage === "loading") {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: T.inkSoft }}>Loading…</div>;
  }
  if (stage === "welcome" || !campaign) {
    return <Welcome campaign={campaign} onStart={handleStart} onAdminLogin={onGoAdmin} />;
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      {tab === "bingo" ? (
        <MemberBingo member={member} campaign={campaign} onComplete={handleComplete} onUndo={handleUndo} username={username} onSaveNow={handleManualSave} saveStatus={saveStatus} />
      ) : (
        <MemberRewards member={member} campaign={campaign} />
      )}
      <MemberNav tab={tab} setTab={setTab} onAdmin={onGoAdmin} onProfile={() => setShowProfile(true)} />
      <CelebrationModal type={celebration} onClose={() => setCelebration(null)} />
      <ProfileSheet open={showProfile} onClose={() => setShowProfile(false)} currentUsername={username} onSave={handleUpdateUsername} />
    </div>
  );
}

/* ============================================================
   ADMIN: LOGIN
   ============================================================ */
function AdminLogin({ onSuccess, onBack }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", padding: 28, boxSizing: "border-box" }}>
      <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 26, color: T.teal, textAlign: "center", marginBottom: 24 }}>Staff sign in</h1>
      <div style={{ background: T.white, borderRadius: 20, padding: 24, maxWidth: 380, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        <TextField label="Password" type="password" value={pw} onChange={setPw} placeholder="••••••••" />
        {error && <div style={{ color: "#B5533C", fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <Button onClick={() => (pw === ADMIN_PASSWORD ? onSuccess() : setError("Incorrect password."))}>Sign in</Button>
        <Button variant="text" onClick={onBack} style={{ margin: "12px auto 0", display: "block" }}>← Back to member view</Button>
      </div>
    </div>
  );
}

/* ============================================================
   ADMIN: SHARED
   ============================================================ */
function AdminTabs({ tab, setTab, onExit }) {
  const tabs = ["Dashboard", "Campaigns", "Challenges", "Rewards", "Members"];
  return (
    <div style={{ background: T.tealDeep, padding: "16px 20px", position: "sticky", top: 0, zIndex: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ color: T.white, fontFamily: "Fraunces, serif", fontSize: 18 }}>Unfurl Bingo — Admin</div>
        <button onClick={onExit} style={{ background: "transparent", border: "none", color: T.sand, fontSize: 13, cursor: "pointer" }}>Exit</button>
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              border: "none", borderRadius: 999, padding: "7px 14px", fontSize: 12.5, fontWeight: 600,
              whiteSpace: "nowrap", cursor: "pointer",
              background: tab === t ? T.clay : "rgba(255,255,255,0.1)",
              color: T.white,
            }}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

function Card({ children, style }) {
  return <div style={{ background: T.white, borderRadius: 16, padding: 18, marginBottom: 12, boxShadow: "0 1px 6px rgba(43,38,32,0.05)", ...style }}>{children}</div>;
}
function SectionTitle({ children, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "18px 0 10px" }}>
      <div style={{ fontFamily: "Fraunces, serif", fontSize: 19, color: T.teal }}>{children}</div>
      {action}
    </div>
  );
}
function MiniField({ label, value, onChange, type = "text" }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: T.inkSoft, marginBottom: 4 }}>{label}</div>
      {type === "textarea" ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2}
          style={{ width: "100%", padding: 10, borderRadius: 10, border: `1.5px solid ${T.sand}`, fontFamily: "Inter, sans-serif", fontSize: 13.5, boxSizing: "border-box", resize: "vertical" }} />
      ) : type === "select" ? null : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
          style={{ width: "100%", padding: 10, borderRadius: 10, border: `1.5px solid ${T.sand}`, fontFamily: "Inter, sans-serif", fontSize: 13.5, boxSizing: "border-box" }} />
      )}
    </div>
  );
}

/* ============================================================
   ADMIN: DASHBOARD
   ============================================================ */
function AdminDashboard({ campaign, members }) {
  const memberList = Object.values(members);
  const players = memberList.length;
  const activePlayers = memberList.filter((m) => (m.completions || []).length > 0).length;
  let bingos = 0, fullHouses = 0;
  const totalActive = campaign?.challenges.filter((c) => c.active).length || 0;
  const challengeCompletionCount = {};
  campaign?.challenges.forEach((c) => (challengeCompletionCount[c.id] = 0));

  memberList.forEach((m) => {
    const { done } = getCompletedSet(m, campaign?.challenges || []);
    const { count } = countLines(done, campaign?.challenges || []);
    if (count >= 1) bingos++;
    if (done.size >= totalActive && totalActive > 0) fullHouses++;
    done.forEach((id) => { if (challengeCompletionCount[id] !== undefined) challengeCompletionCount[id]++; });
  });

  const rates = (campaign?.challenges || [])
    .filter((c) => c.active)
    .map((c) => ({ title: c.short, pct: players ? Math.round((challengeCompletionCount[c.id] / players) * 100) : 0 }))
    .sort((a, b) => b.pct - a.pct);

  const Stat = ({ label, value }) => (
    <div style={{ flex: 1, textAlign: "center" }}>
      <div style={{ fontFamily: "Fraunces, serif", fontSize: 28, color: T.teal }}>{value}</div>
      <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>{label}</div>
    </div>
  );

  return (
    <div style={{ padding: 20, maxWidth: 560, margin: "0 auto" }}>
      <Card style={{ display: "flex" }}>
        <Stat label="Players" value={players} />
        <Stat label="Active players" value={activePlayers} />
        <Stat label="Bingos" value={bingos} />
        <Stat label="Full Houses" value={fullHouses} />
      </Card>
      <SectionTitle>Challenge completion rates</SectionTitle>
      <Card>
        {rates.length === 0 && <div style={{ color: T.inkSoft, fontSize: 13 }}>No data yet.</div>}
        {rates.map((r) => (
          <div key={r.title} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
              <span>{r.title}</span><span style={{ fontWeight: 600, color: T.teal }}>{r.pct}%</span>
            </div>
            <ProgressBar value={r.pct} max={100} color={T.clay} />
          </div>
        ))}
      </Card>
    </div>
  );
}

/* ============================================================
   ADMIN: CAMPAIGNS
   ============================================================ */
function AdminCampaigns({ campaigns, setCampaigns, persist }) {
  const [editing, setEditing] = useState(null);

  const update = (field, value) => setEditing({ ...editing, [field]: value });
  const save = async () => {
    const exists = campaigns.find((c) => c.id === editing.id);
    const next = exists ? campaigns.map((c) => (c.id === editing.id ? editing : c)) : [...campaigns, editing];
    setCampaigns(next);
    await persist(next);
    setEditing(null);
  };
  const newCampaign = () => setEditing({
    id: uid("camp"), name: "", startDate: "", endDate: "", status: "inactive",
    introText: "Complete challenges. Discover something new. Unlock rewards.",
    challenges: DEFAULT_CHALLENGES.map((c) => ({ ...c, id: uid("c") })),
    rewards: DEFAULT_REWARDS.map((r) => ({ ...r, id: uid("r") })),
  });
  const setActive = async (id) => {
    const next = campaigns.map((c) => ({ ...c, status: c.id === id ? "active" : "inactive" }));
    setCampaigns(next);
    await persist(next);
  };

  if (editing) {
    return (
      <div style={{ padding: 20, maxWidth: 560, margin: "0 auto" }}>
        <SectionTitle>Edit campaign</SectionTitle>
        <Card>
          <MiniField label="Campaign name" value={editing.name} onChange={(v) => update("name", v)} />
          <MiniField label="Intro text" value={editing.introText} onChange={(v) => update("introText", v)} type="textarea" />
          <MiniField label="Start date" value={editing.startDate} onChange={(v) => update("startDate", v)} type="date" />
          <MiniField label="End date" value={editing.endDate} onChange={(v) => update("endDate", v)} type="date" />
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <Button onClick={save} small>Save</Button>
            <Button variant="ghost" onClick={() => setEditing(null)} small>Cancel</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 560, margin: "0 auto" }}>
      <SectionTitle action={<Button small onClick={newCampaign} style={{ width: "auto" }}>+ New</Button>}>Campaigns</SectionTitle>
      {campaigns.map((c) => (
        <Card key={c.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{c.name}</div>
              <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>{fmtDate(c.startDate)} – {fmtDate(c.endDate)}</div>
              <div style={{ fontSize: 11.5, marginTop: 4, color: c.status === "active" ? T.sage : T.inkSoft, fontWeight: 600 }}>
                {c.status === "active" ? "● Active" : "Inactive"}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Button small variant="ghost" onClick={() => setEditing(c)} style={{ width: "auto" }}>Edit</Button>
              {c.status !== "active" && <Button small onClick={() => setActive(c.id)} style={{ width: "auto" }}>Activate</Button>}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ============================================================
   ADMIN: CHALLENGES
   ============================================================ */
function AdminChallenges({ campaign, campaigns, setCampaigns, persist }) {
  const [editing, setEditing] = useState(null);

  const saveChallenge = async (updated) => {
    const nextChallenges = campaign.challenges.map((c) => (c.id === updated.id ? updated : c));
    const nextCampaigns = campaigns.map((c) => (c.id === campaign.id ? { ...c, challenges: nextChallenges } : c));
    setCampaigns(nextCampaigns);
    await persist(nextCampaigns);
    setEditing(null);
  };

  if (!campaign) return <div style={{ padding: 20 }}>No active campaign.</div>;

  if (editing) {
    return (
      <div style={{ padding: 20, maxWidth: 560, margin: "0 auto" }}>
        <SectionTitle>Edit challenge</SectionTitle>
        <Card>
          <MiniField label="Title" value={editing.title} onChange={(v) => setEditing({ ...editing, title: v })} />
          <MiniField label="Short label (for the grid)" value={editing.short} onChange={(v) => setEditing({ ...editing, short: v })} />
          <MiniField label="Description" value={editing.description} onChange={(v) => setEditing({ ...editing, description: v })} type="textarea" />
          <MiniField label="Icon (emoji)" value={editing.icon} onChange={(v) => setEditing({ ...editing, icon: v })} />
          <MiniField label="Position (0–15)" value={editing.position} onChange={(v) => setEditing({ ...editing, position: Number(v) })} type="number" />
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: T.inkSoft, marginBottom: 4 }}>Verification</div>
            <div style={{ display: "flex", gap: 8 }}>
              {["self", "code"].map((v) => (
                <button key={v} onClick={() => setEditing({ ...editing, verificationType: v })}
                  style={{
                    flex: 1, padding: 9, borderRadius: 10, cursor: "pointer",
                    border: `1.5px solid ${editing.verificationType === v ? T.teal : T.sand}`,
                    background: editing.verificationType === v ? T.tealTint : T.white, fontSize: 12.5, fontWeight: 600,
                  }}>
                  {v === "self" ? "Self verify" : "Code required"}
                </button>
              ))}
            </div>
          </div>
          {editing.verificationType === "code" && (
            <MiniField label="Studio code" value={editing.verificationCode} onChange={(v) => setEditing({ ...editing, verificationCode: v })} />
          )}
          <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
            <span style={{ fontSize: 13 }}>Active</span>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <Button small onClick={() => saveChallenge(editing)}>Save</Button>
            <Button small variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 560, margin: "0 auto" }}>
      <SectionTitle>Challenges — {campaign.name}</SectionTitle>
      {[...campaign.challenges].sort((a, b) => a.position - b.position).map((c) => (
        <Card key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>{c.icon}</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{c.title} {!c.active && <span style={{ color: T.inkSoft, fontWeight: 400 }}>(inactive)</span>}</div>
              <div style={{ fontSize: 11.5, color: T.inkSoft }}>Pos {c.position} · {c.verificationType === "code" ? `Code: ${c.verificationCode}` : "Self verify"}</div>
            </div>
          </div>
          <Button small variant="ghost" onClick={() => setEditing(c)} style={{ width: "auto" }}>Edit</Button>
        </Card>
      ))}
    </div>
  );
}

/* ============================================================
   ADMIN: REWARDS
   ============================================================ */
function AdminRewards({ campaign, campaigns, setCampaigns, persist }) {
  const [editing, setEditing] = useState(null);

  const save = async () => {
    const nextRewards = campaign.rewards.map((r) => (r.id === editing.id ? editing : r));
    const nextCampaigns = campaigns.map((c) => (c.id === campaign.id ? { ...c, rewards: nextRewards } : c));
    setCampaigns(nextCampaigns);
    await persist(nextCampaigns);
    setEditing(null);
  };

  if (!campaign) return <div style={{ padding: 20 }}>No active campaign.</div>;

  if (editing) {
    return (
      <div style={{ padding: 20, maxWidth: 560, margin: "0 auto" }}>
        <SectionTitle>Edit reward</SectionTitle>
        <Card>
          <MiniField label="Reward name" value={editing.name} onChange={(v) => setEditing({ ...editing, name: v })} />
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: T.inkSoft, marginBottom: 4 }}>Milestone</div>
            <div style={{ display: "flex", gap: 6 }}>
              {[["line1", "1 line"], ["line3", "3 lines"], ["fullhouse", "Full House"]].map(([v, l]) => (
                <button key={v} onClick={() => setEditing({ ...editing, milestone: v })}
                  style={{
                    flex: 1, padding: 8, borderRadius: 10, cursor: "pointer", fontSize: 12,
                    border: `1.5px solid ${editing.milestone === v ? T.teal : T.sand}`,
                    background: editing.milestone === v ? T.tealTint : T.white, fontWeight: 600,
                  }}>{l}</button>
              ))}
            </div>
          </div>
          <MiniField label="Description" value={editing.description} onChange={(v) => setEditing({ ...editing, description: v })} type="textarea" />
          <MiniField label="Redemption instructions" value={editing.redemptionInstructions} onChange={(v) => setEditing({ ...editing, redemptionInstructions: v })} type="textarea" />
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <Button small onClick={save}>Save</Button>
            <Button small variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 560, margin: "0 auto" }}>
      <SectionTitle>Rewards — {campaign.name}</SectionTitle>
      {campaign.rewards.map((r) => (
        <Card key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{r.name}</div>
            <div style={{ fontSize: 11.5, color: T.inkSoft }}>{r.milestone}</div>
          </div>
          <Button small variant="ghost" onClick={() => setEditing(r)} style={{ width: "auto" }}>Edit</Button>
        </Card>
      ))}
    </div>
  );
}

/* ============================================================
   ADMIN: MEMBERS
   ============================================================ */
function AdminMembers({ campaign, members, setMembers, persistMembers }) {
  const [search, setSearch] = useState("");
  const entries = Object.entries(members).filter(([email, m]) =>
    email.toLowerCase().includes(search.toLowerCase()) || (m.username || "").toLowerCase().includes(search.toLowerCase())
  );

  const confirmEntry = async (email, rewardId) => {
    const m = members[email];
    const nextMR = (m.memberRewards || []).map((r) => (r.rewardId === rewardId ? { ...r, confirmedAt: nowISO() } : r));
    const nextMembers = { ...members, [email]: { ...m, memberRewards: nextMR } };
    setMembers(nextMembers);
    await persistMembers(nextMembers);
  };

  return (
    <div style={{ padding: 20, maxWidth: 560, margin: "0 auto" }}>
      <SectionTitle>Members</SectionTitle>
      <input
        placeholder="Search by username or email"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: "100%", padding: 12, borderRadius: 12, border: `1.5px solid ${T.sand}`, marginBottom: 14, boxSizing: "border-box", fontFamily: "Inter, sans-serif" }}
      />
      {entries.length === 0 && <div style={{ color: T.inkSoft, fontSize: 13 }}>No members yet.</div>}
      {entries.map(([email, m]) => {
        const { done } = getCompletedSet(m, campaign?.challenges || []);
        const { count } = countLines(done, campaign?.challenges || []);
        const totalActive = campaign?.challenges.filter((c) => c.active).length || 0;
        const fullHouse = done.size >= totalActive && totalActive > 0;
        return (
          <Card key={email}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{m.username || "(no username)"}</div>
                <div style={{ fontSize: 11.5, color: T.inkSoft }}>{email}</div>
                <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>Joined {fmtDate(m.createdAt)}</div>
              </div>
              <div style={{ textAlign: "right", fontSize: 12 }}>
                <div>{done.size}/{totalActive} squares</div>
                <div>{count} line{count === 1 ? "" : "s"}</div>
                {fullHouse && <div style={{ color: T.clay, fontWeight: 700 }}>Full House</div>}
              </div>
            </div>
            {(m.memberRewards || []).length > 0 && (
              <div style={{ marginTop: 10, borderTop: `1px solid ${T.sand}`, paddingTop: 10 }}>
                {m.memberRewards.map((r) => (
                  <div key={r.rewardId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ fontSize: 12 }}>
                      {campaign?.rewards.find((x) => x.id === r.rewardId)?.name || r.rewardId}
                    </div>
                    {r.confirmedAt ? (
                      <span style={{ fontSize: 11, color: T.sage, fontWeight: 600 }}>Confirmed</span>
                    ) : (
                      <Button small variant="ghost" onClick={() => confirmEntry(email, r.rewardId)} style={{ width: "auto" }}>Mark confirmed</Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* ============================================================
   ADMIN ROOT
   ============================================================ */
function AdminApp({ campaigns, setCampaigns, members, setMembers, onExit }) {
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState("Dashboard");
  const activeCampaign = campaigns.find((c) => c.status === "active") || campaigns[0];

  if (!authed) return <AdminLogin onSuccess={() => setAuthed(true)} onBack={onExit} />;

  return (
    <div style={{ minHeight: "100vh", background: T.creamDeep }}>
      <AdminTabs tab={tab} setTab={setTab} onExit={onExit} />
      {tab === "Dashboard" && <AdminDashboard campaign={activeCampaign} members={members} />}
      {tab === "Campaigns" && <AdminCampaigns campaigns={campaigns} setCampaigns={setCampaigns} persist={saveCampaigns} />}
      {tab === "Challenges" && <AdminChallenges campaign={activeCampaign} campaigns={campaigns} setCampaigns={setCampaigns} persist={saveCampaigns} />}
      {tab === "Rewards" && <AdminRewards campaign={activeCampaign} campaigns={campaigns} setCampaigns={setCampaigns} persist={saveCampaigns} />}
      {tab === "Members" && <AdminMembers campaign={activeCampaign} members={members} setMembers={setMembers} persistMembers={saveMembers} />}
    </div>
  );
}

/* ============================================================
   APP ROOT
   ============================================================ */
export default function UnfurlBingoApp() {
  const [route, setRoute] = useState("member"); // member | admin
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState([DEFAULT_CAMPAIGN]);
  const [members, setMembers] = useState({});

  useEffect(() => {
    (async () => {
      const [c, m] = await Promise.all([loadCampaigns(), loadMembers()]);
      setCampaigns(c && c.length ? c : [DEFAULT_CAMPAIGN]);
      setMembers(m || {});
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.cream, fontFamily: "Inter, sans-serif", color: T.inkSoft }}>
        <style>{FONTS}</style>
        Loading Unfurl Bingo…
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: T.cream, minHeight: "100vh", color: T.ink }}>
      <style>{`
        ${FONTS}
        * { box-sizing: border-box; }
        @keyframes unfurlFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes unfurlSlideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes unfurlPop { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        button:focus-visible, input:focus-visible, textarea:focus-visible { outline: 2px solid ${T.clay}; outline-offset: 2px; }
      `}</style>
      {route === "member" ? (
        <MemberApp campaigns={campaigns} members={members} setMembers={setMembers} onGoAdmin={() => setRoute("admin")} />
      ) : (
        <AdminApp campaigns={campaigns} setCampaigns={setCampaigns} members={members} setMembers={setMembers} onExit={() => setRoute("member")} />
      )}
    </div>
  );
}
