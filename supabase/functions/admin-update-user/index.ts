import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const roles = ['vendedor', 'supervisor', 'jefe', 'contador', 'administrador_planta']

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) throw new Error('No autenticado')
    const { data: authData } = await client.auth.getUser(token)
    if (!authData.user) throw new Error('No autenticado')
    const { data: jefe } = await client.from('perfiles').select('rol, activo').eq('id', authData.user.id).single()
    if (jefe?.rol !== 'jefe' || !jefe.activo) throw new Error('Solo un jefe puede editar usuarios')

    const { id, nombres, apellidos, cedula, correo, telefono, rol, activo } = await request.json()
    if (!id || !nombres?.trim() || !apellidos?.trim() || !cedula?.trim() || !correo?.trim() || !telefono?.trim() || !roles.includes(rol) || typeof activo !== 'boolean') throw new Error('Datos de usuario inválidos')
    const nombresLimpios = nombres.trim()
    const apellidosLimpios = apellidos.trim()
    const correoLimpio = correo.trim().toLowerCase()
    const { error: profileError } = await client.from('perfiles').update({ nombre: `${nombresLimpios} ${apellidosLimpios}`, nombres: nombresLimpios, apellidos: apellidosLimpios, cedula: cedula.trim(), correo: correoLimpio, telefono: telefono.trim(), rol, activo }).eq('id', id)
    if (profileError) throw profileError
    const { error: authError } = await client.auth.admin.updateUserById(id, { email: correoLimpio, user_metadata: { nombres: nombresLimpios, apellidos: apellidosLimpios, cedula: cedula.trim(), telefono: telefono.trim(), rol } })
    if (authError) throw authError
    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Error interno' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})