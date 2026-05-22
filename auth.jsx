// auth.jsx — Supabase Auth + Login/Signup/AdminLogin
// Phase 3: profiles + purchases agora vêm do Supabase.

const { useState: useStateAuth, useEffect: useEffectAuth } = React;

// ─────────── Supabase Auth API ───────────

// Pega session + profile e devolve um currentUser unificado
async function loadCurrentUser(){
  if (!window.sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;
  return await loadProfileFor(session.user);
}

async function loadProfileFor(authUser){
  if (!authUser) return null;
  // Wrap em safe() pra que falha de rede não pendure o login
  const res = await (window.safe ? window.safe("loadProfileFor", () =>
    sb.from("profiles").select("id, name, email, role, banned, banned_reason, avatar_url, created_at").eq("id", authUser.id).single(),
    { data: null, error: null }
  ) : sb.from("profiles").select("id, name, email, role, banned, banned_reason, avatar_url, created_at").eq("id", authUser.id).single().catch(e=>({data:null, error:e})));

  const profile = res?.data;
  const error = res?.error;
  const base = (!error && profile) ? profile : {
    id: authUser.id,
    name: authUser.user_metadata?.name || authUser.email.split("@")[0],
    email: authUser.email,
    role: "user",
    banned: false,
  };
  if (base.banned){
    try { await sb.auth.signOut(); } catch {}
    return { ...base, _banned: true };
  }
  const purchases = await fetchUserPurchaseIds(base.id);
  return { ...base, purchases };
}

async function signIn(email, password, requireRole){
  const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  if (error) return { error: traduzirErro(error.message) };
  const user = await loadProfileFor(data.user);
  if (user?._banned){
    return { error: "Sua conta foi suspensa." + (user.banned_reason ? ` Motivo: ${user.banned_reason}` : " Entre em contato com o suporte.") };
  }
  if (requireRole && user.role !== requireRole){
    await sb.auth.signOut();
    return { error: requireRole === "admin" ? "Essa conta não é de admin." : "Use a entrada de usuário." };
  }
  return { user };
}

async function signUp({ name, email, password }){
  const { data, error } = await sb.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { name: name.trim().slice(0, 200) } }
  });
  if (error) return { error: traduzirErro(error.message) };
  if (!data.session){
    return { needsConfirmation: true };
  }
  const user = await loadProfileFor(data.user);
  if (user?._banned){
    return { error: "Sua conta foi suspensa." + (user.banned_reason ? ` Motivo: ${user.banned_reason}` : " Entre em contato com o suporte.") };
  }
  return { user };
}

async function signOut(){
  await sb.auth.signOut();
}

async function resetPassword(email){
  if (!email?.trim()) return { error: "Informe seu email." };
  const redirectTo = window.location.origin + window.location.pathname + "?reset=1";
  const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error) return { error: traduzirErro(error.message) };
  return { ok: true };
}

async function updatePassword(newPassword){
  if (!newPassword || newPassword.length < 8) return { error: "A senha precisa de ao menos 8 caracteres." };
  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error) return { error: traduzirErro(error.message) };
  return { ok: true };
}

async function recordPurchase(user, items){
  const r = await createPurchases(user, items);
  if (r.error) return { error: r.error };
  return { purchases: r.purchases };
}

function traduzirErro(msg){
  const m = (msg||"").toLowerCase();
  if (m.includes("invalid login")) return "Email ou senha incorretos.";
  if (m.includes("already registered")) return "Já existe uma conta com esse email.";
  if (m.includes("password should be at least")) return "A senha precisa de ao menos 6 caracteres.";
  if (m.includes("email not confirmed")) return "Confirme seu email antes de entrar.";
  if (m.includes("rate limit")) return "Muitas tentativas. Espere um pouco e tente de novo.";
  return msg || "Erro inesperado.";
}

