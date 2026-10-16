# Resultados del eval — gemini (gemini-3.5-flash-lite)

Fecha: 2026-10-16 · Casos: 13 (10 con bugs, 3 limpios)

## Resumen
| Métrica | Resultado |
|---|---|
| Bugs detectados (cualquier capa) | 50% (5/10) |
| — detectados por tests existentes | 10% (1/10) |
| — detectados por reglas determinísticas | 20% (2/10) |
| — detectados por revisión IA | 30% (3/10) |
| Veredicto correcto (APPROVE/REVIEW/BLOCK) | 54% (7/13) |
| Bugs graves bloqueados | 50% (4/8) |
| PRs limpios aprobados | 100% (3/3) |
| Falsos positivos (medium+) en total | 0 |
| Bugs con fix validado rojo→verde | 63% (5/8) |
| Tiempo promedio por PR | 34.4 s (máx 54.2 s) |
| Tokens promedio por PR (entrada/salida) | 5426 / 842 |
| Costo equivalente en tier pago, promedio por PR | US$ 0.0037 |

## Detalle por caso
| Caso | Esperado | Obtenido | Detectado por | Fix validado | FP | Tiempo |
|---|---|---|---|---|---|---|
| 01-decimal-discount | BLOCK | ✅ BLOCK | llm | ✅ | 0 | 53.1 s |
| 02-stacked-promos | BLOCK | ✅ BLOCK | tests, llm | ✅ | 0 | 39.0 s |
| 03-negative-stock | BLOCK | ❌ ERROR | - | - | 0 | 0.0 s |
| 04-cross-store-price | BLOCK | ❌ ERROR | - | - | 0 | 0.0 s |
| 05-sqli-category | BLOCK | ✅ BLOCK | static | ✅ | 0 | 42.6 s |
| 06-idor-order-history | BLOCK | ❌ ERROR | - | - | 0 | 0.0 s |
| 07-hardcoded-secret | BLOCK | ❌ ERROR | - | - | 0 | 0.0 s |
| 08-n-plus-one | REVIEW | ❌ ERROR | - | - | 0 | 0.0 s |
| 09-error-leak | BLOCK | ✅ BLOCK | static | ✅ | 0 | 54.2 s |
| 10-coupon-boundary | REVIEW | ❌ BLOCK | llm | ✅ | 0 | 38.2 s |
| 11-clean-list-stores | APPROVE | ✅ APPROVE | - | - | 0 | 16.6 s |
| 12-clean-pagination | APPROVE | ✅ APPROVE | - | - | 0 | 16.9 s |
| 13-clean-bearer-refactor | APPROVE | ✅ APPROVE | - | - | 0 | 14.5 s |

## Errores
- 03-negative-stock: HTTP 429 de generativelanguage.googleapis.com: {
- 04-cross-store-price: HTTP 429 de generativelanguage.googleapis.com: {
- 06-idor-order-history: HTTP 429 de generativelanguage.googleapis.com: {
- 07-hardcoded-secret: HTTP 429 de generativelanguage.googleapis.com: {
- 08-n-plus-one: HTTP 429 de generativelanguage.googleapis.com: {
