# Feature Specification: Zephyra Admin Dashboard

**Feature Branch**: `001-zephyra-admin-dashboard`
**Created**: 2026-01-28
**Status**: Draft
**Input**: User description: "Construí una aplicación web para Zephyra Consultora, una consultora social. La web tiene varias secciones que deben ser administradas desde un dashboard (creación, modificación y borrado)."

## Clarifications

### Session 2026-01-28

- Q: ¿Cómo se gestionan los usuarios administradores? → A: Super-admin - Un admin con rol elevado puede crear, editar y eliminar otros admins desde el dashboard.
- Q: ¿Qué tipo de editor se usa para el contenido del blog? → A: WYSIWYG avanzado - Editor visual completo con imágenes inline, tablas y embeds de video.
- Q: ¿Cómo es el flujo de publicación de artículos? → A: Borradores simples - Los artículos pueden guardarse como borrador o publicarse directamente.
- Q: ¿Cómo se maneja la eliminación de contenido? → A: Soft delete con papelera - El contenido eliminado va a una papelera por 30 días antes de eliminarse permanentemente.
- Q: ¿Cómo recuperan contraseña los administradores? → A: Reset por email - El admin recibe un enlace temporal por email para crear nueva contraseña.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Gestión de Artículos del Blog (Priority: P1)

Como administrador de Zephyra, necesito crear, editar y eliminar artículos del blog para mantener el contenido actualizado y compartir conocimiento sobre sostenibilidad con los visitantes del sitio.

**Why this priority**: El blog es el principal canal de thought leadership y genera tráfico orgánico. Mantener contenido fresco y relevante es crítico para el posicionamiento de la marca.

**Independent Test**: Puede probarse completamente creando un artículo, verificando que aparezca en el sitio público, editándolo y eliminándolo.

**Acceptance Scenarios**:

1. **Given** un administrador autenticado en el dashboard, **When** completa el formulario de nuevo artículo con título, extracto, contenido, imagen de portada y autor, **Then** el artículo se guarda y aparece en la sección de blog del sitio público.
2. **Given** un artículo existente, **When** el administrador modifica cualquier campo y guarda, **Then** los cambios se reflejan inmediatamente en el sitio público.
3. **Given** un artículo existente, **When** el administrador lo elimina y confirma la acción, **Then** el artículo desaparece del sitio público y del listado del dashboard.
4. **Given** un formulario de artículo incompleto, **When** el administrador intenta guardar sin campos obligatorios, **Then** el sistema muestra mensajes de error claros indicando qué campos faltan.

---

### User Story 2 - Gestión del Equipo (Priority: P1)

Como administrador, necesito agregar, editar y eliminar miembros del equipo para mantener actualizada la sección "Quiénes Somos" del sitio con el personal actual de la consultora.

**Why this priority**: El equipo es fundamental para la credibilidad de la consultora. Los clientes potenciales quieren conocer a las personas detrás de los servicios.

**Independent Test**: Puede probarse agregando un nuevo miembro del equipo, verificando que aparezca en el carrusel del sitio, editando su información y eliminándolo.

**Acceptance Scenarios**:

1. **Given** un administrador autenticado, **When** agrega un nuevo miembro con nombre, rol, especialidad e imagen, **Then** el miembro aparece en el carrusel de equipo del sitio público.
2. **Given** un miembro del equipo existente, **When** el administrador actualiza su rol o especialidad, **Then** los cambios se reflejan en el sitio público.
3. **Given** un miembro del equipo, **When** el administrador lo elimina, **Then** desaparece del carrusel pero los artículos de blog que escribió permanecen (mostrando "Autor anterior" o similar).
4. **Given** el formulario de miembro, **When** se sube una imagen, **Then** el sistema la optimiza automáticamente para web.

---

### User Story 3 - Gestión de Proyectos (Priority: P2)

Como administrador, necesito gestionar los proyectos destacados de la consultora para mostrar la experiencia y casos de éxito a clientes potenciales.

**Why this priority**: Los proyectos son evidencia concreta del trabajo de la consultora. Son importantes para la conversión de leads pero pueden actualizarse con menos frecuencia que el blog.

**Independent Test**: Puede probarse creando un proyecto con sus logros, verificando que aparezca en la sección de proyectos del sitio, y modificando sus detalles.

**Acceptance Scenarios**:

1. **Given** un administrador autenticado, **When** crea un proyecto con título, descripción, extracto, imagen y lista de logros, **Then** el proyecto aparece en la sección "¿Cuál es nuestra experiencia?" del sitio.
2. **Given** un proyecto existente, **When** el administrador agrega, edita o reordena logros, **Then** los cambios se reflejan en el acordeón del proyecto.
3. **Given** un proyecto, **When** el administrador genera o edita el slug, **Then** el proyecto es accesible en su URL única (/projects/[slug]).
4. **Given** múltiples proyectos, **When** el administrador reordena la lista, **Then** el orden se refleja en el sitio público.

