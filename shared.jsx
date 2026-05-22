// shared.jsx — data, illustrations, primitives

const { useState, useEffect, useMemo, useRef } = React;

// ─────────── Catalog data ───────────
const AREAS = [
  { id: "cardio",  name: "Cardiologia",        color: "var(--primary)" },
  { id: "pneumo",  name: "Pneumologia",        color: "var(--acc-4)" },
  { id: "gastro",  name: "Gastroenterologia",  color: "var(--acc-1)" },
  { id: "endo",    name: "Endocrinologia",     color: "var(--acc-2)" },
  { id: "neuro",   name: "Neurologia",         color: "var(--acc-3)" },
  { id: "nefro",   name: "Nefrologia",         color: "var(--acc-4)" },
  { id: "infecto", name: "Infectologia",       color: "var(--acc-2)" },
  { id: "pedia",   name: "Pediatria",          color: "var(--acc-1)" },
  { id: "go",      name: "Ginecologia & Obstetrícia", color: "var(--primary)" },
  { id: "cirurgia",name: "Cirurgia",           color: "var(--acc-3)" },
];

const RESUMOS = [
  { id: "ic",      area: "cardio",  title: "Insuficiência Cardíaca",      pages: 42, price: 39, updated: "Abr 26", topics: ["Fração de ejeção","NYHA","ECA/BRA","Sacubitril"] },
  { id: "has",     area: "cardio",  title: "Hipertensão Arterial",        pages: 38, price: 39, updated: "Mar 26", topics: ["Aferição","Crise hipertensiva","Drogas","Alvo PA"] },
  { id: "arrit",   area: "cardio",  title: "Arritmias & ECG",             pages: 56, price: 49, updated: "Mai 26", topics: ["FA","TV","ECG passo-a-passo","BRD/BRE"] },
  { id: "iam",     area: "cardio",  title: "Síndromes Coronarianas Agudas", pages: 48, price: 49, updated: "Abr 26", topics: ["IAMCSST","IAMSSST","Troponina","Killip"] },

  { id: "dpoc",    area: "pneumo",  title: "DPOC",                        pages: 32, price: 35, updated: "Fev 26", topics: ["GOLD","Exacerbação","LABA/LAMA","O₂ domiciliar"] },
  { id: "asma",    area: "pneumo",  title: "Asma",                        pages: 28, price: 29, updated: "Mar 26", topics: ["GINA","Crise","Step-up","Corticoide"] },
  { id: "tep",     area: "pneumo",  title: "Tromboembolismo Pulmonar",    pages: 30, price: 35, updated: "Abr 26", topics: ["Wells","D-dímero","Heparina","Trombolítico"] },

  { id: "hep",     area: "gastro",  title: "Hepatites Virais",            pages: 44, price: 39, updated: "Abr 26", topics: ["A/B/C/D/E","Sorologia","Crônica","Cirrose"] },
  { id: "drge",    area: "gastro",  title: "DRGE & Úlcera Péptica",       pages: 26, price: 29, updated: "Mar 26", topics: ["IBP","H. pylori","Endoscopia","Sintomas alarme"] },
  { id: "abdagudo",area: "gastro",  title: "Abdome Agudo",                pages: 50, price: 49, updated: "Mai 26", topics: ["Inflamatório","Obstrutivo","Perfurativo","Vascular"] },

  { id: "dm",      area: "endo",    title: "Diabetes Mellitus",           pages: 60, price: 59, updated: "Mai 26", topics: ["DM1 vs DM2","HbA1c","Insulinas","Complicações"] },
  { id: "tireoide",area: "endo",    title: "Tireoide",                    pages: 36, price: 35, updated: "Mar 26", topics: ["Hipo/Hiper","Nódulo","Graves","Hashimoto"] },
  { id: "obesidade",area:"endo",    title: "Obesidade & Síndrome Metabólica", pages: 24, price: 29, updated: "Fev 26", topics: ["IMC","GLP-1","Cirurgia bariátrica","Risco CV"] },

  { id: "avc",     area: "neuro",   title: "AVC Isquêmico & Hemorrágico", pages: 46, price: 49, updated: "Abr 26", topics: ["NIHSS","Trombólise","Janela","HSA"] },
  { id: "cefaleia",area: "neuro",   title: "Cefaleias",                   pages: 22, price: 29, updated: "Fev 26", topics: ["Migrânea","Tensional","Cluster","Sinais alarme"] },
  { id: "epilepsia",area:"neuro",   title: "Epilepsia & Crises",          pages: 30, price: 35, updated: "Mar 26", topics: ["Focal","Generalizada","Status","Drogas"] },

  { id: "ira",     area: "nefro",   title: "Lesão Renal Aguda",           pages: 28, price: 35, updated: "Mar 26", topics: ["KDIGO","Pré/Renal/Pós","Diálise","Eletrólitos"] },
  { id: "drc",     area: "nefro",   title: "Doença Renal Crônica",        pages: 32, price: 35, updated: "Abr 26", topics: ["TFG","Estágios","Anemia","Hiperparat."] },

  { id: "sepse",   area: "infecto", title: "Sepse & Choque Séptico",      pages: 36, price: 39, updated: "Mai 26", topics: ["qSOFA","Lactato","Bundle 1h","Vasopressor"] },
  { id: "tb",      area: "infecto", title: "Tuberculose",                 pages: 30, price: 35, updated: "Mar 26", topics: ["RIPE","Latente","Resistência","BCG"] },
  { id: "hiv",     area: "infecto", title: "HIV / AIDS",                  pages: 42, price: 39, updated: "Abr 26", topics: ["TARV","Oportunistas","PrEP","CD4"] },

  { id: "imuni",   area: "pedia",   title: "Imunização Infantil",         pages: 24, price: 29, updated: "Fev 26", topics: ["Calendário PNI","Atrasos","Eventos","Contra-indic."] },
  { id: "diarreia",area: "pedia",   title: "Diarreia Aguda em Pediatria", pages: 20, price: 29, updated: "Mar 26", topics: ["TRO","Desidratação","Antibiótico","Zinco"] },

  { id: "prenatal",area: "go",      title: "Pré-natal",                   pages: 38, price: 39, updated: "Abr 26", topics: ["Consultas","Exames","Suplementação","Risco"] },
  { id: "climat",  area: "go",      title: "Climatério & Menopausa",      pages: 22, price: 29, updated: "Fev 26", topics: ["TRH","Osteoporose","Sintomas","Câncer"] },

  { id: "trauma",  area: "cirurgia",title: "Trauma & ATLS",               pages: 54, price: 59, updated: "Mai 26", topics: ["ABCDE","TCE","Tórax","FAST"] },
];

