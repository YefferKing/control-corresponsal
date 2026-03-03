"use client";

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';

// Configuración global para Toasts elegantes en la esquina
const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer)
    toast.addEventListener('mouseleave', Swal.resumeTimer)
  }
});

export default function NuevaSucursal() {
  const [nombre, setNombre] = useState('');
  const [codigoPunto, setCodigoPunto] = useState('');
  const [saldoInicial, setSaldoInicial] = useState('0');
  const [cupoLimite, setCupoLimite] = useState('42000000');
  const [adminNombre, setAdminNombre] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Crear la sucursal
      const { data: sucursalData, error: sucursalError } = await supabase
        .from('sucursales')
        .insert([
          { 
            nombre, 
            codigo_punto: codigoPunto, 
            cupo_actual: parseFloat(saldoInicial.replace(/\./g, '')), 
            cupo_limite: parseFloat(cupoLimite.replace(/\./g, '')),
            fecha_expiracion: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          }
        ])
        .select()
        .single();

      if (sucursalError) throw sucursalError;
      const sucursalId = sucursalData.id;

      // 2. Obtener todos los permisos definidos
      const { data: permisos, error: permisosError } = await supabase
        .from('permisos_definicion')
        .select('slug');

      if (permisosError) throw permisosError;

      // 3. Determinar el Rol (MASTER si es el correo del dueño, sino ADMINISTRADOR regional)
      let finalRoleId = '';
      const isOwner = adminEmail.toLowerCase() === 'yeffersonpeinado@gmail.com';

      if (isOwner) {
        // ID fijo del SISTEMA MASTER definido en database_init.sql
        finalRoleId = '00000000-0000-0000-0000-000000000001';
      } else {
        // Crear el Rol Administrador local para esta sucursal
        const { data: roleData, error: roleError } = await supabase
          .from('roles')
          .insert([{
            nombre: 'ADMINISTRADOR',
            sucursal_id: sucursalId
          }])
          .select()
          .single();

        if (roleError) throw roleError;
        finalRoleId = roleData.id;

        // 4. Vincular todos los permisos al nuevo rol local
        const rolesPermisos = permisos.map(p => ({
          rol_id: finalRoleId,
          permiso_slug: p.slug
        }));

        const { error: rpError } = await supabase
          .from('roles_permisos')
          .insert(rolesPermisos);

        if (rpError) throw rpError;
      }

      // 5. Crear el Usuario en Auth (Sign Up)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: adminEmail,
        password: adminPassword,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("El usuario ya existe o hubo un error en Auth.");

      // 6. Crear el Perfil vinculado
      const { error: profileError } = await supabase
        .from('perfiles')
        .insert([{
          id: authData.user.id,
          nombre_completo: adminNombre,
          sucursal_id: sucursalId,
          rol_id: finalRoleId
        }]);


      if (profileError) throw profileError;

      Toast.fire({
        icon: 'success',
        title: 'Corresponsal y Administrador creados'
      });

      setTimeout(() => {
        router.push(`/login`);
      }, 2000);

    } catch (error: any) {
      setLoading(false);
      Swal.fire({
        icon: 'error',
        title: 'Error en el registro',
        text: error.message || 'Ocurrió un error inesperado',
        confirmButtonColor: '#ffdd00'
      });
    }
  };


  const formatN2 = (value: string) => {
    const numericValue = value.replace(/\D/g, "");
    if (!numericValue) return "";
    return new Intl.NumberFormat('es-CO').format(parseInt(numericValue));
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-7">
          <div className="card shadow-lg border-0 overflow-hidden rounded-4">
            <div className="card-header bg-dark text-white p-4 border-0">
              <div className="d-flex align-items-center gap-3">
                <div className="bg-warning text-dark p-3 rounded-circle d-flex align-items-center justify-content-center" style={{width: '50px', height: '50px'}}>
                  <i className="bi bi-shop-window fs-4"></i>
                </div>
                <div>
                  <h4 className="fw-bold mb-0 text-white">Nuevo Corresponsal</h4>
                  <p className="text-white-50 small mb-0">Comience configurando su primer punto</p>
                </div>
              </div>
            </div>
            
            <div className="card-body p-4 bg-white">
              <form onSubmit={handleCreate}>
                <div className="row g-4 mb-4">
                  <div className="col-md-12">
                    <label className="form-label small fw-bold text-muted text-uppercase">Nombre del Punto</label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-0"><i className="bi bi-tag text-warning"></i></span>
                      <input 
                        type="text" 
                        className="form-control bg-light border-0 py-2" 
                        placeholder="Ej: Multiserivicos Centro"
                        value={nombre} 
                        onChange={e => setNombre(e.target.value)} 
                        required 
                      />
                    </div>
                  </div>

                  <div className="col-md-12">
                    <label className="form-label small fw-bold text-muted text-uppercase">Código Único de Punto</label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-0"><i className="bi bi-hash text-warning"></i></span>
                      <input 
                        type="text" 
                        className="form-control bg-light border-0 py-2" 
                        placeholder="Ej: CJA1"
                        value={codigoPunto} 
                        onChange={e => setCodigoPunto(e.target.value)} 
                        required 
                      />
                    </div>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label small fw-bold text-muted text-uppercase">Saldo Inicial (Efectivo)</label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-0 fw-bold text-warning">$</span>
                      <input 
                        type="text" 
                        className="form-control bg-light border-0 py-2" 
                        placeholder="0"
                        value={formatN2(saldoInicial)}
                        onChange={e => setSaldoInicial(e.target.value.replace(/\D/g, ''))}
                        required 
                      />
                    </div>
                    <div className="form-text small opacity-50">Efectivo físico que tiene actualmente en caja.</div>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label small fw-bold text-muted text-uppercase">Cupo Límite (Tope)</label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-0 fw-bold text-warning">$</span>
                      <input 
                        type="text" 
                        className="form-control bg-light border-0 py-2" 
                        placeholder="42.000.000"
                        value={formatN2(cupoLimite)}
                        onChange={e => setCupoLimite(e.target.value.replace(/\D/g, ''))}
                        required 
                      />
                    </div>
                    <div className="form-text small opacity-50">Límite contractual (Saldo + Cupo = Tope).</div>
                  </div>

                  <div className="col-12 mt-4">
                    <hr className="opacity-10" />
                    <h5 className="fw-bold text-dark mt-2 mb-3">Información del Administrador</h5>
                    <p className="text-muted small">Estos datos serán usados para el acceso maestro a este punto.</p>
                  </div>

                  <div className="col-md-12">
                    <label className="form-label small fw-bold text-muted text-uppercase">Nombre del Administrador</label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-0"><i className="bi bi-person text-warning"></i></span>
                      <input 
                        type="text" 
                        className="form-control bg-light border-0 py-2" 
                        placeholder="Ej: Juan Pérez"
                        value={adminNombre} 
                        onChange={e => setAdminNombre(e.target.value)} 
                        required 
                      />
                    </div>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label small fw-bold text-muted text-uppercase">Correo de Acceso</label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-0"><i className="bi bi-envelope text-warning"></i></span>
                      <input 
                        type="email" 
                        className="form-control bg-light border-0 py-2" 
                        placeholder="admin@ejemplo.com"
                        value={adminEmail} 
                        onChange={e => setAdminEmail(e.target.value)} 
                        required 
                      />
                    </div>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label small fw-bold text-muted text-uppercase">Contraseña</label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-0"><i className="bi bi-key text-warning"></i></span>
                      <input 
                        type="password" 
                        className="form-control bg-light border-0 py-2" 
                        placeholder="Mínimo 6 caracteres"
                        value={adminPassword} 
                        onChange={e => setAdminPassword(e.target.value)} 
                        required 
                        minLength={6}
                      />
                    </div>
                  </div>
                </div>


                <button 
                  type="submit" 
                  disabled={loading}
                  className="btn btn-warning w-100 py-3 fw-bold rounded-pill shadow-sm text-dark d-flex align-items-center justify-content-center gap-2 mt-2"
                >
                  {loading ? (
                    <span className="spinner-border spinner-border-sm"></span>
                  ) : (
                    <><i className="bi bi-check-circle-fill fs-5"></i> Crear y Continuar</>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

