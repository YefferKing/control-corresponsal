"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Swal from 'sweetalert2';
import { useRouter } from 'next/navigation';
import { Toast } from '@/lib/utils';

export default function ConfigurarSucursal() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sucursal, setSucursal] = useState<any>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    codigo_punto: '',
    cupo_limite: 0,
    cupo_actual: 0,
    nit: '',
    logo_url: ''
  });
  
  const router = useRouter();

  useEffect(() => {
    fetchSucursal();
  }, []);

  const fetchSucursal = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('perfiles')
        .select('sucursal_id, sucursales(*)')
        .eq('id', session.user.id)
        .single();

      if (profile?.sucursales) {
        // @ts-ignore
        const s = Array.isArray(profile.sucursales) ? profile.sucursales[0] : profile.sucursales;
        setSucursal(s);
        setFormData({
            nombre: s.nombre || '',
            codigo_punto: s.codigo_punto || '',
            cupo_limite: Number(s.cupo_limite || 0),
            cupo_actual: Number(s.cupo_actual || 0),
            nit: s.nit || '',
            logo_url: s.logo_url || ''
        });
      }
    } catch (error) {
      console.error('Error fetching sucursal:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) { // 2MB limit
      Toast.fire({ icon: 'error', title: 'Imagen muy grande (máx 2MB)' });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${sucursal.id}-${Math.random()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      // Intentar subir al bucket 'sucursales-logos'
      const { error: uploadError, data } = await supabase.storage
        .from('sucursales-logos')
        .upload(filePath, file);

      if (uploadError) {
        // Si no existe el bucket, avisar al usuario
        if (uploadError.message.includes('bucket not found')) {
            throw new Error("El bucket 'sucursales-logos' no existe en Supabase Storage. Por favor créelo como 'Public'.");
        }
        throw uploadError;
      }

      // Obtener URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('sucursales-logos')
        .getPublicUrl(filePath);

      setFormData({ ...formData, logo_url: publicUrl });
      Toast.fire({ icon: 'success', title: 'Logo cargado temporalmente' });
    } catch (error: any) {
      console.error('Error:', error);
      Swal.fire('Error al subir', error.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase
        .from('sucursales')
        .update({
          nombre: formData.nombre,
          codigo_punto: formData.codigo_punto,
          cupo_limite: formData.cupo_limite,
          cupo_actual: formData.cupo_actual,
          nit: formData.nit,
          logo_url: formData.logo_url
        })
        .eq('id', sucursal.id);

      if (error) throw error;

      // Sincronizar Sidebar
      window.dispatchEvent(new Event('refreshSucursal'));

      Toast.fire({
        icon: 'success',
        title: 'Configuración Guardada'
      });
      
      router.push('/dashboard');
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error al Guardar',
        text: error.message,
        confirmButtonColor: '#ffdd00'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-5 text-center"><div className="spinner-border text-warning"></div></div>;

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-lg-6">
          <div className="card shadow-lg border-0 rounded-4 overflow-hidden">
            <div className="card-header bg-dark text-white p-4 border-0">
              <div className="d-flex align-items-center gap-3">
                <div className="bg-warning text-dark p-3 rounded-circle d-flex align-items-center justify-content-center" style={{width: '50px', height: '50px'}}>
                  <i className="bi bi-gear-fill fs-4"></i>
                </div>
                <div>
                  <h4 className="fw-bold mb-0 text-white">Configurar Punto</h4>
                  <p className="text-white-50 small mb-0">Gestione los datos maestros de su corresponsal</p>
                </div>
              </div>
            </div>
            
            <div className="card-body p-4 bg-white">
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="form-label small fw-bold text-muted text-uppercase">Nombre del Punto / Sucursal</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-0"><i className="bi bi-shop text-warning"></i></span>
                    <input 
                      type="text" 
                      className="form-control bg-light border-0 py-2" 
                      placeholder="Ej: Multioriente Bancolombia"
                      value={formData.nombre}
                      onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                      required
                    />
                  </div>
                </div>
                <div className="row g-3 mb-4">
                  <div className="col-md-6">
                    <label className="form-label small fw-bold text-muted text-uppercase">NIT del Establecimiento</label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-0"><i className="bi bi-card-text text-warning"></i></span>
                      <input 
                        type="text" 
                        className="form-control bg-light border-0 py-2" 
                        placeholder="Ej: 900.123.456-7"
                        value={formData.nit}
                        onChange={(e) => setFormData({...formData, nit: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-bold text-muted text-uppercase">Logo del Punto</label>
                    <div className="d-flex align-items-center gap-3">
                        <div className="flex-grow-1">
                            <div className="input-group">
                                <span className="input-group-text bg-light border-0"><i className="bi bi-image text-warning"></i></span>
                                <input 
                                    type="file" 
                                    className="form-control bg-light border-0 py-2" 
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    disabled={uploading}
                                />
                            </div>
                            <div className="form-text x-small">Recomendado: Fondo transparente PNG.</div>
                        </div>
                        {formData.logo_url && (
                            <div className="position-relative">
                                <img 
                                    src={formData.logo_url} 
                                    alt="Preview" 
                                    className="rounded border bg-light p-1 shadow-sm"
                                    style={{width: '60px', height: '60px', objectFit: 'contain'}} 
                                />
                                {uploading && (
                                    <div className="position-absolute top-0 start-0 w-100 h-100 bg-white bg-opacity-75 d-flex align-items-center justify-content-center rounded">
                                        <div className="spinner-border spinner-border-sm text-warning"></div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                  </div>
                </div>

                <div className="row g-4 mb-4">
                  <div className="col-md-6">
                    <label className="form-label small fw-bold text-muted text-uppercase">Código del Punto</label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-0"><i className="bi bi-hash text-warning"></i></span>
                      <input 
                        type="text" 
                        className="form-control bg-light border-0 py-2" 
                        placeholder="Ej: BNK-001"
                        value={formData.codigo_punto}
                        onChange={(e) => setFormData({...formData, codigo_punto: e.target.value})}
                        required
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-bold text-muted text-uppercase">Saldo en Caja ($)</label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-0"><i className="bi bi-cash-stack text-warning"></i></span>
                      <input 
                        type="text" 
                        className="form-control bg-light border-0 py-2" 
                        value={formData.cupo_actual.toLocaleString('es-CO')}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setFormData({...formData, cupo_actual: Number(val)});
                        }}
                        required
                      />
                    </div>
                    <div className="form-text small opacity-50">Ajuste manual del efectivo físico.</div>
                  </div>
                  <div className="col-md-12">
                    <label className="form-label small fw-bold text-muted text-uppercase">Cupo Límite / Tope ($)</label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-0"><i className="bi bi-currency-dollar text-warning"></i></span>
                      <input 
                        type="text" 
                        className="form-control bg-light border-0 py-2" 
                        placeholder="Ej: 100.000"
                        value={formData.cupo_limite.toLocaleString('es-CO')}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setFormData({...formData, cupo_limite: Number(val)});
                        }}
                        required
                      />
                    </div>
                    <div className="form-text small opacity-50">Tope máximo permitido (Saldo + Cupo = Tope).</div>
                  </div>
                </div>

                <div className="d-flex gap-3 pt-3">
                  <button 
                    type="button" 
                    onClick={() => router.back()}
                    className="btn btn-light py-2 px-4 rounded-pill fw-bold border"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-warning py-2 px-4 rounded-pill fw-bold flex-grow-1 shadow-sm text-dark d-flex align-items-center justify-content-center gap-2"
                    disabled={saving}
                  >
                    {saving ? (
                      <span className="spinner-border spinner-border-sm"></span>
                    ) : (
                      <><i className="bi bi-check-lg fs-5"></i> Guardar Cambios</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="alert alert-warning mt-4 rounded-4 border-0 shadow-sm p-4 d-flex gap-3 align-items-around flex-column">
            <div className="d-flex gap-3 align-items-center">
              <i className="bi bi-shield-lock-fill text-dark fs-2"></i>
              <div className="flex-fill">
                <h6 className="fw-bold text-dark mb-1">Estado de Licencia Aplicación</h6>
                <div className="d-flex justify-content-between align-items-center">
                  <span className="small text-dark opacity-75">
                    Expira el: <strong className="text-dark">{sucursal?.fecha_expiracion ? new Date(sucursal.fecha_expiracion).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Indefinida'}</strong>
                  </span>
                  <span className={`badge rounded-pill ${sucursal?.fecha_expiracion && new Date(sucursal.fecha_expiracion) < new Date() ? 'bg-danger' : 'bg-success'} text-white px-3`}>
                    {sucursal?.fecha_expiracion && new Date(sucursal.fecha_expiracion) < new Date() ? 'EXPIRADA' : 'ACTIVA'}
                  </span>
                </div>
              </div>
            </div>
            {sucursal?.fecha_expiracion && new Date(sucursal.fecha_expiracion) < new Date() && (
              <div className="mt-2 p-2 bg-danger-subtle border border-danger rounded-3 small text-danger text-center">
                <i className="bi bi-exclamation-triangle-fill me-1"></i>
                Su sistema se encuentra bloqueado por falta de pago. Por favor regularice su licencia.
              </div>
            )}
          </div>

          <div className="alert alert-light mt-3 rounded-4 border-0 shadow-sm p-3 d-flex gap-3 align-items-center">
            <i className="bi bi-info-circle text-muted fs-4"></i>
            <p className="small text-muted mb-0">
              Ajustar el **Cupo Límite** afectará cómo se visualiza el progreso en su Dashboard y su capacidad de recibir entradas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
