"use client";

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("Error de acceso: " + error.message);
    } else {
      // Redirigir al dashboard o inicio
      router.push('/');
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-5 col-lg-4">
          <div className="text-center mb-4">
            <i className="bi bi-bank2 display-4 text-primary"></i>
            <h2 className="fw-bold mt-2">Bienvenido</h2>
            <p className="text-muted">Control Corresponsal</p>
          </div>
          
          <div className="card shadow border-0">
            <div className="card-body p-4">
              <form onSubmit={handleLogin}>
                <div className="mb-3">
                  <label className="form-label small fw-bold">Correo Electrónico</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0"><i className="bi bi-envelope text-muted"></i></span>
                    <input 
                      type="email" 
                      className="form-control border-start-0 ps-0" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required 
                    />
                  </div>
                </div>
                
                <div className="mb-4">
                  <label className="form-label small fw-bold">Contraseña</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0"><i className="bi bi-lock text-muted"></i></span>
                    <input 
                      type="password" 
                      className="form-control border-start-0 ps-0" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required 
                    />
                  </div>
                </div>
                
                <button 
                  type="submit" 
                  className={`btn btn-dark w-100 py-2 fw-bold ${loading ? 'disabled' : ''}`}
                >
                  {loading ? 'Verificando...' : 'Entrar al Sistema'}
                </button>
                <div className="text-center mt-3">
                  <button 
                    type="button"
                    onClick={async () => {
                      if (!email) {
                        alert("Por favor, ingrese su correo electrónico primero.");
                        return;
                      }
                      const { error } = await supabase.auth.resetPasswordForEmail(email, {
                        redirectTo: `${window.location.origin}/reset-password`,
                      });
                      if (error) {
                        alert("Error: " + error.message);
                      } else {
                        alert("Se ha enviado un correo para restablecer su contraseña. Revise su bandeja de entrada.");
                      }
                    }}
                    className="btn btn-link btn-sm text-decoration-none text-muted fw-bold"
                  >
                    ¿Olvidó su contraseña?
                  </button>
                </div>
              </form>
            </div>
          </div>
          
          <p className="text-center mt-4 mb-0 small text-muted">
            Si no tiene cuenta, contacte al administrador de su sucursal.
          </p>
        </div>
      </div>
    </div>
  );
}
