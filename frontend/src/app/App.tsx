import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Camera, X } from "lucide-react";
import characterImg from "../imports/image.png";
import loginCharImg from "../imports/Apple.png";
import tomNookImg from "../imports/image-1.png";
import acBgImg from "../imports/Animal_Crossing-01.jpg";
import { api, type MissionStatus } from "./api";

// ── Types ─────────────────────────────────────────────────────────────────────

type Screen =
  | "google-login"
  | "character-input"
  | "mission-intro"
  | "find-partner"
  | "mission1"
  | "mid-clear"
  | "mission2"
  | "mission3"
  | "all-complete"
  | "mypage"
  | "mission-history"
  | "admin-pin"
  | "final-complete";

interface UserData { name: string; character: string; }

const PARTNERS = ["잭슨", "뽀야미", "너굴", "이자벨", "블랑"];
const TIMER_TOTAL = 90;

// ── Sky / Clouds / Grass ──────────────────────────────────────────────────────

function Sky() {
  return (
    <div className="absolute inset-0 z-0 pointer-events-none" style={{
      background: "linear-gradient(180deg,#B2DDF5 0%,#CBF0F8 30%,#E0F5E0 65%,#C8EDAE 100%)",
    }} />
  );
}

function Clouds() {
  return (
    <div className="absolute top-12 inset-x-0 pointer-events-none select-none z-0" style={{ height: 44 }}>
      <svg viewBox="0 0 393 44" width="393" height="44">
        <ellipse cx="72"  cy="32" rx="40" ry="16" fill="rgba(255,255,255,0.72)" />
        <ellipse cx="95"  cy="24" rx="28" ry="13" fill="rgba(255,255,255,0.72)" />
        <ellipse cx="52"  cy="30" rx="22" ry="12" fill="rgba(255,255,255,0.60)" />
        <ellipse cx="300" cy="28" rx="46" ry="17" fill="rgba(255,255,255,0.65)" />
        <ellipse cx="328" cy="20" rx="30" ry="13" fill="rgba(255,255,255,0.65)" />
        <ellipse cx="278" cy="30" rx="24" ry="12" fill="rgba(255,255,255,0.50)" />
      </svg>
    </div>
  );
}

function Grass() {
  return (
    <div className="w-full shrink-0 pointer-events-none select-none" style={{ height: 22, marginTop: -2 }}>
      <svg viewBox="0 0 393 22" preserveAspectRatio="none" width="100%" height="22">
        <path d="M0,14 C30,4 60,20 90,12 C120,4 150,18 180,10 C210,2 240,18 270,10 C300,2 330,18 360,10 C375,4 387,14 393,10 L393,22 L0,22Z" fill="#72C840" />
        <path d="M0,18 C40,10 80,22 120,15 C160,8 200,22 240,15 C280,8 320,22 360,15 C375,10 388,18 393,15 L393,22 L0,22Z" fill="#88D850" />
      </svg>
    </div>
  );
}

// ── Title ─────────────────────────────────────────────────────────────────────

function Title({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-center justify-center gap-2 ${compact ? "py-1.5" : "py-3"}`}>
      <span className="text-xl select-none">🌿</span>
      <div className={`${compact ? "px-5 py-1 text-base" : "px-7 py-2 text-xl"} rounded-full font-black`}
        style={{
          background: "#fff", color: "#3A6B20",
          border: "2.5px solid #A8DC80",
          boxShadow: "0 3px 12px rgba(80,160,40,0.18)",
          fontFamily: "'Noto Sans KR', sans-serif",
          letterSpacing: "0.08em",
        }}>
        🏝️ 프메의 숲
      </div>
      <span className="text-xl select-none">🌿</span>
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl p-5 ${className}`} style={{
      background: "rgba(255,255,255,0.92)",
      border: "2px solid rgba(140,210,100,0.40)",
      boxShadow: "0 4px 20px rgba(60,130,30,0.10)",
    }}>
      {children}
    </div>
  );
}

// ── Speech bubble ─────────────────────────────────────────────────────────────

function SpeechBubble({ children, emoji = "🦝" }: { children: React.ReactNode; emoji?: string }) {
  return (
    <div className="relative mx-4 mb-4">
      <div className="rounded-3xl px-5 py-4 text-sm leading-relaxed" style={{
        background: "rgba(255,255,255,0.92)",
        border: "2px solid rgba(140,210,100,0.50)",
        color: "#3A5020", fontFamily: "'Noto Sans KR', sans-serif",
        boxShadow: "0 3px 12px rgba(60,140,30,0.10)",
      }}>
        <span className="mr-2 text-base">{emoji}</span>{children}
      </div>
      <div className="absolute left-9 -bottom-2.5 w-0 h-0"
        style={{ borderLeft: "7px solid transparent", borderRight: "7px solid transparent", borderTop: "11px solid rgba(140,210,100,0.50)" }} />
      <div className="absolute left-9 -bottom-1.5 w-0 h-0"
        style={{ borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "9px solid rgba(255,255,255,0.92)" }} />
    </div>
  );
}

// ── Icon badge ────────────────────────────────────────────────────────────────

function IconBadge({ emoji, bg, size = 50 }: { emoji: string; bg: string; size?: number }) {
  return (
    <div className="flex items-center justify-center rounded-2xl shrink-0" style={{
      width: size, height: size, background: bg,
      border: "3px solid rgba(255,255,255,0.80)",
      boxShadow: "0 3px 10px rgba(0,0,0,0.12)",
      fontSize: size * 0.44,
    }}>{emoji}</div>
  );
}

// ── Button ────────────────────────────────────────────────────────────────────

function Btn({
  children, onClick, color = "green", fullWidth = false, disabled = false, size = "md",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  color?: "green" | "mint" | "coral" | "brown" | "muted";
  fullWidth?: boolean; disabled?: boolean; size?: "sm" | "md" | "lg";
}) {
  const C = {
    green: { bg: "#58C030", border: "#3A9018", shadow: "#2E7010", text: "#fff" },
    mint:  { bg: "#40C8B0", border: "#2A9888", shadow: "#1E7868", text: "#fff" },
    coral: { bg: "#FF8050", border: "#CC5530", shadow: "#A04020", text: "#fff" },
    brown: { bg: "#A07050", border: "#785030", shadow: "#583818", text: "#fff" },
    muted: { bg: "#C0C8B8", border: "#909880", shadow: "#686E60", text: "#fff" },
  };
  const S = { sm: "px-4 py-2 text-xs rounded-2xl", md: "px-6 py-3 text-sm rounded-2xl", lg: "px-6 py-3.5 text-base rounded-2xl" };
  const v = C[disabled ? "muted" : color];
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onPointerDown={() => !disabled && setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      className={`font-black select-none ${S[size]} ${fullWidth ? "w-full" : ""}`}
      style={{
        background: v.bg, color: v.text,
        fontFamily: "'Noto Sans KR', sans-serif",
        border: `2.5px solid ${v.border}`,
        boxShadow: pressed ? `0 1px 0 ${v.shadow}` : `0 5px 0 ${v.shadow}, 0 6px 14px rgba(0,0,0,0.14)`,
        transform: pressed ? "translateY(4px)" : "none",
        outline: "none", cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.65 : 1,
        transition: "box-shadow 60ms, transform 60ms",
        letterSpacing: "0.03em",
      }}>
      {children}
    </button>
  );
}

