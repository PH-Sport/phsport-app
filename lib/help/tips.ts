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
  /** Una a tres frases. Explica el porqué, no solo el qué. */
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
    body:
      'Inicio y Diseños solo enseñan la semana en curso, y Mi semana va de la semana pasada a tres por delante. Un diseño que entrega el lunes siguiente está bien asignado y aun así no se ve en ninguna de las dos. Antes de darlo por perdido, amplía «Desde» y «Hasta» en Diseños.',
    section: 'buscar',
    audience: 'todos',
    keywords: ['desaparecido', 'no aparece', 'perdido', 'filtro', 'semana'],
  },
  {
    id: 'buscador-alcance',
    title: 'El buscador solo mira lo que ya está en pantalla',
    body:
      'Filtra sobre los diseños que la semana elegida ha traído, no sobre toda la base. Si escribes un nombre y no sale nada, casi nunca es que no exista: es que cae fuera del rango de fechas. Amplía el rango y vuelve a buscar.',
    section: 'buscar',
    audience: 'todos',
    keywords: ['buscar', 'búsqueda', 'no encuentro', 'resultados'],
  },
  {
    id: 'punto-semanas-futuras',
    title: 'El punto que late junto a la semana',
    body:
      'En Inicio, al lado de «Semana del…», avisa de que hay trabajo asignado en semanas posteriores que esta pantalla no llega a enseñar. En escritorio lo dice con todas las letras. Es solo un aviso: no lleva a ninguna parte, para eso está el rango de fechas de Diseños.',
    section: 'buscar',
    audience: 'todos',
    keywords: ['punto', 'dorado', 'parpadea', 'futuro', 'próxima semana'],
  },
  {
    id: 'abrir-desde-aviso',
    title: 'El aviso de asignación abre la ficha aunque esté fuera de la semana',
    body:
      'Pulsar «Te han asignado…» va directo al diseño, saltándose el filtro de fechas. Si recibiste el aviso y luego no encuentras la pieza por pantalla, vuelve a la campana en lugar de pelearte con los filtros.',
    section: 'buscar',
    audience: 'todos',
    keywords: ['notificación', 'campana', 'aviso', 'enlace'],
  },

  // ─── Reparto y carga ────────────────────────────────────────
  {
    id: 'peso-por-tipo',
    title: 'El reparto cuenta peso, no número de diseños',
    body:
      'Cada tipo de pieza vale lo que cuesta: rápida 1, media 2, pesada 4. Un MD animado pesa como cuatro matchdays. Repartir «tres y tres» dejaría a alguien con tres animados y a otro con tres cumpleaños, que no es el mismo día de trabajo.',
    section: 'reparto',
    audience: 'todos',
    keywords: ['peso', 'rápida', 'media', 'pesada', 'esfuerzo', 'equilibrio'],
  },
  {
    id: 'tipo-decide-quien',
    title: 'Elegir el tipo de pieza no es solo etiquetar',
    body:
      'Del tipo sale el peso, y del peso sale a quién le toca. Un tipo mal puesto no se nota en la ficha, pero descuadra el reparto de toda esa semana. Si dudas entre dos, mira cuál se parece más en tiempo real de trabajo.',
    section: 'reparto',
    audience: 'todos',
    keywords: ['tipo', 'matchday', 'categoría'],
  },
  {
    id: 'semana-de-entrega',
    title: 'Se reparte dentro de la semana de entrega, no de la actual',
    body:
      'La carga se mide en la semana a la que pertenece la fecha de entrega de esa pieza. Por eso cambiar la fecha puede mudar el diseño de semana, y entonces el reparto automático se rehace contando la carga de la semana nueva.',
    section: 'reparto',
    audience: 'ADMIN',
    keywords: ['fecha', 'mover', 'cambiar fecha', 'reasignar'],
  },
  {
    id: 'carga-capacidad',
    title: 'El «4 / 8» bajo cada nombre es peso pendiente frente a capacidad',
    body:
      'Solo suma lo pendiente: al marcar una pieza como entregada, baja. Pasado el 100 % aparece «Sobrecarga», que es un aviso y no un tope — la app te deja asignar más si hace falta, solo se encarga de que lo veas.',
    section: 'reparto',
    audience: 'ADMIN',
    keywords: ['capacidad', 'sobrecarga', 'carga', 'ocupación'],
  },
  {
    id: 'reparto-empate',
    title: 'En empate no le toca siempre al mismo',
    body:
      'Cuando dos diseñadores van igual de cargados, el reparto va rotando entre ellos en vez de pegarse al primero de la lista. En un lote grande eso reparte los empates en vez de acumularlos en una sola persona.',
    section: 'reparto',
    audience: 'ADMIN',
    keywords: ['automático', 'repartir', 'turno', 'rotación'],
  },

  // ─── Entregas y plazos ──────────────────────────────────────
  {
    id: 'entregar-reversible',
    title: 'Entregar se puede deshacer',
    body:
      'Si marcas una pieza por error, «Volver a pendiente» está en su fila dentro del grupo de entregadas. Vuelve a tu cola y vuelve a contar como carga de la semana, así que el reparto también se entera.',
    section: 'entregas',
    audience: 'todos',
    keywords: ['deshacer', 'error', 'revertir', 'pendiente'],
  },
  {
    id: 'puntos-urgencia',
    title: 'Los puntos de color son el tiempo que queda',
    body:
      'Ámbar cuando faltan menos de 48 horas, rojo por debajo de 24, y rojo fijo —sin latido— si la hora ya pasó. Lo entregado nunca lleva punto de urgencia, por muy vencida que estuviera la fecha.',
    section: 'entregas',
    audience: 'todos',
    keywords: ['rojo', 'ámbar', 'atrasado', 'vencido', 'plazo', 'deadline'],
  },

  // ─── Crear diseños ──────────────────────────────────────────
  {
    id: 'numero-de-tarjeta',
    title: 'El número de tarjeta cuenta también las que están en blanco',
    body:
      'Existe para que tú y el asistente habléis de la misma tarjeta. Por eso al asistente pueden llegarle «1, 2, 4»: el 3 es una tarjeta vacía que no se le manda. El número que ves en pantalla es siempre el bueno.',
    section: 'taller',
    audience: 'todos',
    keywords: ['tarjeta', 'numeración', 'agente', 'chat', 'asistente'],
  },
  {
    id: 'asistente-modifica',
    title: 'El asistente también corrige lo que ya está puesto',
    body:
      'No solo dicta tarjetas nuevas. «En la 3 cambia el diseñador a Izan» o «pasa todas al viernes» funcionan igual de bien que describirle una pieza desde cero.',
    section: 'taller',
    audience: 'todos',
    keywords: ['agente', 'chat', 'ia', 'editar', 'corregir'],
  },
  {
    id: 'crear-desde-cualquier-sitio',
    title: 'El «+» crea desde cualquier pantalla',
    body:
      'En móvil, el círculo dorado de la barra inferior abre el taller estés donde estés y refresca al terminar la lista que tuvieras delante. En escritorio el botón vive en la cabecera de Inicio y de Diseños.',
    section: 'taller',
    audience: 'todos',
    keywords: ['crear', 'nuevo', 'botón', 'móvil'],
  },

  // ─── Tu cuenta y este dispositivo ───────────────────────────
  {
    id: 'push-por-dispositivo',
    title: 'Las notificaciones push se activan por dispositivo',
    body:
      'Cada navegador tiene su propio permiso, así que activarlas en el móvil no las activa en el portátil. Si dejaron de llegarte en uno de los dos, entra a Ajustes desde ese mismo aparato y vuelve a activarlas allí.',
    section: 'cuenta',
    audience: 'todos',
    keywords: ['push', 'notificaciones', 'avisos', 'permiso', 'móvil'],
  },
  {
    id: 'vista-por-defecto-local',
    title: 'La vista por defecto se guarda aquí, no en tu cuenta',
    body:
      'Elegir lista o calendario en Ajustes afecta a este dispositivo. Desde otro te recibirá la que tenga configurada él, aunque entres con el mismo usuario.',
    section: 'cuenta',
    audience: 'todos',
    keywords: ['lista', 'calendario', 'preferencia', 'ajustes'],
  },
  {
    id: 'instalar-app',
    title: 'Se puede instalar como aplicación',
    body:
      '«Añadir a pantalla de inicio» en el móvil, o el icono de instalar en la barra del navegador en escritorio. Se abre a pantalla completa, sin barra de direcciones, y es la vía para que los avisos lleguen como los de cualquier otra app.',
    section: 'cuenta',
    audience: 'todos',
    keywords: ['pwa', 'instalar', 'inicio', 'escritorio', 'standalone'],
  },
  {
    id: 'atajo-sidebar',
    title: '⌘B pliega la barra lateral',
    body:
      'Control + B en Windows. Se queda como la dejes, también la próxima vez que entres desde este navegador.',
    section: 'cuenta',
    audience: 'todos',
    keywords: ['atajo', 'teclado', 'sidebar', 'contraer', 'menú'],
  },
] as const;
