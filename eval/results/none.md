# Resultados del eval — none

Fecha: 2026-10-16 · Casos: 13 (10 con bugs, 3 limpios)

## Resumen
| Métrica | Resultado |
|---|---|
| Bugs detectados (cualquier capa) | 60% (6/10) |
| — detectados por tests existentes | 30% (3/10) |
| — detectados por reglas determinísticas | 30% (3/10) |
| — detectados por revisión IA | 0% (0/10) |
| Veredicto correcto (APPROVE/REVIEW/BLOCK) | 69% (9/13) |
| Bugs graves bloqueados | 75% (6/8) |
| PRs limpios aprobados | 100% (3/3) |
| Falsos positivos (medium+) en total | 0 |
| Bugs con fix validado rojo→verde | 0% (0/8) |
| Tiempo promedio por PR | 13.9 s (máx 25.4 s) |
| Tokens promedio por PR (entrada/salida) | 0 / 0 |
| Costo equivalente en tier pago, promedio por PR | US$ 0.0000 |

## Detalle por caso
| Caso | Esperado | Obtenido | Detectado por | Fix validado | FP | Tiempo |
|---|---|---|---|---|---|---|
| 01-decimal-discount | BLOCK | ❌ APPROVE | - | ❌ | 0 | 16.8 s |
| 02-stacked-promos | BLOCK | ✅ BLOCK | tests | ❌ | 0 | 10.5 s |
| 03-negative-stock | BLOCK | ✅ BLOCK | tests | ❌ | 0 | 9.3 s |
| 04-cross-store-price | BLOCK | ✅ BLOCK | tests | ❌ | 0 | 12.1 s |
| 05-sqli-category | BLOCK | ✅ BLOCK | static | ❌ | 0 | 9.9 s |
| 06-idor-order-history | BLOCK | ❌ APPROVE | - | ❌ | 0 | 22.1 s |
| 07-hardcoded-secret | BLOCK | ✅ BLOCK | secrets | ❌ | 0 | 18.8 s |
| 08-n-plus-one | REVIEW | ❌ APPROVE | - | ❌ | 0 | 25.4 s |
| 09-error-leak | BLOCK | ✅ BLOCK | static | ❌ | 0 | 14.7 s |
| 10-coupon-boundary | REVIEW | ❌ APPROVE | - | ❌ | 0 | 10.7 s |
| 11-clean-list-stores | APPROVE | ✅ APPROVE | - | - | 0 | 10.1 s |
| 12-clean-pagination | APPROVE | ✅ APPROVE | - | - | 0 | 10.5 s |
| 13-clean-bearer-refactor | APPROVE | ✅ APPROVE | - | - | 0 | 10.5 s |
