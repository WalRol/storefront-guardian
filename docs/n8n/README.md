# Workflow de n8n: notificaciones y métricas

Storefront Guardian envía el resultado de cada revisión a un webhook (`GUARDIAN_WEBHOOK_URL`).
Este workflow de n8n lo recibe y:

1. **Notifica** al equipo cuando un PR queda BLOQUEADO o requiere REVISIÓN HUMANA.
2. **Registra métricas** de cada corrida (veredicto, hallazgos, fixes, tiempo, minutos ahorrados).
3. **Envía un resumen semanal** con el valor generado: PRs revisados, bloqueados y horas estimadas ahorradas.

```
Webhook (POST /guardian, Header Auth)
   └─ Normalizar (Edit Fields)
        ├─ Guardar métrica (Data table / Google Sheets)
        └─ Switch por veredicto
             ├─ BLOCK  → Telegram: alerta
             ├─ REVIEW → Telegram: pedido de revisión
             └─ APPROVE → (sin notificación)

Schedule (lunes 9:00)
   └─ Leer métricas → Resumir (Code) → Telegram: resumen semanal
```

Evento de ejemplo: [ejemplo-evento.json](ejemplo-evento.json).

---

## Paso 0 — Levantar n8n

Cualquiera de las dos opciones sirve; el workflow exportado se importa igual en ambas.

**Opción A — npx** (más liviana; requiere una versión de Node compatible con n8n):

```bash
npx n8n@<versión>   # fijar la versión evita sorpresas por actualizaciones automáticas
```

Los datos quedan en `~/.n8n`. Para detenerlo: `Ctrl+C`.

**Opción B — Docker** (aislado, no depende del Node local):

```bash
docker run -it --rm --name n8n -p 5678:5678 -v n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n
```

Para detenerlo: `docker stop n8n`.

En ambos casos, abrir http://localhost:5678 y crear el usuario owner.

> GitHub Actions no puede llegar a `localhost`. Para conectarlo con PRs reales: usar n8n Cloud, o exponer
> el n8n local con un túnel temporal (`cloudflared tunnel --url http://localhost:5678`).

## Paso 1 — Token compartido

Generar un token aleatorio:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

Guardarlo en el `.env` del repo como `GUARDIAN_WEBHOOK_TOKEN=...`.

## Paso 2 — Webhook

Nodo **Webhook**:

| Campo | Valor |
|---|---|
| HTTP Method | `POST` |
| Path | `guardian` |
| Authentication | `Header Auth` → nueva credencial: Name `X-Guardian-Token`, Value: el token del paso 1 |
| Respond | `Immediately` |

Si el header no coincide, n8n responde 403 y el evento se descarta.

## Paso 3 — Normalizar

Nodo **Edit Fields (Set)**, modo manual, con estos campos:

| Nombre | Tipo | Valor (expresión) |
|---|---|---|
| `at` | String | `{{ $json.body.at }}` |
| `repo` | String | `{{ $json.body.repo ?? 'local' }}` |
| `pr` | String | `{{ $json.body.pr.number ?? $json.body.label }}` |
| `title` | String | `{{ $json.body.pr.title }}` |
| `url` | String | `{{ $json.body.pr.url ?? '' }}` |
| `verdict` | String | `{{ $json.body.verdict }}` |
| `reasons` | String | `{{ $json.body.reasons.join('\n• ') }}` |
| `findings` | Number | `{{ $json.body.counts.findings }}` |
| `critical` | Number | `{{ $json.body.counts.critical }}` |
| `fixesValidated` | Number | `{{ $json.body.counts.fixesValidated }}` |
| `seconds` | Number | `{{ $json.body.seconds }}` |
| `minutesSaved` | Number | `{{ $json.body.minutesSavedEstimate }}` |
| `costUsd` | Number | `{{ $json.body.costUsd }}` |
| `model` | String | `{{ $json.body.model }}` |

## Paso 4 — Guardar la métrica

Desde **Normalizar**, una salida hacia:

- **Data table** (si tu versión de n8n lo tiene): crear la tabla `guardian_runs` con las mismas columnas del paso 3
  y usar la operación *Insert*.
- Alternativa: **Google Sheets → Append row** en una hoja con esas columnas como encabezados.

## Paso 5 — Rutear por veredicto

Desde **Normalizar**, otra salida hacia un nodo **Switch** (modo *Rules*) sobre `{{ $json.verdict }}`:

