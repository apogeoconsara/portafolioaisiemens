# Power BI – Digital Finance

Proyecto de Power BI (formato PBIP) con los datos del portafolio.

> Se generó sin Power BI Desktop. Todos sus archivos JSON se validaron contra los esquemas
> oficiales de Microsoft y el modelo se revisó campo por campo (tablas, relaciones, medidas y
> gráficas), pero **no se ha abierto aún en Power BI Desktop**. Si algo falla,
> copia el mensaje de error (botón "Copiar los detalles al Portapapeles") y se corrige.
> Importante: **extrae todo el zip** antes de abrir `DigitalFinance.pbip`.

## Cómo abrirlo
1. **Extrae todo el zip** (clic derecho → Extraer todo). No lo abras desde dentro del zip.
2. En Power BI Desktop: Archivo → Opciones → Características en versión preliminar → activa
   **"Guardar con formato de proyecto de Power BI (.pbip)"** y **"Formato de metadatos de informe de Power BI (PBIR)"**. Reinicia el programa.
3. Abre **`DigitalFinance.pbip`** desde la carpeta extraída.
4. Pulsa **Actualizar ahora** en la barra amarilla. Los datos ya vienen dentro del proyecto: no hace falta conexión ni copiar carpetas.
5. Si quieres un solo archivo: Archivo → Guardar como → **.pbix**.
6. Tema opcional: Vista → Temas → Examinar temas → `tema_finanzas.json`.

## Qué trae
**Modelo:** fico_actuals, cost_center_master, ops_kpis, inventory_mm y una tabla `Periodo` (1–12), con los datos incluidos en el propio modelo (la carpeta `datos` solo trae los CSV originales como referencia). Los datos se relacionan por centro de costo y por periodo, así que el segmentador de periodo filtra todas las gráficas.

**Medidas:** Real, Plan, Variacion, Variacion %, Real YTD, Plan YTD, Variacion YTD %,
Productividad, Stock, Punto de reorden, Lineas bajo reorden, y de calidad de datos:
Partidas sin maestro, Gasto en bloqueados. `Color variacion` devuelve un color hex (verde / ámbar / rojo)
para formato condicional.

**Seguridad por fila (RLS):** roles `Area Manufactura` y `Area Supply Chain` (filtran por grupo de centro de costo).
Pruébalos en Modelado → Ver como. Los accesos reales se asignan en el servicio de Power BI.

**Página 1 · Resumen financiero:** segmentador de periodo, 4 tarjetas, 4 gráficas.
**Página 2 · Calidad de datos y controles:** 3 tarjetas de hallazgos, tabla de centros de costo y acumulado del año.

## Formato condicional del semáforo (1 minuto)
Tarjeta o columna "Variación %" → Formato → Color de fuente → fx → "Valor de campo" → medida `Color variacion`.

## Nota sobre los datos
El centro de costo 4009000 no está en el maestro (aparece en blanco / "sin maestro") y el 4004000 está
BLOCKED: son hallazgos de calidad de datos intencionales de la muestra.
