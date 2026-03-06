"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/hooks/usePermissions';
import Swal from 'sweetalert2';
import Link from 'next/link';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ReporteMovimientos() {
  const router = useRouter();
  const { hasPermission, loading: permLoading } = usePermissions();

  const [loading, setLoading] = useState(true);
  const [sucursal, setSucursal] = useState<any>(null);
  const [transacciones, setTransacciones] = useState<any[]>([]);
  const [filtroFecha, setFiltroFecha] = useState('hoy'); // hoy, semana, mes, personalizado
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [retefuente, setRetefuente] = useState(6); // Porcentaje de retención por defecto

  useEffect(() => {
    if (!permLoading && !hasPermission('ver_reporte_movimientos')) {
      Swal.fire('Acceso Denegado', 'No tienes permisos para ver reportes de movimientos.', 'error');
      router.push('/dashboard');
    }
  }, [permLoading]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (sucursal) {
      fetchTransacciones();
    }
  }, [filtroFecha, fechaInicio, fechaFin, sucursal]);

  async function fetchInitialData() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login');
      return;
    }

    const { data: profile } = await supabase
      .from('perfiles')
      .select('*, sucursales(*)')
      .eq('id', session.user.id)
      .single();

    if (profile && profile.sucursales) {
      setSucursal(profile.sucursales);
    } else {
      router.push('/login');
    }
  }

  async function fetchTransacciones() {
    setLoading(true);
    let query = supabase
      .from('transacciones')
      .select('*')
      .eq('sucursal_id', sucursal.id)
      .eq('estado', 'aprobada')
      .order('created_at', { ascending: false });

    const now = new Date();
    if (filtroFecha === 'hoy') {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      query = query.gte('created_at', hoy.toISOString());
    } else if (filtroFecha === 'semana') {
      const semana = new Date();
      semana.setDate(semana.getDate() - 7);
      query = query.gte('created_at', semana.toISOString());
    } else if (filtroFecha === 'mes') {
      const mes = new Date();
      mes.setMonth(mes.getMonth() - 1);
      query = query.gte('created_at', mes.toISOString());
    } else if (filtroFecha === 'personalizado' && fechaInicio && fechaFin) {
      query = query.gte('created_at', new Date(fechaInicio).toISOString())
                   .lte('created_at', new Date(fechaFin + 'T23:59:59').toISOString());
    }

    const { data } = await query;
    setTransacciones(data || []);
    setLoading(false);
  }

  const procesarDatos = () => {
    const resumen: any = {
      entradas: { monto: 0, comision: 0, count: 0, tipos: {} },
      salidas: { monto: 0, comision: 0, count: 0, tipos: {} }
    };

    transacciones.forEach(t => {
      const esEntrada = t.tipo === 'consignacion' || t.tipo === 'pago';
      const cat = esEntrada ? 'entradas' : 'salidas';
      
      resumen[cat].monto += Number(t.monto);
      resumen[cat].comision += Number(t.comision || 0);
      resumen[cat].count += 1;

      if (!resumen[cat].tipos[t.tipo]) {
        resumen[cat].tipos[t.tipo] = { monto: 0, comision: 0, count: 0 };
      }
      resumen[cat].tipos[t.tipo].monto += Number(t.monto);
      resumen[cat].tipos[t.tipo].comision += Number(t.comision || 0);
      resumen[cat].tipos[t.tipo].count += 1;
    });

    const totalComision = resumen.entradas.comision + resumen.salidas.comision;
    resumen.totalProduccion = totalComision;
    resumen.valorRetencion = totalComision * (retefuente / 100);
    resumen.netoRecibir = totalComision - resumen.valorRetencion;

    return resumen;
  };

  const resumenData = procesarDatos();

  const exportarPDF = () => {
    const doc = new jsPDF();
    const fecha = new Date().toLocaleDateString();

    doc.setFontSize(20);
    doc.setTextColor(40);
    doc.text('Reporte Detallado de Movimientos y Tarifas', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Sucursal: ${sucursal?.nombre} (${sucursal?.codigo_punto})`, 20, 35);
    doc.text(`Periodo: ${filtroFecha.toUpperCase()}`, 20, 42);
    doc.text(`Fecha de Emisión: ${fecha}`, 20, 49);

    // Tabla Resumen
    const bodyResumen = [
      ['ENTRADAS TOTALES', `$${resumenData.entradas.monto.toLocaleString()}`, `$${resumenData.entradas.comision.toLocaleString()}`, resumenData.entradas.count],
      ['SALIDAS TOTALES', `$${resumenData.salidas.monto.toLocaleString()}`, `$${resumenData.salidas.comision.toLocaleString()}`, resumenData.salidas.count]
    ];

    autoTable(doc, {
      startY: 60,
      head: [['Categoría', 'Monto Total', 'Tarifa/Comisión', 'Cant.']],
      body: bodyResumen,
      theme: 'striped',
      headStyles: { fillColor: [255, 221, 0], textColor: [0, 0, 0] }
    });

    const finalY = (doc as any).lastAutoTable.finalY;

    // Cuadro Contabilidad Producción
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('Resumen de Ganancias y Retención', 20, finalY + 15);
    
    const bodyContab = [
      ['TOTAL PRODUCCIÓN (TARIFAS BRUTAS)', `$${resumenData.totalProduccion.toLocaleString()}`],
      [`RETENCIÓN EN LA FUENTE (${retefuente}%)`, `$${resumenData.valorRetencion.toLocaleString()}`],
      ['NETO A RECIBIR', `$${resumenData.netoRecibir.toLocaleString()}`]
    ];

    autoTable(doc, {
      startY: finalY + 20,
      body: bodyContab,
      theme: 'grid',
      styles: { fontSize: 11, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right' } }
    });

    // Detalle por tipos
    doc.setFontSize(14);
    doc.text('Desglose por Tipo de Movimiento', 20, (doc as any).lastAutoTable.finalY + 15);

    const bodyTipos = [];
    for (const [tipo, data] of Object.entries(resumenData.entradas.tipos) as any) {
      bodyTipos.push(['ENTRADA', tipo.toUpperCase(), `$${data.monto.toLocaleString()}`, `$${data.comision.toLocaleString()}`, data.count]);
    }
    for (const [tipo, data] of Object.entries(resumenData.salidas.tipos) as any) {
      bodyTipos.push(['SALIDA', tipo.toUpperCase(), `$${data.monto.toLocaleString()}`, `$${data.comision.toLocaleString()}`, data.count]);
    }

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [['Flujo', 'Tipo', 'Monto', 'Tarifa', 'Cant.']],
      body: bodyTipos,
      theme: 'grid',
      headStyles: { fillColor: [26, 26, 26], textColor: [255, 255, 255] }
    });

    // Listado Detallado
    doc.addPage();
    doc.setFontSize(14);
    doc.text('Listado Detallado de Operaciones', 20, 20);
    
    const bodyDetalle = transacciones.map(t => [
      `${new Date(t.created_at).toLocaleDateString()} ${new Date(t.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`,
      t.tipo.toUpperCase(),
      `$${Number(t.monto).toLocaleString()}`,
      `$${Number(t.comision || 0).toLocaleString()}`,
      (t.tipo === 'consignacion' || t.tipo === 'pago') ? 'ENTRADA' : 'SALIDA'
    ]);

    autoTable(doc, {
      startY: 30,
      head: [['Fecha/Hora', 'Tipo', 'Monto', 'Tarifa', 'Flujo']],
      body: bodyDetalle,
      theme: 'striped',
      headStyles: { fillColor: [255, 221, 0], textColor: [0, 0, 0] }
    });

    doc.save(`Reporte_Movimientos_${sucursal?.codigo_punto}_${fecha.replace(/\//g, '-')}.pdf`);
  };

  return (
    <div className="min-vh-100 bg-light py-5">
      <div className="container px-4 px-md-5">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-5 gap-3">
          <div>
            <h1 className="fw-bold text-dark mb-1">Reporte de Movimientos</h1>
            <p className="text-muted mb-0">Análisis detallado de flujos y tarifas generadas</p>
          </div>
          <div className="d-flex gap-2">
            <button onClick={exportarPDF} className="btn btn-dark rounded-pill px-4 fw-bold shadow-sm d-flex align-items-center gap-2">
              <i className="bi bi-file-earmark-pdf"></i> Exportar PDF
            </button>
            <Link href="/dashboard" className="btn btn-outline-dark rounded-pill px-4 fw-bold shadow-sm">
              Volver
            </Link>
          </div>
        </div>

        <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white">
          <div className="row g-3 align-items-end">
            <div className="col-md-3">
              <label className="form-label small fw-bold text-muted text-uppercase">Periodo</label>
              <select className="form-select border-0 bg-light rounded-3" value={filtroFecha} onChange={(e) => setFiltroFecha(e.target.value)}>
                <option value="hoy">Hoy</option>
                <option value="semana">Últimos 7 días</option>
                <option value="mes">Último mes</option>
                <option value="personalizado">Rango Personalizado</option>
              </select>
            </div>
            {filtroFecha === 'personalizado' && (
              <>
                <div className="col-md-3">
                  <label className="form-label small fw-bold text-muted text-uppercase">Desde</label>
                  <input type="date" className="form-control border-0 bg-light rounded-3" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
                </div>
                <div className="col-md-3">
                  <label className="form-label small fw-bold text-muted text-uppercase">Hasta</label>
                  <input type="date" className="form-control border-0 bg-light rounded-3" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
                </div>
              </>
            )}
            <div className="col-md-3">
              <label className="form-label small fw-bold text-muted text-uppercase">Retención en la Fuente (%)</label>
              <div className="input-group overflow-hidden border-0 bg-light rounded-3">
                <input 
                  type="number" 
                  className="form-control border-0 bg-transparent text-center" 
                  value={retefuente} 
                  onChange={(e) => setRetefuente(Number(e.target.value))} 
                  min="0"
                  max="100"
                />
                <span className="input-group-text border-0 bg-transparent fw-bold">%</span>
              </div>
            </div>
            <div className="col-md-auto ms-auto">
               <button onClick={fetchTransacciones} className="btn btn-warning rounded-pill px-4 fw-bold text-dark">
                  <i className="bi bi-arrow-clockwise me-2"></i>Actualizar
               </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-5"><div className="spinner-border text-warning"></div></div>
        ) : (
          <div className="row g-4 mb-5">
            {/* ENTRADAS */}
            <div className="col-lg-6">
              <div className="card border-0 shadow-sm rounded-4 overflow-hidden h-100 bg-white">
                <div className="card-header bg-success text-white py-3 px-4 border-0">
                  <div className="d-flex justify-content-between align-items-center">
                    <h5 className="mb-0 fw-bold">ENTRADAS</h5>
                    <i className="bi bi-box-arrow-in-down fs-4"></i>
                  </div>
                </div>
                <div className="card-body p-4">
                  <div className="d-flex justify-content-between align-items-center mb-4">
                    <div>
                      <div className="small text-muted text-uppercase fw-bold">Volumen Total</div>
                      <div className="h2 fw-bold text-dark mb-0">${resumenData.entradas.monto.toLocaleString()}</div>
                    </div>
                    <div className="text-end">
                      <div className="small text-muted text-uppercase fw-bold">Tarifas / Ganancia</div>
                      <div className="h4 fw-bold text-success mb-0">+${resumenData.entradas.comision.toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="table-responsive">
                    <table className="table table-sm table-hover mb-0">
                      <thead className="small text-muted text-uppercase">
                        <tr>
                          <th>Tipo</th>
                          <th className="text-end">Monto</th>
                          <th className="text-end">Tarifa</th>
                          <th className="text-center">Cant.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.keys(resumenData.entradas.tipos).length === 0 ? (
                          <tr><td colSpan={4} className="text-center py-3 text-muted italic">Sin movimientos registrados</td></tr>
                        ) : (
                          Object.entries(resumenData.entradas.tipos).map(([tipo, data]: any) => (
                            <tr key={tipo}>
                              <td className="text-capitalize fw-bold">{tipo.replace('_', ' ')}</td>
                              <td className="text-end">${data.monto.toLocaleString()}</td>
                              <td className="text-end text-success fw-bold">${data.comision.toLocaleString()}</td>
                              <td className="text-center">{data.count}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* SALIDAS */}
            <div className="col-lg-6">
              <div className="card border-0 shadow-sm rounded-4 overflow-hidden h-100 bg-white">
                <div className="card-header bg-danger text-white py-3 px-4 border-0">
                  <div className="d-flex justify-content-between align-items-center">
                    <h5 className="mb-0 fw-bold">SALIDAS</h5>
                    <i className="bi bi-box-arrow-up fs-4"></i>
                  </div>
                </div>
                <div className="card-body p-4">
                  <div className="d-flex justify-content-between align-items-center mb-4">
                    <div>
                      <div className="small text-muted text-uppercase fw-bold">Volumen Total</div>
                      <div className="h2 fw-bold text-dark mb-0">${resumenData.salidas.monto.toLocaleString()}</div>
                    </div>
                    <div className="text-end">
                      <div className="small text-muted text-uppercase fw-bold">Tarifas / Ganancia</div>
                      <div className="h4 fw-bold text-success mb-0">+${resumenData.salidas.comision.toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="table-responsive">
                    <table className="table table-sm table-hover mb-0">
                      <thead className="small text-muted text-uppercase">
                        <tr>
                          <th>Tipo</th>
                          <th className="text-end">Monto</th>
                          <th className="text-end">Tarifa</th>
                          <th className="text-center">Cant.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.keys(resumenData.salidas.tipos).length === 0 ? (
                          <tr><td colSpan={4} className="text-center py-3 text-muted italic">Sin movimientos registrados</td></tr>
                        ) : (
                          Object.entries(resumenData.salidas.tipos).map(([tipo, data]: any) => (
                            <tr key={tipo}>
                              <td className="text-capitalize fw-bold">{tipo.replace('_', ' ')}</td>
                              <td className="text-end">${data.monto.toLocaleString()}</td>
                              <td className="text-end text-success fw-bold">${data.comision.toLocaleString()}</td>
                              <td className="text-center">{data.count}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* BALANCE GENERAL Y LIQUIDACIÓN - PREMIUM DESIGN */}
            <div className="col-12 mt-4">
                <div className="card border-0 shadow-lg rounded-5 overflow-hidden bg-dark text-white position-relative">
                    {/* Background Accent */}
                    <div className="position-absolute top-0 start-0 w-100 h-100 bg-gradient-dark opacity-50"></div>
                    
                    <div className="card-body p-4 p-md-5 position-relative z-1">
                        <div className="row g-4 align-items-center">
                            {/* Producción Bruta */}
                            <div className="col-md-3 text-center text-md-start">
                                <span className="badge bg-warning text-dark mb-2 px-3 py-2 rounded-pill fw-bold text-uppercase" style={{fontSize: '0.65rem', letterSpacing: '1px'}}>Producción Total</span>
                                <h2 className="fw-bold mb-0 text-white" style={{ fontSize: 'clamp(1.5rem, 5vw, 2.5rem)' }}>${resumenData.totalProduccion.toLocaleString()}</h2>
                                <p className="text-white-50 small mt-1 mb-0">Total Tarifas Brutas</p>
                            </div>

                            {/* Operación Matemática (Minus/Equals icons) */}
                            <div className="col-md-1 d-none d-md-flex justify-content-center">
                                <div className="bg-white bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center" style={{width: '40px', height: '40px'}}>
                                    <i className="bi bi-dash-lg fs-4 text-danger"></i>
                                </div>
                            </div>

                            {/* Retención */}
                            <div className="col-md-3 text-center text-md-start">
                                <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 mb-2 px-3 py-2 rounded-pill fw-bold text-uppercase" style={{fontSize: '0.65rem', letterSpacing: '1px'}}>Retención ({retefuente}%)</span>
                                <h2 className="fw-bold mb-0 text-danger" style={{ fontSize: 'clamp(1.5rem, 5vw, 2.5rem)' }}>-${resumenData.valorRetencion.toLocaleString()}</h2>
                                <p className="text-white-50 small mt-1 mb-0">Deducción de Ley</p>
                            </div>

                            {/* Neto Highlight */}
                            <div className="col-md-5 text-center">
                                <div className="p-3 p-md-4 rounded-5 bg-gradient-success-dark shadow-inset border border-white border-opacity-10 mt-3 mt-md-0">
                                    <h6 className="text-uppercase fw-bold text-white-50 mb-2" style={{letterSpacing: '2px', fontSize: '0.65rem'}}>NETO A RECIBIR (REAL)</h6>
                                    <div className="fw-bold text-success mb-2" style={{textShadow: '0 0 20px rgba(25, 135, 84, 0.3)', fontSize: 'clamp(2rem, 8vw, 3.5rem)'}}>
                                        ${resumenData.netoRecibir.toLocaleString()}
                                    </div>
                                    <div className="d-flex justify-content-center gap-3 gap-md-4 mt-3 pt-3 border-top border-white border-opacity-10">
                                        <div className="text-center">
                                            <div className="h5 fw-bold mb-0" style={{ fontSize: 'clamp(1rem, 3vw, 1.25rem)' }}>{resumenData.entradas.count + resumenData.salidas.count}</div>
                                            <div className="small text-white-50 text-uppercase" style={{fontSize: '0.55rem'}}>Operaciones</div>
                                        </div>
                                        <div className="text-center">
                                            <div className={`h5 fw-bold mb-0 ${resumenData.entradas.monto - resumenData.salidas.monto >= 0 ? 'text-success' : 'text-danger'}`} style={{ fontSize: 'clamp(1rem, 3vw, 1.25rem)' }}>
                                                ${Math.abs(resumenData.entradas.monto - resumenData.salidas.monto).toLocaleString()}
                                            </div>
                                            <div className="small text-white-50 text-uppercase" style={{fontSize: '0.55rem'}}>Flujo Neto</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* LISTADO DETALLADO */}
            <div className="col-12 mt-5">
              <div className="card border-0 shadow-sm rounded-4 bg-white overflow-hidden">
                <div className="card-header bg-white py-4 px-4 border-bottom d-flex justify-content-between align-items-center">
                  <h5 className="fw-bold mb-0 text-dark">Listado Detallado de Operaciones</h5>
                  <span className="badge bg-light text-dark border px-3">{transacciones.length} Registros</span>
                </div>
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="bg-light text-muted small text-uppercase">
                      <tr>
                        <th className="ps-4">Fecha / Hora</th>
                        <th>Tipo Operación</th>
                        <th className="text-end">Monto Real</th>
                        <th className="text-end">Tarifa</th>
                        <th className="text-center">Flujo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transacciones.length === 0 ? (
                        <tr><td colSpan={5} className="text-center py-5 text-muted">No se encontraron movimientos para este periodo.</td></tr>
                      ) : (
                        transacciones.map(t => {
                          const esEntrada = t.tipo === 'consignacion' || t.tipo === 'pago';
                          return (
                            <tr key={t.id}>
                              <td className="ps-4">
                                <div className="fw-bold">{new Date(t.created_at).toLocaleDateString()}</div>
                                <div className="small text-muted">{new Date(t.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                              </td>
                              <td className="text-capitalize">{t.tipo.replace('_', ' ')}</td>
                              <td className="text-end fw-bold">${Number(t.monto).toLocaleString()}</td>
                              <td className="text-end text-success fw-bold">+${Number(t.comision || 0).toLocaleString()}</td>
                              <td className="text-center">
                                <span className={`badge rounded-pill ${esEntrada ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'} px-3`}>
                                  {esEntrada ? 'ENTRADA' : 'SALIDA'}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
