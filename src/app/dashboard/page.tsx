"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Toast } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';

export default function Dashboard() {
  const [sucursal, setSucursal] = useState<any>(null);
  const [transacciones, setTransacciones] = useState<any[]>([]);
  const [ganancias, setGanancias] = useState(0);
  const [saldoInicial, setSaldoInicial] = useState(0);
  const [movimientosHoy, setMovimientosHoy] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [profile, setProfile] = useState<any>(null);
  const [saldoCierreAnterior, setSaldoCierreAnterior] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const [dateStart, setDateStart] = useState(today);
  const [dateEnd, setDateEnd] = useState(today);
  const [resumenFiltrado, setResumenFiltrado] = useState({ entradasCount: 0, entradasMonto: 0, salidasCount: 0, salidasMonto: 0 });
  const PAGE_SIZE = 10;
  const router = useRouter();
  const { hasPermission, profile: userProfile, loading: permLoading } = usePermissions();

  useEffect(() => {
    if (!permLoading && !hasPermission('ver_dashboard')) {
      Swal.fire('Sin Acceso', 'No tienes permisos para ver el Dashboard.', 'warning');
      router.push('/');
      return;
    }
  }, [permLoading, userProfile]);

  useEffect(() => {
    fetchData();
    // ... rest of the code

    // Actualizar reloj cada segundo
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Escuchar actualizaciones de cupo desde otros componentes
    const handleRefresh = () => fetchData(); // Call fetchData to refresh all data including sucursal
    window.addEventListener('refreshSucursal', handleRefresh);
    
    return () => {
      window.removeEventListener('refreshSucursal', handleRefresh);
      clearInterval(clockInterval);
    };
  }, [router, page, searchTerm, dateStart, dateEnd]); // Keep existing dependencies for fetchData

  async function fetchData() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      router.push('/login');
      return;
    }

    const { data: profile } = await supabase
      .from('perfiles')
      .select('*, sucursales(*), roles(nombre)')
      .eq('id', session.user.id)
      .single();

    if (profile && profile.sucursales) {
      setProfile(profile);
      setSucursal(profile.sucursales);
      
      const soyAdmin = hasPermission('gestionar_sucursal');

      let query = supabase
        .from('transacciones')
        .select('*, perfiles(nombre_completo), sucursales(nombre, codigo_punto)', { count: 'exact' })
        .eq('sucursal_id', profile.sucursal_id);
      
      // Filtro por Usuario (Si no es admin de la sucursal, solo ve lo suyo)
      if (!soyAdmin) {
        query = query.eq('usuario_id', session.user.id);
      }
      
      if (searchTerm) {
        // ... previous search logic
        const cleanSearch = searchTerm.replace(/\./g, '').replace(/,/g, '');
        let orFilter = `tipo.ilike.%${searchTerm}%,estado.ilike.%${searchTerm}%`;
        if (!isNaN(Number(cleanSearch)) && cleanSearch !== '') {
          orFilter += `,monto.eq.${cleanSearch}`;
        }
        query = query.or(orFilter);
      }

      // Filtro de Fechas
      if (dateStart) query = query.gte('created_at', new Date(dateStart).toISOString());
      if (dateEnd) query = query.lte('created_at', new Date(dateEnd + 'T23:59:59').toISOString());
      
      const { data: trans, count } = await query
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      
      // Calcular Totales
      let totalsQuery = supabase
        .from('transacciones')
        .select('monto, tipo')
        .eq('sucursal_id', profile.sucursal_id)
        .eq('estado', 'aprobada');
      
      if (!soyAdmin) totalsQuery = totalsQuery.eq('usuario_id', session.user.id);
      if (dateStart) totalsQuery = totalsQuery.gte('created_at', new Date(dateStart).toISOString());
      if (dateEnd) totalsQuery = totalsQuery.lte('created_at', new Date(dateEnd + 'T23:59:59').toISOString());

      const { data: totalData } = await totalsQuery;
      
      const resumen = totalData?.reduce((acc, curr) => {
        const esEntrada = curr.tipo === 'consignacion' || curr.tipo === 'pago';
        if (esEntrada) {
          acc.entradasCount++;
          acc.entradasMonto += Number(curr.monto);
        } else {
          acc.salidasCount++;
          acc.salidasMonto += Number(curr.monto);
        }
        return acc;
      }, { entradasCount: 0, entradasMonto: 0, salidasCount: 0, salidasMonto: 0 }) || { entradasCount: 0, entradasMonto: 0, salidasCount: 0, salidasMonto: 0 };
      
      setResumenFiltrado(resumen);

      if (trans) {
        setTransacciones(trans);
        setTotalCount(count || 0);

        // Calcular ganancias y flujo de efectivo del DÍA
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        
        const { data: transHoyData } = await supabase
          .from('transacciones')
          .select('monto, tipo, comision')
          .eq('sucursal_id', profile.sucursal_id)
          .eq('estado', 'aprobada')
          .gte('created_at', hoy.toISOString());

        const totalGanadoDay = transHoyData?.reduce((acc, curr) => acc + (Number(curr.comision) || 0), 0) || 0;
        
        // Sumatoria de cómo cambió el EFECTIVO hoy
        // Entrada (+Cash), Salida (-Cash), Compensación (-Cash)
        const flujoEfectivoHoy = transHoyData?.reduce((acc, curr) => {
          if (curr.tipo === 'consignacion' || curr.tipo === 'pago') return acc + Number(curr.monto);
          if (curr.tipo === 'retiro' || curr.tipo === 'compensacion') return acc - Number(curr.monto);
          return acc;
        }, 0) || 0;

        const efActual = (profile.sucursales.cupo_actual); // Ahora el saldo es directamente el cupo_actual
        
        // Cargar saldo de cierre guardado (simulado o desde DB si existiera el campo)
        const savedCierre = localStorage.getItem(`cierre_${profile.sucursal_id}`);
        if (savedCierre) {
          setSaldoCierreAnterior(Number(savedCierre));
        } else {
          setSaldoCierreAnterior(0); // Ahora por defecto es 0 si no hay registro manual
        }

        setGanancias(totalGanadoDay);
        setMovimientosHoy(flujoEfectivoHoy);
        setSaldoInicial(efActual - flujoEfectivoHoy);
      }
    } else {
      router.push('/login');
    }
    
    setLoading(false);
  }

  const ejecutarCierreSilencioso = async (sucObj: any, fechaReferencia?: string) => {
    if (!sucObj) return;
    try {
      const today = new Date().toLocaleDateString('es-CO');
      const historyKey = `history_cierres_${sucObj.id}`;
      const existingHistory = JSON.parse(localStorage.getItem(historyKey) || '[]');
      
      // Si ya hay cierre para HOY, no hacemos nada (a menos que sea recuperación)
      if (!fechaReferencia && existingHistory.some((h: any) => h.fecha === today)) return;

      const fechaFinal = fechaReferencia || today;

      const newEntry = { 
        fecha: fechaFinal, 
        saldo: sucObj.cupo_actual, 
        timestamp: new Date().toISOString(),
        tipo: fechaReferencia ? 'RECUPERADO' : 'AUTOMÁTICO' 
      };
      
      const updatedHistory = [newEntry, ...existingHistory.filter((h:any) => h.fecha !== fechaFinal)];
      localStorage.setItem(historyKey, JSON.stringify(updatedHistory));
      localStorage.setItem(`cierre_${sucObj.id}`, sucObj.cupo_actual.toString());
      setSaldoCierreAnterior(sucObj.cupo_actual);

      console.log(`Cierre ${newEntry.tipo} realizado para ${fechaFinal}`);
      
      if (!fechaReferencia) {
        Toast.fire({
          icon: 'info',
          title: 'Cierre automático realizado',
          position: 'bottom-end',
          timer: 3000
        });
      }
    } catch (e) {
      console.error("Error en cierre automático:", e);
    }
  };

  const handleRealizarCierre = async () => {
    const { isConfirmed } = await Swal.fire({
      title: '¿Realizar Cierre de Caja?',
      text: `Se registrará el saldo actual ($${Number(sucursal?.cupo_actual).toLocaleString()}) como el cierre del día. Esta acción generará el reporte final.`,
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: 'Sí, cerrar caja',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ffdd00',
      cancelButtonColor: '#333'
    });

    if (isConfirmed) {
      try {
        setLoading(true);
        // Guardamos el cierre en el historial para consulta posterior
        const today = new Date().toLocaleDateString('es-CO');
        const historyKey = `history_cierres_${sucursal.id}`;
        const existingHistory = JSON.parse(localStorage.getItem(historyKey) || '[]');
        
        // Evitar duplicados para el mismo día (opcional, o permitir múltiples cierres)
        const newEntry = { fecha: today, saldo: sucursal.cupo_actual, timestamp: new Date().toISOString() };
        const updatedHistory = [newEntry, ...existingHistory.filter((h: any) => h.fecha !== today)];
        
        localStorage.setItem(historyKey, JSON.stringify(updatedHistory));
        localStorage.setItem(`cierre_${sucursal.id}`, sucursal.cupo_actual.toString());
        setSaldoCierreAnterior(sucursal.cupo_actual);
        
        // Generar el PDF automáticamente
        generarReporteCierre();
        
        Toast.fire({
          icon: 'success',
          title: 'Cierre Exitoso'
        });
      } catch (error: any) {
        Swal.fire('Error', error.message, 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!sucursal) return;

    const interval = setInterval(() => {
      const now = new Date();
      // Si son más de las 11:50 PM, intentar cierre automático
      if (now.getHours() === 23 && now.getMinutes() >= 50) {
        ejecutarCierreSilencioso(sucursal);
      }
    }, 60000); // Revisar cada minuto

    // LÓGICA DE RECUPERACIÓN: Si abres hoy y no hay cierre de ayer (o días anteriores)
    const today = new Date().toLocaleDateString('es-CO');
    const historyKey = `history_cierres_${sucursal.id}`;
    const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
    const lastEntry = history[0];

    if (lastEntry && lastEntry.fecha !== today) {
       // Si el último cierre es viejo, significa que ayer no se cerró la caja
       // Hacemos un cierre "Retroactivo" con el último saldo conocido
       ejecutarCierreSilencioso(sucursal, lastEntry.fecha); 
       setSaldoCierreAnterior(lastEntry.saldo);
    } else if (lastEntry) {
       setSaldoCierreAnterior(lastEntry.saldo);
    }

    return () => clearInterval(interval);
  }, [sucursal]);

  const verHistorialCierres = () => {
    const historyKey = `history_cierres_${sucursal?.id}`;
    const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
    
    if (history.length === 0) {
      Swal.fire({
        title: 'Sin Historial',
        text: 'Aún no se han registrado cierres en este punto.',
        icon: 'info',
        confirmButtonColor: '#ffdd00'
      });
      return;
    }

    const html = `
      <div class="table-responsive">
        <table class="table table-sm table-hover text-start">
          <thead class="bg-light">
            <tr>
              <th class="ps-3 py-2">Fecha</th>
              <th class="text-end pe-3 py-2">Saldo de Cierre</th>
            </tr>
          </thead>
          <tbody>
            ${history.map((h: any) => `
              <tr style="cursor: default;">
                <td class="ps-3 py-2 fw-bold text-dark">
                  ${h.fecha} 
                  ${h.tipo ? `<span class="badge bg-light text-muted border ms-2" style="font-size: 0.6rem;">${h.tipo}</span>` : ''}
                </td>
                <td class="text-end pe-3 py-2 fw-bold text-dark">$${Number(h.saldo).toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    Swal.fire({
      title: 'Historial de Cierres Diarios',
      html,
      width: '500px',
      confirmButtonText: 'Cerrar',
      confirmButtonColor: '#ffdd00'
    });
  };

  const generarRecibo = (t: any) => {
    const doc = new jsPDF({
      unit: 'mm',
      format: [80, 150] // Formato de tirilla tipo térmica (80mm ancho)
    });

    const centerX = 40;
    
    // Encabezado
    doc.setFontSize(8);
    doc.text('CORRESPONSAL BANCARIO', centerX, 10, { align: 'center' });
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('FlashBank', centerX, 18, { align: 'center' });
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`${sucursal?.nombre}`, centerX, 24, { align: 'center' });
    doc.text(`Código Punto: ${sucursal?.codigo_punto}`, centerX, 26, { align: 'center' });
    doc.text('-------------------------------------------', centerX, 30, { align: 'center' });

    // Datos de la transacción
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(t.tipo.toUpperCase(), centerX, 36, { align: 'center' });
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Fecha: ${new Date(t.created_at).toLocaleDateString()}`, 10, 45);
    doc.text(`Hora: ${new Date(t.created_at).toLocaleTimeString()}`, 10, 50);
    doc.text(`Referencia: ${t.referencia || 'N/A'}`, 10, 55);
    doc.text(`Cajero: ${t.perfiles?.nombre_completo}`, 10, 60);
    
    doc.text('-------------------------------------------', centerX, 65, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`VALOR: $${Number(t.monto).toLocaleString()}`, centerX, 75, { align: 'center' });
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('-------------------------------------------', centerX, 85, { align: 'center' });
    doc.text('¡Gracias por preferirnos!', centerX, 92, { align: 'center' });
    doc.text('Vigilado Superintendencia Financiera', centerX, 96, { align: 'center' });

    // Descargar/Abrir
    doc.save(`Recibo_${t.id.substring(0, 8)}.pdf`);
    
    Toast.fire({
      icon: 'success',
      title: 'Recibo Generado'
    });
  };

  const generarReporteCierre = () => {
    const doc = new jsPDF();
    const fecha = new Date().toLocaleDateString();

    doc.setFontSize(18);
    doc.text('Reporte de Cierre de Caja', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Sucursal: ${sucursal?.nombre} (${sucursal?.codigo_punto})`, 20, 35);
    doc.text(`Fecha de Reporte: ${fecha}`, 20, 42);
    doc.text(`Cupo Actual en Sistema: $${Number(sucursal?.cupo_actual).toLocaleString('es-CO', { minimumFractionDigits: 2 })}`, 20, 49);

    const dataReporte = transacciones.map(t => [
      new Date(t.created_at).toLocaleTimeString(),
      t.tipo.toUpperCase(),
      t.referencia || 'N/A',
      t.perfiles?.nombre_completo,
      `${t.tipo === 'retiro' ? '+' : '-'}$${Number(t.monto).toLocaleString()}`
    ]);

    autoTable(doc, {
      startY: 60,
      head: [['Hora', 'Tipo', 'Referencia', 'Cajero', 'Valor']],
      body: dataReporte,
      theme: 'grid',
      headStyles: { fillColor: '#ffdd00', textColor: '#000' }
    });

    doc.save(`Cierre_${sucursal?.codigo_punto}_${fecha.replace(/\//g, '-')}.pdf`);
  };

  const handleAnular = async (t: any) => {
    if (!hasPermission('anular_transaccion')) {
      Swal.fire('Acceso Denegado', 'No tienes permisos para anular transacciones.', 'error');
      return;
    }
    const result = await Swal.fire({
      title: '¿Anular transacción?',
      text: `Se revertirá el valor de $${Number(t.monto).toLocaleString()} del cupo.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, anular',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        // Calcular el reverso del saldo (Regla Billetera)
        let ajusteCupo = sucursal.cupo_actual;
        
        if (t.tipo === 'consignacion' || t.tipo === 'pago') {
          // Fue ENTRADA (+): El reverso RESTA (-)
          ajusteCupo = Number(sucursal.cupo_actual) - Number(t.monto);
        } else if (t.tipo === 'retiro') {
          // Fue SALIDA (-): El reverso SUMA (+)
          ajusteCupo = Number(sucursal.cupo_actual) + Number(t.monto);
        } else if (t.tipo === 'compensacion') {
          // La compensación descargó el saldo (lo bajó), anularla debe devolverlo al cajón (lo sube)
          ajusteCupo = Number(sucursal.cupo_actual) + Number(t.monto);
        }

        // 1. Actualizar estado de transacción
        const { error: errorStatus } = await supabase
          .from('transacciones')
          .update({ estado: 'anulada' })
          .eq('id', t.id);

        if (errorStatus) throw errorStatus;

        // 2. Revertir cupo de sucursal
        const { error: errorCupo } = await supabase
          .from('sucursales')
          .update({ cupo_actual: ajusteCupo })
          .eq('id', sucursal.id);

        if (errorCupo) throw errorCupo;

        // 3. Notificar a la Navbar que el cupo cambió
        window.dispatchEvent(new Event('refreshSucursal'));

        Toast.fire({
          icon: 'success',
          title: 'Transacción Anulada'
        });
        fetchData(); // Recargar datos
      } catch (error: any) {
        Swal.fire('Error', error.message, 'error');
      }
    }
  };

  const handleEliminar = async (id: string) => {
    const result = await Swal.fire({
      title: '¿Eliminar permanentemente?',
      text: "Esta acción no se puede deshacer y el registro desaparecerá del historial.",
      icon: 'error',
      showCancelButton: true,
      confirmButtonColor: '#000',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        const { error } = await supabase
          .from('transacciones')
          .delete()
          .eq('id', id);

        if (error) throw error;

        // Note: Deleting a transaction might affect cupo_actual if it was not anulada first.
        // For simplicity, we assume anular is done before deleting if cupo needs adjustment.
        // If direct deletion should also revert cupo, that logic needs to be added here.
        // For now, just refresh data.
        window.dispatchEvent(new Event('refreshSucursal'));

        Toast.fire({
          icon: 'success',
          title: 'Registro Eliminado'
        });
        
        fetchData();
      } catch (error: any) {
        Swal.fire('Error', error.message, 'error');
      }
    }
  };

  const handleCompensar = async () => {
    const efectivoEnCaja = Number(sucursal.cupo_actual);
    const esAFavor = efectivoEnCaja < 0;
    
    const { value: montoCompensar } = await Swal.fire({
      title: esAFavor ? 'Recuperar Saldo (A Favor)' : 'Realizar Compensación',
      text: esAFavor 
        ? `Actualmente tienes $${Math.abs(efectivoEnCaja).toLocaleString('es-CO', { minimumFractionDigits: 2 })} a favor (pusiste de tu dinero). ¿Deseas que el banco te devuelva el efectivo?`
        : `Entregue el efectivo recaudado en caja al banco para liberar su cupo digital. Saldo en caja: $${efectivoEnCaja.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`,
      input: 'text',
      inputLabel: 'Monto a entregar/recibir del banco',
      inputValue: '',
      showCancelButton: true,
      confirmButtonText: 'Confirmar Depósito',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ffdd00',
      customClass: {
        confirmButton: 'text-dark fw-bold px-4 rounded-pill py-2',
        cancelButton: 'btn btn-secondary px-4 rounded-pill py-2'
      },
      buttonsStyling: true,
      didOpen: () => {
        const input = Swal.getInput();
        if (input) {
          input.addEventListener('input', (e: any) => {
            const val = e.target.value;
            e.target.value = formatN2(val);
          });
        }
      },
      inputValidator: (value) => {
        if (!value) return 'Debes ingresar un monto';
        if (parseFloat(value.replace(/\./g, '')) <= 0) return 'El monto debe ser mayor a 0';
      }
    });

    if (montoCompensar) {
      const valor = parseFloat(montoCompensar.replace(/\./g, ''));
      try {
        setLoading(true);
        // 1. Registrar movimiento de compensación
        const { error: transError } = await supabase
          .from('transacciones')
          .insert([{
            sucursal_id: sucursal.id,
            usuario_id: (await supabase.auth.getSession()).data.session?.user.id,
            monto: valor,
            tipo: 'compensacion',
            comision: 0,
            estado: 'aprobada'
          }]);

        if (transError) throw transError;

        // 2. Disminuir el saldo físico (porque entregué el efectivo al banco)
        // Esto libera automáticamente el "Cupo Disponible"
        const { error: sucursalError } = await supabase
          .from('sucursales')
          .update({ cupo_actual: Number(sucursal.cupo_actual) - valor })
          .eq('id', sucursal.id);

        if (sucursalError) throw sucursalError;

        // 3. Notificar a la Navbar que el cupo cambió
        window.dispatchEvent(new Event('refreshSucursal'));

        Toast.fire({
          icon: 'success',
          title: 'Compensado con éxito'
        });
        fetchData();
      } catch (error: any) {
        Swal.fire('Error', error.message, 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  const formatN2 = (value: string) => {
    const numericValue = value.replace(/\D/g, "");
    if (!numericValue) return "";
    return new Intl.NumberFormat('es-CO').format(parseInt(numericValue));
  };

  if (loading) return (
    <div className="d-flex justify-content-center align-items-center vh-100 text-warning">
      <div className="spinner-border" role="status"></div>
    </div>
  );

  const porcentajeCupoUtilizado = sucursal ? (sucursal.cupo_actual / sucursal.cupo_limite) * 100 : 0;
  const saldoEnCaja = sucursal ? sucursal.cupo_actual : 0;
  const cupoDisponible = sucursal ? (sucursal.cupo_limite - sucursal.cupo_actual) : 0;
  
  const soyAdmin = hasPermission('gestionar_sucursal');

  return (
    <div className="min-vh-100 bg-light py-4">
      <div className="container-fluid px-3 px-md-5">
        {/* LOGO Y SALUDO ALINEADOS AL CONTENEDOR */}
        <div className="row align-items-center mb-4">
              <div className="col-auto">
                  <img src="https://somos.bancolombia.com/images/logo_somos.png" alt="Somos" style={{height: '35px'}} onError={(e:any) => e.target.src = 'https://portal_bancolombia.vtexassets.com/assets/vtex.file-manager-graphql/images/f8146749-965c-49ab-9f46-8abee36b3cd1___268846c483984d5df656a47a1f59235d.png'} />
              </div>
              <div className="col d-flex justify-content-end align-items-center gap-4">
                  <div className="text-end">
                      <div className="small text-muted mb-0">¡Hola!</div>
                      <div className="fw-bold h5 mb-0 text-dark text-uppercase">{profile?.nombre_completo || 'USUARIO'}</div>
                  </div>
              </div>
        </div>

        {/* MÉTRICAS RESPONSIVAS (DISEÑO LIMPIO Y CENTRADO) */}
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden mb-4 bg-white">
            <div className="row g-0 align-items-center text-center py-2">
                {/* Código de Punto */}
                <div className="col-12 col-md-2 py-3 border-md-end">
                    <div className="small fw-bold text-muted text-uppercase mb-1" style={{fontSize: '0.6rem', letterSpacing: '0.05rem'}}>Código de punto:</div>
                    <div className="fw-bold text-dark">{sucursal?.codigo_punto}</div>
                </div>
                
                {/* Saldo Principal */}
                <div className="col-12 col-md-3 py-3 border-md-end bg-light-subtle">
                    <div className="small fw-bold text-muted text-uppercase mb-1" style={{fontSize: '0.6rem', letterSpacing: '0.05rem'}}>Saldo en Caja:</div>
                    <div className="h2 fw-bold mb-0 text-dark">
                      ${Number(saldoEnCaja).toLocaleString('es-CO', { minimumFractionDigits: 0 })}
                    </div>
                </div>

                {/* Cupo Disponible */}
                <div className="col-12 col-md-2 py-3 border-md-end">
                    <div className="small fw-bold text-muted text-uppercase mb-1" style={{fontSize: '0.6rem', letterSpacing: '0.05rem'}}>Cupo disponible:</div>
                    <div className="fw-bold text-dark">
                      ${Number(cupoDisponible).toLocaleString('es-CO', { minimumFractionDigits: 0 })}
                    </div>
                </div>

                {/* Fecha y Hora */}
                <div className="col-12 col-md-2 py-3 border-md-end">
                    <div className="small fw-bold text-muted text-uppercase mb-1" style={{fontSize: '0.6rem', letterSpacing: '0.05rem'}}>Fecha y hora:</div>
                    <div className="small text-dark fw-bold line-height-1">{currentTime.toLocaleDateString()}</div>
                    <div className="small text-dark fw-bold" style={{ fontSize: '1.1rem' }}>
                      {currentTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: '2-digit'})}
                    </div>
                </div>

                {/* Saldo Cierre Anterior */}
                <div className="col-12 col-md-3 py-3">
                    <div className="small fw-bold text-muted text-uppercase mb-1" style={{fontSize: '0.6rem', letterSpacing: '0.05rem'}}>
                        Cierre día anterior:
                    </div>
                    <div className="d-flex align-items-center justify-content-center gap-2">
                      <div className="fw-bold text-dark fs-5">
                        ${Number(saldoCierreAnterior).toLocaleString('es-CO', { minimumFractionDigits: 0 })}
                      </div>
                      <button 
                        onClick={verHistorialCierres}
                        className="btn btn-warning btn-sm rounded-pill py-0 px-2 text-dark shadow-sm"
                        title="Ver historial de cierres"
                        style={{ fontSize: '0.7rem', fontWeight: 'bold' }}
                      >
                        <i className="bi bi-clock-history me-1"></i>Historial
                      </button>
                    </div>
                </div>
            </div>
        </div>
        {/* BOTONES DE ACCIÓN RÁPIDA (SOMOS STYLE) */}
        <div className="d-flex gap-2 mb-4 overflow-auto pb-2 no-scrollbar">
            <Link href="/operaciones" className="btn btn-warning rounded-pill px-4 py-2 fw-bold text-nowrap text-dark text-decoration-none shadow-sm border-0">Movimientos</Link>
            <button onClick={handleCompensar} className="btn btn-warning rounded-pill px-4 py-2 fw-bold text-nowrap text-dark shadow-sm border-0">Compensaciones</button>
            <Link href="/operaciones/contador-monedas" className="btn btn-warning rounded-pill px-4 py-2 fw-bold text-nowrap text-dark shadow-sm border-0 text-decoration-none">Contador de Monedas</Link>
            
            {soyAdmin && (
              <>
                {hasPermission('ver_reporte_movimientos') && (
                  <Link href="/reportes/movimientos" className="btn btn-warning rounded-pill px-4 py-2 fw-bold text-nowrap text-dark shadow-sm border-0 text-decoration-none">Reporte de Movimientos</Link>
                )}
                {hasPermission('gestionar_sucursal') && (
                  <button onClick={handleRealizarCierre} className="btn btn-warning rounded-pill px-4 py-2 fw-bold text-nowrap text-dark shadow-sm border-0">Realizar Cierre</button>
                )}
                <div className="ms-auto d-flex gap-2">
                    {hasPermission('gestionar_sucursal') && (
                      <button 
                        onClick={generarReporteCierre}
                        className="btn btn-outline-dark rounded-circle shadow-sm" 
                        style={{width: '42px', height: '42px'}}
                        title="Cierre de Caja"
                      >
                        <i className="bi bi-file-earmark-pdf"></i>
                      </button>
                    )}
                </div>
              </>
            )}
        </div>

        <div className="row g-4 mb-4">
            {/* GANANCIAS - SOLO ADMIN */}
            {soyAdmin && (
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm rounded-4 text-white p-4 h-100" style={{backgroundColor: '#1a1a1a'}}>
                        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-3 gap-2">
                            <span className="small fw-bold text-white-50 text-uppercase">Ganancias netas hoy</span>
                            <span className="badge bg-warning text-dark fw-bold px-3 py-2" style={{fontSize: '0.65rem'}}>UTILIDAD</span>
                        </div>
                        <div className="h1 fw-bold mb-0">${Number(ganancias).toLocaleString()}</div>
                    </div>
                </div>
            )}

            {/* ESTADÍSTICAS / BARRA DE PROGRESO */}
            <div className={soyAdmin ? "col-md-9" : "col-md-12"}>
                <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100">
                    <div className="d-flex justify-content-between align-items-center mb-4">
                        <span className="small fw-bold text-muted text-uppercase">Distribución de Capital Operativo</span>
                        <span className="small text-muted">Total (Tope): ${Number(sucursal?.cupo_limite).toLocaleString()}</span>
                    </div>
                    
                    <div className="progress rounded-pill mb-3" style={{height: '14px', backgroundColor: '#f0f0f0'}}>
                        <div 
                        className="progress-bar bg-warning rounded-pill" 
                        style={{width: `${(Number(saldoEnCaja)/Number(sucursal?.cupo_limite))*100}%`}}
                        ></div>
                    </div>
                    
                    <div className="d-flex justify-content-between small text-muted">
                        <span>Saldo en Caja: {((Number(saldoEnCaja)/Number(sucursal?.cupo_limite))*100).toFixed(1)}%</span>
                        <span>Cupo: {((Number(cupoDisponible)/Number(sucursal?.cupo_limite))*100).toFixed(1)}%</span>
                    </div>
                </div>
            </div>
        </div>

        {/* TABLA DE MOVIMIENTOS */}
        <div className="row">
            <div className="col-12">
                <div className="card border-0 shadow-sm rounded-4 bg-white mb-5">
                    <div className="card-header bg-white border-0 py-4 px-4">
                            <div className="col-12 col-lg-auto text-center text-lg-start">
                                <div className="d-flex align-items-center justify-content-center justify-content-lg-start gap-2 mb-2 mb-lg-0">
                                     <div className="bg-warning p-2 rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{width: '32px', height: '32px'}}>
                                        <i className="bi bi-clock-history text-dark"></i>
                                     </div>
                                     <h5 className="fw-bold mb-0 text-dark">Historial de Movimientos</h5>
                                </div>
                            </div>
                            <div className="col-12 col-lg">
                                <div className="row g-2 justify-content-lg-end">
                                    <div className="col-6 col-md-auto">
                                        <input 
                                            type="date" 
                                            className="form-control form-control-sm border-0 bg-light rounded-pill px-3 py-2 w-100" 
                                            value={dateStart}
                                            onChange={(e) => setDateStart(e.target.value)}
                                            style={{fontSize: '0.8rem'}}
                                        />
                                    </div>
                                    <div className="col-6 col-md-auto">
                                        <input 
                                            type="date" 
                                            className="form-control form-control-sm border-0 bg-light rounded-pill px-3 py-2 w-100" 
                                            value={dateEnd}
                                            onChange={(e) => setDateEnd(e.target.value)}
                                            style={{fontSize: '0.8rem'}}
                                        />
                                    </div>
                                    <div className="col-12 col-md-auto">
                                        <div className="input-group overflow-hidden border rounded-pill px-3 bg-light w-100" style={{maxWidth: '100%'}}>
                                            <span className="input-group-text bg-transparent border-0 text-muted px-0"><i className="bi bi-search py-1"></i></span>
                                            <input 
                                                type="text" 
                                                className="form-control bg-transparent border-0 small py-2" 
                                                placeholder="Buscar..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                style={{fontSize: '0.85rem'}}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                        {/* RESUMEN FILTRADO - SOLO CON PERMISO */}
                        {soyAdmin && (
                            <div className="row mt-3 g-2">
                                <div className="col-md-4 col-6">
                                    <div className="p-3 rounded-4 bg-success bg-opacity-10 border border-success border-opacity-10 h-100">
                                        <div className="small text-success fw-bold text-uppercase" style={{fontSize: '0.6rem'}}>Entradas ({resumenFiltrado.entradasCount})</div>
                                        <div className="fw-bold text-success h5 mb-0 text-truncate" title={`$${resumenFiltrado.entradasMonto.toLocaleString()}`}>
                                            ${resumenFiltrado.entradasMonto.toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                                <div className="col-md-4 col-6">
                                    <div className="p-3 rounded-4 bg-danger bg-opacity-10 border border-danger border-opacity-10 h-100">
                                        <div className="small text-danger fw-bold text-uppercase" style={{fontSize: '0.6rem'}}>Salidas ({resumenFiltrado.salidasCount})</div>
                                        <div className="fw-bold text-danger h5 mb-0 text-truncate" title={`$${resumenFiltrado.salidasMonto.toLocaleString()}`}>
                                            ${resumenFiltrado.salidasMonto.toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                                <div className="col-md-4 col-12">
                                    <div className="p-3 rounded-4 bg-light border border-secondary border-opacity-25 h-100">
                                        <div className="small text-muted fw-bold text-uppercase" style={{fontSize: '0.6rem'}}>Neto Período</div>
                                        <div className={`fw-bold h5 mb-0 ${resumenFiltrado.entradasMonto - resumenFiltrado.salidasMonto >= 0 ? 'text-dark' : 'text-danger'}`}>
                                            ${(resumenFiltrado.entradasMonto - resumenFiltrado.salidasMonto).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="table-responsive" style={{ minHeight: '300px' }}>
                        <table className="table table-hover align-middle mb-0">
                            <thead className="bg-light text-muted small text-uppercase">
                                <tr>
                                    <th className="ps-4">Fecha / Hora</th>
                                    <th>Concepto / Cajero</th>
                                    <th className="text-end">Monto</th>
                                    <th className="text-center">Flujo</th>
                                    <th className="text-center">Estado</th>
                                    {soyAdmin && <th className="text-center pe-4">Acciones</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {transacciones.length === 0 ? (
                                    <tr><td colSpan={6} className="text-center py-5 text-muted">No hay movimientos registrados hoy.</td></tr>
                                ) : (
                                    transacciones.map(t => {
                                        const esEntrada = t.tipo === 'consignacion' || t.tipo === 'pago';
                                        return (
                                            <tr key={t.id}>
                                                <td className="ps-4">
                                                    <div className="fw-bold text-dark">{new Date(t.created_at).toLocaleDateString()}</div>
                                                    <div className="small text-muted">{new Date(t.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                                </td>
                                                <td>
                                                    <div className="fw-bold text-capitalize text-dark">{t.tipo.replace('_', ' ')}</div>
                                                    <div className="small text-muted">{t.perfiles?.nombre_completo}</div>
                                                </td>
                                                <td className={`text-end fw-bold ${t.estado === 'anulada' ? 'text-muted text-decoration-line-through' : (esEntrada ? 'text-success' : 'text-danger')}`}>
                                                    {esEntrada ? '+' : '-'}${Number(t.monto).toLocaleString()}
                                                </td>
                                                <td className="text-center text-dark">
                                                    <span className="badge rounded-pill bg-light text-dark border px-3">
                                                        {esEntrada ? 'ENTRADA' : 'SALIDA'}
                                                    </span>
                                                </td>
                                                <td className="text-center">
                                                    <span className={`badge rounded-pill ${t.estado === 'anulada' ? 'bg-danger-subtle text-danger' : 'bg-success-subtle text-success'} px-3`}>
                                                        {t.estado?.toUpperCase() || 'APROBADA'}
                                                    </span>
                                                </td>
                                                {soyAdmin && (
                                                    <td className="text-center pe-4">
                                                        <div className="dropdown">
                                                            <button 
                                                                className="btn btn-link text-muted p-0" 
                                                                type="button" 
                                                                data-bs-toggle="dropdown"
                                                                data-bs-boundary="viewport"
                                                                aria-expanded="false"
                                                            >
                                                                <i className="bi bi-three-dots-vertical fs-5"></i>
                                                            </button>
                                                            <ul className="dropdown-menu dropdown-menu-end shadow-lg border-0 rounded-3" style={{ zIndex: 1060 }}>
                                                                {t.estado !== 'anulada' && (
                                                                    <li><button className="dropdown-item py-2 d-flex align-items-center gap-2 text-danger" onClick={() => handleAnular(t)}><i className="bi bi-x-circle"></i> Anular</button></li>
                                                                )}
                                                                <li><button className="dropdown-item py-2 d-flex align-items-center gap-2 text-muted" onClick={() => handleEliminar(t.id)}><i className="bi bi-trash"></i> Eliminar</button></li>
                                                            </ul>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="card-footer bg-white border-0 py-3 px-4 d-flex justify-content-between align-items-center">
                         <div className="small text-muted">Total registros: {totalCount}</div>
                         <div className="btn-group shadow-sm">
                            <button className="btn btn-white border px-3 small" disabled={page === 0} onClick={() => setPage(page - 1)}><i className="bi bi-chevron-left"></i></button>
                            <button className="btn btn-white border px-3 small" disabled={(page + 1) * PAGE_SIZE >= totalCount} onClick={() => setPage(page + 1)}><i className="bi bi-chevron-right"></i></button>
                         </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