// ─────────── Auth UI: shared shell ───────────
function AuthShell({ children, kicker, title, sub, footer }){
  return (
    <div className="pagewrap" style={{minHeight:"calc(100vh - 80px)", display:"flex", alignItems:"center", justifyContent:"center", padding: "60px 24px"}}>
      <div style={{width:"100%", maxWidth: 1080, display:"grid", gridTemplateColumns:"1fr 1fr", gap: 0, background:"var(--surface)", border:"1px solid var(--line)", borderRadius:"var(--radius-lg)", overflow:"hidden", boxShadow:"var(--shadow-card)"}}>
        <div style={{padding:"clamp(32px, 4vw, 56px)", display:"flex", flexDirection:"column", justifyContent:"center"}}>
          <div className="mono" style={{fontSize: 11, textTransform:"uppercase", letterSpacing:".1em", color:"var(--primary)", marginBottom: 14}}>{kicker}</div>
          <h1 className="display" style={{fontSize:"clamp(34px, 4vw, 48px)", fontWeight: 700, margin: 0, lineHeight: 1.05}}>{title}</h1>
          {sub && <p style={{color:"var(--muted)", fontSize: 15.5, marginTop: 10, marginBottom: 0}}>{sub}</p>}
          <div style={{marginTop: 28}}>{children}</div>
          {footer && <div style={{marginTop: 22, fontSize: 14, color:"var(--muted)"}}>{footer}</div>}
        </div>
        <div style={{background:"var(--bg)", position:"relative", overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center", padding: 40, borderLeft:"1px solid var(--line)"}}>
          <div aria-hidden style={{position:"absolute", inset: 0, opacity:.6}}>
            <div style={{position:"absolute", top:"10%", left:"15%", animation:"float 6s ease-in-out infinite"}}><Illu.Cross size={60}/></div>
            <div style={{position:"absolute", top:"55%", left:"8%", animation:"float 7s ease-in-out infinite .8s"}}><Illu.Pill size={48} color="var(--acc-1)" bg="var(--fg)"/></div>
            <div style={{position:"absolute", top:"20%", right:"10%", animation:"float 8s ease-in-out infinite 1.2s"}}><Illu.Virus size={64} color="var(--acc-2)"/></div>
            <div style={{position:"absolute", bottom:"15%", right:"18%", animation:"float 5s ease-in-out infinite .4s"}}><Illu.Brain size={56} color="var(--acc-3)"/></div>
          </div>
          <div style={{position:"relative", textAlign:"center", padding: 32}}>
            <Logo size={36}/>
            <p className="serif" style={{fontSize: 28, color:"var(--fg)", marginTop: 22, lineHeight: 1.2, maxWidth: 280}}>
              "Aquele resumo que circula no grupo da turma — agora oficial."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────── Form primitives ───────────
function Field({ label, hint, error, children }){
  return (
    <div style={{display:"flex", flexDirection:"column", gap: 6, marginBottom: 14}}>
      <label style={{fontSize: 13, fontWeight: 600, color:"var(--fg)"}}>{label}</label>
      {children}
      {hint && !error && <div style={{fontSize: 12, color:"var(--muted)"}}>{hint}</div>}
      {error && <div style={{fontSize: 12, color:"var(--primary)", fontWeight: 600}}>{error}</div>}
    </div>
  );
}
function TextInput(props){
  return (
    <input
      {...props}
      style={{
        padding:"13px 14px", borderRadius: 12, border:"1px solid var(--line-strong)",
        background:"var(--bg)", color:"var(--fg)", fontSize: 14.5, fontFamily:"inherit", outline:"none",
        transition:"border-color .15s ease, box-shadow .15s ease",
        ...props.style
      }}
      onFocus={(e)=>{ e.target.style.borderColor="var(--primary)"; e.target.style.boxShadow="0 0 0 4px color-mix(in oklab, var(--primary) 18%, transparent)"; }}
      onBlur={(e)=>{ e.target.style.borderColor="var(--line-strong)"; e.target.style.boxShadow="none"; }}
    />
  );
}

// ─────────── Login ───────────
function Login({ go, onAuth }){
  const [email, setEmail] = useStateAuth("");
  const [password, setPassword] = useStateAuth("");
  const [err, setErr] = useStateAuth("");
  const [busy, setBusy] = useStateAuth(false);
  const [attempts, setAttempts] = useStateAuth(0);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    const r = await signIn(email, password, "user");
    setBusy(false);
    if (r.error){
      setErr(r.error);
      setAttempts(a => a + 1);
      return;
    }
    onAuth(r.user);
    go({ name:"library" });
  };

  return (
    <AuthShell
      kicker="Entrar"
      title="Bem-vindo de volta."
      sub="Acesse seus resumos comprados e continue de onde parou."
      footer={<>Não tem conta? <a onClick={()=>go({name:"signup"})} style={{color:"var(--primary)", cursor:"pointer", fontWeight: 600}}>Crie agora →</a></>}
    >
      <form onSubmit={submit}>
        <Field label="Email">
          <TextInput type="email" required placeholder="voce@email.com" value={email} onChange={e=>setEmail(e.target.value)}/>
        </Field>
        <Field label="Senha" error={err}>
          <TextInput type="password" required placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)}/>
        </Field>
        <div className="row between" style={{marginBottom: 14, marginTop: -4}}>
          <a onClick={()=>go({name:"forgot"})} style={{color:"var(--primary)", cursor:"pointer", fontWeight: 600, fontSize: 13}}>Esqueci minha senha</a>
          {attempts >= 3 && <span style={{fontSize: 12, color:"var(--muted)"}}>Errou {attempts}x? Tente resetar.</span>}
        </div>
        <button className="btn primary lg" type="submit" disabled={busy} style={{width:"100%", justifyContent:"center", marginTop: 6, opacity: busy?.7:1}}>
          {busy ? "Entrando..." : "Entrar →"}
        </button>
        <div style={{marginTop: 18, padding: 14, background:"var(--bg)", borderRadius: 12, border:"1px dashed var(--line-strong)", fontSize: 12.5, color:"var(--muted)"}}>
          <div style={{fontWeight: 700, color:"var(--fg)", marginBottom: 6}}>É admin? <a onClick={()=>go({name:"admin-login"})} style={{color:"var(--primary)", cursor:"pointer"}}>Entrar como admin →</a></div>
          Suas credenciais são gerenciadas pelo Supabase Auth.
        </div>
      </form>
    </AuthShell>
  );
}

// ─────────── Forgot Password ───────────
function ForgotPassword({ go }){
  const [email, setEmail] = useStateAuth("");
  const [busy, setBusy] = useStateAuth(false);
  const [sent, setSent] = useStateAuth(false);
  const [err, setErr] = useStateAuth("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    const r = await resetPassword(email);
    setBusy(false);
    if (r.error){ setErr(r.error); return; }
    setSent(true);
  };

  if (sent){
    return (
      <AuthShell
        kicker="Verifique seu email"
        title="Link enviado!"
        sub={`Mandei um link de reset pra ${email}. Clique nele pra criar uma nova senha. Pode demorar 1-2 min — confira a caixa de spam também.`}
      >
        <button className="btn primary" onClick={()=>go({name:"login"})} style={{width:"100%", justifyContent:"center"}}>Voltar ao login</button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      kicker="Resetar senha"
      title="Esqueci minha senha."
      sub="Digite seu email e mando um link pra criar uma nova senha."
      footer={<>Lembrou? <a onClick={()=>go({name:"login"})} style={{color:"var(--primary)", cursor:"pointer", fontWeight: 600}}>Voltar pro login →</a></>}
    >
      <form onSubmit={submit}>
        <Field label="Email" error={err}>
          <TextInput type="email" required placeholder="voce@email.com" value={email} onChange={e=>setEmail(e.target.value)}/>
        </Field>
        <button className="btn primary lg" type="submit" disabled={busy} style={{width:"100%", justifyContent:"center", marginTop: 6, opacity: busy?.7:1}}>
          {busy ? "Enviando..." : "Enviar link de reset →"}
        </button>
      </form>
    </AuthShell>
  );
}

// ─────────── Reset Password (após clicar no link do email) ───────────
function ResetPassword({ go, onAuth }){
  const [password, setPassword] = useStateAuth("");
  const [confirm, setConfirm] = useStateAuth("");
  const [err, setErr] = useStateAuth("");
  const [busy, setBusy] = useStateAuth(false);
  const [done, setDone] = useStateAuth(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 8){ setErr("Mínimo 8 caracteres."); return; }
    if (!/\d/.test(password)){ setErr("Inclua pelo menos um número."); return; }
    if (password !== confirm){ setErr("As senhas não batem."); return; }
    setBusy(true); setErr("");
    const r = await updatePassword(password);
    setBusy(false);
    if (r.error){ setErr(r.error); return; }
    setDone(true);
    setTimeout(()=>go({ name:"library" }), 1500);
  };

  if (done){
    return (
      <AuthShell kicker="Tudo certo" title="Senha alterada!" sub="Já está logado. Te levando pra biblioteca…">
        <div style={{textAlign:"center", padding: 20, fontSize: 40}}>✓</div>
      </AuthShell>
    );
  }

  return (
    <AuthShell kicker="Nova senha" title="Crie uma nova senha." sub="Escolhe uma senha forte que você vai lembrar.">
      <form onSubmit={submit}>
        <Field label="Nova senha" hint="Mínimo 8 caracteres, incluindo 1 número.">
          <TextInput type="password" required placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)}/>
        </Field>
        <Field label="Confirme a senha" error={err}>
          <TextInput type="password" required placeholder="••••••••" value={confirm} onChange={e=>setConfirm(e.target.value)}/>
        </Field>
        <button className="btn primary lg" type="submit" disabled={busy} style={{width:"100%", justifyContent:"center", marginTop: 6, opacity: busy?.7:1}}>
          {busy ? "Salvando..." : "Salvar nova senha →"}
        </button>
      </form>
    </AuthShell>
  );
}

