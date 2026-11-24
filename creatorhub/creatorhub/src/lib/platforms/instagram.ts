import { api, form, PlatformAdapter, PlatformError, sleep } from "./types";

const GRAPH = "https://graph.instagram.com/v21.0";
const appId = () => process.env.INSTAGRAM_APP_ID ?? "";
const appSecret = () => process.env.INSTAGRAM_APP_SECRET ?? "";

export const instagram: PlatformAdapter = {
  id: "INSTAGRAM",
  isConfigured: () => !!(appId() && appSecret()),

  authUrl(state, redirectUri) {
    const q = new URLSearchParams({
      client_id: appId(),
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "instagram_business_basic,instagram_business_content_publish",
      state,
    });
    return `https://www.instagram.com/oauth/authorize?${q}`;
  },

  async exchangeCode(code, redirectUri) {
    const short = await api(
      "https://api.instagram.com/oauth/access_token",
      form({ client_id: appId(), client_secret: appSecret(), grant_type: "authorization_code", redirect_uri: redirectUri, code: code.replace(/#_$/, "") }),
      "Instagram"
    );
    const q = new URLSearchParams({ grant_type: "ig_exchange_token", client_secret: appSecret(), access_token: short.access_token });
    const long = await api(`https://graph.instagram.com/access_token?${q}`, undefined, "Instagram");
    const me = await api(`${GRAPH}/me?fields=user_id,username&access_token=${long.access_token}`, undefined, "Instagram");
    return {
      externalId: String(me.user_id ?? short.user_id),
      displayName: me.username ? `@${me.username}` : "Cuenta de Instagram",
      accessToken: long.access_token,
      expiresAt: new Date(Date.now() + long.expires_in * 1000),
    };
  },

  async refresh(acc) {
    const q = new URLSearchParams({ grant_type: "ig_refresh_token", access_token: acc.accessToken });
    const t = await api(`https://graph.instagram.com/refresh_access_token?${q}`, undefined, "Instagram");
    return { accessToken: t.access_token, expiresAt: new Date(Date.now() + t.expires_in * 1000) };
  },

  async publish(i) {
    const base = process.env.APP_URL ?? "";
    if (!base.startsWith("https://") || /localhost|127\.0\.0\.1/.test(base)) {
      throw new PlatformError(
        "Instagram descarga el video desde una URL pública HTTPS. Configura APP_URL con un túnel (ngrok, Cloudflare Tunnel) o tu dominio y reinicia la app.",
        false
      );
    }
    const caption = [i.title, i.description, i.hashtags.map((t) => "#" + t).join(" ")].filter(Boolean).join("\n\n");
    const params: Record<string, string> = {
      access_token: i.accessToken,
      media_type: "REELS",
      video_url: `${base}/api/public-media/${i.mediaToken}`,
      caption,
      share_to_feed: String(i.settings.shareToFeed !== false),
    };
    const cover = Number(i.settings.coverSec) || 0;
    if (cover > 0) params.thumb_offset = String(Math.round(cover * 1000));

    // 1) Crear el contenedor (Instagram descarga el video)
    const container = await api(`${GRAPH}/${i.externalAccountId}/media`, form(params), "Instagram");

    // 2) Esperar a que termine de procesarlo
    let ready = false;
    for (let n = 0; n < 60; n++) {
      const st = await api(`${GRAPH}/${container.id}?fields=status_code,status&access_token=${i.accessToken}`, undefined, "Instagram");
      if (st.status_code === "FINISHED") { ready = true; break; }
      if (st.status_code === "ERROR" || st.status_code === "EXPIRED") {
        throw new PlatformError(`Instagram rechazó el video: ${st.status ?? st.status_code}`, false);
      }
      await sleep(5000);
    }
    if (!ready) throw new PlatformError("Instagram sigue procesando el video tras 5 minutos. Revisa tu cuenta antes de reintentar.", false);

    // 3) Publicar. Si falla por red aquí no se reintenta solo para no duplicar.
    let pub: any;
    try {
      pub = await api(`${GRAPH}/${i.externalAccountId}/media_publish`, form({ creation_id: container.id, access_token: i.accessToken }), "Instagram");
    } catch (e) {
      if (e instanceof PlatformError) e.retryable = false;
      throw e;
    }
    let url: string | undefined;
    try {
      const m = await api(`${GRAPH}/${pub.id}?fields=permalink&access_token=${i.accessToken}`, undefined, "Instagram");
      url = m.permalink;
    } catch {}
    return { externalId: pub.id, url };
  },
};
