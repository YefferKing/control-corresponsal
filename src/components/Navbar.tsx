"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

export default function Sidebar({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [sucursal, setSucursal] = useState<any>(null);
  const [permisos, setPermisos] = useState<string[]>([]);
  const router = useRouter();
  const pathname = usePathname();

  // Cerrar sidebar al cambiar de ruta en móvil
  useEffect(() => {
    if (isOpen) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]); 

  useEffect(() => {
    const setup = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfileAndSucursal(session.user.id);
      }
    };

    setup();

    // Listener para cambios de cupo externos
    const handleRefresh = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) fetchProfileAndSucursal(session.user.id);
    };
    window.addEventListener('refreshSucursal', handleRefresh);

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfileAndSucursal(session.user.id);
      } else {
        setProfile(null);
        setSucursal(null);
        setPermisos([]);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
      window.removeEventListener('refreshSucursal', handleRefresh);
    };
  }, []);

  const fetchProfileAndSucursal = async (userId: string) => {
    try {
      const { data: profileData } = await supabase
        .from('perfiles')
        .select(`
          *, 
          sucursales(*),
          roles(
            *,
            roles_permisos(permiso_slug)
          )
        `)
        .eq('id', userId)
        .single();

      if (profileData) {
        setProfile(profileData);
        setSucursal(profileData.sucursales);
        
        // Aplanar los slugs de permisos para fácil chequeo
        const userPermisos = profileData.roles?.roles_permisos?.map((rp: any) => rp.permiso_slug) || [];
        setPermisos(userPermisos);
      }
    } catch (e) {
      console.error("Error fetching profile:", e);
    }
  };

  const hasPermission = (slug: string) => {
    if (!profile) return false;
    
    // EXCEPCIÓN: Root access (Yefferson)
    if (user?.email === 'yeffersonpeinado@gmail.com') return true;

    // Aplanar los slugs de permisos para fácil chequeo
    const userPermisos = profile.roles?.roles_permisos?.map((rp: any) => rp.permiso_slug) || [];
    return userPermisos.includes(slug);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const isActive = (path: string) => pathname === path ? 'active' : '';

  return (
    <>
      {/* Overlay para cerrar al hacer clic fuera en móvil */}
      {isOpen && <div className="sidebar-overlay d-lg-none" onClick={onClose}></div>}
      
      <div className={`sidebar d-flex flex-column shadow-lg ${isOpen ? 'show' : ''}`}>
        <div className="logo-container border-bottom border-light border-opacity-10 py-4 d-flex justify-content-between align-items-center">
          <div>
            {sucursal?.logo_url ? (
              <div className="d-flex align-items-center gap-2">
                <img src={sucursal.logo_url} alt="Logo" style={{maxHeight: '40px', maxWidth: '120px', objectFit: 'contain'}} />
                <div className="vr bg-white opacity-25 mx-1" style={{height: '30px'}}></div>
                <div>
                   <span className="text-white fw-bold d-block" style={{fontSize: '0.9rem'}}>{sucursal.codigo_punto}</span>
                   <span className="text-warning small" style={{fontSize: '0.65rem'}}>PUNTO ACTIVO</span>
                </div>
              </div>
            ) : (
              <>
                <h4 className="mb-0 fw-bold d-flex align-items-center gap-2">
                  <i className="bi bi-lightning-charge-fill text-warning fs-3"></i>
                  <span className="text-white">Flash</span>
                  <span className="text-warning">Bank</span>
                </h4>
                <small className="text-white-50 small" style={{fontSize: '0.65rem', letterSpacing: '1px'}}>CORRESPONSAL BANCARIO</small>
              </>
            )}
          </div>
          <button className="btn btn-link text-white d-lg-none p-0" onClick={onClose}>
            <i className="bi bi-x-lg fs-4"></i>
          </button>
        </div>

      <div className="flex-fill px-3 py-4 overflow-auto">
        {/* VISTA PARA VISITANTES (NO LOGUEADOS) */}
        {!user && (
          <>
            <div className="small text-white-50 mb-2 ps-2 text-uppercase fw-bold" style={{fontSize: '0.7rem', letterSpacing: '1px'}}>Bienvenido</div>
            <Link href="/" className={`sidebar-link ${isActive('/')}`}>
              <i className="bi bi-house"></i> Inicio
            </Link>
            <Link href="/login" className={`sidebar-link ${isActive('/login')}`}>
              <i className="bi bi-box-arrow-in-right"></i> Iniciar Sesión
            </Link>
          </>
        )}

        {/* VISTA PARA USUARIOS AUTENTICADOS */}
        {user && (
          <>
            <div className="small text-white-50 mb-2 ps-2 text-uppercase fw-bold" style={{fontSize: '0.7rem', letterSpacing: '1px'}}>Core</div>
            <Link href="/dashboard" className={`sidebar-link ${isActive('/dashboard')}`}>
              <i className="bi bi-speedometer2"></i> Dashboard
            </Link>
            
            {(hasPermission('realizar_consignacion') || hasPermission('realizar_retiro')) && (
              <Link href="/operaciones" className={`sidebar-link ${isActive('/operaciones')}`}>
                <i className="bi bi-plus-square"></i> Nueva Operación
              </Link>
            )}

            {(hasPermission('registrar_gastos') || hasPermission('gestionar_prestamos') || hasPermission('gestionar_cuentas_pagar') || hasPermission('gestionar_sucursal') || hasPermission('ver_dashboard')) && (
              <>
                <div className="small text-white-50 mb-2 mt-4 ps-2 text-uppercase fw-bold" style={{fontSize: '0.7rem', letterSpacing: '1px'}}>Contabilidad y Caja</div>
                {hasPermission('registrar_gastos') && (
                  <Link href="/caja/gastos" className={`sidebar-link ${isActive('/caja/gastos')}`}>
                    <i className="bi bi-wallet2"></i> Registrar Gastos
                  </Link>
                )}
                {hasPermission('gestionar_prestamos') && (
                  <>
                    <Link href="/caja/prestamos" className={`sidebar-link ${isActive('/caja/prestamos')}`}>
                      <i className="bi bi-cash-coin"></i> Préstamos a Terceros
                    </Link>
                    <Link href="/caja/terceros" className={`sidebar-link ${isActive('/caja/terceros')}`}>
                      <i className="bi bi-person-rolodex"></i> Directorio Terceros
                    </Link>
                  </>
                )}
                {hasPermission('gestionar_cuentas_pagar') && (
                  <Link href="/caja/cuentas-por-pagar" className={`sidebar-link ${isActive('/caja/cuentas-por-pagar')}`}>
                    <i className="bi bi-receipt-cutoff"></i> Cuentas por Pagar
                  </Link>
                )}
              </>
            )}

            {/* Administración Dinámica */}
            {(hasPermission('gestionar_usuarios') || 
              hasPermission('gestionar_roles') || 
              hasPermission('gestionar_tarifas') || 
              hasPermission('gestionar_sucursal')) && (
              <>
                <div className="small text-white-50 mb-2 mt-4 ps-2 text-uppercase fw-bold" style={{fontSize: '0.7rem', letterSpacing: '1px'}}>Administración</div>
                {hasPermission('gestionar_usuarios') && (
                  <Link href="/usuarios" className={`sidebar-link ${isActive('/usuarios')}`}>
                    <i className="bi bi-people"></i> Gestión Usuarios
                  </Link>
                )}

                {hasPermission('gestionar_roles') && (
                  <Link href="/roles" className={`sidebar-link ${isActive('/roles')}`}>
                    <i className="bi bi-shield-lock"></i> Roles y Permisos
                  </Link>
                )}

                {hasPermission('gestionar_tarifas') && (
                  <Link href="/tarifas" className={`sidebar-link ${isActive('/tarifas')}`}>
                    <i className="bi bi-currency-dollar"></i> Tarifas y Comisiones
                  </Link>
                )}

                {hasPermission('gestionar_sucursal') && (
                  <Link href="/sucursal" className={`sidebar-link ${isActive('/sucursal')}`}>
                    <i className="bi bi-gear"></i> Configurar Punto
                  </Link>
                )}
              </>
            )}

            {/* Reportes Dinámicos */}
            {(hasPermission('ver_reporte_movimientos') || hasPermission('gestionar_sucursal')) && (
              <>
                <div className="small text-white-50 mb-2 mt-4 ps-2 text-uppercase fw-bold" style={{fontSize: '0.7rem', letterSpacing: '1px'}}>Reportes y Análisis</div>
                {hasPermission('ver_reporte_movimientos') && (
                  <>
                    <Link href="/reportes/movimientos" className={`sidebar-link ${isActive('/reportes/movimientos')}`}>
                      <i className="bi bi-graph-up-arrow"></i> Reporte de Movimientos
                    </Link>
                    <Link href="/reportes/contador-monedas" className={`sidebar-link ${isActive('/reportes/contador-monedas')}`}>
                      <i className="bi bi-card-checklist"></i> Historial Contador
                    </Link>
                  </>
                )}
              </>
            )}
            
            {/* Solo Control Total - Yefferson */}
            {user?.email === 'yeffersonpeinado@gmail.com' && (
              <>
                <div className="small text-white-50 mb-2 mt-4 ps-2 text-uppercase fw-bold" style={{fontSize: '0.7rem', letterSpacing: '1px'}}>Sistema Master</div>
                <Link href="/admin/corresponsales" className={`sidebar-link ${isActive('/admin/corresponsales')}`}>
                  <i className="bi bi-gear-wide-connected text-warning"></i> Control Sucursales
                </Link>
              </>
            )}

            <div className="small text-white-50 mb-2 mt-4 ps-2 text-uppercase fw-bold" style={{fontSize: '0.7rem', letterSpacing: '1px'}}>Información de Punto</div>
            <div className="info-sucursal-box border border-light border-opacity-10 shadow-sm" style={{margin: '0 0 20px 0'}}>
              <div className="small text-warning fw-bold mb-1 text-truncate">{sucursal?.nombre || 'Mi Sucursal'}</div>
              <div className="small text-white mb-1 opacity-75">Código: {sucursal?.codigo_punto || '---'}</div>
              {hasPermission('ver_dashboard') && (
                <>
                  <div className="mt-2 text-white-50 text-uppercase fw-bold" style={{fontSize: '0.65rem'}}>Saldo</div>
                  <div className="fw-bold text-white fs-5">
                    ${Number(sucursal?.cupo_actual || 0).toLocaleString()}
                  </div>
                  <div className="progress mt-2" style={{height: '6px', backgroundColor: 'rgba(255,255,255,0.1)'}}>
                    <div 
                      className="progress-bar bg-warning"
                      style={{width: `${Math.min((sucursal?.cupo_actual / sucursal?.cupo_limite) * 100, 100)}%` || '0%'}}
                    ></div>
                  </div>
                  <div className="mt-2 text-warning fw-bold" style={{fontSize: '0.75rem'}}>
                    Cupo disponible: ${Number((sucursal?.cupo_limite || 0) - (sucursal?.cupo_actual || 0)).toLocaleString()}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <div className="p-3 border-top border-light border-opacity-10 bg-dark bg-opacity-25">
        {user ? (
          <div className="d-flex align-items-center">
            <div className="bg-warning rounded-circle d-flex align-items-center justify-content-center me-2 flex-shrink-0 shadow-sm" style={{width: '32px', height: '32px'}}>
              <span className="text-dark fw-bold small">{profile?.nombre_completo?.charAt(0) || 'U'}</span>
            </div>
            <div className="overflow-hidden flex-grow-1">
              <div className="small fw-bold text-white text-truncate">{profile?.nombre_completo || 'Usuario'}</div>
              <div className="text-white-50 text-truncate" style={{fontSize: '0.65rem'}}>{user.email}</div>
            </div>
            <button onClick={handleLogout} className="btn btn-link text-danger p-0 ms-2 text-decoration-none" title="Cerrar Sesión">
              <i className="bi bi-power fs-5"></i>
            </button>
          </div>
        ) : (
          <div className="text-center small text-white-50 fw-light">Plataforma de Operación Digital</div>
        )}
      </div>
    </div>
    </>
  );
}
