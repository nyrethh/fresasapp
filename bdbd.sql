-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.monedas (
  codigo character varying NOT NULL,
  nombre character varying NOT NULL,
  simbolo character varying NOT NULL,
  decimales smallint NOT NULL DEFAULT 2,
  activa boolean NOT NULL DEFAULT true,
  CONSTRAINT monedas_pkey PRIMARY KEY (codigo)
);
CREATE TABLE public.tasas_cambio (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  moneda_origen character varying NOT NULL,
  moneda_destino character varying NOT NULL DEFAULT 'COP'::character varying,
  tasa numeric NOT NULL,
  fuente character varying,
  vigente_desde timestamp with time zone NOT NULL DEFAULT now(),
  vigente_hasta timestamp with time zone,
  creado_por character varying,
  CONSTRAINT tasas_cambio_pkey PRIMARY KEY (id),
  CONSTRAINT tasas_cambio_moneda_origen_fkey FOREIGN KEY (moneda_origen) REFERENCES public.monedas(codigo),
  CONSTRAINT tasas_cambio_moneda_destino_fkey FOREIGN KEY (moneda_destino) REFERENCES public.monedas(codigo)
);
CREATE TABLE public.metodos_pago (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  nombre character varying NOT NULL UNIQUE,
  moneda character varying,
  tipo character varying,
  comision_pct numeric DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  CONSTRAINT metodos_pago_pkey PRIMARY KEY (id),
  CONSTRAINT metodos_pago_moneda_fkey FOREIGN KEY (moneda) REFERENCES public.monedas(codigo)
);
CREATE TABLE public.insumos (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  nombre character varying NOT NULL,
  unidad_medida character varying NOT NULL,
  stock_actual numeric DEFAULT 0,
  stock_minimo numeric DEFAULT 0,
  costo_unitario numeric DEFAULT 0,
  moneda_costo character varying DEFAULT 'COP'::character varying,
  creado_en timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT insumos_pkey PRIMARY KEY (id),
  CONSTRAINT insumos_moneda_costo_fkey FOREIGN KEY (moneda_costo) REFERENCES public.monedas(codigo)
);
CREATE TABLE public.movimientos_inventario (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  insumo_id bigint,
  tipo_movimiento character varying NOT NULL CHECK (tipo_movimiento::text = ANY (ARRAY['entrada'::character varying, 'salida'::character varying, 'ajuste'::character varying]::text[])),
  cantidad numeric NOT NULL,
  costo_total numeric,
  moneda character varying DEFAULT 'COP'::character varying,
  tasa_a_cop numeric,
  motivo text,
  fecha timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT movimientos_inventario_pkey PRIMARY KEY (id),
  CONSTRAINT movimientos_inventario_insumo_id_fkey FOREIGN KEY (insumo_id) REFERENCES public.insumos(id),
  CONSTRAINT movimientos_inventario_moneda_fkey FOREIGN KEY (moneda) REFERENCES public.monedas(codigo)
);
CREATE TABLE public.categorias (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  nombre character varying NOT NULL UNIQUE,
  tipo character varying NOT NULL CHECK (tipo::text = ANY (ARRAY['servicio'::character varying, 'producto'::character varying, 'mixto'::character varying]::text[])),
  CONSTRAINT categorias_pkey PRIMARY KEY (id)
);
CREATE TABLE public.servicios (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  nombre character varying NOT NULL,
  categoria_id bigint,
  precio_base numeric NOT NULL,
  moneda_precio character varying DEFAULT 'COP'::character varying,
  duracion_min integer,
  activo boolean NOT NULL DEFAULT true,
  creado_en timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT servicios_pkey PRIMARY KEY (id),
  CONSTRAINT servicios_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias(id),
  CONSTRAINT servicios_moneda_precio_fkey FOREIGN KEY (moneda_precio) REFERENCES public.monedas(codigo)
);
CREATE TABLE public.productos (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  nombre character varying NOT NULL,
  categoria_id bigint,
  precio_base numeric NOT NULL,
  moneda_precio character varying DEFAULT 'COP'::character varying,
  stock_actual numeric DEFAULT 0,
  stock_minimo numeric DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  creado_en timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT productos_pkey PRIMARY KEY (id),
  CONSTRAINT productos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias(id),
  CONSTRAINT productos_moneda_precio_fkey FOREIGN KEY (moneda_precio) REFERENCES public.monedas(codigo)
);
CREATE TABLE public.recetas (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  servicio_id bigint NOT NULL,
  insumo_id bigint NOT NULL,
  cantidad numeric NOT NULL,
  CONSTRAINT recetas_pkey PRIMARY KEY (id),
  CONSTRAINT recetas_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES public.servicios(id),
  CONSTRAINT recetas_insumo_id_fkey FOREIGN KEY (insumo_id) REFERENCES public.insumos(id)
);
CREATE TABLE public.ventas (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  numero_factura character varying UNIQUE,
  fecha timestamp with time zone NOT NULL DEFAULT now(),
  cliente_nombre character varying,
  cliente_telefono character varying,
  total_en_base numeric NOT NULL,
  moneda_base character varying NOT NULL DEFAULT 'COP'::character varying,
  estado character varying NOT NULL DEFAULT 'pagada'::character varying CHECK (estado::text = ANY (ARRAY['pendiente'::character varying, 'pagada'::character varying, 'anulada'::character varying, 'parcial'::character varying]::text[])),
  notas text,
  CONSTRAINT ventas_pkey PRIMARY KEY (id),
  CONSTRAINT ventas_moneda_base_fkey FOREIGN KEY (moneda_base) REFERENCES public.monedas(codigo)
);
CREATE TABLE public.venta_detalles (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  venta_id bigint NOT NULL,
  tipo_item character varying NOT NULL CHECK (tipo_item::text = ANY (ARRAY['servicio'::character varying, 'producto'::character varying]::text[])),
  servicio_id bigint,
  producto_id bigint,
  descripcion character varying NOT NULL,
  cantidad numeric NOT NULL DEFAULT 1,
  precio_unitario numeric NOT NULL,
  moneda_precio character varying NOT NULL DEFAULT 'COP'::character varying,
  tasa_a_cop numeric,
  subtotal_cop numeric NOT NULL,
  CONSTRAINT venta_detalles_pkey PRIMARY KEY (id),
  CONSTRAINT venta_detalles_venta_id_fkey FOREIGN KEY (venta_id) REFERENCES public.ventas(id),
  CONSTRAINT venta_detalles_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES public.servicios(id),
  CONSTRAINT venta_detalles_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id),
  CONSTRAINT venta_detalles_moneda_precio_fkey FOREIGN KEY (moneda_precio) REFERENCES public.monedas(codigo)
);
CREATE TABLE public.pagos_venta (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  venta_id bigint NOT NULL,
  metodo_pago_id bigint NOT NULL,
  monto_original numeric NOT NULL,
  moneda character varying NOT NULL,
  tasa_a_cop numeric NOT NULL,
  monto_en_cop numeric NOT NULL,
  referencia character varying,
  fecha timestamp with time zone NOT NULL DEFAULT now(),
  notas text,
  CONSTRAINT pagos_venta_pkey PRIMARY KEY (id),
  CONSTRAINT pagos_venta_venta_id_fkey FOREIGN KEY (venta_id) REFERENCES public.ventas(id),
  CONSTRAINT pagos_venta_metodo_pago_id_fkey FOREIGN KEY (metodo_pago_id) REFERENCES public.metodos_pago(id),
  CONSTRAINT pagos_venta_moneda_fkey FOREIGN KEY (moneda) REFERENCES public.monedas(codigo)
);
CREATE TABLE public.categorias_gastos (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  nombre character varying NOT NULL UNIQUE,
  tipo character varying DEFAULT 'operativo'::character varying,
  CONSTRAINT categorias_gastos_pkey PRIMARY KEY (id)
);
CREATE TABLE public.gastos (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  concepto character varying NOT NULL,
  categoria_id bigint,
  monto_original numeric NOT NULL,
  moneda character varying NOT NULL DEFAULT 'COP'::character varying,
  tasa_a_cop numeric,
  monto_en_base numeric,
  fecha date DEFAULT CURRENT_DATE,
  metodo_pago_id bigint,
  comprobante_url text,
  notas text,
  CONSTRAINT gastos_pkey PRIMARY KEY (id),
  CONSTRAINT gastos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias_gastos(id),
  CONSTRAINT gastos_moneda_fkey FOREIGN KEY (moneda) REFERENCES public.monedas(codigo),
  CONSTRAINT gastos_metodo_pago_id_fkey FOREIGN KEY (metodo_pago_id) REFERENCES public.metodos_pago(id)
);