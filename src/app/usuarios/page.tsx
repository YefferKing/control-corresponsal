"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import UserForm from '@/components/UserForm';
import Swal from 'sweetalert2';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function UsuariosContent() {

  const [showForm, setShowForm] = useState(false);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [sucursalId, setSucursalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userToEdit, setUserToEdit] = useState<any>(null);
  
  const searchParams = useSearchParams();
  const sucursalForzada = searchParams.get('sucursal_id');

  useEffect(() => {
    async function fetchInitialData() {
      // Prioridad 1: ID que viene por URL (después de crear sucursal)
      if (sucursalForzada) {
        setSucursalId(sucursalForzada);
        setShowForm(true); // Abrir el formulario automáticamente
        setLoading(false);
        return;
      }

      // Prioridad 2: Usuario ya logueado
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const { data: profile } = await supabase
          .from('perfiles')
          .select('sucursal_id')
          .eq('id', session.user.id)
          .single();
        
        if (profile?.sucursal_id) {
          setSucursalId(profile.sucursal_id);
          fetchUsuarios(profile.sucursal_id);
        }
      }
      setLoading(false);
    }
    fetchInitialData();
  }, [sucursalForzada]);

  const fetchUsuarios = async (id: string) => {
    const { data } = await supabase
      .from('perfiles')
      .select('*, roles(nombre)')
      .eq('sucursal_id', id);
    if (data) setUsuarios(data);
  };

  const handleUserCreated = () => {
    setShowForm(false);
    setUserToEdit(null);
    if (sucursalId) fetchUsuarios(sucursalId);
    
    // Si fue redirigido aquí para crear el primer usuario, lo mandamos al login
    if (sucursalForzada) {
      Swal.fire({
        title: '¡Usuario Maestro Creado!',
        text: 'Ahora puedes iniciar sesión con tus credenciales.',
        icon: 'success',
        confirmButtonColor: '#ffdd00'
      }).then(() => {
        window.location.href = '/login';
      });
    }
  };

  const handleEdit = (user: any) => {
    setUserToEdit(user);
    setShowForm(true);
  };

  const handleDelete = async (id: string, nombre: string) => {
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: `Vas a eliminar a ${nombre}. Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6e7881',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed && sucursalId) {
      // 1. Verificar si no es el mismo usuario logueado
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id === id) {
        Swal.fire('Acción denegada', 'No puedes eliminar tu propia cuenta desde este panel.', 'warning');
        return;
      }

      setLoading(true); // Bloquear UI mientras borra
      const { data, error } = await supabase.from('perfiles').delete().eq('id', id).select();
      
      if (error) {
        let errorMsg = error.message;
        if (error.code === '23503') {
           errorMsg = "No se puede eliminar este usuario porque tiene movimientos asociados (ventas, gastos o préstamos). Debe anular primero sus operaciones.";
        }
        Swal.fire('Error al eliminar', errorMsg, 'error');
        setLoading(false);
      } else if (!data || data.length === 0) {
        // Esto pasa cuando el id no existe o RLS bloquea la eliminación
        Swal.fire({
          title: 'No se pudo eliminar',
          text: 'La base de datos no permitió borrar este registro. Verifica si tienes permisos suficientes o si el usuario tiene datos vinculados.',
          icon: 'warning'
        });
        setLoading(false);
        fetchUsuarios(sucursalId);
      } else {
        Swal.fire({
          title: 'Eliminado',
          text: 'El usuario ha sido retirado del sistema.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
        
        // Actualizar lista local inmediatamente para que desaparezca de la vista
        setUsuarios(usuarios.filter(u => u.id !== id));
        setLoading(false);
      }
    }
  };

  if (loading) return (
    <div className="d-flex justify-content-center align-items-center vh-100">
      <div className="spinner-border text-warning"></div>
    </div>
  );

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="fw-bold fs-3 mb-1 text-dark">
            {sucursalForzada ? 'Paso Final: Crear Administrador' : 'Gestión de Usuarios'}
          </h2>
          <p className="text-muted">
            {sucursalForzada ? 'Registre la cuenta maestra de este punto de venta.' : 'Personal registrado en este punto de venta.'}
          </p>
        </div>
        {!sucursalForzada && (
          <button 
            className={`btn ${showForm ? 'btn-outline-secondary' : 'btn-warning'} fw-bold shadow-sm px-4`}
            onClick={() => {
              setShowForm(!showForm);
              if(showForm) setUserToEdit(null);
            }}
          >
            <i className={`bi ${showForm ? 'bi-arrow-left' : 'bi-person-plus-fill'} me-2`}></i>
            {showForm ? 'Volver al Listado' : 'Nuevo Usuario'}
          </button>
        )}
      </div>

      {showForm && sucursalId ? (
        <div className="row">
          <div className="col-lg-8 mx-auto">
            <UserForm 
              sucursalId={sucursalId} 
              onUserCreated={handleUserCreated} 
              userToEdit={userToEdit}
            />
          </div>
        </div>
      ) : (
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="bg-light">
                <tr>
                  <th className="ps-4 py-3 text-muted small text-uppercase fw-bold">Nombre del Usuario</th>
                  <th className="py-3 text-muted small text-uppercase fw-bold text-center">Rol Asignado</th>
                  <th className="py-3 text-muted small text-uppercase fw-bold text-end pe-4">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-5">
                      <div className="py-4">
                        <i className="bi bi-people text-muted opacity-25 display-1 d-block mb-3"></i>
                        <h5 className="text-muted fw-normal">No hay personal registrado todavía.</h5>
                        <p className="text-muted small">Use el botón "Nuevo Usuario" para empezar.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  usuarios.map(user => (
                    <tr key={user.id}>
                      <td className="ps-4">
                        <div className="d-flex align-items-center">
                          <div className="bg-warning bg-opacity-10 p-2 rounded-circle me-3 text-warning">
                            <i className="bi bi-person-fill fs-5"></i>
                          </div>
                          <div>
                            <div className="fw-bold text-dark">{user.nombre_completo}</div>
                            <div className="small text-muted">Mimbro desde {new Date(user.created_at).toLocaleDateString()}</div>
                          </div>
                        </div>
                      </td>
                      <td className="text-center">
                        <span className={`badge rounded-pill px-3 py-2 ${(user.roles?.nombre.toUpperCase().includes('ADMIN') || user.roles?.nombre.toUpperCase().includes('MASTER') || user.roles?.nombre.toUpperCase().includes('SISTEMA')) ? 'bg-dark text-white' : 'bg-warning-subtle text-dark border border-warning-subtle'}`}>
                          {user.roles?.nombre || 'COLABORADOR'}
                        </span>
                      </td>
                      <td className="text-end pe-4">
                        <div className="btn-group btn-group-sm shadow-sm rounded-3 overflow-hidden border">
                          <button 
                            className="btn btn-light border-0 py-2 px-3 text-dark" 
                            onClick={() => handleEdit(user)}
                            title="Editar Usuario"
                          >
                            <i className="bi bi-pencil-square fs-5"></i>
                          </button>
                          <button 
                            className="btn btn-white border-0 border-start py-2 px-3 text-danger" 
                            onClick={() => handleDelete(user.id, user.nombre_completo)}
                            title="Eliminar Usuario"
                          >
                            <i className="bi bi-trash fs-5"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function UsuariosPage() {
  return (
    <Suspense fallback={
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="spinner-border text-warning"></div>
      </div>
    }>
      <UsuariosContent />
    </Suspense>
  );
}

