CREATE TABLE IF NOT EXISTS solicitudes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id VARCHAR(200) NOT NULL UNIQUE,
  nombre VARCHAR(120) NOT NULL,
  correo VARCHAR(254) NOT NULL,
  categoria VARCHAR(30) NOT NULL CHECK (categoria IN ('Hardware','Software','Redes','Accesos','Otro')),
  prioridad VARCHAR(10) NOT NULL CHECK (prioridad IN ('Baja','Media','Alta')),
  descripcion VARCHAR(4000) NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente','En proceso','Resuelta')),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS solicitudes_fecha_idx ON solicitudes (creado_en DESC);
