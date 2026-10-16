# Convenciones del equipo — storefront-demo

Este archivo lo mantiene el equipo. Storefront Guardian lo incluye en cada revisión
para que el agente conozca reglas de negocio que no se deducen del código.

## Dinero
- Todos los montos se manejan en **céntimos enteros** (`*Cents`). Nunca floats para dinero.
- Todo cálculo que pueda producir fracciones (porcentajes) se redondea con `Math.round` en el momento de calcularlo.

## Promociones
- Las promociones por categoría **no son acumulables**: a cada línea se aplica solo el mayor porcentaje vigente.
- El cupón de monto fijo se aplica si el subtotal ya descontado es **mayor o igual** a la compra mínima.
- El total de una orden nunca puede ser negativo.

## Multitienda
- Cada tienda tiene su propio precio y stock por SKU. Toda consulta de precio o stock **debe filtrar por `store_id`**.

## Stock
- El stock nunca puede quedar negativo. La reserva se hace con un `UPDATE` condicional dentro de la transacción del checkout.

## Seguridad
- Toda consulta SQL usa parámetros del driver; nunca interpolación de strings.
- Un usuario solo puede acceder a sus propios recursos (órdenes, historial). El id del usuario sale del token, nunca de parámetros del request.
- Las respuestas de error no exponen mensajes internos ni stack traces.
- Los secretos se leen de variables de entorno.

## Performance
- No ejecutar consultas dentro de loops sobre resultados (N+1); preparar las sentencias una sola vez al crear el router.
