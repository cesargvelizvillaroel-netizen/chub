import { api, form, PlatformAdapter, PlatformError, sleep } from "./types";
import { putFile } from "./upload";

const BASE = "https://open.tiktokapis.com/v2";
const key = () => process.env.TIKTOK_CLIENT_KEY ?? "";
const secret = () => process.env.TIKTOK_CLIENT_SECRET ?? "";

/** Llama a la API de TikTok y convierte los errores (que llegan con HTTP 200) en excepciones. */
async function tt(path: string, token: string, body: unknown) {
  const data = await api(
    `${BASE}${path}`,
    { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" }, body: JSON.stringify(body) },
    "TikTok"
  );
  const code = data?.error?.code;
  if (code && code !== "ok") {
    throw new PlatformError(`TikTok: ${data.error.message || code} (${code})`, code === "rate_limit_exceeded" || code === "internal_error");
  }
  return data.data ?? {};
}

export const tiktok: PlatformAdapter = {
  id: "TIKTOK",
  isConfigured: () => !!(key() && secret()),

  authUrl(state, redirectUri) {
    const q = new URLSearchParams({
      client_key: key(),
      scope: "user.info.basic,video.publish,video.upload",
      response_type: "code",
      redirect_uri: redirectUri,
      state,
    });
    return `https://www.tiktok.com/v2/auth/authorize/?${q}`;
  },

  async exchangeCode(code, redirectUri) {
    const t = await api(
      `${BASE}/oauth/token/`,
      form({ client_key: key(), client_secret: secret(), code, grant_type: "authorization_code", redirect_uri: redirectUri }),
      "TikTok"
    );
    if (!t.access_token) throw new PlatformError(`TikTok: ${t.error_description ?? "no devolvió token"}`);
    let displayName = "Cuenta de TikTok";
    try {
      const u = await api(`${BASE}/user/info/?fields=open_id,display_name`, { headers: { Authorization: `Bearer ${t.access_token}` } }, "TikTok");
      displayName = u?.data?.user?.display_name ?? displayName;
    } catch {}
    return {
      externalId: t.open_id,
      displayName,
      accessToken: t.access_token,
      refreshToken: t.refresh_token,
      expiresAt: new Date(Date.now() + t.expires_in * 1000),
    };
  },

  async refresh(acc) {
    if (!acc.refreshToken) throw new PlatformError("Falta el token de renovación de TikTok. Vuelve a conectar la cuenta.");
    const t = await api(
      `${BASE}/oauth/token/`,
      form({ client_key: key(), client_secret: secret(), grant_type: "refresh_token", refresh_token: acc.refreshToken }),
      "TikTok"
    );
    if (!t.access_token) throw new PlatformError("TikTok no renovó el acceso. Vuelve a conectar la cuenta.");
    return { accessToken: t.access_token, refreshToken: t.refresh_token ?? acc.refreshToken, expiresAt: new Date(Date.now() + t.expires_in * 1000) };
  },

  async publish(i) {
    const direct = (i.settings.mode ?? "direct") === "direct";
    const size = i.size;
    const MAX = 64 * 1024 * 1024;
    const chunk = size <= MAX ? size : 32 * 1024 * 1024;
    const total = Math.floor(size / chunk);
    const source_info = { source: "FILE_UPLOAD", video_size: size, chunk_size: chunk, total_chunk_count: total };
    const caption = [i.title, i.description, i.hashtags.map((t) => "#" + t).join(" ")].filter(Boolean).join("\n");

    let init: any;
    if (direct) {
      const info = await tt("/post/publish/creator_info/query/", i.accessToken, {});
      if (info.max_video_post_duration_sec && i.durationSec > info.max_video_post_duration_sec) {
        throw new PlatformError(`Tu cuenta de TikTok solo permite videos de hasta ${info.max_video_post_duration_sec}s.`);
      }
      const options: string[] = info.privacy_level_options ?? [];
      let privacy: string = i.settings.privacy ?? "SELF_ONLY";
      if (options.length && !options.includes(privacy)) privacy = options[0];
      init = await tt("/post/publish/video/init/", i.accessToken, {
        post_info: {
          title: caption,
          privacy_level: privacy,
          disable_comment: !!i.settings.disableComment,
          video_cover_timestamp_ms: Math.round((Number(i.settings.coverSec) || 0) * 1000),
        },
        source_info,
      });
    } else {
      init = await tt("/post/publish/inbox/video/init/", i.accessToken, { source_info });
    }
    const { publish_id, upload_url } = init;
    if (!publish_id || !upload_url) throw new PlatformError("TikTok no devolvió los datos de subida.", true);

    for (let n = 0; n < total; n++) {
      const start = n * chunk;
      const end = n === total - 1 ? size - 1 : start + chunk - 1;
      const r = await putFile(
        upload_url,
        { "Content-Type": i.mimeType, "Content-Length": String(end - start + 1), "Content-Range": `bytes ${start}-${end}/${size}` },
        i.videoPath,
        { start, end },
        "TikTok"
      );
      if (![200, 201, 206].includes(r.status)) {
        throw new PlatformError(`TikTok subida (${r.status}): ${(await r.text()).slice(0, 200)}`, false);
      }
    }

    // TikTok procesa el video después de recibirlo: consultamos el estado real.
    for (let n = 0; n < 40; n++) {
      await sleep(5000);
      const st = await tt("/post/publish/status/fetch/", i.accessToken, { publish_id });
      if (st.status === "PUBLISH_COMPLETE") return { externalId: String(st.publicaly_available_post_id?.[0] ?? publish_id) };
      if (st.status === "SEND_TO_USER_INBOX") {
        return { externalId: publish_id, note: "Enviado a tus borradores de TikTok. Ábrelo en la app para terminar de publicarlo." };
      }
      if (st.status === "FAILED") throw new PlatformError(`TikTok rechazó el video: ${st.fail_reason ?? "motivo desconocido"}`, false);
    }
    throw new PlatformError("TikTok sigue procesando el video tras 3 minutos. Revisa la app de TikTok antes de reintentar.", false);
  },
};
