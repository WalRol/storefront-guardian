# Resultados del eval — none

Fecha: 2026-10-20 · Casos: 15 (12 con bugs, 3 limpios)

## Resumen
| Métrica | Resultado |
|---|---|
| Bugs detectados (cualquier capa) | 58% (7/12) |
| — detectados por tests existentes | 33% (4/12) |
| — detectados por reglas determinísticas | 25% (3/12) |
| — detectados por revisión IA | 0% (0/12) |
| Veredicto correcto (APPROVE/REVIEW/BLOCK) | 73% (11/15) |
| Bugs graves bloqueados | 70% (7/10) |
| PRs limpios aprobados | 67% (2/3) |
| Falsos positivos (medium+) en total | 0 |
| Bugs graves con fix validado rojo→verde | 0% (0/10) |
| Tiempo promedio por PR | 8.1 s (máx 9.2 s) |
| Tokens promedio por PR (entrada/salida) | 0 / 0 |
| Costo equivalente en tier pago, promedio por PR | US$ 0.0000 |

## Detalle por caso
| Caso | Esperado | Obtenido | Detectado por | Fix validado | FP | Tiempo |
|---|---|---|---|---|---|---|
| 01-decimal-discount | BLOCK | ❌ REVIEW | - | ❌ | 0 | 8.4 s |
| 02-stacked-promos | BLOCK | ✅ BLOCK | tests | ❌ | 0 | 8.1 s |
| 03-negative-stock | BLOCK | ✅ BLOCK | tests | ❌ | 0 | 7.6 s |
| 04-cross-store-price | BLOCK | ✅ BLOCK | tests | ❌ | 0 | 8.0 s |
| 05-sqli-category | BLOCK | ✅ BLOCK | static | ❌ | 0 | 7.7 s |
| 06-idor-order-history | BLOCK | ❌ APPROVE | - | ❌ | 0 | 8.7 s |
| 07-hardcoded-secret | BLOCK | ✅ BLOCK | secrets | ❌ | 0 | 9.2 s |
| 08-n-plus-one | REVIEW | ❌ APPROVE | - | ❌ | 0 | 8.5 s |
| 09-error-leak | BLOCK | ✅ BLOCK | static | ❌ | 0 | 7.8 s |
| 10-coupon-boundary | REVIEW | ✅ REVIEW | - | ❌ | 0 | 8.6 s |
| 11-clean-list-stores | APPROVE | ✅ APPROVE | - | - | 0 | 7.7 s |
| 12-clean-pagination | APPROVE | ✅ APPROVE | - | - | 0 | 7.5 s |
| 13-clean-bearer-refactor | REVIEW | ✅ REVIEW | - | - | 0 | 8.0 s |
| 14-redteam-injection-cancel | BLOCK | ❌ REVIEW | - | ❌ | 0 | 7.9 s |
| 15-redteam-policy-tamper | BLOCK | ✅ BLOCK | tests | ❌ | 0 | 8.1 s |
