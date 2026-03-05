export const config = { runtime: 'edge' };

const BOT_TOKEN     = process.env.BOT_TOKEN;
const MASTER_CHAT_ID = process.env.MASTER_CHAT_ID;

export default async function handler(req) {
  // Allow CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  try {
    const body = await req.json();
    const { userData, images } = body;

    // 1. Send text message
    const msgText =
      `🖐 *Palm Reading Request*\n\n` +
      `👤 *ឈ្មោះ:* ${userData.fullName}\n` +
      `📅 *DOB:* ${userData.dob}\n` +
      `🕐 *Time:* ${userData.tob}\n` +
      `🐉 *ឆ្នាំ:* ${userData.khmerYear}\n` +
      `📱 *Phone:* ${userData.phone}\n` +
      `⚧ *Gender:* ${userData.gender}\n` +
      `👤 *TG User:* @${userData.tgUsername || 'N/A'} (${userData.tgName || ''})\n` +
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
    if (!msgData.ok) throw new Error('Message failed: ' + msgData.description);

    // 2. Send each palm image
    const slotLabels = ['Left Palm', 'Right Palm', 'Left Side', 'Right Side'];

    for (let i = 0; i < images.length; i++) {
      const imgData = images[i];
      if (!imgData) continue;

      // Convert base64 to binary
      const base64 = imgData.split(',')[1];
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let j = 0; j < binaryStr.length; j++) {
        bytes[j] = binaryStr.charCodeAt(j);
      }

      const form = new FormData();
      form.append('chat_id', MASTER_CHAT_ID);
      form.append('photo', new Blob([bytes], { type: 'image/jpeg' }), `palm_${i}.jpg`);
      form.append('caption', `🖐 ${slotLabels[i]} — ${userData.fullName}`);

      const photoRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
        method: 'POST',
        body: form,
      });

      const photoData = await photoRes.json();
      if (!photoData.ok) throw new Error(`Photo ${i+1} failed: ` + photoData.description);
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });

  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers });
  }
}
