import { describe, it, expect } from 'vitest';
import { sectionLabelFor } from './section-label';

describe('sectionLabelFor', () => {
  it('deriva el rótulo del primer segmento', () => {
    expect(sectionLabelFor('/inicio')).toBe('Inicio');
    expect(sectionLabelFor('/disenos')).toBe('Diseños');
    expect(sectionLabelFor('/ajustes')).toBe('Ajustes');
  });

  it('rotula el campograma, la entrada del departamento de Agentes', () => {
    expect(sectionLabelFor('/campograma')).toBe('Campograma');
  });

  it('mapea las dos vistas de semana al mismo rótulo', () => {
    expect(sectionLabelFor('/equipo')).toBe('Semana');
    expect(sectionLabelFor('/mi-semana')).toBe('Semana');
  });

  it('ignora los segmentos posteriores', () => {
    expect(sectionLabelFor('/equipo/abc-123')).toBe('Semana');
  });

  it('devuelve cadena vacía en rutas desconocidas o vacías', () => {
    expect(sectionLabelFor('/loquesea')).toBe('');
    expect(sectionLabelFor('/')).toBe('');
    expect(sectionLabelFor('')).toBe('');
  });
});
