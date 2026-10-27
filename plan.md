# Plan de implementación — Fresas & Crema

## Alcance y decisiones

- Aplicación frontend con Vite, React, TypeScript, Tailwind CSS, React Router y `@supabase/supabase-js`.
- El navegador se conecta directamente al proyecto Supabase existente: Auth para email/contraseña, Postgres para las tablas indicadas y Storage para comprobantes. No se crea backend ni se recrean tablas.
- La sesión persistente y las rutas privadas dependen de Supabase Auth. El cliente requiere `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`; no se inventarán datos ni credenciales. Las variables se documentarán para el preview y Vercel y se mostrarán instrucciones claras si faltan.
- Se implementan `/login`, `/dashboard`, `/insumos`, `/ventas`, `/gastos` y `/productos`, más `/` como redirección. El frontend enrutará las seis secciones privadas mediante `RutaProtegida`.
- El SQL aportado define los nombres de columnas y relaciones de las tablas; el nombre y las políticas RLS de Storage y la configuración/Auth del proyecto vivo aún deben verificarse. No se ejecutará DDL ni se recrearán tablas. Se usarán `productos.precio_base` y `moneda_precio`, `insumos.unidad_medida`, los campos `tipo_movimiento`/`costo_total`/`motivo` en movimientos, `tasas_cambio.moneda_origen`/`moneda_destino`/`tasa`/`fecha`, y el tipo de gasto desde `categorias_gastos.tipo`.
- Incluir `.env.example`, instrucciones para verificar Auth/RLS/Storage y una guía de build y despliegue en Vercel. No publicaré el sitio en Vercel ni pediré claves por el chat.
- Usar el logo suministrado `LOGO002.webp` sin alterar su diseño; conservar un comentario breve donde sustituirlo.

## Enfoque visual

- **Movimiento:** panel editorial cálido de un pequeño negocio artesanal, con una interfaz contemporánea de gestión.
- **Principios:** lectura rápida de cifras; controles accesibles desde móvil; jerarquía clara sin ruido; color de marca aplicado con moderación.
- **Color:** rojo fresa `#AB1816` para acciones y datos prioritarios; rosa `#F29EC1` para foco y estados suaves; café `#3A180F` para navegación y texto destacado; crema `#FAEADD` para superficies cálidas; negro para contraste; oliva `#838623` solo para éxito.
- **Composición:** navegación lateral fija en escritorio y navegación inferior en móvil; contenido alineado al área de trabajo, cabecera compacta y listas adaptadas a pantallas estrechas.
- **Motivos:** logo provisto como marca principal; tarjetas con bordes cálidos; indicadores rojo/rosa para stock y actividad.
- **Interacción y movimiento:** formularios cortos, foco visible, confirmaciones antes de eliminar y estados de carga/vacío; transiciones discretas de color y elevación (150–200 ms), sin animación que distraiga.
- **Tipografía:** sans serif de sistema para cifras, tablas y controles; serif de sistema en títulos de sección, evitando dependencias externas de fuentes.
- **Esencia de marca:** control cotidiano de ventas, inventario y gastos para el emprendimiento; personalidad cálida, práctica y confiable.
- **Voz:** titulares directos y cercanos; CTA breves en español de Venezuela. Ejemplos: «Así va tu negocio hoy» y «Registrar venta».
- **Wordmark/logo:** presentar el logo original adjunto, con texto alternativo; dejar un comentario en el componente para reemplazar el archivo en `public/images/`.
- **Color distintivo:** rojo fresa `#AB1816`.

## Arquitectura funcional

1. **Base:** configuración Vite, TypeScript, Tailwind y aliases; cliente Supabase opcional hasta que existan las variables; configuración es-VE para moneda y fecha.
2. **Acceso:** `AuthProvider` observa cambios con `onAuthStateChange`; login y logout usan `signInWithPassword` y `signOut`; sin registro público; `RutaProtegida` redirige a `/login` sin sesión.
3. **Layout y UI:** sidebar/bottom-nav, cabecera, tarjetas, botones, campos, selectores, tabla/lista responsive, modal, insignias, alertas, skeletons, vacíos y toasts.
4. **Dashboard:** agregados del día/mes en COP, alerta de inventario y tendencia de siete días. Gráfico con una librería ligera si resulta conveniente; de lo contrario, barras SVG/CSS accesibles.
5. **Insumos:** CRUD sobre `insumos` (`unidad_medida`); al crear/editar registra movimientos usando `tipo_movimiento`, `cantidad`, `costo_total`, `moneda`, `tasa_a_cop` y `motivo`; resalta existencias bajas.
6. **Ventas:** captura productos, cantidades enteras (el SQL declara `venta_detalles.cantidad INTEGER`) y precio negociado; convierte `productos.precio_base` desde `moneda_precio` hacia la moneda de pago mediante las tasas con destino COP; propone la tasa más reciente por fecha, calcula y guarda valores originales y COP en `ventas` y líneas en `venta_detalles`; lista con filtros y detalle desplegable.
7. **Gastos:** CRUD sobre `gastos`, categorías desde `categorias_gastos` y tipo derivado de `categorias_gastos.tipo` (la tabla `gastos` no tiene columna `tipo`); carga comprobantes al bucket existente y separa visualmente egresos operativos/servicios y activos.
8. **Productos:** lista de `productos`, edición de `precio_base` conservando `moneda_precio`, alta en COP y cambio de estado activo/inactivo.
9. **Vercel:** build estático de Vite, fallback SPA, variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`, e instrucciones de despliegue. Las políticas RLS, autenticación y reglas del bucket permanecen en Supabase y deben permitir únicamente las operaciones legítimas de los usuarios autenticados.

## Estructura prevista

```text
public/
  images/
    LOGO002.webp         # logo original; reemplázalo aquí cuando quieras
  manus-routes.json      # manifiesto de rutas
src/
  app/                    # router, proveedores y rutas protegidas
  components/             # layout y componentes visuales reutilizables
  features/
    auth/                 # login y sesión
    dashboard/            # resumen y gráfico
    insumos/              # inventario y movimientos
    ventas/                # captura e historial
    gastos/                # gastos y comprobantes
    productos/             # catálogo
  lib/                    # cliente Supabase, formato y acceso a datos
  types/                  # tipos de dominio y base de datos
  styles/                 # Tailwind y variables de color
.env.example
vercel.json
README.md
```

Los comentarios del código serán breves, en español y en minúsculas. Se añadirán marcadores HTML/JSX/CSS donde cambiar el logo o colocar fotos del negocio/productos, sin insertar recursos de muestra como si fueran reales.
