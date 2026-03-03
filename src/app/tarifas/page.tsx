"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function TarifasPage() {
  const [sucursal, setSucursal] = useState<any>(null);

  useEffect(() => {
    async function fetchSucursal() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from('perfiles')
          .select('*, sucursales(*)')
          .eq('id', session.user.id)
          .single();
        if (profile) setSucursal(profile.sucursales);
      }
    }
    fetchSucursal();
  }, []);

  const tarifasEntrada = [
    { rango: 'Inferior o igual a $80.000,00', tarifa: '$160,00' },
    { rango: 'Entre $80.000,00 & $800.000,00', tarifa: '0,20%' },
    { rango: 'Superior o igual a $800.000,00', tarifa: '$1.600,00' },
  ];

  const tiposEntrada = [
    'Depósito cuenta ahorro', 'Depósito cuenta corriente', 'Recaudo Convenio Manual',
    'Recaudo Nequi', 'Recaudo Codensa', 'Recaudo Código de Barras',
    'Recaudo Tarjeta Empresarial', 'Pago de cartera', 'Abono Tarjeta Crédito'
  ];

  const tarifasSalida = [
    { rango: 'Inferior o igual a $80.000,00', tarifa: '$80,00' },
    { rango: 'Entre $80.000,00 & $800.000,00', tarifa: '0,10%' },
    { rango: 'Superior o igual a $800.000,00', tarifa: '$800,00' },
  ];

  const tiposSalida = [
    'Retiro con tarjeta', 'Retiro Pago en Efectivo', 'Retiro Ahorro a la mano',
    'Retiro Nequi', 'Avances tarjeta crédito'
  ];

  const portafolio = [
    { tipo: 'Apertura App Mi Bancolombia', tarifa: '$1,500' },
    { tipo: 'Venta de Seguro Alto', tarifa: '$2,000' },
    { tipo: 'Venta de Seguro Bajo', tarifa: '$1,500' },
  ];

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="fw-bold mb-0">Tablero de Tarifas</h2>
          <p className="text-muted mb-0">Comisiones y ganancias por operación para {sucursal?.nombre || 'Corresponsal'}</p>
        </div>
        <div className="d-flex gap-2">
          <Link href="/tarifas/editar" className="btn btn-dark px-3 py-2 rounded-3 shadow-sm d-flex align-items-center gap-2">
            <i className="bi bi-pencil-square"></i> Editar Tarifas
          </Link>
          <div className="bg-warning px-3 py-2 rounded-3 shadow-sm d-none d-md-block">
            <span className="fw-bold">Vigencia 2024-2025</span>
          </div>
        </div>
      </div>

      <div className="row g-4">
        {/* ENTRADAS */}
        <div className="col-12">
          <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
            <div className="card-header bg-dark text-white py-3 border-0">
              <div className="d-flex align-items-center">
                <div className="bg-primary p-2 rounded-circle me-3">
                  <i className="bi bi-box-arrow-in-down text-dark fs-5"></i>
                </div>
                <h5 className="mb-0 fw-bold">Operaciones de Entrada</h5>
              </div>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover mb-0 align-middle">
                  <thead className="bg-light">
                    <tr>
                      <th className="px-4 py-3 border-0 small text-uppercase text-muted">Rango de Monto</th>
                      <th className="px-4 py-3 border-0 small text-uppercase text-muted text-end">Comisión/Tarifa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tarifasEntrada.map((t, i) => (
                      <tr key={i}>
                        <td className="px-4 py-3 fw-medium text-dark">{t.rango}</td>
                        <td className="px-4 py-3 text-end fw-bold text-success">{t.tarifa}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 bg-light border-top border-light">
                <h6 className="small fw-bold text-muted text-uppercase mb-3">Servicios Incluidos</h6>
                <div className="d-flex flex-wrap gap-2">
                  {tiposEntrada.map((tipo, i) => (
                    <span key={i} className="badge bg-white text-dark shadow-sm border border-light-subtle rounded-pill px-3 py-2 fw-normal">
                      {tipo}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SALIDAS */}
        <div className="col-12">
          <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
            <div className="card-header bg-dark text-white py-3 border-0">
              <div className="d-flex align-items-center">
                <div className="bg-warning p-2 rounded-circle me-3">
                  <i className="bi bi-box-arrow-up text-dark fs-5"></i>
                </div>
                <h5 className="mb-0 fw-bold">Operaciones de Salida</h5>
              </div>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover mb-0 align-middle">
                  <thead className="bg-light">
                    <tr>
                      <th className="px-4 py-3 border-0 small text-uppercase text-muted">Rango de Monto</th>
                      <th className="px-4 py-3 border-0 small text-uppercase text-muted text-end">Comisión/Tarifa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tarifasSalida.map((t, i) => (
                      <tr key={i}>
                        <td className="px-4 py-3 fw-medium text-dark">{t.rango}</td>
                        <td className="px-4 py-3 text-end fw-bold text-success">{t.tarifa}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 bg-light border-top border-light">
                <h6 className="small fw-bold text-muted text-uppercase mb-3">Servicios Incluidos</h6>
                <div className="d-flex flex-wrap gap-2">
                  {tiposSalida.map((tipo, i) => (
                    <span key={i} className="badge bg-white text-dark shadow-sm border border-light-subtle rounded-pill px-3 py-2 fw-normal">
                      {tipo}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
