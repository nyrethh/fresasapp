# Resultados y criterios del proyecto

## Base, autenticación y navegación

- [x] Crear frontend con Vite + React + TypeScript, Tailwind CSS, React Router y `@supabase/supabase-js`; incluir estructura completa, configuración de Tailwind con la paleta y cliente en `src/lib/supabase.ts`.
- [ ] Conectar el cliente directamente al proyecto Supabase real con URL y anon key en variables de entorno, sin backend propio y sin recrear las tablas existentes. El código queda preparado; faltan las variables del proyecto.
- [x] Implementar login `/login` con email y contraseña vía Supabase Auth, sin registro público; mostrar errores amigables, conservar la sesión al recargar, proteger rutas y redirigir a `/login` si no hay sesión; incluir logout en el header.
- [x] Crear `AuthProvider` y componente `RutaProtegida`; usar idioma español de Venezuela, interfaz responsive mobile-first, layout con sidebar en escritorio o bottom-nav en móvil, cabecera con nombre del usuario y logout.
- [x] Usar el logo proporcionado en el acceso y la navegación, con comentario breve en minúsculas que indique dónde sustituirlo; añadir comentarios similares donde colocar imágenes.

## Dashboard

- [x] En `/dashboard` protegida, mostrar ventas totales del día/mes en COP, gastos del mes en COP, utilidad neta e insumos con stock bajo como alerta.
- [x] Mostrar gráfico simple de ventas de los últimos 7 días.
- [x] Ofrecer accesos rápidos para nueva venta, nuevo gasto y nuevo insumo.

## Insumos

- [x] En `/insumos` protegida, ofrecer CRUD con nombre, unidad, stock actual, stock mínimo y costo unitario.
- [x] Resaltar en rojo suave las filas con `stock_actual < stock_minimo`.
- [x] Incluir botón «Nuevo insumo» que abre un modal; ofrecer editar y eliminar con confirmación.
- [x] Al crear o editar un insumo, registrar el movimiento correspondiente en `movimientos_inventario`.

## Ventas

- [x] En `/ventas` protegida, ofrecer CRUD y formulario con selección de uno o más productos, cantidad entera de 1 o más conforme a `venta_detalles.cantidad INTEGER`, precio editable para descuentos, método de pago, moneda COP/VES/USD y tasa de cambio sugerida a partir de la última guardada.
- [x] Convertir el precio de catálogo interpretado en COP a la moneda elegida usando la tasa, calcular automáticamente el total en COP y guardar en cada transacción monto original, moneda y tasa al momento; guardar `ventas.total_original`, `moneda_pago`, `tasa_a_base`, `total_en_base`, `metodo_pago_id` y sus líneas en `venta_detalles`.
- [x] Mostrar historial filtrable por fecha, moneda y método de pago; cada venta permite expandir su detalle.

## Gastos

- [x] En `/gastos` protegida, ofrecer CRUD con concepto, categoría cargada desde `categorias_gastos`, monto, moneda, tasa de cambio, método de pago y fecha.
- [x] Permitir subir comprobante de imagen a Supabase Storage y relacionarlo con el gasto; validar JPG/PNG/WebP/GIF hasta 5 MB y limpiar el archivo al reemplazarlo, borrar el gasto o fallar el guardado.
- [x] Mostrar historial con filtros por mes, categoría y tipo operativo/servicios/activo; separar visualmente gastos operativos de activos.
- [x] Guardar en `gastos.monto_original`, `moneda`, `tasa_a_base`, `monto_en_base` y `categoria_id`.

## Productos

- [x] En `/productos` protegida, listar productos con nombre, precio y estado activo/inactivo.
- [x] Permitir edición inline del precio y activar/desactivar con un toggle.
- [x] Confirmar antes de eliminar y conservar los productos que ya estén referenciados en el historial de ventas.

## Experiencia, monedas y entrega

- [x] Crear componentes reutilizables Card, Button, Input, Select, Modal, Table, Badge y Alert; incluir skeletons, estados vacíos y toasts de éxito/error.
- [x] Validar formularios antes de enviar, confirmar antes de eliminar, formatear importes y mostrar fechas como dd/mm/yyyy.
- [x] Usar COP como moneda base de reportes y conservar monto original, moneda y tasa de cambio de cada transacción. Formatear con configuración es-VE: punto para miles, coma decimal; COP `$`, VES `Bs`, USD `US$`.
- [x] Respetar las tablas del SQL: `tasas_cambio` usa `moneda_origen`, `moneda_destino`, `tasa`, `fecha`; `insumos` usa `unidad_medida`, `stock_actual`, `stock_minimo`, `costo_unitario`, `moneda_costo`; `movimientos_inventario` usa `tipo_movimiento`, `cantidad`, `costo_total`, `moneda`, `tasa_a_cop`, `motivo`, `fecha`; `productos` usa `precio_base`, `moneda_precio`, `activo`; `ventas` usa `fecha`, `total_original`, `moneda_pago`, `tasa_a_base`, `total_en_base`, `metodo_pago_id`; `venta_detalles` usa `venta_id`, `producto_id`, `cantidad`, `precio_unitario`, `subtotal`; `categorias_gastos` usa `nombre`, `tipo`; `gastos` usa `concepto`, `categoria_id`, `monto_original`, `moneda`, `tasa_a_base`, `monto_en_base`, `fecha`, `metodo_pago_id`, `comprobante_url` y no incluye `tipo`.
- [x] Documentar instalación, variables Supabase, columnas/bucket/políticas que deben existir y pasos para build/despliegue en Vercel; proporcionar `.env.example` y fallback SPA.
- [x] Mantener código legible, tipado y mantenible; comentarios cortos en español y en minúsculas, sin espacios en blanco innecesarios.
- [ ] Verificar las políticas RLS, configuración de Auth y nombre/políticas del bucket contra el proyecto Supabase real y hacer una prueba integrada de Auth, CRUD y Storage cuando estén disponibles las variables de conexión. El SQL permitió alinear los nombres de columnas; las credenciales y la configuración del proyecto vivo siguen pendientes.
