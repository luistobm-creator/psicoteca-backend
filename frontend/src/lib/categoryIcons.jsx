// Elige un icono temático según el nombre de la categoría/carpeta, para que el
// Dashboard no muestre siempre el mismo icono de carpeta. Sin dependencias:
// reutiliza la colección SVG propia de `components/icons.jsx`.

import {
  Brain,
  ClipboardList,
  BookOpen,
  Heart,
  Activity,
  Users,
  FileText,
  GraduationCap,
  Stethoscope,
  MessageCircle,
  FlaskConical,
  Smile,
  Layers,
  Folder,
} from '../components/icons.jsx';

// Normaliza: minúsculas y sin acentos, para casar palabras clave con fiabilidad.
// \p{Diacritic} elimina las marcas de acento que deja normalize('NFD').
function normalize(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

// Reglas ordenadas de más específica a más genérica. La primera que casa gana.
const RULES = [
  [/neuro|cerebr|cogn|memoria|atenci|neurops/, Brain],
  [/test|psicometr|escala|cuestionario|inventario|evaluaci|diagnost|bateri/, ClipboardList],
  [/libro|manual|lectura|bibliograf|biblioteca|ebook|texto/, BookOpen],
  [/articul|paper|revista|publicaci|cient|estudio|meta-?anali/, FileText],
  [/investiga|experiment|laborator|ciencia|dato|estad/, FlaskConical],
  [/nin|infan|adolesc|pediatr|escolar|juvenil|colegio/, Smile],
  [/grupo|grupal|famili|pareja|social|comunitar|comunidad|colectiv|sistemic|humanos/, Users],
  [/emocion|afect|animo|bienestar|mindful|medita|autoestima/, Heart],
  [/clinic|salud|trastorno|patolog|psicopat|sintoma|depresi|ansiedad|tratamiento/, Stethoscope],
  [/terap|interven|tecnica|ejercicio|dinamica|habilidad/, Activity],
  [/entrevista|sesion|comunica|coaching|counsel|dialog|habla/, MessageCircle],
  [/curso|formaci|taller|master|capacita|docenc|academ|apunte|clase/, GraduationCap],
  [/recurso|material|herramient|plantilla|ficha|varios|otros|general/, Layers],
];

/** Devuelve el componente de icono (no instanciado) para un nombre dado. */
export function categoryIconComponent(name) {
  const n = normalize(name);
  for (const [re, Icon] of RULES) {
    if (re.test(n)) return Icon;
  }
  return Folder;
}

/** Devuelve el icono ya renderizado (elemento React) con el tamaño indicado. */
export function categoryIcon(name, size = 20) {
  const Icon = categoryIconComponent(name);
  return <Icon width={size} height={size} />;
}
