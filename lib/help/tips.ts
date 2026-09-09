/**
 * Catálogo de consejos — ÚNICA fuente de verdad.
 *
 * De aquí beben las dos caras del sistema: el consejo que asoma en la
 * interfaz (`<Tip>`, `<HelpHint>`) y la página `/ayuda`. Si el texto viviera
 * en los dos sitios, en tres meses dirían cosas distintas.
 *
 * Para añadir un consejo: una entrada aquí y ya sale en Ayuda, agrupado por
 * su sección y filtrado por su audiencia. Nada más que tocar.
 */

/** Agrupación temática. El orden de este objeto es el orden en /ayuda. */
export type HelpSection = 'buscar' | 'reparto' | 'entregas' | 'taller' | 'cuenta';

/** A quién le sirve el consejo. 'todos' incluye a los dos roles. */
export type HelpAudience = 'todos' | 'ADMIN' | 'DESIGNER';

export interface HelpSectionMeta {
  id: HelpSection;
  /** Rótulo eyebrow de la sección. */
  label: string;
  /** Frase de apoyo bajo el rótulo, como en Ajustes. */
  hint: string;
}

/**
 * Secciones en orden de lectura: primero lo que más se pregunta.
 * El array manda: `groupTipsBySection` lo recorre tal cual.
 */
export const HELP_SECTIONS: readonly HelpSectionMeta[] = [
  {
    id: 'buscar',
    label: 'Encontrar trabajo',
    hint: 'Por qué a veces no aparece lo que buscas',
  },
  {
    id: 'reparto',
    label: 'Reparto y carga',
    hint: 'Cómo decide la app a quién le toca cada pieza',
  },
  {
    id: 'entregas',
    label: 'Entregas y plazos',
    hint: 'Marcar, deshacer y leer los avisos de urgencia',
  },
  {
    id: 'taller',
    label: 'Crear diseños',
    hint: 'El taller de tarjetas y el asistente',
  },
  {
    id: 'cuenta',
    label: 'Tu cuenta y este dispositivo',
    hint: 'Qué viaja contigo y qué se queda en el aparato',
  },
] as const;

export interface HelpTip {
  /**
   * Ancla estable: es el `#id` de /ayuda y la clave con la que se recuerda
   * que ya lo descartaste. Renombrarlo rompe los enlaces guardados y hace
   * reaparecer un aviso ya visto — trátalo como una URL pública.
   */
  id: string;
  /** Afirmación corta. Debe entenderse suelta, sin leer el cuerpo. */
  title: string;
  /**
   * UNA frase, dos como mucho. Si necesita más, o el consejo sobra o hay dos
   * consejos metidos en uno. El cuadro se lee de un vistazo o no se lee.
   */
  body: string;
  section: HelpSection;
  audience: HelpAudience;
  /**
   * Términos por los que alguien buscaría esto y que no están en el texto.
   * No repitas palabras del título ni del cuerpo: ya se buscan solas.
   */
  keywords?: readonly string[];
}

/**
 * Los consejos.
 *
 * Criterio de admisión, para que esto no se llene de relleno: entra si
 * explica algo que la interfaz no puede decir por sí sola y que, sin
 * saberlo, lleva a una conclusión equivocada. «Pulsa el botón para abrir el
 * diálogo» no entra. «El buscador no mira fuera de la semana elegida» sí,
 * porque quien no lo sabe concluye que el diseño no existe.
 */
