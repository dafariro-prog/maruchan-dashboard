# Dashboard Axon Pharma Colombia · Meta

Dashboard web automatizado de las campañas de **Meta** (Facebook/Instagram) de la cuenta
**Axon Pharma Colombia** (`1211531357024604`). Solo data real de Meta vía Windsor.ai. Se
actualiza solo cada día. Moneda: **COP**.

> Nota: el repo/URL conserva el nombre histórico `maruchan-dashboard`; el contenido es Axon Pharma.

## Arquitectura

- `index.html` — dashboard estático; lee `data/dashboard.json` y calcula todo en el navegador (Chart.js).
- `data/dashboard.json` — snapshot de datos reales (lo regenera el refresco diario).
- `refresh.js` — jala data de Meta desde la API REST de Windsor.ai y reescribe el JSON.
- `.github/workflows/refresh.yml` — GitHub Action que corre `refresh.js` cada día (05:00 CR) y commitea el JSON. Vercel redeploya solo al detectar el push.

## Estructura del dashboard

- Topbar con branding Axon Pharma (azul/gris) + pills de periodo, inversión total y fecha.
- Métrica clave (impresiones / reach / inversión).
- Resumen por objetivo: Awareness vs Traffic.
- Gráficas diarias: spend por objetivo, impresiones + link clicks.
- Desempeño por producto: A-Cerumen, Marimer, Floratil.
- Análisis y hallazgos (calculados de la data real, sin metas inventadas).
- Tabla resumen consolidada por campaña.

## Puesta en marcha / automatización

1. Secret en GitHub: `WINDSOR_API_KEY` (repo → Settings → Secrets → Actions).
2. El workflow corre solo cada día; para probarlo: Actions → *Refresco diario* → Run workflow.

## Refrescar manualmente en local
```bash
WINDSOR_API_KEY=xxxxx node refresh.js
```

## Previsualizar en local
```bash
node server.js   # luego abre http://127.0.0.1:8765
```