// ─────────── Illustrations (abstract medical shapes) ───────────
const Illu = {
  Cross: ({ size=42, color="var(--primary)", bg="var(--bg)" }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect x="2" y="2" width="60" height="60" rx="16" fill={color}/>
      <rect x="27" y="14" width="10" height="36" rx="3" fill={bg}/>
      <rect x="14" y="27" width="36" height="10" rx="3" fill={bg}/>
    </svg>
  ),
  Heart: ({ size=42, color="var(--primary)", bg="var(--bg)" }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect x="2" y="2" width="60" height="60" rx="16" fill={color}/>
      <path d="M12 34h8l3-8 4 18 5-22 4 14 3-6h13" stroke={bg} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  ),
  Lungs: ({ size=42, color="var(--acc-4)", bg="var(--bg)" }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect x="2" y="2" width="60" height="60" rx="16" fill={color}/>
      <path d="M32 16v22" stroke={bg} strokeWidth="3" strokeLinecap="round"/>
      <path d="M22 22c-6 4-8 14-6 22 0 3 4 4 7 2 3-1 5-4 5-8V22z" fill={bg}/>
      <path d="M42 22c6 4 8 14 6 22 0 3-4 4-7 2-3-1-5-4-5-8V22z" fill={bg}/>
    </svg>
  ),
  Pill: ({ size=42, color="var(--acc-1)", bg="var(--fg)" }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect x="2" y="2" width="60" height="60" rx="16" fill={color}/>
      <g transform="rotate(35 32 32)">
        <rect x="14" y="24" width="36" height="16" rx="8" fill={bg}/>
        <rect x="14" y="24" width="18" height="16" rx="8" fill={color} opacity=".75"/>
        <line x1="32" y1="24" x2="32" y2="40" stroke={color} strokeWidth="1.5"/>
      </g>
    </svg>
  ),
  Brain: ({ size=42, color="var(--acc-3)", bg="var(--bg)" }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect x="2" y="2" width="60" height="60" rx="16" fill={color}/>
      <path d="M22 20c-6 0-10 5-10 10 0 4 2 6 4 8-1 3 0 8 5 9 1 4 6 6 11 4v-32c-3-2-7-2-10 1z" fill={bg}/>
      <path d="M42 20c6 0 10 5 10 10 0 4-2 6-4 8 1 3 0 8-5 9-1 4-6 6-11 4v-32c3-2 7-2 10 1z" fill={bg} opacity=".82"/>
    </svg>
  ),
  Kidney: ({ size=42, color="var(--acc-4)", bg="var(--bg)" }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect x="2" y="2" width="60" height="60" rx="16" fill={color}/>
      <path d="M22 14c-8 0-12 8-12 18s4 18 12 18c5 0 7-3 10-3s5 3 10 3c8 0 12-8 12-18S50 14 42 14c-5 0-7 3-10 3s-5-3-10-3z" fill={bg}/>
    </svg>
  ),
  Virus: ({ size=42, color="var(--acc-2)", bg="var(--bg)" }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect x="2" y="2" width="60" height="60" rx="16" fill={color}/>
      <circle cx="32" cy="32" r="12" fill={bg}/>
      {[0,45,90,135,180,225,270,315].map(a=>{
        const r = a * Math.PI/180;
        const x1 = 32 + Math.cos(r)*13, y1 = 32 + Math.sin(r)*13;
        const x2 = 32 + Math.cos(r)*20, y2 = 32 + Math.sin(r)*20;
        return <g key={a}><line x1={x1} y1={y1} x2={x2} y2={y2} stroke={bg} strokeWidth="2.5" strokeLinecap="round"/><circle cx={x2} cy={y2} r="3" fill={bg}/></g>
      })}
    </svg>
  ),
  Baby: ({ size=42, color="var(--acc-1)", bg="var(--fg)" }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect x="2" y="2" width="60" height="60" rx="16" fill={color}/>
      <circle cx="32" cy="28" r="12" fill={bg}/>
      <circle cx="28" cy="27" r="1.6" fill={color}/>
      <circle cx="36" cy="27" r="1.6" fill={color}/>
      <path d="M28 32c1 2 3 3 4 3s3-1 4-3" stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none"/>
      <path d="M14 52c2-7 9-10 18-10s16 3 18 10" fill={bg}/>
    </svg>
  ),
  Uterus: ({ size=42, color="var(--primary)", bg="var(--bg)" }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect x="2" y="2" width="60" height="60" rx="16" fill={color}/>
      <path d="M24 20c0 6-6 7-6 14 0 7 6 14 14 14s14-7 14-14c0-7-6-8-6-14" stroke={bg} strokeWidth="3" fill="none" strokeLinecap="round"/>
      <circle cx="22" cy="18" r="3" fill={bg}/>
      <circle cx="42" cy="18" r="3" fill={bg}/>
    </svg>
  ),
  Scalpel: ({ size=42, color="var(--acc-3)", bg="var(--bg)" }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect x="2" y="2" width="60" height="60" rx="16" fill={color}/>
      <g transform="rotate(-30 32 32)">
        <path d="M12 30 L40 28 L48 32 L40 36 L12 34 Z" fill={bg}/>
        <rect x="40" y="30" width="14" height="4" rx="2" fill={bg} opacity=".7"/>
      </g>
    </svg>
  ),
};

