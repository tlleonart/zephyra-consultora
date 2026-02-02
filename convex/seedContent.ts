import { mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// ============================================
// CONTENT DATA - Extracted from Legacy Project
// ============================================

const TEAM_MEMBERS = [
  {
    name: "Martina Fay",
    role: "Cofundadora",
    specialty: "Economista / Magister en Administración Pública (MPA)",
  },
  {
    name: "Natalia Bertinelli",
    role: "Cofundadora",
    specialty: "Lic. Administración de Empresas / Analista Ambiental",
  },
  {
    name: "Camila Limansky",
    role: "Consultora",
    specialty: "Lic. en Gestión Ambiental",
  },
  {
    name: "Juana Solotar",
    role: "Consultora",
    specialty: "Lic. en Ciencias Ambientales",
  },
  {
    name: "Estefanía Grisanti",
    role: "Consultora",
    specialty: "Contadora Pública",
  },
  {
    name: "Magdalena Blaha",
    role: "Asistente",
    specialty: "Estudiante de Gestión Ambiental",
  },
];

const SERVICES = [
  {
    title: "Diseño de proyectos con impacto socioambiental",
    description:
      "Acompañamos el diseño de proyectos con triple impacto: ambiental, social y de gobernanza. Trabajamos junto a organizaciones para crear iniciativas que generen valor sostenible y medible.",
    iconName: "eco",
  },
  {
    title: "Certificación B Corp",
    description:
      "Guiamos a empresas en el proceso de certificación B Corp, desde la evaluación inicial hasta la obtención del sello. Ayudamos a demostrar el compromiso con los más altos estándares de desempeño social y ambiental.",
    iconName: "verified",
  },
  {
    title: "Medición de huella de carbono",
    description:
      "Calculamos y analizamos la huella de carbono de tu organización, identificando oportunidades de reducción y estrategias de compensación para alcanzar la neutralidad climática.",
    iconName: "cloud",
  },
  {
    title: "Informes de sustentabilidad",
    description:
      "Elaboramos reportes de sustentabilidad bajo estándares internacionales (GRI, SASB, CDP). Comunicamos de manera transparente el desempeño ESG de tu organización.",
    iconName: "description",
  },
  {
    title: "Capacitaciones en sustentabilidad",
    description:
      "Diseñamos y facilitamos programas de formación a medida sobre temáticas de sustentabilidad, cambio climático, economía circular y gestión ambiental para equipos de trabajo.",
    iconName: "school",
  },
  {
    title: "Planes de igualdad de género",
    description:
      "Desarrollamos diagnósticos y planes de acción para promover la igualdad de género en organizaciones, cumpliendo con normativas y mejores prácticas internacionales.",
    iconName: "diversity_3",
  },
  {
    title: "Comunicación sustentable",
    description:
      "Asesoramos en estrategias de comunicación que reflejen auténticamente los valores y acciones de sustentabilidad, evitando el greenwashing y construyendo confianza.",
    iconName: "campaign",
  },
  {
    title: "Sistemas de gestión ISO",
    description:
      "Implementamos y auditamos sistemas de gestión ambiental (ISO 14001), de calidad (ISO 9001) y de energía (ISO 50001), optimizando procesos y asegurando cumplimiento.",
    iconName: "settings_suggest",
  },
];

const PROJECTS = [
  {
    title: "Programa de Sustentabilidad Corporativa - Empresa Industrial",
    slug: "programa-sustentabilidad-corporativa",
    excerpt:
      "Implementación integral de estrategia de sustentabilidad para empresa industrial líder en el sector manufacturero.",
    description: `
      <p>Desarrollamos e implementamos un programa completo de sustentabilidad corporativa para una empresa industrial líder, abarcando todas las dimensiones ESG (Ambiental, Social y Gobernanza).</p>
      <p>El proyecto incluyó un diagnóstico inicial exhaustivo, definición de KPIs, establecimiento de metas a corto, mediano y largo plazo, y la creación de un sistema de monitoreo y reporte continuo.</p>
      <p>Los resultados obtenidos posicionaron a la empresa como referente en sustentabilidad dentro de su industria.</p>
    `,
    isFeatured: true,
    achievements: [
      "Reducción del 35% en emisiones de CO2 en el primer año",
      "Certificación ISO 14001 obtenida en tiempo récord",
      "Implementación de programa de economía circular",
      "Capacitación a más de 500 colaboradores",
    ],
  },
  {
    title: "Certificación B Corp - Empresa de Servicios",
    slug: "certificacion-b-corp-servicios",
    excerpt:
      "Acompañamiento completo en el proceso de certificación B Corp para empresa de servicios profesionales.",
    description: `
      <p>Guiamos a una empresa de servicios profesionales en todo el proceso de certificación B Corp, desde la evaluación inicial hasta la obtención exitosa del sello.</p>
      <p>El proceso incluyó mejoras en políticas internas, prácticas de gobernanza, impacto comunitario y gestión ambiental, elevando significativamente los estándares de la organización.</p>
    `,
    isFeatured: true,
    achievements: [
      "Puntuación B Impact Assessment: 89.5 puntos",
      "Mejora en políticas de diversidad e inclusión",
      "Implementación de programa de voluntariado corporativo",
      "Reducción de huella hídrica en un 25%",
    ],
  },
  {
    title: "Medición y Compensación de Huella de Carbono - Evento Corporativo",
    slug: "huella-carbono-evento-corporativo",
    excerpt:
      "Cálculo de huella de carbono y estrategia de compensación para evento corporativo de gran escala.",
    description: `
      <p>Realizamos la medición completa de la huella de carbono de un evento corporativo internacional con más de 2,000 asistentes, considerando todas las fuentes de emisión directas e indirectas.</p>
      <p>Desarrollamos una estrategia de compensación mediante proyectos certificados y recomendaciones para la reducción de emisiones en futuras ediciones.</p>
    `,
    isFeatured: true,
    achievements: [
      "Medición de 450 toneladas de CO2 equivalente",
      "Compensación a través de proyecto de reforestación nativa",
      "Reducción del 40% en materiales de un solo uso",
    ],
  },
];

const CLIENTS = [
  { name: "Limansky", websiteUrl: null },
  { name: "Cibic", websiteUrl: null },
  { name: "Mercado de Gafas", websiteUrl: null },
  { name: "LABIN", websiteUrl: null },
];

const ALLIANCES = [
  { name: "Colectar", websiteUrl: null },
  { name: "Fundación Rosario", websiteUrl: null },
  { name: "Crowe", websiteUrl: null },
];

const BLOG_POSTS = [
  {
    title: "¿Qué es ser una Empresa B?",
    slug: "que-es-ser-una-empresa-b",
    excerpt:
      "Las Empresas B son organizaciones que cumplen con los más altos estándares de desempeño social y ambiental, transparencia y responsabilidad legal.",
    content: `
      <h2>Introducción a las Empresas B</h2>
      <p>Las Empresas B (B Corps) representan un nuevo modelo de hacer negocios que equilibra el propósito con las ganancias. Son empresas que han sido verificadas por cumplir con rigurosos estándares de desempeño social y ambiental, transparencia pública y responsabilidad legal.</p>

      <h2>¿Qué significa la certificación B Corp?</h2>
      <p>La certificación B Corp es otorgada por B Lab, una organización sin fines de lucro que evalúa a las empresas en cinco áreas de impacto:</p>
      <ul>
        <li><strong>Gobernanza:</strong> Misión, ética y transparencia</li>
        <li><strong>Trabajadores:</strong> Compensación, beneficios, capacitación y propiedad</li>
        <li><strong>Comunidad:</strong> Diversidad, impacto económico, compromiso cívico y proveedores</li>
        <li><strong>Medio Ambiente:</strong> Gestión ambiental, aire y clima, agua, tierra y biodiversidad</li>
        <li><strong>Clientes:</strong> Administración de clientes</li>
      </ul>

      <h2>Beneficios de ser una Empresa B</h2>
      <p>Las empresas que obtienen la certificación B Corp disfrutan de múltiples beneficios:</p>
      <ul>
        <li>Diferenciación en el mercado y fortalecimiento de marca</li>
        <li>Atracción y retención de talento comprometido</li>
        <li>Acceso a una comunidad global de empresas con propósito</li>
        <li>Mejora continua a través de la Evaluación de Impacto B</li>
        <li>Credibilidad y confianza ante consumidores e inversores</li>
      </ul>

      <h2>El movimiento B en Argentina y Latinoamérica</h2>
      <p>Argentina es uno de los países con mayor crecimiento del movimiento B en la región. Sistema B Argentina trabaja activamente para expandir esta comunidad y generar un ecosistema favorable para los negocios de triple impacto.</p>

      <p>En Zephyra, acompañamos a organizaciones en todo el proceso de certificación B Corp, desde la evaluación inicial hasta la obtención del sello y más allá.</p>
    `,
    status: "published" as const,
  },
  {
    title: "Desarrollo Sostenible: Los 17 ODS de la ONU",
    slug: "desarrollo-sostenible-17-ods",
    excerpt:
      "Los Objetivos de Desarrollo Sostenible son un llamado universal a la acción para poner fin a la pobreza, proteger el planeta y garantizar que todas las personas gocen de paz y prosperidad.",
    content: `
      <h2>¿Qué son los Objetivos de Desarrollo Sostenible?</h2>
      <p>Los Objetivos de Desarrollo Sostenible (ODS), también conocidos como Objetivos Globales, fueron adoptados por las Naciones Unidas en 2015 como un llamado universal a la acción para poner fin a la pobreza, proteger el planeta y garantizar que para el 2030 todas las personas disfruten de paz y prosperidad.</p>

      <h2>Los 17 Objetivos</h2>
      <p>Los ODS abarcan las tres dimensiones del desarrollo sostenible: económica, social y ambiental:</p>
      <ol>
        <li>Fin de la pobreza</li>
        <li>Hambre cero</li>
        <li>Salud y bienestar</li>
        <li>Educación de calidad</li>
        <li>Igualdad de género</li>
        <li>Agua limpia y saneamiento</li>
        <li>Energía asequible y no contaminante</li>
        <li>Trabajo decente y crecimiento económico</li>
        <li>Industria, innovación e infraestructura</li>
        <li>Reducción de las desigualdades</li>
        <li>Ciudades y comunidades sostenibles</li>
        <li>Producción y consumo responsables</li>
        <li>Acción por el clima</li>
        <li>Vida submarina</li>
        <li>Vida de ecosistemas terrestres</li>
        <li>Paz, justicia e instituciones sólidas</li>
        <li>Alianzas para lograr los objetivos</li>
      </ol>

      <h2>¿Por qué son importantes para las empresas?</h2>
      <p>Los ODS ofrecen un marco global compartido que permite a las empresas:</p>
      <ul>
        <li>Identificar oportunidades de negocio en mercados sostenibles</li>
        <li>Comunicar su impacto de manera estandarizada</li>
        <li>Alinear su estrategia con las prioridades globales</li>
        <li>Construir relaciones más sólidas con stakeholders</li>
      </ul>

      <h2>Cómo integrar los ODS en tu organización</h2>
      <p>En Zephyra ayudamos a las organizaciones a mapear su contribución a los ODS, identificar áreas de mejora y desarrollar estrategias que maximicen su impacto positivo en la agenda 2030.</p>
    `,
    status: "published" as const,
  },
  {
    title: "Huella de Carbono: Guía completa para empresas",
    slug: "huella-carbono-guia-empresas",
    excerpt:
      "Todo lo que necesitas saber sobre la medición, reducción y compensación de la huella de carbono de tu organización.",
    content: `
      <h2>¿Qué es la huella de carbono?</h2>
      <p>La huella de carbono es la totalidad de gases de efecto invernadero (GEI) emitidos directa o indirectamente por un individuo, organización, evento o producto. Se expresa en toneladas de CO2 equivalente (tCO2e).</p>

      <h2>Los tres alcances de emisiones</h2>
      <p>El Protocolo de Gases de Efecto Invernadero (GHG Protocol) clasifica las emisiones en tres alcances:</p>
      <ul>
        <li><strong>Alcance 1:</strong> Emisiones directas de fuentes propias o controladas (combustión de combustibles, vehículos propios, emisiones fugitivas)</li>
        <li><strong>Alcance 2:</strong> Emisiones indirectas por energía comprada (electricidad, calor, vapor)</li>
        <li><strong>Alcance 3:</strong> Otras emisiones indirectas en la cadena de valor (viajes de negocios, transporte de materiales, uso de productos vendidos, etc.)</li>
      </ul>

      <h2>¿Por qué medir la huella de carbono?</h2>
      <p>Medir la huella de carbono permite a las organizaciones:</p>
      <ul>
        <li>Identificar las principales fuentes de emisiones</li>
        <li>Establecer una línea base para definir metas de reducción</li>
        <li>Cumplir con requisitos regulatorios y de reporte</li>
        <li>Responder a demandas de clientes e inversores</li>
        <li>Identificar oportunidades de eficiencia y ahorro</li>
      </ul>

      <h2>Estrategias de reducción</h2>
      <p>Las principales estrategias para reducir la huella de carbono incluyen:</p>
      <ul>
        <li>Eficiencia energética en instalaciones y procesos</li>
        <li>Transición a energías renovables</li>
        <li>Electrificación de flotas vehiculares</li>
        <li>Optimización de la cadena de suministro</li>
        <li>Economía circular y reducción de residuos</li>
      </ul>

      <h2>Compensación de emisiones</h2>
      <p>Para las emisiones que no pueden reducirse, existen mecanismos de compensación a través de créditos de carbono certificados. Es importante elegir proyectos con verificación independiente y adicionalidad comprobada.</p>

      <p>En Zephyra te acompañamos en todo el proceso: medición, estrategia de reducción y compensación de tu huella de carbono.</p>
    `,
    status: "published" as const,
  },
];

// ============================================
// SEED MUTATION
// ============================================

export const seedAll = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if already seeded
    const existingTeam = await ctx.db.query("teamMembers").first();
    if (existingTeam) {
      throw new Error(
        "La base de datos ya contiene datos. Elimina los datos existentes antes de ejecutar el seed."
      );
    }

    const now = Date.now();
    const results = {
      teamMembers: 0,
      services: 0,
      projects: 0,
      achievements: 0,
      clients: 0,
      alliances: 0,
      blogPosts: 0,
    };

    // 1. Seed Team Members
    const teamMemberIds: Id<"teamMembers">[] = [];
    for (let i = 0; i < TEAM_MEMBERS.length; i++) {
      const member = TEAM_MEMBERS[i];
      const id = await ctx.db.insert("teamMembers", {
        name: member.name,
        role: member.role,
        specialty: member.specialty,
        displayOrder: i,
        isVisible: true,
      });
      teamMemberIds.push(id);
      results.teamMembers++;
    }

    // 2. Seed Services
    for (let i = 0; i < SERVICES.length; i++) {
      const service = SERVICES[i];
      await ctx.db.insert("services", {
        title: service.title,
        description: service.description,
        iconName: service.iconName,
        displayOrder: i,
        isActive: true,
      });
      results.services++;
    }

    // 3. Seed Projects with Achievements
    for (let i = 0; i < PROJECTS.length; i++) {
      const project = PROJECTS[i];
      const projectId = await ctx.db.insert("projects", {
        title: project.title,
        slug: project.slug,
        excerpt: project.excerpt,
        description: project.description,
        displayOrder: i,
        isFeatured: project.isFeatured,
        createdAt: now,
        updatedAt: now,
      });
      results.projects++;

      // Add achievements for this project
      for (let j = 0; j < project.achievements.length; j++) {
        await ctx.db.insert("projectAchievements", {
          projectId,
          description: project.achievements[j],
          displayOrder: j,
        });
        results.achievements++;
      }
    }

    // 4. Seed Clients
    for (let i = 0; i < CLIENTS.length; i++) {
      const client = CLIENTS[i];
      await ctx.db.insert("clients", {
        name: client.name,
        websiteUrl: client.websiteUrl ?? undefined,
        displayOrder: i,
      });
      results.clients++;
    }

    // 5. Seed Alliances
    for (let i = 0; i < ALLIANCES.length; i++) {
      const alliance = ALLIANCES[i];
      await ctx.db.insert("alliances", {
        name: alliance.name,
        websiteUrl: alliance.websiteUrl ?? undefined,
        displayOrder: i,
      });
      results.alliances++;
    }

    // 6. Seed Blog Posts (using first team member as author)
    const authorId = teamMemberIds[0]; // Martina Fay as default author
    for (const post of BLOG_POSTS) {
      await ctx.db.insert("blogPosts", {
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        content: post.content,
        authorId,
        status: post.status,
        publishedAt: post.status === "published" ? now : undefined,
        createdAt: now,
        updatedAt: now,
      });
      results.blogPosts++;
    }

    return {
      success: true,
      message: "Contenido inicial cargado exitosamente",
      counts: results,
    };
  },
});

