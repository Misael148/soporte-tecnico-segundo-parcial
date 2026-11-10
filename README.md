# Sistema automatizado de gestión de solicitudes

Proyecto de segundo parcial de Programación en ambiente cliente servidor.

## Objetivo

Capturar solicitudes de soporte técnico en Google Forms, conservar las respuestas en Google Sheets, procesarlas con n8n, registrarlas mediante una API REST en PostgreSQL (Neon), generar un folio y notificar por Gmail. La API se ejecuta en Render.

## Arquitectura

Google Forms → Google Sheets → n8n → API Express en Render → PostgreSQL en Neon.
Después de registrar una solicitud: n8n → Gmail. El dashboard de Sheets cuenta las respuestas por categoría y prioridad.

## Instalación local

Requiere Node.js 22.16 o posterior y PostgreSQL accesible.

1. Ejecutar `npm ci --ignore-scripts`.
2. Copiar `.env.example` como `.env` y configurar `DATABASE_URL` y `API_KEY` (mínimo 32 caracteres). No publicar `.env`.
3. Ejecutar `npm test` y `npm start`.
4. Abrir `http://localhost:3000/health`.

Al arrancar se crea la tabla mediante `schema.sql`, si no existe. Los valores de las consultas se envían mediante parámetros para evitar inyección SQL. La conexión de Neon utiliza TLS; conservar `sslmode=verify-full` en su URL.

## API REST

Las rutas `/api` requieren la cabecera `X-API-Key`. Las rutas `/` y `/health` no muestran datos personales.

| Método | Ruta | Resultado |
| --- | --- | --- |
| GET | /health | Comprueba la conexión a PostgreSQL |
| POST | /api/solicitudes | Registra y asigna un folio |
| GET | /api/solicitudes?page=1&limit=25 | Consulta paginada; filtros opcionales categoria y prioridad |
| GET | /api/solicitudes/ST-000001 | Busca una solicitud por folio |
| GET | /api/dashboard | Total y conteos por categoría y prioridad |

Ejemplo del cuerpo de registro:

```json
{
  "source_id": "ID_HOJA:ID_PESTANA:NUMERO_FILA",
  "nombre": "Usuario de prueba",
  "correo": "prueba@example.com",
  "categoria": "Redes",
  "prioridad": "Alta",
  "descripcion": "No hay conexión en el laboratorio"
}
```

Categorías: Hardware, Software, Redes, Accesos, Otro. Prioridades: Baja, Media, Alta.

El folio se deriva del identificador secuencial de PostgreSQL, con formato `ST-000001`. Puede haber saltos en la secuencia; no representan registros perdidos. `source_id` identifica una respuesta de origen de forma única. El primer registro devuelve HTTP 201; repetir el mismo cuerpo devuelve HTTP 200 y `created:false` sin duplicarlo. Reutilizar el mismo identificador con contenido diferente devuelve HTTP 409.

Errores: 400 datos inválidos, 401 clave incorrecta, 404 folio inexistente, 409 conflicto y 503 servicio o base de datos no disponibles. El límite del cuerpo JSON es 32 KB.

## Despliegue en Render

Usar el repositorio del proyecto y runtime Node. Plan Free, compilación `npm ci --ignore-scripts` e inicio `npm start`. Configurar `DATABASE_URL` con la conexión de Neon y `API_KEY` con una clave aleatoria. Se incluye `render.yaml` como alternativa de configuración mediante Blueprint. Guardar los secretos como variables del servicio, nunca en GitHub.

## Formulario y hoja

Crear las preguntas obligatorias Nombre, Correo, Categoría, Prioridad y Descripción. Correo debe validar formato de dirección de correo electrónico. Categoría y Prioridad deben utilizar las opciones exactas indicadas arriba. Vincular las respuestas a una hoja nueva. No ordenar ni eliminar filas de la pestaña de respuestas si se usa el número de fila como identificador; las vistas de análisis van en otra pestaña.

## Automatización y correos

El flujo de n8n debe detectar nuevas respuestas, mapear los campos, crear un identificador de origen estable y llamar a `POST /api/solicitudes` con una credencial de cabecera. Usar Gmail OAuth para enviar el folio al correo de la respuesta. Mantener el flujo inactivo hasta haber configurado las credenciales y completado una prueba autorizada con un correo del responsable.

No reintentar automáticamente el nodo Gmail si se desconoce si el envío anterior ocurrió. La idempotencia de la API evita registros duplicados, pero por sí sola no garantiza que Gmail envíe exactamente una vez. Ante un error de correo, verificar Enviados antes de repetir ese paso. Si el flujo se detiene después de registrar la solicitud, la solicitud permanece en Neon.

## Dashboard de Google Sheets

Agregar una pestaña Dashboard con el total de solicitudes y tablas de conteos por categoría y prioridad. Usar las respuestas como origen de las fórmulas y gráficos. Incluir un gráfico de barras para categorías y uno circular para prioridades. El total de este dashboard representa respuestas capturadas; puede diferir temporalmente del total registrado en la API mientras se procesan filas o se corrige un error.

## Pruebas

`npm test` comprueba autenticación, validación de correo y categoría, folio, registro repetido, conflicto por identificador, paginación inválida, folio inexistente y JSON mal formado. Estas pruebas usan un repositorio simulado: no sustituyen la prueba de integración con Neon y los servicios desplegados.

Para la aceptación integral: enviar una respuesta de prueba, verificar un solo registro en Neon, consultar su folio por la API, comprobar el correo en Gmail y confirmar los tres indicadores y gráficos del dashboard. Conservar capturas reales de cada resultado.

## Referencias

- https://render.com/docs/deploy-node-express-app
- https://node-postgres.com/features/ssl
- https://docs.n8n.io/integrations/builtin/trigger-nodes/n8n-nodes-base.googlesheetstrigger/
- https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.gmail/

## Estado

El código y la configuración son entregables del proyecto. Ver `ESTADO.md` para distinguir recursos creados, pruebas realizadas y configuración aún pendiente.
