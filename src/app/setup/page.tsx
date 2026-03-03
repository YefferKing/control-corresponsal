"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function SetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Sucursal, 2: Admin User

  // Form Sucursal
  const [sucursal, setSucursal] = useState({
    nombre: '',
    codigo: '',
    cupo_limite: '42000000',
    saldo_inicial: '0'
  });

  // Form Admin
  const [admin, setAdmin] = useState({
    nombre: '',
    email: '',
    password: ''
  });

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Asegurar que existan los permisos base y el rol admin
      
      // 2. Crear la Sucursal
      const { data: sucursalData, error: sucursalError } = await supabase
        .from('sucursales')
        .insert([{ 
          nombre: sucursal.nombre, 
          codigo_punto: sucursal.codigo, 
          cupo_limite: parseFloat(sucursal.cupo_limite),
          cupo_actual: parseFloat(sucursal.saldo_inicial),
          fecha_expiracion: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        }])
        .select()
        .single();

      if (sucursalError) throw new Error("Error Sucursal: " + sucursalError.message);

      // 3. Obtener el ID del Rol Administrador (Ya debe existir por el SQL semilla)
      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .select('id')
        .eq('nombre', 'ADMINISTRADOR DEL SISTEMA')
        .single();

      if (roleError) throw new Error("Error Rol: No se encontró el rol de Administrador. Ejecute primero el SQL semilla en Supabase.");

      // 4. Crear el Usuario en Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: admin.email,
        password: admin.password,
      });

      if (authError) throw new Error("Error Auth: " + authError.message);

      if (authData.user) {
        // 5. Crear el Perfil vinculado
        const { error: profileError } = await supabase
          .from('perfiles')
          .insert([{
            id: authData.user.id,
            nombre_completo: admin.nombre,
            sucursal_id: sucursalData.id,
            rol_id: roleData.id
          }]);

        if (profileError) throw profileError;

        alert("¡Configuración exitosa! Ahora puedes iniciar sesión.");
        router.push('/login');
      }

    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card shadow-lg border-0">
            <div className="card-header bg-dark text-white py-3 text-center">
              <h4 className="fw-bold mb-0">Configuración Inicial FlashBank</h4>
              <p className="small mb-0 opacity-75">Configure su punto y su cuenta maestra.</p>
            </div>
            <div className="card-body p-4">
              <form onSubmit={handleSetup}>
                {/* SECCIÓN SUCURSAL */}
                <h5 className="fw-bold mb-3 border-bottom pb-2">1. Datos del Corresponsal</h5>
                <div className="mb-3">
                  <label className="form-label small fw-bold">Nombre del Punto</label>
                  <input 
                    type="text" className="form-control" placeholder="Ej: Corresponsal El Poblado" required
                    value={sucursal.nombre} onChange={e => setSucursal({...sucursal, nombre: e.target.value})}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-bold">Código (BNK-XXX)</label>
                  <input 
                    type="text" className="form-control" placeholder="BNK-001" required
                    value={sucursal.codigo} onChange={e => setSucursal({...sucursal, codigo: e.target.value})}
                  />
                </div>
                <div className="row mb-4">
                  <div className="col-12 mb-3">
                    <label className="form-label small fw-bold">Cupo Total / Tope ($)</label>
                    <input 
                      type="number" className="form-control" required
                      value={sucursal.cupo_limite} onChange={e => setSucursal({...sucursal, cupo_limite: e.target.value})}
                    />
                    <div className="form-text small opacity-50">Límite contractual (Saldo + Cupo = Tope). Ej: 42,000,000</div>
                  </div>
                  <div className="col-12">
                    <label className="form-label small fw-bold">Saldo Inicial en Efectivo ($)</label>
                    <input 
                      type="number" className="form-control" required
                      value={sucursal.saldo_inicial} onChange={e => setSucursal({...sucursal, saldo_inicial: e.target.value})}
                    />
                    <div className="form-text small opacity-50">Efectivo físico que tiene en caja al comenzar.</div>
                  </div>
                </div>

                {/* SECCIÓN ADMINISTRADOR */}
                <h5 className="fw-bold mb-3 border-bottom pb-2">2. Datos del Administrador</h5>
                <div className="mb-3">
                  <label className="form-label small fw-bold">Nombre Completo</label>
                  <input 
                    type="text" className="form-control" placeholder="Su Nombre" required
                    value={admin.nombre} onChange={e => setAdmin({...admin, nombre: e.target.value})}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-bold">Email de Acceso</label>
                  <input 
                    type="email" className="form-control" placeholder="admin@correo.com" required
                    value={admin.email} onChange={e => setAdmin({...admin, email: e.target.value})}
                  />
                </div>
                <div className="mb-4">
                  <label className="form-label small fw-bold">Contraseña Segura</label>
                  <input 
                    type="password" className="form-control" minLength={6} required
                    value={admin.password} onChange={e => setAdmin({...admin, password: e.target.value})}
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  className="btn btn-dark w-100 py-3 fw-bold shadow-sm"
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Configurando Sistema...
                    </>
                  ) : 'FINALIZAR Y EMPEZAR A OPERAR'}
                </button>
              </form>
            </div>
          </div>
          
          <div className="mt-4 text-center text-muted small">
            <i className="bi bi-shield-check me-1"></i>
            Este proceso activará automáticamente todos los permisos bancarios para su cuenta.
          </div>
        </div>
      </div>
    </div>
  );
}