export const HELP_TIPS: readonly HelpTip[] = [
  // ─── Encontrar trabajo ──────────────────────────────────────
  {
    id: 'rango-de-fechas',
    title: 'Si falta un diseño, mira las fechas antes que nada',
    body: 'Inicio y Diseños solo enseñan la semana en curso. Si entrega más adelante, está asignado pero no se ve: amplía «Desde» y «Hasta».',
    section: 'buscar',
    audience: 'todos',
    keywords: ['desaparecido', 'no aparece', 'perdido', 'filtro', 'semana'],
  },
  {
    id: 'buscador-alcance',
    title: 'El buscador solo mira lo que ya está en pantalla',
    body: 'Busca dentro de la semana elegida, no en toda la base. Si no sale nada, amplía el rango antes de darlo por perdido.',
    section: 'buscar',
    audience: 'todos',
    keywords: ['buscar', 'búsqueda', 'no encuentro', 'resultados'],
  },
  {
    id: 'punto-semanas-futuras',
    title: 'El punto que late junto a la semana',
    body: 'Hay trabajo asignado en semanas posteriores a la que estás viendo. Solo avisa: no lleva a ninguna parte.',
    section: 'buscar',
    audience: 'todos',
    keywords: ['punto', 'dorado', 'parpadea', 'futuro', 'próxima semana'],
  },
  {
    id: 'abrir-desde-aviso',
    title: 'El aviso de asignación abre la ficha aunque esté fuera de la semana',
    body: 'Pulsar «Te han asignado…» abre la ficha directamente, saltándose el filtro de fechas.',
    section: 'buscar',
    audience: 'todos',
    keywords: ['notificación', 'campana', 'aviso', 'enlace'],
  },

  // ─── Reparto y carga ────────────────────────────────────────
  {
    id: 'peso-por-tipo',
    title: 'El reparto cuenta peso, no número de diseños',
    body: 'Rápida 1, media 2, pesada 4. Un MD animado pesa como cuatro matchdays.',
    section: 'reparto',
    audience: 'todos',
    keywords: ['peso', 'rápida', 'media', 'pesada', 'esfuerzo', 'equilibrio'],
  },
  {
    id: 'tipo-decide-quien',
    title: 'Elegir el tipo de pieza no es solo etiquetar',
    body: 'Del tipo sale el peso, y del peso a quién le toca. Ponerlo mal descuadra el reparto de la semana.',
    section: 'reparto',
    audience: 'todos',
    keywords: ['tipo', 'matchday', 'categoría'],
  },
  {
    id: 'semana-de-entrega',
    title: 'Se reparte dentro de la semana de entrega, no de la actual',
    body: 'La carga se mide en la semana de entrega, no en la actual. Cambiar la fecha puede rehacer el reparto.',
    section: 'reparto',
    audience: 'ADMIN',
    keywords: ['fecha', 'mover', 'cambiar fecha', 'reasignar'],
  },
  {
    id: 'carga-capacidad',
    title: 'El «4 / 8» bajo cada nombre es peso pendiente frente a capacidad',
    body: 'Solo suma lo pendiente. Pasado el 100 % sale «Sobrecarga», que avisa pero no impide asignar más.',
    section: 'reparto',
    audience: 'ADMIN',
    keywords: ['capacidad', 'sobrecarga', 'carga', 'ocupación'],
  },
  {
    id: 'reparto-empate',
    title: 'En empate no le toca siempre al mismo',
    body: 'Con dos diseñadores igual de cargados, el turno rota en vez de pegarse al primero de la lista.',
    section: 'reparto',
    audience: 'ADMIN',
    keywords: ['automático', 'repartir', 'turno', 'rotación'],
  },

  // ─── Entregas y plazos ──────────────────────────────────────
  {
    id: 'entregar-reversible',
    title: 'Entregar se puede deshacer',
    body: '«Volver a pendiente» está en la misma fila: vuelve a tu cola y a contar como carga.',
    section: 'entregas',
    audience: 'todos',
    keywords: ['deshacer', 'error', 'revertir', 'pendiente'],
  },
  {
    id: 'puntos-urgencia',
    title: 'Los puntos de color son el tiempo que queda',
    body: 'Ámbar por debajo de 48 h, rojo por debajo de 24, rojo fijo si ya pasó. Lo entregado no lleva punto.',
    section: 'entregas',
    audience: 'todos',
    keywords: ['rojo', 'ámbar', 'atrasado', 'vencido', 'plazo', 'deadline'],
  },

  // ─── Crear diseños ──────────────────────────────────────────
  {
    id: 'numero-de-tarjeta',
    title: 'El número de tarjeta cuenta también las que están en blanco',
    body: 'Por eso al asistente pueden llegarle «1, 2, 4»: la 3 está en blanco y no se le manda.',
    section: 'taller',
    audience: 'todos',
    keywords: ['tarjeta', 'numeración', 'agente', 'chat', 'asistente'],
  },
  {
    id: 'asistente-modifica',
    title: 'El asistente también corrige lo que ya está puesto',
    body: '«En la 3 cambia el diseñador a Izan» funciona igual que dictarle una pieza nueva.',
    section: 'taller',
    audience: 'todos',
    keywords: ['agente', 'chat', 'ia', 'editar', 'corregir'],
  },
  {
    id: 'crear-desde-cualquier-sitio',
    title: 'El «+» crea desde cualquier pantalla',
    body: 'En móvil, el círculo dorado de la barra inferior; en escritorio, el botón de la cabecera.',
    section: 'taller',
    audience: 'todos',
    keywords: ['crear', 'nuevo', 'botón', 'móvil'],
  },

  // ─── Tu cuenta y este dispositivo ───────────────────────────
  {
    id: 'push-por-dispositivo',
    title: 'Las notificaciones push se activan por dispositivo',
    body: 'Cada navegador tiene su propio permiso: activarlas en el móvil no las activa en el portátil.',
    section: 'cuenta',
    audience: 'todos',
    keywords: ['push', 'notificaciones', 'avisos', 'permiso', 'móvil'],
  },
  {
    id: 'vista-por-defecto-local',
    title: 'La vista por defecto se guarda aquí, no en tu cuenta',
    body: 'Lista o calendario se guarda en este aparato, no en tu cuenta.',
    section: 'cuenta',
    audience: 'todos',
    keywords: ['lista', 'calendario', 'preferencia', 'ajustes'],
  },
  {
    id: 'instalar-app',
    title: 'Se puede instalar como aplicación',
    body: '«Añadir a pantalla de inicio» en móvil, o el icono de instalar del navegador en escritorio.',
    section: 'cuenta',
    audience: 'todos',
    keywords: ['pwa', 'instalar', 'inicio', 'escritorio', 'standalone'],
  },
  {
    id: 'atajo-sidebar',
    title: '⌘B pliega la barra lateral',
    body: 'Control + B en Windows. Se queda como la dejes.',
    section: 'cuenta',
    audience: 'todos',
    keywords: ['atajo', 'teclado', 'sidebar', 'contraer', 'menú'],
  },
] as const;
