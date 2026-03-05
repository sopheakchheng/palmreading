export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const BOT_TOKEN      = process.env.BOT_TOKEN;
  const MASTER_CHAT_ID = process.env.MASTER_CHAT_ID;

  if (!BOT_TOKEN || !MASTER_CHAT_ID) {
    return res.status(500).json({ ok: false, error: 'Missing environment variables' });
  }

  try {
    const { userData, images } = req.body;

    // 1. Send text message
    const msgText =
      `🖐 *Palm Reading Request*\n\n` +
      `👤 *ឈ្មោះ:* ${userData.fullName}\n` +
      `📅 *DOB:* ${userData.dob}\n` +
      `🕐 *Time:* ${userData.tob}\n` +
      `🐉 *ឆ្នាំ:* ${userData.khmerYear}\n` +
      `📱 *Phone:* ${userData.phone}\n` +
      `⚧ *Gender:* ${userData.gender}\n` +
      `👤 *TG:* @${userData.tgUsername || 'N/A'} (${userData.tgName || ''})\n` +
      `🕐 *Submitted:* ${userData.timestamp}`;

    const msgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: MASTER_CHAT_ID,
        text: msgText,
        parse_mode: 'Markdown',
      }),
    });

    const msgData = await msgRes.json();
    if (!msgData.ok) {
      return res.status(500).json({ ok: false, error: 'Message failed: ' + msgData.description });
    }

    // 2. Send palm images one by one
    const slotLabels = ['Left Palm', 'Right Palm', 'Left Side', 'Right Side'];

    for (let i = 0; i < images.length; i++) {
      const imgData = images[i];
      if (!imgData) continue;

      const base64 = imgData.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64, 'base64');
      const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
      const caption  = `🖐 ${slotLabels[i]} — ${userData.fullName}`;

      let bodyStr = '';
      bodyStr += `--${boundary}\r\n`;
      bodyStr += `Content-Disposition: form-data; name="chat_id"\r\n\r\n`;
      bodyStr += `${MASTER_CHAT_ID}\r\n`;
      bodyStr += `--${boundary}\r\n`;
      bodyStr += `Content-Disposition: form-data; name="caption"\r\n\r\n`;
      bodyStr += `${caption}\r\n`;
      bodyStr += `--${boundary}\r\n`;
      bodyStr += `Content-Disposition: form-data; name="photo"; filename="palm_${i}.jpg"\r\n`;
      bodyStr += `Content-Type: image/jpeg\r\n\r\n`;

      const bodyStart = Buffer.from(bodyStr, 'utf8');
      const bodyEnd   = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
      const full      = Buffer.concat([bodyStart, buffer, bodyEnd]);

      const photoRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': full.length,
        },
        body: full,
      });

      const photoData = await photoRes.json();
      if (!photoData.ok) {
        console.error(`Photo ${i + 1} failed:`, photoData.description);
      }
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('Submit error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
