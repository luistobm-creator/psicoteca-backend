"""
Puebla el glosario clínico personal (tabla `glosario_clinico` en Supabase) con
50 términos fundamentales de psicología clínica.

Cómo se autentica (importante):
Este script NO usa la service_role key de Supabase ni ninguna llave maestra:
te pide tu correo y contraseña de Psicoteca de forma INTERACTIVA (la
contraseña no se muestra en pantalla ni se guarda en ningún lado) y los
intercambia por un token de sesión normal contra el propio endpoint público
de login de Supabase — el mismo mecanismo que usa la página de login. Con ese
token llama a `POST /api/glosario` (el mismo endpoint del backend real), así
que las políticas RLS aplican exactamente igual que si lo hicieras desde la
app: los términos quedan asociados a TU user_id.

Uso (desde la carpeta backend/, con el venv activado):

    python scripts/seed_glosario.py

Variables de entorno opcionales:
    GLOSARIO_API_BASE     Backend a usar (por defecto: el de Render en producción).
    SUPABASE_URL          Proyecto de Supabase (por defecto: el de Psicoteca).
    SUPABASE_ANON_KEY     Clave pública/publishable (por defecto: la de Psicoteca).
"""
from __future__ import annotations

import getpass
import os
import sys

import requests

for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

API_BASE = os.environ.get("GLOSARIO_API_BASE", "https://psicoteca-api.onrender.com")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://mkompcwaflfnapmvtqrn.supabase.co")
# Clave pública ("publishable"): la misma que ya va en el bundle del frontend
# (frontend/.env.production) — no es un secreto, protegida por RLS.
SUPABASE_ANON_KEY = os.environ.get(
    "SUPABASE_ANON_KEY", "sb_publishable_NyViBDHE2V9aKFYTdEkZOA_SDvk8oWw"
)

