"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Swal from 'sweetalert2';
import { useRouter } from 'next/navigation';
import { Toast } from '@/lib/utils';

import { usePermissions } from '@/hooks/usePermissions';

export default function GestionCuentasPorPagar() {
  const router = useRouter();
  const { hasPermission, loading: permLoading } = usePermissions();

  useEffect(() => {
    if (!permLoading && !hasPermission('gestionar_cuentas_pagar')) {
      Swal.fire('Acceso Denegado', 'No tienes permisos para gestionar cuentas por pagar.', 'error');
      router.push('/dashboard');
    }
  }, [permLoading]);
  const [monto, setMonto] = useState('');
  const [acreedor, setAcreedor] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [cuentas, setCuentas] = useState<any[]>([]);
  const [sucursal, setSucursal] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  async function fetchInitialData() {
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
      fetchCuentas(profileData.sucursal_id);
    }
  }

  async function fetchCuentas(sucursalId: string) {
    const { data, error } = await supabase
      .from('cuentas_por_pagar')
      .select('*')
      .eq('sucursal_id', sucursalId)
      .order('created_at', { ascending: false });

    if (!error) setCuentas(data || []);
    setLoadingData(false);
  }

  const handleMontoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "");
    if (!val) { setMonto(""); return; }
    setMonto(new Intl.NumberFormat('es-CO').format(parseInt(val)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valorMonto = parseFloat(monto.replace(/\./g, ''));

    if (!valorMonto || !acreedor) {
      Toast.fire({ icon: 'error', title: 'Complete los campos obligatorios' });
      return;
    }

    setLoading(true);
    try {
      if (isEditing && editId) {
        // ACTUALIZAR
        const { error: errorUpdate } = await supabase
          .from('cuentas_por_pagar')
          .update({
            monto: valorMonto,
            acreedor_nombre: acreedor,
            descripcion,
            fecha_vencimiento: fechaVencimiento || null
          })
          .eq('id', editId);
        if (errorUpdate) throw errorUpdate;
      } else {
        // CREAR
        const { error: errorInsert } = await supabase
          .from('cuentas_por_pagar')
          .insert([{
            sucursal_id: sucursal.id,
            usuario_id: profile.id,
            monto: valorMonto,
            acreedor_nombre: acreedor,
            descripcion,
            fecha_vencimiento: fechaVencimiento || null,
            estado: 'pendiente'
          }]);
        if (errorInsert) throw errorInsert;
      }

      Toast.fire({ icon: 'success', title: isEditing ? 'Cuenta actualizada' : 'Cuenta por pagar registrada' });
      resetForm();
      fetchCuentas(sucursal.id);
    } catch (error: any) {
      Swal.fire('Error', error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setMonto('');
    setAcreedor('');
    setDescripcion('');
    setFechaVencimiento('');
    setIsEditing(false);
    setEditId(null);
  };

  const handleEdit = (c: any) => {
    if (c.estado === 'pagado') {
      Swal.fire('No permitido', 'Las cuentas ya pagadas no se pueden editar.', 'info');
      return;
    }
    setIsEditing(true);
    setEditId(c.id);
    setMonto(new Intl.NumberFormat('es-CO').format(c.monto));
    setAcreedor(c.acreedor_nombre);
    setDescripcion(c.descripcion || '');
    setFechaVencimiento(c.fecha_vencimiento || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string, estado: string) => {
    const result = await Swal.fire({
      title: '¿Eliminar registro?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      setLoading(true);
      try {
        const { error } = await supabase.from('cuentas_por_pagar').delete().eq('id', id);
        if (error) throw error;
        Toast.fire({ icon: 'success', title: 'Registro eliminado' });
        fetchCuentas(sucursal.id);
      } catch (error: any) {
        Swal.fire('Error', error.message, 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  const handlePagarCuenta = async (cuenta: any) => {
    const { isConfirmed } = await Swal.fire({
      title: '¿Pagar esta cuenta ahora?',
      text: `Se descontarán $${Number(cuenta.monto).toLocaleString()} de su efectivo actual para realizar el pago a ${cuenta.acreedor_nombre}.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, pagar ahora',
      cancelButtonText: 'Cancelar'
    });

    if (isConfirmed) {
      // Validar si hay dinero suficiente
      if (Number(cuenta.monto) > Number(sucursal.cupo_actual)) {
        Swal.fire('Efectivo Insuficiente', 'No tiene suficiente dinero en caja para realizar este pago.', 'error');
        return;
      }

      setLoading(true);
      try {
        // 1. Marcar como pagado
        const { error: errorS } = await supabase
          .from('cuentas_por_pagar')
          .update({ estado: 'pagado' })
          .eq('id', cuenta.id);

        if (errorS) throw errorS;

        // 2. Descontar de caja (Esto se convierte en un gasto real hoy)
        const nuevoCupo = Number(sucursal.cupo_actual) - Number(cuenta.monto);
        const { error: errorC } = await supabase
          .from('sucursales')
          .update({ cupo_actual: nuevoCupo })
          .eq('id', sucursal.id);

        if (errorC) throw errorC;

        // 3. Registrar como gasto también para trazabilidad operativa (opcional)
        await supabase.from('gastos').insert([{
           sucursal_id: sucursal.id,
           usuario_id: profile.id,
           monto: cuenta.monto,
           categoria: 'Otros',
           descripcion: `Pago de deuda a ${cuenta.acreedor_nombre}: ${cuenta.descripcion || ''}`
        }]);

        window.dispatchEvent(new Event('refreshSucursal'));
        Toast.fire({ icon: 'success', title: 'Pago realizado con éxito.' });
        fetchCuentas(sucursal.id);
        setSucursal({ ...sucursal, cupo_actual: nuevoCupo });

      } catch (error: any) {
        Swal.fire('Error', error.message, 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  if (loadingData) return <div className="p-5 text-center"><div className="spinner-border text-danger"></div></div>;

  return (
    <div className="container py-4">
      <div className="row g-4">
        {/* Registro */}
        <div className="col-lg-4">
          <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
            <div className={`p-4 text-center ${isEditing ? 'bg-info' : 'bg-dark'}`}>
              <h3 className="text-white fw-bold mb-0 text-uppercase">
                {isEditing ? 'Editar Cuenta' : 'Cuentas por Pagar'}
              </h3>
              <p className="text-warning small mb-0 mt-1 opacity-75">
                {isEditing ? 'Modificando deuda pendiente' : 'Control de deudas pendientes'}
              </p>
            </div>
            <div className="card-body p-4">
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label small fw-bold text-muted">MONTO DEUDA</label>
                  <input type="text" className="form-control form-control-lg bg-light border-0 fw-bold" value={monto} onChange={handleMontoChange} placeholder="0" required />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-bold text-muted">A NOMBRE DE (ACREEDOR)</label>
                  <input type="text" className="form-control bg-light border-0" value={acreedor} onChange={(e) => setAcreedor(e.target.value)} placeholder="Ej: Proveedor de Internet" required />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-bold text-muted">FECHA DE VENCIMIENTO</label>
                  <input type="date" className="form-control bg-light border-0" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} />
                </div>
                <div className="mb-4">
                  <label className="form-label small fw-bold text-muted">DESCRIPCIÓN (OPCIONAL)</label>
                  <textarea className="form-control bg-light border-0" rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="¿De qué es esta cuenta?"></textarea>
                </div>
                <div className="d-flex gap-2">
                  <button type="submit" className={`btn ${isEditing ? 'btn-info text-white' : 'btn-dark text-warning'} w-100 py-3 rounded-3 fw-bold shadow-sm`} disabled={loading}>
                     {loading ? 'Procesando...' : (isEditing ? 'GUARDAR CAMBIOS' : 'REGISTRAR DEUDA')}
                  </button>
                  {isEditing && (
                    <button type="button" className="btn btn-light border px-3" onClick={resetForm}>
                      <i className="bi bi-x-lg"></i>
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Listado */}
        <div className="col-lg-8">
          <div className="card border-0 shadow-sm rounded-4 overflow-hidden h-100">
             <div className="card-header bg-white py-3 px-4 border-0">
               <h5 className="mb-0 fw-bold text-dark text-uppercase">Pendientes por Pagar</h5>
             </div>
             <div className="table-responsive">
               <table className="table table-hover align-middle mb-0">
                 <thead className="bg-dark text-white small text-uppercase">
                   <tr>
                     <th className="ps-4">Acreedor / Fecha</th>
                     <th className="text-end">Monto</th>
                     <th className="text-center">Estado</th>
                     <th className="text-center">Vencimiento</th>
                     <th className="pe-4 text-center">Acción</th>
                   </tr>
                 </thead>
                 <tbody>
                   {cuentas.length === 0 ? (
                     <tr><td colSpan={5} className="text-center py-5 text-muted italic">No hay cuentas pendientes por pagar</td></tr>
                   ) : (
                     cuentas.map((c) => (
                       <tr key={c.id}>
                         <td className="ps-4">
                           <div className="fw-bold">{c.acreedor_nombre}</div>
                           <div className="text-muted" style={{fontSize: '0.65rem'}}>{new Date(c.created_at).toLocaleDateString()}</div>
                         </td>
                         <td className="text-end fw-bold text-danger">${Number(c.monto).toLocaleString()}</td>
                         <td className="text-center">
                           <span className={`badge rounded-pill ${c.estado === 'pagado' ? 'bg-success' : 'bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25'}`}>
                             {c.estado === 'pagado' ? 'PAGADO' : 'PENDIENTE'}
                           </span>
                         </td>
                         <td className="text-center small text-muted">
                           {c.fecha_vencimiento ? new Date(c.fecha_vencimiento).toLocaleDateString() : '---'}
                         </td>
                          <td className="pe-4 text-center">
                            <div className="d-flex align-items-center justify-content-center gap-2">
                              {c.estado === 'pendiente' && (
                                <>
                                  <button onClick={() => handlePagarCuenta(c)} className="btn btn-sm btn-outline-danger rounded-pill px-3 fw-bold shadow-sm">
                                    Pagar Ahora
                                  </button>
                                  <button onClick={() => handleEdit(c)} className="btn btn-sm btn-light border-0 text-primary p-0 bg-transparent">
                                    <i className="bi bi-pencil-square fs-5"></i>
                                  </button>
                                </>
                              )}
                              {c.estado === 'pagado' && <i className="bi bi-shield-check text-success fs-5"></i>}
                              
                              <button onClick={() => handleDelete(c.id, c.estado)} className="btn btn-sm btn-light border-0 text-danger p-0 bg-transparent">
                                <i className="bi bi-trash fs-5"></i>
                              </button>
                            </div>
                          </td>
                       </tr>
                     ))
                   )}
                 </tbody>
               </table>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
