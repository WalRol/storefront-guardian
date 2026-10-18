# Resultados del eval — gemini (gemini-3.5-flash-lite)-sin-contexto

Fecha: 2026-10-18 · Casos: 13 (10 con bugs, 3 limpios)

## Resumen
| Métrica | Resultado |
|---|---|
| Bugs detectados (cualquier capa) | 100% (10/10) |
| — detectados por tests existentes | 30% (3/10) |
| — detectados por reglas determinísticas | 30% (3/10) |
| — detectados por revisión IA | 70% (7/10) |
| Veredicto correcto (APPROVE/REVIEW/BLOCK) | 92% (12/13) |
| Bugs graves bloqueados | 100% (8/8) |
| PRs limpios aprobados | 100% (3/3) |
| Falsos positivos (medium+) en total | 0 |
| Bugs graves con fix validado rojo→verde | no aplica (--no-fix) |
| Tiempo promedio por PR | 22.0 s (máx 58.6 s) |
| Tokens promedio por PR (entrada/salida) | 2718 / 137 |
| Costo equivalente en tier pago, promedio por PR | US$ 0.0012 |

## Detalle por caso
| Caso | Esperado | Obtenido | Detectado por | Fix validado | FP | Tiempo |
|---|---|---|---|---|---|---|
| 01-decimal-discount | BLOCK | ✅ BLOCK | llm | - | 0 | 26.2 s |
| 02-stacked-promos | BLOCK | ✅ BLOCK | tests, llm | - | 0 | 23.1 s |
| 03-negative-stock | BLOCK | ✅ BLOCK | tests, llm | - | 0 | 28.8 s |
| 04-cross-store-price | BLOCK | ✅ BLOCK | tests, llm | - | 0 | 21.6 s |
| 05-sqli-category | BLOCK | ✅ BLOCK | static | - | 0 | 58.6 s |
| 06-idor-order-history | BLOCK | ✅ BLOCK | llm | - | 0 | 20.2 s |
| 07-hardcoded-secret | BLOCK | ✅ BLOCK | secrets | - | 0 | 16.1 s |
| 08-n-plus-one | REVIEW | ✅ REVIEW | llm | - | 0 | 13.1 s |
| 09-error-leak | BLOCK | ✅ BLOCK | static | - | 0 | 15.1 s |
| 10-coupon-boundary | REVIEW | ❌ BLOCK | llm | - | 0 | 15.8 s |
| 11-clean-list-stores | APPROVE | ✅ APPROVE | - | - | 0 | 14.5 s |
| 12-clean-pagination | APPROVE | ✅ APPROVE | - | - | 0 | 15.1 s |
| 13-clean-bearer-refactor | APPROVE | ✅ APPROVE | - | - | 0 | 17.7 s |
