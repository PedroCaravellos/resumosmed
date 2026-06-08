// data.jsx — camada de dados Supabase com timeouts e fallbacks seguros.
// Princípio: nenhuma função aqui pode pendurar a UI. Tudo tem timeout
// explícito e devolve um valor padrão seguro em caso de erro.

const Q_TIMEOUT = 6000;

function queryWithTimeout(promise, label = "query"){
  return Promise.race([
    promise,
    new Promise((_, rej) =>
      setTimeout(() => rej(new Error(`[data] ${label} timeout (${Q_TIMEOUT}ms)`)), Q_TIMEOUT)
    ),
  ]);
}

async function safe(label, fn, fallback){
  try {
    return await queryWithTimeout(fn(), label);
  } catch (err) {
    console.warn(`[data] ${label}:`, err?.message || err);
    return fallback;
  }
}

// ─────────── Products ───────────
async function fetchProducts(){
  const res = await safe("fetchProducts", () => sb
    .from("products")
    .select("id,title,area,price,pages,topics,updated,file_path,file_name,created_at,preview,active,quiz_json,quiz_tsx")
    .eq("active", true)
    .order("created_at", { ascending: false }),
    { data: [], error: null }
  );
  if (res?.error){ console.warn("[fetchProducts]", res.error); return []; }
  return (res?.data || []).map(normalizeProduct);
}

async function fetchProductById(id){
  if (!id) return null;
  const res = await safe("fetchProductById", () => sb
    .from("products")
    .select("id,title,area,price,pages,topics,updated,file_path,file_name,preview,quiz_json,quiz_tsx")
    .eq("id", id).maybeSingle(),
    { data: null, error: null }
  );
  if (res?.error){ console.warn("[fetchProductById]", res.error); return null; }
  return res?.data ? normalizeProduct(res.data) : null;
}

async function createProduct(p){
  const id = "r_" + (crypto?.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2,8)));
  const now = new Date();
  const month = now.toLocaleDateString("pt-BR",{month:"short",year:"2-digit"}).replace(".","");
  let file_path = null, file_name = null;
  if (p.file){
    if (p.file.type !== "application/pdf") {
      return { error: "Apenas arquivos PDF são aceitos." };
    }
    const ext = "pdf";
    file_path = `${id}.${ext}`;
    file_name = p.file.name;
    try {
      // Upload usa timeout maior (60s) — PDFs grandes em conexão lenta
      const { error: upErr } = await Promise.race([
        sb.storage.from("resumos").upload(file_path, p.file, {
          contentType: "application/pdf",
          upsert: false,
        }),
        new Promise((_, rej) => setTimeout(() => rej(new Error("Upload timeout (180s)")), 180000))
      ]);
      if (upErr) return { error: "Falha ao subir PDF: " + upErr.message };
    } catch (err) {
      return { error: "Upload do PDF demorou demais ou falhou: " + (err?.message || err) };
    }
  }
  const row = {
    id, title: p.title.trim(), area: p.area,
    price: parseInt(p.price,10) || 0,
    pages: parseInt(p.pages,10) || 0,
    topics: p.topics?.length ? p.topics : ["Conceitos","Diagnóstico","Tratamento","Prova"],
    updated: month, file_path, file_name,
    preview: p.preview || null,
    quiz_json: p.quiz_json || null,
    quiz_tsx: p.quiz_tsx || null,
  };
  const res = await safe("createProduct/insert", () => sb.from("products").insert(row).select().single(), { data: null, error: { message: "timeout" } });
  if (res?.error){
    if (file_path) { try { await sb.storage.from("resumos").remove([file_path]); } catch {} }
    return { error: res.error.message };
  }
  return { product: normalizeProduct(res.data) };
}

async function deleteProduct(id){
  // Soft delete — marca como inativo em vez de deletar fisicamente,
  // preservando a FK com purchases e o acesso de quem já comprou.
  const res = await safe("deleteProduct", () =>
    sb.from("products").update({ active: false }).eq("id", id).select("id"),
    { error: { message: "timeout" } }
  );
  if (res?.error) return { error: res.error.message };
  if (!res?.data?.length) return { error: "Sem permissão. Verifique a RLS policy de UPDATE na tabela products." };
  return { ok: true };
}

