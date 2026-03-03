"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Swal from 'sweetalert2';

export default function ConfigurarTarifas() {
  const [sucursal, setSucursal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Estados para las tarifas (Valores por defecto según Bancolombia)
  const [tarifas, setTarifas] = useState({
    entrada_fija: 160,
    entrada_porcentaje: 0.20,
    entrada_tope: 1600,
    salida_fija: 80,
    salida_porcentaje: 0.10,
    salida_tope: 800,
    apertura_app: 1500,
    seguro_alto: 2000,
    seguro_bajo: 1500
  });

  useEffect(() => {
    async function fetchData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from('perfiles')
          .select('*, sucursales(*)')
          .eq('id', session.user.id)
          .single();
        
        if (profile?.sucursales) {
          setSucursal(profile.sucursales);
          // Intentar cargar tarifas personalizadas de la DB
          const { data: config } = await supabase
            .from('tarifas_config')
            .select('*')
            .eq('sucursal_id', profile.sucursal_id)
            .single();
          
          if (config) {
            setTarifas(config.valores);
          }
        }
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('tarifas_config')
        .upsert({
          sucursal_id: sucursal.id,
          valores: tarifas,
          updated_at: new Date()
        }, { onConflict: 'sucursal_id' });

      if (error) throw error;

      Swal.fire({
        icon: 'success',
        title: 'Tarifas Actualizadas',
        text: 'Los cambios se aplicarán a las nuevas transacciones.',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-5 text-center"><div className="spinner-border text-warning"></div></div>;

  return (
    <div className="container py-4">
      <div className="header-box bg-dark text-white p-4 rounded-4 shadow-sm mb-4">
        <h2 className="fw-bold mb-0 text-warning">Configuración de Tarifas</h2>
        <p className="mb-0 text-white-50">Ajuste las comisiones que recibe su punto por cada operación.</p>
      </div>

      <div className="row g-4">
        {/* ENTRADAS */}
        <div className="col-md-6">
          <div className="card h-100 border-0 shadow-sm rounded-4">
            <div className="card-body p-4">
              <h5 className="fw-bold mb-4 d-flex align-items-center">
                <i className="bi bi-box-arrow-in-down text-info me-2 fs-4"></i>
                Comisiones de Entrada
              </h5>
              
              <div className="mb-3">
                <label className="form-label small fw-bold text-muted">TARIFA FIJA (HASTA $80.000)</label>
                <div className="input-group">
                  <span className="input-group-text bg-light border-0">$</span>
                  <input type="number" className="form-control border-0 bg-light" value={tarifas.entrada_fija} onChange={e => setTarifas({...tarifas, entrada_fija: parseFloat(e.target.value)})} />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-bold text-muted">PORCENTAJE ($80.001 - $799.999)</label>
                <div className="input-group">
                  <input type="number" step="0.01" className="form-control border-0 bg-light" value={tarifas.entrada_porcentaje} onChange={e => setTarifas({...tarifas, entrada_porcentaje: parseFloat(e.target.value)})} />
                  <span className="input-group-text bg-light border-0">%</span>
                </div>
              </div>

              <div className="mb-0">
                <label className="form-label small fw-bold text-muted">TOPE MÁXIMO (DESDE $800.000)</label>
                <div className="input-group">
                  <span className="input-group-text bg-light border-0">$</span>
                  <input type="number" className="form-control border-0 bg-light" value={tarifas.entrada_tope} onChange={e => setTarifas({...tarifas, entrada_tope: parseFloat(e.target.value)})} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SALIDAS */}
        <div className="col-md-6">
          <div className="card h-100 border-0 shadow-sm rounded-4">
            <div className="card-body p-4">
              <h5 className="fw-bold mb-4 d-flex align-items-center">
                <i className="bi bi-box-arrow-up text-warning me-2 fs-4"></i>
                Comisiones de Salida
              </h5>
              
              <div className="mb-3">
                <label className="form-label small fw-bold text-muted">TARIFA FIJA (HASTA $80.000)</label>
                <div className="input-group">
                  <span className="input-group-text bg-light border-0">$</span>
                  <input type="number" className="form-control border-0 bg-light" value={tarifas.salida_fija} onChange={e => setTarifas({...tarifas, salida_fija: parseFloat(e.target.value)})} />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-bold text-muted">PORCENTAJE ($80.001 - $799.999)</label>
                <div className="input-group">
                  <input type="number" step="0.01" className="form-control border-0 bg-light" value={tarifas.salida_porcentaje} onChange={e => setTarifas({...tarifas, salida_porcentaje: parseFloat(e.target.value)})} />
                  <span className="input-group-text bg-light border-0">%</span>
                </div>
              </div>

              <div className="mb-0">
                <label className="form-label small fw-bold text-muted">TOPE MÁXIMO (DESDE $800.000)</label>
                <div className="input-group">
                  <span className="input-group-text bg-light border-0">$</span>
                  <input type="number" className="form-control border-0 bg-light" value={tarifas.salida_tope} onChange={e => setTarifas({...tarifas, salida_tope: parseFloat(e.target.value)})} />
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      <div className="mt-5 text-center">
        <button 
          onClick={handleSave} 
          className={`btn btn-warning btn-lg px-5 py-3 fw-bold rounded-pill shadow ${saving ? 'disabled' : ''}`}
        >
          {saving ? (
            <><span className="spinner-border spinner-border-sm me-2"></span>Guardando...</>
          ) : (
            <><i className="bi bi-cloud-check-fill me-2"></i>Guardar Configuración Personalizada</>
          )}
        </button>
        <p className="text-muted small mt-3">Nota: Estas tarifas se usarán para calcular sus ganancias en tiempo real.</p>
      </div>
    </div>
  );
}
