"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Swal from 'sweetalert2';
import { useRouter } from 'next/navigation';
import { calcularComision } from '@/lib/tarifas';
import { Toast } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';

export default function NuevaOperacion() {
  const router = useRouter();
  const { hasPermission, loading: permLoading } = usePermissions();

  const [tipo, setTipo] = useState<'consignacion' | 'retiro' | 'pago'>('consignacion');
  const [monto, setMonto] = useState('');
  const [loading, setLoading] = useState(false);
  const [sucursal, setSucursal] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [tarifasConfig, setTarifasConfig] = useState<any>(null);

  useEffect(() => {
    if (!permLoading && !hasPermission('realizar_consignacion') && !hasPermission('realizar_retiro') && !hasPermission('realizar_pago')) {
      Swal.fire('Acceso Denegado', 'No tienes permisos para realizar ninguna operación.', 'error');
      router.push('/dashboard');
    }
  }, [permLoading]);



  useEffect(() => {
    async function fetchData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const { data: profileData } = await supabase
        .from('perfiles')
        .select('*, sucursales(*)')
        .eq('id', session.user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        setSucursal(profileData.sucursales);

        // Cargar tarifas personalizadas
        const { data: config } = await supabase
          .from('tarifas_config')
          .select('valores')
          .eq('sucursal_id', profileData.sucursal_id)
          .single();
        
        if (config) setTarifasConfig(config.valores);
      }
    }
    fetchData();
  }, [router]);

  const formatN2 = (value: string) => {
    const numericValue = value.replace(/\D/g, "");
    if (!numericValue) return "";
    return new Intl.NumberFormat('es-CO').format(parseInt(numericValue));
  };

  const handleMontoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatN2(e.target.value);
    setMonto(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valorMonto = parseFloat(monto.replace(/\./g, ''));

    if (isNaN(valorMonto) || valorMonto <= 0) {
      Toast.fire({ icon: 'error', title: 'Ingrese un monto válido' });
      return;
    }

    const permisoNecesario = tipo === 'consignacion' ? 'realizar_consignacion' : (tipo === 'retiro' ? 'realizar_retiro' : 'realizar_pago');
    if (!hasPermission(permisoNecesario)) {
      Swal.fire('Acceso Denegado', `No tienes permisos para realizar ${tipo === 'pago' ? 'pagos' : (tipo === 'retiro' ? 'retiros' : 'consignaciones')}.`, 'error');
      return;
    }

    const comisionGenerada = calcularComision(valorMonto, tipo, tarifasConfig);
    let nuevoCupo = sucursal.cupo_actual;
    
    if (tipo === 'consignacion' || tipo === 'pago') {
      // ENTRADA: El dinero entra a mi caja (Suma al saldo)
      // El usuario solicitó quitar la validación de capacidad (Cupo digital)
      // Aunque supere el "Tope", se permite porque "Todo eso es plata del banco"
      nuevoCupo = Number(sucursal.cupo_actual) + valorMonto;
    } else if (tipo === 'retiro') {
      // SALIDA: El dinero sale de mi caja (Resta del saldo)
      // No puedo entregar plata que no tengo físicamente en mi saldo operativo (plata del banco)
      if (valorMonto > Number(sucursal.cupo_actual)) {
        Swal.fire({
          icon: 'error',
          title: 'Efectivo Insuficiente en Caja',
          text: `No tienes suficiente plata del banco en caja para entregar $${valorMonto.toLocaleString()}. Tu saldo físico actual es de $${Number(sucursal.cupo_actual).toLocaleString()}.`,
          confirmButtonColor: '#ffdd00'
        });
        return;
      }
      nuevoCupo = Number(sucursal.cupo_actual) - valorMonto;
    }

    setLoading(true);

    try {
      // 1. Registrar la transacción
      const { error: transError } = await supabase
        .from('transacciones')
        .insert([{
          sucursal_id: sucursal.id,
          usuario_id: profile.id,
          monto: valorMonto,
          tipo: tipo,
          comision: comisionGenerada,
          estado: 'aprobada'
        }]);

      if (transError) throw transError;

      // 2. Actualizar el cupo de la sucursal
      const { error: sucursalError } = await supabase
        .from('sucursales')
        .update({ cupo_actual: nuevoCupo })
        .eq('id', sucursal.id);

      if (sucursalError) throw sucursalError;

      // 3. Notificar a toda la plataforma del cambio de cupo
      window.dispatchEvent(new Event('refreshSucursal'));

      Toast.fire({
        icon: 'success',
        title: '¡Operación Exitosa!'
      });

      router.push('/dashboard');
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message,
        confirmButtonColor: '#ffdd00'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!sucursal) return <div className="p-5 text-center"><div className="spinner-border text-warning"></div></div>;

  return (
    <div className="container py-4">
      <div className="row justify-content-center">
        <div className="col-lg-6">
          <div className="card border-0 shadow-lg rounded-4 overflow-hidden">
            <div className="bg-dark p-4 text-center">
              <h3 className="text-white fw-bold mb-0">Nueva Transacción</h3>
              <p className="text-warning small mb-0 mt-1">{sucursal.nombre} - Código: {sucursal.codigo_punto}</p>
            </div>
            
            <div className="card-body p-4 bg-white">
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="form-label small fw-bold text-muted text-uppercase">Tipo de Operación</label>
                  <div className="row g-2 align-items-stretch">
                    <div className="col-6">
                      <input type="radio" className="btn-check" name="tipo" id="consignacion" checked={tipo === 'consignacion'} onChange={() => setTipo('consignacion')} />
                      <label className="btn btn-outline-warning w-100 h-100 py-3 fw-bold d-flex flex-column align-items-center justify-content-center" htmlFor="consignacion" style={{fontSize: '1rem'}}>
                        <i className="bi bi-box-arrow-in-down d-block fs-2 mb-1"></i>
                        Entrada
                      </label>
                    </div>
                    <div className="col-6">
                      <input type="radio" className="btn-check" name="tipo" id="retiro" checked={tipo === 'retiro'} onChange={() => setTipo('retiro')} />
                      <label className="btn btn-outline-warning w-100 h-100 py-3 fw-bold d-flex flex-column align-items-center justify-content-center" htmlFor="retiro" style={{fontSize: '1rem'}}>
                        <i className="bi bi-box-arrow-up d-block fs-2 mb-1"></i>
                        Salida
                      </label>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="form-label small fw-bold text-muted text-uppercase">Monto de la Operación</label>
                  <div className="input-group input-group-lg shadow-sm">
                    <span className="input-group-text bg-light border-0 fw-bold">$</span>
                    <input 
                      type="text" 
                      className="form-control border-0 bg-light" 
                      placeholder="0"
                      value={monto} 
                      onChange={handleMontoChange}
                      required 
                    />
                  </div>
                  <div className="form-text mt-2 d-flex flex-column gap-1">
                    <div className="d-flex flex-column flex-md-row justify-content-between gap-1 gap-md-2">
                      <span className="text-muted small">Cupo Disponible: <strong className="text-dark">${Number(sucursal.cupo_limite - sucursal.cupo_actual).toLocaleString('es-CO', { minimumFractionDigits: 0 })}</strong></span>
                      <span className="text-muted small">Saldo en Caja: <strong className="text-dark">${Number(sucursal.cupo_actual).toLocaleString('es-CO', { minimumFractionDigits: 0 })}</strong></span>
                    </div>
                  </div>
                </div>

                {monto && (
                  <div className="p-3 rounded-3 border bg-light mb-4 shadow-sm" style={{borderLeftWidth: '5px', borderLeftColor: '#ffdd00'}}>
                    <div className="d-flex align-items-center gap-2 fw-bold small text-dark">
                      <i className={`bi ${tipo === 'retiro' ? 'bi-cash-stack' : 'bi-box-arrow-in-down'} text-warning fs-5`}></i>
                      FLUJO DE DINERO:
                    </div>
                    <p className="small mb-0 mt-1 text-dark" style={{fontSize: '0.85rem'}}>
                      {tipo === 'retiro' 
                        ? `Usted ENTREGA $${monto} en efectivo al cliente. Su saldo en el sistema se descuenta físicamente pero se mantiene el registro del tope.` 
                        : `Usted RECIBE $${monto} en efectivo del cliente. Su saldo de efectivo en caja aumenta inmediatamente.`}
                    </p>
                  </div>
                )}

                <div className="alert alert-dark border-0 small rounded-4 mb-4 shadow-sm bg-dark text-white p-3">
                  <div className="d-flex align-items-center gap-2">
                    <i className="bi bi-exclamation-triangle-fill text-warning fs-5"></i>
                    <span className="fw-bold">AVISO IMPORTANTE:</span>
                  </div>
                  <p className="mb-0 mt-1 opacity-75">
                    Verifique los datos antes de procesar. Esta acción afectará su saldo de caja en el sistema.
                  </p>
                </div>

                <button 
                  type="submit" 
                  className={`btn btn-warning btn-lg w-100 py-3 fw-bold text-dark shadow-sm rounded-3 ${loading ? 'disabled' : ''}`}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Procesando...
                    </>
                  ) : 'Confirmar Operación'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
