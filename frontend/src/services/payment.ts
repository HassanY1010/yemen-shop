// ============================================
// Payment Service — Stripe + Sandbox Mode
// ============================================

export interface CheckoutSessionParams {
  orderId: number;
  orderNumber: string;
  storeSlug: string;
  storeName: string;
  currency: string;
  items: { name: string; price: number; quantity: number }[];
  discountAmount?: number;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResult {
  sessionId: string;
  checkoutUrl: string;
  isSandbox: boolean;
}

export class PaymentService {
  /**
   * Create a Stripe (or sandbox) checkout session.
   * If STRIPE_SECRET_KEY is not set, returns a sandbox simulation URL.
   */
  static async createCheckoutSession(
    params: CheckoutSessionParams,
    env: any
  ): Promise<CheckoutSessionResult> {
    const stripeKey = env?.STRIPE_SECRET_KEY;

    if (!stripeKey) {
      // ─── Sandbox Mode ─────────────────────────────────────────
      const fakeSessionId = `sandbox_${Date.now()}_${params.orderId}`;
      const sandboxUrl = `${params.successUrl}?session_id=${fakeSessionId}&sandbox=1`;
      return {
        sessionId: fakeSessionId,
        checkoutUrl: sandboxUrl,
        isSandbox: true,
      };
    }

    // ─── Real Stripe Mode ────────────────────────────────────────
    const lineItems = params.items.map((item) => ({
      price_data: {
        currency: params.currency.toLowerCase(),
        product_data: { name: item.name },
        unit_amount: Math.round(item.price * 100), // Stripe uses cents/halalas
      },
      quantity: item.quantity,
    }));

    // Add discount as negative line item if applicable
    if (params.discountAmount && params.discountAmount > 0) {
      lineItems.push({
        price_data: {
          currency: params.currency.toLowerCase(),
          product_data: { name: 'خصم الكوبون' },
          unit_amount: -Math.round(params.discountAmount * 100),
        },
        quantity: 1,
      });
    }

    const body = new URLSearchParams();
    lineItems.forEach((item, idx) => {
      body.append(`line_items[${idx}][price_data][currency]`, item.price_data.currency);
      body.append(`line_items[${idx}][price_data][product_data][name]`, item.price_data.product_data.name);
      body.append(`line_items[${idx}][price_data][unit_amount]`, item.price_data.unit_amount.toString());
      body.append(`line_items[${idx}][quantity]`, item.quantity.toString());
    });
    body.append('mode', 'payment');
    body.append('success_url', params.successUrl + '?session_id={CHECKOUT_SESSION_ID}');
    body.append('cancel_url', params.cancelUrl);
    if (params.customerEmail) body.append('customer_email', params.customerEmail);
    body.append('metadata[order_id]', params.orderId.toString());
    body.append('metadata[order_number]', params.orderNumber);
    body.append('metadata[store_slug]', params.storeSlug);

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const err = await response.json() as any;
      throw new Error(err?.error?.message || 'Stripe checkout session creation failed');
    }

    const session = await response.json() as any;
    return {
      sessionId: session.id,
      checkoutUrl: session.url,
      isSandbox: false,
    };
  }

  /**
   * Verify a Stripe webhook signature.
   * Returns the event object if valid.
   */
  static async verifyWebhookSignature(
    body: string,
    signature: string,
    secret: string
  ): Promise<any> {
    // Parse the timestamp and signatures from the Stripe-Signature header
    const elements = signature.split(',');
    let timestamp = '';
    const signatures: string[] = [];

    for (const el of elements) {
      const [key, value] = el.split('=');
      if (key === 't') timestamp = value;
      if (key === 'v1') signatures.push(value);
    }

    if (!timestamp || signatures.length === 0) {
      throw new Error('Invalid Stripe signature header');
    }

    // Compute expected signature using WebCrypto
    const payload = `${timestamp}.${body}`;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(payload);

    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const expectedSig = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const isValid = signatures.some(sig => sig === expectedSig);
    if (!isValid) throw new Error('Stripe webhook signature mismatch');

    return JSON.parse(body);
  }

  /**
   * Retrieve a Stripe checkout session by ID.
   */
  static async retrieveSession(sessionId: string, stripeKey: string): Promise<any> {
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      headers: { 'Authorization': `Bearer ${stripeKey}` },
    });
    if (!response.ok) throw new Error('Failed to retrieve Stripe session');
    return response.json();
  }
}
