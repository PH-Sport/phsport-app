import { describe, it, expect } from 'vitest';
import {
  findTip,
  groupTipsBySection,
  normalizeForSearch,
  parseDismissedIds,
  searchTips,
  serializeDismissedIds,
  tipsForRole,
} from './select';
import { HELP_SECTIONS, HELP_TIPS, type HelpSectionMeta, type HelpTip } from './tips';

function tip(overrides: Partial<HelpTip> = {}): HelpTip {
  return {
    id: 't-1',
    title: 'Un consejo',
    body: 'Su explicación.',
    section: 'buscar',
    audience: 'todos',
    ...overrides,
  };
}

describe('tipsForRole', () => {
  const tips = [
    tip({ id: 'comun', audience: 'todos' }),
    tip({ id: 'jefe', audience: 'ADMIN' }),
    tip({ id: 'peon', audience: 'DESIGNER' }),
  ];

  it('da a cada rol los suyos más los comunes', () => {
    expect(tipsForRole('ADMIN', tips).map((t) => t.id)).toEqual(['comun', 'jefe']);
    expect(tipsForRole('DESIGNER', tips).map((t) => t.id)).toEqual(['comun', 'peon']);
  });

  it('sin rol resuelto deja pasar solo los comunes', () => {
    expect(tipsForRole(undefined, tips).map((t) => t.id)).toEqual(['comun']);
  });
});

describe('findTip', () => {
  it('encuentra por id y devuelve undefined si no existe', () => {
    expect(findTip('rango-de-fechas')?.section).toBe('buscar');
    expect(findTip('no-existe')).toBeUndefined();
  });
});

describe('groupTipsBySection', () => {
  const secciones: HelpSectionMeta[] = [
    { id: 'buscar', label: 'Encontrar', hint: '' },
    { id: 'reparto', label: 'Reparto', hint: '' },
    { id: 'cuenta', label: 'Cuenta', hint: '' },
  ];

  it('respeta el orden de las secciones, no el de los consejos', () => {
    const tips = [
      tip({ id: 'c', section: 'cuenta' }),
      tip({ id: 'b', section: 'buscar' }),
      tip({ id: 'r', section: 'reparto' }),
    ];
    expect(groupTipsBySection(tips, secciones).map((g) => g.id)).toEqual([
      'buscar',
      'reparto',
      'cuenta',
    ]);
  });

  it('omite las secciones que se quedan sin consejos', () => {
    const grupos = groupTipsBySection([tip({ section: 'cuenta' })], secciones);
    expect(grupos.map((g) => g.id)).toEqual(['cuenta']);
  });

  it('conserva el orden original dentro de cada sección', () => {
    const tips = [
      tip({ id: 'primero', section: 'buscar' }),
      tip({ id: 'segundo', section: 'buscar' }),
    ];
    expect(groupTipsBySection(tips, secciones)[0].tips.map((t) => t.id)).toEqual([
      'primero',
      'segundo',
    ]);
  });
});

describe('normalizeForSearch', () => {
  it('quita tildes y mayúsculas', () => {
    expect(normalizeForSearch('  Diseño ENTREGÓ ')).toBe('diseno entrego');
  });
});

describe('searchTips', () => {
  const tips = [
    tip({ id: 'fechas', title: 'Mira las fechas', body: 'La semana en curso.' }),
    tip({ id: 'peso', title: 'Cuenta peso', body: 'Rápida, media, pesada.' }),
    tip({ id: 'push', title: 'Avisos', body: 'Por aparato.', keywords: ['notificaciones'] }),
  ];

  it('sin consulta devuelve todo', () => {
    expect(searchTips(tips, '   ')).toHaveLength(3);
  });

  it('busca también en el cuerpo y en las palabras clave', () => {
    expect(searchTips(tips, 'curso').map((t) => t.id)).toEqual(['fechas']);
    expect(searchTips(tips, 'notificaciones').map((t) => t.id)).toEqual(['push']);
  });

  it('ignora las tildes de la consulta', () => {
    expect(searchTips(tips, 'rapida').map((t) => t.id)).toEqual(['peso']);
  });

  it('exige todas las palabras, no cualquiera de ellas', () => {
    expect(searchTips(tips, 'peso pesada').map((t) => t.id)).toEqual(['peso']);
    expect(searchTips(tips, 'peso fechas')).toEqual([]);
  });

  it('no devuelve nada si ningún consejo casa', () => {
    expect(searchTips(tips, 'baloncesto')).toEqual([]);
  });
});

describe('parseDismissedIds', () => {
  it('lee una lista guardada', () => {
    expect(parseDismissedIds('["a","b"]')).toEqual(['a', 'b']);
  });

  it('quita duplicados', () => {
    expect(parseDismissedIds('["a","a","b"]')).toEqual(['a', 'b']);
  });

  it('devuelve vacío ante nulo, JSON roto o forma inesperada', () => {
    expect(parseDismissedIds(null)).toEqual([]);
    expect(parseDismissedIds('')).toEqual([]);
    expect(parseDismissedIds('{no es json')).toEqual([]);
    expect(parseDismissedIds('{"a":1}')).toEqual([]);
  });

  it('descarta los elementos que no son texto en vez de tirar la lista entera', () => {
    expect(parseDismissedIds('["a",3,null,"b"]')).toEqual(['a', 'b']);
  });
});

describe('serializeDismissedIds', () => {
  it('va y vuelve sin perder nada', () => {
    expect(parseDismissedIds(serializeDismissedIds(['a', 'b']))).toEqual(['a', 'b']);
  });

  it('acepta un Set y deduplica', () => {
    expect(serializeDismissedIds(new Set(['a', 'a', 'b']))).toBe('["a","b"]');
  });
});

// El catálogo es contenido, pero estas dos cosas lo romperían de forma callada.
describe('catálogo', () => {
  it('no repite ids: son anclas de /ayuda y claves de descarte', () => {
    const ids = HELP_TIPS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('todos los consejos caen en una sección declarada', () => {
    const declaradas = new Set(HELP_SECTIONS.map((s) => s.id));
    const huerfanos = HELP_TIPS.filter((t) => !declaradas.has(t.section)).map((t) => t.id);
    expect(huerfanos).toEqual([]);
  });
});
