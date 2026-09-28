// Mapa habilidad -> requisito del job post, usado por app.js para pintar la grid y alimentar al chatbot.
const SKILLS = [
  {
    tag: "Automatización",
    title: "Automatización de procesos Finance/Controlling",
    body: "Diseño de flujos que reemplazan tareas manuales repetitivas (cierres, conciliaciones, consolidación de reportes) con herramientas digitales aprobadas.",
    keywords: ["automatizacion", "automatiza", "proceso manual", "alteryx", "rpa"]
  },
  {
    tag: "SAP FI/CO",
    title: "Pipelines de datos conectados a SAP",
    body: "Entendimiento de estructuras FI/CO (centros de costo, órdenes internas, cuentas contables) para construir pipelines gobernados hacia BI.",
    keywords: ["sap", "fi/co", "fico", "erp", "pipeline"]
  },
  {
    tag: "BI & Dashboards",
    title: "Power BI / Tableau / Excel avanzado",
    body: "Construcción de dashboards de desempeño financiero, productividad, inventario y KPIs operativos con storytelling ejecutivo.",
    keywords: ["power bi", "tableau", "dashboard", "excel", "kpi", "reporte"]
  },
  {
    tag: "SQL & Data",
    title: "SQL y fundamentos de gobierno de datos",
    body: "Consultas y modelado de datos con control de calidad, trazabilidad y ownership claro por área (Finance, Supply Chain, IT).",
    keywords: ["sql", "gobierno de datos", "data quality", "calidad de datos"]
  },
  {
    tag: "Analítica",
    title: "Análisis de tendencias y riesgos",
    body: "Detección automática de variaciones presupuestales, quiebres de inventario y caídas de productividad para priorizar decisiones.",
    keywords: ["tendencia", "riesgo", "variacion", "insight", "analisis"]
  },
  {
    tag: "Comunicación",
    title: "Stakeholder management & bilingüe ES/EN",
    body: "Capacitación de usuarios, documentación de controles y comunicación de insights a Finance, Operaciones, IT y Supply Chain.",
    keywords: ["stakeholder", "comunicacion", "ingles", "español", "entrenamiento", "usuarios"]
  }
];

// Respuestas del asistente, evaluadas por coincidencia de palabras clave.
const CHAT_RESPONSES = [
  {
    keywords: ["sap", "fico", "fi/co", "erp"],
    answer: "Trabajo con estructuras SAP FI/CO (centros de costo, cuentas, órdenes internas) como fuente para pipelines de datos gobernados. El dashboard de esta página usa exactamente ese esquema: centro de costo, actual vs. presupuesto e inventario."
  },
  {
    keywords: ["power bi", "tableau", "dashboard", "visualizacion"],
    answer: "Construyo dashboards de Power BI/Tableau enfocados en desempeño financiero, productividad y KPIs operativos. En la sección 'Generador automatizado de reportes' puedes ver el mismo enfoque: KPIs arriba, gráficos de tendencia abajo, insights al final."
  },
  {
    keywords: ["alteryx", "etl", "automatizacion", "rpa", "automatiza"],
    answer: "Uso herramientas ETL / workflow-automation (equivalentes a Alteryx) para automatizar procesos de Finance de alto esfuerzo manual. El generador de reportes de esta página simula justo eso: sube un CSV crudo y obtén KPIs e insights sin cálculo manual."
  },
  {
    keywords: ["sql", "base de datos", "gobierno de datos", "data quality"],
    answer: "Tengo bases sólidas de SQL y gobierno de datos: control de calidad, documentación de fuentes y ownership por área. Priorizo mantener trazabilidad entre el dato SAP y el KPI final que ve un director."
  },
  {
    keywords: ["experiencia", "años", "background", "trayectoria"],
    answer: "Tengo 4+ años combinando Finance/Controlling con Business Intelligence, automatización y mejora de procesos — el mismo perfil que pide esta posición."
  },
  {
    keywords: ["ingles", "español", "idioma", "comunicacion", "bilingue"],
    answer: "Me comunico de forma fluida en español e inglés, tanto para reportes ejecutivos como para entrenar usuarios finales en herramientas digitales nuevas."
  },
  {
    keywords: ["riesgo", "tendencia", "insight", "variacion"],
    answer: "El motor de insights de esta página detecta automáticamente sobrecostos (>5% vs. presupuesto), quiebres de inventario y caídas de productividad — así priorizo qué reportar primero a la gerencia."
  },
  {
    keywords: ["roadmap", "priorizar", "transformacion", "digital finance"],
    answer: "Priorizo el roadmap de Digital Finance por valor de negocio: primero automatizaciones de alto esfuerzo manual, luego pipelines de datos confiables, y al final dashboards de autoservicio para que el negocio no dependa de mí para cada reporte."
  },
  {
    keywords: ["hola", "buenas", "quien eres", "que haces"],
    answer: "¡Hola! Soy el asistente de este portafolio. Pregúntame sobre SAP, Power BI, automatización, SQL, o mi experiencia en Finance & Controlling para la posición en Siemens Energy."
  }
];

const CHAT_FALLBACK = "Buena pregunta. Puedo hablar de SAP FI/CO, Power BI/Tableau, automatización con herramientas ETL, SQL y gobierno de datos, o mi experiencia en Finance. ¿Sobre cuál te gustaría profundizar?";