// ─────────── Signup ───────────
function Signup({ go, onAuth }){
  const [form, setForm] = useStateAuth({ name:"", email:"", password:"" });
  const [err, setErr] = useStateAuth("");
  const [busy, setBusy] = useStateAuth(false);
  const [confirm, setConfirm] = useStateAuth(false);
  const upd = k => e => setForm({...form, [k]: e.target.value});

  const submit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8){ setErr("A senha precisa de ao menos 8 caracteres."); return; }
    if (!/\d/.test(form.password)){ setErr("Inclua pelo menos um número na senha."); return; }
    setBusy(true); setErr("");
    const r = await signUp(form);
    setBusy(false);
    if (r.error){ setErr(r.error); return; }
    if (r.needsConfirmation){ setConfirm(true); return; }
    onAuth(r.user);
    go({ name:"library" });
  };

  if (confirm){
    return (
      <AuthShell kicker="Quase lá" title="Confirme seu email." sub="Mandei um link de confirmação. Clique nele pra ativar sua conta e poder entrar.">
        <button className="btn primary" onClick={()=>go({name:"login"})}>Voltar ao login</button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      kicker="Criar conta"
      title="Crie sua conta."
      sub="Em 30 segundos você já tem acesso ao catálogo e à sua biblioteca."
      footer={<>Já tem conta? <a onClick={()=>go({name:"login"})} style={{color:"var(--primary)", cursor:"pointer", fontWeight: 600}}>Entrar →</a></>}
    >
      <form onSubmit={submit}>
        <Field label="Nome">
          <TextInput required placeholder="Seu nome" value={form.name} onChange={upd("name")}/>
        </Field>
        <Field label="Email">
          <TextInput type="email" required placeholder="voce@email.com" value={form.email} onChange={upd("email")}/>
        </Field>
        <Field label="Senha" hint="Mínimo 8 caracteres, incluindo pelo menos 1 número." error={err}>
          <TextInput type="password" required placeholder="••••••••" value={form.password} onChange={upd("password")}/>
        </Field>
        <button className="btn primary lg" type="submit" disabled={busy} style={{width:"100%", justifyContent:"center", marginTop: 6, opacity: busy?.7:1}}>
          {busy ? "Criando..." : "Criar conta →"}
        </button>
        <div style={{marginTop: 14, fontSize: 11.5, color:"var(--muted)", lineHeight: 1.5}}>
          Ao criar conta, você concorda com os <a style={{textDecoration:"underline", cursor:"pointer"}} onClick={()=>go({name:"terms"})}>Termos</a> e <a style={{textDecoration:"underline", cursor:"pointer"}} onClick={()=>go({name:"privacy"})}>Política de privacidade</a>.
        </div>
      </form>
    </AuthShell>
  );
}

