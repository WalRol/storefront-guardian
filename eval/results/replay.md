# Resultados del eval — replay (gemini/gemini-3.5-flash-lite (grabado))

Fecha: 2026-10-16 · Casos: 13 (10 con bugs, 3 limpios)

## Resumen
| Métrica | Resultado |
|---|---|
| Bugs detectados (cualquier capa) | 100% (10/10) |
| — detectados por tests existentes | 30% (3/10) |
| — detectados por reglas determinísticas | 30% (3/10) |
| — detectados por revisión IA | 70% (7/10) |
| Veredicto correcto (APPROVE/REVIEW/BLOCK) | 85% (11/13) |
| Bugs graves bloqueados | 100% (8/8) |
| PRs limpios aprobados | 100% (3/3) |
| Falsos positivos (medium+) en total | 0 |
| Bugs graves con fix validado rojo→verde | 75% (6/8) |
| Tiempo promedio por PR | 18.0 s (máx 33.1 s) |
| Tokens promedio por PR (entrada/salida) | 5651 / 1197 |
| Costo equivalente en tier pago, promedio por PR | US$ 0.0047 |

## Detalle por caso
| Caso | Esperado | Obtenido | Detectado por | Fix validado | FP | Tiempo |
|---|---|---|---|---|---|---|
| 01-decimal-discount | BLOCK | ✅ BLOCK | llm | ✅ | 0 | 20.7 s |
| 02-stacked-promos | BLOCK | ✅ BLOCK | tests, llm | ✅ | 0 | 24.5 s |
| 03-negative-stock | BLOCK | ✅ BLOCK | tests, llm | ✅ | 0 | 33.1 s |
| 04-cross-store-price | BLOCK | ✅ BLOCK | tests, llm | ❌ | 0 | 25.4 s |
| 05-sqli-category | BLOCK | ✅ BLOCK | static | ✅ | 0 | 20.7 s |
| 06-idor-order-history | BLOCK | ✅ BLOCK | llm | ❌ | 0 | 8.3 s |
| 07-hardcoded-secret | BLOCK | ✅ BLOCK | secrets | ✅ | 0 | 17.2 s |
| 08-n-plus-one | REVIEW | ❌ BLOCK | llm | ❌ | 0 | 8.5 s |
| 09-error-leak | BLOCK | ✅ BLOCK | static | ✅ | 0 | 31.8 s |
| 10-coupon-boundary | REVIEW | ❌ BLOCK | llm | ✅ | 0 | 19.3 s |
| 11-clean-list-stores | APPROVE | ✅ APPROVE | - | - | 0 | 7.9 s |
| 12-clean-pagination | APPROVE | ✅ APPROVE | - | - | 0 | 8.1 s |
| 13-clean-bearer-refactor | APPROVE | ✅ APPROVE | - | - | 0 | 8.1 s |
