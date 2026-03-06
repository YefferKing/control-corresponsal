"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Toast } from '@/lib/utils';

import { usePermissions } from '@/hooks/usePermissions';
import Swal from 'sweetalert2';

export default function ReporteContadorMonedas() {
  const router = useRouter();
  const { hasPermission, loading: permLoading } = usePermissions();

  const [reporte, setReporte] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateStart, setDateStart] = useState(new Date().toISOString().split('T')[0]);
  const [dateEnd, setDateEnd] = useState(new Date().toISOString().split('T')[0]);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (!permLoading && !hasPermission('ver_reporte_movimientos')) {
      Swal.fire('Acceso Denegado', 'No tienes permisos para ver el historial del contador.', 'error');
      router.push('/dashboard');
    }
  }, [permLoading]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (profile) {
      fetchReporte();
    }
  }, [profile, dateStart, dateEnd]);

  async function fetchInitialData() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login');
      return;
    }

    const { data: profileData } = await supabase
      .from('perfiles')
      .select('*, roles(nombre)')
      .eq('id', session.user.id)
      .single();

    if (profileData) {
      setProfile(profileData);
    }
  }

  async function fetchReporte() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contadores_monedas')
        .select('*, perfiles(nombre_completo)')
        .eq('sucursal_id', profile.sucursal_id)
        .gte('created_at', new Date(dateStart).toISOString())
        .lte('created_at', new Date(dateEnd + 'T23:59:59').toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01') {
            setReporte([]); // Tabla no existe
        } else {
            throw error;
        }
      } else {
        setReporte(data || []);
      }
    } catch (e: any) {
      console.error(e);
      Toast.fire({ icon: 'error', title: 'Error al cargar reporte' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-vh-100 bg-light py-5">
      <div className="container px-4 px-md-5">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-5 gap-3">
          <div>
            <h1 className="fw-bold text-dark mb-1">Historial Contador de Monedas</h1>
            <p className="text-muted mb-0">Revisión de cierres físicos por cajero</p>
          </div>
          <div className="d-flex gap-2 align-items-center">
            <input 
                type="date" 
                className="form-control border-0 bg-white rounded-pill px-3 shadow-sm" 
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
            />
            <span className="text-muted">a</span>
            <input 
                type="date" 
                className="form-control border-0 bg-white rounded-pill px-3 shadow-sm" 
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
            />
            <Link href="/dashboard" className="btn btn-dark rounded-pill px-4 fw-bold shadow-sm ms-2">
              Volver
            </Link>
          </div>
        </div>

        <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="bg-dark text-white">
                <tr>
                  <th className="px-4 py-3">Fecha / Hora</th>
                  <th className="py-3">Cajero</th>
                  <th className="py-3 text-end">Total Billetes</th>
                  <th className="py-3 text-end">Total Monedas</th>
                  <th className="py-3 text-end">Efectivo Físico</th>
                  <th className="py-3 text-end">Saldo Sistema</th>
                  <th className="px-4 py-3 text-end">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                    <tr><td colSpan={7} className="text-center py-5"><div className="spinner-border text-warning"></div></td></tr>
                ) : reporte.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-5 text-muted">No hay registros para este período.</td></tr>
                ) : (
                    reporte.map((item) => (
                        <tr key={item.id}>
                            <td className="px-4 py-3 small">
                                <div className="fw-bold">{new Date(item.created_at).toLocaleDateString()}</div>
                                <div className="text-muted">{new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                            </td>
                            <td className="py-3 fw-bold">{item.perfiles?.nombre_completo}</td>
                            <td className="py-3 text-end text-muted small">${Number(item.total_billetes).toLocaleString()}</td>
                            <td className="py-3 text-end text-muted small">${Number(item.total_monedas).toLocaleString()}</td>
                            <td className="py-3 text-end fw-bold text-dark">${Number(item.total_efectivo).toLocaleString()}</td>
                            <td className="py-3 text-end text-muted small">${Number(item.saldo_sistema).toLocaleString()}</td>
                            <td className="px-4 py-3 text-end">
                                <span className={`badge rounded-pill px-3 py-2 ${item.diferencia === 0 ? 'bg-success bg-opacity-10 text-success' : (item.diferencia > 0 ? 'bg-warning bg-opacity-10 text-warning' : 'bg-danger bg-opacity-10 text-danger')}`}>
                                    {item.diferencia === 0 ? 'Cuadrada' : (item.diferencia > 0 ? `+ $${Number(item.diferencia).toLocaleString()}` : `- $${Math.abs(item.diferencia).toLocaleString()}`)}
                                </span>
                            </td>
                        </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {reporte.length > 0 && (
          <div className="mt-4 p-4 rounded-4 bg-white shadow-sm border-start border-warning border-4">
             <div className="row">
                <div className="col-md-4 text-center border-end">
                   <div className="small text-muted text-uppercase fw-bold">Conteos Realizados</div>
                   <div className="h3 fw-bold mb-0">{reporte.length}</div>
                </div>
                <div className="col-md-4 text-center border-end">
                   <div className="small text-muted text-uppercase fw-bold">Promedio Diferencia</div>
                   <div className="h3 fw-bold mb-0 text-danger">
                      ${Math.abs(reporte.reduce((acc, curr) => acc + curr.diferencia, 0) / reporte.length).toLocaleString()}
                   </div>
                </div>
                <div className="col-md-4 text-center">
                   <div className="small text-muted text-uppercase fw-bold">Efectivo Total Hoy</div>
                   <div className="h3 fw-bold mb-0 text-success">
                      ${reporte.reduce((acc, curr) => acc + Number(curr.total_efectivo), 0).toLocaleString()}
                   </div>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
