"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function usePermissions() {
  const [permisos, setPermisos] = useState<string[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPermissions() {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      
      if (session?.user) {
        const { data: profileData } = await supabase
          .from('perfiles')
          .select('*, roles(*, roles_permisos(permiso_slug))')
          .eq('id', session.user.id)
          .single();
        
        if (profileData) {
          setProfile(profileData);
          const userPermisos = profileData.roles?.roles_permisos?.map((rp: any) => rp.permiso_slug) || [];
          setPermisos(userPermisos);
        }
      }
      setLoading(false);
    }
    fetchPermissions();
  }, []);

  const hasPermission = (slug: string) => {
    if (loading) return false;
    if (!profile) return false;
    
    // Root access for master email
    if (user?.email === 'yeffersonpeinado@gmail.com') return true;

    return permisos.includes(slug);
  };

  return { hasPermission, loading, profile, user };
}
