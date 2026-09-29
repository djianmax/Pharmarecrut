// Supabase Edge Function : inviter-offre
// Envoie à une pharmacie inscrite (sans offre payée) l'e-mail
// « Il ne manque que votre offre » avec un lien direct vers le dépôt.
// Appelée uniquement depuis l'admin ; vérifie elle-même que l'appelant est l'administrateur.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ADMIN_EMAIL = "djianmaxime@gmail.com";
const SITE = "https://pharmarecrut.fr";
const LINK = SITE + "/?go=deposer";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function emailHtml(prenom: string, pharmacie: string) {
  const bonjour = prenom ? `Bonjour ${esc(prenom)},` : "Bonjour,";
  const pour = pharmacie ? ` pour <b>${esc(pharmacie)}</b>` : "";
  const li = (t: string) =>
    `<tr><td style="padding:4px 10px 4px 0;vertical-align:top;color:#0E7A5F;font-weight:bold">✓</td><td style="padding:4px 0;color:#1F2A26;font-size:15px;line-height:1.5">${t}</td></tr>`;
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#F4F7F5;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F7F5;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:#0E7A5F;padding:22px 28px;color:#ffffff;font-size:20px;font-weight:bold">✚ PharmaRecrut</td></tr>
<tr><td style="padding:30px 28px 8px;color:#1F2A26;font-size:15px;line-height:1.6">
<p style="margin:0 0 14px">${bonjour}</p>
<p style="margin:0 0 14px">Vous vous êtes inscrit${pour} sur PharmaRecrut, merci de votre confiance !</p>
<p style="margin:0 0 18px"><b>Il ne manque plus que le dépôt de votre offre</b> pour accéder à toutes les fonctionnalités :</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px">
${li("Votre annonce en ligne <b>30 jours</b>, visible par les pharmaciens, préparateurs et étudiants de votre secteur")}
${li("L'accès complet à la <b>CVthèque</b> : CV, photo, e-mail et téléphone des candidats")}
${li("La <b>messagerie</b> pour contacter directement les profils qui vous intéressent")}
</table>
<p style="margin:0 0 22px">15 € TTC l'offre — sans abonnement, sans engagement. Le dépôt prend 2 minutes.</p>
<p style="margin:0 0 10px;font-weight:bold">Cela vous intéresse ? Cliquez ici :</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 26px"><tr><td style="background:#0E7A5F;border-radius:10px">
<a href="${LINK}" style="display:inline-block;padding:14px 26px;color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px">Déposer mon offre</a>
</td></tr></table>
<p style="margin:0 0 6px;font-size:13px;color:#5B6B64">Si le bouton ne fonctionne pas, copiez ce lien : <a href="${LINK}" style="color:#0E7A5F">${LINK}</a></p>
<p style="margin:18px 0 0">Une question ? Répondez simplement à cet e-mail.</p>
<p style="margin:6px 0 26px">L'équipe PharmaRecrut</p>
</td></tr>
<tr><td style="padding:16px 28px;background:#F4F7F5;color:#7A8A83;font-size:12px;line-height:1.5">
Vous recevez cet e-mail car vous avez créé un compte pharmacie sur <a href="${SITE}" style="color:#7A8A83">pharmarecrut.fr</a>.
</td></tr></table></td></tr></table></body></html>`;
}

function emailText(prenom: string, pharmacie: string) {
  return `${prenom ? "Bonjour " + prenom + "," : "Bonjour,"}

Vous vous êtes inscrit${pharmacie ? " pour " + pharmacie : ""} sur PharmaRecrut, merci de votre confiance !

Il ne manque plus que le dépôt de votre offre pour accéder à toutes les fonctionnalités :
- votre annonce en ligne 30 jours, visible par les pharmaciens, préparateurs et étudiants de votre secteur
- l'accès complet à la CVthèque (CV, photo, e-mail et téléphone des candidats)
- la messagerie pour contacter directement les candidats

15 € TTC l'offre — sans abonnement, sans engagement.

Cela vous intéresse ? Cliquez ici : ${LINK}

L'équipe PharmaRecrut`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    // 1. Seul l'administrateur peut déclencher l'envoi
    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ ok: false, error: "Accès refusé (non connecté)" }, 401);
    const { data: u, error: authErr } = await db.auth.getUser(token);
    const who = String(u?.user?.email || "").toLowerCase();
    if (authErr || !u?.user) return json({ ok: false, error: "Accès refusé (session invalide : " + (authErr?.message || "inconnue") + ") — déconnectez-vous puis reconnectez-vous à l'admin" }, 403);
    if (who !== ADMIN_EMAIL) return json({ ok: false, error: "Accès refusé (connecté en tant que " + who + ")" }, 403);

    const { pharmacyId } = await req.json().catch(() => ({}));
    if (!pharmacyId) return json({ ok: false, error: "pharmacyId manquant" }, 400);

    // 2. Fiche pharmacie
    const { data: row, error } = await db.from("accounts_pharmacies").select("*").eq("id", pharmacyId).maybeSingle();
    if (error) return json({ ok: false, error: error.message }, 500);
    if (!row) return json({ ok: false, error: "Fiche pharmacie introuvable" }, 404);
    const p = row.payload || {};
    const to = String(row.contact_email || "").trim();
    if (!to.includes("@")) return json({ ok: false, error: "Aucun e-mail sur cette fiche" }, 400);
    const prenom = String(p.prenom || String(row.titulaire_nom || "").split(" ")[0] || "").trim();
    const pharmacie = String(row.pharmacy_name || p.officine || "").trim();

    // 3. Envoi via Resend
    const key = Deno.env.get("RESEND_API_KEY");
    if (!key) return json({ ok: false, error: "Secret RESEND_API_KEY absent" }, 500);
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: Deno.env.get("EMAIL_FROM") || "PharmaRecrut <contact@pharmarecrut.fr>",
        to: [to],
        reply_to: "contact@pharmarecrut.fr",
        subject: "Votre compte est prêt — il ne manque que votre offre",
        html: emailHtml(prenom, pharmacie),
        text: emailText(prenom, pharmacie),
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      return json({ ok: false, error: "Resend : " + t.slice(0, 300) }, 502);
    }

    // 4. On note la date d'envoi sur la fiche (affichée dans l'admin)
    await db.from("accounts_pharmacies")
      .update({ payload: { ...p, incitationEnvoyeeLe: new Date().toISOString() } })
      .eq("id", pharmacyId);

    return json({ ok: true, to });
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message || e) }, 500);
  }
});
