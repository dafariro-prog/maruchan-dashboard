#!/usr/bin/env node
/**
 * Refresca data/dashboard.json con datos REALES de Meta (Axon Pharma Colombia).
 *
 * INCREMENTAL: el histórico (2025 y meses anteriores a la ventana) queda FIJO —
 * no se vuelve a descargar. Solo se re-consultan los últimos RECENT_DAYS días y
 * se fusionan con lo ya almacenado. Así el refresco diario es liviano y 2025 no
 * se toca una vez quedó guardado.
 *
 * Requiere Node 18+ (fetch nativo) y la variable de entorno WINDSOR_API_KEY.
 * Uso:  WINDSOR_API_KEY=xxxxx node refresh.js
 */
const fs = require('fs');
const path = require('path');

// Acepta la key sola o una URL completa pegada por error (extrae lo que va tras api_key=)
const RAW_KEY    = (process.env.WINDSOR_API_KEY || '').trim();
const API_KEY    = (RAW_KEY.match(/api_key=([^&\s]+)/i)?.[1] || RAW_KEY).trim();
const ACCOUNT_ID = '1211531357024604';            // Axon Pharma Colombia
const CONNECTOR  = 'facebook';
const RECENT_DAYS= 70;                             // ventana que se actualiza (~2 meses + buffer)
const TOP_ADS    = 12;

if (!API_KEY) { console.error('ERROR: falta WINDSOR_API_KEY'); process.exit(1); }

const addDays = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10); };
const TODAY  = new Date().toISOString().slice(0,10);
const CUTOFF = addDays(TODAY, -RECENT_DAYS);       // fechas >= CUTOFF se refrescan; < CUTOFF quedan fijas

async function fetchData(fields) {
  const url = `https://connectors.windsor.ai/${CONNECTOR}?` + new URLSearchParams({
    api_key: API_KEY, date_from: CUTOFF, date_to: TODAY, fields: fields.join(','),
  });
  const res = await fetch(url);
  if (!res.ok) {
    const body = (await res.text()).slice(0, 200);
    throw new Error(`API HTTP ${res.status} (key len=${API_KEY.length}) :: ${body}`);
  }
  const json = await res.json();
  return (json.data || json.result || []).filter(r => String(r.account_id) === ACCOUNT_ID);
}

(async () => {
  const file = path.join(__dirname, 'data', 'dashboard.json');

  // Lo ya almacenado (histórico fijo + última ventana)
  let prev = { rows: [], ads: [] };
  try { prev = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { console.error('Aviso: no había dashboard.json previo (primera corrida).'); }

  // 1) Serie diaria SOLO de la ventana reciente (esencial)
  let recentRaw;
  try {
    recentRaw = await fetchData(['account_id','campaign','objective','date','spend','impressions',
      'reach','frequency','clicks','link_clicks','cpc','cpm','ctr']);
  } catch (e) { console.error('FALLO al traer la serie reciente:', e.message); process.exit(1); }

  const recentRows = recentRaw
    .map(r => ({
      campaign: r.campaign, objective: r.objective, date: r.date,
      spend: +r.spend||0, impressions: +r.impressions||0, reach: +r.reach||0,
      frequency: +r.frequency||0, clicks: +r.clicks||0, link_clicks: +r.link_clicks||0,
      cpc: +r.cpc||0, cpm: +r.cpm||0, ctr: +r.ctr||0,
    }))
    .filter(r => r.date && r.impressions > 0);

  // 2) Fusión: histórico fijo (date < CUTOFF) + ventana reciente refrescada
  const kept = (prev.rows || []).filter(r => r.date < CUTOFF);
  const rows = [...kept, ...recentRows].sort((a,b)=> a.date < b.date ? -1 : 1);

  // 3) Creativos de la ventana reciente (si falla, conservamos los previos)
  let ads = prev.ads || [];
  try {
    const adRaw = await fetchData(['account_id','ad_name','campaign','thumbnail_url','image_url',
      'spend','impressions','reach','clicks','link_clicks']);
    ads = adRaw
      .map(r => ({
        ad_name: r.ad_name, campaign: r.campaign,
        thumbnail: r.thumbnail_url || r.image_url || '',
        spend: +r.spend||0, impressions: +r.impressions||0, reach: +r.reach||0,
        clicks: +r.clicks||0, link_clicks: +r.link_clicks||0,
      }))
      .filter(a => a.thumbnail && /^http/.test(a.thumbnail) && a.spend > 0)
      .sort((a,b)=> b.spend - a.spend)
      .slice(0, TOP_ADS);
  } catch (e) { console.error('Aviso: no se pudieron traer los creativos (se mantienen los previos):', e.message); }

  const out = {
    updated: new Date().toISOString(),
    account: { id: ACCOUNT_ID, name: 'Axon Pharma Colombia', connector: CONNECTOR, currency: 'COP' },
    filter: 'AxonPharma',
    rows,
    ads,
  };

  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(`OK · ${rows.length} filas (${kept.length} histórico fijo + ${recentRows.length} recientes desde ${CUTOFF}) · ${new Set(rows.map(r=>r.campaign)).size} campañas · ${ads.length} creativos`);
})().catch(e => { console.error(e); process.exit(1); });
