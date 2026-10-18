# Documento de decisiones — Storefront Guardian

## 1. Qué parte del ciclo ataqué y por qué

Elegí el momento en que un cambio pasa de "terminado por el desarrollador" a "listo para producción": **la revisión
del Pull Request**. Es el punto donde se juntan tres de las fricciones del escenario: revisar toma tiempo y es
inconsistente, los bugs se detectan tarde y el conocimiento del negocio está disperso. Además es un punto de control
que todo equipo ya tiene. El sistema se suma a un flujo existente sin pedirle a nadie que cambie su forma de trabajar.

En un equipo que mantiene varias storefronts, lo más caro no son los errores de sintaxis (eso lo atrapa el compilador)
sino los errores **de negocio que pasan los tests**: un descuento que se acumula, un precio tomado de otra tienda, stock
que queda negativo, un endpoint que deja ver órdenes ajenas. Los modelé sobre problemas reales que vi manteniendo una
plataforma retail multitienda, sin usar código de esa plataforma.

**Capacidades demostradas:**

| Capacidad | Implementación |
|---|---|
| Detectar un problema y proponer una corrección validada (principal) | Agente corrector. Cada fix trae un test de regresión que **debe fallar con el bug y pasar con el fix**. |
| Decidir si el cambio está listo para avanzar | Gate determinístico: APROBADO / REVISIÓN HUMANA / BLOQUEADO, según una política versionada. |
| Revisar y dar feedback accionable | Sale del agente revisor: severidad, archivo:línea, impacto y sugerencia. Se publica como comentario en el PR. |

Descarté la cuarta (responder preguntas sobre el código). Un RAG sobre documentación es el componente más
estandarizado del mercado, y su valor es difícil de medir en un prototipo. En cambio, "bugs que llegaron a producción"
y "minutos de revisión" son indicadores que el negocio entiende.

## 2. Diseño del sistema

```
PR → [1] Chequeos determinísticos → [2] Agente revisor → [3] Agente corrector → [4] Gate → comentario + webhook
       typecheck, tests,              diff + archivos +     fix + test, validado    política     (n8n: alertas
       secretos, reglas               convenciones          rojo→verde en un         YAML         y métricas)
                                                            worktree aislado
```

**Principio rector: la IA solo donde las reglas no llegan.** Lo que se puede detectar con un patrón (un secreto,
SQL interpolado, un stack trace en la respuesta) se detecta con código: es gratis, instantáneo y no varía entre
corridas. El modelo recibe esos resultados como "ya detectado" y se concentra en lo que requiere entender el negocio.
El eval lo confirma: la capa determinística sola detecta 6 de 10 bugs; la IA cierra los 4 restantes.

**Decisiones de diseño clave:**

- **Orquestación fija, no un agente autónomo.** El camino (revisar → corregir → validar → decidir) es conocido, así que
  lo codifiqué como un pipeline. El modelo interviene en dos pasos acotados, con entradas y salidas tipadas y validadas
  con esquemas (zod). Un agente que explora el repo con herramientas libremente consume más tokens, tarda más y es
  menos predecible, sin una ganancia clara para este problema.
- **Un fix no vale nada si no está probado.** El corrector propone el cambio y un test. El sistema primero corre el test
  sobre el código con el bug y exige que falle **por una aserción** (no por un error de import o de datos). Recién
  después aplica el fix y exige typecheck y la suite completa en verde. En el eval este guardarraíl rechazó tests
  mal planteados (uno fallaba por una clave foránea y no por el bug): sin él, habríamos presentado como "validado" un
  fix sin evidencia.
- **El agente no puede tocar lo que no debe.** Trabaja en un `git worktree` temporal, nunca en el directorio del
  desarrollador. Solo puede modificar archivos que el PR ya tocaba, y entrega patches para revisar, no commits ni
  pushes. La decisión de aplicar el fix es humana.
- **La decisión final no la toma el modelo.** El gate es código determinístico que lee `guardian.policy.yaml`: qué
  severidades bloquean, cuáles van a revisión humana, umbral de confianza. Un hallazgo grave con confianza baja no
  bloquea solo: pasa a revisión humana. Así la decisión es explicable y auditable, y el equipo la ajusta sin programar.
- **El conocimiento del equipo es un archivo, no un prompt escondido.** `CONVENCIONES.md` contiene las reglas de negocio
  (céntimos enteros, promociones no acumulables, filtrar siempre por tienda). El equipo lo mantiene y el revisor lo lee
  en cada PR. Es la respuesta concreta a "el conocimiento está disperso".

