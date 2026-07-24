import fs from 'node:fs/promises';
import path from 'node:path';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export interface SmsOptions {
  to: string;
  message: string;
}

/**
 * Notification Service
 * Manages automated emails and WhatsApp/SMS alerts with local simulation support.
 */
export class NotificationService {
  private static async ensureDir(dirPath: string) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch {}
  }

  /**
   * Persists a smart notification to database
   */
  public static async createNotification(db: any, options: {
    user_type: 'admin' | 'merchant' | 'customer';
    user_id?: number | null;
    store_id?: number | null;
    title: string;
    message: string;
    link?: string;
    type?: string;
  }) {
    if (!db) return;
    try {
      try {
        await db.prepare(`
          CREATE TABLE IF NOT EXISTS system_notifications (
            id SERIAL PRIMARY KEY,
            user_type VARCHAR(50) NOT NULL,
            user_id INT DEFAULT NULL,
            store_id INT DEFAULT NULL,
            title VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            link VARCHAR(255) DEFAULT '',
            type VARCHAR(50) DEFAULT 'system',
            is_read INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `).run();
      } catch (e1) {
        try {
          await db.prepare(`
            CREATE TABLE IF NOT EXISTS system_notifications (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_type TEXT NOT NULL,
              user_id INTEGER DEFAULT NULL,
              store_id INTEGER DEFAULT NULL,
              title TEXT NOT NULL,
              message TEXT NOT NULL,
              link TEXT DEFAULT '',
              type TEXT DEFAULT 'system',
              is_read INTEGER DEFAULT 0,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `).run();
        } catch (e2) {}
      }

      await db.prepare(`
        INSERT INTO system_notifications (user_type, user_id, store_id, title, message, link, type, is_read, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
      `).bind(
        options.user_type,
        options.user_id || null,
        options.store_id || null,
        options.title,
        options.message,
        options.link || '',
        options.type || 'system'
      ).run();
    } catch (err) {
      console.error('Error creating system notification:', err);
    }
  }

  /**
   * Sends an email (via Resend API if credentials available, or saves locally for simulation)
   */
  public static async sendEmail(options: EmailOptions, env: any): Promise<{ success: boolean; previewUrl?: string }> {
    const fromEmail = options.from || 'no-reply@sooq-platform.com';
    
    // Check if Resend API key is available in env
    const resendKey = env.RESEND_API_KEY;
    if (resendKey && resendKey !== 'YOUR_RESEND_API_KEY') {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: `SaaS Sooq <${fromEmail}>`,
            to: [options.to],
            subject: options.subject,
            html: options.html
          })
        });
        
        if (response.ok) {
          console.log(`Email successfully sent to ${options.to} via Resend`);
          return { success: true };
        } else {
          const err = await response.text();
          console.error(`Resend API failed: ${err}`);
        }
      } catch (err) {
        console.error('Failed to send email via Resend:', err);
      }
    }

    // Fallback: Local Email Simulation
    try {
      const emailDir = './public/static/emails';
      await this.ensureDir(emailDir);
      
      const safeSubject = options.subject.replace(/[^a-zA-Z0-9\u0600-\u06FF\s]/g, '').trim();
      const filename = `${Date.now()}-${safeSubject}.html`;
      const filePath = path.join(emailDir, filename);
      
      // Save HTML invoice for local inspection
      await fs.writeFile(filePath, options.html, 'utf8');
      
      // Append to local mail log
      const logEntry = `[${new Date().toISOString()}] To: ${options.to} | Subject: ${options.subject} | File: /static/emails/${filename}\n`;
      await fs.appendFile(path.join(emailDir, 'mail_log.txt'), logEntry, 'utf8');
      
      console.log(`[Local Simulation] Email saved to ${filePath}`);
      return { success: true, previewUrl: `/static/emails/${filename}` };
    } catch (err) {
      console.error('Failed to simulate email local write:', err);
      return { success: false };
    }
  }

  /**
   * Sends an SMS/WhatsApp (via Twilio if credentials available, or logs locally for simulation)
   */
  public static async sendSms(options: SmsOptions, env: any): Promise<{ success: boolean }> {
    const accountSid = env.TWILIO_ACCOUNT_SID;
    const authToken = env.TWILIO_AUTH_TOKEN;
    const fromPhone = env.TWILIO_FROM_PHONE; // Twilio phone or WhatsApp sender e.g. whatsapp:+14155238886

    if (accountSid && authToken && fromPhone && accountSid !== 'YOUR_TWILIO_SID') {
      try {
        const isWhatsApp = fromPhone.startsWith('whatsapp:');
        const toPhone = isWhatsApp && !options.to.startsWith('whatsapp:') ? `whatsapp:${options.to}` : options.to;
        
        const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
        const bodyParams = new URLSearchParams({
          From: fromPhone,
          To: toPhone,
          Body: options.message
        });

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: bodyParams.toString()
        });

        if (response.ok) {
          console.log(`SMS/WhatsApp successfully sent to ${options.to} via Twilio`);
          return { success: true };
        } else {
          const err = await response.text();
          console.error(`Twilio API failed: ${err}`);
        }
      } catch (err) {
        console.error('Failed to send SMS/WhatsApp via Twilio:', err);
      }
    }

    // Fallback: Local SMS Simulation
    try {
      const smsDir = './public/static/sms';
      await this.ensureDir(smsDir);
      
      const logEntry = `[${new Date().toISOString()}] To: ${options.to} | Message: "${options.message}"\n`;
      await fs.appendFile(path.join(smsDir, 'sms_log.txt'), logEntry, 'utf8');
      
      console.log(`[Local Simulation] SMS logged to ./public/static/sms/sms_log.txt`);
      return { success: true };
    } catch (err) {
      console.error('Failed to simulate SMS local write:', err);
      return { success: false };
    }
  }

  /**
   * Trigger notifications for a newly created order
   */
  public static async notifyNewOrder(db: any, orderId: number, env: any) {
    try {
      // 1. Fetch Order and Store data
      const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first() as any;
      if (!order) return;

      const store = await db.prepare('SELECT * FROM stores WHERE id = ?').bind(order.store_id).first() as any;
      if (!store) return;

      const merchant = await db.prepare('SELECT * FROM users WHERE id = ?').bind(store.user_id).first() as any;

      const items = await db.prepare(`
        SELECT oi.*, p.sku FROM order_items oi
        LEFT JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = ?
      `).bind(orderId).all();

      const itemsList = items.results as any[];

      // 2. Generate HTML Invoice for Customer
      const customerInvoiceHtml = this.generateInvoiceTemplate(order, store, itemsList);

      // 3. Send Email to Customer
      if (order.customer_email) {
        await this.sendEmail({
          to: order.customer_email,
          subject: `فاتورة طلبك رقم ${order.order_number} - متجر ${store.name}`,
          html: customerInvoiceHtml
        }, env);
      }

      // 4. Send Email to Merchant
      if (merchant && merchant.email) {
        const merchantNotificationHtml = `
          <div style="font-family: sans-serif; direction: rtl; text-align: right; padding: 20px;">
            <h2 style="color: #4F46E5;">🎉 طلب جديد في متجرك!</h2>
            <p>مرحباً <strong>${merchant.name}</strong>،</p>
            <p>تم استلام طلب جديد رقم <strong>${order.order_number}</strong> في متجرك <strong>${store.name}</strong>.</p>
            <p><strong>تفاصيل العميل:</strong></p>
            <ul>
              <li>الاسم: ${order.customer_name}</li>
              <li>الهاتف: ${order.customer_phone}</li>
              <li>المدينة: ${order.shipping_city || 'غير محدد'}</li>
            </ul>
            <p>الإجمالي: <strong>${order.total} ${order.currency}</strong></p>
            ${order.payment_method === 'receipt' ? `<p style="color: #c2410c; background: #fff7ed; padding: 10px; border-radius: 6px;">⚠️ <strong>تنبيه:</strong> العميل قام باختيار الدفع عبر <strong>إرفاق سند تحويل</strong>. يرجى مراجعة السند المرفق في لوحة التحكم وتأكيد الدفع.</p>` : ''}
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
            <a href="${env.PLATFORM_URL || 'http://localhost:3000'}/dashboard/orders/${order.id}" 
               style="background: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px; display: inline-block;">
               عرض وإدارة الطلب في لوحة التحكم
            </a>
          </div>
        `;
        
        await this.sendEmail({
          to: merchant.email,
          subject: `🔔 طلب جديد رقم ${order.order_number} - متجر ${store.name}`,
          html: merchantNotificationHtml
        }, env);
      }

      // 5. Send WhatsApp/SMS confirmation to Customer
      if (order.customer_phone) {
        const smsMessage = `مرحباً ${order.customer_name}، تم استلام طلبك رقم (${order.order_number}) بنجاح لدى متجر ${store.name}. القيمة الإجمالية: ${order.total} ${order.currency}. شكراً لتسوقك معنا!`;
        await this.sendSms({
          to: order.customer_phone,
          message: smsMessage
        }, env);
      }

      // 6. Create Persistent In-App Notifications
      // Merchant Notification
      await this.createNotification(db, {
        user_type: 'merchant',
        user_id: merchant?.id,
        store_id: store.id,
        title: 'طلب جديد 🎉',
        message: `تم استلام طلب جديد رقم #${order.order_number} بقيمة ${order.total} ${order.currency}`,
        link: `/dashboard/orders`,
        type: 'order'
      });

      // Customer Notification
      if (order.customer_id) {
        await this.createNotification(db, {
          user_type: 'customer',
          user_id: order.customer_id,
          store_id: store.id,
          title: 'تم إنشاء طلبك بنجاح',
          message: `شكراً لتسوقك! طلبك رقم #${order.order_number} قيد التجهيز الآن`,
          link: `/store/${store.slug}/track?order=${order.order_number}&phone=${order.customer_phone}`,
          type: 'order'
        });
      }

      // Admin Notification (if receipt uploaded)
      if (order.payment_method === 'receipt') {
        await this.createNotification(db, {
          user_type: 'admin',
          title: 'رفع سند تحويل جديد 📄',
          message: `تم إرفاق سند تحويل للطلب #${order.order_number} في متجر ${store.name}`,
          link: `/admin/orders`,
          type: 'payment'
        });
      }
    } catch (err) {
      console.error('Error triggering new order notifications:', err);
    }
  }

  /**
   * Trigger notifications when order status changes (shipped, completed, etc.)
   */
  public static async notifyOrderStatusUpdate(db: any, orderId: number, status: string, env: any) {
    try {
      const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first() as any;
      if (!order) return;

      const store = await db.prepare('SELECT * FROM stores WHERE id = ?').bind(order.store_id).first() as any;
      if (!store) return;

      // Status text in Arabic
      const statusMap: Record<string, string> = {
        pending: 'قيد الانتظار',
        processing: 'قيد المعالجة والتجهيز',
        completed: 'مكتمل وتم التوصيل',
        cancelled: 'ملغي'
      };
      
      const arabicStatus = statusMap[status] || status;

      // Create Persistent Customer Notification
      if (order.customer_id) {
        await this.createNotification(db, {
          user_type: 'customer',
          user_id: order.customer_id,
          store_id: store.id,
          title: 'تحديث حالة الطلب 🚚',
          message: `تم تغيير حالة طلبك رقم #${order.order_number} إلى: [${arabicStatus}]`,
          link: `/store/${store.slug}/track?order=${order.order_number}&phone=${order.customer_phone}`,
          type: 'order'
        });
      }

      // 1. Send SMS/WhatsApp to Customer
      if (order.customer_phone) {
        let smsMessage = `عزيزي ${order.customer_name}، تم تحديث حالة طلبك رقم (${order.order_number}) لدى متجر ${store.name} إلى: [${arabicStatus}].`;
        
        if (status === 'completed') {
          smsMessage += ` شكراً لك ونسعد بخدمتك دائماً!`;
        } else if (status === 'cancelled') {
          smsMessage += ` إذا كان لديك أي استفسار يرجى التواصل معنا.`;
        }
        
        await this.sendSms({
          to: order.customer_phone,
          message: smsMessage
        }, env);
      }

      // 2. Send Email update to Customer
      if (order.customer_email) {
        const emailHtml = `
          <div style="font-family: sans-serif; direction: rtl; text-align: right; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h2 style="color: #4F46E5; margin: 0;">تحديث حالة الطلب</h2>
              <p style="color: #64748b; margin-top: 5px;">متجر ${store.name}</p>
            </div>
            <p>مرحباً <strong>${order.customer_name}</strong>،</p>
            <p>نود إعلامك بأن حالة طلبك رقم <strong style="color: #4F46E5;">${order.order_number}</strong> قد تم تحديثها إلى:</p>
            
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; text-align: center; margin: 20px 0; font-size: 18px; font-weight: bold; color: #1e293b;">
              ${arabicStatus}
            </div>

            <p style="font-size: 14px; color: #64748b; line-height: 1.6;">
              يمكنك التواصل مع إدارة المتجر مباشرة عبر الواتساب في حال وجود أي استفسارات أو تفاصيل إضافية.
            </p>
            
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;">
            <div style="text-align: center; font-size: 12px; color: #94a3b8;">
              جميع الحقوق محفوظة © ${new Date().getFullYear()} ${store.name} | مدعوم بـ منصة سوق اليمن
            </div>
          </div>
        `;

        await this.sendEmail({
          to: order.customer_email,
          subject: `🔄 تحديث لطلبك رقم ${order.order_number} - متجر ${store.name}`,
          html: emailHtml
        }, env);
      }
    } catch (err) {
      console.error('Error triggering order status update notifications:', err);
    }
  }

  /**
   * Helper: Generate a premium HTML Invoice
   */
  private static generateInvoiceTemplate(order: any, store: any, items: any[]): string {
    const primary = store.primary_color || '#4F46E5';
    
    const itemsRows = items.map(item => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 12px 0; font-weight: bold; color: #1e293b; text-align: right;">${item.product_name}</td>
        <td style="padding: 12px 0; color: #64748b; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px 0; color: #64748b; text-align: left;">${item.price.toLocaleString('ar-SA')} ${order.currency}</td>
        <td style="padding: 12px 0; font-weight: bold; color: #1e293b; text-align: left;">${item.total.toLocaleString('ar-SA')} ${order.currency}</td>
      </tr>
    `).join('');

    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px; line-height: 1.6; }
    .invoice-card { max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); overflow: hidden; }
    .invoice-header { padding: 30px; border-bottom: 1px solid #e2e8f0; text-align: center; color: white; }
    .invoice-body { padding: 30px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
    .table-container { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    .summary-section { border-top: 2px solid #e2e8f0; padding-top: 15px; display: flex; flex-direction: column; align-items: flex-start; }
    .summary-row { display: flex; justify-content: space-between; width: 100%; max-width: 250px; margin-right: auto; padding: 4px 0; font-size: 14px; }
    .summary-row.total { font-size: 18px; font-weight: bold; color: ${primary}; border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 5px; }
  </style>
</head>
<body>
  <div class="invoice-card">
    <!-- Header -->
    <div class="invoice-header" style="background: linear-gradient(135deg, ${primary}, ${primary}cc);">
      <h2 style="margin: 0; font-size: 24px;">فاتورة شراء</h2>
      <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">متجر ${store.name}</p>
    </div>
    
    <div class="invoice-body">
      <!-- Info Details -->
      <div class="info-grid">
        <div>
          <h4 style="margin: 0 0 5px 0; color: #64748b; font-size: 12px; text-transform: uppercase;">تفاصيل الفاتورة</h4>
          <p style="margin: 2px 0; font-size: 14px;"><strong>رقم الطلب:</strong> ${order.order_number}</p>
          <p style="margin: 2px 0; font-size: 14px;"><strong>التاريخ:</strong> ${new Date(order.created_at || Date.now()).toLocaleDateString('ar-SA')}</p>
          <p style="margin: 2px 0; font-size: 14px;"><strong>حالة الدفع:</strong> الدفع عند الاستلام</p>
        </div>
        <div style="text-align: left;">
          <h4 style="margin: 0 0 5px 0; color: #64748b; font-size: 12px; text-transform: uppercase; text-align: left;">العميل والمستلم</h4>
          <p style="margin: 2px 0; font-size: 14px;"><strong>الاسم:</strong> ${order.customer_name}</p>
          <p style="margin: 2px 0; font-size: 14px;"><strong>الهاتف:</strong> ${order.customer_phone}</p>
          <p style="margin: 2px 0; font-size: 14px;"><strong>المدينة:</strong> ${order.shipping_city || '-'}</p>
        </div>
      </div>

      <!-- Items Table -->
      <table class="table-container">
        <thead>
          <tr style="border-bottom: 2px solid #e2e8f0; color: #64748b; font-size: 13px;">
            <th style="padding: 10px 0; text-align: right;">المنتج</th>
            <th style="padding: 10px 0; text-align: center; width: 60px;">الكمية</th>
            <th style="padding: 10px 0; text-align: left; width: 100px;">السعر المفرد</th>
            <th style="padding: 10px 0; text-align: left; width: 100px;">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>

      <!-- Summary -->
      <div style="border-top: 2px solid #e2e8f0; padding-top: 15px;">
        <div style="float: left; width: 250px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; font-size: 14px; padding: 4px 0;">
            <span style="color: #64748b;">المجموع الفرعي:</span>
            <span style="font-weight: bold;">${order.subtotal.toLocaleString('ar-SA')} ${order.currency}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 14px; padding: 4px 0;">
            <span style="color: #64748b;">الخصم:</span>
            <span style="font-weight: bold; color: #ef4444;">-${(order.discount_amount || 0).toLocaleString('ar-SA')} ${order.currency}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: bold; border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 5px; color: ${primary};">
            <span>الإجمالي الكلي:</span>
            <span>${order.total.toLocaleString('ar-SA')} ${order.currency}</span>
          </div>
        </div>
        <div style="clear: both;"></div>
      </div>

      <!-- Notes -->
      ${order.notes ? `
      <div style="background-color: #f8fafc; border-radius: 8px; padding: 15px; margin-top: 15px; border: 1px solid #e2e8f0;">
        <h5 style="margin: 0 0 5px 0; color: #64748b;">ملاحظات العميل:</h5>
        <p style="margin: 0; font-size: 13px; color: #1e293b;">${order.notes}</p>
      </div>` : ''}

      <div style="margin-top: 30px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 12px; color: #94a3b8;">
        <p style="margin: 5px 0;">شكراً لتسوقك من متجر <strong>${store.name}</strong></p>
        <p style="margin: 5px 0;">تم إصدار هذه الفاتورة تلقائياً عبر منصة سوق اليمن</p>
      </div>
    </div>
  </div>
</body>
</html>`;
  }
}
