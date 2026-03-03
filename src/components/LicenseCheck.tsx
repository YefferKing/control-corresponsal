"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { usePathname } from 'next/navigation';

export default function LicenseCheck({ children }: { children: React.ReactNode }) {
  const [expired, setExpired] = useState(false);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    async function checkLicense() {
      // Excluir páginas que no necesitan bloqueo (login, setup)
      const publicPages = ['/login', '/setup', '/reset-password'];
      if (publicPages.includes(pathname)) {
        setLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('perfiles')
        .select('sucursal_id, sucursales(fecha_expiracion)')
        .eq('id', session.user.id)
        .single();

      if (profile?.sucursales) {
        // @ts-ignore
        const s = Array.isArray(profile.sucursales) ? profile.sucursales[0] : profile.sucursales;
        if (s.fecha_expiracion) {
          const expirationDate = new Date(s.fecha_expiracion);
          const now = new Date();
          if (now > expirationDate) {
            setExpired(true);
          }
        }
      }
      setLoading(false);
    }

    checkLicense();
  }, [pathname]);

  if (loading) return children; // Dejar cargar normalmente mientras verifica

  if (expired) {
    return (
      <div className="vh-100 vw-100 bg-dark d-flex align-items-center justify-content-center p-4" style={{ position: 'fixed', top: 0, left: 0, zIndex: 9999 }}>
        <div className="card border-0 shadow-lg p-5 text-center rounded-4" style={{ maxWidth: '500px' }}>
          <div className="bg-danger text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-4" style={{ width: '80px', height: '80px' }}>
            <i className="bi bi-shield-lock-fill fs-1"></i>
          </div>
          <h2 className="fw-bold text-dark mb-3">Licencia Expirada</h2>
          <p className="text-muted mb-4">
            Su periodo de gracia o licencia de uso ha caducado. Para continuar operando y acceder a su historial de transacciones, por favor realice el pago correspondiente.
          </p>
          <div className="bg-light p-3 rounded-3 mb-4">
            <div className="small text-uppercase fw-bold text-muted mb-1">Contacto para renovación:</div>
            <div className="h5 fw-bold text-dark mb-0">+57 312 427 2780</div>
          </div>
          <button 
            onClick={async () => {
              const { data: { session } } = await supabase.auth.getSession();
              if (session) {
                // Re-verificar si ya pagó antes de cerrar
                window.location.reload();
              }
            }} 
            className="btn btn-warning w-100 py-3 fw-bold rounded-pill shadow-sm mb-2"
          >
            VERIFICAR PAGO
          </button>
          <button 
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = '/login';
            }} 
            className="btn btn-outline-danger w-100 py-2 fw-bold rounded-pill border-0"
          >
            CERRAR SESIÓN
          </button>
          <p className="mt-3 small text-muted">FlashBank - Soporte Técnico</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