## 3. Alternativas que descarté

| Alternativa | Por qué no |
|---|---|
| Framework de agentes (Google ADK, LangChain) | Para un pipeline lineal agrega una capa de abstracción sin beneficio. Con ~2.000 líneas propias cada paso es legible y depurable. Migrar a un framework sería directo si el flujo se vuelve más complejo. |
| Que el modelo decida si el PR avanza | Una decisión que bloquea el trabajo de alguien tiene que ser reproducible y explicable. El modelo aporta hallazgos; la política decide. |
| Autofix con commit/push automático | El riesgo de un cambio incorrecto en producción supera el ahorro. El patch validado reduce el trabajo a revisar y aplicar. |
| Pedirle al modelo un diff en vez del archivo completo | Los modelos chicos generan diffs mal formados con frecuencia. El archivo completo es más robusto para archivos chicos. Para archivos grandes usaría bloques buscar/reemplazar. |
| Gitleaks / Semgrep como binarios | Son lo correcto en producción. En el prototipo implementé un subconjunto de sus reglas en código para no exigir instalaciones extra a quien lo evalúe. |
| Usar un repositorio open source como base | Con código propio controlo exactamente qué bugs hay. Eso me permite **medir** el sistema en lugar de mostrar ejemplos elegidos. |

## 4. Cómo balanceé las condiciones del reto

**Costo — US$ 0 de gasto real; ~US$ 0,005 por PR en un tier pago.** Todo corre con el tier gratuito de Gemini. Cada
corrida registra los tokens y calcula el costo equivalente con precios de referencia configurables: 1.000 PRs al mes
costarían del orden de US$ 5. En la práctica, el límite del tier gratuito no es el costo sino la **cuota: 20 requests
por día y por modelo**. Lo resolví con una cadena de modelos de respaldo, un enfriamiento por modelo (respeta el
`retryDelay` de la API para no desperdiciar requests) y un eval reanudable. Todos los resultados se obtuvieron con el
modelo más chico de la cadena (gemini-3.5-flash-lite). Para un equipo real recomendaría un tier pago: la diferencia de
costo es irrelevante y elimina la incertidumbre de cuota.

**Tiempo de respuesta — objetivo: menos de 2 minutos por PR.** Lo considero razonable porque es el orden de un
pipeline de CI: el resultado llega mientras el desarrollador todavía tiene el contexto del cambio. Una revisión humana
suele tardar horas en empezar. Medido en una laptop de 2018 (i5, 8 GB): **32 s en promedio, 91 s el peor caso**; la
capa determinística sola tarda ~14 s. La validación rojo→verde agrega ~20–30 s por fix. Ahí la tensión fue tiempo
contra confianza, y elegí confianza: un fix sin validar le traslada el trabajo de verificación al desarrollador.

**Privacidad — el código sale lo mínimo, y nunca los secretos.**
1. Al modelo solo llegan el diff y los archivos que el PR modifica, con un límite de caracteres configurable. Nunca el
   repositorio completo.
2. Antes de enviar, los secretos se redactan con las mismas reglas del escáner.
3. El proveedor se cambia con una variable de entorno. Para código real de una empresa **no usaría un tier gratuito**,
   porque sus términos permiten que el proveedor use los datos para mejorar sus productos. Usaría un servicio con
   contrato sin retención: Azure OpenAI encaja naturalmente en un entorno Microsoft (el adaptador OpenAI-compatible ya
   está). La otra opción es un modelo local con Ollama, ya implementado, que en mi equipo de 8 GB no corre con calidad
   aceptable.
4. Existe un modo `none` (solo determinístico) para repositorios donde no se acepta enviar código a ningún tercero.

La tensión privacidad↔calidad apareció concreta: enviar el archivo completo (no solo el diff) mejora la detección
porque el modelo ve el contexto; lo acoté con el presupuesto de caracteres.

**Operabilidad — que lo pueda correr alguien que no soy yo.**
- `npm run setup` + `npm run demo` corren el sistema completo **sin API key**: el modo *replay* reproduce respuestas
  reales grabadas.
- Un devcontainer permite abrirlo en GitHub Codespaces sin instalar nada.
- Una GitHub Action comenta el reporte en cada PR y falla el check si el veredicto es BLOQUEADO. Sin la key (PRs desde
  forks), degrada a la capa determinística en vez de fallar.
- Cada corrida queda en `runs.jsonl` y se envía a un webhook autenticado, que un workflow de n8n usa para alertar al
  equipo y armar un resumen semanal de valor (PRs revisados, bloqueados, horas estimadas ahorradas).

