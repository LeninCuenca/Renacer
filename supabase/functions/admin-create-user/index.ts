import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const client = createClient(supabaseUrl, serviceKey)
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) throw new Error('No autenticado')
    const { data: authData } = await client.auth.getUser(token)
    if (!authData.user) throw new Error('No autenticado')
    const { data: jefe } = await client.from('perfiles').select('rol, activo').eq('id', authData.user.id).single()
    if (jefe?.rol !== 'jefe' || !jefe.activo) throw new Error('Solo un jefe puede crear usuarios')

    const { nombres, apellidos, cedula, correo, telefono, password, rol } = await request.json()
    if (!nombres?.trim() || !apellidos?.trim() || !cedula?.trim() || !correo?.trim() || !telefono?.trim() || !['vendedor', 'supervisor', 'jefe', 'contador', 'administrador_planta'].includes(rol)) throw new Error('Datos de usuario inválidos')
    if (!password || password.length < 6) throw new Error('La contraseña inicial debe tener al menos 6 caracteres')
    const nombresLimpios = nombres.trim()
    const apellidosLimpios = apellidos.trim()
    const correoLimpio = correo.trim().toLowerCase()
    const cedulaLimpia = cedula.trim()
    const telefonoLimpio = telefono.trim()
    const { data: created, error } = await client.auth.admin.createUser({ email: correoLimpio, password, email_confirm: true, user_metadata: { nombres: nombresLimpios, apellidos: apellidosLimpios, cedula: cedulaLimpia, telefono: telefonoLimpio, rol } })
    if (error || !created.user) throw error || new Error('No se pudo crear el usuario')
    const { error: profileError } = await client.from('perfiles').upsert({ id: created.user.id, nombre: `${nombresLimpios} ${apellidosLimpios}`, nombres: nombresLimpios, apellidos: apellidosLimpios, cedula: cedulaLimpia, correo: correoLimpio, telefono: telefonoLimpio, rol, activo: true }, { onConflict: 'id' })
    if (profileError) throw profileError
    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Error interno' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})