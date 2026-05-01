// Alpha Terminal — Lemonsqueezy webhook handler
// Reçoit les events Lemonsqueezy, vérifie la signature HMAC SHA-256,
// active/désactive premium_access et log dans payments + audit_webhooks.
//
// Déploiement : supabase functions deploy lemonsqueezy-webhook
// Secrets requis : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LEMONSQUEEZY_WEBHOOK_SECRET

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const webhookSecret = Deno.env.get('LEMONSQUEEZY_WEBHOOK_SECRET')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ---- Vérification HMAC SHA-256 (timing-safe) ----
async function verifyHmac(rawBody: string, signature: string, secret: string): Promise<boolean> {
  if (!signature || !secret) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const macBuf = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  const expected = Array.from(new Uint8Array(macBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  // Comparaison constante (anti-timing attack)
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  // 1. Lire le raw body (nécessaire pour HMAC)
  const raw = await req.text();
  const signature = req.headers.get('x-signature') || '';

  // 2. Valider la signature
  const valid = await verifyHmac(raw, signature, webhookSecret);
  if (!valid) {
    console.warn('[lemonsqueezy-webhook] HMAC mismatch');
    return jsonResponse({ error: 'Invalid signature' }, 401);
  }

  // 3. Parser le payload
  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const eventName: string | undefined = body?.meta?.event_name;
  const userId: string | undefined = body?.meta?.custom_data?.user_id;
  const subscriptionId: string | undefined = body?.data?.id;
  const attributes = body?.data?.attributes || {};

  // 4. Audit du webhook (idempotent — une ligne par event reçu)
  await supabase.from('audit_webhooks').insert({
    event_type: eventName || 'unknown',
    webhook_payload: body,
    processed: false,
  });

  if (!eventName || !userId) {
    return jsonResponse({ ok: true, skipped: 'missing event_name or user_id' });
  }

  try {
    // ---- Activation initiale ou reprise ----
    if (eventName === 'subscription_created' || eventName === 'subscription_resumed') {
      const { error: rpcErr } = await supabase.rpc('activate_premium', {
        p_user_id: userId,
        p_lemonsqueezy_subscription_id: subscriptionId,
      });
      if (rpcErr) throw rpcErr;

      // Log du paiement (UPSERT par lemonsqueezy_order_id)
      const orderId = String(attributes.order_id ?? subscriptionId);
      const customerId = String(attributes.customer_id ?? '');
      const amountCents = Number(attributes.subtotal ?? attributes.total ?? 999);
      const currency = String(attributes.currency ?? 'EUR');

      await supabase.from('payments').upsert(
        {
          user_id: userId,
          lemonsqueezy_order_id: orderId,
          lemonsqueezy_customer_id: customerId,
          amount_cents: amountCents,
          currency,
          status: 'paid',
        },
        { onConflict: 'lemonsqueezy_order_id' }
      );
    }

    // ---- Renouvellement : MAJ de la date d'expiration ----
    else if (eventName === 'subscription_updated') {
      const renewsAt = attributes.renews_at;
      if (renewsAt && subscriptionId) {
        await supabase
          .from('premium_access')
          .update({
            is_active: true,
            subscription_expires_at: renewsAt,
            updated_at: new Date().toISOString(),
          })
          .eq('lemonsqueezy_subscription_id', subscriptionId);
      }
    }

    // ---- Annulation / expiration ----
    else if (
      eventName === 'subscription_cancelled' ||
      eventName === 'subscription_expired'
    ) {
      if (subscriptionId) {
        await supabase
          .from('premium_access')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('lemonsqueezy_subscription_id', subscriptionId);
      }
    }

    // ---- Paiement échoué ----
    else if (eventName === 'subscription_payment_failed') {
      const orderId = String(attributes.order_id ?? subscriptionId);
      await supabase.from('payments').upsert(
        {
          user_id: userId,
          lemonsqueezy_order_id: orderId,
          lemonsqueezy_customer_id: String(attributes.customer_id ?? ''),
          amount_cents: Number(attributes.subtotal ?? 0),
          currency: String(attributes.currency ?? 'EUR'),
          status: 'failed',
        },
        { onConflict: 'lemonsqueezy_order_id' }
      );
    }

    // Marque le webhook comme traité
    await supabase
      .from('audit_webhooks')
      .update({ processed: true })
      .eq('event_type', eventName)
      .order('created_at', { ascending: false })
      .limit(1);

    return jsonResponse({ ok: true, event: eventName });
  } catch (err: any) {
    console.error('[lemonsqueezy-webhook] handler error:', err);
    return jsonResponse({ error: err.message || 'Internal error' }, 500);
  }
});
