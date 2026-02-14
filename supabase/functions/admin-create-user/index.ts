import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Verify the calling user is admin/super_admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Client for the calling user (to verify permissions)
    const callerClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user: callerUser }, error: authError } = await callerClient.auth.getUser()
    if (authError || !callerUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check caller is admin or super_admin using service role
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: callerRoles } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', callerUser.id)

    const callerRoleList = (callerRoles || []).map((r: any) => r.role)
    const callerIsAdmin = callerRoleList.includes('admin') || callerRoleList.includes('super_admin')
    const callerIsSuperAdmin = callerRoleList.includes('super_admin')

    if (!callerIsAdmin) {
      return new Response(JSON.stringify({ error: 'Only admins can create users' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { name, address, email, username, password, role } = body

    // Validate required fields
    if (!name || !address || !email || !username || !password || !role) {
      return new Response(JSON.stringify({ error: 'All fields are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Only super_admin can assign super_admin role
    if (role === 'super_admin' && !callerIsSuperAdmin) {
      return new Response(JSON.stringify({ error: 'Only Super Admin can assign Super Admin role' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Password minimum length
    if (password.length < 8) {
      return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check username uniqueness
    const { data: existingUsername } = await adminClient
      .from('profiles')
      .select('id')
      .ilike('username', username.trim())
      .limit(1)

    if (existingUsername && existingUsername.length > 0) {
      return new Response(JSON.stringify({ error: 'Username already exists' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create auth user with NO email confirmation
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true, // auto-confirm so they can log in immediately
      user_metadata: { full_name: name.trim() },
    })

    if (createError) {
      // Handle duplicate email
      if (createError.message?.includes('already been registered') || createError.message?.includes('already exists')) {
        return new Response(JSON.stringify({ error: 'Email already exists' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Update the profile with username, address, created_by
    // The handle_new_user trigger already creates the profile row
    await adminClient
      .from('profiles')
      .update({
        full_name: name.trim(),
        username: username.trim().toLowerCase(),
        address: address.trim(),
        created_by: callerUser.id,
      })
      .eq('id', newUser.user.id)

    // Assign role
    await adminClient.from('user_roles').insert({
      user_id: newUser.user.id,
      role,
      created_by: callerUser.id,
    })

    return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
