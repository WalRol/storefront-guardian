# Resultados del eval — replay (gemini/gemini-3.5-flash-lite (grabado))

Fecha: 2026-10-18 · Casos: 13 (10 con bugs, 3 limpios)

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
| Bugs graves con fix validado rojo→verde | 88% (7/8) |
| Tiempo promedio por PR | 21.5 s (máx 38.7 s) |
| Tokens promedio por PR (entrada/salida) | 5870 / 1033 |
| Costo equivalente en tier pago, promedio por PR | US$ 0.0043 |

## Detalle por caso
| Caso | Esperado | Obtenido | Detectado por | Fix validado | FP | Tiempo |
|---|---|---|---|---|---|---|
| 01-decimal-discount | BLOCK | ✅ BLOCK | llm | ✅ | 0 | 32.6 s |
| 02-stacked-promos | BLOCK | ✅ BLOCK | tests, llm | ✅ | 0 | 25.0 s |
| 03-negative-stock | BLOCK | ✅ BLOCK | tests, llm | ✅ | 0 | 30.3 s |
| 04-cross-store-price | BLOCK | ✅ BLOCK | tests, llm | ✅ | 0 | 25.4 s |
| 05-sqli-category | BLOCK | ✅ BLOCK | static | ✅ | 0 | 25.6 s |
| 06-idor-order-history | BLOCK | ✅ BLOCK | llm | ✅ | 0 | 24.5 s |
| 07-hardcoded-secret | BLOCK | ✅ BLOCK | secrets | ✅ | 0 | 20.2 s |
| 08-n-plus-one | REVIEW | ❌ BLOCK | llm | ❌ | 0 | 9.0 s |
| 09-error-leak | BLOCK | ✅ BLOCK | static | ❌ | 0 | 38.7 s |
| 10-coupon-boundary | REVIEW | ❌ BLOCK | llm | ✅ | 0 | 21.4 s |
| 11-clean-list-stores | APPROVE | ✅ APPROVE | - | - | 0 | 8.9 s |
| 12-clean-pagination | APPROVE | ✅ APPROVE | - | - | 0 | 8.9 s |
| 13-clean-bearer-refactor | APPROVE | ✅ APPROVE | - | - | 0 | 9.2 s |
