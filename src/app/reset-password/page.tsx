"use client";

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      Swal.fire('Error', 'Las contraseñas no coinciden', 'error');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      Swal.fire('Error', error.message, 'error');
    } else {
      await Swal.fire({
        icon: 'success',
        title: '¡Clave Actualizada!',
        text: 'Tu contraseña ha sido cambiada con éxito. Ya puedes iniciar sesión.',
        confirmButtonColor: '#ffdd00'
      });
      router.push('/login');
    }
    setLoading(false);
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center pt-5">
        <div className="col-md-5 col-lg-4">
          <div className="card shadow-lg border-0 rounded-4 overflow-hidden">
            <div className="card-header bg-dark text-white p-4 text-center border-0">
              <i className="bi bi-shield-lock-fill text-warning display-5"></i>
              <h4 className="fw-bold mt-2 text-white">Nueva Contraseña</h4>
              <p className="text-white-50 small mb-0">Ingrese su nueva clave de acceso</p>
            </div>
            
            <div className="card-body p-4 bg-white">
              <form onSubmit={handleReset}>
                <div className="mb-3">
                  <label className="form-label small fw-bold text-muted text-uppercase">Nueva Clave</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-0"><i className="bi bi-key-fill text-warning"></i></span>
                    <input 
                      type="password" 
                      className="form-control bg-light border-0 py-2" 
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required 
                      minLength={6}
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="form-label small fw-bold text-muted text-uppercase">Confirmar Clave</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-0"><i className="bi bi-check-circle-fill text-warning"></i></span>
                    <input 
                      type="password" 
                      className="form-control bg-light border-0 py-2" 
                      placeholder="Repita su nueva clave"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required 
                      minLength={6}
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="btn btn-warning w-100 py-3 fw-bold rounded-pill shadow-sm text-dark d-flex align-items-center justify-content-center gap-2"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="spinner-border spinner-border-sm"></span>
                  ) : (
                    <><i className="bi bi-shield-check fs-5"></i> Cambiar Contraseña</>
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
