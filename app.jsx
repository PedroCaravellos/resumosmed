// app.jsx — App shell with routing, auth, tweaks

const { useState: useStateA, useEffect: useEffectA, useCallback: useCallbackA, useRef: useRefA } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": ["#E84A6B", "#FFD66B", "#8FCB6E", "#7AB6F0"],
  "dark": false,
  "density": "regular",
  "type": "modern",
  "card": "sticker",
  "hero": "turma"
}/*EDITMODE-END*/;

const PALETTES = [
  ["#FF6B5B", "#FFD66B", "#7BC47F", "#B5A6F0"], // coral (default — friendly)
  ["#2BB673", "#FFD66B", "#F5A86C", "#6FB6E0"], // mint scrub
  ["#5B5BFF", "#FFB36B", "#7BD4C9", "#F09EBF"], // cobalt
  ["#E84A6B", "#FFD66B", "#8FCB6E", "#7AB6F0"], // raspberry
  ["#F0792B", "#FFE066", "#A2D6B6", "#C8B6E2"], // tangerine
  ["#1E1E1E", "#FFE066", "#7BC47F", "#FF6B5B"], // brutalist
];

function applyPalette(p){
  const root = document.documentElement;
  root.style.setProperty("--primary", p[0]);
  root.style.setProperty("--acc-1", p[1]);
  root.style.setProperty("--acc-2", p[2]);
  root.style.setProperty("--acc-3", p[3] || p[1]);
  const ink = bestContrast(p[0]);
  root.style.setProperty("--primary-ink", ink);
}
function bestContrast(hex){
  const c = hex.replace("#","");
  const r = parseInt(c.substring(0,2),16);
  const g = parseInt(c.substring(2,4),16);
  const b = parseInt(c.substring(4,6),16);
  const lum = (0.299*r + 0.587*g + 0.114*b) / 255;
  return lum > 0.62 ? "#1B1A17" : "#FFFFFF";
}

