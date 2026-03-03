"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Swal from 'sweetalert2';
import { useRouter } from 'next/navigation';
import { Toast } from '@/lib/utils';
import Link from 'next/link';

export default function GestionGastos() {
  const [monto, setMonto] = useState('');
  const [categoria, setCategoria] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [gastos, setGastos] = useState<any[]>([]);
  const [sucursal, setSucursal] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
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
      fetchGastos(profileData.sucursal_id);
    }
  }

  async function fetchGastos(sucursalId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('gastos')
      .select('*')
      .eq('sucursal_id', sucursalId)
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false });

    if (!error) setGastos(data || []);
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

    if (!valorMonto || !categoria) {
      Toast.fire({ icon: 'error', title: 'Complete los campos obligatorios' });
      return;
    }

    // Calculamos diferencia para el cupo
    let diferenciaCupo = 0;
    if (isEditing && editId) {
      const gastoOld = gastos.find(g => g.id === editId);
      if (gastoOld) {
        diferenciaCupo = Number(gastoOld.monto) - valorMonto;
      }
    } else {
      diferenciaCupo = -valorMonto;
    }

    // Validar si hay dinero (solo si estamos restando más)
    if (diferenciaCupo < 0 && Math.abs(diferenciaCupo) > Number(sucursal.cupo_actual)) {
      Swal.fire('Efectivo Insuficiente', 'No hay suficiente dinero en caja para esta operación.', 'error');
      return;
    }

    setLoading(true);
    try {
      if (isEditing && editId) {
        // ACTUALIZAR
        const { error: errorUpdate } = await supabase
          .from('gastos')
          .update({
            monto: valorMonto,
            categoria,
            descripcion
          })
          .eq('id', editId);
        if (errorUpdate) throw errorUpdate;
      } else {
        // CREAR
        const { error: gastoError } = await supabase
          .from('gastos')
          .insert([{
            sucursal_id: sucursal.id,
            usuario_id: profile.id,
            monto: valorMonto,
            categoria,
            descripcion
          }]);
        if (gastoError) throw gastoError;
      }

      // Actualizar Cupo
      const nuevoCupo = Number(sucursal.cupo_actual) + diferenciaCupo;
      if (diferenciaCupo !== 0) {
        const { error: sucursalError } = await supabase
          .from('sucursales')
          .update({ cupo_actual: nuevoCupo })
          .eq('id', sucursal.id);
        if (sucursalError) throw sucursalError;
        setSucursal({ ...sucursal, cupo_actual: nuevoCupo });
        window.dispatchEvent(new Event('refreshSucursal'));
      }

      Toast.fire({ icon: 'success', title: isEditing ? 'Gasto actualizado' : 'Gasto registrado' });
      resetForm();
      fetchGastos(sucursal.id);

    } catch (error: any) {
      Swal.fire('Error', error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setMonto('');
    setCategoria('');
    setDescripcion('');
    setIsEditing(false);
    setEditId(null);
  };

  const handleEdit = (g: any) => {
    setIsEditing(true);
    setEditId(g.id);
    setMonto(new Intl.NumberFormat('es-CO').format(g.monto));
    setCategoria(g.categoria);
    setDescripcion(g.descripcion || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (g: any) => {
    const { isConfirmed } = await Swal.fire({
      title: '¿Eliminar Gasto?',
      text: `Se devolverán $${Number(g.monto).toLocaleString()} a su caja.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      confirmButtonColor: '#d33',
      cancelButtonText: 'Cancelar'
    });

    if (isConfirmed) {
      setLoading(true);
      try {
        const nuevoCupo = Number(sucursal.cupo_actual) + Number(g.monto);
        await supabase.from('sucursales').update({ cupo_actual: nuevoCupo }).eq('id', sucursal.id);
        
        const { error } = await supabase.from('gastos').delete().eq('id', g.id);
        if (error) throw error;

        setSucursal({ ...sucursal, cupo_actual: nuevoCupo });
        window.dispatchEvent(new Event('refreshSucursal'));
        Toast.fire({ icon: 'success', title: 'Gasto eliminado' });
        fetchGastos(sucursal.id);
      } catch (error: any) {
        Swal.fire('Error', error.message, 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  if (loadingData) return <div className="p-5 text-center"><div className="spinner-border text-warning"></div></div>;

  return (
    <div className="container py-4">
      <div className="row g-4">
        {/* Formulario */}
        <div className="col-lg-5">
          <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
            <div className={`p-4 text-center ${isEditing ? 'bg-info' : 'bg-dark'}`}>
              <h3 className="text-white fw-bold mb-0">{isEditing ? 'Editar Gasto' : 'Registrar Gasto'}</h3>
              <p className="text-warning small mb-0 mt-1">{isEditing ? 'Actualizando registro seleccionado' : 'Este valor restará de su efectivo físico'}</p>
            </div>
            <div className="card-body p-4">
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label small fw-bold text-muted">MONTO DEL GASTO</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-0 fw-bold">$</span>
                    <input 
                      type="text" 
                      className="form-control form-control-lg bg-light border-0 fw-bold" 
                      value={monto}
                      onChange={handleMontoChange}
                      placeholder="0"
                      required
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-bold text-muted">CATEGORÍA</label>
                  <select 
                    className="form-select bg-light border-0" 
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    required
                  >
                    <option value="">Seleccione una categoría...</option>
                    <option value="Servicios">Servicios Públicos</option>
                    <option value="Arriendo">Arriendo / Alquiler</option>
                    <option value="Suministros">Papelería / Suministros</option>
                    <option value="Personal">Pago a Personal</option>
                    <option value="Mantenimiento">Mantenimiento</option>
                    <option value="Otros">Otros Gastos</option>
                  </select>
                </div>

                <div className="mb-4">
                  <label className="form-label small fw-bold text-muted">DESCRIPCIÓN (OPCIONAL)</label>
                  <textarea 
                    className="form-control bg-light border-0" 
                    rows={3}
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Detalle el motivo del gasto..."
                  ></textarea>
                </div>

                <div className="d-flex gap-2">
                  <button 
                    type="submit" 
                    className={`btn ${isEditing ? 'btn-info' : 'btn-dark'} w-100 py-3 rounded-3 fw-bold shadow-sm ${isEditing ? 'text-white' : ''}`}
                    disabled={loading}
                  >
                    {loading ? 'Procesando...' : (isEditing ? 'GUARDAR CAMBIOS' : 'GUARDAR GASTO')}
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

        {/* Listado Reciente */}
        <div className="col-lg-7">
          <div className="card border-0 shadow-sm rounded-4 overflow-hidden h-100">
            <div className="card-header bg-white py-3 px-4 border-0 d-flex justify-content-between align-items-center">
              <h5 className="mb-0 fw-bold text-dark">Gastos de Hoy</h5>
              <span className="badge bg-light text-dark border px-3">{gastos.length} registros</span>
            </div>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="bg-light text-muted small text-uppercase">
                  <tr>
                    <th className="ps-4">Categoría</th>
                    <th>Descripción</th>
                    <th className="text-end">Monto</th>
                    <th className="text-center pe-4" style={{width: '90px'}}>Accción</th>
                  </tr>
                </thead>
                <tbody>
                  {gastos.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center py-5 text-muted italic">No hay gastos registrados hoy</td>
                    </tr>
                  ) : (
                    gastos.map((g) => (
                      <tr key={g.id}>
                        <td className="ps-4">
                          <span className="fw-bold">{g.categoria}</span>
                          <div className="text-muted small" style={{fontSize: '0.7rem'}}>
                            {new Date(g.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </div>
                        </td>
                        <td className="text-muted small text-truncate" style={{maxWidth: '200px'}}>
                          {g.descripcion || '---'}
                        </td>
                        <td className="text-end fw-bold text-danger">
                          -${Number(g.monto).toLocaleString()}
                        </td>
                        <td className="text-center pe-4">
                           <div className="d-flex justify-content-center gap-2">
                              <button onClick={() => handleEdit(g)} className="btn btn-sm btn-light p-1 border-0 text-primary">
                                <i className="bi bi-pencil-square"></i>
                              </button>
                              <button onClick={() => handleDelete(g)} className="btn btn-sm btn-light p-1 border-0 text-danger">
                                <i className="bi bi-trash"></i>
                              </button>
                           </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {gastos.length > 0 && (
              <div className="card-footer bg-light border-0 p-4 text-end">
                <span className="text-muted text-uppercase small fw-bold me-3">Total del Día:</span>
                <span className="h4 fw-bold text-dark mb-0">${gastos.reduce((acc, curr) => acc + Number(curr.monto), 0).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