---

### User Story 4 - Gestión de Servicios (Priority: P2)

Como administrador, necesito gestionar los servicios que ofrece la consultora para mantener actualizada la oferta de valor en el sitio.

**Why this priority**: Los servicios definen lo que hace la empresa. Aunque cambian con menos frecuencia, es importante poder actualizarlos sin depender de un desarrollador.

**Independent Test**: Puede probarse agregando un nuevo servicio, verificando que aparezca en el carrusel de servicios, editando su descripción y eliminándolo.

**Acceptance Scenarios**:

1. **Given** un administrador autenticado, **When** crea un servicio con título, descripción e icono, **Then** el servicio aparece en el carrusel "¿Qué hacemos?".
2. **Given** un servicio existente, **When** el administrador modifica su descripción, **Then** los cambios aparecen en el sitio público.
3. **Given** la lista de servicios, **When** el administrador reordena los servicios, **Then** el nuevo orden se refleja en el carrusel.
4. **Given** un servicio, **When** el administrador selecciona un icono de la biblioteca disponible, **Then** el icono se muestra junto al servicio.

---

### User Story 5 - Gestión de Clientes y Alianzas (Priority: P3)

Como administrador, necesito gestionar los logos de clientes y alianzas para mostrar la red de confianza de la consultora.

**Why this priority**: La prueba social es importante pero esta sección requiere cambios menos frecuentes y tiene menor impacto en conversiones directas.

**Independent Test**: Puede probarse agregando un logo de cliente, verificando que aparezca en la sección correspondiente, y eliminándolo.

**Acceptance Scenarios**:

1. **Given** un administrador autenticado, **When** agrega un cliente con nombre, logo y URL opcional, **Then** el logo aparece en la sección "Ya confían en nosotros".
2. **Given** un administrador autenticado, **When** agrega una alianza con nombre, logo y URL opcional, **Then** el logo aparece en la sección "Nuestras Alianzas".
3. **Given** un logo de cliente o alianza, **When** el administrador lo elimina, **Then** desaparece de la sección correspondiente.
4. **Given** las listas de clientes y alianzas, **When** el administrador reordena los elementos, **Then** el orden se refleja en el sitio.

---

### User Story 6 - Gestión de Suscriptores del Newsletter (Priority: P3)

Como administrador, necesito ver y gestionar la lista de suscriptores del newsletter para comunicaciones de marketing.

**Why this priority**: Es una funcionalidad de soporte para marketing, no crítica para el funcionamiento del sitio.

**Independent Test**: Puede probarse verificando que los suscriptores aparecen en la lista del dashboard después de suscribirse desde el sitio público.

**Acceptance Scenarios**:

1. **Given** un administrador autenticado, **When** accede a la sección de newsletter, **Then** ve la lista de suscriptores con email y fecha de suscripción.
2. **Given** la lista de suscriptores, **When** el administrador exporta la lista, **Then** descarga un archivo con los emails activos.
3. **Given** un suscriptor, **When** el administrador cambia su estado a inactivo, **Then** el email no se incluye en futuras exportaciones.
4. **Given** la lista de suscriptores, **When** el administrador busca por email, **Then** el sistema filtra los resultados coincidentes.

---

### User Story 7 - Autenticación de Administradores (Priority: P1)

Como administrador, necesito acceder al dashboard de forma segura con credenciales válidas para proteger la gestión del contenido.

**Why this priority**: Sin autenticación, cualquiera podría modificar el contenido del sitio. Es un requisito fundamental de seguridad.

**Independent Test**: Puede probarse intentando acceder al dashboard sin credenciales y verificando que se redirige al login.

**Acceptance Scenarios**:

1. **Given** un usuario no autenticado, **When** intenta acceder al dashboard, **Then** es redirigido a la página de inicio de sesión.
2. **Given** credenciales válidas, **When** el administrador inicia sesión, **Then** accede al dashboard y puede gestionar contenido.
3. **Given** credenciales inválidas, **When** un usuario intenta iniciar sesión, **Then** ve un mensaje de error sin revelar qué campo está incorrecto.
4. **Given** una sesión activa sin actividad, **When** pasan 30 minutos, **Then** la sesión expira y el usuario debe volver a autenticarse.
5. **Given** un administrador autenticado, **When** cierra sesión, **Then** no puede acceder al dashboard hasta volver a autenticarse.

---

### Edge Cases