| Regla | Salida |
|---|---|
| is equal to `BLOCK` | `BLOCK` |
| is equal to `REVIEW` | `REVIEW` |
| is equal to `APPROVE` | `APPROVE` (sin conectar: no notifica) |

## Paso 6 — Notificaciones

Canal sugerido para la demo: **Telegram** (gratis, llega al celular).
Crear el bot con `@BotFather`, guardar el token como credencial de Telegram en n8n, y obtener el chat id
enviándole un mensaje al bot y abriendo `https://api.telegram.org/bot<TOKEN>/getUpdates`.
En el workflow exportado los nodos de Telegram traen `TU_CHAT_ID`: reemplazarlo por ese chat id.

Nodo **Telegram → Send Message** en la salida `BLOCK`:

```
⛔ PR BLOQUEADO — {{ $json.repo }} #{{ $json.pr }}
{{ $json.title }}

• {{ $json.reasons }}

Fixes validados listos para aplicar: {{ $json.fixesValidated }}
{{ $json.url }}
```

Nodo **Telegram → Send Message** en la salida `REVIEW`:

```
🟡 PR requiere revisión humana — {{ $json.repo }} #{{ $json.pr }}
{{ $json.title }}

• {{ $json.reasons }}
{{ $json.url }}
```

En producción (Oechsle) el mismo nodo se reemplaza por Microsoft Teams o por un flujo de Power Automate.

## Paso 7 — Resumen semanal

1. **Schedule Trigger**: semanal, lunes 9:00.
2. **Data table → Get rows** (o Google Sheets → Get rows) de `guardian_runs`.
3. **Code** (JavaScript, *Run Once for All Items*):

```js
const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
const runs = $input.all().map((i) => i.json).filter((r) => new Date(r.at).getTime() >= weekAgo);
const count = (v) => runs.filter((r) => r.verdict === v).length;
const sum = (k) => runs.reduce((s, r) => s + Number(r[k] || 0), 0);
return [{
  json: {
    total: runs.length,
    blocked: count('BLOCK'),
    review: count('REVIEW'),
    approved: count('APPROVE'),
    fixes: sum('fixesValidated'),
    hoursSaved: (sum('minutesSaved') / 60).toFixed(1),
    costUsd: sum('costUsd').toFixed(4),
    avgSeconds: runs.length ? Math.round(sum('seconds') / runs.length) : 0,
  },
}];
```

4. **Telegram → Send Message**:

```
📊 Storefront Guardian — última semana
PRs revisados: {{ $json.total }} (⛔ {{ $json.blocked }} · 🟡 {{ $json.review }} · ✅ {{ $json.approved }})
Fixes validados entregados: {{ $json.fixes }}
Horas estimadas ahorradas: {{ $json.hoursSaved }}
Tiempo promedio por PR: {{ $json.avgSeconds }} s · Costo: US$ {{ $json.costUsd }}
```

## Paso 8 — Probar

Con el workflow abierto, clic en **Listen for test event** del nodo Webhook. Luego, desde la raíz del repo:

```bash
curl -X POST http://localhost:5678/webhook-test/guardian \
  -H "Content-Type: application/json" -H "X-Guardian-Token: <token>" \
  --data @docs/n8n/ejemplo-evento.json
```

Prueba de punta a punta con el sistema real: en `.env` poner
`GUARDIAN_WEBHOOK_URL=http://localhost:5678/webhook-test/guardian` y correr `npm run demo`.

## Paso 9 — Activar y exportar

1. Activar el workflow. La URL de producción es `http://<host>:5678/webhook/guardian`.
2. En GitHub: *Settings → Secrets and variables → Actions* → `N8N_WEBHOOK_URL` y `N8N_WEBHOOK_TOKEN`.
3. Exportar el workflow (*⋯ → Download*) y guardarlo como `docs/n8n/guardian-workflow.json`.
   Las credenciales no se incluyen en la exportación.

### Importar el workflow exportado

En vez de armarlo a mano: *Workflows → Import from File* → [guardian-workflow.json](guardian-workflow.json).
Después de importar:

1. En el nodo **Webhook**, seleccionar la credencial Header Auth (paso 1).
2. En **Insert row** y **Get row(s)**, volver a seleccionar la tabla `guardian_runs` (los ids de tabla son
   propios de cada instancia de n8n).
3. En los tres nodos de **Telegram**, seleccionar la credencial del bot y reemplazar `TU_CHAT_ID` (paso 6).
