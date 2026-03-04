"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Swal from 'sweetalert2';

interface Rol {
  id: string;
  nombre: string;
}

interface UserProfile {
  id: string;
  nombre_completo: string;
  email?: string;
  rol_id: string;
  sucursal_id: string;
}

export default function UserForm({ 
  sucursalId, 
  onUserCreated, 
  userToEdit = null 
}: { 
  sucursalId: string, 
  onUserCreated: () => void,
  userToEdit?: UserProfile | null
}) {
  const [nombre, setNombre] = useState(userToEdit?.nombre_completo || '');
  const [email, setEmail] = useState(userToEdit?.email || '');
  const [password, setPassword] = useState('');
  const [rolId, setRolId] = useState(userToEdit?.rol_id || '');
  const [roles, setRoles] = useState<Rol[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    async function fetchData() {
      // Obtener usuario actual primero para saber qué roles mostrar
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user || null;
      setCurrentUser(user);

      // Cargar roles filtrados por sucursal o globales
      const { data: rolesData } = await supabase
        .from('roles')
        .select('id, nombre')
        .or(`sucursal_id.eq.${sucursalId},sucursal_id.is.null`);

      if (rolesData) {
        // SEGURIDAD: Solo el correo del dueño puede ver/asignar roles de SISTEMA o MASTER
        const esDuenio = user?.email === 'yeffersonpeinado@gmail.com';
        
        const filteredRoles = rolesData.filter(r => {
          const name = r.nombre.toUpperCase();
          const isSystemRole = name.includes('SISTEMA') || name.includes('MASTER');
          
          // EXCEPCIÓN: Permitir siempre el rol de "ADMINISTRADOR" o que contenga "ADMIN"
          // a menos que sea específicamente el Maestro del Sistema
          if (name.includes('ADMIN')) return true;
          
          if (isSystemRole) return esDuenio;
          return true;
        });

        setRoles(filteredRoles);
      }
    }
    fetchData();
  }, []);

  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (userToEdit) {
        // --- MODO EDICIÓN ---
        
        // 1. Actualizar perfil (Nombre y Rol)
        const { error: updateError } = await supabase
          .from('perfiles')
          .update({
            nombre_completo: nombre,
            rol_id: rolId
          })
          .eq('id', userToEdit.id);

        if (updateError) throw updateError;

        // 2. Si hay una nueva contraseña y es el mismo usuario, la actualizamos
        if (password && currentUser?.id === userToEdit.id) {
          const { error: pwdError } = await supabase.auth.updateUser({
            password: password
          });
          if (pwdError) throw pwdError;
          Toast.fire({ icon: 'success', title: 'Perfil y contraseña actualizados' });
        } else if (password && currentUser?.id !== userToEdit.id) {
          // Si intenta cambiar clave de OTRO usuario (sin API Admin)
          await Swal.fire({
            icon: 'info',
            title: 'Cambio de clave',
            text: 'Por seguridad, solo puedes cambiar tu propia contraseña. Para otros usuarios, ellos deben cambiarla desde su sesión.',
            confirmButtonColor: '#ffdd00'
          });
        } else {
          Toast.fire({ icon: 'success', title: 'Información actualizada' });
        }
      } else {
        // --- MODO CREACIÓN ---
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (authError) throw authError;
        
        // Supabase no lanza error si el email ya existe.
        // En su lugar devuelve un user con identities vacías.
        if (!authData.user || (authData.user.identities && authData.user.identities.length === 0)) {
          throw new Error('Este correo electrónico ya está registrado en el sistema. Usa otro correo o contacta al administrador.');
        }

        // Pequeña espera para que auth.users sea visible a la FK de perfiles
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Intentar insertar el perfil con reintentos por si la FK tarda
        let profileError = null;
        for (let intento = 0; intento < 3; intento++) {
          const { error } = await supabase
            .from('perfiles')
            .insert([{
              id: authData.user.id,
              nombre_completo: nombre,
              sucursal_id: sucursalId,
              rol_id: rolId
            }]);
          
          if (!error) {
            profileError = null;
            break;
          }
          
          // Si es error de FK, esperar y reintentar
          if (error.code === '23503' && intento < 2) {
            await new Promise(resolve => setTimeout(resolve, 1500));
            profileError = error;
          } else {
            profileError = error;
            break;
          }
        }

        if (profileError) throw profileError;

        Toast.fire({ icon: 'success', title: 'Usuario registrado con éxito' });
      }

      onUserCreated();
    } catch (error: any) {
      let mensaje = error.message;
      if (mensaje.includes('email rate limit exceeded')) {
        mensaje = "Has realizado demasiados intentos de registro seguidos. Por seguridad del banco, por favor espera 5 minutos o intenta con un correo diferente.";
      } else if (mensaje.includes('perfiles_id_fkey') || (error.code === '23503' && mensaje.includes('perfiles'))) {
        mensaje = "No se pudo vincular el perfil al usuario de autenticación. Esto puede ocurrir si el correo ya estaba registrado previamente. Intenta con un correo diferente.";
      }

      Swal.fire({
        icon: 'warning',
        title: 'Límite de Seguridad',
        text: mensaje,
        confirmButtonColor: '#ffdd00'
      });
    } finally {
      setLoading(false);
    }
  };

  const esMismoUsuario = currentUser?.id === userToEdit?.id;

  return (
    <div className="card border-0 shadow-sm rounded-4">
      <div className="card-body p-4 text-dark">
        <h4 className="fw-bold mb-4 text-warning">
          {userToEdit ? 'Editar Información de Personal' : 'Registrar Nuevo Personal'}
        </h4>
        <form onSubmit={handleSubmit}>
          <div className="row g-3 text-dark">
            <div className="col-md-6">
              <label className="form-label small fw-bold text-muted">Nombre Completo</label>
              <input 
                type="text" className="form-control form-control-lg bg-light border-0" required
                value={nombre} onChange={e => setNombre(e.target.value)}
              />
            </div>
            
            {!userToEdit ? (
              // Campos para NUEVO usuario
              <>
                <div className="col-md-6">
                  <label className="form-label small fw-bold text-muted">Correo Corporativo</label>
                  <input 
                    type="email" className="form-control form-control-lg bg-light border-0" required
                    value={email} onChange={e => setEmail(e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-bold text-muted">Contraseña Inicial</label>
                  <input 
                    type="password" className="form-control form-control-lg bg-light border-0" 
                    placeholder="Mín. 6 caracteres" required
                    value={password} onChange={e => setPassword(e.target.value)}
                  />
                </div>
              </>
            ) : (
              // Campo para EDITAR usuario (Contraseña opcional)
              <div className="col-md-6">
                <label className="form-label small fw-bold text-muted"> Nueva Contraseña (Opcional)</label>
                <input 
                  type="password" 
                  className={`form-control form-control-lg border-0 ${esMismoUsuario ? 'bg-warning-subtle' : 'bg-light opacity-50'}`}
                  placeholder={esMismoUsuario ? "Escribe para cambiar tu clave" : "No disponible para otros"}
                  value={password} 
                  onChange={e => setPassword(e.target.value)}
                  disabled={!esMismoUsuario}
                />
                <small className="text-muted d-block mt-1">
                  {esMismoUsuario 
                    ? 'Déjalo en blanco si no deseas cambiarla.' 
                    : 'Por seguridad, solo el usuario puede cambiar su clave.'}
                </small>
              </div>
            )}

            <div className="col-md-6">
              <label className="form-label small fw-bold text-muted">Asignar Rol Dinámico</label>
              <select 
                className="form-select form-select-lg bg-light border-0" 
                value={rolId} 
                onChange={e => setRolId(e.target.value)}
                required
              >
                <option value="">Seleccione un rol...</option>
                {roles.map(rol => (
                  <option key={rol.id} value={rol.id}>{rol.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="alert alert-light border-0 mt-4 mb-4 small py-3 rounded-3 d-flex align-items-center">
            <i className="bi bi-info-circle-fill me-2 text-primary fs-5"></i>
            <div>
              {userToEdit 
                ? 'Los cambios en el Rol afectarán los permisos del usuario de inmediato.' 
                : 'Los permisos de este usuario serán determinados por el rol asignado.'}
            </div>
          </div>

          <div className="d-flex gap-2">
            {userToEdit && (
              <button 
                type="button" 
                className="btn btn-outline-secondary btn-lg w-50 py-3 fw-bold rounded-3"
                onClick={() => onUserCreated()}
              >
                Cancelar
              </button>
            )}
            <button 
              type="submit" 
              className={`btn btn-warning btn-lg ${userToEdit ? 'w-50' : 'w-100'} py-3 fw-bold text-dark shadow-sm rounded-3 ${loading ? 'disabled' : ''}`}
            >
              {loading ? 'Procesando...' : (userToEdit ? 'Guardar Cambios' : 'Finalizar Registro')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