- ¿Qué sucede si se elimina un autor que tiene artículos de blog asociados? El sistema DEBE impedir la eliminación o reasignar los artículos.
- ¿Qué sucede si se sube una imagen con formato no soportado? El sistema DEBE rechazarla con mensaje claro.
- ¿Qué sucede si dos administradores editan el mismo contenido simultáneamente? El sistema DEBE mostrar un aviso de conflicto.
- ¿Qué sucede si se pierde la conexión mientras se guarda un cambio? El sistema DEBE notificar el error y permitir reintentar.
- ¿Qué sucede si un slug de proyecto ya existe? El sistema DEBE rechazar el duplicado y sugerir alternativas.
- ¿Qué sucede si el tamaño de imagen excede el límite? El sistema DEBE informar el límite y rechazar la imagen.

## Requirements *(mandatory)*

### Functional Requirements

**Autenticación y Acceso**
- **FR-001**: El sistema DEBE requerir autenticación para acceder a cualquier funcionalidad del dashboard.
- **FR-002**: El sistema DEBE soportar inicio de sesión con email y contraseña.
- **FR-003**: El sistema DEBE cerrar sesiones inactivas después de 30 minutos.
- **FR-004**: El sistema DEBE permitir a los administradores cerrar sesión manualmente.

**Gestión de Usuarios Admin**
- **FR-004a**: El sistema DEBE soportar dos roles de admin: super-admin y admin regular.
- **FR-004b**: El super-admin DEBE poder crear nuevos usuarios admin desde el dashboard.
- **FR-004c**: El super-admin DEBE poder editar y eliminar usuarios admin existentes (excepto a sí mismo).
- **FR-004d**: Los admin regulares NO DEBEN tener acceso a la gestión de usuarios.
- **FR-004e**: El sistema DEBE permitir solicitar reset de contraseña desde la pantalla de login.
- **FR-004f**: El sistema DEBE enviar un enlace de reset por email válido por 1 hora.
- **FR-004g**: El enlace de reset DEBE permitir crear una nueva contraseña una sola vez.

**Gestión de Blog**
- **FR-005**: El sistema DEBE permitir crear artículos de blog con título, extracto, contenido, imagen de portada y autor.
- **FR-005a**: El editor de contenido DEBE ser WYSIWYG avanzado con soporte para: formato de texto (negrita, cursiva, encabezados), listas, enlaces, imágenes inline, tablas y embeds de video.
- **FR-006**: El sistema DEBE permitir editar todos los campos de un artículo existente.
- **FR-007**: El sistema DEBE permitir eliminar artículos con confirmación previa.
- **FR-008**: El sistema DEBE generar automáticamente slugs únicos a partir del título.
- **FR-009**: El sistema DEBE mostrar fecha de creación y última modificación de cada artículo.
- **FR-009a**: El sistema DEBE permitir guardar artículos como borrador (no visibles en sitio público).
- **FR-009b**: El sistema DEBE permitir publicar borradores y despublicar artículos publicados.
- **FR-009c**: El dashboard DEBE mostrar claramente el estado (borrador/publicado) de cada artículo.

**Gestión de Equipo**
- **FR-010**: El sistema DEBE permitir crear miembros del equipo con nombre, rol, especialidad e imagen.
- **FR-011**: El sistema DEBE permitir editar todos los campos de un miembro existente.
- **FR-012**: El sistema DEBE impedir eliminar miembros que son autores de artículos de blog, o DEBE reasignar automáticamente.
- **FR-013**: El sistema DEBE mostrar el listado de miembros con paginación.

**Gestión de Proyectos**
- **FR-014**: El sistema DEBE permitir crear proyectos con título, descripción, extracto, imagen y logros.
- **FR-015**: El sistema DEBE permitir agregar, editar, eliminar y reordenar logros dentro de un proyecto.
- **FR-016**: El sistema DEBE permitir editar el slug de un proyecto validando unicidad.
- **FR-017**: El sistema DEBE permitir reordenar la lista de proyectos.

**Gestión de Servicios**
- **FR-018**: El sistema DEBE permitir crear servicios con título, descripción e icono.
- **FR-019**: El sistema DEBE ofrecer una biblioteca de iconos predefinidos para seleccionar.
- **FR-020**: El sistema DEBE permitir reordenar la lista de servicios.

**Gestión de Clientes y Alianzas**
- **FR-021**: El sistema DEBE permitir crear entradas de clientes con nombre, logo y URL opcional.
- **FR-022**: El sistema DEBE permitir crear entradas de alianzas con nombre, logo y URL opcional.
- **FR-023**: El sistema DEBE permitir eliminar clientes y alianzas.
- **FR-024**: El sistema DEBE diferenciar claramente entre clientes y alianzas en la interfaz.

**Gestión de Newsletter**
- **FR-025**: El sistema DEBE mostrar la lista de suscriptores con email, fecha y estado.
- **FR-026**: El sistema DEBE permitir cambiar el estado activo/inactivo de suscriptores.
- **FR-027**: El sistema DEBE permitir exportar la lista de suscriptores activos.
- **FR-028**: El sistema DEBE permitir buscar suscriptores por email.