const ILLU_FOR_AREA = {
  cardio: Illu.Heart,
  pneumo: Illu.Lungs,
  gastro: Illu.Pill,
  endo: Illu.Cross,
  neuro: Illu.Brain,
  nefro: Illu.Kidney,
  infecto: Illu.Virus,
  pedia: Illu.Baby,
  go: Illu.Uterus,
  cirurgia: Illu.Scalpel,
};

// ─────────── Logo ───────────
function Logo({ size = 24 }){
  return (
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <rect x="1" y="1" width="30" height="30" rx="9" fill="var(--primary)"/>
        <rect x="13.5" y="7" width="5" height="18" rx="1.6" fill="var(--primary-ink)"/>
        <rect x="7" y="13.5" width="18" height="5" rx="1.6" fill="var(--primary-ink)"/>
      </svg>
      <span style={{fontFamily:"var(--font-display)", fontWeight:700, fontSize: size*0.78, letterSpacing:"-0.03em"}}>
        resumosmed
      </span>
    </div>
  );
}

// ─────────── Nav ───────────
function Nav({ route, go, cartCount, dark, toggleDark, currentUser, onLogout }){
  const [menuOpen, setMenuOpen] = React.useState(false);
  React.useEffect(()=>{
    const close = ()=>setMenuOpen(false);
    if (menuOpen) document.addEventListener("click", close);
    return ()=>document.removeEventListener("click", close);
  }, [menuOpen]);
  const isAdmin = currentUser?.role === "admin";

  return (
    <header style={{position:"sticky", top: 0, zIndex: 50, backdropFilter:"saturate(160%) blur(14px)", WebkitBackdropFilter:"saturate(160%) blur(14px)", background:"color-mix(in oklab, var(--bg) 78%, transparent)", borderBottom:"1px solid var(--line)"}}>
      <div className="page" style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding: "14px 0", gap: 18}}>
        <button onClick={()=>go({name:"landing"})} style={{background:"none", border:0, padding:0, cursor:"pointer"}}>
          <Logo size={26}/>
        </button>
        <nav style={{display:"flex", alignItems:"center", gap: 28, fontSize: 14, fontWeight: 500, color:"var(--muted)"}}>
          <button onClick={()=>go({name:"landing"})} style={navLink(route.name==="landing")}>Início</button>
          <button onClick={()=>go({name:"catalog"})} style={navLink(route.name==="catalog")}>Catálogo</button>
          <button onClick={()=>go({name:"landing", anchor:"como-funciona"})} style={navLink(false)}>Como funciona</button>
          <button onClick={()=>go({name:"landing", anchor:"faq"})} style={navLink(false)}>FAQ</button>
          {currentUser && !isAdmin && <button onClick={()=>go({name:"library"})} style={navLink(route.name==="library")}>Biblioteca</button>}
          {isAdmin && <button onClick={()=>go({name:"admin"})} style={navLink(route.name==="admin")}>Painel</button>}
          {isAdmin && <button onClick={()=>go({name:"library"})} style={navLink(route.name==="library")}>Biblioteca</button>}
        </nav>
        <div style={{display:"flex", gap: 10, alignItems:"center"}}>
          <DarkToggle dark={dark} onClick={toggleDark}/>
          <button className="btn" onClick={()=>go({name:"cart"})} style={{position:"relative"}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>
            {cartCount > 0 && <span style={{background:"var(--primary)", color:"var(--primary-ink)", borderRadius:999, padding:"1px 7px", fontSize: 11, fontWeight: 700}}>{cartCount}</span>}
          </button>
          {currentUser ? (
            <div style={{position:"relative"}} onClick={(e)=>e.stopPropagation()}>
              <button className="btn" onClick={()=>setMenuOpen(o=>!o)} style={{paddingLeft: 6}}>
                <div style={{width: 26, height: 26, borderRadius: 999, background: isAdmin ? "var(--fg)" : "var(--acc-3)", color: isAdmin ? "var(--bg)" : "var(--fg)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight: 700, fontSize: 12}}>
                  {currentUser.name[0]?.toUpperCase()}
                </div>
                <span style={{maxWidth: 100, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{currentUser.name.split(" ")[0]}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>
              </button>
              {menuOpen && (
                <div style={{position:"absolute", top:"calc(100% + 6px)", right: 0, background:"var(--surface)", border:"1px solid var(--line)", borderRadius: 12, boxShadow:"var(--shadow-pop)", minWidth: 220, padding: 6, zIndex: 60}}>
                  <div style={{padding:"10px 12px", borderBottom:"1px solid var(--line)", marginBottom: 4}}>
                    <div style={{fontWeight: 600, fontSize: 13}}>{currentUser.name}</div>
                    <div className="mono" style={{fontSize: 11, color:"var(--muted)"}}>{currentUser.email}</div>
                    {isAdmin && <div className="mono" style={{fontSize: 10, color:"var(--primary)", marginTop: 4, textTransform:"uppercase", letterSpacing:".08em", fontWeight: 700}}>★ admin</div>}
                  </div>
                  {!isAdmin && <MenuItem onClick={()=>{setMenuOpen(false); go({name:"library"});}}>Minha biblioteca</MenuItem>}
                  {isAdmin && <MenuItem onClick={()=>{setMenuOpen(false); go({name:"admin"});}}>Painel admin</MenuItem>}
                  {isAdmin && <MenuItem onClick={()=>{setMenuOpen(false); go({name:"library"});}}>Biblioteca de revisão</MenuItem>}
                  <MenuItem onClick={()=>{setMenuOpen(false); go({name:"catalog"});}}>Ver catálogo</MenuItem>
                  <MenuItem onClick={()=>{setMenuOpen(false); go({name:"profile"});}}>Configurações da conta</MenuItem>
                  <div style={{borderTop:"1px solid var(--line)", margin:"4px 0"}}/>
                  <MenuItem onClick={()=>{setMenuOpen(false); onLogout();}} danger>Sair</MenuItem>
                </div>
              )}
            </div>
          ) : (
            <>
              <button className="btn ghost" onClick={()=>go({name:"login"})} style={{padding:"10px 14px"}}>Entrar</button>
              <button className="btn primary" onClick={()=>go({name:"signup"})}>Criar conta</button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function MenuItem({ children, onClick, danger }){
  return (
    <button onClick={onClick} style={{
      display:"block", width:"100%", textAlign:"left", padding:"10px 12px",
      background:"transparent", border: 0, cursor:"pointer", fontFamily:"inherit", fontSize: 13.5,
      color: danger ? "var(--primary)" : "var(--fg)", fontWeight: 500, borderRadius: 8, transition:"background .12s",
    }}
    onMouseEnter={e=>e.currentTarget.style.background="var(--bg)"}
    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
      {children}
    </button>
  );
}

function DarkToggle({ dark, onClick }){
  return (
    <button
      onClick={onClick}
      aria-label={dark ? "Modo claro" : "Modo escuro"}
      title={dark ? "Modo claro" : "Modo escuro"}
      style={{
        width: 42, height: 42, borderRadius: 999,
        border: "1px solid var(--line-strong)",
        background: "var(--surface)", color: "var(--fg)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", transition: "transform .2s ease, background .15s ease",
        position: "relative", overflow: "hidden",
        fontFamily: "inherit",
      }}
      onMouseEnter={e=>e.currentTarget.style.transform="rotate(20deg)"}
      onMouseLeave={e=>e.currentTarget.style.transform="rotate(0)"}
    >
      <div style={{
        position: "relative", width: 18, height: 18,
        display: "inline-flex", alignItems: "center", justifyContent: "center"
      }}>
        {/* Sun */}
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{
            position: "absolute", inset: 0,
            opacity: dark ? 0 : 1,
            transform: dark ? "rotate(-90deg) scale(.4)" : "rotate(0) scale(1)",
            transition: "all .35s cubic-bezier(.2,.7,.1,1)"
          }}
        >
          <circle cx="12" cy="12" r="4"/>
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
        </svg>
        {/* Moon */}
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{
            position: "absolute", inset: 0,
            opacity: dark ? 1 : 0,
            transform: dark ? "rotate(0) scale(1)" : "rotate(90deg) scale(.4)",
            transition: "all .35s cubic-bezier(.2,.7,.1,1)"
          }}
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/>
        </svg>
      </div>
    </button>
  );
}
function navLink(active){
  return { background:"none", border:0, cursor:"pointer", color: active ? "var(--fg)" : "var(--muted)", fontWeight: 600, padding: "6px 2px", fontSize: 14, fontFamily:"inherit" };
}

// ─────────── Footer ───────────
function Footer({ go }){
  return (
    <footer style={{borderTop:"1px solid var(--line)", marginTop: "var(--gap-xl)", paddingTop: 48, paddingBottom: 36, background:"var(--bg)"}}>
      <div className="page" style={{display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr", gap: 36}}>
        <div>
          <Logo size={26}/>
          <p style={{color:"var(--muted)", fontSize: 14, maxWidth: 320, marginTop: 14}}>
            Resumos de medicina escritos por um aluno que tirou notas altas pra você não precisar refazer todo o estudo do zero.
          </p>
        </div>
        <div>
          <div style={{fontWeight: 700, marginBottom: 12, fontSize: 13}}>Loja</div>
          <div className="col" style={{gap: 8, fontSize: 14, color:"var(--muted)"}}>
            <a style={{cursor:"pointer"}} onClick={()=>go({name:"catalog"})}>Todos os resumos</a>
            <a style={{cursor:"pointer"}} onClick={()=>go({name:"catalog", filter:"cardio"})}>Cardiologia</a>
            <a style={{cursor:"pointer"}} onClick={()=>go({name:"catalog", filter:"neuro"})}>Neurologia</a>
            <a style={{cursor:"pointer"}} onClick={()=>go({name:"catalog", filter:"infecto"})}>Infectologia</a>
          </div>
        </div>
        <div>
          <div style={{fontWeight: 700, marginBottom: 12, fontSize: 13}}>Sobre</div>
          <div className="col" style={{gap: 8, fontSize: 14, color:"var(--muted)"}}>
            <a>Quem fez</a>
            <a>Método</a>
            <a>Atualizações</a>
            <a>Contato</a>
          </div>
        </div>
        <div>
          <div style={{fontWeight: 700, marginBottom: 12, fontSize: 13}}>Legal</div>
          <div className="col" style={{gap: 8, fontSize: 14, color:"var(--muted)"}}>
            <a style={{cursor:"pointer"}} onClick={()=>go({name:"terms"})}>Termos de uso</a>
            <a style={{cursor:"pointer"}} onClick={()=>go({name:"privacy"})}>Privacidade</a>
            <a style={{cursor:"pointer"}} onClick={()=>go({name:"terms", anchor:"reembolso"})}>Reembolso</a>
          </div>
        </div>
      </div>
      <div className="page" style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginTop: 40, paddingTop: 20, borderTop:"1px solid var(--line)", color:"var(--muted)", fontSize: 12}}>
        <div>© 2026 resumosmed — Feito entre uma aula de fisio e outra.</div>
        <div className="mono">v1.0 · Atualizado em Mai 26</div>
      </div>
    </footer>
  );
}

// Expose
Object.assign(window, {
  AREAS, RESUMOS, ILLU_FOR_AREA, Illu, Logo, Nav, Footer
});
