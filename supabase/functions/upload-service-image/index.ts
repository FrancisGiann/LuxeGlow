import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_MULTIPART_BYTES = MAX_FILE_BYTES + 64 * 1024;
const SERVICE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,49}$/i;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MANAGED_PUBLIC_ID_PREFIX = 'luxeglow/services/';

const corsHeaders = () => ({
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'null',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
});

const isJpeg = (bytes: Uint8Array) => bytes.length >= 3
  && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

const isPng = (bytes: Uint8Array) => bytes.length >= 8
  && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;

const isWebp = (bytes: Uint8Array) => bytes.length >= 12
  && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
  && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;

function hasExpectedSignature(bytes: Uint8Array, mimeType: string) {
  if (mimeType === 'image/jpeg') return isJpeg(bytes);
  if (mimeType === 'image/png') return isPng(bytes);
  return isWebp(bytes);
}

function managedPublicId(publicId: unknown) {
  const value = String(publicId || '');
  return value.startsWith(MANAGED_PUBLIC_ID_PREFIX) && !value.includes('..');
}

function cloudinaryAuth(apiKey: string, apiSecret: string) {
  return `Basic ${btoa(`${apiKey}:${apiSecret}`)}`;
}

async function destroyCloudinaryAsset(cloudName: string, apiKey: string, apiSecret: string, publicId: string) {
  if (!managedPublicId(publicId)) return false;
  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/destroy`, {
      method: 'POST',
      headers: {
        Authorization: cloudinaryAuth(apiKey, apiSecret),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ public_id: publicId, invalidate: 'true', resource_type: 'image', type: 'upload' }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function providerPayload(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const contentLengthHeader = request.headers.get('content-length');
  if (contentLengthHeader !== null) {
    const contentLength = Number(contentLengthHeader);
    if (!Number.isFinite(contentLength) || contentLength < 0) return json({ error: 'Invalid upload request size' }, 400);
    if (contentLength > MAX_MULTIPART_BYTES) return json({ error: 'Upload request is too large' }, 413);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
  const cloudinaryApiKey = Deno.env.get('CLOUDINARY_API_KEY');
  const cloudinaryApiSecret = Deno.env.get('CLOUDINARY_API_SECRET');
  if (!supabaseUrl || !serviceRoleKey || !cloudName || !cloudinaryApiKey || !cloudinaryApiSecret) {
    return json({ error: 'Image upload is not configured' }, 500);
  }

  const authHeader = request.headers.get('authorization') || '';
  const tokenMatch = authHeader.match(/^Bearer\s+(\S+)$/i);
  if (!tokenMatch) return json({ error: 'Authentication required' }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: caller, error: callerError } = await admin.auth.getUser(tokenMatch[1]);
  if (callerError || !caller.user) return json({ error: 'Authentication required' }, 401);
  const { data: callerProfile, error: profileError } = await admin
    .from('profiles')
    .select('role,is_active')
    .eq('id', caller.user.id)
    .maybeSingle();
  if (profileError) return json({ error: 'Could not verify staff access' }, 500);
  if (!callerProfile?.is_active || !['staff', 'admin'].includes(callerProfile.role)) return json({ error: 'Staff access required' }, 403);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json({ error: 'Send a multipart image upload' }, 400);
  }

  const serviceId = String(formData.get('service_id') || '').trim();
  const image = formData.get('image');
  if (!SERVICE_ID_PATTERN.test(serviceId)) return json({ error: 'Invalid service ID' }, 400);
  if (!(image instanceof File)) return json({ error: 'Choose an image to upload' }, 400);

  const mimeType = String(image.type || '').toLocaleLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mimeType)) return json({ error: 'Use a JPEG, PNG, or WebP image' }, 400);
  if (!Number.isFinite(image.size) || image.size <= 0 || image.size > MAX_FILE_BYTES) return json({ error: 'Image must be 5 MB or smaller' }, 400);

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await image.arrayBuffer());
  } catch {
    return json({ error: 'Could not read the uploaded image' }, 400);
  }
  if (bytes.byteLength <= 0 || bytes.byteLength > MAX_FILE_BYTES || bytes.byteLength !== image.size) return json({ error: 'Image must be 5 MB or smaller' }, 400);
  if (!hasExpectedSignature(bytes, mimeType)) return json({ error: 'The uploaded file does not match its image type' }, 400);

  const { data: existingService, error: serviceError } = await admin
    .from('services')
    .select('id,image_public_id')
    .eq('id', serviceId)
    .maybeSingle();
  if (serviceError) return json({ error: 'Could not verify the service' }, 500);
  if (!existingService) return json({ error: 'Service not found' }, 404);

  const publicId = `${MANAGED_PUBLIC_ID_PREFIX}${serviceId}/${crypto.randomUUID()}`;
  const uploadBody = new FormData();
  uploadBody.append('file', new Blob([bytes], { type: mimeType }), image.name || `service-${serviceId}`);
  uploadBody.append('public_id', publicId);

  let uploadPayload: Record<string, unknown> | null = null;
  try {
    const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
      method: 'POST',
      headers: { Authorization: cloudinaryAuth(cloudinaryApiKey, cloudinaryApiSecret) },
      body: uploadBody,
    });
    uploadPayload = await providerPayload(uploadResponse) as Record<string, unknown> | null;
    if (!uploadResponse.ok) {
      if (typeof uploadPayload?.public_id === 'string') {
        await destroyCloudinaryAsset(cloudName, cloudinaryApiKey, cloudinaryApiSecret, uploadPayload.public_id);
      }
      return json({ error: 'Image provider could not accept this upload' }, 502);
    }
    if (typeof uploadPayload?.secure_url !== 'string' || typeof uploadPayload.public_id !== 'string') {
      if (typeof uploadPayload?.public_id === 'string') {
        await destroyCloudinaryAsset(cloudName, cloudinaryApiKey, cloudinaryApiSecret, uploadPayload.public_id);
      }
      return json({ error: 'Image provider could not accept this upload' }, 502);
    }
  } catch {
    return json({ error: 'Image provider could not be reached' }, 502);
  }

  const secureUrl = String(uploadPayload.secure_url);
  const uploadedPublicId = String(uploadPayload.public_id);
  if (!/^https:\/\//i.test(secureUrl) || uploadedPublicId !== publicId || !managedPublicId(uploadedPublicId)) {
    await destroyCloudinaryAsset(cloudName, cloudinaryApiKey, cloudinaryApiSecret, uploadedPublicId);
    return json({ error: 'Image provider returned an invalid upload' }, 502);
  }

  // Compare-and-swap the metadata read before upload. This prevents two
  // simultaneous replacements from deleting each other's current image or
  // leaving the losing Cloudinary asset orphaned.
  let updateQuery = admin
    .from('services')
    .update({ image_path: secureUrl, image_public_id: uploadedPublicId })
    .eq('id', serviceId);
  if (existingService.image_public_id) {
    updateQuery = updateQuery.eq('image_public_id', existingService.image_public_id);
  } else {
    updateQuery = updateQuery.is('image_public_id', null);
  }
  const { data: updatedService, error: updateError } = await updateQuery
    .select('id,image_path,image_public_id')
    .maybeSingle();
  if (updateError || !updatedService) {
    await destroyCloudinaryAsset(cloudName, cloudinaryApiKey, cloudinaryApiSecret, uploadedPublicId);
    return json({ error: updateError ? 'Could not save the service image' : 'The service image changed while this upload was processing' }, updateError ? 500 : 409);
  }

  const previousPublicId = String(existingService.image_public_id || '');
  if (previousPublicId.startsWith(`${MANAGED_PUBLIC_ID_PREFIX}${serviceId}/`) && previousPublicId !== uploadedPublicId) {
    await destroyCloudinaryAsset(cloudName, cloudinaryApiKey, cloudinaryApiSecret, previousPublicId);
  }

  return json({ success: true, image_url: secureUrl, image_path: secureUrl, image_public_id: uploadedPublicId });
});
