# Laboratorio Virtual de Estabilidad (CAD & Mass Properties)

Aplicación web para el curso de **Cálculo Integral** (aplicaciones de la integral: centroides y centros de masa).
Permite construir cuerpos formados por bloques rectangulares homogéneos, calcular su **centroide geométrico** y su
**centro de masa** con el desarrollo paso a paso en KaTeX, evaluar la **estabilidad** sobre dos apoyos y simular el
**vuelco** como cuerpo rígido.

## Requisitos

Solo **Docker** (Docker Desktop en Windows/macOS o Docker Engine + Compose v2 en Linux). No hace falta instalar Node
ni ninguna dependencia en el equipo anfitrión.

## Comandos

| Acción | Comando |
| --- | --- |
| Servidor de desarrollo con HMR en http://localhost:5173 | `docker compose up` |
| Build de producción (genera `dist/` con `index.html` en la raíz) | `docker compose run --rm app npm run build` |
| Tests (Vitest) | `docker compose run --rm app npm run test` |
| Solo verificación de tipos | `docker compose run --rm app npm run typecheck` |
| Regenerar `package-lock.json` | `docker compose run --rm app npm install` |

- El HMR funciona en Windows/macOS gracias a `CHOKIDAR_USEPOLLING=true` (definido en `docker-compose.yml`) y a
  `server.watch.usePolling` en `vite.config.ts`.
- Si cambias `package.json`, reconstruye la imagen y el volumen de `node_modules`: `docker compose up --build -V`.
- El build usa `base: './'`: todos los recursos (JS, CSS, fuentes Inter / JetBrains Mono y fuentes de KaTeX) se
  referencian con rutas relativas y van empaquetados, sin CDNs. `dist/` funciona servido bajo cualquier subruta.

## Uso

- **Barra superior**: selector de presets, *Simular Gravedad* / *Detener*, *Reiniciar*, *Snap to Grid* (paso 1 cm;
  mantén **Shift** al arrastrar para desactivarlo), zoom, *Centrar plano* y *Exportar* (PNG ×2 o reporte técnico).
- **Panel izquierdo**: tarjetas de presets, lista de bloques (añadir, duplicar, eliminar, seleccionar), inspector con
  inputs y deslizadores de `b, h, m, x, y`, y posición de los apoyos A y B.
- **Lienzo**: rueda = zoom centrado en el cursor (0.2×–8×); botón central o **Espacio + arrastre** = desplazar;
  clic y arrastre = mover bloques; los apoyos se arrastran solo en horizontal; flechas = mover el bloque seleccionado
  (Shift: 10 cm).
- **Panel derecho**: diagnóstico (estado, margen, pivote), reacciones, simulación en vivo y desarrollo paso a paso.

## Estructura del proyecto

```
├── Dockerfile, docker-compose.yml     Entorno de desarrollo y build sin dependencias locales
├── .github/workflows/deploy.yml       Despliegue a GitHub Pages
├── vite.config.ts                     base './', polling para HMR, configuración de Vitest
└── src/
    ├── lib/
    │   ├── physics.ts                 Motor puro: centroide, centro de masa, estabilidad, reacciones, I_P
    │   ├── dynamics.ts                Vuelco de cuerpo rígido (Euler semi-implícito, dt = 1/120 s)
    │   ├── derivation.ts              Construcción del desarrollo TeX a partir de las trazas del motor
    │   ├── geometry.ts                Solapamientos y bloques flotantes
    │   ├── camera.ts, density.ts      Transformaciones del lienzo, cuadrícula adaptativa, sombreado por ρ
    │   ├── status.ts, format.ts, limits.ts
    │   └── *.test.ts                  Tests Vitest
    ├── data/presets.ts                Los 4 presets didácticos (datos + resultados esperados)
    ├── canvas/render.ts               Dibujo 2D nativo de la escena
    ├── state/                         useReducer + Context (modelo, análisis, vista, simulación, reporte)
    └── components/                    TopBar, BlockList, BlockInspector, SupportsInspector, Viewport,
                                       AnalysisPanel, StabilityCard, PresetCards, SimulationCard, …
```

## Modelo físico

**Convenciones.** Longitudes en cm, masas en kg, g = 9.81 m/s². Cada bloque `{ b, h, m, x, y }` tiene su esquina
inferior izquierda en (x, y); su centro es (xᵢ, yᵢ) = (x + b/2, y + h/2). El eje y apunta hacia arriba y los apoyos
A y B están sobre y = 0.

**De la integral a la suma.** Para una región plana R con densidad superficial ρ:

