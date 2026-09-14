/**
 * Datos INVENTADOS para la vista previa del área personal del futbolista.
 *
 * No hay nada detrás: ni tabla de jugadores, ni carpetas en la base, ni
 * archivos en el almacenamiento. Esto existe solo para poder mirar la
 * interfaz desde la app y decidir la disposición antes de construir nada.
 *
 * Cuando llegue lo de verdad, este archivo se borra entero.
 */

export interface CarpetaMuestra {
  id: string;
  nombre: string;
  archivos: number;
  /** Degradado que hace de portada mientras no hay fotos reales. */
  portada: string;
}

export interface EntregaMuestra {
  id: string;
  nombre: string;
  fecha: string;
  total: number;
  /** Degradados de las miniaturas visibles. */
  miniaturas: string[];
}

export interface EnvioMuestra {
  id: string;
  nombre: string;
  cuando: string;
  peso: string;
  tipo: 'imagen' | 'video';
}

const CESPED = 'linear-gradient(155deg, hsl(140 32% 34%), hsl(146 36% 19%))';
const NOCHE = 'linear-gradient(155deg, hsl(212 38% 36%), hsl(220 36% 18%))';
const ATARDECER = 'linear-gradient(155deg, hsl(28 42% 46%), hsl(22 40% 25%))';
const SOMBRA = 'linear-gradient(155deg, hsl(150 27% 39%), hsl(150 34% 23%))';
const FOCO = 'linear-gradient(155deg, hsl(38 44% 50%), hsl(30 40% 27%))';
const GRADA = 'linear-gradient(155deg, hsl(196 30% 36%), hsl(206 32% 20%))';

const RELLENO = [CESPED, SOMBRA, ATARDECER, NOCHE, FOCO, GRADA];

export const CARPETAS: CarpetaMuestra[] = [
  { id: 'fotos', nombre: 'Fotos', archivos: 48, portada: CESPED },
  { id: 'matchdays', nombre: 'Matchdays', archivos: 6, portada: NOCHE },
];

export const ENTREGAS: EntregaMuestra[] = [
  { id: 'j12', nombre: 'Jornada 12', fecha: '12 oct', total: 20, miniaturas: [...RELLENO, ...RELLENO.slice(0, 3)] },
  { id: 'estudio', nombre: 'Sesión de estudio', fecha: '3 oct', total: 8, miniaturas: RELLENO },
  { id: 'j11', nombre: 'Jornada 11', fecha: '28 sep', total: 20, miniaturas: RELLENO },
];

export const ENVIOS: EnvioMuestra[] = [
  { id: 'e1', nombre: 'IMG_4471.jpg', cuando: 'ayer', peso: '6,2 MB', tipo: 'imagen' },
  { id: 'e2', nombre: 'IMG_4470.jpg', cuando: 'ayer', peso: '5,8 MB', tipo: 'imagen' },
  { id: 'e3', nombre: 'gol_minuto_78.mp4', cuando: '4 oct', peso: '41 MB', tipo: 'video' },
];