# 50 términos fundamentales, agrupados por área. termino/definicion/categoria
# mapean 1:1 a las columnas de `glosario_clinico`.
TERMINOS = [
    # --- Psicoanálisis ---
    {"termino": "Transferencia", "categoria": "Psicoanálisis", "definicion": "Proceso por el cual el paciente proyecta sobre el terapeuta sentimientos, deseos y patrones relacionales originados en vínculos significativos tempranos (habitualmente parentales)."},
    {"termino": "Contratransferencia", "categoria": "Psicoanálisis", "definicion": "Conjunto de reacciones emocionales, conscientes e inconscientes, del terapeuta hacia el paciente, influidas por la propia historia del clínico; su manejo reflexivo es central en la técnica psicodinámica."},
    {"termino": "Inconsciente", "categoria": "Psicoanálisis", "definicion": "Instancia psíquica que contiene contenidos (deseos, recuerdos, conflictos) no accesibles directamente a la conciencia pero que influyen en el pensamiento, el afecto y la conducta."},
    {"termino": "Mecanismo de defensa", "categoria": "Psicoanálisis", "definicion": "Estrategia psíquica inconsciente (p. ej. represión, proyección, negación, formación reactiva) que protege al yo de la ansiedad generada por conflictos internos o amenazas externas."},
    {"termino": "Resistencia", "categoria": "Psicoanálisis", "definicion": "Oposición, consciente o inconsciente, del paciente al proceso terapéutico o a la toma de conciencia de contenidos conflictivos."},
    # --- Conductismo ---
    {"termino": "Condicionamiento clásico", "categoria": "Conductismo", "definicion": "Proceso de aprendizaje asociativo (Pavlov) mediante el cual un estímulo neutro adquiere la capacidad de provocar una respuesta al asociarse repetidamente con un estímulo incondicionado."},
    {"termino": "Condicionamiento operante", "categoria": "Conductismo", "definicion": "Proceso de aprendizaje (Skinner) en el que la probabilidad de una conducta se modifica según las consecuencias (refuerzo o castigo) que la siguen."},
    {"termino": "Refuerzo positivo", "categoria": "Conductismo", "definicion": "Presentación de un estímulo agradable inmediatamente después de una conducta, que aumenta la probabilidad de que esta se repita."},
    {"termino": "Refuerzo negativo", "categoria": "Conductismo", "definicion": "Retirada de un estímulo aversivo tras una conducta, lo que incrementa la probabilidad de que dicha conducta se repita."},
    {"termino": "Extinción", "categoria": "Conductismo", "definicion": "Disminución gradual y desaparición de una respuesta condicionada cuando deja de reforzarse o de asociarse con el estímulo original."},
    # --- Terapia y técnicas ---
    {"termino": "Desensibilización sistemática", "categoria": "Terapia y técnicas", "definicion": "Técnica conductual (Wolpe) que combina relajación progresiva con exposición gradual y jerárquica a estímulos temidos, para reducir respuestas de ansiedad o fobia."},
    {"termino": "Psicoeducación", "categoria": "Terapia y técnicas", "definicion": "Intervención que brinda al paciente y su entorno información estructurada sobre su condición, tratamiento y estrategias de afrontamiento."},
    {"termino": "Mindfulness", "categoria": "Terapia y técnicas", "definicion": "Práctica de atención plena e intencional al momento presente, sin juicio, utilizada clínicamente para reducir el estrés, la rumiación y la reactividad emocional."},
    {"termino": "Terapia de aceptación y compromiso (ACT)", "categoria": "Terapia y técnicas", "definicion": "Enfoque contextual que promueve la flexibilidad psicológica mediante la aceptación de experiencias internas y el compromiso con acciones alineadas a los valores personales."},
    # --- Cognitivo-Conductual ---
    {"termino": "Reestructuración cognitiva", "categoria": "Cognitivo-conductual", "definicion": "Técnica terapéutica que busca identificar y modificar pensamientos automáticos y creencias disfuncionales, sustituyéndolos por otros más adaptativos y realistas."},
    {"termino": "Distorsión cognitiva", "categoria": "Cognitivo-conductual", "definicion": "Patrón de pensamiento erróneo y sistemático (p. ej. pensamiento dicotómico, catastrofismo, sobregeneralización) que contribuye al malestar emocional."},
    {"termino": "Esquema cognitivo", "categoria": "Cognitivo-conductual", "definicion": "Estructura mental organizada, formada en la experiencia temprana, que filtra e interpreta la información y guía la percepción, el afecto y la conducta."},
    {"termino": "Autoeficacia", "categoria": "Cognitivo-conductual", "definicion": "Creencia de una persona en su propia capacidad para organizar y ejecutar las acciones necesarias para alcanzar metas específicas (Bandura)."},
    {"termino": "Aprendizaje observacional", "categoria": "Cognitivo-conductual", "definicion": "Adquisición de conductas, actitudes o respuestas emocionales mediante la observación del comportamiento de un modelo y sus consecuencias."},
    # --- Humanismo ---
    {"termino": "Autorrealización", "categoria": "Humanismo", "definicion": "Tendencia innata del ser humano a desarrollar y expresar plenamente su potencial (Maslow, Rogers); cúspide de la jerarquía de necesidades."},
    {"termino": "Congruencia", "categoria": "Humanismo", "definicion": "Correspondencia entre la experiencia interna, la autopercepción y la conducta expresada; en terapia rogeriana, autenticidad del terapeuta como condición del cambio."},
    {"termino": "Consideración positiva incondicional", "categoria": "Humanismo", "definicion": "Actitud terapéutica de aceptación cálida y no valorativa hacia el cliente, independientemente de lo que exprese o haga (Rogers)."},
    # --- Proceso clínico ---
    {"termino": "Alianza terapéutica", "categoria": "Proceso clínico", "definicion": "Vínculo colaborativo entre terapeuta y paciente, sustentado en el acuerdo sobre objetivos, tareas y un lazo afectivo de confianza; predictor robusto del resultado terapéutico."},
    {"termino": "Rapport", "categoria": "Proceso clínico", "definicion": "Relación de sintonía, confianza y comunicación fluida establecida entre el clínico y el paciente desde las primeras sesiones."},
    {"termino": "Insight", "categoria": "Proceso clínico", "definicion": "Comprensión súbita o gradual, por parte del paciente, de las causas y conexiones de su malestar, síntomas o patrones de conducta."},
    {"termino": "Regulación emocional", "categoria": "Proceso clínico", "definicion": "Conjunto de procesos por los cuales una persona influye en qué emociones tiene, cuándo las tiene, y cómo las experimenta y expresa."},
    # --- Psicopatología ---
    {"termino": "Comorbilidad", "categoria": "Psicopatología", "definicion": "Presencia simultánea de dos o más trastornos o condiciones clínicas distintas en la misma persona."},
    {"termino": "Trastorno depresivo mayor", "categoria": "Psicopatología", "definicion": "Cuadro clínico caracterizado por estado de ánimo deprimido y/o anhedonia persistentes, junto con síntomas cognitivos, somáticos y conductuales asociados, que afectan el funcionamiento (DSM-5-TR)."},
    {"termino": "Trastorno de ansiedad generalizada", "categoria": "Psicopatología", "definicion": "Preocupación excesiva y de difícil control sobre múltiples áreas, presente la mayoría de los días durante al menos seis meses, acompañada de síntomas físicos de tensión."},
    {"termino": "Trastorno de estrés postraumático (TEPT)", "categoria": "Psicopatología", "definicion": "Cuadro que surge tras la exposición a un evento traumático, con reexperimentación, evitación, alteraciones cognitivo-afectivas negativas e hiperactivación."},
    {"termino": "Ideación suicida", "categoria": "Psicopatología", "definicion": "Presencia de pensamientos sobre causarse la muerte, que pueden variar desde deseos pasivos de morir hasta planes específicos con intencionalidad."},
    # --- Psicología cognitiva y social ---
    {"termino": "Disonancia cognitiva", "categoria": "Psicología cognitiva y social", "definicion": "Estado de tensión psicológica que surge al sostener simultáneamente dos cogniciones (creencias, actitudes o conductas) incompatibles entre sí (Festinger)."},
    {"termino": "Sesgo de confirmación", "categoria": "Psicología cognitiva y social", "definicion": "Tendencia a buscar, interpretar y recordar información de manera que confirme las creencias o hipótesis previas, ignorando la evidencia contraria."},
    # --- Desarrollo ---
    {"termino": "Apego", "categoria": "Desarrollo", "definicion": "Vínculo afectivo duradero que el infante establece con su(s) cuidador(es) principal(es), que organiza la regulación emocional y las expectativas relacionales futuras (Bowlby, Ainsworth)."},
    {"termino": "Apego seguro", "categoria": "Desarrollo", "definicion": "Patrón de apego caracterizado por confianza en la disponibilidad del cuidador, que favorece la exploración del entorno y una regulación emocional adaptativa."},
    {"termino": "Zona de desarrollo próximo", "categoria": "Desarrollo", "definicion": "Distancia entre lo que un individuo puede hacer de forma autónoma y lo que puede lograr con la guía de otro más competente (Vygotsky)."},
    {"termino": "Teoría de la mente", "categoria": "Desarrollo", "definicion": "Capacidad de atribuir estados mentales (creencias, deseos, intenciones) propios y ajenos, y de comprender que estos pueden diferir de la realidad objetiva."},
    # --- Neuropsicología ---
    {"termino": "Función ejecutiva", "categoria": "Neuropsicología", "definicion": "Conjunto de procesos cognitivos de alto nivel (planificación, inhibición, memoria de trabajo, flexibilidad cognitiva) que regulan y controlan la conducta dirigida a metas."},
    {"termino": "Plasticidad neuronal", "categoria": "Neuropsicología", "definicion": "Capacidad del sistema nervioso para reorganizar su estructura y funcionamiento en respuesta a la experiencia, el aprendizaje o el daño cerebral."},
    {"termino": "Memoria de trabajo", "categoria": "Neuropsicología", "definicion": "Sistema de capacidad limitada que permite mantener y manipular información de forma activa durante periodos breves para realizar tareas cognitivas complejas."},
    # --- Evaluación y psicometría ---
    {"termino": "Validez", "categoria": "Psicometría", "definicion": "Grado en que un instrumento de evaluación mide realmente el constructo que pretende medir."},
    {"termino": "Confiabilidad", "categoria": "Psicometría", "definicion": "Grado de consistencia y estabilidad de las puntuaciones de un instrumento a través de repeticiones, ítems o evaluadores."},
    {"termino": "Entrevista clínica", "categoria": "Evaluación", "definicion": "Procedimiento estructurado, semiestructurado o libre de recogida de información verbal y no verbal, central para la evaluación, el diagnóstico y la formulación de caso."},
    {"termino": "Formulación de caso", "categoria": "Evaluación", "definicion": "Síntesis clínica que integra información diagnóstica, historia y factores predisponentes, precipitantes, perpetuantes y protectores, para orientar el plan de tratamiento."},
    # --- Ética y práctica profesional ---
    {"termino": "Consentimiento informado", "categoria": "Ética profesional", "definicion": "Proceso mediante el cual el paciente recibe información clara sobre la naturaleza, riesgos, beneficios y alternativas de una intervención, y autoriza voluntariamente su realización."},
    {"termino": "Confidencialidad", "categoria": "Ética profesional", "definicion": "Obligación ética y legal del profesional de no divulgar la información compartida por el paciente, salvo excepciones justificadas (p. ej. riesgo grave para el paciente o terceros)."},
    {"termino": "Secreto profesional", "categoria": "Ética profesional", "definicion": "Deber de reserva sobre la información obtenida en el ejercicio clínico, cuyo quebrantamiento no autorizado puede constituir falta ética y/o legal."},
    {"termino": "Supervisión clínica", "categoria": "Ética profesional", "definicion": "Proceso formativo y de acompañamiento en el que un profesional con mayor experiencia revisa el trabajo clínico de otro, para garantizar calidad, ética y desarrollo profesional continuo."},
    # --- Marcos integradores y farmacología ---
    {"termino": "Modelo biopsicosocial", "categoria": "Marco integrador", "definicion": "Perspectiva que entiende la salud y la enfermedad como resultado de la interacción de factores biológicos, psicológicos y sociales, en oposición a modelos puramente biomédicos."},
    {"termino": "Psicofármaco", "categoria": "Psicofarmacología", "definicion": "Sustancia que actúa sobre el sistema nervioso central modificando procesos mentales y conductuales, utilizada como parte del abordaje de trastornos psicológicos/psiquiátricos."},
]


