// ============================================================================
// ARCHITECTURE BOUNDARY -- READ BEFORE EDITING
// ============================================================================
// This function is authentication infrastructure ONLY.
//
// It does exactly three things: verify the caller is an active Administrator, call
// auth.admin.inviteUserByEmail(), and return the result in a predictable shape.
//
// Business logic must NEVER be added here -- no staff_profiles, no staff_permissions, no
// staff_stores, no role/permission/Locale assignment, no validation of business rules. All of
// that continues to be created by the existing client-side flow immediately after this function
// returns, protected by the same RLS policies and triggers as every other write in this app (see
// supabase/migrations/022_staff_management.sql). If a future change needs this function to know
// anything about "staff" as a business concept, that's a sign the change belongs in the client
// flow instead, not here.
// ============================================================================
//
// Always responds with HTTP 200 -- success/failure is encoded entirely in the JSON body's
// `success` field, not the HTTP status. This sidesteps supabase-js's functions.invoke() treating
// non-2xx responses as transport-level errors (FunctionsHttpError, whose body requires extra
// parsing to reach) -- the client only ever has to look in one place, and only ever needs to
// switch on `code`, never parse `message` (message is for logs/debugging, not client logic).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type FailureCode =
  | 'INVALID_REQUEST'
  | 'NOT_ADMINISTRATOR'
  | 'INVALID_REDIRECT_URL'
  | 'EMAIL_ALREADY_EXISTS'
  | 'INVITATION_FAILED'
  | 'UNKNOWN_ERROR'

interface SuccessResponse {
  success: true
  userId: string
  email: string
}

interface FailureResponse {
  success: false
  code: FailureCode
  message: string
}

function jsonResponse(body: SuccessResponse | FailureResponse) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function failure(code: FailureCode, message: string) {
  return jsonResponse({ success: false, code, message })
}

async function handleRequest(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return failure('INVALID_REQUEST', 'Only POST is supported.')
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return failure('NOT_ADMINISTRATOR', 'Missing Authorization header.')
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  // Resolve the caller from their own session JWT -- this is the only thing that tells us who is
  // actually asking, since everything from here on uses the service role, which bypasses RLS.
  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  const { data: callerData, error: callerError } = await adminClient.auth.getUser(jwt)
  if (callerError || !callerData.user) {
    return failure('NOT_ADMINISTRATOR', 'Invalid or expired session.')
  }

  // Authorization -- this function's own responsibility to enforce, since service-role access
  // bypasses staff_profiles' RLS entirely. Only an active Administrator may invite anyone.
  const { data: callerProfile, error: profileError } = await adminClient
    .from('staff_profiles')
    .select('role, is_active')
    .eq('user_id', callerData.user.id)
    .maybeSingle()

  if (profileError) {
    return failure('UNKNOWN_ERROR', 'Could not verify the caller.')
  }
  if (!callerProfile || callerProfile.role !== 'administrator' || !callerProfile.is_active) {
    return failure('NOT_ADMINISTRATOR', 'Only an active Administrator may invite new users.')
  }

  let body: { email?: unknown; redirectTo?: unknown }
  try {
    body = await req.json()
  } catch {
    return failure('INVALID_REQUEST', 'Request body must be valid JSON.')
  }

  const email = typeof body.email === 'string' ? body.email.trim() : ''
  if (!email || !email.includes('@')) {
    return failure('INVALID_REQUEST', 'A valid email is required.')
  }

  // No hardcoded redirect target -- the caller supplies it (its own origin: local/staging/prod),
  // this function only validates it's a well-formed http(s) URL before handing it to Supabase.
  const redirectToRaw = typeof body.redirectTo === 'string' ? body.redirectTo.trim() : ''
  if (!redirectToRaw) {
    return failure('INVALID_REDIRECT_URL', 'redirectTo is required.')
  }
  let redirectUrl: URL
  try {
    redirectUrl = new URL(redirectToRaw)
  } catch {
    return failure('INVALID_REDIRECT_URL', 'redirectTo must be a valid absolute URL.')
  }
  if (redirectUrl.protocol !== 'http:' && redirectUrl.protocol !== 'https:') {
    return failure('INVALID_REDIRECT_URL', 'redirectTo must use http or https.')
  }

  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: redirectUrl.toString(),
  })

  if (inviteError) {
    // Never forward the raw Supabase error object -- map the one case the client needs to
    // distinguish (duplicate email) and fall back to a generic code for everything else.
    const alreadyExists = inviteError.status === 422 || /already registered|already exists/i.test(inviteError.message)
    if (alreadyExists) {
      return failure('EMAIL_ALREADY_EXISTS', 'A user with this email already exists.')
    }
    return failure('INVITATION_FAILED', 'Could not send the invitation.')
  }

  if (!inviteData.user) {
    return failure('INVITATION_FAILED', 'Could not send the invitation.')
  }

  return jsonResponse({ success: true, userId: inviteData.user.id, email })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    return await handleRequest(req)
  } catch {
    // Guarantees every code path returns the predictable {success, code, message} shape -- an
    // uncaught exception here would otherwise reach the client as a bare 500 with no JSON body,
    // defeating the whole point of a consistent response contract.
    return failure('UNKNOWN_ERROR', 'An unexpected error occurred.')
  }
})