- Centroide geométrico: x̄_G = ∬ x dA / ∬ dA, ȳ_G = ∬ y dA / ∬ dA.
- Centro de masa: x̄_CM = ∬ x ρ dA / ∬ ρ dA, ȳ_CM = ∬ y ρ dA / ∬ ρ dA.

Para un rectángulo homogéneo [x₀, x₀+b] × [y₀, y₀+h]:
∬ x dA = h · [(x₀+b)² − x₀²]/2 = b·h·(x₀ + b/2) = Aᵢ·xᵢ, y como ρᵢ = mᵢ/Aᵢ es constante, ∬ x ρ dA = mᵢ·xᵢ.
Por aditividad de la integral sobre regiones disjuntas:

x̄_G = ΣAᵢxᵢ / ΣAᵢ  x̄_CM = Σmᵢxᵢ / Σmᵢ (análogamente para y).

El centroide depende **solo de la forma**; el centro de masa depende de **cómo se reparte la masa**. Coinciden
únicamente si todas las densidades son iguales (preset 3). El preset 4 muestra el caso en que difieren lo bastante
como para cambiar el diagnóstico.

**Estabilidad.** Con xmin = min(x_A, x_B) y xmax = max(x_A, x_B), el sistema es estable si
xmin ≤ x̄_CM ≤ xmax. El margen es min(x̄_CM − xmin, xmax − x̄_CM) (negativo si el CM cae fuera) y el pivote crítico
es el apoyo del lado por el que sale el CM. Si x_A = x_B la base tiene ancho 0 y el sistema es inestable.

**Reacciones.** Con L = xmax − xmin > 0 y W = M·g:
R_min = W·(xmax − x̄_CM)/L, R_max = W·(x̄_CM − xmin)/L. El panel comprueba ΣF_y = 0 y Στ = 0.

**Vuelco.** Si el CM cae fuera de la base, el cuerpo gira como sólido rígido alrededor del pivote P:

- Momento de inercia (ejes paralelos): I_P = Σ [ mᵢ(bᵢ² + hᵢ²)/12 + mᵢ·dᵢ² ] (en kg·m²).
- Dinámica: α = −M·g·(r_x cosθ − r_y sinθ)/I_P, con r = CM − P y θ positivo antihorario.
- Integración de Euler semi-implícita (ω += α·dt; θ += ω·dt) con dt = 1/120 s y acumulador de tiempo, de modo que
  el resultado no depende de los FPS.
- Fin: cuando un vértice (excluidos el pivote y los que ya estaban en y = 0) toca el suelo —el ángulo de contacto se
  calcula de forma exacta— o cuando |θ| = 90°. El impacto es inelástico (ω = 0) y el estado pasa a **VOLCADO**.

**Presets.**

| # | Preset | x̄_G | x̄_CM | M | Resultado |
| --- | --- | --- | --- | --- | --- |
| 1 | Torre Simétrica Estable | 0 | 0 | 43 kg | Estable, R_A = R_B |
| 2 | Voladizo con Contrapeso | ≈ 23.06 | ≈ 5.56 | 90 kg | Estable |
| 3 | Colapso por Geometría | 19 | 19 | 100 kg | Inestable, pivote B, margen −9 cm |
| 4 | La Trampa de Densidad | 10 (dentro) | ≈ 25.79 (fuera) | 95 kg | Inestable, pivote B |

## Exportación

- **Exportar PNG**: captura del lienzo a resolución ×2 con un rótulo (modelo, fecha y estado).
- **Reporte técnico**: vista imprimible en fondo blanco (`window.print()`; elige «Guardar como PDF» si quieres un
  archivo) con la imagen del lienzo, la tabla de bloques, los resultados, el estado de estabilidad y el desarrollo
  KaTeX completo.

## Despliegue en GitHub Pages

1. Genera el `package-lock.json` con Docker (el workflow usa `npm ci`, que lo exige) y súbelo al repositorio:
   ```bash
   docker compose run --rm app npm install
   git add package-lock.json
   git commit -m "Añadir package-lock.json"
   ```
2. En GitHub: **Settings → Pages → Build and deployment → Source: «GitHub Actions»**.
3. Haz push a `main`. El workflow `.github/workflows/deploy.yml` ejecuta `npm ci`, los tests, `npm run build` y
   publica `dist/` con `actions/upload-pages-artifact` y `actions/deploy-pages`. Como el build usa rutas relativas,
   funciona en `https://<usuario>.github.io/<repositorio>/` sin configuración adicional.
