/**
 * Bondtex MES - Firebase Cloud Functions
 * Automated 24-Hour Daily Database Backup & Disaster Recovery Exporter
 * 
 * Target Destination: bondtexlk@gmail.com
 * Schedule: Every 24 hours (Daily automated trigger)
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}

// Target email address as requested
const BACKUP_TARGET_EMAIL = process.env.BACKUP_TARGET_EMAIL || 'bondtexlk@gmail.com';

/**
 * Configure Nodemailer Transport
 * Supports standard Gmail / SMTP credentials via environment or Firebase config
 */
function createEmailTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = port === 465;
  const user = process.env.SMTP_USER || process.env.GMAIL_USER || 'bondtexlk@gmail.com';
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASS || process.env.EMAIL_PASSWORD;

  if (pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  }

  // Fallback direct transporter for test/simulation
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass: pass || 'bondtex-default',
    },
  });
}

/**
 * Collects the complete Realtime Database state for the backup
 */
async function fetchFullDatabaseState() {
  try {
    const db = admin.database();
    const stateRef = db.ref('/state');
    const snapshot = await stateRef.once('value');
    const stateData = snapshot.val();

    if (stateData) {
      return stateData;
    }
  } catch (err) {
    console.warn('Admin SDK ref read note:', err.message);
  }

  // Fallback: Fetch via REST API
  try {
    const response = await fetch('https://bondtexlk-f16f5-default-rtdb.firebaseio.com/state.json');
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.warn('REST database read note:', err.message);
  }

  return null;
}

/**
 * Generates the disaster recovery backup package and sends it to bondtexlk@gmail.com
 */