function App(){
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  // Detecta query string ?reset=1 ou hash #type=recovery (link de email do Supabase)
  const initialRoute = (() => {
    try {
      const qs = new URLSearchParams(window.location.search);
      if (qs.get("reset") === "1") return { name: "reset-password" };
      if (qs.get("payment_return") === "1") return { name: "payment-return" };
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      if (hash.get("type") === "recovery") return { name: "reset-password" };
    } catch {}
    return { name: "landing" };
  })();
  const [route, setRoute] = useStateA(initialRoute);
  // Carrinho persistido em localStorage
  const [cart, setCart] = useStateA(() => {
    try { return JSON.parse(localStorage.getItem("resumosmed_cart")) || []; }
    catch { return []; }
  });
  useEffectA(()=>{
    try { localStorage.setItem("resumosmed_cart", JSON.stringify(cart)); } catch {}
  }, [cart]);

  const [currentUser, setCurrentUser] = useStateA(null);
  const [authReady, setAuthReady] = useStateA(false);
  // Ref para ler o currentUser atual dentro do closure do onAuthStateChange
  const currentUserRef = useRefA(null);
  useEffectA(()=>{ currentUserRef.current = currentUser; }, [currentUser]);

  // Auth: bootstrap session + subscribe to changes
  useEffectA(()=>{
    let mounted = true;
    const guard = setTimeout(()=>{
      if (mounted) setAuthReady(true);
    }, 3000);

    loadCurrentUser()
      .then(u => {
        if (!mounted) return;
        if (u?._banned){
          alert("Sua conta foi suspensa." + (u.banned_reason ? `\n\nMotivo: ${u.banned_reason}` : ""));
          setCurrentUser(null);
        } else {
          setCurrentUser(u);
        }
        setAuthReady(true);
        clearTimeout(guard);
      })
      .catch(err => {
        console.error("[auth] loadCurrentUser falhou:", err);
        if (mounted){ setCurrentUser(null); setAuthReady(true); }
        clearTimeout(guard);
      });

    const { data: sub } = sb.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      // Só limpa o usuário em logout explícito — nunca em eventos transitórios
      if (!session){ if (event === "SIGNED_OUT") setCurrentUser(null); setAuthReady(true); return; }
      // TOKEN_REFRESHED e PASSWORD_RECOVERY não precisam recarregar perfil
      if (event === "TOKEN_REFRESHED" || event === "PASSWORD_RECOVERY") return;
      // SIGNED_IN e INITIAL_SESSION disparam no alt-tab e no foco da aba — se já temos
      // um usuário carregado, ignorar para evitar flash de "acesso restrito"
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && currentUserRef.current) return;
      try {
        const u = await loadProfileFor(session.user);
        if (!mounted) return;
        if (u?._banned){
          alert("Sua conta foi suspensa." + (u.banned_reason ? `\n\nMotivo: ${u.banned_reason}` : ""));
          setCurrentUser(null);
          return;
        }
        setCurrentUser(u);
        setAuthReady(true);
      } catch (err) {
        console.error("[auth] onAuthStateChange:", err);
      }
    });
    return () => { mounted = false; clearTimeout(guard); sub?.subscription?.unsubscribe?.(); };
  }, []);

  useEffectA(()=>{
    applyPalette(t.palette);
    document.documentElement.dataset.dark = String(!!t.dark);
    document.documentElement.dataset.density = t.density;
    document.documentElement.dataset.type = t.type;
    document.documentElement.dataset.card = t.card;
  }, [t.palette, t.dark, t.density, t.type, t.card]);

  const go = useCallbackA((r) => {
    setRoute(r);
    requestAnimationFrame(()=> window.scrollTo({ top: 0, behavior: "smooth" }));
    if (r.anchor) {
      setTimeout(()=>{
        const el = document.getElementById(r.anchor);
        if (el) el.scrollIntoView({ behavior:"smooth", block:"start" });
      }, 80);
    }
  }, []);

  const addToCart = (r) => setCart(c => c.find(x=>x.id===r.id) ? c : [...c, r]);
  const removeFromCart = (id) => setCart(c => c.filter(x=>x.id!==id));
  const clearCart = () => setCart([]);

  // Remove do carrinho itens que já foram comprados (detecta compra mesmo sem passar por PaymentReturn)
  useEffectA(() => {
    const purchased = currentUser?.purchases;
    if (!purchased?.length) return;
    setCart(c => c.filter(item => !purchased.includes(item.id)));
  }, [currentUser?.purchases]);

  const handleAuth = (u) => setCurrentUser(u);
  const handleLogout = async () => {
    await signOut();
    setCurrentUser(null);
    setCart([]); // limpa carrinho ao sair
    go({name:"landing"});
  };

  const refreshUser = async () => {
    const u = await loadCurrentUser();
    setCurrentUser(u);
  };

  const isReader = route.name === "reader";

  let page;
  switch (route.name) {
    case "catalog":     page = <Catalog go={go} addToCart={addToCart} cart={cart} initialFilter={route.filter} currentUser={currentUser}/>; break;
    case "product":     page = <Product id={route.id} go={go} addToCart={addToCart} cart={cart} currentUser={currentUser}/>; break;
    case "cart":        page = <Cart go={go} cart={cart} removeFromCart={removeFromCart} currentUser={currentUser} clearCart={clearCart} refreshUser={refreshUser}/>; break;
    case "login":       page = <Login go={go} onAuth={handleAuth}/>; break;
    case "signup":      page = <Signup go={go} onAuth={handleAuth}/>; break;
    case "forgot":      page = <ForgotPassword go={go}/>; break;
    case "reset-password": page = <ResetPassword go={go} onAuth={handleAuth}/>; break;
    case "admin":       page = <AdminDashboard go={go} currentUser={currentUser} onLogout={handleLogout}/>; break;
    case "library":     page = <MyLibrary go={go} currentUser={currentUser}/>; break;
    case "payment-return": page = <PaymentReturn go={go} clearCart={clearCart} refreshUser={refreshUser} currentUser={currentUser} cart={cart}/>; break;
    case "reader":      page = <PdfReader id={route.id} go={go} currentUser={currentUser}/>; break;
    case "profile":     page = <AccountSettings go={go} currentUser={currentUser} refreshUser={refreshUser}/>; break;
    case "terms":       page = <TermsPage go={go} anchor={route.anchor}/>; break;
    case "privacy":     page = <PrivacyPage go={go}/>; break;
    case "landing":     page = <Landing go={go} addToCart={addToCart} heroCopy={t.hero}/>; break;
    default:            page = <NotFound go={go}/>;
  }

  return (
    <div>
      {!isReader && (
        <Nav
          route={route}
          go={go}
          cartCount={cart.length}
          dark={t.dark}
          toggleDark={()=>setTweak("dark", !t.dark)}
          currentUser={currentUser}
          authReady={authReady}
          onLogout={handleLogout}
        />
      )}
      <main key={route.name + (route.id||"") + (route.filter||"")}>
        {page}
      </main>
      {!isReader && route.name !== "admin" && <Footer go={go}/>}

      <TweaksPanel>
        <TweakSection label="Aparência"/>
        <TweakColor label="Paleta" value={t.palette}
                    options={PALETTES}
                    onChange={(v)=>setTweak("palette", v)} />
        <TweakToggle label="Modo escuro" value={t.dark}
                     onChange={(v)=>setTweak("dark", v)} />

        <TweakSection label="Layout"/>
        <TweakRadio label="Densidade" value={t.density}
                    options={["compact","regular","comfy"]}
                    onChange={(v)=>setTweak("density", v)}/>
        <TweakSelect label="Tipografia" value={t.type}
                     options={[
                       {value:"modern", label:"Moderna (Bricolage)"},
                       {value:"editorial", label:"Editorial (Instrument)"},
                       {value:"serious", label:"Séria (DM Serif)"},
                     ]}
                     onChange={(v)=>setTweak("type", v)}/>
        <TweakSelect label="Estilo de card" value={t.card}
                     options={[
                       {value:"soft", label:"Soft (sombra)"},
                       {value:"outline", label:"Outline (linha)"},
                       {value:"sticker", label:"Sticker (3D)"},
                     ]}
                     onChange={(v)=>setTweak("card", v)}/>

        <TweakSection label="Conteúdo"/>
        <TweakSelect label="Copy do hero" value={t.hero}
                     options={[
                       {value:"faculdade", label:"\"Os resumos da faculdade\""},
                       {value:"prova", label:"\"Passe na prova em metade do tempo\""},
                       {value:"turma", label:"\"O caderno da turma\""},
                       {value:"sem_enrolacao", label:"\"Sem enrolação\""},
                     ]}
                     onChange={(v)=>setTweak("hero", v)}/>
        <TweakButton label="Resetar para o padrão" onClick={()=>{
          Object.entries(TWEAK_DEFAULTS).forEach(([k,v])=>setTweak(k, v));
        }}/>
      </TweaksPanel>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App/>);
