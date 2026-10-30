import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
new TextEncoder();
function normalizePhMobile(value) {
	const input = String(value || "").replace(/[\s().-]/g, "");
	const normalized = /^09\d{9}$/.test(input) ? `+63${input.slice(1)}` : /^639\d{9}$/.test(input) ? `+${input}` : input;
	return /^\+639\d{9}$/.test(normalized) ? normalized : null;
}
//#endregion
//#region supabase/functions/_shared/passwordRecovery.js
const encoder = new TextEncoder();
const EMAIL = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/u;
const GENERIC_REQUEST = "If this account has a verified recovery method, we will send instructions.";
const GENERIC_VERIFY = "That code or link is invalid or expired.";
function normalizeRecoveryIdentifier(value) {
	const email = String(value || "").trim().toLowerCase();
	return email.length <= 254 && EMAIL.test(email) ? email : null;
}
function eligibleRecoveryDestination(user, alias, identifier, channel) {
	if (!user || !identifier || !["sms", "email"].includes(channel)) return null;
	if (alias && (alias.user_id !== user.id || alias.email_normalized !== identifier)) return null;
	if (channel === "sms") {
		const phone = normalizePhMobile(user.phone);
		if (!user.phone_confirmed_at || !phone || alias && alias.phone_e164 !== phone) return null;
		return phone;
	}
	const email = String(user.email || "").trim().toLowerCase();
	if (!user.email_confirmed_at || email !== identifier) return null;
	return email;
}
function recoverySms(code) {
	if (!/^\d{8}$/.test(code)) throw new TypeError("Invalid recovery code");
	return `LuxeGlow password reset code: ${code}. Expires in 5 min. Do not share this code.`;
}
function recoveryEmailLink(base, id, token) {
	const link = new URL(base);
	link.hash = new URLSearchParams({
		recovery_id: id,
		recovery_token: token
	}).toString();
	return link.toString();
}
function randomDigits(length = 8, random = crypto.getRandomValues.bind(crypto)) {
	if (!Number.isInteger(length) || length < 6 || length > 10) throw new TypeError("Invalid length");
	let result = "";
	while (result.length < length) {
		const bytes = /* @__PURE__ */ new Uint8Array(16);
		random(bytes);
		for (const byte of bytes) {
			if (byte < 250) result += String(byte % 10);
			if (result.length === length) break;
		}
	}
	return result;
}
function randomToken(random = crypto.getRandomValues.bind(crypto)) {
	const bytes = /* @__PURE__ */ new Uint8Array(32);
	random(bytes);
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function keyedHash(secret, purpose, value) {
	if (typeof secret !== "string" || secret.length < 32) throw new Error("Recovery hash key unavailable");
	const key = await crypto.subtle.importKey("raw", encoder.encode(secret), {
		name: "HMAC",
		hash: "SHA-256"
	}, false, ["sign"]);
	const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(`luxeglow:recovery:${purpose}:${value}`)));
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
//#endregion
//#region supabase/functions/_shared/readBoundedBody.js
async function readBoundedBody(request, maxBytes) {
	if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new TypeError("Invalid body limit");
	const reader = request.body?.getReader();
	if (!reader) return null;
	const chunks = [];
	let total = 0;
	try {
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			total += value.byteLength;
			if (total > maxBytes) {
				await reader.cancel();
				return null;
			}
			chunks.push(value);
		}
		const bytes = new Uint8Array(total);
		let offset = 0;
		for (const chunk of chunks) {
			bytes.set(chunk, offset);
			offset += chunk.byteLength;
		}
		return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	} catch {
		return null;
	}
}
function recoveryTestFixture({ projectUrl, enabled, channel, destination, phone, smsCode, email, emailToken }) {
	if (!enabled) return null;
	if (projectUrl !== "https://bpnzjzugpnbpwzthzbfp.supabase.co") throw new Error("Recovery test mode is restricted to staging");
	if (channel === "sms" && normalizePhMobile(phone) === destination && /^\d{8}$/.test(String(smsCode || ""))) return String(smsCode);
	if (channel === "email" && String(email || "").trim().toLowerCase() === destination && /^[0-9a-f]{64}$/.test(String(emailToken || ""))) return String(emailToken);
	return null;
}
//#endregion
//#region supabase/functions/password-recovery/index.ts
const origin = Deno.env.get("ALLOWED_ORIGIN") || "";
const headers = {
	"Content-Type": "application/json",
	"Cache-Control": "no-store",
	"Access-Control-Allow-Origin": origin,
	"Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
	"Access-Control-Allow-Methods": "POST, OPTIONS"
};
const reply = (body, status = 200) => new Response(JSON.stringify(body), {
	status,
	headers
});
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const hex64 = /^[0-9a-f]{64}$/;
async function sendSms(phone, code) {
	const key = Deno.env.get("UNISMS_SECRET_KEY");
	const sender = Deno.env.get("UNISMS_SENDER_ID");
	if (!key || !sender) return false;
	return (await fetch("https://unismsapi.com/api/sms", {
		method: "POST",
		signal: AbortSignal.timeout(4e3),
		headers: {
			Authorization: `Basic ${btoa(`${key}:`)}`,
			"Content-Type": "application/json"
		},
		body: JSON.stringify({
			recipient: phone,
			sender_id: sender,
			content: recoverySms(code)
		})
	})).status === 201;
}
async function sendEmail(email, link) {
	const key = Deno.env.get("RESEND_API_KEY");
	const from = Deno.env.get("MAIL_FROM_ADDRESS");
	if (!key || !from) return false;
	return (await fetch("https://api.resend.com/emails", {
		method: "POST",
		signal: AbortSignal.timeout(5e3),
		headers: {
			Authorization: `Bearer ${key}`,
			"Content-Type": "application/json"
		},
		body: JSON.stringify({
			from: `LuxeGlow <${from}>`,
			to: [email],
			subject: "Reset your LuxeGlow password",
			text: `Use this LuxeGlow password reset link within 15 minutes: ${link}\nDo not share this link. If you did not request it, you can ignore this email.`
		})
	})).ok;
}
Deno.serve(async (request) => {
	if (request.method === "OPTIONS") return new Response(null, {
		status: 204,
		headers
	});
	if (request.method !== "POST") return reply({ error: "Method not allowed" }, 405);
	if (!origin) return reply({ error: "Recovery unavailable" }, 503);
	if (request.headers.get("origin") !== origin) return reply({ error: "Invalid origin" }, 403);
	const url = Deno.env.get("SUPABASE_URL");
	const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
	const hashKey = Deno.env.get("PASSWORD_RECOVERY_HASH_KEY");
	if (!url || !serviceKey || !hashKey || hashKey.length < 32) return reply({ error: "Recovery unavailable" }, 503);
	const testMode = Deno.env.get("RECOVERY_TEST_MODE") === "true";
	if (testMode && url !== "https://bpnzjzugpnbpwzthzbfp.supabase.co") return reply({ error: "Recovery unavailable" }, 503);
	const declaredLength = request.headers.get("content-length");
	if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > 4096)) return reply({ error: "Invalid request" }, 413);
	let input;
	try {
		const body = await readBoundedBody(request, 4096);
		if (body === null) return reply({ error: "Invalid request" }, 413);
		input = JSON.parse(body);
		if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error();
	} catch {
		return reply({ error: "Invalid request" }, 400);
	}
	const admin = createClient(url, serviceKey, { auth: {
		persistSession: false,
		autoRefreshToken: false
	} });
	if (input.action === "request") {
		const startedAt = Date.now();
		const genericResponse = async (body) => {
			await new Promise((resolve) => setTimeout(resolve, Math.max(0, 5200 - (Date.now() - startedAt))));
			return reply(body);
		};
		const identifier = normalizeRecoveryIdentifier(input.email);
		const channel = input.channel;
		const challengeId = crypto.randomUUID();
		const generic = {
			success: true,
			challenge_id: challengeId,
			message: GENERIC_REQUEST
		};
		if (!identifier || !["sms", "email"].includes(String(channel))) return genericResponse(generic);
		if (Deno.env.get("RECOVERY_SENDING_ENABLED") !== "true") return reply({ error: "Recovery unavailable" }, 503);
		try {
			const requestRateHash = await keyedHash(hashKey, "request-identifier", identifier);
			const { data: allowedRate, error: rateError } = await admin.rpc("reserve_password_recovery_ip", { p_ip_hash: requestRateHash });
			if (rateError) return reply({ error: "Recovery unavailable" }, 503);
			if (allowedRate !== true) return testMode ? reply({ error: "Staging recovery request limit reached. No test code was created." }, 429) : genericResponse(generic);
			const { data: aliases, error: aliasError } = await admin.from("customer_login_aliases").select("user_id,email_normalized,phone_e164").eq("email_normalized", identifier).limit(2);
			if (aliasError) return reply({ error: "Recovery unavailable" }, 503);
			const alias = aliases?.length === 1 ? aliases[0] : null;
			const { data: profiles, error: profileError } = alias ? {
				data: [],
				error: null
			} : await admin.from("profiles").select("id").eq("email", identifier).limit(2);
			if (profileError) return reply({ error: "Recovery unavailable" }, 503);
			const userId = alias?.user_id || (profiles?.length === 1 ? profiles[0].id : null);
			if (!userId) return genericResponse(generic);
			const { data: profile } = await admin.from("profiles").select("role,is_active").eq("id", userId).maybeSingle();
			if (!profile?.is_active || ![
				"customer",
				"head",
				"admin"
			].includes(profile.role)) return genericResponse(generic);
			const { data: authUser, error: userError } = await admin.auth.admin.getUserById(userId);
			if (userError || !authUser?.user) return genericResponse(generic);
			const destination = eligibleRecoveryDestination(authUser.user, alias, identifier, channel);
			if (!destination) return genericResponse(generic);
			const fixtureSecret = recoveryTestFixture({
				projectUrl: url,
				enabled: testMode,
				channel,
				destination,
				phone: Deno.env.get("RECOVERY_TEST_PHONE"),
				smsCode: Deno.env.get("RECOVERY_TEST_SMS_CODE"),
				email: Deno.env.get("RECOVERY_TEST_EMAIL"),
				emailToken: Deno.env.get("RECOVERY_TEST_EMAIL_TOKEN")
			});
			if (testMode && !fixtureSecret) return genericResponse(generic);
			const secret = fixtureSecret || (channel === "sms" ? randomDigits() : randomToken());
			const secretHash = await keyedHash(hashKey, `${channel}-challenge:${challengeId}`, secret);
			const destinationHash = channel === "sms" ? await smsPhoneHash(Deno.env.get("SMS_RATE_SECRET") || "", destination) : await keyedHash(hashKey, "email-destination", destination);
			const ipHash = requestRateHash;
			const expires = new Date(Date.now() + (channel === "sms" ? 5 : 15) * 6e4).toISOString();
			const { data: reserved, error: reserveError } = await admin.rpc("reserve_password_recovery", {
				p_id: challengeId,
				p_user_id: userId,
				p_channel: channel,
				p_secret_hash: secretHash,
				p_destination_hash: destinationHash,
				p_ip_hash: ipHash,
				p_expires_at: expires
			});
			if (reserveError) return reply({ error: "Recovery unavailable" }, 503);
			if (reserved !== true) return testMode ? reply({ error: "Staging recovery send limit reached. No test code was created." }, 429) : genericResponse(generic);
			if (testMode) return genericResponse(generic);
			if (channel === "sms") await sendSms(destination, secret);
			else {
				const base = Deno.env.get("RECOVERY_REDIRECT_URL");
				if (!base || !base.startsWith(`${origin}/`)) return reply({ error: "Recovery unavailable" }, 503);
				await sendEmail(destination, recoveryEmailLink(base, challengeId, secret));
			}
			return genericResponse(generic);
		} catch {
			return genericResponse(generic);
		}
	}
	if (input.action === "verify") {
		const id = String(input.challenge_id || "");
		const secret = String(input.code || input.token || "");
		if (!uuid.test(id) || !(/^\d{8}$/.test(secret) || hex64.test(secret))) return reply({
			success: false,
			error: GENERIC_VERIFY
		}, 400);
		const hash = await keyedHash(hashKey, `${/^\d{8}$/.test(secret) ? "sms" : "email"}-challenge:${id}`, secret);
		const grant = randomToken();
		const grantHash = await keyedHash(hashKey, "reset-grant", grant);
		const ipHash = await keyedHash(hashKey, "verify-challenge", id);
		const { data, error } = await admin.rpc("verify_password_recovery", {
			p_id: id,
			p_secret_hash: hash,
			p_grant_hash: grantHash,
			p_ip_hash: ipHash
		});
		if (error) return reply({ error: "Recovery unavailable" }, 503);
		if (data !== true) return reply({
			success: false,
			error: GENERIC_VERIFY
		}, 400);
		return reply({
			success: true,
			reset_token: grant,
			expires_in: 600
		});
	}
	if (input.action === "reset") {
		if (Deno.env.get("RECOVERY_RESET_ENABLED") !== "true") return reply({ error: "Recovery unavailable" }, 503);
		const grant = String(input.reset_token || "");
		const password = String(input.password || "");
		if (!hex64.test(grant) || password.length < 8 || password.length > 1024 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || ![...password].some((c) => "!@#$%^&*()_+-=[]{};':\"|<>?,./`~".includes(c))) return reply({ error: "Invalid reset request" }, 400);
		const grantHash = await keyedHash(hashKey, "reset-grant", grant);
		const { data: userId, error: claimError } = await admin.rpc("claim_password_recovery_grant", { p_grant_hash: grantHash });
		if (claimError) return reply({ error: "Recovery unavailable" }, 503);
		if (!userId) return reply({ error: GENERIC_VERIFY }, 400);
		const { error: updateError } = await admin.auth.admin.updateUserById(userId, { password });
		if (updateError) return reply({ error: "Could not reset password. Request a new code." }, 503);
		const { data: revoked, error: revokeError } = await admin.rpc("revoke_password_recovery_sessions", { p_user_id: userId });
		if (revokeError || revoked !== true) return reply({ error: "Password changed; contact support to secure existing sessions." }, 503);
		return reply({
			success: true,
			message: "Password changed. Sign in with your new password."
		});
	}
	return reply({ error: "Invalid request" }, 400);
});
async function smsPhoneHash(secret, phone) {
	if (secret.length < 32) throw new Error("SMS rate secret unavailable");
	const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), {
		name: "HMAC",
		hash: "SHA-256"
	}, false, ["sign"]);
	const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(phone)));
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
//#endregion
