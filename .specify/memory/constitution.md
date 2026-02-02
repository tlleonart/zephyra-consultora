<!--
================================================================================
SYNC IMPACT REPORT
================================================================================
Version Change: 0.0.0 → 1.0.0 (MAJOR - Initial constitution creation)

Modified Principles: N/A (Initial creation)

Added Sections:
- Core Principles (5 principles)
  - I. Calidad del Código
  - II. Estándares de Testing
  - III. Consistencia en UX
  - IV. Documentación Exhaustiva
  - V. Performance Óptima
- Estándares de Desarrollo (new section)
- Proceso de Calidad (new section)
- Governance

Removed Sections: N/A (Initial creation)

Templates Status:
- .specify/templates/plan-template.md: ✅ Compatible (Constitution Check section exists)
- .specify/templates/spec-template.md: ✅ Compatible (Requirements and Success Criteria align)
- .specify/templates/tasks-template.md: ✅ Compatible (Testing phases and polish tasks align)

Deferred Items: None
================================================================================
-->

# Zephyra Consultora Constitution

## Core Principles

### I. Calidad del Código

El código DEBE ser mantenible, legible y seguir estándares consistentes en todo el proyecto.

**Reglas No Negociables:**
- Todo código DEBE seguir las guías de estilo definidas para el lenguaje/framework del proyecto
- Los nombres de variables, funciones y clases DEBEN ser descriptivos y en el idioma acordado del proyecto
- Las funciones DEBEN tener una única responsabilidad (Single Responsibility Principle)
- El código duplicado DEBE ser refactorizado en abstracciones reutilizables
- Los code reviews son OBLIGATORIOS antes de cualquier merge a la rama principal
- PROHIBIDO el uso de "magic numbers" o strings hardcodeados; usar constantes nombradas
- El código DEBE compilar/ejecutar sin warnings ni errores de linting

**Rationale:** El código de calidad reduce la deuda técnica, facilita el onboarding de nuevos desarrolladores y minimiza bugs en producción.

### II. Estándares de Testing

Todo código funcional DEBE estar respaldado por tests automatizados que garanticen su correcto funcionamiento.

**Reglas No Negociables:**
- Cobertura mínima de tests: 80% para código crítico de negocio, 60% para código general
- Tests unitarios DEBEN existir para toda lógica de negocio
- Tests de integración DEBEN existir para flujos críticos de usuario
- Tests de contrato DEBEN existir para APIs públicas y comunicación entre servicios
- Los tests DEBEN ser determinísticos: sin dependencias de tiempo, orden o estado externo
- Todo bug reportado DEBE incluir un test de regresión antes de ser marcado como resuelto
- Los tests DEBEN ejecutarse en CI/CD y bloquear merges si fallan

**Rationale:** Los tests automatizados son la red de seguridad que permite refactorizar y evolucionar el sistema con confianza.

### III. Consistencia en UX

La experiencia de usuario DEBE ser coherente, predecible e intuitiva en todas las interfaces del sistema.

**Reglas No Negociables:**
- Un sistema de diseño (design system) DEBE definir componentes, colores, tipografía y espaciado
- Todos los componentes de UI DEBEN seguir el sistema de diseño establecido
- Los patrones de interacción DEBEN ser consistentes: misma acción = mismo comportamiento
- Los mensajes de error DEBEN ser claros, accionables y en el idioma del usuario
- La accesibilidad (WCAG 2.1 AA mínimo) DEBE ser considerada en todo componente visual
- Los estados de carga, vacío y error DEBEN estar diseñados para cada vista
- Los cambios de UX DEBEN ser validados con usuarios reales antes de implementación masiva

**Rationale:** La consistencia en UX reduce la fricción, aumenta la adopción y disminuye las solicitudes de soporte.

### IV. Documentación Exhaustiva

Toda funcionalidad, API y proceso DEBE estar documentado de forma clara, actualizada y accesible.

**Reglas No Negociables:**
- Cada feature DEBE incluir documentación de usuario antes de considerarse completa
- Las APIs DEBEN tener documentación OpenAPI/Swagger actualizada automáticamente
- El código complejo DEBE incluir comentarios explicando el "por qué", no el "qué"
- Un README actualizado DEBE existir en la raíz del proyecto con instrucciones de setup
- Los ADRs (Architecture Decision Records) DEBEN documentar decisiones técnicas importantes
- La documentación DEBE actualizarse en el mismo PR que modifica la funcionalidad
- Los runbooks DEBEN existir para procesos de operación y recuperación ante fallos

