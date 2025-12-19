import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      console.log('Auth error:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || roleData?.role !== 'admin') {
      console.log('User is not admin:', user.id);
      return new Response(
        JSON.stringify({ error: 'Only admins can manage staff' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, ...data } = await req.json();
    console.log('Action:', action, 'Data:', JSON.stringify(data));

    switch (action) {
      case 'list': {
        // Get all staff users (users with 'staff' role)
        const { data: staffRoles, error: listError } = await supabaseAdmin
          .from('user_roles')
          .select('user_id')
          .eq('role', 'staff');

        if (listError) {
          console.log('Error listing staff roles:', listError.message);
          throw listError;
        }

        if (!staffRoles || staffRoles.length === 0) {
          return new Response(
            JSON.stringify({ staff: [] }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const staffUserIds = staffRoles.map(r => r.user_id);
        
        // Get profiles for staff users
        const { data: profiles, error: profilesError } = await supabaseAdmin
          .from('member_profiles')
          .select('*')
          .in('user_id', staffUserIds);

        if (profilesError) {
          console.log('Error fetching profiles:', profilesError.message);
          throw profilesError;
        }

        return new Response(
          JSON.stringify({ staff: profiles || [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'create': {
        const { email, password, full_name, phone } = data;
        
        if (!email || !password || !full_name) {
          return new Response(
            JSON.stringify({ error: 'Email, password, and full name are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create the user with admin API
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name, phone }
        });

        if (createError) {
          console.log('Error creating user:', createError.message);
          return new Response(
            JSON.stringify({ error: createError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update role to staff (trigger may have created 'member' role)
        const { error: roleUpsertError } = await supabaseAdmin
          .from('user_roles')
          .upsert(
            { user_id: newUser.user.id, role: 'staff' },
            { onConflict: 'user_id' }
          );

        if (roleUpsertError) {
          console.log('Error upserting role:', roleUpsertError.message);
          // Try update instead
          const { error: roleUpdateError } = await supabaseAdmin
            .from('user_roles')
            .update({ role: 'staff' })
            .eq('user_id', newUser.user.id);
          
          if (roleUpdateError) {
            console.log('Error updating role:', roleUpdateError.message);
            await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
            throw roleUpdateError;
          }
        }

        // Update member profile (trigger may have already created it)
        const { error: profileUpsertError } = await supabaseAdmin
          .from('member_profiles')
          .upsert(
            {
              user_id: newUser.user.id,
              email,
              full_name,
              phone: phone || null
            },
            { onConflict: 'user_id' }
          );

        if (profileUpsertError) {
          console.log('Error upserting profile:', profileUpsertError.message);
          // Try update instead
          const { error: profileUpdateError } = await supabaseAdmin
            .from('member_profiles')
            .update({ email, full_name, phone: phone || null })
            .eq('user_id', newUser.user.id);
          
          if (profileUpdateError) {
            console.log('Error updating profile:', profileUpdateError.message);
            await supabaseAdmin.from('user_roles').delete().eq('user_id', newUser.user.id);
            await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
            throw profileUpdateError;
          }
        }

        console.log('Staff created successfully:', newUser.user.id);
        return new Response(
          JSON.stringify({ success: true, user_id: newUser.user.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update': {
        const { user_id, full_name, phone, email, password } = data;
        
        if (!user_id) {
          return new Response(
            JSON.stringify({ error: 'User ID is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update profile
        const { error: profileUpdateError } = await supabaseAdmin
          .from('member_profiles')
          .update({ full_name, phone, email })
          .eq('user_id', user_id);

        if (profileUpdateError) {
          console.log('Error updating profile:', profileUpdateError.message);
          throw profileUpdateError;
        }

        // Update auth user if email or password changed
        const updateData: any = {};
        if (email) updateData.email = email;
        if (password) updateData.password = password;

        if (Object.keys(updateData).length > 0) {
          const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
            user_id,
            updateData
          );

          if (authUpdateError) {
            console.log('Error updating auth user:', authUpdateError.message);
            throw authUpdateError;
          }
        }

        console.log('Staff updated successfully:', user_id);
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete': {
        const { user_id } = data;
        
        if (!user_id) {
          return new Response(
            JSON.stringify({ error: 'User ID is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Delete user (cascade will handle roles and profiles due to FK)
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);

        if (deleteError) {
          console.log('Error deleting user:', deleteError.message);
          throw deleteError;
        }

        console.log('Staff deleted successfully:', user_id);
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in manage-staff function:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
