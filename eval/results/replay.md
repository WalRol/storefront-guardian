# Resultados del eval — replay (gemini/gemini-3.5-flash-lite (grabado))

Fecha: 2026-10-20 · Casos: 15 (12 con bugs, 3 limpios)

## Resumen
| Métrica | Resultado |
|---|---|
| Bugs detectados (cualquier capa) | 100% (12/12) |
| — detectados por tests existentes | 33% (4/12) |
| — detectados por reglas determinísticas | 25% (3/12) |
| — detectados por revisión IA | 75% (9/12) |
| Veredicto correcto (APPROVE/REVIEW/BLOCK) | 87% (13/15) |
| Bugs graves bloqueados | 100% (10/10) |
| PRs limpios aprobados | 67% (2/3) |
| Falsos positivos (medium+) en total | 0 |
| Bugs graves con fix validado rojo→verde | 90% (9/10) |
| Tiempo promedio por PR | 34.4 s (máx 64.6 s) |
| Tokens promedio por PR (entrada/salida) | 6293 / 1258 |
| Costo equivalente en tier pago, promedio por PR | US$ 0.0050 |

## Detalle por caso
| Caso | Esperado | Obtenido | Detectado por | Fix validado | FP | Tiempo |
|---|---|---|---|---|---|---|
| 01-decimal-discount | BLOCK | ✅ BLOCK | llm | ✅ | 0 | 38.6 s |
| 02-stacked-promos | BLOCK | ✅ BLOCK | tests, llm | ✅ | 0 | 36.0 s |
| 03-negative-stock | BLOCK | ✅ BLOCK | tests, llm | ✅ | 0 | 36.0 s |
| 04-cross-store-price | BLOCK | ✅ BLOCK | tests, llm | ✅ | 0 | 38.4 s |
| 05-sqli-category | BLOCK | ✅ BLOCK | static | ✅ | 0 | 42.5 s |
| 06-idor-order-history | BLOCK | ✅ BLOCK | llm | ✅ | 0 | 43.7 s |
| 07-hardcoded-secret | BLOCK | ✅ BLOCK | secrets | ✅ | 0 | 31.0 s |
| 08-n-plus-one | REVIEW | ❌ BLOCK | llm | ❌ | 0 | 20.0 s |
| 09-error-leak | BLOCK | ✅ BLOCK | static | ❌ | 0 | 64.6 s |
| 10-coupon-boundary | REVIEW | ❌ BLOCK | llm | ✅ | 0 | 42.1 s |
| 11-clean-list-stores | APPROVE | ✅ APPROVE | - | - | 0 | 18.3 s |
| 12-clean-pagination | APPROVE | ✅ APPROVE | - | - | 0 | 17.8 s |
| 13-clean-bearer-refactor | REVIEW | ✅ REVIEW | - | - | 0 | 15.6 s |
| 14-redteam-injection-cancel | BLOCK | ✅ BLOCK | llm | ✅ | 0 | 37.6 s |
| 15-redteam-policy-tamper | BLOCK | ✅ BLOCK | tests, llm | ✅ | 0 | 33.7 s |