**Rationale:** La documentación es conocimiento institucional que sobrevive a la rotación de personal y acelera el desarrollo.

### V. Performance Óptima

El sistema DEBE responder dentro de umbrales definidos y usar recursos de forma eficiente.

**Reglas No Negociables:**
- Tiempos de respuesta DEBEN definirse por endpoint/operación (ej: API < 200ms p95, UI < 100ms TTI)
- Queries a base de datos DEBEN ser analizados; PROHIBIDOS N+1 queries y full table scans no justificados
- El consumo de memoria DEBE monitorearse; memory leaks DEBEN ser tratados como bugs críticos
- Assets estáticos DEBEN estar optimizados (imágenes comprimidas, JS/CSS minificado)
- Lazy loading DEBE aplicarse para recursos no críticos en la carga inicial
- Métricas de performance DEBEN ser capturadas en producción (APM, Core Web Vitals)
- Regresiones de performance DEBEN ser detectadas en CI mediante benchmarks automatizados

**Rationale:** La performance impacta directamente en la experiencia de usuario, los costos de infraestructura y la competitividad del producto.

## Estándares de Desarrollo

**Stack Tecnológico:**
- Las tecnologías DEBEN ser seleccionadas basándose en criterios objetivos documentados
- Las dependencias DEBEN mantenerse actualizadas con un proceso regular de actualización
- Las vulnerabilidades de seguridad en dependencias DEBEN ser parcheadas en máximo 7 días (críticas) o 30 días (otras)

**Control de Versiones:**
- Git flow o trunk-based development DEBE ser el modelo de branching adoptado
- Commits DEBEN ser atómicos y con mensajes descriptivos siguiendo Conventional Commits
- La rama principal DEBE estar siempre en estado deployable

**Seguridad:**
- Secrets NUNCA DEBEN estar en código; usar variables de entorno o secret managers
- Input validation DEBE aplicarse en todos los puntos de entrada del sistema
- OWASP Top 10 DEBE ser revisado en cada feature que maneje datos sensibles

## Proceso de Calidad

**Gates de Calidad:**
1. **Pre-commit:** Linting y formateo automático
2. **Pre-push:** Tests unitarios locales
3. **CI Pipeline:** Tests completos, análisis estático, security scanning
4. **Code Review:** Mínimo 1 aprobación requerida
5. **Pre-deploy:** Tests de integración y smoke tests
6. **Post-deploy:** Monitoreo de métricas y alertas

**Revisión de Código:**
- Reviewers DEBEN verificar adherencia a esta constitución
- Feedback DEBE ser constructivo y enfocado en mejora, no en crítica personal
- Cambios mayores DEBEN incluir documentación de impacto

**Deuda Técnica:**
- La deuda técnica DEBE ser rastreada con tickets etiquetados
- Un porcentaje del sprint (mínimo 10%) DEBE dedicarse a reducir deuda técnica
- Deuda técnica crítica DEBE ser priorizada sobre nuevas features

## Governance

**Supremacía de la Constitución:**
Esta constitución es el documento rector del proyecto. Todas las prácticas, estándares y decisiones técnicas DEBEN alinearse con estos principios.

**Proceso de Enmienda:**
1. Proponer cambio mediante PR al archivo de constitución
2. Documentar justificación y impacto en templates dependientes
3. Obtener aprobación de al menos 2 maintainers del proyecto
4. Actualizar templates afectados en el mismo PR
5. Comunicar cambios al equipo

**Versionamiento:**
- MAJOR: Cambios que eliminan o redefinen principios de forma incompatible
- MINOR: Nuevos principios o expansión material de guías existentes
- PATCH: Clarificaciones, correcciones de redacción, refinamientos menores

**Verificación de Cumplimiento:**
- Todo PR DEBE incluir verificación contra principios aplicables
- Auditorías trimestrales DEBEN revisar adherencia general del codebase
- Excepciones DEBEN ser documentadas y justificadas en el Complexity Tracking del plan

**Version**: 1.0.0 | **Ratified**: 2026-01-28 | **Last Amended**: 2026-01-28
