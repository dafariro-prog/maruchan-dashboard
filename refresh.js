#!/usr/bin/env node
/**
 * Refresca data/dashboard.json con datos REALES de Meta (Maruchan) desde Windsor.ai.
 * Requiere Node 18+ (fetch nativo) y la variable de entorno WINDSOR_API_KEY.
 *
 * La API key se obtiene en https://onboard.windsor.ai/  ->  Account / API.
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
const FIELDS     = ['account_id','campaign','objective','date','spend','impressions',
                    'reach','frequency','clicks','link_clicks','cpc','cpm','ctr'];

if (!API_KEY) { console.error('ERROR: falta WINDSOR_API_KEY'); process.exit(1); }

const url = `https://connectors.windsor.ai/${CONNECTOR}?` + new URLSearchParams({
  api_key: API_KEY,
  date_preset: DATE_PRESET,
  fields: FIELDS.join(','),
});

(async () => {
  const res = await fetch(url);
  if (!res.ok) { console.error('Windsor API', res.status, await res.text()); process.exit(1); }
  const json = await res.json();
  const all = json.data || json.result || [];

  // Solo la cuenta de Maruchan
  const rows = all
    .filter(r => String(r.account_id) === ACCOUNT_ID)
    .map(r => ({
      campaign: r.campaign, objective: r.objective, date: r.date,
      spend: +r.spend||0, impressions: +r.impressions||0, reach: +r.reach||0,
      frequency: +r.frequency||0, clicks: +r.clicks||0, link_clicks: +r.link_clicks||0,
      cpc: +r.cpc||0, cpm: +r.cpm||0, ctr: +r.ctr||0,
    }))
    .filter(r => r.date && r.impressions > 0)
    .sort((a,b)=> a.date < b.date ? -1 : 1);

  const out = {
    updated: new Date().toISOString(),
    account: { id: ACCOUNT_ID, name: 'Axon Pharma Colombia', connector: CONNECTOR, currency: 'COP' },
    filter: 'AxonPharma',
    rows,
  };

  const file = path.join(__dirname, 'data', 'dashboard.json');
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(`OK · ${rows.length} filas · ${new Set(rows.map(r=>r.campaign)).size} campañas · ${file}`);
})().catch(e => { console.error(e); process.exit(1); });