def login(email: str, password: str) -> str:
    """Intercambia correo+contraseña por un access_token (mismo endpoint que usa el login web)."""
    resp = requests.post(
        f"{SUPABASE_URL.rstrip('/')}/auth/v1/token",
        params={"grant_type": "password"},
        headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
        json={"email": email, "password": password},
        timeout=15,
    )
    if resp.status_code != 200:
        detail = resp.json().get("error_description") or resp.json().get("msg") or resp.text
        raise SystemExit(f"No se pudo iniciar sesión: {detail}")
    return resp.json()["access_token"]


def existing_terms(token: str) -> set[str]:
    """Términos que ya existen (en minúsculas), para no duplicar en una re-ejecución."""
    resp = requests.get(
        f"{API_BASE}/api/glosario",
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    resp.raise_for_status()
    return {row["termino"].strip().lower() for row in resp.json()}


def seed(token: str) -> None:
    ya_existen = existing_terms(token)
    ok, saltados, fallidos = 0, 0, 0

    for t in TERMINOS:
        if t["termino"].strip().lower() in ya_existen:
            print(f"  = ya existe, se omite: {t['termino']}")
            saltados += 1
            continue
        resp = requests.post(
            f"{API_BASE}/api/glosario",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json=t,
            timeout=15,
        )
        if resp.status_code == 201:
            print(f"  + {t['termino']}")
            ok += 1
        else:
            print(f"  ! fallo ({resp.status_code}) con '{t['termino']}': {resp.text[:200]}")
            fallidos += 1

    print(f"\nListo: {ok} creados, {saltados} ya existían, {fallidos} fallidos (de {len(TERMINOS)} totales).")


def main() -> None:
    print(f"Backend: {API_BASE}")
    print("Inicia sesión con tu cuenta de Psicoteca (la contraseña no se muestra ni se guarda).")
    email = input("Correo: ").strip()
    password = getpass.getpass("Contraseña: ")
    token = login(email, password)
    print("Sesión iniciada. Poblando el glosario…\n")
    seed(token)


if __name__ == "__main__":
    main()
