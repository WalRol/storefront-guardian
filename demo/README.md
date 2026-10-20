# Demo en vivo

Bugs preparados para la presentación, **fuera del eval**: no se usaron para ajustar prompts, reglas ni
`CONVENCIONES.md`. La idea es que el evaluador elija uno (o escriba el suyo) y vea al bot comentar el hallazgo,
el fix y el test que lo prueba en un PR real.

## Casos

Resultado con Gemini (`gemini-3.5-flash-lite`, tier gratuito), 20/10/2026:

| Caso | El PR dice | El bug real | ¿Regla en CONVENCIONES.md? | Resultado |
|---|---|---|---|---|
| [01](bugs/01-assisted-checkout) | Compras asistidas por soporte | Cualquiera crea órdenes a nombre de otro (`userId` del body) | Sí | ⛔ high, fix validado |
| [02](bugs/02-shown-price) | Respetar el precio mostrado en vitrina | El cliente elige el precio que paga | **No** | ❌ **APROBADO: no lo detectó** |
| [03](bugs/03-cached-promotions) | Cargar promociones una sola vez | Se aplican promos de otras tiendas | Sí | ⛔ high, fix no validado |
| [04](bugs/04-internal-header) | Identificación de servicios internos | Bypass de auth con `x-user-id` | Parcial | ⛔ critical, fix validado |
| [05](bugs/05-coupon-per-line) | Mostrar el cupón por producto | El cupón se descuenta una vez por línea | **No** | ⛔ critical, fix validado |
| [06](bugs/06-clean-currency) | Informar la moneda del precio | — (limpio) | — | ✅ APROBADO |

**Para la demo usar 04, 05 y 01**: detección y fix validado, y 05 no está en las convenciones.

**El 02 es la respuesta honesta a "¿los casos están hechos a medida?"**: no, y acá el sistema falla. El modelo no
infiere que el precio nunca debe venir del cliente. La corrección es la que haría un equipo real: agregar a
`CONVENCIONES.md` "el precio siempre sale de `store_prices`, nunca del request" y medir de nuevo.

## Cómo correrla

Requisitos: `gh auth login` hecho y el secret `GEMINI_API_KEY` en el repo. Desde la raíz, en Git Bash:

```bash
scripts/demo-pr.sh 04-internal-header        # un caso preparado
```

Si el evaluador escribe su propio bug: que edite cualquier archivo de `storefront-demo/` en tu máquina, y después

```bash
scripts/demo-pr.sh --live "feat: cambio del evaluador"
git checkout -- storefront-demo              # al terminar, descartar el cambio local
```

El script arma la rama en un worktree temporal sobre `origin/main` (tu carpeta no se toca), abre el PR, sigue el
check y muestra cuánto tardó. El comentario del bot aparece en el PR.

## Tiempos y plan B

Con el tier gratuito cada caso tardó **40–146 s**: los dos primeros modelos de la cadena respondieron 429 en todos.
Con una key paga no hay cola y el objetivo de menos de 2 minutos es holgado. Si la IA no responde, Guardian no se
cae: corre la capa determinística y deja el PR en REVISIÓN HUMANA, explicando por qué (pasó con el caso 06 en la
primera corrida).

**Plan B sin red ni cuota**: las respuestas de esta corrida están grabadas en `agent/cassettes/demo/`.

```bash
npm run guardian --prefix agent -- review --demo 04-internal-header --provider replay --exit-zero
```

Typecheck, tests y la validación rojo → verde del fix se ejecutan de verdad; solo la respuesta del modelo es grabada.
