"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Swal from 'sweetalert2';
import { Toast } from '@/lib/utils';

export default function MasterSucursales() {
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    checkPermission();
  }, []);

  async function checkPermission() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: profile } = await supabase
      .from('perfiles')
      .select('roles(nombre)')
      .eq('id', session.user.id)
      .single();

    const roleName = (profile?.roles as any)?.nombre?.toUpperCase() || '';
    const userEmail = session.user.email;
    
    // Solo permitimos entrar si es el Administrador del Sistema (Master) Y es tu correo exacto
    if ((roleName.includes('SISTEMA') || roleName.includes('MASTER')) && userEmail === 'yeffersonpeinado@gmail.com') {
      setIsSuperAdmin(true);
      fetchSucursales();
    } else {
      setLoading(false);
    }
  }

  async function fetchSucursales() {
    // Obtenemos sucursales con conteo de perfiles (usuarios) vinculados
    const { data, error } = await supabase
      .from('sucursales')
      .select(`
        *,
        perfiles:perfiles(count)
      `)
      .order('created_at', { ascending: false });

    if (!error) {
      setSucursales(data || []);
    }
    setLoading(false);
  }

  const toggleEstado = async (id: string, estadoActual: boolean) => {
    const confirm = await Swal.fire({
      title: `¿${estadoActual ? 'Desactivar' : 'Activar'} Punto?`,
      text: estadoActual ? "El punto no podrá realizar ninguna operación." : "El punto volverá a estar operativo inmediatamente.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, cambiar',
      cancelButtonText: 'Volver',
      confirmButtonColor: '#212529',
      cancelButtonColor: '#6c757d',
    });

    if (confirm.isConfirmed) {
      const { error } = await supabase
        .from('sucursales')
        .update({ activo: !estadoActual })
        .eq('id', id);

      if (!error) {
        Toast.fire({ icon: 'success', title: 'Estado actualizado' });
        fetchSucursales();
      }
    }
  };

  const actualizarExpiracion = async (id: string, fechaActual: string) => {
    const { value: nuevaFecha } = await Swal.fire({
      title: 'Extender Suscripción',
      input: 'date',
      inputValue: fechaActual ? new Date(fechaActual).toISOString().split('T')[0] : '',
      confirmButtonText: 'Guardar Nueva Fecha',
      showCancelButton: true,
      confirmButtonColor: '#212529',
      cancelButtonColor: '#6c757d',
    });

    if (nuevaFecha) {
      const { error } = await supabase
        .from('sucursales')
        .update({ fecha_expiracion: nuevaFecha })
        .eq('id', id);

      if (!error) {
        Toast.fire({ icon: 'success', title: 'Fecha de expiración actualizada' });
        fetchSucursales();
      }
    }
  };

  if (loading) return <div className="p-5 text-center"><div className="spinner-border text-dark"></div></div>;

  if (!isSuperAdmin) {
    return (
      <div className="container py-5 text-center">
        <div className="card border-0 shadow-lg p-5 rounded-4">
          <i className="bi bi-shield-lock-fill text-danger mb-4" style={{fontSize: '5rem'}}></i>
          <h2 className="fw-bold">Acceso Restringido</h2>
          <p className="text-muted">Solo el Administrador Maestro del Sistema puede gestionar las suscripciones de los corresponsales.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="fw-bold mb-0">Control de Suscripciones</h2>
          <p className="text-muted small">Gestión global de corresponsales y licencias</p>
        </div>
        <div className="badge bg-dark p-2 px-3 rounded-pill d-flex align-items-center">
          {sucursales.length} Corresponsales
        </div>
      </div>

      {/* Buscador Estándar */}
      <div className="card border-0 shadow-sm rounded-4 mb-4 overflow-hidden">
        <div className="input-group input-group-lg">
          <span className="input-group-text bg-white border-0 ps-4">
            <i className="bi bi-search text-muted"></i>
          </span>
          <input 
            type="text" 
            className="form-control border-0 py-4 shadow-none fs-6" 
            placeholder="Buscar por nombre de empresa, código de punto o NIT..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="btn btn-white border-0 pe-4" onClick={() => setSearchTerm('')}>
              <i className="bi bi-x-circle-fill text-muted"></i>
            </button>
          )}
        </div>
      </div>

      <div className="row g-4">
        {sucursales
          .filter(s => 
            s.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
            s.codigo_punto.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (s.nit && s.nit.toLowerCase().includes(searchTerm.toLowerCase()))
          )
          .map((s) => {
          const diasRestantes = s.fecha_expiracion 
            ? Math.ceil((new Date(s.fecha_expiracion).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
            : 0;

          return (
            <div className="col-md-6 col-lg-4" key={s.id}>
              <div className="card h-100 border-0 shadow-sm rounded-4 overflow-hidden">
                <div className={`p-3 d-flex justify-content-between align-items-center ${s.activo !== false ? 'bg-success bg-opacity-10' : 'bg-danger bg-opacity-10'}`}>
                  <span className={`badge rounded-pill ${s.activo !== false ? 'bg-success' : 'bg-danger'}`}>
                    {s.activo !== false ? 'SUSCRIPCIÓN ACTIVA' : 'SISTEMA BLOQUEADO'}
                  </span>
                  <div className="form-check form-switch m-0">
                    <input 
                      className="form-check-input" 
                      type="checkbox" 
                      role="switch" 
                      checked={s.activo !== false}
                      onChange={() => toggleEstado(s.id, s.activo !== false)}
                    />
                  </div>
                </div>

                <div className="card-body p-4">
                  <div className="d-flex align-items-center gap-3 mb-4">
                    <div className="rounded-circle bg-dark text-warning d-flex align-items-center justify-content-center fw-bold" style={{width: '50px', height: '50px', fontSize: '1.2rem'}}>
                      {s.nombre.charAt(0)}
                    </div>
                    <div>
                      <h5 className="fw-bold mb-0">{s.nombre}</h5>
                      <span className="text-muted small fw-bold">ID: {s.codigo_punto}</span>
                    </div>
                  </div>

                  <div className="row text-center g-2 border-top border-bottom py-3 mb-4">
                    <div className="col-6 border-end">
                      <div className="text-muted small text-uppercase fw-bold" style={{fontSize: '0.6rem'}}>Usuarios</div>
                      <div className="h5 fw-bold mb-0">{s.perfiles?.[0]?.count || 0}</div>
                    </div>
                    <div className="col-6">
                      <div className="text-muted small text-uppercase fw-bold" style={{fontSize: '0.6rem'}}>Saldo Actual</div>
                      <div className="h5 fw-bold mb-0 text-success">${Number(s.cupo_actual || 0).toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="d-grid gap-2">
                    <div className={`p-3 rounded-3 text-center ${diasRestantes < 5 ? 'bg-danger bg-opacity-25 text-danger' : 'bg-light text-dark'}`}>
                      <div className="small fw-bold opacity-75">VENCE EL:</div>
                      <div className="fw-bold fs-5">{s.fecha_expiracion ? new Date(s.fecha_expiracion).toLocaleDateString() : '---'}</div>
                      <div className="small fw-bold">{diasRestantes > 0 ? `${diasRestantes} días restantes` : 'Expirada'}</div>
                    </div>

                    <button 
                      onClick={() => actualizarExpiracion(s.id, s.fecha_expiracion)}
                      className="btn btn-outline-dark btn-sm rounded-pill py-2 mt-2 fw-bold"
                    >
                      <i className="bi bi-calendar-event me-2"></i>AMPLIAR SUSCRIPCIÓN
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
