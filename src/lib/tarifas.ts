export function calcularComision(monto: number, tipo: string, config?: any) : number {
  // Valores por defecto (Bancolombia Oficial)
  const defaultValues = {
    entrada_fija: 160,
    entrada_porcentaje: 0.0020, // 0.20%
    entrada_tope: 1600,
    salida_fija: 80,
    salida_porcentaje: 0.0010, // 0.10%
    salida_tope: 800
  };

  const c = config || defaultValues;

  // Normalizar porcentajes (por si vienen como 0.20 en lugar de 0.0020)
  const pEntrada = c.entrada_porcentaje > 1 ? c.entrada_porcentaje / 100 : c.entrada_porcentaje;
  const pSalida = c.salida_porcentaje > 1 ? c.salida_porcentaje / 100 : c.salida_porcentaje;

  if (tipo === 'consignacion' || tipo === 'pago') {
    if (monto <= 80000) return c.entrada_fija;
    if (monto >= 800000) return c.entrada_tope;
    return monto * pEntrada;
  } else if (tipo === 'retiro') {
    if (monto <= 80000) return c.salida_fija;
    if (monto >= 800000) return c.salida_tope;
    return monto * pSalida;
  }
  return 0;
}