// Optional: Clear all content (for development)
export const clearAll = mutation({
  args: {
    confirmPhrase: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.confirmPhrase !== "ELIMINAR TODO EL CONTENIDO") {
      throw new Error(
        "Frase de confirmación incorrecta. Escribe 'ELIMINAR TODO EL CONTENIDO' para continuar."
      );
    }

    // Delete in order to respect foreign keys
    const blogPosts = await ctx.db.query("blogPosts").collect();
    for (const post of blogPosts) {
      await ctx.db.delete(post._id);
    }

    const achievements = await ctx.db.query("projectAchievements").collect();
    for (const achievement of achievements) {
      await ctx.db.delete(achievement._id);
    }

    const projects = await ctx.db.query("projects").collect();
    for (const project of projects) {
      await ctx.db.delete(project._id);
    }

    const services = await ctx.db.query("services").collect();
    for (const service of services) {
      await ctx.db.delete(service._id);
    }

    const clients = await ctx.db.query("clients").collect();
    for (const client of clients) {
      await ctx.db.delete(client._id);
    }

    const alliances = await ctx.db.query("alliances").collect();
    for (const alliance of alliances) {
      await ctx.db.delete(alliance._id);
    }

    const teamMembers = await ctx.db.query("teamMembers").collect();
    for (const member of teamMembers) {
      await ctx.db.delete(member._id);
    }

    return {
      success: true,
      message: "Todo el contenido ha sido eliminado",
    };
  },
});
