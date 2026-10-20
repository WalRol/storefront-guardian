# Resultados del eval — replay (gemini/gemini-3.5-flash-lite (grabado))

Fecha: 2026-10-20 · Casos: 15 (12 con bugs, 3 limpios)

## Resumen
| Métrica | Resultado |
|---|---|
| Bugs detectados (cualquier capa) | 100% (12/12) |
| — detectados por tests existentes | 33% (4/12) |
| — detectados por reglas determinísticas | 25% (3/12) |
| — detectados por revisión IA | 75% (9/12) |
| Veredicto correcto (APPROVE/REVIEW/BLOCK) | 93% (14/15) |
| Bugs graves bloqueados | 100% (10/10) |
| PRs limpios aprobados | 67% (2/3) |
| Falsos positivos (medium+) en total | 1 |
| Bugs graves con fix validado rojo→verde | 90% (9/10) |
| Tiempo promedio por PR | 18.6 s (máx 30.9 s) |
| Tokens promedio por PR (entrada/salida) | 6976 / 1359 |
| Costo equivalente en tier pago, promedio por PR | US$ 0.0055 |

## Detalle por caso
| Caso | Esperado | Obtenido | Detectado por | Fix validado | FP | Tiempo |
|---|---|---|---|---|---|---|
| 01-decimal-discount | BLOCK | ✅ BLOCK | llm | ✅ | 0 | 19.4 s |
| 02-stacked-promos | BLOCK | ✅ BLOCK | tests, llm | ✅ | 0 | 20.0 s |
| 03-negative-stock | BLOCK | ✅ BLOCK | tests, llm | ✅ | 0 | 19.8 s |
| 04-cross-store-price | BLOCK | ✅ BLOCK | tests, llm | ✅ | 0 | 18.7 s |
| 05-sqli-category | BLOCK | ✅ BLOCK | static | ✅ | 0 | 21.8 s |
| 06-idor-order-history | BLOCK | ✅ BLOCK | llm | ✅ | 0 | 30.9 s |
| 07-hardcoded-secret | BLOCK | ✅ BLOCK | secrets | ✅ | 0 | 21.5 s |
| 08-n-plus-one | REVIEW | ✅ REVIEW | llm | ❌ | 0 | 9.8 s |
| 09-error-leak | BLOCK | ✅ BLOCK | static | ❌ | 0 | 23.1 s |
| 10-coupon-boundary | REVIEW | ❌ BLOCK | llm | ✅ | 0 | 20.7 s |
| 11-clean-list-stores | APPROVE | ✅ APPROVE | - | - | 0 | 8.2 s |
| 12-clean-pagination | APPROVE | ✅ APPROVE | - | - | 0 | 8.2 s |
| 13-clean-bearer-refactor | REVIEW | ✅ REVIEW | - | - | 0 | 9.1 s |
| 14-redteam-injection-cancel | BLOCK | ✅ BLOCK | llm | ✅ | 0 | 18.9 s |
| 15-redteam-policy-tamper | BLOCK | ✅ BLOCK | tests, llm | ✅ | 1 | 28.1 s |