**Gestión de Imágenes**
- **FR-029**: El sistema DEBE permitir subir imágenes en formatos JPG, PNG y WebP.
- **FR-030**: El sistema DEBE optimizar automáticamente las imágenes subidas para web.
- **FR-031**: El sistema DEBE rechazar imágenes que excedan 5MB con mensaje claro.
- **FR-032**: El sistema DEBE mostrar vista previa de imágenes antes de guardar.

**Validación y Feedback**
- **FR-033**: El sistema DEBE validar todos los campos obligatorios antes de guardar.
- **FR-034**: El sistema DEBE mostrar mensajes de error claros y específicos.
- **FR-035**: El sistema DEBE mostrar confirmación visual cuando una operación se completa exitosamente.
- **FR-036**: El sistema DEBE solicitar confirmación antes de eliminar cualquier contenido.

**Papelera y Recuperación**
- **FR-037**: El sistema DEBE implementar soft delete para todo contenido (blog, proyectos, servicios, clientes, alianzas).
- **FR-038**: El contenido eliminado DEBE moverse a una papelera accesible desde el dashboard.
- **FR-039**: El sistema DEBE permitir restaurar contenido desde la papelera.
- **FR-040**: El contenido en papelera DEBE eliminarse permanentemente después de 30 días.
- **FR-041**: El sistema DEBE mostrar la fecha de eliminación permanente para cada item en papelera.

### Key Entities

- **Usuario Admin**: Representa a un administrador del sistema. Atributos: email, contraseña (hash), nombre, rol (super-admin | admin), fecha de creación, último acceso. El super-admin puede gestionar otros usuarios admin.

- **Miembro del Equipo (Employee)**: Persona que trabaja en la consultora. Atributos: nombre, rol (ej: "Cofundadora", "Consultora"), especialidad, imagen. Relación: puede ser autor de múltiples artículos de blog.

- **Artículo de Blog (Blog)**: Publicación del blog de la consultora. Atributos: título, extracto, contenido completo (HTML del editor WYSIWYG), imagen de portada, slug, estado (borrador | publicado), fecha de creación, fecha de actualización, fecha de publicación. Relación: pertenece a un autor (Miembro del Equipo).

- **Proyecto (Project)**: Caso de éxito o proyecto destacado. Atributos: título, descripción, extracto, imagen, slug, fecha de creación. Relación: contiene múltiples logros.

- **Logro de Proyecto**: Resultado específico dentro de un proyecto. Atributos: descripción, orden. Relación: pertenece a un proyecto.

- **Servicio**: Oferta de servicio de la consultora. Atributos: título, descripción, icono, orden.

- **Cliente**: Empresa que ha trabajado con la consultora. Atributos: nombre, logo, URL externa (opcional), orden.

- **Alianza**: Organización aliada de la consultora. Atributos: nombre, logo, URL externa (opcional), orden.

- **Suscriptor Newsletter**: Persona suscrita al newsletter. Atributos: email, fecha de suscripción, estado (activo/inactivo).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un administrador puede crear un nuevo artículo de blog completo en menos de 5 minutos.
- **SC-002**: Un administrador puede agregar un nuevo miembro del equipo en menos de 2 minutos.
- **SC-003**: Los cambios realizados en el dashboard se reflejan en el sitio público en menos de 10 segundos.
- **SC-004**: El 95% de las operaciones de guardado se completan exitosamente sin errores.
- **SC-005**: Un administrador nuevo puede completar su primera tarea de gestión de contenido sin asistencia (interfaz intuitiva).
- **SC-006**: El sistema soporta al menos 3 administradores trabajando simultáneamente sin conflictos.
- **SC-007**: Las imágenes subidas se optimizan manteniendo calidad visual aceptable y reduciendo tamaño al menos 50%.
- **SC-008**: El tiempo de carga inicial del dashboard es menor a 3 segundos.
- **SC-009**: Todas las secciones del sitio público (blog, equipo, proyectos, servicios, clientes, alianzas) pueden ser gestionadas completamente desde el dashboard.
- **SC-010**: La tasa de errores en formularios por campos obligatorios faltantes se reduce a menos del 5% gracias a validación en tiempo real.

## Assumptions

- El proyecto legacy Next.js 14 será la base para construir el dashboard (reutilizando modelos Prisma existentes).
- Los administradores tendrán conocimientos básicos de edición de contenido web (similar a WordPress o similar).
- Habrá un máximo de 5 administradores concurrentes en el sistema.
- Las imágenes se almacenarán en el servidor o servicio de almacenamiento existente del proyecto.
- El diseño del dashboard seguirá los patrones del diseño UX/UI existente cuando sea posible.
- Los iconos de servicios se seleccionarán de una biblioteca existente (Material Icons o similar del proyecto legacy).
- El contenido del sitio está en español únicamente (no se requiere internacionalización).
