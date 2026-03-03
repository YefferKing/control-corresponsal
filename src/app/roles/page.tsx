"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Swal from 'sweetalert2';

export default function RolesManager() {
  const [roles, setRoles] = useState<any[]>([]);
  const [permisosDisponibles, setPermisosDisponibles] = useState<any[]>([]);
  const [nombreRol, setNombreRol] = useState('');
  const [permisosSeleccionados, setPermisosSeleccionados] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
  const [currentSucursalId, setCurrentSucursalId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // Ya no cargamos roles aquí directamente, sino después de saber la sucursal del usuario

    // Obtener rol del usuario actual
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setCurrentUserEmail(session.user.email || '');
      const { data: profile } = await supabase
        .from('perfiles')
        .select('sucursal_id, roles(nombre)')
        .eq('id', session.user.id)
        .single();
      
      if (profile) {
        setCurrentSucursalId(profile.sucursal_id);
        
        // Cargar roles filtrados por su sucursal o globales (null)
        const { data: rolesData } = await supabase
          .from('roles')
          .select('*, roles_permisos(*)')
          .or(`sucursal_id.eq.${profile.sucursal_id},sucursal_id.is.null`);
        
        if (rolesData) setRoles(rolesData);

        if (profile.roles) {
          const roleData: any = profile.roles;
          const nombreVal = Array.isArray(roleData) ? roleData[0]?.nombre : roleData?.nombre;
          if (nombreVal) setCurrentUserRole(nombreVal.toUpperCase());
        }
      }
    }
    
    // Cargar definiciones de permisos (esto es global)
    const { data: permisosData } = await supabase.from('permisos_definicion').select('*');
    if (permisosData) setPermisosDisponibles(permisosData);
  };

  const handleSaveRol = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingId) {
        // MODO EDICIÓN
        // 1. Actualizar nombre del Rol
        const { error: updateError } = await supabase.from('roles').update({ nombre: nombreRol }).eq('id', editingId);
        if (updateError) throw updateError;
        
        // 2. Limpiar permisos viejos
        await supabase.from('roles_permisos').delete().eq('rol_id', editingId);
        
        // 3. Insertar nuevos
        const insertPermisos = permisosSeleccionados.map(slug => ({
          rol_id: editingId,
          permiso_slug: slug
        }));
        await supabase.from('roles_permisos').insert(insertPermisos);

        Swal.fire('¡Actualizado!', 'El rol ha sido modificado con éxito.', 'success');
      } else {
        // MODO CREACIÓN
        const { data: newRol, error: createError } = await supabase
          .from('roles')
          .insert([{ 
            nombre: nombreRol,
            sucursal_id: currentSucursalId 
          }])
          .select()
          .single();

        if (createError) throw createError;

        if (newRol) {
          const insertPermisos = permisosSeleccionados.map(slug => ({
            rol_id: newRol.id,
            permiso_slug: slug
          }));
          await supabase.from('roles_permisos').insert(insertPermisos);
          Swal.fire('¡Creado!', 'El nuevo rol está listo.', 'success');
        }
      }

      setNombreRol('');
      setPermisosSeleccionados([]);
      setEditingId(null);
      fetchData();
    } catch (error: any) {
      Swal.fire('Error', error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (rol: any) => {
    // REGLA: Solo un administrador puede editar el rol ADMIN
    const esAdminRole = rol.nombre.toUpperCase().includes('ADMIN');
    const yoSoyAdmin = currentUserRole.includes('ADMIN');

    if (esAdminRole && !yoSoyAdmin) {
      Swal.fire('Acceso Denegado', 'No tienes permisos para modificar el rol de Administrador.', 'warning');
      return;
    }

    setEditingId(rol.id);
    setNombreRol(rol.nombre);
    setPermisosSeleccionados(rol.roles_permisos.map((rp: any) => rp.permiso_slug));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string, nombre: string) => {
    const esAdminRole = nombre.toUpperCase().includes('ADMIN');
    if (esAdminRole) {
      Swal.fire('Prohibido', 'El rol de Administrador es vital para el sistema y no puede ser eliminado.', 'error');
      return;
    }

    const result = await Swal.fire({
      title: '¿Confirmar eliminación?',
      text: `El rol "${nombre}" será borrado permanentemente.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      const { error } = await supabase.from('roles').delete().eq('id', id);
      if (error) {
        Swal.fire('Error', error.message, 'error');
      } else {
        Swal.fire('Eliminado', 'Rol borrado correctamente.', 'success');
        fetchData();
      }
    }
  };

  const togglePermiso = (slug: string) => {
    setPermisosSeleccionados(prev => 
      prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]
    );
  };

  const cancelEdit = () => {
    setEditingId(null);
    setNombreRol('');
    setPermisosSeleccionados([]);
  };

  return (
    <div className="container py-4">
      <div className="row g-4">
        {/* Formulario de Creación/Edición */}
        <div className="col-lg-5">
          <div className="card shadow-lg border-0 rounded-4 overflow-hidden">
            <div className={`card-header ${editingId ? 'bg-warning text-dark' : 'bg-dark text-white'} py-3 border-0`}>
              <h5 className="mb-0 fw-bold d-flex align-items-center gap-2">
                <i className={`bi ${editingId ? 'bi-pencil-square' : 'bi-shield-lock-fill'} ${editingId ? 'text-dark' : 'text-warning'}`}></i>
                {editingId ? 'Editando Rol' : 'Crear Nuevo Rol'}
              </h5>
            </div>
            <div className="card-body p-4 bg-white">
              <form onSubmit={handleSaveRol}>
                <div className="mb-4">
                  <label className="form-label small fw-bold text-muted text-uppercase">Nombre del Rol</label>
                  <input 
                    type="text" 
                    className="form-control py-2 px-3 rounded-3" 
                    placeholder="Ej: Cajero Principal, Supervisor..." 
                    value={nombreRol}
                    onChange={e => setNombreRol(e.target.value)}
                    required
                  />
                </div>
                
                <div className="mb-4">
                  <label className="form-label small fw-bold text-muted text-uppercase d-block mb-3">Asignar Permisos:</label>
                  <div className="permisos-list pe-2" style={{maxHeight: '400px', overflowY: 'auto'}}>
                    {permisosDisponibles.map(p => (
                      <div 
                        key={p.slug} 
                        className={`form-check p-2 rounded-3 border mb-2 transition-all ${permisosSeleccionados.includes(p.slug) ? 'bg-warning bg-opacity-10 border-warning' : 'bg-light border-light'}`}
                        style={{cursor: 'pointer'}}
                        onClick={() => togglePermiso(p.slug)}
                      >
                        <input 
                          className="form-check-input ms-0 me-2" 
                          type="checkbox" 
                          id={p.slug}
                          checked={permisosSeleccionados.includes(p.slug)}
                          readOnly
                        />
                        <label className="form-check-label w-100" style={{cursor: 'pointer'}}>
                          <div className="fw-bold text-dark small">{p.nombre}</div>
                          <div className="small text-muted" style={{fontSize: '0.7rem'}}>{p.descripcion}</div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="d-flex gap-2">
                  {editingId && (
                    <button type="button" className="btn btn-outline-secondary w-100 py-3 fw-bold rounded-3" onClick={cancelEdit}>
                      Cancelar
                    </button>
                  )}
                  <button type="submit" className="btn btn-warning w-100 py-3 fw-bold text-dark shadow-sm rounded-3 mt-auto" disabled={loading}>
                    {loading ? (
                      <span className="spinner-border spinner-border-sm me-2"></span>
                    ) : (
                      <i className={`bi ${editingId ? 'bi-check2-circle' : 'bi-save2'} me-2`}></i>
                    )}
                    {editingId ? 'Guardar Cambios' : 'Crear Rol'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Listado de Roles */}
        <div className="col-lg-7">
          <div className="card shadow-sm border-0 rounded-4 overflow-hidden">
            <div className="card-header bg-white py-3 border-0">
              <h5 className="mb-0 fw-bold text-dark">
                <i className="bi bi-people-fill text-warning me-2"></i>
                Roles y Accesos Existentes
              </h5>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="bg-light text-muted small text-uppercase fw-bold border-top">
                    <tr>
                      <th className="ps-4 py-3" style={{width: '180px'}}>Nombre del Rol</th>
                      <th className="py-3">Permisos de Acceso</th>
                      <th className="pe-4 text-end py-3">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roles.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-center py-5 text-muted small">Cargando roles del sistema...</td>
                      </tr>
                    ) : (
                      roles
                        .filter(rol => {
                          const name = rol.nombre.toUpperCase();
                          const isMasterRole = name.includes('MASTER') || name.includes('SISTEMA');
                          
                          // EXCEPCIÓN: Si es un rol de ADMINISTRADOR, siempre es visible
                          if (name.includes('ADMIN')) return true;

                          // SEGURIDAD: Solo el dueño master real puede ver roles de SISTEMA/MASTER puros
                          if (isMasterRole) {
                            return currentUserEmail === 'yeffersonpeinado@gmail.com';
                          }
                          return true;
                        })
                        .map(rol => {
                          const esAdminRole = rol.nombre.toUpperCase().includes('ADMIN');
                          return (
                            <tr key={rol.id} className={esAdminRole ? 'bg-light bg-opacity-50' : ''}>
                            <td className="ps-4 py-3">
                              <span className={`fw-bold ${esAdminRole ? 'text-dark' : 'text-dark opacity-75'}`}>
                                {rol.nombre}
                                {esAdminRole && <i className="bi bi-patch-check-fill text-primary ms-1" title="Rol Maestro"></i>}
                              </span>
                            </td>
                            <td className="py-3">
                              <div className="d-flex flex-wrap gap-1">
                                {rol.roles_permisos.map((rp: any) => (
                                  <span key={rp.permiso_slug} className="badge bg-dark text-warning border-0 px-2 py-1 rounded-pill fw-normal" style={{fontSize: '0.65rem'}}>
                                    {rp.permiso_slug.replace(/_/g, ' ')}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="pe-4 text-end py-3">
                            <div className="btn-group btn-group-sm shadow-sm rounded-3 overflow-hidden border">
                              <button 
                                className="btn btn-light border-0 py-2 px-3 text-dark" 
                                title="Editar Rol" 
                                onClick={() => handleEdit(rol)}
                              >
                                <i className="bi bi-pencil-square fs-5"></i>
                              </button>
                              {!esAdminRole && (
                                <button 
                                  className="btn btn-white border-0 border-start py-2 px-3 text-danger" 
                                  title="Eliminar Rol" 
                                  onClick={() => handleDelete(rol.id, rol.nombre)}
                                >
                                  <i className="bi bi-trash fs-5"></i>
                                </button>
                              )}
                            </div>
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
      </div>
    </div>
  );
}
