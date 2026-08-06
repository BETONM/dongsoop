const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const USE_DEV_TOKEN = import.meta.env.VITE_USE_DEV_TOKEN === "true" || !GOOGLE_CLIENT_ID;

const TOKEN_KEY = "prome_forest_access_token";

type JsonRecord = Record<string, unknown>;

export interface ApiUser {
  id?: string | number;
  google_id?: string;
  name?: string;
  email?: string;
  character?: string;
  char_name?: string;
  profileImage?: string;
  imageUrl?: string;
  completed_mission?: number;
  developer_verified?: boolean;
}

export interface MissionStatus {
  currentMission?: number;
  completedCount?: number;
  partner?: string;
  targetCharacter?: string;
  missionText?: string;
  mission1Done?: boolean;
  mission2Done?: boolean;
  mission3Done?: boolean;
}

export interface MissionHistory {
  mission1Done?: boolean;
  mission2Done?: boolean;
  mission3Done?: boolean;
  mission2Text?: string;
  mission2Image?: string | null;
  mission3Image?: string | null;
  partner?: string;
  targetCharacter?: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          prompt: (listener?: (notification: unknown) => void) => void;
        };
      };
    };
  }
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

function normalizeImageDataUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  if (value.startsWith("data:image/")) return value;
  return `data:image/jpeg;base64,${value}`;
}

function extractToken(payload: unknown): string {
  const root = payload as JsonRecord | null;
  const data = root?.data as JsonRecord | undefined;
  const candidates = [
    root?.accessToken,
    root?.access_token,
    root?.token,
    root?.jwt,
    data?.accessToken,
    data?.access_token,
    data?.token,
    data?.jwt,
  ];

  const token = candidates.find((value): value is string => typeof value === "string" && value.length > 0);
  if (!token) {
    throw new Error("로그인 응답에서 JWT 토큰을 찾지 못했어요.");
  }
  return token;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers);

  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(apiUrl(path), {
    ...options,
    headers,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.error ||
      `API 요청 실패 (${response.status})`;
    throw new Error(String(message));
  }

  return payload as T;
}

function dataUrlToBase64(dataUrl: string) {
  return dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
}

function extractUser(payload: unknown): ApiUser {
  const root = payload as JsonRecord | null;
  const data = root?.data as JsonRecord | undefined;
  const user = root?.user as JsonRecord | undefined;
  return (user || data?.user || data || root || {}) as ApiUser;
}

function boolValue(value: unknown) {
  return value === true || value === "completed" || value === "done" || value === 1;
}

export function normalizeMission(payload: unknown): MissionStatus {
  const root = payload as JsonRecord | null;
  const data = root?.data as JsonRecord | undefined;
  const mission = (root?.mission || data?.mission || data || root || {}) as JsonRecord;

  const currentMission =
    Number(mission.currentMission ?? mission.current_mission ?? mission.missionNumber ?? mission.mission_number ?? mission.number) ||
    (root?.message === "모든 미션을 완료했습니다. " ? 4 : 1);

  const completedCount =
    Number(mission.completedCount ?? mission.completed_count ?? mission.completedMissions ?? mission.completed_missions) ||
    [mission.mission1Done, mission.mission2Done, mission.mission3Done].filter(boolValue).length ||
    Math.max(0, Math.min(currentMission - 1, 3));

  return {
    currentMission,
    completedCount,
    partner: String(mission.partner ?? mission.partnerCharacter ?? mission.partner_character ?? mission.targetCharacter ?? mission.target_character ?? mission.target_char ?? ""),
    targetCharacter: String(mission.targetCharacter ?? mission.target_character ?? mission.target_char ?? mission.partner ?? ""),
    missionText: String(mission.mission ?? ""),
    mission1Done: boolValue(mission.mission1Done ?? mission.mission_1_done),
    mission2Done: boolValue(mission.mission2Done ?? mission.mission_2_done),
    mission3Done: boolValue(mission.mission3Done ?? mission.mission_3_done),
  };
}

