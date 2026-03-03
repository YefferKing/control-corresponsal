"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Swal from 'sweetalert2';
import { useRouter } from 'next/navigation';
import { Toast } from '@/lib/utils';
import Link from 'next/link';

export default function GestionPrestamos() {
  const [monto, setMonto] = useState('');
  const [tercero, setTercero] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [prestamos, setPrestamos] = useState<any[]>([]);
  const [sucursal, setSucursal] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [tercerosList, setTercerosList] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const router = useRouter();

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
      fetchPrestamos(profileData.sucursal_id);
      fetchTerceros(profileData.sucursal_id);
    }
  }

  async function fetchTerceros(sucursalId: string) {
    const { data } = await supabase
      .from('terceros')
      .select('*')
      .eq('sucursal_id', sucursalId)
      .order('nombre', { ascending: true });
    if (data) setTercerosList(data);
  }

  async function fetchPrestamos(sucursalId: string) {
    const { data, error } = await supabase
      .from('prestamos')
      .select('*')
      .eq('sucursal_id', sucursalId)
      .order('created_at', { ascending: false });

    if (!error) setPrestamos(data || []);
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

    if (!valorMonto || !tercero) {
      Toast.fire({ icon: 'error', title: 'Complete los campos obligatorios' });
      return;
    }

    // Si es edición, calculamos la diferencia para ajustar el cupo
    let diferenciaCupo = 0;
    if (isEditing && editId) {
      const prestamoOld = prestamos.find(p => p.id === editId);
      if (prestamoOld && prestamoOld.estado === 'pendiente') {
        diferenciaCupo = Number(prestamoOld.monto) - valorMonto;
      }
    } else {
      // Si es nuevo, el monto completo resta
      diferenciaCupo = -valorMonto;
    }

    // Validar efectivo (solo si estamos restando más dinero)
    if (diferenciaCupo < 0 && Math.abs(diferenciaCupo) > Number(sucursal.cupo_actual)) {
      Swal.fire('Efectivo Insuficiente', 'No hay suficiente dinero en caja para esta operación.', 'error');
      return;
    }

    const { isConfirmed } = await Swal.fire({
      title: isEditing ? '¿Guardar Cambios?' : '¿Registrar Préstamo?',
      text: isEditing 
        ? 'Se actualizará la información del préstamo.' 
        : `Se entregará $${valorMonto.toLocaleString()} a ${tercero}. Esta acción restará de su saldo actual.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, confirmar',
      cancelButtonText: 'Cancelar'
    });

    if (isConfirmed) {
      setLoading(true);
      try {
        if (isEditing && editId) {
          // --- ACTUALIZAR ---
          const { error: errorUpdate } = await supabase
            .from('prestamos')
            .update({
              monto: valorMonto,
              tercero_nombre: tercero,
              descripcion,
              fecha_vencimiento: fechaVencimiento || null
            })
            .eq('id', editId);

          if (errorUpdate) throw errorUpdate;
        } else {
          // --- CREAR ---
          const { error: errorInsert } = await supabase
            .from('prestamos')
            .insert([{
              sucursal_id: sucursal.id,
              usuario_id: profile.id,
              monto: valorMonto,
              tercero_nombre: tercero,
              descripcion,
              fecha_vencimiento: fechaVencimiento || null,
              estado: 'pendiente'
            }]);

          if (errorInsert) throw errorInsert;
        }

        // Actualizar Cupo si hubo cambios o es nuevo
        const nuevoCupo = Number(sucursal.cupo_actual) + diferenciaCupo;
        if (diferenciaCupo !== 0) {
          const { error: errorS } = await supabase
            .from('sucursales')
            .update({ cupo_actual: nuevoCupo })
            .eq('id', sucursal.id);

          if (errorS) throw errorS;
          setSucursal({ ...sucursal, cupo_actual: nuevoCupo });
          window.dispatchEvent(new Event('refreshSucursal'));
        }

        Toast.fire({ icon: 'success', title: isEditing ? 'Préstamo actualizado' : 'Préstamo registrado' });
        resetForm();
        fetchPrestamos(sucursal.id);

      } catch (error: any) {
        Swal.fire('Error', error.message, 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  const resetForm = () => {
    setMonto('');
    setTercero('');
    setSearchTerm('');
    setDescripcion('');
    setFechaVencimiento('');
    setIsEditing(false);
    setEditId(null);
  };

  const handleEdit = (p: any) => {
    if (p.estado === 'pagado') {
      Swal.fire('No permitido', 'Los préstamos pagados no se pueden editar.', 'info');
      return;
    }
    setEditId(p.id);
    setIsEditing(true);
    setMonto(new Intl.NumberFormat('es-CO').format(p.monto));
    setTercero(p.tercero_nombre);
    setSearchTerm(p.tercero_nombre);
    setDescripcion(p.descripcion || '');
    setFechaVencimiento(p.fecha_vencimiento || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (p: any) => {
    const result = await Swal.fire({
      title: '¿Eliminar registro?',
      text: p.estado === 'pendiente' 
        ? `Si eliminas este préstamo pendiente, se devolverán $${Number(p.monto).toLocaleString()} a tu caja.`
        : 'Este registro se eliminará permanentemente.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      setLoading(true);
      try {
        if (p.estado === 'pendiente') {
          const nuevoCupo = Number(sucursal.cupo_actual) + Number(p.monto);
          await supabase.from('sucursales').update({ cupo_actual: nuevoCupo }).eq('id', sucursal.id);
          setSucursal({ ...sucursal, cupo_actual: nuevoCupo });
          window.dispatchEvent(new Event('refreshSucursal'));
        }

        const { error } = await supabase.from('prestamos').delete().eq('id', p.id);
        if (error) throw error;

        Toast.fire({ icon: 'success', title: 'Préstamo eliminado' });
        fetchPrestamos(sucursal.id);
      } catch (error: any) {
        Swal.fire('Error', error.message, 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleMarcarPagado = async (prestamo: any) => {
    const { isConfirmed } = await Swal.fire({
      title: '¿Recibir pago de este préstamo?',
      text: `El monto de $${Number(prestamo.monto).toLocaleString()} regresará a su caja.`,
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: 'Sí, recibir pago',
      cancelButtonText: 'No'
    });

    if (isConfirmed) {
      setLoading(true);
      try {
        // 1. Marcar como pagado
        const { error: errorStatus } = await supabase
          .from('prestamos')
          .update({ estado: 'pagado' })
          .eq('id', prestamo.id);

        if (errorStatus) throw errorStatus;

        // 2. Regresar dinero al cupo
        const nuevoCupo = Number(sucursal.cupo_actual) + Number(prestamo.monto);
        const { error: errorCupo } = await supabase
          .from('sucursales')
          .update({ cupo_actual: nuevoCupo })
          .eq('id', sucursal.id);

        if (errorCupo) throw errorCupo;

        window.dispatchEvent(new Event('refreshSucursal'));
        Toast.fire({ icon: 'success', title: 'Pago recibido. Saldo actualizado.' });
        fetchPrestamos(sucursal.id);
        setSucursal({ ...sucursal, cupo_actual: nuevoCupo });

      } catch (error: any) {
        Swal.fire('Error', error.message, 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  if (loadingData) return <div className="p-5 text-center"><div className="spinner-border text-info"></div></div>;

  return (
    <div className="container py-4">
      <div className="row g-4">
        {/* Registro */}
        <div className="col-lg-4">
          <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
            <div className={`p-4 text-center ${isEditing ? 'bg-info' : 'bg-dark'}`}>
              <h3 className="text-white fw-bold mb-0 text-uppercase">
                {isEditing ? 'Editar Préstamo' : 'Prestar Dinero'}
              </h3>
              <p className="text-warning small mb-0 mt-1 opacity-75">
                {isEditing ? 'Modificando registro existente' : 'Control de préstamos a terceros'}
              </p>
            </div>
            <div className="card-body p-4">
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label small fw-bold text-muted">MONTO A PRESTAR</label>
                  <input type="text" className="form-control form-control-lg bg-light border-0 fw-bold" value={monto} onChange={handleMontoChange} placeholder="0" required />
                </div>
                <div className="mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <label className="form-label small fw-bold text-muted mb-0">SELECCIONAR TERCERO</label>
                    <Link href="/caja/terceros" className="small text-decoration-none fw-bold" style={{fontSize: '0.7rem'}}>+ Nuevo</Link>
                  </div>
                  <div className="position-relative">
                    <div className="input-group">
                      <span className="input-group-text bg-light border-0"><i className="bi bi-search small"></i></span>
                      <input 
                        type="text" 
                        className="form-control bg-light border-0 py-2 shadow-none" 
                        placeholder="Buscar nombre o ID..."
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          setShowDropdown(true);
                          if (!e.target.value) setTercero('');
                        }}
                        onFocus={() => setShowDropdown(true)}
                      />
                    </div>
                    
                    {showDropdown && (
                      <div className="dropdown-menu show w-100 shadow-lg border-0 mt-1 py-0 overflow-hidden" style={{maxHeight: '250px', overflowY: 'auto', zIndex: 1000}}>
                        {tercerosList
                          .filter(t => 
                            t.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (t.identificacion && t.identificacion.includes(searchTerm))
                          )
                          .map(t => (
                            <button 
                              key={t.id}
                              type="button"
                              className="dropdown-item py-2 px-3 border-bottom border-light"
                              onClick={() => {
                                setTercero(t.nombre);
                                setSearchTerm(t.nombre);
                                setShowDropdown(false);
                              }}
                            >
                              <div className="fw-bold text-dark small">{t.nombre}</div>
                              <div className="text-muted" style={{fontSize: '0.7rem'}}>
                                <i className="bi bi-person-vcard me-1"></i>{t.identificacion || 'Sin ID'} 
                                {t.telefono && <span className="ms-2"><i className="bi bi-telephone me-1"></i>{t.telefono}</span>}
                              </div>
                            </button>
                          ))
                        }
                        {searchTerm && tercerosList.filter(t => t.nombre.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                          <div className="p-3 text-center small text-muted">
                            No se encontraron resultados para "{searchTerm}"
                          </div>
                        )}
                        {tercerosList.length === 0 && (
                          <div className="p-3 text-center small text-muted">
                            El directorio está vacío
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Overlay invisible para cerrar el dropdown al hacer click fuera */}
                  {showDropdown && <div className="position-fixed top-0 start-0 w-100 h-100" style={{zIndex: 999}} onClick={() => setShowDropdown(false)}></div>}
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-bold text-muted">FECHA DE PAGO (ESTIMADO)</label>
                  <input type="date" className="form-control bg-light border-0" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} />
                </div>
                <div className="mb-4">
                  <label className="form-label small fw-bold text-muted">NOTA (OPCIONAL)</label>
                  <textarea className="form-control bg-light border-0" rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="¿Para qué es el préstamo?"></textarea>
                </div>
                <div className="d-flex gap-2 mb-2">
                  <button type="submit" className={`btn ${isEditing ? 'btn-info' : 'btn-dark'} w-100 py-3 rounded-3 fw-bold ${isEditing ? 'text-white' : 'text-warning'} shadow-sm`} disabled={loading}>
                    {loading ? 'Procesando...' : (isEditing ? 'GUARDAR CAMBIOS' : 'REGISTRAR PRÉSTAMO')}
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
               <h5 className="mb-0 fw-bold text-dark">Préstamos Realizados</h5>
             </div>
             <div className="table-responsive">
               <table className="table table-hover align-middle mb-0">
                 <thead className="bg-dark text-white small text-uppercase">
                   <tr>
                     <th className="ps-4">Tercero / Fecha</th>
                     <th className="text-end">Monto</th>
                     <th className="text-center">Estado</th>
                     <th className="text-center">Vencimiento</th>
                     <th className="pe-4 text-center">Acción</th>
                   </tr>
                 </thead>
                 <tbody>
                   {prestamos.length === 0 ? (
                     <tr><td colSpan={5} className="text-center py-5 text-muted italic">No hay registros de préstamos</td></tr>
                   ) : (
                     prestamos.map((p) => (
                       <tr key={p.id}>
                         <td className="ps-4">
                           <div className="fw-bold">{p.tercero_nombre}</div>
                           <div className="text-muted" style={{fontSize: '0.65rem'}}>{new Date(p.created_at).toLocaleDateString()}</div>
                         </td>
                         <td className="text-end fw-bold text-info">${Number(p.monto).toLocaleString()}</td>
                         <td className="text-center">
                           <span className={`badge rounded-pill ${p.estado === 'pagado' ? 'bg-success' : 'bg-warning text-dark'}`}>
                             {p.estado === 'pagado' ? 'PAGADO' : 'PENDIENTE'}
                           </span>
                         </td>
                         <td className="text-center small text-muted">
                           {p.fecha_vencimiento ? new Date(p.fecha_vencimiento).toLocaleDateString() : '---'}
                         </td>
                          <td className="pe-4 text-center">
                            <div className="d-flex align-items-center justify-content-center gap-2">
                              {p.estado === 'pendiente' && (
                                <>
                                  <button onClick={() => handleMarcarPagado(p)} className="btn btn-sm btn-success rounded-pill px-3 shadow-sm border-0">
                                    Pagado
                                  </button>
                                  <button onClick={() => handleEdit(p)} className="btn btn-sm btn-light border-0 text-primary p-0 bg-transparent" title="Editar">
                                    <i className="bi bi-pencil-square fs-5"></i>
                                  </button>
                                </>
                              )}
                              {p.estado === 'pagado' && <i className="bi bi-check-circle-fill text-success fs-5"></i>}
                              
                              <button onClick={() => handleDelete(p)} className="btn btn-sm btn-light border-0 text-danger p-0 bg-transparent" title="Eliminar">
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
