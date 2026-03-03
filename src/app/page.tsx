"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/dashboard');
      } else {
        setLoading(false);
      }
    };
    checkUser();
  }, [router]);

  if (loading) return <div className="p-5 text-center"><div className="spinner-border text-warning"></div></div>;

  return (
    <div className="container-fluid p-0">
      {/* Hero Section */}
      <header className="bg-warning py-5 text-dark">
        <div className="container py-5">
          <div className="row align-items-center">
            <div className="col-lg-6">
              <h1 className="display-4 fw-bold mb-4">Control Corresponsal</h1>
              <p className="lead mb-4">Gestione su sucursal, controle el saldo de su cupo y asigne permisos detallados a sus usuarios de manera segura.</p>
              <div className="d-grid gap-2 d-md-flex">
                <Link href="/login" className="btn btn-dark btn-lg px-4 me-md-2">Iniciar Sesión</Link>
                <Link href="/sucursal/nueva" className="btn btn-outline-dark btn-lg px-4">Configurar Punto</Link>
              </div>
            </div>
            <div className="col-lg-6 d-none d-lg-block text-center text-dark">
              <i className="bi bi-shield-check display-1" style={{ fontSize: '10rem' }}></i>
            </div>
          </div>
        </div>
      </header>

      <main className="container my-5">
        <div className="row g-4 text-center">
          <div className="col-md-4">
            <div className="card h-100 p-4 border-0 shadow-sm rounded-4">
              <div className="d-flex flex-column align-items-center mb-3">
                <div className="bg-warning bg-opacity-10 p-3 rounded-circle mb-3">
                  <i className="bi bi-wallet2 text-dark fs-3"></i>
                </div>
                <h5 className="mb-0 fw-bold">Gestión de Saldos</h5>
              </div>
              <p className="text-muted small">Monitoree su saldo de efectivo en caja y su cupo digital disponible en tiempo real.</p>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card h-100 p-4 border-0 shadow-sm rounded-4">
              <div className="d-flex flex-column align-items-center mb-3">
                <div className="bg-warning bg-opacity-10 p-3 rounded-circle mb-3">
                  <i className="bi bi-people text-dark fs-3"></i>
                </div>
                <h5 className="mb-0 fw-bold">Personalizado</h5>
              </div>
              <p className="text-muted small">Cree cuentas para sus cajeros y defina qué operaciones pueden realizar individualmente.</p>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card h-100 p-4 border-0 shadow-sm rounded-4">
              <div className="d-flex flex-column align-items-center mb-3">
                <div className="bg-warning bg-opacity-10 p-3 rounded-circle mb-3">
                  <i className="bi bi-shield-lock text-dark fs-3"></i>
                </div>
                <h5 className="mb-0 fw-bold">Seguridad Total</h5>
              </div>
              <p className="text-muted small">Anule transacciones erróneas y recupere su saldo al instante con un solo clic.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