// ─────────── Admin Login ───────────
function AdminLogin({ go, onAuth }){
  const [email, setEmail] = useStateAuth("");
  const [password, setPassword] = useStateAuth("");
  const [err, setErr] = useStateAuth("");
  const [busy, setBusy] = useStateAuth(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    const r = await signIn(email, password, "admin");
    setBusy(false);
    if (r.error){ setErr(r.error); return; }
    onAuth(r.user);
    go({ name:"admin" });
  };

  return (
    <AuthShell
      kicker="Área restrita · Admin"
      title="Acesso administrativo."
      sub="Login exclusivo pra gerenciar resumos e ver histórico de vendas."
      footer={<>Não é admin? <a onClick={()=>go({name:"login"})} style={{color:"var(--primary)", cursor:"pointer", fontWeight: 600}}>Voltar pra entrada de usuário</a></>}
    >
      <form onSubmit={submit}>
        <Field label="Email do admin">
          <TextInput type="email" required placeholder="admin@resumosmed.com" value={email} onChange={e=>setEmail(e.target.value)}/>
        </Field>
        <Field label="Senha" error={err}>
          <TextInput type="password" required placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)}/>
        </Field>
        <button className="btn primary lg" type="submit" disabled={busy} style={{width:"100%", justifyContent:"center", marginTop: 6, background:"var(--fg)", color:"var(--bg)", borderColor:"var(--fg)", opacity: busy?.7:1}}>
          {busy ? "Entrando..." : "Entrar como admin →"}
        </button>
        <div style={{marginTop: 18, padding: 14, background:"var(--bg)", borderRadius: 12, border:"1px dashed var(--line-strong)", fontSize: 12.5, color:"var(--muted)", lineHeight: 1.55}}>
          O admin precisa ter sido criado no Supabase Dashboard (<b style={{color:"var(--fg)"}}>Authentication › Users</b>) e ter <b className="mono" style={{color:"var(--fg)"}}>role='admin'</b> na tabela <b className="mono" style={{color:"var(--fg)"}}>profiles</b>.
        </div>
      </form>
    </AuthShell>
  );
}

// expose
Object.assign(window, {
  loadCurrentUser, loadProfileFor, signIn, signUp, signOut, recordPurchase,
  resetPassword, updatePassword,
  Login, Signup, AdminLogin, ForgotPassword, ResetPassword,
  Field, TextInput, AuthShell,
});
