export const categorias = ['Hardware', 'Software', 'Redes', 'Accesos', 'Otro'];
export const prioridades = ['Baja', 'Media', 'Alta'];
export function validateSolicitud(body) {
  const errors = [];
  const data = {};
  for (const [key, max] of Object.entries({source_id:200,nombre:120,correo:254,categoria:30,prioridad:10,descripcion:4000})) {
    const value = typeof body?.[key] === 'string' ? body[key].trim() : '';
    if (!value || value.length > max) errors.push(`${key}: obligatorio, máximo ${max} caracteres`);
    data[key] = value;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.correo)) errors.push('correo: formato inválido');
  if (!categorias.includes(data.categoria)) errors.push('categoria: valor inválido');
  if (!prioridades.includes(data.prioridad)) errors.push('prioridad: valor inválido');
  return {data, errors};
}