## 5. Resultados medidos

13 PRs de prueba: 10 con bugs sembrados (con títulos y descripciones que no los delatan, como en un PR real) y 3
limpios para medir falsos positivos.

| Métrica | Solo determinístico | Pipeline completo |
|---|---|---|
| Bugs detectados | 6/10 | **10/10** |
| Bugs graves bloqueados | 6/8 | **8/8** |
| PRs limpios aprobados (sin falsos positivos) | 3/3 | **3/3** |
| Veredicto exacto | 9/13 | 11/13 |
| Bugs graves con fix validado rojo→verde | — | 7/8 |
| Tiempo promedio por PR | 14 s | 32 s |

**¿El archivo de convenciones "sopla" las respuestas?** Los bugs y `CONVENCIONES.md` los escribí yo, así que corrí
el mismo eval sin ese archivo para medir su efecto:

| | Con convenciones | Sin convenciones |
|---|---|---|
| Bugs detectados | 10/10 | 10/10 |
| Falsos positivos | 0 | 0 |
| Veredicto exacto | 11/13 | 12/13 |
| Tokens de entrada por revisión | ~5.900 | ~2.700 |

La detección **no depende** del archivo. Lo que cambia es la severidad: con la regla escrita ("no ejecutar consultas
dentro de loops") el modelo escala el N+1 de *medium* a *high*. El contexto vuelve al modelo más estricto con las
normas del equipo, no más perspicaz. Para un equipo real eso es lo deseable (que se cumplan sus reglas), pero conviene
calibrar severidades con su feedback.

Lectura honesta del resto:
- Las diferencias de veredicto son casos que etiqueté como "revisión humana" (el N+1 y un error de borde en la compra
  mínima de un cupón) y que el modelo consideró graves. Es discutible quién tiene razón, y el umbral se ajusta en la
  política.
- El fix no validado es un caso donde el modelo escribió un test mal planteado (registraba una ruta después del
  manejador de errores de Express). En una corrida anterior el mismo caso sí se validó: los modelos varían entre
  corridas, y por eso cada fix se valida en vez de confiar en él.
- En esa corrida anterior, el guardarraíl de "rojo válido" rechazó un test que fallaba por una clave foránea y no por
  el bug. A partir de eso agregué el esquema de datos como contexto del corrector.
- Los casos son chicos y sintéticos. El resultado muestra que el diseño funciona, no la precisión esperable en un
  repositorio real (ver sección 6).

## 6. Qué haría con más tiempo

1. **Eval con datos reales:** tomar commits históricos de "fix" de un repositorio real, revertirlos y usarlos como
   casos. Mide el sistema contra bugs que el equipo efectivamente cometió.
2. **Medir en producción, no solo en el eval:** reacciones 👍/👎 en cada comentario del bot para calcular la precisión
   real y calibrar severidades y umbrales con el equipo.
3. **Dashboard de valor en Power BI** sobre el historial de corridas: horas liberadas, bugs bloqueados por categoría,
   adopción por equipo.
4. **Fixes como "suggested changes" de GitHub**, aplicables con un clic desde el PR.
5. **Ruteo de modelos:** el modelo más barato para revisar y uno más capaz solo cuando el fix falla en el primer intento.
6. **Integración nativa en el ecosistema Microsoft:** notificaciones en Teams vía Power Automate, y un agente de
   Copilot Studio que responda preguntas usando `CONVENCIONES.md` y el historial de hallazgos.

## 7. Qué resolví con IA y qué es mío

<!-- COMPLETAR CON TUS PALABRAS: esta sección tiene que ser 100% honesta y reflejar lo que efectivamente hiciste. -->

Trabajé con Claude Code como asistente de programación durante todo el proyecto, de la misma forma en que lo uso en mi
trabajo diario.

**Decisiones mías:** qué parte del ciclo atacar y qué capacidad descartar; usar mi experiencia en plataformas
multitienda para elegir los bugs; TypeScript como stack; la restricción de costo cero y cómo resolverla (replay,
cadena de respaldo); el principio "determinístico primero"; que el gate no dependa del modelo; y el workflow de n8n,
que construí yo. <!-- ajustar -->

**Con apoyo de IA:** la discusión de la estrategia inicial, la generación de la mayor parte del código y de los tests
a partir de mis definiciones, y la redacción de la documentación, que revisé y ajusté. <!-- ajustar -->

Revisé todo el código entregado y puedo explicar y modificar cualquier parte en la presentación.
