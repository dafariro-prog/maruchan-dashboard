#!/usr/bin/env node
/**
 * Refresca data/dashboard.json con datos REALES de Meta (Axon Pharma Colombia) desde Windsor.ai.
 * Requiere Node 18+ (fetch nativo) y la variable de entorno WINDSOR_API_KEY.
 *
 * La API key se obtiene en https://onboard.windsor.ai/  ->  destino "API".
 *
 * Uso:
 *   WINDSOR_API_KEY=xxxxx node refresh.js
 */
const fs = require('fs');
const path = require('path');

const API_KEY    = process.env.WINDSOR_API_KEY;
const ACCOUNT_ID = '1211531357024604';            // Axon Pharma Colombia
const CONNECTOR  = 'facebook';
const DATE_PRESET= 'last_90d';                     // ventana que cubre los flights vigentes
const TOP_ADS    = 12;                             // cuántos creativos mostrar

if (!API_KEY) { console.error('ERROR: falta WINDSOR_API_KEY'); process.exit(1); }

async function windsor(fields) {
  const url = `https://connectors.windsor.ai/${CONNECTOR}?` + new URLSearchParams({
    api_key: API_KEY, date_preset: DATE_PRESET, fields: fields.join(','),
  });
  const res = await fetch(url);
  if (!res.ok) { console.error('Windsor API', res.status, await res.text()); process.exit(1); }
  const json = await res.json();
  return (json.data || json.result || []).filter(r => String(r.account_id) === ACCOUNT_ID);
}

(async () => {
  // 1) Serie diaria por campaña (lo que alimenta KPIs, gráficas y tabla)
  const dailyRaw = await windsor(['account_id','campaign','objective','date','spend','impressions',
    'reach','frequency','clicks','link_clicks','cpc','cpm','ctr']);
  const rows = dailyRaw
    .map(r => ({
      campaign: r.campaign, objective: r.objective, date: r.date,
      spend: +r.spend||0, impressions: +r.impressions||0, reach: +r.reach||0,
      frequency: +r.frequency||0, clicks: +r.clicks||0, link_clicks: +r.link_clicks||0,
      cpc: +r.cpc||0, cpm: +r.cpm||0, ctr: +r.ctr||0,
    }))
    .filter(r => r.date && r.impressions > 0)
    .sort((a,b)=> a.date < b.date ? -1 : 1);

  // 2) Creativos a nivel de anuncio con thumbnail (agregado sobre el periodo, sin fecha)
  const adRaw = await windsor(['account_id','ad_name','campaign','thumbnail_url','image_url',
    'spend','impressions','reach','clicks','link_clicks']);
  const ads = adRaw
    .map(r => ({
      ad_name: r.ad_name, campaign: r.campaign,
      thumbnail: r.thumbnail_url || r.image_url || '',
      spend: +r.spend||0, impressions: +r.impressions||0, reach: +r.reach||0,
      clicks: +r.clicks||0, link_clicks: +r.link_clicks||0,
    }))
    .filter(a => a.thumbnail && /^http/.test(a.thumbnail) && a.spend > 0)
    .sort((a,b)=> b.spend - a.spend)
    .slice(0, TOP_ADS);

  const out = {
    updated: new Date().toISOString(),
    account: { id: ACCOUNT_ID, name: 'Axon Pharma Colombia', connector: CONNECTOR, currency: 'COP' },
    filter: 'AxonPharma',
    rows,
    ads,
  };

  const file = path.join(__dirname, 'data', 'dashboard.json');
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(`OK · ${rows.length} filas · ${new Set(rows.map(r=>r.campaign)).size} campañas · ${ads.length} creativos · ${file}`);
})().catch(e => { console.error(e); process.exit(1); });