async function updateProduct(id, updates, newFile){
  const patch = {};
  if (updates.title  != null) patch.title  = String(updates.title).trim();
  if (updates.area   != null) patch.area   = updates.area;
  if (updates.price  != null) patch.price  = parseInt(updates.price, 10) || 0;
  if (updates.pages  != null) patch.pages  = parseInt(updates.pages, 10) || 0;
  if (updates.topics  != null) patch.topics  = Array.isArray(updates.topics) ? updates.topics : [];
  if (updates.preview != null) patch.preview = updates.preview;
  if (updates.quiz_json !== undefined) patch.quiz_json = updates.quiz_json;
  if (updates.quiz_tsx  !== undefined) patch.quiz_tsx  = updates.quiz_tsx;

  if (newFile){
    if (newFile.type !== "application/pdf") {
      return { error: "Apenas arquivos PDF são aceitos." };
    }
    try {
      const { data: cur } = await queryWithTimeout(
        sb.from("products").select("file_path").eq("id", id).maybeSingle(),
        "updateProduct/lookup"
      );
      if (cur?.file_path){ try { await sb.storage.from("resumos").remove([cur.file_path]); } catch {} }
    } catch {}
    const file_path = `${id}.pdf`;
    try {
      // Upload usa timeout maior (60s)
      const { error: upErr } = await Promise.race([
        sb.storage.from("resumos").upload(file_path, newFile, {
          contentType: "application/pdf",
          upsert: true,
        }),
        new Promise((_, rej) => setTimeout(() => rej(new Error("Upload timeout (180s)")), 180000))
      ]);
      if (upErr) return { error: "Falha ao substituir PDF: " + upErr.message };
    } catch (err) {
      return { error: "Upload demorou demais ou falhou: " + (err?.message || err) };
    }
    patch.file_path = file_path;
    patch.file_name = newFile.name;
  }

  const now = new Date();
  patch.updated = now.toLocaleDateString("pt-BR",{month:"short",year:"2-digit"}).replace(".","");

  const res = await safe("updateProduct", () => sb.from("products").update(patch).eq("id", id).select().single(), { data: null, error: { message: "timeout" } });
  if (res?.error) return { error: res.error.message };
  return { product: normalizeProduct(res.data) };
}

function normalizeProduct(p){
  return {
    ...p,
    topics: Array.isArray(p.topics) ? p.topics : [],
    updated: p.updated || "",
    preview: p.preview || null,
    _custom: !!p.file_path || (p.id||"").startsWith("r_"),
  };
}

// ─────────── Purchases ───────────
async function fetchUserPurchaseIds(userId){
  if (!userId) return [];
  const res = await safe("fetchUserPurchaseIds", () => sb
    .from("purchases").select("product_id").eq("user_id", userId),
    { data: [], error: null }
  );
  return [...new Set((res?.data || []).map(p=>p.product_id))];
}

