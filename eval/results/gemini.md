# Resultados del eval — gemini (gemini-3.5-flash-lite)

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
| Tiempo promedio por PR | 31.7 s (máx 91.2 s) |
| Tokens promedio por PR (entrada/salida) | 5870 / 1033 |
| Costo equivalente en tier pago, promedio por PR | US$ 0.0043 |

## Detalle por caso
| Caso | Esperado | Obtenido | Detectado por | Fix validado | FP | Tiempo |
|---|---|---|---|---|---|---|
| 01-decimal-discount | BLOCK | ✅ BLOCK | llm | ✅ | 0 | 91.2 s |
| 02-stacked-promos | BLOCK | ✅ BLOCK | tests, llm | ✅ | 0 | 29.7 s |
| 03-negative-stock | BLOCK | ✅ BLOCK | tests, llm | ✅ | 0 | 39.3 s |
| 04-cross-store-price | BLOCK | ✅ BLOCK | tests, llm | ✅ | 0 | 30.1 s |
| 05-sqli-category | BLOCK | ✅ BLOCK | static | ✅ | 0 | 25.6 s |
| 06-idor-order-history | BLOCK | ✅ BLOCK | llm | ✅ | 0 | 26.5 s |
| 07-hardcoded-secret | BLOCK | ✅ BLOCK | secrets | ✅ | 0 | 18.8 s |
| 08-n-plus-one | REVIEW | ❌ BLOCK | llm | ❌ | 0 | 12.9 s |
| 09-error-leak | BLOCK | ✅ BLOCK | static | ❌ | 0 | 46.9 s |
| 10-coupon-boundary | REVIEW | ❌ BLOCK | llm | ✅ | 0 | 29.2 s |
| 11-clean-list-stores | APPROVE | ✅ APPROVE | - | - | 0 | 18.0 s |
| 12-clean-pagination | APPROVE | ✅ APPROVE | - | - | 0 | 26.3 s |
| 13-clean-bearer-refactor | APPROVE | ✅ APPROVE | - | - | 0 | 16.9 s |
