"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Swal from 'sweetalert2';

export default function ContadorMonedas() {
  const [profile, setProfile] = useState<any>(null);
  const [sucursal, setSucursal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [esAdmin, setEsAdmin] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Denominaciones
  const billetes = [100000, 50000, 20000, 10000, 5000, 2000, 1000];
  const monedas = [1000, 500, 200, 100, 50];

  // Estado para cantidades
  const [cantBilletes, setCantBilletes] = useState<{ [key: number]: string }>({
    100000: '', 50000: '', 20000: '', 10000: '', 5000: '', 2000: '', 1000: ''
  });
  
  const [cantMonedas, setCantMonedas] = useState<{ [key: number]: string }>({
    1000: '', 500: '', 200: '', 100: '', 50: ''
  });

  const router = useRouter();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login');
      return;
    }

    const { data: profileData } = await supabase
      .from('perfiles')
      .select('*, sucursales(*), roles(nombre)')
      .eq('id', session.user.id)
      .single();

    if (profileData && profileData.sucursales) {
      setProfile(profileData);
      setSucursal(profileData.sucursales);
      setEsAdmin(profileData.roles?.nombre?.toUpperCase().includes('ADMIN'));
    }
    setLoading(false);
  }

  const handleGuardarConteo = async () => {
    if (totalEfectivo === 0) {
      Swal.fire('Atención', 'Por favor ingrese cantidades antes de guardar.', 'warning');
      return;
    }

    const { isConfirmed } = await Swal.fire({
      title: '¿Guardar Conteo de Monedas?',
      text: `Se registrará un total físico de $${totalEfectivo.toLocaleString()} para la contabilidad del día.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, guardar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ffdd00',
      cancelButtonColor: '#333'
    });

    if (isConfirmed) {
      try {
        setIsSaving(true);
        const { error } = await supabase
          .from('contadores_monedas')
          .insert([{
            sucursal_id: sucursal.id,
            usuario_id: profile.id,
            detalles_billetes: cantBilletes,
            detalles_monedas: cantMonedas,
            total_billetes: totalBilletes,
            total_monedas: totalMonedas,
            total_efectivo: totalEfectivo,
            saldo_sistema: saldoSistema,
            diferencia: diferencia,
            created_at: new Date().toISOString()
          }]);

        if (error) {
           if (error.code === '42P01') {
             throw new Error('La tabla "contadores_monedas" no ha sido creada en la base de datos.');
           }
           throw error;
        }

        await Swal.fire('¡Éxito!', 'El conteo ha sido guardado correctamente.', 'success');
        router.push('/dashboard');
      } catch (error: any) {
        Swal.fire('Error', 'No se pudo guardar el conteo: ' + error.message, 'error');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleCantBilletesChange = (den: number, val: string) => {
    const numeric = val.replace(/\D/g, '');
    setCantBilletes(prev => ({ ...prev, [den]: numeric }));
  };

  const handleCantMonedasChange = (den: number, val: string) => {
    const numeric = val.replace(/\D/g, '');
    setCantMonedas(prev => ({ ...prev, [den]: numeric }));
  };

  const totalBilletes = billetes.reduce((acc, den) => acc + (den * (parseInt(cantBilletes[den]) || 0)), 0);
  const totalMonedas = monedas.reduce((acc, den) => acc + (den * (parseInt(cantMonedas[den]) || 0)), 0);
  const totalEfectivo = totalBilletes + totalMonedas;
  
  const saldoSistema = sucursal?.cupo_actual || 0;
  const diferencia = totalEfectivo - saldoSistema;

  const resetContador = () => {
    const emptyB = Object.keys(cantBilletes).reduce((acc: any, key) => ({ ...acc, [key]: '' }), {});
    const emptyM = Object.keys(cantMonedas).reduce((acc: any, key) => ({ ...acc, [key]: '' }), {});
    setCantBilletes(emptyB);
    setCantMonedas(emptyM);
  };

  if (loading) return <div className="text-center py-5"><div className="spinner-border text-warning"></div></div>;

  return (
    <div className="min-vh-100 bg-light py-5">
      <div className="container px-4 px-md-5">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-5 gap-3">
          <div>
            <h1 className="fw-bold text-dark mb-1">Contador de Monedas</h1>
            <p className="text-muted mb-0">Herramienta para el conteo físico de billetes y monedas</p>
          </div>
          <div className="d-flex gap-2">
            <button onClick={resetContador} className="btn btn-outline-danger rounded-pill px-4 fw-bold">
              Limpiar Todo
            </button>
            <button 
              onClick={handleGuardarConteo} 
              className="btn btn-warning rounded-pill px-4 fw-bold"
              disabled={isSaving}
            >
              {isSaving ? 'Guardando...' : 'Guardar Conteo'}
            </button>
            <Link href="/dashboard" className="btn btn-dark rounded-pill px-4 fw-bold">
              Volver
            </Link>
          </div>
        </div>

        <div className="row g-4">
          {/* BILLETES */}
          <div className="col-lg-6">
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden h-100 d-flex flex-column">
              <div className="card-header bg-dark text-white py-3 px-4 border-0 d-flex justify-content-between align-items-center">
                <h5 className="mb-0 fw-bold">CONTEO DE BILLETES</h5>
                <i className="bi bi-cash-stack fs-4 text-warning"></i>
              </div>
              <div className="card-body p-4 bg-white d-flex flex-column flex-grow-1">
                <div className="table-responsive flex-grow-1">
                  <table className="table table-borderless align-middle mb-0">
                    <thead>
                      <tr className="text-muted small text-uppercase">
                        <th>Denominación</th>
                        <th className="text-center" style={{ width: '150px' }}>Cant. Billetes</th>
                        <th className="text-end">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billetes.map(den => (
                        <tr key={den} className="border-bottom border-light">
                          <td className="fw-bold text-dark fs-5">
                            ${den.toLocaleString()}
                          </td>
                          <td className="text-center">
                            <input 
                              type="text" 
                              inputMode="numeric"
                              className="form-control form-control-lg text-center bg-light border-0 rounded-3 fw-bold" 
                              placeholder="0"
                              value={cantBilletes[den]}
                              onChange={(e) => handleCantBilletesChange(den, e.target.value)}
                            />
                          </td>
                          <td className="text-end fw-bold text-dark fs-5">
                            ${(den * (parseInt(cantBilletes[den]) || 0)).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 p-3 rounded-3 bg-dark text-white d-flex justify-content-between align-items-center">
                    <span className="fw-bold text-uppercase">TOTAL BILLETES</span>
                    <span className="fw-bold text-warning fs-4">${totalBilletes.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* MONEDAS */}
          <div className="col-lg-6">
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden h-100 d-flex flex-column">
              <div className="card-header bg-warning text-dark py-3 px-4 border-0 d-flex justify-content-between align-items-center">
                <h5 className="mb-0 fw-bold">CONTEO DE MONEDAS</h5>
                <i className="bi bi-coin fs-4"></i>
              </div>
              <div className="card-body p-4 bg-white d-flex flex-column flex-grow-1">
                <div className="table-responsive flex-grow-1">
                  <table className="table table-borderless align-middle mb-0">
                    <thead>
                      <tr className="text-muted small text-uppercase">
                        <th>Denominación</th>
                        <th className="text-center" style={{ width: '150px' }}>Cant. Monedas</th>
                        <th className="text-end">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monedas.map(den => (
                        <tr key={den} className="border-bottom border-light">
                          <td className="fw-bold text-dark fs-5">
                            ${den.toLocaleString()}
                          </td>
                          <td className="text-center">
                            <input 
                              type="text" 
                              inputMode="numeric"
                              className="form-control form-control-lg text-center bg-light border-0 rounded-3 fw-bold" 
                              placeholder="0"
                              value={cantMonedas[den]}
                              onChange={(e) => handleCantMonedasChange(den, e.target.value)}
                            />
                          </td>
                          <td className="text-end fw-bold text-dark fs-5">
                            ${(den * (parseInt(cantMonedas[den]) || 0)).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 p-3 rounded-3 bg-dark text-white d-flex justify-content-between align-items-center">
                    <span className="fw-bold text-uppercase">TOTAL MONEDAS</span>
                    <span className="fw-bold text-warning fs-4">${totalMonedas.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* GRAN TOTAL Y COMPARATIVA */}
          <div className="col-12 mt-4">
            <div className="card border-0 shadow-lg rounded-5 overflow-hidden bg-dark text-white p-4 p-md-5">
              <div className="row align-items-center">
                <div className={`${esAdmin ? 'col-md-5 text-center text-md-start mb-4 mb-md-0' : 'col-12 text-center'}`}>
                  <div className="small text-white-50 text-uppercase fw-bold mb-2">Total Efectivo Físico</div>
                  <div className={`${esAdmin ? 'display-4' : 'display-3'} fw-bold text-warning`}>${totalEfectivo.toLocaleString()}</div>
                  <div className="small text-white-50 mt-2">Suma de Billetes + Monedas</div>
                </div>
                
                {esAdmin && (
                  <>
                    <div className="col-md-2 d-none d-md-flex justify-content-center">
                      <div className="vr bg-secondary opacity-50" style={{height: '100px'}}></div>
                    </div>

                    <div className="col-md-5 text-center text-md-end">
                      <div className="mb-4">
                        <div className="small text-white-50 text-uppercase fw-bold mb-1">Saldo Matemático (Sistema)</div>
                        <div className="h3 fw-bold">${saldoSistema.toLocaleString()}</div>
                      </div>
                      
                      <div className={`p-3 rounded-4 ${diferencia === 0 ? 'bg-success bg-opacity-25 border border-success' : (diferencia > 0 ? 'bg-warning bg-opacity-25 border border-warning' : 'bg-danger bg-opacity-25 border border-danger')}`}>
                        <div className="small text-uppercase fw-bold mb-1">
                          {diferencia === 0 ? 'Caja Cuadrada' : (diferencia > 0 ? 'Sobrante en Caja' : 'Faltante en Caja')}
                        </div>
                        <div className={`h2 fw-bold mb-0 ${diferencia === 0 ? 'text-success' : (diferencia > 0 ? 'text-warning' : 'text-danger')}`}>
                          ${Math.abs(diferencia).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="col-12 text-center pb-5">
            <p className="text-muted small">
              <i className="bi bi-info-circle me-2"></i>
              Use esta herramienta para verificar que el dinero físico en su gaveta coincida con el cupo digital reportado por el sistema.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
