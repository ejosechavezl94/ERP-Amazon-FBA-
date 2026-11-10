import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// In-memory LWA access token cache (reused across invocations until expiry)
let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

async function getLwaAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<{ accessToken?: string; error?: string; fromCache?: boolean }> {
  const now = Date.now();
  if (cachedAccessToken && now < tokenExpiresAt) {
    return { accessToken: cachedAccessToken, fromCache: true };
  }

  const tokenRes = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }).toString(),
  });

  const tokenData = await tokenRes.json().catch(() => ({}));

  if (!tokenRes.ok || !tokenData.access_token) {
    cachedAccessToken = null;
    tokenExpiresAt = 0;
    const errMsg =
      tokenData.error_description ||
      tokenData.error ||
      `Error LWA (${tokenRes.status}) al obtener access_token en https://api.amazon.com/auth/o2/token`;
    return { error: errMsg };
  }

  const expiresInSec = Number(tokenData.expires_in) || 3600;
  cachedAccessToken = tokenData.access_token;
  // Keep a 60s safety margin before actual expiration
  tokenExpiresAt = Date.now() + Math.max(expiresInSec - 60, 60) * 1000;

  return { accessToken: cachedAccessToken, fromCache: false };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const checkedAt = new Date().toISOString();

  try {
    // 1. Require a valid Supabase Auth JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({
          connected: false,
          status: "No autorizado",
          checkedAt,
          error: "No autorizado: se requiere un JWT válido de Supabase Auth.",
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({
          connected: false,
          status: "No autorizado",
          checkedAt,
          error: "Sesión de Supabase Auth inválida o expirada.",
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ALLOWED_PARTNER_EMAILS = ["ejosechavezl18@gmail.com", "josh.rg6@gmail.com"];
    const userEmail = (userData.user.email || "").toLowerCase().trim();
    if (!ALLOWED_PARTNER_EMAILS.includes(userEmail)) {
      return new Response(
        JSON.stringify({
          connected: false,
          status: "Acceso denegado",
          checkedAt,
          error: "Acceso denegado: esta cuenta no pertenece a los socios autorizados del ERP.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Read SP-API secrets exclusively from project environment (strip accidental quotes/spaces)
    const cleanSecret = (val?: string) =>
      val ? val.trim().replace(/^["']+|["']+$/g, "").trim() : "";

    const clientId = cleanSecret(Deno.env.get("SPAPI_CLIENT_ID"));
    const clientSecret = cleanSecret(Deno.env.get("SPAPI_CLIENT_SECRET"));
    const refreshToken = cleanSecret(Deno.env.get("SPAPI_REFRESH_TOKEN"));
    const marketplaceId = cleanSecret(Deno.env.get("SPAPI_MARKETPLACE_ID")) || "A1RKKUPIHCS9HS";

    const missingSecrets: string[] = [];
    if (!clientId) missingSecrets.push("SPAPI_CLIENT_ID");
    if (!clientSecret) missingSecrets.push("SPAPI_CLIENT_SECRET");
    if (!refreshToken) missingSecrets.push("SPAPI_REFRESH_TOKEN");

    if (missingSecrets.length > 0) {
      return new Response(
        JSON.stringify({
          connected: false,
          status: "Error de configuración",
          marketplaceId,
          checkedAt,
          missingSecrets,
          error: `Faltan secrets en Supabase Edge Functions: ${missingSecrets.join(", ")}`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate format prefixes (without ever leaking secret values)
    const formatHints: string[] = [];
    if (clientId.startsWith("amzn1.sp.solution")) {
      formatHints.push(
        "En SPAPI_CLIENT_ID has pegado el 'ID de la aplicación' (amzn1.sp.solution...). Debes pegar el 'ID de cliente' de Credenciales de LWA (empieza por amzn1.application-oa2-client...)."
      );
    } else if (!clientId.startsWith("amzn1.application-oa2-client")) {
      formatHints.push(
        "SPAPI_CLIENT_ID no tiene el formato esperado (debe empezar por amzn1.application-oa2-client...)."
      );
    }
    if (clientSecret.startsWith("amzn1.application-oa2-client") || clientSecret.startsWith("amzn1.sp.solution")) {
      formatHints.push(
        "En SPAPI_CLIENT_SECRET has pegado un ID en lugar del 'Secreto del cliente' LWA (debe empezar por amzn1.oa2-cs.v1...)."
      );
    }
    if (!refreshToken.startsWith("Atzr|")) {
      formatHints.push(
        "SPAPI_REFRESH_TOKEN no tiene el formato esperado (debe empezar por Atzr|...)."
      );
    }

    // Parse action (defaults to "status")
    let action = "status";
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body?.action) action = body.action;
    }

    // 3. Exchange refresh token for LWA access token (with in-memory caching)
    const lwa = await getLwaAccessToken(clientId, clientSecret, refreshToken);
    if (lwa.error || !lwa.accessToken) {
      const hintSuffix = formatHints.length > 0 ? ` — Diagnóstico: ${formatHints.join(" ")}` : "";
      return new Response(
        JSON.stringify({
          connected: false,
          status: "Error LWA",
          marketplaceId,
          checkedAt,
          error: `Amazon LWA: ${lwa.error}${hintSuffix}`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Status action: GET https://sellingpartnerapi-eu.amazon.com/sellers/v1/marketplaceParticipations
    if (action === "status") {
      const spapiUrl = "https://sellingpartnerapi-eu.amazon.com/sellers/v1/marketplaceParticipations";
      const spapiRes = await fetch(spapiUrl, {
        method: "GET",
        headers: {
          "x-amz-access-token": lwa.accessToken,
          "Accept": "application/json",
        },
      });

      const spapiJson = await spapiRes.json().catch(() => ({}));

      if (!spapiRes.ok || spapiJson?.errors) {
        const amzErr = spapiJson?.errors?.[0];
        const errText = amzErr
          ? `${amzErr.code ? `[${amzErr.code}] ` : ""}${amzErr.message || "Error devuelto por Amazon SP-API"}${amzErr.details ? ` (${amzErr.details})` : ""}`
          : `Error HTTP ${spapiRes.status} al consultar /sellers/v1/marketplaceParticipations`;

        return new Response(
          JSON.stringify({
            connected: false,
            status: "Error SP-API",
            marketplaceId,
            checkedAt,
            httpStatus: spapiRes.status,
            amazonErrors: spapiJson?.errors || null,
            error: errText,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const participations = Array.isArray(spapiJson?.payload) ? spapiJson.payload : [];
      const matched =
        participations.find((p: Record<string, Record<string, string>>) => p?.marketplace?.id === marketplaceId) ||
        participations[0] ||
        null;

      const marketplaceObj = matched?.marketplace || {
        id: marketplaceId,
        name: marketplaceId === "A1RKKUPIHCS9HS" ? "Amazon.es" : marketplaceId,
        countryCode: "ES",
        defaultCurrencyCode: "EUR",
        domainName: "www.amazon.es",
      };

      return new Response(
        JSON.stringify({
          connected: true,
          status: "Conectado",
          marketplaceId: marketplaceObj.id || marketplaceId,
          marketplaceName: marketplaceObj.name || "Amazon.es",
          countryCode: marketplaceObj.countryCode || "ES",
          defaultCurrencyCode: marketplaceObj.defaultCurrencyCode || "EUR",
          domainName: marketplaceObj.domainName || "www.amazon.es",
          isParticipating: matched?.participation?.isParticipating ?? true,
          hasSuspendedListings: matched?.participation?.hasSuspendedListings ?? false,
          totalMarketplaces: participations.length,
          participations,
          tokenFromCache: lwa.fromCache,
          checkedAt,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        connected: false,
        checkedAt,
        error: `Acción no soportada: ${action}`,
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        connected: false,
        status: "Error",
        checkedAt,
        error: err instanceof Error ? err.message : "Error inesperado en la Edge Function sp-api",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
