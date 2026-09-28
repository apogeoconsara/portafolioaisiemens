# Portafolio Digital Finance & Analytics — Siemens Energy

Página estática de una sola vista (`index.html`) construida como pieza de portafolio para la
posición **Digital Finance Business Partner** en Siemens Energy. No es solo una lista de
habilidades: es una herramienta funcional que demuestra automatización.

## Qué incluye

- **Generador automatizado de reportes** (`assets/js/app.js`): parsea un CSV con esquema tipo
  SAP FI/CO (`month, cost_center, area, actual_usd, budget_usd, inventory_units,
  inventory_target_units, productivity_index, headcount`), calcula KPIs, variaciones vs.
  presupuesto, brechas de inventario y genera insights de riesgo/tendencia automáticamente.
  Se puede usar el dataset de ejemplo (`assets/data/sample_finance_data.csv`) o cargar un CSV
  propio con el mismo esquema.
- **Dashboard** con 4 gráficos (Chart.js): actual vs. presupuesto, variación % por centro de
  costo, inventario actual vs. objetivo, e índice de productividad.
- **Asistente conversacional** (`assets/js/skills-data.js` + `app.js`): chatbot de reglas que
  responde preguntas sobre SAP, Power BI/Tableau, automatización (Alteryx/ETL), SQL y
  experiencia, como demo de "user enablement".
- **Sección de habilidades** mapeada 1:1 con los requisitos del job post.

## Cómo verlo localmente

No requiere build ni dependencias: abre `index.html` en cualquier navegador, o sirve la carpeta
con cualquier servidor estático:

```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```

## Estructura

```
index.html
assets/
  css/style.css
  js/app.js            # parseo CSV, cálculo de KPIs/insights, charts, chatbot
  js/skills-data.js     # datos de habilidades y respuestas del chatbot
  data/sample_finance_data.csv
```
