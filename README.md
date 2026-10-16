# Storefront Guardian

Sistema de agentes que acompaña el ciclo de desarrollo de un equipo que mantiene tiendas online:
**revisa cada Pull Request, propone correcciones que demuestra que funcionan, y decide si el cambio puede avanzar.**

```
          PR (diff)
              │
              ▼
┌──────────────────────────────┐   sin IA · $0 · ~10 s
│ 1. Chequeos determinísticos  │   typecheck · tests · secretos · reglas estáticas
└──────────────┬───────────────┘
               ▼
┌──────────────────────────────┐   IA solo donde las reglas no llegan
│ 2. Agente revisor            │   diff + archivos + convenciones del equipo
│                              │   (secretos redactados antes de enviar)
└──────────────┬───────────────┘
               ▼
┌──────────────────────────────┐   cada fix se valida ROJO → VERDE
│ 3. Agente corrector          │   test de regresión falla con el bug y pasa con el fix,
│                              │   en un git worktree aislado
└──────────────┬───────────────┘
               ▼
┌──────────────────────────────┐   determinístico y configurable
│ 4. Gate                      │   APROBADO · REVISIÓN HUMANA · BLOQUEADO
└──────────────┬───────────────┘
               ▼
   comentario en el PR + métricas
```

Capacidades del reto que demuestra:

| Capacidad | Cómo |
|---|---|
| Revisar cambios y dar feedback accionable | Agente revisor: hallazgos con severidad, archivo:línea, explicación y sugerencia |
| Detectar un problema y proponer una corrección validada | Agente corrector: patch + test de regresión, validado rojo → verde |
| Decidir si un cambio está listo para avanzar | Gate determinístico según `guardian.policy.yaml` |

Las razones de diseño, alternativas descartadas y tensiones (costo, tiempo, privacidad, operabilidad)
están en [DECISIONES.md](DECISIONES.md).

---

## Inicio rápido (5 minutos, sin API key)

Requisitos: **Node.js 20+** y **git**. Alternativa sin instalar nada: abrir el repo en **GitHub Codespaces**
(incluye un devcontainer listo).

```bash
git clone <url-del-repo> storefront-guardian
cd storefront-guardian
npm run setup     # instala dependencias de storefront-demo y del agente
npm run demo      # revisa un PR de ejemplo con respuestas de IA grabadas (modo replay)
```

`npm run demo` corre el pipeline completo sobre un PR que agrega un endpoint con una falla de autorización.
El modo **replay** reproduce respuestas reales de Gemini grabadas previamente: no necesita API key ni internet
para la parte de IA, y el resultado es idéntico en cualquier máquina.

El reporte queda en `.guardian-out/06-idor-order-history/report.md`.

## Correrlo con IA real

1. Crear una API key gratuita en [Google AI Studio](https://aistudio.google.com/apikey).
2. Copiar `.env.example` como `.env` y completar `GEMINI_API_KEY`.
3. Ejecutar:

```bash
cd agent
npx tsx src/cli.ts review --case 05-sqli-category --provider gemini
```

### Modos de IA

| `--provider` | Requiere | Cuándo usarlo |
|---|---|---|
| `replay` | nada | Demo, evaluación reproducible, CI sin secretos |
| `gemini` | `GEMINI_API_KEY` (gratis) | Uso real con el tier gratuito (solo código no sensible, ver DECISIONES.md) |
| `groq` | `GROQ_API_KEY` (gratis) | Alternativa gratuita compatible con OpenAI |
| `ollama` | Ollama + ~8 GB RAM libres | Código sensible: nada sale de la máquina |
| `none` | nada | Solo capa determinística: costo cero, máxima privacidad |

`GEMINI_MODEL` acepta una lista separada por comas: si un modelo está saturado o sin cuota, se usa el siguiente.

## Revisar tus propios cambios

Sobre ramas de git:

```bash
cd agent
npx tsx src/cli.ts review --base main --head mi-rama --provider gemini
```

O sobre un patch: `--base main --patch cambios.patch`. Opciones útiles: `--no-fix` (solo revisar),
`--record` (grabar respuestas para replay), `--exit-zero`. Ver `npx tsx src/cli.ts --help`.

El agente **nunca modifica tu directorio de trabajo**: trabaja en un `git worktree` temporal y entrega
los fixes como patches para aplicar con `git apply`.

Exit code: `1` si el veredicto es BLOQUEADO, `0` en otro caso (útil en CI).

## En GitHub (cada Pull Request)

El workflow [.github/workflows/guardian.yml](.github/workflows/guardian.yml) corre en cada PR que toca
`storefront-demo/`, comenta el reporte en el PR y falla el check si el veredicto es BLOQUEADO.

Configuración: agregar el secreto `GEMINI_API_KEY` en *Settings → Secrets and variables → Actions*.
Sin el secreto (por ejemplo, PRs desde forks) corre solo la capa determinística.

## Notificaciones y métricas (n8n)

Si `GUARDIAN_WEBHOOK_URL` está definida, cada corrida envía su resultado (veredicto, hallazgos, fixes,
tiempo, costo y minutos ahorrados estimados) a ese webhook, autenticado con `GUARDIAN_WEBHOOK_TOKEN`.
Cada corrida también queda registrada localmente en `.guardian-out/runs.jsonl`.

El workflow de n8n que notifica al equipo y arma el resumen semanal de valor está documentado en
[docs/n8n/](docs/n8n/README.md).

## Evaluación

El sistema se mide contra 13 PRs de prueba en [eval/cases/](eval/cases/): 10 con bugs típicos de e-commerce
sembrados a propósito (dinero, stock, multitienda, seguridad, autorización, performance) y 3 PRs limpios
para medir falsos positivos.

```bash
npm run eval -- --provider replay       # reproduce la corrida grabada
npm run eval -- --provider none         # solo capa determinística (línea base)
npm run eval -- --provider gemini       # corrida nueva con IA real
npm run eval -- --provider gemini --no-context   # sin el archivo de convenciones del equipo
```

Los resultados se guardan en [eval/results/](eval/results/).

## Configuración

- [guardian.policy.yaml](guardian.policy.yaml): qué bloquea, qué va a revisión humana, qué se intenta
  corregir, límites de contexto e intentos. El equipo la ajusta sin tocar código.
- [storefront-demo/CONVENCIONES.md](storefront-demo/CONVENCIONES.md): reglas de negocio y convenciones que
  el revisor debe conocer. Es la forma de transformar conocimiento disperso del equipo en contexto para la IA.

## Estructura

```
storefront-demo/       Mini e-commerce multitienda (Express + TypeScript + SQLite en memoria) con tests
agent/
  src/checks/          Capa determinística: typecheck/tests, secretos, reglas estáticas
  src/agents/          Agente revisor y agente corrector
  src/llm/             Proveedores (Gemini, Groq/OpenAI-compatible, Ollama), cadena de respaldo, replay
  src/gate.ts          Decisión APROBADO / REVISIÓN / BLOQUEADO
  src/pipeline.ts      Orquestación
  src/eval.ts          Runner del eval
  cassettes/           Respuestas grabadas para el modo replay
eval/cases/            13 PRs de prueba (patch + resultado esperado)
eval/results/          Resultados del eval por proveedor
guardian.policy.yaml   Política del gate
```

## Tests

```bash
npm test    # tests de storefront-demo y del agente
```