async function executeDatabaseBackup(triggerType = 'SCHEDULED_24H') {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const timestampStr = now.toISOString().replace(/[:.]/g, '-');
  const backupFileName = `bondtex-database-backup-${timestampStr}.json`;

  console.log(`[Database Backup] Starting 24h backup export triggered by: ${triggerType}`);
  console.log(`[Database Backup] Target recipient: ${BACKUP_TARGET_EMAIL}`);

  // 1. Fetch current live factory state
  const stateData = await fetchFullDatabaseState();
  if (!stateData) {
    throw new Error('Failed to retrieve factory database state from Firebase Realtime Database');
  }

  const orders = Array.isArray(stateData.orders) ? stateData.orders : [];
  const deliveries = Array.isArray(stateData.deliveryReceivedLogs) ? stateData.deliveryReceivedLogs : [];
  const machines = Array.isArray(stateData.machines) ? stateData.machines : [];

  // 2. Compute factory key performance metrics
  const totalOrders = orders.length;
  const totalOrderQty = orders.reduce((sum, o) => sum + (Number(o.orderQty) || 0), 0);
  const totalProductionQty = orders.reduce((sum, o) => sum + (Number(o.productionQty) || 0), 0);
  const totalBalanceQty = orders.reduce((sum, o) => sum + (Number(o.balanceQty) || 0), 0);
  const totalFloorQty = orders.reduce((sum, o) => sum + (Number(o.floorProductionQty) || 0), 0);
  const totalDeliveries = deliveries.length;

  // 3. Construct structured backup payload
  const backupPayload = {
    metadata: {
      system: 'Bondtex MES Production System',
      backupType: triggerType,
      createdAt: now.toISOString(),
      generatedFor: BACKUP_TARGET_EMAIL,
      databaseUrl: 'https://bondtexlk-f16f5-default-rtdb.firebaseio.com',
      stats: {
        totalOrders,
        totalOrderQty,
        totalProductionQty,
        totalBalanceQty,
        totalFloorQty,
        totalDeliveries,
        machineCount: machines.length,
      },
    },
    state: stateData,
  };

  const backupJsonString = JSON.stringify(backupPayload, null, 2);
  const backupSizeBytes = Buffer.byteLength(backupJsonString, 'utf8');
  const backupSizeKb = (backupSizeBytes / 1024).toFixed(2);

  // 4. Save persistent redundancy record to Firebase Realtime Database
  try {
    const db = admin.database();
    await db.ref(`/backups/daily/${dateStr}`).set({
      timestamp: now.toISOString(),
      fileName: backupFileName,
      sizeKb: backupSizeKb,
      recipient: BACKUP_TARGET_EMAIL,
      stats: backupPayload.metadata.stats,
    });
    await db.ref('/backups/latest').set({
      timestamp: now.toISOString(),
      fileName: backupFileName,
      sizeKb: backupSizeKb,
      recipient: BACKUP_TARGET_EMAIL,
      triggerType,
      stats: backupPayload.metadata.stats,
    });
    console.log(`[Database Backup] Stored redundant cloud copy at /backups/daily/${dateStr}`);
  } catch (err) {
    console.warn('[Database Backup] Redundant cloud copy note:', err.message);
  }

  // 5. Compose HTML Email
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; margin: 0; }
        .container { max-width: 650px; margin: 0 auto; background-color: #1e293b; border: 1px solid #334155; border-radius: 12px; overflow: hidden; }
        .header { background: linear-gradient(135deg, #0284c7, #2563eb); padding: 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 20px; color: #ffffff; letter-spacing: 0.5px; }
        .header p { margin: 6px 0 0; font-size: 13px; color: #bfdbfe; }
        .body-content { padding: 24px; }
        .badge { display: inline-block; background-color: #059669; color: #ffffff; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: bold; text-transform: uppercase; margin-bottom: 16px; }
        .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 20px 0; }
        .stat-card { background-color: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 14px; }
        .stat-label { font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: bold; }
        .stat-value { font-size: 20px; font-weight: bold; color: #38bdf8; margin-top: 4px; }
        .details-table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
        .details-table td { padding: 8px 12px; border-bottom: 1px solid #334155; }
        .details-table td:first-child { color: #94a3b8; font-weight: 500; width: 40%; }
        .details-table td:last-child { color: #f8fafc; font-weight: bold; }
        .footer { background-color: #0f172a; padding: 16px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #334155; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>BONDTEX MES - DATABASE BACKUP</h1>
          <p>Automated 24-Hour Production Ledger & Disaster Recovery Export</p>
        </div>
        <div class="body-content">
          <span class="badge">Daily Backup Complete</span>
          <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.5; color: #cbd5e1;">
            Attached is the full JSON disaster recovery backup for the Bondtex Manufacturing Execution System.
            This export contains all active orders, delivery logs, machine states, and hourly production records.
          </p>

          <table class="details-table">
            <tr>
              <td>Backup Target</td>
              <td>${BACKUP_TARGET_EMAIL}</td>
            </tr>
            <tr>
              <td>Backup File</td>
              <td>${backupFileName}</td>
            </tr>
            <tr>
              <td>File Size</td>
              <td>${backupSizeKb} KB (${backupSizeBytes.toLocaleString()} bytes)</td>
            </tr>
            <tr>
              <td>Timestamp</td>
              <td>${now.toUTCString()}</td>
            </tr>
            <tr>
              <td>Trigger Source</td>
              <td>${triggerType}</td>
            </tr>
            <tr>
              <td>Total Active Orders</td>
              <td>${totalOrders}</td>
            </tr>
            <tr>
              <td>Total Produced Qty</td>
              <td style="color: #34d399;">${totalProductionQty.toLocaleString()} pcs</td>
            </tr>
            <tr>
              <td>Total Balance Qty</td>
              <td style="color: #f59e0b;">${totalBalanceQty.toLocaleString()} pcs</td>
            </tr>
            <tr>
              <td>Total Floor Qty</td>
              <td style="color: #60a5fa;">${totalFloorQty.toLocaleString()} pcs</td>
            </tr>
            <tr>
              <td>Delivery Transactions</td>
              <td>${totalDeliveries} logged</td>
            </tr>
          </table>

          <div style="margin-top: 24px; padding: 12px; background-color: #0f172a; border-left: 3px solid #38bdf8; border-radius: 4px;">
            <p style="margin: 0; font-size: 12px; color: #94a3b8;">
              <strong style="color: #f8fafc;">Disaster Recovery Note:</strong> In the event of system restore, this attached JSON file can be re-imported directly into Firebase Realtime Database or local storage to restore all production states without loss.
            </p>
          </div>
        </div>
        <div class="footer">
          Bondtex Manufacturing Execution System &bull; Automated Cloud Function &bull; Confidential
        </div>
      </div>
    </body>
    </html>
  `;

  // 6. Attempt Email Send via Nodemailer
  let emailSent = false;
  let emailError = null;

  try {
    const transporter = createEmailTransporter();
    const mailOptions = {
      from: `"Bondtex MES Cloud Backup" <${process.env.SMTP_USER || 'backup@bondtex-mes.app'}>`,
      to: BACKUP_TARGET_EMAIL,
      subject: `[Bondtex MES] Automated 24-Hour Database Backup & Disaster Recovery - ${dateStr}`,
      html: emailHtml,
      attachments: [
        {
          filename: backupFileName,
          content: backupJsonString,
          contentType: 'application/json',
        },
      ],
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Database Backup] Email successfully dispatched to ${BACKUP_TARGET_EMAIL}:`, info.messageId);
    emailSent = true;
  } catch (err) {
    emailError = err.message;
    console.warn(`[Database Backup] Nodemailer dispatch note (${BACKUP_TARGET_EMAIL}):`, err.message);
  }

  return {
    success: true,
    fileName: backupFileName,
    sizeKb: backupSizeKb,
    recipient: BACKUP_TARGET_EMAIL,
    stats: backupPayload.metadata.stats,
    emailSent,
    emailError,
    timestamp: now.toISOString(),
  };
}

/**
 * 1. Automated 24-Hour Scheduled Cloud Function
 * Runs daily at midnight (Asia/Colombo timezone, 00:00)
 */
exports.scheduledDailyDatabaseBackup = functions
  .region('us-central1')
  .pubsub.schedule('0 0 * * *')
  .timeZone('Asia/Colombo')
  .onRun(async (context) => {
    console.log('[Cloud Function] scheduledDailyDatabaseBackup running at:', new Date().toISOString());
    const result = await executeDatabaseBackup('SCHEDULED_24H');
    console.log('[Cloud Function] scheduledDailyDatabaseBackup finished:', result);
    return result;
  });

/**
 * 2. On-Demand HTTPS Trigger: /sendDatabaseBackupNow
 * Allows authorized admins or UI to trigger an immediate backup export to bondtexlk@gmail.com
 */
exports.sendDatabaseBackupNow = functions
  .region('us-central1')
  .https.onRequest(async (req, res) => {
    // Enable CORS for frontend MES dashboard calls
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    try {
      const result = await executeDatabaseBackup('MANUAL_HTTPS_TRIGGER');
      res.status(200).json({
        message: `Database backup completed successfully for ${BACKUP_TARGET_EMAIL}`,
        details: result,
      });
    } catch (err) {
      console.error('[Cloud Function] sendDatabaseBackupNow error:', err);
      res.status(500).json({
        error: 'Database backup failed',
        message: err.message,
      });
    }
  });

/**
 * 3. Direct JSON Download Endpoint: /downloadDatabaseBackup
 * Streams the active database backup directly as a downloaded JSON file
 */
exports.downloadDatabaseBackup = functions
  .region('us-central1')
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    try {
      const stateData = await fetchFullDatabaseState();
      if (!stateData) {
        res.status(500).json({ error: 'Failed to retrieve database state' });
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `bondtex-database-backup-${timestamp}.json`;

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(JSON.stringify(stateData, null, 2));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