function Notice({ type, message, onClose }: { type: "loading" | "error"; message: string; onClose?: () => void }) {
  const isError = type === "error";
  return (
    <div
      className="absolute left-4 right-4 top-20 z-50 rounded-2xl px-4 py-3 text-sm font-black flex items-center justify-between gap-3"
      style={{
        background: isError ? "rgba(255,245,240,0.97)" : "rgba(255,255,255,0.97)",
        border: `2px solid ${isError ? "#FF9A70" : "rgba(140,210,100,0.65)"}`,
        color: isError ? "#B84020" : "#3A6020",
        fontFamily: "'Noto Sans KR', sans-serif",
        boxShadow: "0 6px 24px rgba(40,100,10,0.16)",
      }}
    >
      <span>{isError ? "앗!" : "잠시만요"} {message}</span>
      {onClose && (
        <button type="button" onClick={onClose} className="text-base leading-none" style={{ color: "inherit" }}>
          ×
        </button>
      )}
    </div>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────────

function Input({ label, placeholder, value, onChange, emoji }: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void; emoji?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-black pl-1" style={{ color: "#3A6020", fontFamily: "'Noto Sans KR', sans-serif" }}>
        {emoji && <span className="mr-1">{emoji}</span>}{label}
      </label>
      <input className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
        style={{
          background: focused ? "#fff" : "rgba(255,255,255,0.80)",
          border: `2px solid ${focused ? "#68C040" : "rgba(140,200,100,0.45)"}`,
          color: "#283818", fontFamily: "'Noto Sans KR', sans-serif",
          boxShadow: focused ? "0 0 0 3px rgba(100,200,60,0.15)" : "none",
          transition: "all 120ms",
        }}
        placeholder={placeholder} value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
    </div>
  );
}

// ── Mission step bar ──────────────────────────────────────────────────────────

function MissionStepBar({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center justify-center gap-2 py-2">
      {[1, 2, 3].map((n, i) => {
        const done = n < current;
        const active = n === current;
        return (
          <div key={n} className="flex items-center gap-2">
            <div className="flex items-center justify-center rounded-full font-black transition-all"
              style={{
                width: active ? 30 : 24, height: active ? 30 : 24,
                background: done ? "#58C030" : active ? "#fff" : "rgba(255,255,255,0.40)",
                border: `${active ? 3 : 2}px solid ${done ? "#3A9018" : active ? "#58C030" : "rgba(200,230,160,0.60)"}`,
                color: done ? "#fff" : active ? "#3A9020" : "rgba(255,255,255,0.70)",
                fontSize: active ? 12 : 10,
                fontFamily: "'Noto Sans KR', sans-serif",
                boxShadow: active ? "0 2px 8px rgba(60,160,30,0.25)" : "none",
              }}>
              {done ? "✓" : n}
            </div>
            {n < 3 && (
              <div style={{ width: 28, height: 2, borderRadius: 1, background: done ? "#58C030" : "rgba(200,230,160,0.45)" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Timer ─────────────────────────────────────────────────────────────────────

function TimerDisplay({ seconds, total, running }: { seconds: number; total: number; running: boolean }) {
  const r = 72;
  const circ = 2 * Math.PI * r;
  const dash = circ * (seconds / total);
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  const done = seconds === 0;
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex items-center justify-center" style={{ width: 188, height: 188 }}>
        {/* bg ring */}
        <svg width="188" height="188" style={{ position: "absolute", transform: "rotate(-90deg)" }}>
          <circle cx="94" cy="94" r={r} fill="rgba(255,255,255,0.60)" stroke="#DFF0CC" strokeWidth="12" />
          <circle cx="94" cy="94" r={r} fill="none"
            stroke={done ? "#FF8050" : running ? "#58C030" : "#90D060"}
            strokeWidth="12"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.8s linear" }} />
        </svg>
        <div className="flex flex-col items-center z-10">
          <span style={{ fontSize: 46, fontWeight: 900, color: done ? "#D04020" : "#283818", fontFamily: "'Noto Sans KR', sans-serif", lineHeight: 1 }}>
            {m}:{s}
          </span>
          <span style={{ fontSize: 11, color: "#90A880", fontFamily: "'Noto Sans KR', sans-serif", marginTop: 5 }}>
            {done ? "⏰ 시간 완료!" : running ? "대화 중 ..." : "남은 시간"}
          </span>
        </div>
      </div>
      {done && (
        <div className="px-4 py-2 rounded-2xl text-xs font-black"
          style={{ background: "#FFE8D8", color: "#C04020", border: "2px solid #FFBEA0", fontFamily: "'Noto Sans KR', sans-serif" }}>
          🔔 대화 시간이 끝났어요!
        </div>
      )}
    </div>
  );
}

// ── PIN pad ───────────────────────────────────────────────────────────────────

function PinPad({ pin, onChange }: { pin: string; onChange: (p: string) => void }) {
  const keys = ["1","2","3","4","5","6","7","8","9","","0","⌫"];
  return (
    <div>
      <div className="flex gap-5 justify-center mb-6">
        {[0,1,2,3].map(i => (
          <div key={i} className="rounded-full transition-all" style={{
            width: 16, height: 16,
            background: i < pin.length ? "#58C030" : "rgba(200,230,160,0.60)",
            border: "2px solid rgba(140,200,100,0.60)",
            transform: i < pin.length ? "scale(1.2)" : "scale(1)",
            transition: "all 150ms",
          }} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {keys.map((k, i) => (
          <button key={i}
            onClick={() => {
              if (k === "⌫") onChange(pin.slice(0, -1));
              else if (k !== "" && pin.length < 4) onChange(pin + k);
            }}
            style={{
              height: 58, borderRadius: 16,
              background: k === "" ? "transparent" : "rgba(255,255,255,0.88)",
              border: k === "" ? "none" : "2px solid rgba(140,210,100,0.40)",
              fontFamily: "'Noto Sans KR', sans-serif",
              fontSize: k === "⌫" ? 20 : 22, fontWeight: 700,
              color: "#283818", cursor: k === "" ? "default" : "pointer",
              boxShadow: k === "" ? "none" : "0 3px 8px rgba(60,140,30,0.10)",
              outline: "none",
            }}>
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

function TabBar({ active, onTab }: { active: "mission" | "mypage"; onTab: (t: "mission" | "mypage") => void }) {
  return (
    <div className="flex w-full shrink-0" style={{
      background: "rgba(255,255,255,0.95)",
      borderTop: "2px solid rgba(140,210,100,0.40)",
      boxShadow: "0 -4px 16px rgba(60,140,30,0.08)",
    }}>
      {[
        { id: "mission" as const, emoji: "⭐", label: "미션창" },
        { id: "mypage"  as const, emoji: "🦡", label: "마이페이지" },
      ].map((t) => {
        const isActive = active === t.id;
        return (
          <button key={t.id} className="flex-1 flex flex-col items-center pt-3 pb-2 gap-0.5"
            onClick={() => onTab(t.id)}
            style={{ border: "none", background: "transparent", outline: "none", cursor: "pointer" }}>
            <span className="text-2xl leading-none">{t.emoji}</span>
            <span className="text-xs font-black"
              style={{ color: isActive ? "#3A9020" : "#9EB08A", fontFamily: "'Noto Sans KR', sans-serif" }}>
              {t.label}
            </span>
            {isActive && <div className="w-6 h-1.5 rounded-full mt-0.5" style={{ background: "#58C030" }} />}
          </button>
        );
      })}
    </div>
  );
}

// ── Back row ──────────────────────────────────────────────────────────────────

function BackRow({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex items-center px-4 pt-2 pb-0 shrink-0">
      <button onClick={onBack} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
        style={{ background: "rgba(255,255,255,0.90)", border: "2px solid rgba(140,210,100,0.50)", cursor: "pointer", boxShadow: "0 2px 8px rgba(60,140,30,0.10)" }}>
        <ArrowLeft size={16} color="#3A7020" strokeWidth={2.5} />
      </button>
      <div className="flex-1 flex justify-center">
        <Title compact />
      </div>
      {/* spacer matching back button width to keep title centered */}
      <div className="w-9 h-9 shrink-0" />
    </div>
  );
}

// ── Photo upload area ─────────────────────────────────────────────────────────

function PhotoUpload({ preview, onSelect, onClear, icon = "📸" }: {
  preview: string | null; onSelect: (data: string) => void; onClear: () => void; icon?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const r = new FileReader(); r.onload = () => onSelect(r.result as string); r.readAsDataURL(file);
    e.target.value = "";
  };
  return (
    <>
      <div className="rounded-3xl overflow-hidden cursor-pointer flex items-center justify-center"
        style={{
          border: preview ? "2.5px solid #58C030" : "2.5px dashed rgba(140,200,100,0.55)",
          background: preview ? "transparent" : "rgba(255,255,255,0.75)",
          minHeight: "200px",
          boxShadow: preview ? "0 4px 16px rgba(60,160,30,0.14)" : "none",
        }}
        onClick={() => fileRef.current?.click()}>
        {preview ? (
          <div className="relative w-full">
            <img src={preview} alt="업로드 사진" className="w-full object-cover rounded-3xl" style={{ maxHeight: 250 }} />
            <button className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.50)", border: "none", cursor: "pointer" }}
              onClick={(e) => { e.stopPropagation(); onClear(); }}>
              <X size={14} color="#fff" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-10">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl"
              style={{ background: "#7DD4F0", border: "3px solid rgba(255,255,255,0.70)", boxShadow: "0 4px 12px rgba(60,160,210,0.25)" }}>
              {icon === "📸" ? <Camera size={28} color="#fff" /> : <span>{icon}</span>}
            </div>
            <p className="font-black text-sm" style={{ color: "#4A8030", fontFamily: "'Noto Sans KR', sans-serif" }}>사진을 업로드해주세요</p>
            <p className="text-xs" style={{ color: "#90A880", fontFamily: "'Noto Sans KR', sans-serif" }}>탭해서 갤러리에서 선택 📷</p>
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </>
  );
}

function formatMission2Title(partner: string, missionText: string) {
  const fallback = "주민과 함께 사진 찍기";
  const base = (missionText || fallback).trim();
  const withPartner = partner
    ? base.replace(/^주민과/, `${partner} 주민과`)
    : base;

  return withPartner
    .replace(" 사진 ", " 사진\n")
    .replace(" 인증", "\n인증");
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCREENS
// ═══════════════════════════════════════════════════════════════════════════════

// 00. Google Login ────────────────────────────────────────────────────────────

function ScreenGoogleLogin({ onLogin, loading }: { onLogin: () => void; loading?: boolean }) {
  return (
    <div className="flex flex-col h-full overflow-y-auto relative" style={{ scrollbarWidth: "none" }}>
      <Sky /><Clouds />
      <div className="relative z-10 flex flex-col">
        <Title />
        <Grass />

        {/* character */}
        <div className="flex justify-center mt-5 mb-2">
          <div className="relative">
            <div
              className="w-32 h-32 rounded-full flex items-center justify-center overflow-hidden"
              style={{
                background: "linear-gradient(135deg,#A8E4FC,#C0F4D8)",
                border: "4px solid rgba(255,255,255,0.9)",
                boxShadow: "0 6px 20px rgba(60,160,220,0.25)",
              }}
            >
              <img src={loginCharImg} alt="캐릭터"
                className="w-full h-full object-cover"
                style={{ objectPosition: "center 15%", transform: "scale(1.3)" }} />
            </div>
            <span className="absolute -top-1 -right-1 text-xl select-none">✨</span>
            <span className="absolute -bottom-1 -left-1 text-lg select-none">🌿</span>
          </div>
        </div>

        {/* welcome speech bubble */}
        <div className="relative mx-4 mb-5 mt-3">
          <div className="rounded-3xl px-5 py-4" style={{
            background: "rgba(255,255,255,0.92)",
            border: "2px solid rgba(140,210,100,0.50)",
            color: "#3A5020",
            fontFamily: "'Noto Sans KR', sans-serif",
            boxShadow: "0 3px 12px rgba(60,140,30,0.10)",
          }}>
            <p className="font-black text-base mb-1" style={{ color: "#283818" }}>
              🏝️ 프메의 숲에 오신 것을 환영해요!
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "#5A7840" }}>
              미션을 시작하려면 먼저 로그인해주세요.
            </p>
          </div>
          {/* bubble tail */}
          <div className="absolute left-9 -bottom-2.5 w-0 h-0"
            style={{ borderLeft: "7px solid transparent", borderRight: "7px solid transparent", borderTop: "11px solid rgba(140,210,100,0.50)" }} />
          <div className="absolute left-9 -bottom-1.5 w-0 h-0"
            style={{ borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "9px solid rgba(255,255,255,0.92)" }} />
        </div>

        {/* buttons & guide */}
        <div className="px-4 flex flex-col gap-3 mt-2 pb-6">
          {/* Google login button */}
          <button
            onClick={onLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 rounded-2xl py-3.5 font-black text-sm transition-all active:scale-95"
            style={{
              background: "#fff",
              border: "2.5px solid rgba(140,210,100,0.55)",
              color: "#283818",
              fontFamily: "'Noto Sans KR', sans-serif",
              boxShadow: "0 5px 0 rgba(140,210,100,0.35), 0 6px 16px rgba(60,140,30,0.12)",
              cursor: loading ? "not-allowed" : "pointer",
              outline: "none",
              letterSpacing: "0.02em",
              opacity: loading ? 0.72 : 1,
            }}
            onPointerDown={(e) => {
              e.currentTarget.style.transform = "translateY(4px)";
              e.currentTarget.style.boxShadow = "0 1px 0 rgba(140,210,100,0.35)";
            }}
            onPointerUp={(e) => {
              e.currentTarget.style.transform = "";
              e.currentTarget.style.boxShadow = "0 5px 0 rgba(140,210,100,0.35), 0 6px 16px rgba(60,140,30,0.12)";
            }}
            onPointerLeave={(e) => {
              e.currentTarget.style.transform = "";
              e.currentTarget.style.boxShadow = "0 5px 0 rgba(140,210,100,0.35), 0 6px 16px rgba(60,140,30,0.12)";
            }}
          >
            {/* Google logo SVG */}
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              <path fill="none" d="M0 0h48v48H0z"/>
            </svg>
            {loading ? "로그인 중..." : "Google로 시작하기"}
          </button>

          {/* guide text */}
          <p className="text-center text-xs" style={{ color: "#90A880", fontFamily: "'Noto Sans KR', sans-serif" }}>
            로그인 후 이름과 캐릭터 정보를 입력할 수 있어요.
          </p>

          {/* decorative stickers */}
          <div className="flex justify-center gap-4 pt-3 opacity-55 select-none text-2xl">
            {["🌻","🍄","🐝","🌸","🍃"].map((e, i) => <span key={i}>{e}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}

// 1. Character Input ───────────────────────────────────────────────────────────

const CHARACTERS = ["여울","글라햄","마티","마리모","바닐라","마스터","잭슨","비앙카","참돌이","프랭크","뽀야미","사이다"];

function CharacterSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-black pl-1" style={{ color: "#3A6020", fontFamily: "'Noto Sans KR', sans-serif" }}>
        <span className="mr-1">✨</span>캐릭터명 (얼굴 인식 결과)
      </label>
      {/* selector trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-3 rounded-2xl text-sm text-left flex items-center justify-between"
        style={{
          background: open ? "#fff" : "rgba(255,255,255,0.80)",
          border: `2px solid ${open ? "#68C040" : value ? "#68C040" : "rgba(140,200,100,0.45)"}`,
          color: value ? "#283818" : "#9CAE88",
          fontFamily: "'Noto Sans KR', sans-serif",
          boxShadow: open ? "0 0 0 3px rgba(100,200,60,0.15)" : "none",
          transition: "all 120ms",
        }}
      >
        <span>{value || "캐릭터를 선택해주세요"}</span>
        <svg
          width="16" height="16" viewBox="0 0 16 16" fill="none"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 180ms", color: "#68C040", flexShrink: 0 }}
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {/* expanded character grid */}
      {open && (
        <div className="rounded-2xl overflow-hidden"
          style={{ border: "2px solid rgba(140,200,100,0.45)", background: "rgba(255,255,255,0.95)", boxShadow: "0 4px 16px rgba(60,140,30,0.12)" }}>
          <div className="p-3 flex flex-wrap gap-2 max-h-44 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            {CHARACTERS.map(c => {
              const selected = c === value;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => { onChange(c); setOpen(false); }}
                  className="px-3 py-1.5 rounded-full text-sm font-bold transition-all"
                  style={{
                    fontFamily: "'Noto Sans KR', sans-serif",
                    background: selected ? "#E8F8F0" : "rgba(240,255,245,0.7)",
                    border: `2px solid ${selected ? "#68C040" : "rgba(140,200,100,0.35)"}`,
                    color: selected ? "#3A6020" : "#5A8040",
                    boxShadow: selected ? "0 0 0 1px rgba(100,200,60,0.2)" : "none",
                  }}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ScreenCharacterInput({
  onSubmit,
  initialUser,
  loading,
}: {
  onSubmit: (d: UserData) => void;
  initialUser?: UserData;
  loading?: boolean;
}) {
  const [name, setName] = useState(initialUser?.name || "");
  const [character, setCharacter] = useState(initialUser?.character || "");
  const ready = name.trim() && character;

  return (
    <div className="flex flex-col h-full overflow-y-auto relative" style={{ scrollbarWidth: "none" }}>
      <Sky /><Clouds />
      <div className="relative z-10 flex flex-col">
        <Title />
        <Grass />
        <div className="flex justify-center my-4">
          <div className="relative">
            <div className="w-32 h-32 rounded-full flex items-center justify-center overflow-hidden"
              style={{ background: "linear-gradient(135deg,#A8E4FC,#C0F4D8)", border: "4px solid rgba(255,255,255,0.9)", boxShadow: "0 6px 20px rgba(60,160,220,0.25)" }}>
              <img src={characterImg} alt="캐릭터" className="w-full h-full object-contain" style={{ objectPosition: "center bottom", transform: "scale(1.1)" }} />
            </div>
            <span className="absolute -top-1 -right-1 text-xl select-none">✨</span>
          </div>
        </div>
        <SpeechBubble>캐릭터 정보를 입력하고 나만의 미션을 받아보세요!</SpeechBubble>
        <div className="px-4 flex flex-col gap-4 pb-8">
          <Card>
            <div className="flex flex-col gap-4">
              <Input emoji="🌱" label="이름" placeholder="홍길동" value={name} onChange={setName} />
              <CharacterSelect value={character} onChange={setCharacter} />
            </div>
          </Card>
          <Btn onClick={() => ready && !loading && onSubmit({ name: name.trim(), character: character.trim() })}
            color="green" size="lg" fullWidth disabled={!ready || loading}>
            {loading ? "저장 중..." : "🍃 미션 받기"}
          </Btn>
          <div className="flex justify-center gap-3 opacity-50 select-none text-2xl">
            {["🌻","🍄","🐝","🌸","🍂"].map((e,i)=><span key={i}>{e}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}

// 2. Mission Intro — narration dialogue ───────────────────────────────────────

function ScreenMissionIntro({ partner, onStart }: { partner: string; onStart: () => void }) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);

  const lines = [
    "오늘의 미션은 한 주민과 함께\n진행된다구리-!",
    "첫 번째 미션에서 만난 주민과\n미션 2, 3까지 함께 완료하면 된다구리-!",
    "서로 이야기를 나누고, 사진을 찍으며\n조금 더 가까워져보라구리-!",
    `오늘 함께할 주민은 ${partner}라구리!\n화이팅이다구리-! 🍃`,
  ];

  const isLast = step === lines.length - 1;

  const advance = () => {
    if (isLast) return;
    setVisible(false);
    setTimeout(() => { setStep(s => s + 1); setVisible(true); }, 160);
  };

  return (
    <div
      className="flex flex-col h-full relative select-none overflow-hidden"
      style={{ cursor: isLast ? "default" : "pointer" }}
      onClick={isLast ? undefined : advance}
    >
      {/* ── AC background image ── */}
      <img
        src={acBgImg}
        alt=""
        className="absolute inset-0 w-full h-full object-cover z-0"
        style={{ objectPosition: "center center" }}
      />
      {/* slight warm overlay to blend character */}
      <div className="absolute inset-0 z-0" style={{ background: "rgba(20,40,10,0.08)" }} />

      {/* ── step dots (top center) ── */}
      <div className="absolute z-20 flex gap-2" style={{ top: 14, left: "50%", transform: "translateX(-50%)" }}>
        {lines.map((_, i) => (
          <div key={i} style={{
            width: i === step ? 22 : 8, height: 8, borderRadius: 4,
            background: i === step ? "#fff" : "rgba(255,255,255,0.50)",
            boxShadow: i === step ? "0 1px 6px rgba(0,0,0,0.20)" : "none",
            transition: "all 250ms",
          }} />
        ))}
      </div>

      {/* ── Tom Nook — sitting on the ground of the BG ── */}
      <div className="absolute z-10 flex justify-center"
        style={{ left: 0, right: 0, bottom: 300, pointerEvents: "none" }}>
        <img
          src={tomNookImg}
          alt="너굴이"
          style={{
            height: 300,
            objectFit: "contain",
            filter: "drop-shadow(0 12px 24px rgba(0,0,0,0.30))",
          }}
        />
      </div>

      {/* ── Large AC-style speech bubble ── */}
      <div
        className="absolute z-20 left-0 right-0"
        style={{ bottom: 0, padding: "0 10px 12px" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* name badge tab */}
        <div style={{ paddingLeft: 16, marginBottom: -2, position: "relative", zIndex: 1 }}>
          <span style={{
            display: "inline-block",
            background: "#2E7C1E",
            color: "#fff",
            fontFamily: "'Noto Sans KR', sans-serif",
            fontSize: 14, fontWeight: 900,
            padding: "5px 20px",
            borderRadius: "14px 14px 0 0",
            boxShadow: "0 -2px 10px rgba(30,100,10,0.22)",
            letterSpacing: "0.05em",
          }}>
            너굴이
          </span>
        </div>

        {/* bubble body */}
        <div style={{
          background: "rgba(255,254,240,0.97)",
          borderRadius: "0 18px 18px 18px",
          border: "3px solid #B8D070",
          padding: "22px 22px 18px",
          boxShadow: "0 -6px 24px rgba(40,100,10,0.16), 0 6px 20px rgba(0,0,0,0.12)",
          minHeight: 195,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}>
          {/* narration text */}
          <p style={{
            fontFamily: "'Noto Sans KR', sans-serif",
            fontSize: 17,
            fontWeight: 700,
            color: "#1A2010",
            lineHeight: 1.85,
            whiteSpace: "pre-line",
            opacity: visible ? 1 : 0,
            transition: "opacity 160ms ease",
            flex: 1,
          }}>
            {lines[step]}
          </p>

          {/* bottom row */}
          <div className="flex items-center justify-between" style={{ marginTop: 16 }}>
            <span style={{
              fontSize: 12, color: "#8AAA68",
              fontFamily: "'Noto Sans KR', sans-serif", fontWeight: 700,
            }}>
              {step + 1} / {lines.length}
            </span>

            {isLast ? (
              <div onClick={(e) => { e.stopPropagation(); onStart(); }}>
                <Btn color="green" size="md">미션 시작하기 🌟</Btn>
              </div>
            ) : (
              <span style={{
                fontSize: 13, color: "#5A8A40",
                fontFamily: "'Noto Sans KR', sans-serif", fontWeight: 900,
                animation: "nudge 1.2s ease-in-out infinite",
              }}>
                탭해서 계속 ▼
              </span>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes nudge {
          0%, 100% { opacity: 1; transform: translateY(0); }
          50% { opacity: 0.45; transform: translateY(3px); }
        }
      `}</style>
    </div>
  );
}

// 3-pre. Find Partner ─────────────────────────────────────────────────────────

function ScreenFindPartner({ partner, onFound }: { partner: string; onFound: () => void }) {
  return (
    <div className="flex flex-col h-full relative overflow-hidden select-none">
      {/* AC background */}
      <img src={acBgImg} alt="" className="absolute inset-0 w-full h-full object-cover z-0"
        style={{ objectPosition: "center center" }} />
      <div className="absolute inset-0 z-0" style={{ background: "rgba(20,40,10,0.08)" }} />

      {/* Tom Nook */}
      <div className="absolute z-10 flex justify-center"
        style={{ left: 0, right: 0, bottom: 290, pointerEvents: "none" }}>
        <img src={tomNookImg} alt="너굴이"
          style={{ height: 300, objectFit: "contain", filter: "drop-shadow(0 12px 24px rgba(0,0,0,0.30))" }} />
      </div>

      {/* Speech bubble */}
      <div className="absolute z-20 left-0 right-0" style={{ bottom: 0, padding: "0 10px 12px" }}>
        {/* name badge */}
        <div style={{ paddingLeft: 16, marginBottom: -2 }}>
          <span style={{
            display: "inline-block", background: "#2E7C1E", color: "#fff",
            fontFamily: "'Noto Sans KR', sans-serif", fontSize: 14, fontWeight: 900,
            padding: "5px 20px", borderRadius: "14px 14px 0 0",
            boxShadow: "0 -2px 10px rgba(30,100,10,0.22)", letterSpacing: "0.05em",
          }}>너굴이</span>
        </div>

        {/* bubble body */}
        <div style={{
          background: "rgba(255,254,240,0.97)",
          borderRadius: "0 18px 18px 18px",
          border: "3px solid #B8D070",
          padding: "22px 22px 20px",
          boxShadow: "0 -6px 24px rgba(40,100,10,0.16), 0 6px 20px rgba(0,0,0,0.12)",
          minHeight: 195,
          display: "flex", flexDirection: "column", justifyContent: "space-between",
        }}>
          <p style={{
            fontFamily: "'Noto Sans KR', sans-serif",
            fontSize: 17, fontWeight: 700,
            color: "#1A2010", lineHeight: 1.85,
            whiteSpace: "pre-line", flex: 1,
          }}>
            {`오늘 미션을 같이 할\n${partner}를 먼저 찾아보세요!`}
          </p>

          <div style={{ marginTop: 18 }}>
            <Btn onClick={onFound} color="green" size="lg" fullWidth>
              🙌 찾았어요!
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// 3. Mission 1 — Timer ────────────────────────────────────────────────────────

function ScreenMission1({ partner, onClear, onBack, seconds, running, paused, onStart, onPause, onResume }: {
  partner: string; onClear: () => void; onBack: () => void;
  seconds: number; running: boolean; paused: boolean;
  onStart: () => void; onPause: () => void; onResume: () => void;
}) {
  const done = seconds === 0;
  const started = running || paused || done;

  return (
    <div className="flex flex-col h-full relative">
      <Sky />
      <div className="relative z-10 flex flex-col h-full">
        <BackRow onBack={onBack} />
        <Grass />
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4" style={{ scrollbarWidth: "none" }}>
          <MissionStepBar current={1} />

          <Card>
            <div className="flex items-start gap-3">
              <IconBadge emoji="💬" bg="#A8E4C0" size={52} />
              <div>
                <span className="text-xs font-black px-2 py-0.5 rounded-full mb-1 inline-block"
                  style={{ background: "#FFF4CC", color: "#9A7200", fontFamily: "'Noto Sans KR', sans-serif" }}>
                  미션 1
                </span>
                <h2 className="font-black text-sm leading-snug" style={{ color: "#283818", fontFamily: "'Noto Sans KR', sans-serif" }}>
                  {partner} 주민과 1분 30초 동안<br />이야기를 나누어보세요!
                </h2>
              </div>
            </div>
          </Card>

          <SpeechBubble emoji="🌿">
            섬에서 새 친구를 만났어요. 1분 30초 동안 천천히 이야기를 나누며 서로를 알아가 보세요.
          </SpeechBubble>

          <div className="flex justify-center">
            <TimerDisplay seconds={seconds} total={TIMER_TOTAL} running={running} />
          </div>

          {!started && (
            <Btn onClick={onStart} color="green" size="lg" fullWidth>
              💬 대화 시작하기
            </Btn>
          )}
          {running && !done && (
            <div className="flex gap-3">
              <Btn onClick={onPause} color="coral" size="lg" fullWidth>
                ⏸ 일시정지
              </Btn>
            </div>
          )}
          {paused && !done && (
            <div className="flex gap-3">
              <Btn onClick={onResume} color="green" size="lg" fullWidth>
                ▶ 계속하기
              </Btn>
            </div>
          )}
          {done && (
            <Btn onClick={onClear} color="green" size="lg" fullWidth>
              🌟 미션 클리어!
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
}

// 4. Mid Clear ────────────────────────────────────────────────────────────────

function ScreenMidClear({ from, onNext }: { from: 1 | 2; onNext: () => void }) {
  return (
    <div className="flex flex-col h-full relative">
      <Sky />
      <div className="relative z-10 flex flex-col h-full items-center justify-center px-5 gap-5">
        <div className="flex gap-2 text-3xl select-none">
          {["🎊","⭐","✨","⭐","🎊"].map((e,i)=><span key={i}>{e}</span>)}
        </div>
        <div className="w-full rounded-3xl flex flex-col items-center gap-4 py-8 px-5"
          style={{
            background: "rgba(255,255,255,0.92)", border: "2.5px solid rgba(140,210,100,0.50)",
            boxShadow: "0 8px 32px rgba(60,140,30,0.15)",
          }}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
            style={{ background: "linear-gradient(135deg,#A8F0C0,#78E0A0)", border: "5px solid rgba(255,255,255,0.9)", boxShadow: "0 6px 20px rgba(60,180,80,0.28)" }}>
            ⭐
          </div>
          <div className="px-8 py-2.5 rounded-full" style={{
            background: "#58C030", border: "2.5px solid #3A9018",
            boxShadow: "0 4px 0 #2E7010",
          }}>
            <p className="text-2xl font-black" style={{ color: "#fff", fontFamily: "'Noto Sans KR', sans-serif" }}>
              미션 클리어ー!
            </p>
          </div>
          <p className="text-sm text-center leading-relaxed" style={{ color: "#4A7030", fontFamily: "'Noto Sans KR', sans-serif" }}>
            미션 {from}을 완료했어요! 🌿<br />다음 미션이 열렸어요.
          </p>
          <MissionStepBar current={from + 1 as 2 | 3} />
        </div>
        <Btn onClick={onNext} color="mint" size="lg" fullWidth>
          ✨ 다음 미션으로
        </Btn>
      </div>
    </div>
  );
}

// 5. Mission 2 — Photo ────────────────────────────────────────────────────────

function ScreenMission2({ partner, missionText, photo, onPhoto, onClearPhoto, onComplete, onBack }: {
  partner: string; missionText: string; photo: string | null;
  onPhoto: (d: string) => void; onClearPhoto: () => void; onComplete: () => void; onBack: () => void;
}) {
  const missionGuide = formatMission2Title(partner, missionText);

  return (
    <div className="flex flex-col h-full relative">
      <Sky />
      <div className="relative z-10 flex flex-col h-full">
        <BackRow onBack={onBack} />
        <Grass />
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4" style={{ scrollbarWidth: "none" }}>
          <MissionStepBar current={2} />

          <Card>
            <div className="flex items-start gap-3">
              <IconBadge emoji="📸" bg="#7DD4F0" size={52} />
              <div>
                <span className="text-xs font-black px-2 py-0.5 rounded-full mb-1 inline-block"
                  style={{ background: "#FFF4CC", color: "#9A7200", fontFamily: "'Noto Sans KR', sans-serif" }}>
                  미션 2
                </span>
                <h2 className="font-black text-sm leading-snug" style={{ color: "#283818", fontFamily: "'Noto Sans KR', sans-serif" }}>
                  {partner} 주민과 함께<br />사진을 찍어보세요!
                </h2>
              </div>
            </div>
          </Card>

          <SpeechBubble emoji="📷">
            <span style={{ whiteSpace: "pre-line" }}>{missionGuide}</span>
          </SpeechBubble>

          <PhotoUpload preview={photo} onSelect={onPhoto} onClear={onClearPhoto} />

          <Btn onClick={photo ? onComplete : undefined} color={photo ? "green" : "muted"} size="lg" fullWidth disabled={!photo}>
            {photo ? "🌟 미션 클리어!" : "사진을 먼저 올려주세요"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// 6. Mission 3 — Sticker Photo ────────────────────────────────────────────────

function ScreenMission3({ partner, photo, onPhoto, onClearPhoto, onComplete, onBack }: {
  partner: string; photo: string | null;
  onPhoto: (d: string) => void; onClearPhoto: () => void; onComplete: () => void; onBack: () => void;
}) {
  return (
    <div className="flex flex-col h-full relative">
      <Sky />
      <div className="relative z-10 flex flex-col h-full">
        <BackRow onBack={onBack} />
        <Grass />
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4" style={{ scrollbarWidth: "none" }}>
          <MissionStepBar current={3} />

          <Card>
            <div className="flex items-start gap-3">
              <IconBadge emoji="🎉" bg="#FFB870" size={52} />
              <div>
                <span className="text-xs font-black px-2 py-0.5 rounded-full mb-1 inline-block"
                  style={{ background: "#FFF4CC", color: "#9A7200", fontFamily: "'Noto Sans KR', sans-serif" }}>
                  미션 3
                </span>
                <h2 className="font-black text-sm leading-snug" style={{ color: "#283818", fontFamily: "'Noto Sans KR', sans-serif" }}>
                  프메의 숲 스티커를 들고<br />함께 사진을 찍어보세요!
                </h2>
              </div>
            </div>
          </Card>

          <SpeechBubble emoji="✨">
            프메의 숲에서 만난 주민과 스티커를 들고 마지막 인증 사진을 남겨주세요.
          </SpeechBubble>

          <PhotoUpload preview={photo} onSelect={onPhoto} onClear={onClearPhoto} icon="🎊" />

          <Btn color={photo ? "green" : "muted"} size="lg" fullWidth disabled={!photo}
            onClick={photo ? onComplete : undefined}>
            {photo ? "🌟 미션 클리어!" : "사진을 먼저 올려주세요"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// 7. All Complete ─────────────────────────────────────────────────────────────

function ScreenAllComplete({ onMypage }: { onMypage: () => void }) {
  return (
    <div className="flex flex-col h-full relative">
      <Sky />
      <div className="relative z-10 flex flex-col h-full items-center justify-center px-5 gap-5">
        <div className="flex gap-1.5 text-3xl select-none">
          {["🌟","🎊","🌸","🎉","🌟"].map((e,i)=><span key={i}>{e}</span>)}
        </div>

        <div className="w-full rounded-3xl flex flex-col items-center gap-5 py-8 px-5"
          style={{
            background: "rgba(255,255,255,0.92)", border: "2.5px solid rgba(140,210,100,0.50)",
            boxShadow: "0 8px 32px rgba(60,140,30,0.15)",
          }}>
          <div className="flex gap-2">
            {["🌿","⭐","🌿"].map((e,i)=><span key={i} className="text-3xl">{e}</span>)}
          </div>
          <div className="px-6 py-3 rounded-full"
            style={{ background: "#58C030", border: "2.5px solid #3A9018", boxShadow: "0 4px 0 #2E7010" }}>
            <p className="text-xl font-black" style={{ color: "#fff", fontFamily: "'Noto Sans KR', sans-serif" }}>
              모든 미션 완료! 🎉
            </p>
          </div>
          <p className="text-sm text-center leading-relaxed" style={{ color: "#4A7030", fontFamily: "'Noto Sans KR', sans-serif" }}>
            이제 관리자에게 가서 확인을 받아보세요!<br />
            <span style={{ color: "#7AAA50" }}>마이페이지에서 미션 내역을 보여주세요.</span>
          </p>
          <MissionStepBar current={3} />
          <div className="flex gap-3 text-2xl select-none">
            {["🌻","🍄","🌸","🐝","🍂"].map((e,i)=><span key={i}>{e}</span>)}
          </div>
        </div>

        <Btn onClick={onMypage} color="green" size="lg" fullWidth>
          🦡 마이페이지에서 미션 확인하기
        </Btn>
      </div>
    </div>
  );
}

// 8. My Page ──────────────────────────────────────────────────────────────────

function ScreenMyPage({ user, partner, completedCount, onHistory, onEdit, onAdmin }: {
  user: UserData; partner: string; completedCount: number;
  onHistory: () => void; onEdit: () => void; onAdmin: () => void;
}) {
  const total = 3;
  return (
    <div className="flex flex-col h-full overflow-y-auto relative" style={{ scrollbarWidth: "none" }}>
      <Sky /><Clouds />
      <div className="relative z-10 flex flex-col">
        <Title />
        <Grass />
        <div className="px-4 mt-3 flex flex-col gap-4 pb-6">
          {/* profile card */}
          <div className="rounded-3xl overflow-hidden"
            style={{ border: "2px solid rgba(140,210,100,0.45)", boxShadow: "0 6px 24px rgba(60,140,30,0.13)" }}>
            <div className="flex flex-col items-center py-7 px-4 gap-3"
              style={{ background: "linear-gradient(160deg,#6CC840 0%,#3EA030 100%)" }}>
              <div className="relative">
                <div className="w-24 h-24 rounded-full overflow-hidden"
                  style={{ background: "linear-gradient(135deg,#A8E4FC,#C0F4D8)", border: "4px solid rgba(255,255,255,0.50)", boxShadow: "0 5px 16px rgba(0,0,0,0.14)" }}>
                  <img src={characterImg} alt="캐릭터" className="w-full h-full object-contain" style={{ transform: "scale(1.1)" }} />
                </div>
                <span className="absolute -top-1 -right-1 text-xl select-none">✨</span>
              </div>
              <div className="text-center">
                <p className="text-xl font-black" style={{ color: "#fff", fontFamily: "'Noto Sans KR', sans-serif", textShadow: "0 2px 6px rgba(0,0,0,0.18)" }}>
                  {user.name}
                </p>
                <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.80)", fontFamily: "'Noto Sans KR', sans-serif" }}>
                  {user.character} 주민 🏝️
                </p>
              </div>
            </div>
            <div className="px-4 py-4 flex flex-col gap-2" style={{ background: "rgba(255,255,255,0.92)" }}>
              {[
                { emoji: "✨", label: "캐릭터명", value: user.character },
                { emoji: "🤝", label: "함께한 주민", value: `${partner} 주민` },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between rounded-2xl px-4 py-2.5"
                  style={{ background: "#F4FCF0", border: "1.5px solid rgba(140,210,100,0.35)" }}>
                  <span className="text-xs font-black" style={{ color: "#6A9050", fontFamily: "'Noto Sans KR', sans-serif" }}>
                    {row.emoji} {row.label}
                  </span>
                  <span className="text-sm font-black" style={{ color: "#283818", fontFamily: "'Noto Sans KR', sans-serif" }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* mission progress */}
          <Card>
            <p className="font-black text-sm mb-3" style={{ color: "#283818", fontFamily: "'Noto Sans KR', sans-serif" }}>🌟 완료한 미션</p>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-4 rounded-full overflow-hidden" style={{ background: "#DFF0D0", border: "1.5px solid rgba(140,200,100,0.40)" }}>
                <div className="h-full rounded-full" style={{
                  width: `${(completedCount / total) * 100}%`,
                  background: "linear-gradient(90deg,#58C030,#8CE060)",
                  transition: "width 0.6s ease",
                }} />
              </div>
              <span className="font-black text-sm shrink-0" style={{ color: "#4A9030", fontFamily: "'Noto Sans KR', sans-serif" }}>
                {completedCount} / {total}
              </span>
            </div>
            <div className="flex gap-2">
              {["💬","📸","🎉"].map((e, i) => (
                <div key={i} className="flex-1 rounded-2xl py-3 flex flex-col items-center gap-1.5"
                  style={{
                    background: i < completedCount ? "#E8F8F0" : "rgba(255,255,255,0.70)",
                    border: `1.5px solid ${i < completedCount ? "rgba(100,200,140,0.50)" : "rgba(140,200,100,0.30)"}`,
                  }}>
                  <IconBadge emoji={e} bg={["#A8E4C0","#7DD4F0","#FFB870"][i]} size={36} />
                  <span style={{ color: i < completedCount ? "#1E7848" : "#90A880", fontFamily: "'Noto Sans KR', sans-serif", fontSize: "10px", fontWeight: 700 }}>
                    {i < completedCount ? "✅ 완료" : `미션 ${i+1}`}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Btn onClick={onHistory} color="mint" size="md" fullWidth>📋 완료한 미션 전체보기</Btn>
          <Btn onClick={onEdit} color="brown" size="md" fullWidth>✏️ 정보 수정하기</Btn>

          {/* admin button */}
          <div className="mt-2 pt-4" style={{ borderTop: "1.5px dashed rgba(140,200,100,0.40)" }}>
            <button onClick={onAdmin} className="w-full py-3 rounded-2xl text-sm font-black"
              style={{
                background: "rgba(255,255,255,0.60)", border: "2px dashed rgba(140,200,100,0.50)",
                color: "#6A9050", fontFamily: "'Noto Sans KR', sans-serif",
                cursor: "pointer", outline: "none",
              }}>
              🔐 관리자 인증하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 9. Mission History ───────────────────────────────────────────────────────────

function ScreenMissionHistory({ partner, mission2Text, photo2, photo3, onBack }: {
  partner: string; mission2Text: string; photo2: string | null; photo3: string | null; onBack: () => void;
}) {
  const missions = [
    { n: 1, title: `${partner} 주민과 1분 30초 대화`, type: "timer", emoji: "💬", bg: "#A8E4C0" },
    { n: 2, title: formatMission2Title(partner, mission2Text), type: "photo", emoji: "📸", bg: "#7DD4F0", photo: photo2 },
    { n: 3, title: "프메의 숲 스티커 들고 함께 사진", type: "photo", emoji: "🎉", bg: "#FFB870", photo: photo3 },
  ];
  return (
    <div className="flex flex-col h-full relative">
      <Sky />
      <div className="relative z-10 flex flex-col h-full">
        <BackRow onBack={onBack} />
        <Grass />
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 pb-6" style={{ scrollbarWidth: "none" }}>
          <h2 className="font-black text-base px-1" style={{ color: "#283818", fontFamily: "'Noto Sans KR', sans-serif" }}>
            📋 완료한 미션 전체보기
          </h2>
          {missions.map((m) => (
            <div key={m.n} className="rounded-3xl overflow-hidden"
              style={{ background: "rgba(255,255,255,0.92)", border: "2px solid rgba(140,210,100,0.40)", boxShadow: "0 4px 14px rgba(60,130,30,0.10)" }}>
              <div className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <IconBadge emoji={m.emoji} bg={m.bg} size={44} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-black px-2 py-0.5 rounded-full"
                        style={{ background: "#D8F5E4", color: "#1E7A48", fontFamily: "'Noto Sans KR', sans-serif" }}>
                        ✅ 완료
                      </span>
                      <span className="text-xs font-bold"
                        style={{ color: "#7AAA50", fontFamily: "'Noto Sans KR', sans-serif" }}>미션 {m.n}</span>
                    </div>
                    <p className="font-black text-sm" style={{ color: "#283818", fontFamily: "'Noto Sans KR', sans-serif" }}>
                      {m.title}
                    </p>
                  </div>
                </div>
                {m.type === "timer" && (
                  <div className="rounded-2xl px-4 py-2.5 flex items-center gap-2"
                    style={{ background: "#F0FFF4", border: "1.5px solid rgba(140,210,100,0.40)" }}>
                    <span>⏱️</span>
                    <p className="text-xs font-black" style={{ color: "#4A8030", fontFamily: "'Noto Sans KR', sans-serif" }}>
                      1분 30초 대화 완료
                    </p>
                  </div>
                )}
                {m.type === "photo" && m.photo && (
                  <img src={m.photo} alt={`미션 ${m.n} 사진`} className="w-full rounded-2xl object-cover" style={{ maxHeight: 160 }} />
                )}
                {m.type === "photo" && !m.photo && (
                  <div className="rounded-2xl px-4 py-2.5 flex items-center gap-2"
                    style={{ background: "#F0FFF4", border: "1.5px solid rgba(140,210,100,0.40)" }}>
                    <span>📷</span>
                    <p className="text-xs" style={{ color: "#4A8030", fontFamily: "'Noto Sans KR', sans-serif" }}>사진 업로드 완료</p>
                  </div>
                )}
              </div>
            </div>
          ))}
          <Btn onClick={onBack} color="green" size="md" fullWidth>← 마이페이지로 돌아가기</Btn>
        </div>
      </div>
    </div>
  );
}

// 10. Admin PIN ────────────────────────────────────────────────────────────────

function ScreenAdminPin({ onVerify, onBack }: { onVerify: (pin: string) => Promise<void>; onBack: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    setLoading(true);
    setError(false);
    try {
      await onVerify(pin);
    } catch {
      setError(true);
      setPin("");
      setTimeout(() => setError(false), 1500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full relative">
      <Sky />
      <div className="relative z-10 flex flex-col h-full">
        <BackRow onBack={onBack} />
        <Grass />
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5" style={{ scrollbarWidth: "none" }}>
          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl"
              style={{ background: "#D8F5E4", border: "2px solid rgba(140,210,100,0.50)" }}>🔐</div>
            <h2 className="font-black text-lg" style={{ color: "#283818", fontFamily: "'Noto Sans KR', sans-serif" }}>관리자 인증</h2>
            <p className="text-xs text-center" style={{ color: "#6A9050", fontFamily: "'Noto Sans KR', sans-serif" }}>
              관리자 확인 후 최종 완료 처리됩니다.
            </p>
          </div>

          <Card>
            <PinPad pin={pin} onChange={setPin} />
            {error && (
              <p className="text-center text-sm font-black mt-3" style={{ color: "#D04020", fontFamily: "'Noto Sans KR', sans-serif" }}>
                ❌ 비밀번호가 틀렸어요!
              </p>
            )}
          </Card>

          <Btn onClick={pin.length === 4 && !loading ? handleVerify : undefined}
            color="green" size="lg" fullWidth disabled={pin.length < 4 || loading}>
            {loading ? "인증 중..." : "🔐 인증하기"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// 11. Final Complete ───────────────────────────────────────────────────────────

function ScreenFinalComplete() {
  return (
    <div className="flex flex-col h-full relative">
      <Sky />
      <div className="relative z-10 flex flex-col h-full items-center justify-center px-5 gap-5">
        <div className="flex gap-1 text-4xl select-none">
          {["🎊","🌟","🎉","⭐","🎊"].map((e,i)=><span key={i}>{e}</span>)}
        </div>

        <div className="w-full rounded-3xl flex flex-col items-center gap-5 py-9 px-5"
          style={{
            background: "rgba(255,255,255,0.94)", border: "3px solid rgba(140,210,100,0.55)",
            boxShadow: "0 10px 40px rgba(60,140,30,0.18)",
          }}>
          <div className="flex gap-1.5 text-2xl select-none">
            {["🌿","🌸","✨","🌸","🌿"].map((e,i)=><span key={i}>{e}</span>)}
          </div>
          <div className="w-24 h-24 rounded-full flex items-center justify-center text-5xl"
            style={{ background: "linear-gradient(135deg,#C8F8D0,#88E8A0)", border: "5px solid rgba(255,255,255,0.9)", boxShadow: "0 6px 24px rgba(60,180,80,0.30)" }}>
            🏆
          </div>
          <div className="px-6 py-3 rounded-full"
            style={{ background: "linear-gradient(135deg,#58C030,#3EA020)", border: "2.5px solid #2E8010", boxShadow: "0 4px 0 #1E6008" }}>
            <p className="text-xl font-black" style={{ color: "#fff", fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: "0.04em" }}>
              모든 미션 클리어ー! 🎉
            </p>
          </div>
          <p className="text-sm text-center leading-relaxed" style={{ color: "#4A7030", fontFamily: "'Noto Sans KR', sans-serif" }}>
            프메의 숲 미션을 모두 완료했어요!<br />
            <span style={{ color: "#7AAA50" }}>새로운 주민과 친해진 것을 축하해요 🦡💚</span>
          </p>
          <div className="flex gap-2 text-2xl select-none">
            {["🌿","🌻","⭐","🌸","🍄"].map((e,i)=><span key={i}>{e}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════════════════════

export default function App() {
  const [screen, setScreen]   = useState<Screen>("google-login");
  const [isEditMode, setIsEditMode] = useState(false);
  const [user, setUser]       = useState<UserData>({ name: "", character: "" });
  const [partner, setPartner] = useState("잭슨");
  const [mission2Text, setMission2Text] = useState("");
  const [completedCount, setCompletedCount] = useState(0);
  const [midClearFrom, setMidClearFrom] = useState<1 | 2>(1);
  const [photo2, setPhoto2]   = useState<string | null>(null);
  const [photo3, setPhoto3]   = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [timerSeconds, setTimerSeconds] = useState(TIMER_TOTAL);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);
  const timerStartRef = useRef<number | null>(null);
  const timerElapsedRef = useRef(0);
  const timerRafRef = useRef<number | null>(null);

  const missionScreens: Screen[] = ["mission1", "mid-clear", "mission2", "mission3", "all-complete", "mypage"];
  const showTabBar = missionScreens.includes(screen);
  const activeTab: "mission" | "mypage" = screen === "mypage" ? "mypage" : "mission";

  useEffect(() => {
    if (!timerRunning) return;

    const tick = () => {
      if (timerStartRef.current === null) return;
      const elapsed = timerElapsedRef.current + (Date.now() - timerStartRef.current) / 1000;
      const remaining = Math.max(0, TIMER_TOTAL - elapsed);
      setTimerSeconds(Math.ceil(remaining));

      if (remaining > 0) {
        timerRafRef.current = requestAnimationFrame(tick);
      } else {
        setTimerRunning(false);
        setTimerPaused(false);
      }
    };

    timerStartRef.current = Date.now();
    timerRafRef.current = requestAnimationFrame(tick);

    return () => {
      if (timerRafRef.current) cancelAnimationFrame(timerRafRef.current);
    };
  }, [timerRunning]);

  const handleTimerStart = () => {
    setTimerRunning(true);
    setTimerPaused(false);
  };

  const handleTimerPause = () => {
    if (timerRafRef.current) cancelAnimationFrame(timerRafRef.current);
    if (timerStartRef.current !== null) {
      timerElapsedRef.current += (Date.now() - timerStartRef.current) / 1000;
    }
    setTimerRunning(false);
    setTimerPaused(true);
  };

  const handleTimerResume = () => {
    setTimerRunning(true);
    setTimerPaused(false);
  };

  const resetTimer = () => {
    if (timerRafRef.current) cancelAnimationFrame(timerRafRef.current);
    setTimerSeconds(TIMER_TOTAL);
    setTimerRunning(false);
    setTimerPaused(false);
    timerStartRef.current = null;
    timerElapsedRef.current = 0;
    timerRafRef.current = null;
  };

  const runAction = async (message: string, action: () => Promise<void>) => {
    setBusy(message);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "요청 처리 중 오류가 발생했어요.");
    } finally {
      setBusy(null);
    }
  };

  const toUserData = (apiUser: { name?: string; character?: string; char_name?: string }): UserData => ({
    name: apiUser.name || "",
    character: apiUser.char_name || apiUser.character || "",
  });

  const applyMissionState = (mission: MissionStatus, fallbackPartner = partner) => {
    const nextPartner = mission.partner || mission.targetCharacter || fallbackPartner;
    if (nextPartner) setPartner(nextPartner);
    if (mission.missionText) setMission2Text(mission.missionText);
    const nextCount = Math.max(0, Math.min(3, mission.completedCount ?? 0));
    setCompletedCount(nextCount);
    return { nextPartner, nextCount };
  };

  const screenFromMission = (mission: MissionStatus): Screen => {
    const count = mission.completedCount ?? 0;
    if (count >= 3 || mission.currentMission === 4) return "all-complete";
    if (count === 2 || mission.currentMission === 3) return "mission3";
    if (count === 1 || mission.currentMission === 2) return "mission2";
    return "mission-intro";
  };

  // Returns the correct mission screen based on progress
  const getCurrentMissionScreen = (): Screen => {
    if (completedCount === 0) return "mission1";
    if (completedCount === 1) return "mission2";
    if (completedCount === 2) return "mission3";
    return "all-complete";
  };

  const handleTab = (t: "mission" | "mypage") => {
    if (t === "mypage") setScreen("mypage");
    else setScreen(getCurrentMissionScreen());
  };

  const handleLogin = () => {
    runAction("로그인 중...", async () => {
      await api.login();
      const apiUser = await api.me();
      const nextUser = toUserData(apiUser);
      setUser(nextUser);

      if (!nextUser.name || !nextUser.character) {
        setScreen("character-input");
        return;
      }

      const mission = await api.getMission();
      applyMissionState(mission);
      setScreen(screenFromMission(mission));
    });
  };

  const handleCharacterSubmit = (d: UserData) => {
    runAction("프로필 저장 중...", async () => {
      const updatedUser = await api.updateProfile(d);
      const nextUser = toUserData(updatedUser);
      setUser(nextUser.name || nextUser.character ? nextUser : d);

      const mission = await api.getMission();
      applyMissionState(mission);

      if (isEditMode) {
        setIsEditMode(false);
        setScreen("mypage");
      } else {
        setScreen("mission-intro");
      }
    });
  };

  const handleMission1Clear = () => {
    runAction("미션 1 저장 중...", async () => {
      await api.completeMission1();
      const mission = await api.getMission();
      applyMissionState(mission);
      resetTimer();
      setCompletedCount(1);
      setMidClearFrom(1);
      setScreen("mid-clear");
    });
  };

  const handleMission2Clear = () => {
    if (!photo2) return;
    runAction("미션 2 사진 업로드 중...", async () => {
      await api.completeMission2(photo2);
      const mission = await api.getMission();
      applyMissionState(mission);
      setCompletedCount(2);
      setMidClearFrom(2);
      setScreen("mid-clear");
    });
  };

  const handleMission3Clear = () => {
    if (!photo3) return;
    runAction("미션 3 사진 업로드 중...", async () => {
      await api.completeMission3(photo3);
      setCompletedCount(3);
      setScreen("all-complete");
    });
  };

  const handleMidNext = () => {
    setScreen(midClearFrom === 1 ? "mission2" : "mission3");
  };

  const handleHistory = () => {
    runAction("미션 내역 불러오는 중...", async () => {
      const history = await api.getHistory();
      if (history.partner || history.targetCharacter) {
        setPartner(history.partner || history.targetCharacter || partner);
      }
      if (history.mission2Text) setMission2Text(history.mission2Text);
      if (history.mission2Image) setPhoto2(history.mission2Image);
      if (history.mission3Image) setPhoto3(history.mission3Image);
      setCompletedCount([history.mission1Done, history.mission2Done, history.mission3Done].filter(Boolean).length);
      setScreen("mission-history");
    });
  };

  const handleAdminVerify = async (pin: string) => {
    await api.verifyAdmin(pin);
    setScreen("final-complete");
  };

  return (
    <div className="flex items-center justify-center min-h-screen w-full"
      style={{
        background: "radial-gradient(ellipse at 50% 25%,#78CC50 0%,#4AA030 55%,#2A7818 100%)",
        fontFamily: "'Noto Sans KR','Nunito',sans-serif",
      }}>
      <div className="relative flex flex-col overflow-hidden" style={{
        width: 393, height: 852, borderRadius: 52, flexShrink: 0,
        boxShadow: ["0 0 0 12px #183A08","0 0 0 14px #3A8020","0 32px 80px rgba(0,0,0,0.50)"].join(", "),
        background: "#C8EDF5",
      }}>
        {/* dynamic island */}
        <div className="absolute top-3.5 left-1/2 -translate-x-1/2 z-30"
          style={{ width: 120, height: 34, background: "#0A0A0A", borderRadius: 20 }} />

        {busy && <Notice type="loading" message={busy} />}
        {error && <Notice type="error" message={error} onClose={() => setError("")} />}

        {/* content */}
        <div className="absolute inset-0 z-10 flex flex-col pt-14">
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-hidden flex flex-col">
              {screen === "google-login"    && <ScreenGoogleLogin onLogin={handleLogin} loading={Boolean(busy)} />}
              {screen === "character-input" && <ScreenCharacterInput onSubmit={handleCharacterSubmit} initialUser={user} loading={Boolean(busy)} />}
              {screen === "mission-intro"   && <ScreenMissionIntro partner={partner} onStart={() => setScreen("find-partner")} />}
              {screen === "find-partner"   && <ScreenFindPartner partner={partner} onFound={() => setScreen("mission1")} />}
              {screen === "mission1"        && (
                <ScreenMission1
                  partner={partner}
                  onClear={handleMission1Clear}
                  onBack={() => setScreen("mission-intro")}
                  seconds={timerSeconds}
                  running={timerRunning}
                  paused={timerPaused}
                  onStart={handleTimerStart}
                  onPause={handleTimerPause}
                  onResume={handleTimerResume}
                />
              )}
              {screen === "mid-clear"       && <ScreenMidClear from={midClearFrom} onNext={handleMidNext} />}
              {screen === "mission2"        && (
                <ScreenMission2
                  partner={partner} missionText={mission2Text} photo={photo2}
                  onPhoto={setPhoto2}
                  onClearPhoto={() => setPhoto2(null)}
                  onComplete={handleMission2Clear}
                  onBack={() => setScreen("mission-intro")}
                />
              )}
              {screen === "mission3"        && (
                <ScreenMission3
                  partner={partner} photo={photo3}
                  onPhoto={setPhoto3}
                  onClearPhoto={() => setPhoto3(null)}
                  onComplete={handleMission3Clear}
                  onBack={() => setScreen("mission-intro")}
                />
              )}
              {screen === "all-complete"    && <ScreenAllComplete onMypage={() => setScreen("mypage")} />}
              {screen === "mypage"          && (
                <ScreenMyPage
                  user={user} partner={partner} completedCount={completedCount}
                  onHistory={handleHistory}
                  onEdit={() => { setIsEditMode(true); setScreen("character-input"); }}
                  onAdmin={() => setScreen("admin-pin")}
                />
              )}
              {screen === "mission-history" && (
                <ScreenMissionHistory
                  partner={partner} mission2Text={mission2Text} photo2={photo2} photo3={photo3}
                  onBack={() => setScreen("mypage")}
                />
              )}
              {screen === "admin-pin"       && (
                <ScreenAdminPin onVerify={handleAdminVerify} onBack={() => setScreen("mypage")} />
              )}
              {screen === "final-complete"  && <ScreenFinalComplete />}
            </div>
            {showTabBar && <TabBar active={activeTab} onTab={handleTab} />}
          </div>
        </div>

        {/* home bar */}
        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-30">
          <div className="w-32 h-1 rounded-full" style={{ background: "rgba(20,60,10,0.28)" }} />
        </div>
      </div>
    </div>
  );
}
