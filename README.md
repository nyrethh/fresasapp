# Fresas & Crema — panel de gestión

Frontend de gestión para el emprendimiento. Usa Vite, React, TypeScript, Tailwind, React Router y Supabase JS. No tiene backend propio y no crea ni modifica la estructura de base de datos.

## Ejecutar en local

Se requiere Node.js 22.12 o superior y pnpm 11. Desde la carpeta del proyecto:

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

## Windows PowerShell

Ejecuta estos comandos en la carpeta raíz del proyecto, la misma que contiene `package.json` (no en una subcarpeta como `app-web` si ahí no está ese archivo):

```powershell
cd "C:\Users\kathe\Documents\proyectos\fresasapp"
Test-Path .\package.json
npx.cmd --yes pnpm@11.25.0 install
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
notepad .env.local
npx.cmd --yes pnpm@11.25.0 dev
```

El `Test-Path` debe devolver `True`. En el navegador abre `http://localhost:3000`. Usa `npx.cmd` para evitar la política que bloquea `npm.ps1` y el error de firma de Corepack que puede aparecer al descargar pnpm. Después de guardar cambios en `.env.local`, reinicia el servidor Vite.

Completa `.env.local` con los valores públicos de **Project URL** y **anon/public key** disponibles en Supabase → Project Settings → API. Nunca incluyas la `service_role` key en el navegador, el repositorio o Vercel. Sin URL y anon key, la interfaz muestra el aviso de configuración y no inventa datos.

## Preparar el proyecto Supabase existente

- Activa Email/Password en Authentication → Sign In / Providers y crea cada usuario desde Authentication → Users; la interfaz no tiene registro público.
- Agrega las URL del preview y del dominio de Vercel a Authentication → URL Configuration / Redirect URLs.
- Mantén RLS habilitado y crea políticas que autoricen las operaciones requeridas únicamente a usuarios autenticados/autorizados. El frontend utiliza la anon key.
- Las tablas que consume son `tasas_cambio`, `metodos_pago`, `insumos`, `movimientos_inventario`, `productos`, `ventas`, `venta_detalles`, `categorias_gastos`, `gastos` y `recetas`. No ejecuta migraciones ni recrea tablas.
- El SQL adjunto define `tasas_cambio(moneda_origen, moneda_destino, tasa, fecha)`, `metodos_pago(nombre, moneda, activo)`, `insumos(nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario, moneda_costo)`, `movimientos_inventario(insumo_id, tipo_movimiento, cantidad, costo_total, moneda, tasa_a_cop, motivo, fecha)` y `productos(nombre, precio_base, moneda_precio, activo)`.
- También define `ventas(fecha, total_original, moneda_pago, tasa_a_base, total_en_base, metodo_pago_id)`, `venta_detalles(venta_id, producto_id, cantidad INTEGER, precio_unitario, subtotal)`, `categorias_gastos(nombre, tipo)` y `gastos(concepto, categoria_id, monto_original, moneda, tasa_a_base, monto_en_base, fecha, metodo_pago_id, comprobante_url)`. El esquema no tiene `gastos.tipo`; esa clasificación procede de `categorias_gastos.tipo`.
- El catálogo edita `productos.precio_base` y conserva `moneda_precio`. Para vender convierte el precio de la moneda del producto a la moneda de pago con tasas hacia COP; el precio negociado sigue siendo editable.
- El nombre del bucket de Storage se controla con `VITE_SUPABASE_RECEIPTS_BUCKET` (por defecto `comprobantes`). Usa un bucket existente o crea uno con ese nombre; ajusta sus políticas de subida/lectura a los usuarios autorizados. Se aceptan JPG, PNG, WebP y GIF de hasta 5 MB. El registro de `gastos.comprobante_url` guarda la ruta del archivo; el panel solicita enlaces temporales al abrir comprobantes privados.
- Al crear/editar insumos se registra un movimiento con `insumo_id`, `tipo_movimiento`, `cantidad`, `costo_total`, `moneda`, `tasa_a_cop`, `fecha` y `motivo`; los tipos permitidos son `entrada`, `salida` y `ajuste`.
- Para convertir a COP se usa una fila de `tasas_cambio` con `moneda_destino = 'COP'`; el formulario toma la fecha más reciente y trata `tasa` como COP por unidad de `moneda_origen`. COP usa tasa 1.

El SQL compartido define los nombres y relaciones de columnas usados por las páginas; todavía deben verificarse en el proyecto vivo las políticas RLS, la configuración de Auth y el nombre/políticas del bucket. No se ejecuta DDL ni se recrean tablas. Las escrituras de una venta se hacen en `ventas` y luego en `venta_detalles`; los movimientos de inventario se escriben después de guardar el insumo. Son solicitudes separadas y no tienen rollback compartido: para atomicidad, configura funciones SQL/RPC en tu proyecto Supabase existente.

## Errores frecuentes

- `No API key found in request` no lo causa una columna del SQL: comprueba que `.env.local` esté en la raíz con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` completos, sin valores de ejemplo, y reinicia Vite. En Network puedes verificar que exista el encabezado `apikey` sin compartir su valor.
- El SQL define `productos.precio_base`, no `productos.precio`; esta versión del frontend ya usa el nombre correcto. Si vuelve a aparecer ese nombre en una petición, comprueba que el navegador esté ejecutando esta versión actualizada del proyecto.

## Despliegue en Vercel

1. Sube o conecta el repositorio del proyecto a tu cuenta de GitHub y selecciona **Vite** en Vercel.
2. Usa `pnpm build` como comando de build y `dist` como directorio de salida. `vercel.json` lleva las rutas SPA a `index.html`.
3. En Vercel → Settings → Environment Variables, agrega `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `VITE_SUPABASE_RECEIPTS_BUCKET` (si usas un bucket distinto de `comprobantes`) para Preview y Production.
4. Despliega; después añade el dominio definitivo a las URL autorizadas de Supabase Auth y prueba inicio/cierre de sesión, consultas, escritura y Storage con una cuenta permitida.

El logo proporcionado está en `public/images/LOGO002.webp`. Reemplaza ese archivo para usar una versión nueva; el comentario del componente `Brand` indica el punto de uso. Las fotos del negocio o de productos pueden guardarse en `public/images/` y añadirse con referencias en los componentes correspondientes.
