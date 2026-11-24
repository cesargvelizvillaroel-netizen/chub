import { compose } from "./meta";
import { api, form, PlatformAdapter, PlatformError } from "./types";
import { putFile } from "./upload";

const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const id = () => process.env.GOOGLE_CLIENT_ID ?? "";
const secret = () => process.env.GOOGLE_CLIENT_SECRET ?? "";

export const youtube: PlatformAdapter = {
  id: "YOUTUBE",
  isConfigured: () => !!(id() && secret()),

  authUrl(state, redirectUri) {
    const q = new URLSearchParams({
      client_id: id(),
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly",
      access_type: "offline",
      prompt: "consent",
      state,
    });
    return `${AUTH}?${q}`;
  },

  async exchangeCode(code, redirectUri) {
    const t = await api(
      TOKEN,
      form({ code, client_id: id(), client_secret: secret(), redirect_uri: redirectUri, grant_type: "authorization_code" }),
      "Google"
    );
    const ch = await api(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      { headers: { Authorization: `Bearer ${t.access_token}` } },
      "YouTube"
    );
    const c = ch.items?.[0];
    if (!c) throw new PlatformError("Esa cuenta de Google no tiene un canal de YouTube.");
    return {
      externalId: c.id,
      displayName: c.snippet.title,
      accessToken: t.access_token,
      refreshToken: t.refresh_token,
      expiresAt: new Date(Date.now() + t.expires_in * 1000),
    };
  },

  async refresh(acc) {
    if (!acc.refreshToken) throw new PlatformError("Falta el token de renovación de YouTube. Vuelve a conectar la cuenta.");
    const t = await api(
      TOKEN,
      form({ client_id: id(), client_secret: secret(), refresh_token: acc.refreshToken, grant_type: "refresh_token" }),
      "Google"
    );
    return { accessToken: t.access_token, refreshToken: acc.refreshToken, expiresAt: new Date(Date.now() + t.expires_in * 1000) };
  },

  async publish(i) {
    const { title, body } = compose("YOUTUBE", i);
    const metadata = {
      snippet: { title, description: body, categoryId: "22", tags: i.hashtags },
      status: { privacyStatus: i.settings.privacy ?? "public", selfDeclaredMadeForKids: !!i.settings.madeForKids },
    };
    // 1) Sesión de subida reanudable
    let init: Response;
    try {
      init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${i.accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Length": String(i.size),
          "X-Upload-Content-Type": i.mimeType,
        },
        body: JSON.stringify(metadata),
      });
    } catch (e) {
      throw new PlatformError(`YouTube: error de red (${(e as Error).message})`, true);
    }
    if (!init.ok) {
      const t = await init.text();
      const quota = /quota/i.test(t);
      throw new PlatformError(`YouTube (${init.status}): ${t.slice(0, 300)}`, !quota && (init.status >= 500 || init.status === 429));
    }
    const location = init.headers.get("location");
    if (!location) throw new PlatformError("YouTube no devolvió la URL de subida.", true);

    // 2) Subida del archivo
    const up = await putFile(location, { "Content-Length": String(i.size), "Content-Type": i.mimeType }, i.videoPath, undefined, "YouTube");
    const text = await up.text();
    if (!up.ok) throw new PlatformError(`YouTube subida (${up.status}): ${text.slice(0, 300)}`, false);
    const data = JSON.parse(text);
    return { externalId: data.id, url: `https://www.youtube.com/shorts/${data.id}` };
  },
};