async function fetchUserPurchases(userId){
  if (!userId) return [];
  const res = await safe("fetchUserPurchases", () => sb
    .from("purchases")
    .select("id,product_id,product_title,price,method,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false }),
    { data: [], error: null }
  );
  return res?.data || [];
}

async function fetchAllSales(){
  const res = await safe("fetchAllSales", () => sb
    .from("sales_with_user")
    .select("id,user_id,product_id,product_title,price,method,created_at,user_name,user_email,product_area")
    .order("created_at", { ascending: false }),
    { data: [], error: null }
  );
  return res?.data || [];
}

async function fetchUsersCount(){
  const res = await safe("fetchUsersCount", () => sb
    .from("profiles")
    .select("*", { count:"exact", head:true })
    .eq("role","user"),
    { count: 0, error: null }
  );
  return res?.count || 0;
}

async function createPurchases(user, items){
  if (!user || !items?.length) return { error:"Sem usuário ou itens." };
  const rows = items.map(it => ({
    user_id: user.id, product_id: it.id, product_title: it.title,
    price: it.price, method: "Pix",
  }));
  const res = await safe("createPurchases", () => sb.from("purchases").insert(rows).select(), { data: null, error: { message: "timeout" } });
  if (res?.error) return { error: res.error.message };
  return { purchases: res.data };
}

// ─────────── Quiz image upload ───────────
async function uploadQuizImage(productId, questionId, file){
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${productId}/${questionId}.${ext}`;
  const { error } = await Promise.race([
    sb.storage.from("quiz-images").upload(path, file, { contentType: file.type || "image/jpeg", upsert: true }),
    new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 30000)),
  ]);
  if (error) return { error: error.message };
  const { data } = sb.storage.from("quiz-images").getPublicUrl(path);
  return { url: data.publicUrl };
}

// ─────────── Storage (signed URLs) ───────────
async function getSignedPdfUrl(filePath, expiresIn = 15*60){
  if (!filePath) return null;
  const res = await safe("getSignedPdfUrl", () => sb.storage.from("resumos").createSignedUrl(filePath, expiresIn), { data: null, error: null });
  return res?.data?.signedUrl || null;
}

// ─────────── Activity logging & terms ───────────
async function logEvent(userId, productId, event, severity = "info", meta = null){
  if (!userId) return;
  // Fire-and-forget — não bloqueia UI nem mostra erro pro usuário
  try {
    await queryWithTimeout(
      sb.from("access_logs").insert({ user_id: userId, product_id: productId || null, event, severity, meta }),
      "logEvent"
    );
  } catch (e) { console.warn("[logEvent]", e?.message || e); }
}

async function hasAcceptedTerms(userId){
  if (!userId) return false;
  const res = await safe("hasAcceptedTerms", () => sb.from("terms_acceptance").select("user_id").eq("user_id", userId).maybeSingle(), { data: null, error: null });
  return !!res?.data;
}

async function acceptTerms(userId){
  const ua = navigator.userAgent;
  // Idempotente — se já aceitou (PK conflict), trata como sucesso
  const res = await safe("acceptTerms", () => sb.from("terms_acceptance").upsert({ user_id: userId, user_agent: ua }, { onConflict: "user_id" }), { error: null });
  return res?.error ? { error: res.error.message } : { ok: true };
}

async function saveDeviceFingerprint(userId, fingerprint, deviceName){
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return { error: "Sessão inválida" };
    const correlationId = `${window.__SESSION_ID || "x"}_${Date.now()}`;
    const res = await fetch(`${window.SUPABASE_URL}/functions/v1/save-device-fingerprint`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
        "X-Correlation-Id": correlationId,
      },
      body: JSON.stringify({ fingerprint, deviceName }),
    });
    const body = await res.json();
    if (!res.ok || body.error) return { error: body.error || "Falha ao salvar" };
    return { ok: true };
  } catch (e) {
    return { error: String(e) };
  }
}

// ─────────── Admin: user management ───────────
async function fetchUserActivity(){
  const res = await safe("fetchUserActivity", () => sb
    .from("user_activity_summary")
    .select("*")
    .order("high_events", { ascending: false, nullsFirst: false })
    .order("warning_events", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false }),
    { data: [], error: null }
  );
  return res?.data || [];
}

async function fetchUserLogs(userId, limit = 50){
  if (!userId) return [];
  const res = await safe("fetchUserLogs", () => sb
    .from("access_logs")
    .select("id,product_id,event,severity,meta,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit),
    { data: [], error: null }
  );
  return res?.data || [];
}

async function setUserBan(targetId, banned, reason){
  const res = await safe("setUserBan", () => sb.rpc("admin_set_ban", { target_user: targetId, ban: banned, reason: reason || null }), { error: { message: "timeout" } });
  return res?.error ? { error: res.error.message } : { ok: true };
}

async function fetchPendingPaymentStatus(chargeId){
  if (!chargeId) return null;
  const res = await safe("fetchPendingPaymentStatus", () => sb
    .from("pending_payments").select("status").eq("id", chargeId).maybeSingle(),
    { data: null, error: null }
  );
  return res?.data?.status || null;
}

// ─────────── Admin: library management ───────────
async function adminGrantPurchase(userId, product){
  const res = await safe("adminGrantPurchase", () =>
    sb.from("purchases").insert({
      user_id: userId,
      product_id: product.id,
      product_title: product.title,
      price: 0,
      method: "Admin",
    }).select().single(),
    { data: null, error: { message: "timeout" } }
  );
  if (res?.error) return { error: res.error.message };
  return { purchase: res.data };
}

async function adminRevokePurchase(purchaseId){
  const res = await safe("adminRevokePurchase", () =>
    sb.from("purchases").delete().eq("id", purchaseId).select("id"),
    { error: { message: "timeout" } }
  );
  if (res?.error) return { error: res.error.message };
  if (!res?.data?.length) return { error: "Sem permissão para remover. Verifique a RLS policy de DELETE em purchases." };
  return { ok: true };
}

async function saveQuizJson(productId, quizJson){
  const res = await safe("saveQuizJson", () =>
    sb.from("products").update({ quiz_json: quizJson }).eq("id", productId).select("id"),
    { error: { message: "timeout" } }
  );
  if (res?.error) return { error: res.error.message };
  return { ok: true };
}

async function saveQuizTsx(productId, quizTsx){
  const res = await safe("saveQuizTsx", () =>
    sb.from("products").update({ quiz_tsx: quizTsx }).eq("id", productId).select("id"),
    { error: { message: "timeout" } }
  );
  if (res?.error) return { error: res.error.message };
  return { ok: true };
}

// ─────────── Support Tickets ───────────
async function fetchUserTickets(userId){
  if (!userId) return [];
  const res = await safe("fetchUserTickets", () =>
    sb.from("support_tickets")
      .select("id, subject, message, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    { data: [], error: null }
  );
  return res?.data || [];
}

async function submitSupportTicket(userId, email, subject, message){
  const res = await safe("submitSupportTicket", () =>
    sb.from("support_tickets")
      .insert({ user_id: userId, email, subject, message, status: "open" })
      .select()
      .single(),
    { data: null, error: { message: "timeout" } }
  );
  if (res?.error) return { error: res.error.message };
  return { ticket: res.data };
}

async function fetchAllTickets(){
  const res = await safe("fetchAllTickets", () =>
    sb.from("support_tickets")
      .select("id, user_id, email, subject, message, status, created_at")
      .order("created_at", { ascending: false }),
    { data: [], error: null }
  );
  return res?.data || [];
}

async function resolveTicket(id){
  const res = await safe("resolveTicket", () =>
    sb.from("support_tickets")
      .update({ status: "resolved" })
      .eq("id", id),
    { error: { message: "timeout" } }
  );
  if (res?.error) return { error: res.error.message };
  return { ok: true };
}

async function deleteTicket(id){
  const res = await safe("deleteTicket", () =>
    sb.from("support_tickets").delete().eq("id", id),
    { error: { message: "timeout" } }
  );
  if (res?.error) return { error: res.error.message };
  return { ok: true };
}

async function fetchTicketReplies(ticketId){
  if (!ticketId) return [];
  const res = await safe("fetchTicketReplies", () =>
    sb.from("ticket_replies")
      .select("id, ticket_id, user_id, message, is_admin, created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true }),
    { data: [], error: null }
  );
  return res?.data || [];
}

async function addTicketReply(ticketId, userId, message, isAdmin = false){
  const res = await safe("addTicketReply", () =>
    sb.from("ticket_replies")
      .insert({ ticket_id: ticketId, user_id: userId, message, is_admin: isAdmin })
      .select()
      .single(),
    { data: null, error: { message: "timeout" } }
  );
  if (res?.error) return { error: res.error.message };
  return { reply: res.data };
}

Object.assign(window, {
  fetchProducts, fetchProductById, createProduct, updateProduct, deleteProduct,
  fetchUserPurchaseIds, fetchUserPurchases, fetchAllSales, fetchUsersCount,
  createPurchases, getSignedPdfUrl, fetchPendingPaymentStatus,
  normalizeProduct,
  logEvent, hasAcceptedTerms, acceptTerms, saveDeviceFingerprint,
  fetchUserActivity, fetchUserLogs, setUserBan,
  adminGrantPurchase, adminRevokePurchase, saveQuizJson, saveQuizTsx, uploadQuizImage,
  fetchUserTickets, submitSupportTicket, fetchAllTickets, resolveTicket, deleteTicket,
  fetchTicketReplies, addTicketReply,
  Q_TIMEOUT, queryWithTimeout, safe,
});