export function normalizeHistory(payload: unknown): MissionHistory {
  const root = payload as JsonRecord | null;
  const data = root?.data as JsonRecord | undefined;
  const history = (root?.history || data?.history || data || root || {}) as JsonRecord;
  const mission1 = history.mission1 as JsonRecord | null | undefined;
  const mission2 = history.mission2 as JsonRecord | null | undefined;
  const mission3 = history.mission3 as JsonRecord | null | undefined;

  return {
    mission1Done: boolValue(history.mission1Done ?? history.mission_1_done ?? mission1?.completed),
    mission2Done: boolValue(history.mission2Done ?? history.mission_2_done ?? mission2?.completed),
    mission3Done: boolValue(history.mission3Done ?? history.mission_3_done ?? mission3?.completed),
    mission2Text: String(history.mission2Text ?? history.mission_2_text ?? mission2?.mission ?? ""),
    mission2Image: normalizeImageDataUrl(history.mission2Image ?? history.mission_2_image ?? history.photo2 ?? history.image2 ?? mission2?.image),
    mission3Image: normalizeImageDataUrl(history.mission3Image ?? history.mission_3_image ?? history.photo3 ?? history.image3 ?? mission3?.image),
    partner: String(history.partner ?? history.partnerCharacter ?? history.partner_character ?? history.targetCharacter ?? mission1?.target_char ?? mission2?.target_char ?? ""),
    targetCharacter: String(history.targetCharacter ?? history.target_character ?? history.partner ?? mission1?.target_char ?? mission2?.target_char ?? ""),
  };
}

async function loadGoogleIdentityScript() {
  if (window.google?.accounts?.id) return;

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-google-identity]");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Google 로그인 스크립트 로드 실패")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google 로그인 스크립트 로드 실패"));
    document.head.appendChild(script);
  });
}

async function loginWithGoogle() {
  await loadGoogleIdentityScript();

  const credential = await new Promise<string>((resolve, reject) => {
    if (!window.google?.accounts?.id) {
      reject(new Error("Google 로그인 객체를 찾지 못했어요."));
      return;
    }

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response) => {
        if (response.credential) resolve(response.credential);
        else reject(new Error("Google 인증 토큰을 받지 못했어요."));
      },
    });
    window.google.accounts.id.prompt();
  });

  const payload = await request<unknown>("/api/auth/google", {
    method: "POST",
    body: JSON.stringify({
      credential,
      idToken: credential,
    }),
  });

  const token = extractToken(payload);
  setStoredToken(token);
  return token;
}

export const api = {
  async login() {
    if (!USE_DEV_TOKEN) {
      return loginWithGoogle();
    }

    const payload = await request<unknown>("/api/auth/dev-token");
    const token = extractToken(payload);
    setStoredToken(token);
    return token;
  },

  async me() {
    return extractUser(await request<unknown>("/api/user/me"));
  },

  async updateProfile(profile: { name: string; character: string }) {
    return extractUser(await request<unknown>("/api/user/profile", {
      method: "PATCH",
      body: JSON.stringify({
        name: profile.name,
        char_name: profile.character,
      }),
    }));
  },

  async getMission() {
    return normalizeMission(await request<unknown>("/api/mission"));
  },

  async completeMission1() {
    return normalizeMission(await request<unknown>("/api/mission/1", { method: "PATCH" }));
  },

  async completeMission2(imageDataUrl: string) {
    const imageBase64 = dataUrlToBase64(imageDataUrl);
    return normalizeMission(await request<unknown>("/api/mission/2", {
      method: "PATCH",
      body: JSON.stringify({
        imageBase64,
        image: imageBase64,
      }),
    }));
  },

  async completeMission3(imageDataUrl: string) {
    const imageBase64 = dataUrlToBase64(imageDataUrl);
    return normalizeMission(await request<unknown>("/api/mission/3", {
      method: "PATCH",
      body: JSON.stringify({
        imageBase64,
        image: imageBase64,
      }),
    }));
  },

  async getHistory() {
    return normalizeHistory(await request<unknown>("/api/history"));
  },

  async verifyAdmin(password: string) {
    await request<unknown>("/api/user/verify", {
      method: "PATCH",
      body: JSON.stringify({
        password,
        pin: password,
      }),
    });
  },

  clearToken: clearStoredToken,
  getToken: getStoredToken,
};
