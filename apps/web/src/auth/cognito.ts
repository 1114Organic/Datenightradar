export interface RuntimeConfig {
  apiBaseUrl: string;
  authMode: "dev" | "cognito";
  cognitoDomain?: string;
  userPoolClientId?: string;
}

export interface AuthSession {
  idToken: string;
  accessToken: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  groups: string[];
}

const sessionKey = "date-night-radar-auth-session";
const verifierKey = "date-night-radar-pkce-verifier";

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  try {
    const response = await fetch("/runtime-config.json", { cache: "no-store" });
    if (response.ok && response.headers.get("content-type")?.includes("application/json")) return response.json();
  } catch {
    // Local dev falls through to Vite environment values.
  }
  return {
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api",
    authMode: (import.meta.env.VITE_AUTH_MODE as RuntimeConfig["authMode"]) ?? "dev",
    cognitoDomain: import.meta.env.VITE_COGNITO_DOMAIN,
    userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID
  };
}

export function getStoredSession(): AuthSession | undefined {
  const raw = localStorage.getItem(sessionKey);
  if (!raw) return undefined;
  try {
    const session = JSON.parse(raw) as AuthSession;
    const claims = parseJwt(session.idToken);
    if (claims.exp && Date.now() / 1000 > claims.exp) {
      clearStoredSession();
      return undefined;
    }
    return session;
  } catch {
    clearStoredSession();
    return undefined;
  }
}

export function clearStoredSession() {
  localStorage.removeItem(sessionKey);
  sessionStorage.removeItem(verifierKey);
}

export async function beginHostedAuth(config: RuntimeConfig, mode: "login" | "signup" | "reset") {
  const verifier = createVerifier();
  sessionStorage.setItem(verifierKey, verifier);
  const challenge = await createChallenge(verifier);
  const path = mode === "signup" ? "/signup" : mode === "reset" ? "/forgotPassword" : "/login";
  const url = new URL(`${required(config.cognitoDomain, "cognitoDomain")}${path}`);
  url.searchParams.set("client_id", required(config.userPoolClientId, "userPoolClientId"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  window.location.assign(url.toString());
}

export async function completeHostedAuth(config: RuntimeConfig): Promise<AuthSession | undefined> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  if (!code) return getStoredSession();
  const verifier = sessionStorage.getItem(verifierKey);
  if (!verifier) throw new Error("Missing login verifier. Please sign in again.");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: required(config.userPoolClientId, "userPoolClientId"),
    code,
    redirect_uri: redirectUri(),
    code_verifier: verifier
  });
  const response = await fetch(`${required(config.cognitoDomain, "cognitoDomain")}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body
  });
  if (!response.ok) throw new Error("Unable to finish sign in.");
  const token = await response.json() as { id_token: string; access_token: string };
  const claims = parseJwt(token.id_token);
  const session: AuthSession = {
    idToken: token.id_token,
    accessToken: token.access_token,
    email: claims.email,
    firstName: claims.given_name,
    lastName: claims.family_name,
    groups: Array.isArray(claims["cognito:groups"]) ? claims["cognito:groups"] : []
  };
  localStorage.setItem(sessionKey, JSON.stringify(session));
  sessionStorage.removeItem(verifierKey);
  window.history.replaceState({}, document.title, window.location.pathname);
  return session;
}

export function signOut(config: RuntimeConfig) {
  clearStoredSession();
  if (config.authMode !== "cognito" || !config.cognitoDomain || !config.userPoolClientId) {
    window.location.reload();
    return;
  }
  const url = new URL(`${config.cognitoDomain}/logout`);
  url.searchParams.set("client_id", config.userPoolClientId);
  url.searchParams.set("logout_uri", redirectUri());
  window.location.assign(url.toString());
}

function redirectUri() {
  return window.location.origin + window.location.pathname;
}

function required(value: string | undefined, name: string) {
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function createVerifier() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64Url(bytes);
}

async function createChallenge(verifier: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

function base64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function parseJwt(token: string): Record<string, any> {
  const [, payload] = token.split(".");
  return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
}
