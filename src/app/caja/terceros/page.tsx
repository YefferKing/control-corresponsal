"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Swal from 'sweetalert2';
import { useRouter } from 'next/navigation';
import { Toast } from '@/lib/utils';
import Link from 'next/link';

export default function GestionTerceros() {
  const [nombre, setNombre] = useState('');
  const [identificacion, setIdentificacion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [terceros, setTerceros] = useState<any[]>([]);
  const [sucursal, setSucursal] = useState<any>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
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
      setSucursal(profileData.sucursales);
      fetchTerceros(profileData.sucursal_id);
    }
  }

  async function fetchTerceros(sucursalId: string) {
    const { data, error } = await supabase
      .from('terceros')
      .select('*')
      .eq('sucursal_id', sucursalId)
      .order('nombre', { ascending: true });

    if (!error) setTerceros(data || []);
    setLoadingData(false);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre) {
      Toast.fire({ icon: 'error', title: 'El nombre es obligatorio' });
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from('terceros')
          .update({ nombre, identificacion, telefono })
          .eq('id', editingId);
        if (error) throw error;
        Toast.fire({ icon: 'success', title: 'Tercero actualizado' });
      } else {
        const { error } = await supabase
          .from('terceros')
          .insert([{ 
            nombre, 
            identificacion, 
            telefono, 
            sucursal_id: sucursal.id 
          }]);
        if (error) throw error;
        Toast.fire({ icon: 'success', title: 'Tercero registrado' });
      }

      setNombre('');
      setIdentificacion('');
      setTelefono('');
      setEditingId(null);
      fetchTerceros(sucursal.id);

    } catch (error: any) {
      Swal.fire('Error', error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (t: any) => {
    setEditingId(t.id);
    setNombre(t.nombre);
    setIdentificacion(t.identificacion || '');
    setTelefono(t.telefono || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    const { isConfirmed } = await Swal.fire({
      title: '¿Eliminar tercero?',
      text: "Esta acción no se puede deshacer.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (isConfirmed) {
      const { error } = await supabase.from('terceros').delete().eq('id', id);
      if (error) {
        Swal.fire('Error', error.message, 'error');
      } else {
        Toast.fire({ icon: 'success', title: 'Tercero eliminado' });
        fetchTerceros(sucursal.id);
      }
    }
  };

  if (loadingData) return <div className="p-5 text-center"><div className="spinner-border text-primary"></div></div>;

  return (
    <div className="container py-4">
      <div className="row g-4">
        {/* Formulario */}
        <div className="col-lg-4">
          <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
            <div className={`p-4 text-center ${editingId ? 'bg-warning' : 'bg-dark text-white'}`}>
              <h3 className={`fw-bold mb-0 ${editingId ? 'text-dark' : 'text-white'}`}>
                {editingId ? 'Editar Tercero' : 'Nuevo Tercero'}
              </h3>
              <p className={`small mb-0 mt-1 opacity-75 ${editingId ? 'text-dark' : 'text-warning'}`}>
                Directorio de clientes y entidades
              </p>
            </div>
            <div className="card-body p-4">
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label small fw-bold text-muted">NOMBRE COMPLETO</label>
                  <input 
                    type="text" 
                    className="form-control bg-light border-0" 
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej: Juan Pérez"
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-bold text-muted">IDENTIFICACIÓN (NIT/CC)</label>
                  <input 
                    type="text" 
                    className="form-control bg-light border-0" 
                    value={identificacion}
                    onChange={(e) => setIdentificacion(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
                <div className="mb-4">
                  <label className="form-label small fw-bold text-muted">TELÉFONO / CELULAR</label>
                  <input 
                    type="text" 
                    className="form-control bg-light border-0" 
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>

                <div className="d-flex gap-2">
                  {editingId && (
                    <button type="button" className="btn btn-outline-secondary w-100 py-3 rounded-3" onClick={() => {
                      setEditingId(null); setNombre(''); setIdentificacion(''); setTelefono('');
                    }}>Cancelar</button>
                  )}
                  <button 
                    type="submit" 
                    className={`btn w-100 py-3 rounded-3 fw-bold shadow-sm ${editingId ? 'btn-warning text-dark' : 'btn-dark text-warning'}`}
                    disabled={loading}
                  >
                    {loading ? '...' : (editingId ? 'ACTUALIZAR' : 'REGISTRAR')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Listado */}
        <div className="col-lg-8">
          <div className="card border-0 shadow-sm rounded-4 overflow-hidden h-100">
            <div className="card-header bg-white py-3 px-4 border-0 d-flex justify-content-between align-items-center">
              <h5 className="mb-0 fw-bold text-dark">Directorio de Terceros</h5>
              <Link href="/caja/prestamos" className="btn btn-sm btn-outline-dark rounded-pill px-3">
                <i className="bi bi-arrow-left me-1"></i> Volver a Préstamos
              </Link>
            </div>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="bg-light text-muted small text-uppercase">
                  <tr>
                    <th className="ps-4">Nombre</th>
                    <th>Identificación</th>
                    <th>Teléfono</th>
                    <th className="pe-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {terceros.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-5 text-muted italic">No hay terceros registrados</td>
                    </tr>
                  ) : (
                    terceros.map((t) => (
                      <tr key={t.id}>
                        <td className="ps-4">
                          <div className="fw-bold">{t.nombre}</div>
                          <div className="text-muted small" style={{fontSize: '0.65rem'}}>
                            Registrado: {new Date(t.created_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="text-dark small">{t.identificacion || '---'}</td>
                        <td className="text-dark small">{t.telefono || '---'}</td>
                        <td className="pe-4 text-center">
                          <div className="btn-group btn-group-sm">
                            <button onClick={() => handleEdit(t)} className="btn btn-light border" title="Editar">
                              <i className="bi bi-pencil text-dark"></i>
                            </button>
                            <button onClick={() => handleDelete(t.id)} className="btn btn-light border text-danger" title="Eliminar">
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
          </div>
        </div>
      </div>
    </div>
  );
}
