// pages.jsx — Landing, Catalog, Product, Cart

const { useState: useStateP, useMemo: useMemoP, useEffect: useEffectP } = React;

// ─────────────────────────────────────────────────────────
//  HERO COPY VARIANTS  (tweakable)
// ─────────────────────────────────────────────────────────
const HERO_COPY = {
  faculdade: {
    eyebrow: "Resumos de medicina · feitos por aluno, pra aluno",
    title: ["Os resumos que toda a", "faculdade", "já me pede."],
    sub: "Anos de aula condensados em resumos diretos ao ponto. Leitura na biblioteca online — sem enrolação, com o que cai na prova e o que o professor adora cobrar.",
  },
  prova: {
    eyebrow: "Leitor online · sem enrolação",
    title: ["Passe na prova em", "metade", "do tempo."],
    sub: "Resumos enxutos, esquemas visuais e mnemônicos que funcionam. Tudo na sua biblioteca, lê quando quiser — o resto fica de fora.",
  },
  turma: {
    eyebrow: "Estudo objetivo · revisão rápida",
    title: ["O caderno", "da turma toda,", "agora seu."],
    sub: "Aquele resumo que circula no grupo do WhatsApp — só que organizado, atualizado e dentro de um leitor seguro, pra estudar onde quiser.",
  },
  sem_enrolacao: {
    eyebrow: "Medicina · sem enrolação",
    title: ["Estude o que cai.", "Pula", "o resto."],
    sub: "Cada resumo é um bisturi: corta o que não importa e deixa o conteúdo que realmente aparece na P1, P2 e na residência.",
  },
};

// ─────────────────────────────────────────────────────────
//  LANDING PAGE
// ─────────────────────────────────────────────────────────
function Landing({ go, addToCart, heroCopy }){
  const copy = HERO_COPY[heroCopy] || HERO_COPY.faculdade;
  return (
    <div className="pagewrap">
      <Hero go={go} copy={copy}/>
      <SocialBar/>
      <FeatureGrid/>
      <PreviewSection go={go}/>
      <Areas go={go}/>
      <Pricing go={go}/>
      <FAQ/>
      <CtaBanner go={go}/>
    </div>
  );
}

function Hero({ go, copy }){
  return (
    <section style={{position:"relative", overflow:"hidden", paddingTop: "var(--hero-pad-y)", paddingBottom: "var(--hero-pad-y)"}}>
      {/* Floating decorations */}
      <FloatingDecor/>

      <div className="page" style={{position:"relative", display:"grid", gridTemplateColumns:"1.15fr .85fr", gap: 56, alignItems:"center"}}>
        <div>
          <div className="pill" style={{marginBottom: 22}}>
            <span className="blink"/>
            <span>{copy.eyebrow}</span>
          </div>
          <h1 className="display" style={{fontSize: "clamp(46px, 7.6vw, 104px)", margin: 0, marginBottom: 22, fontWeight: 700}}>
            {copy.title[0]}<br/>
            <span style={{position:"relative", display:"inline-block"}}>
              <span className="serif" style={{fontWeight: 400, color:"var(--primary)"}}>{copy.title[1]}</span>
              <Underline/>
            </span>{" "}
            {copy.title[2]}
          </h1>
          <p style={{fontSize: 19, lineHeight: 1.5, color:"var(--muted)", maxWidth: 520, margin: 0, marginBottom: 32}}>
            {copy.sub}
          </p>
          <div className="row gap-md" style={{flexWrap:"wrap"}}>
            <button className="btn primary lg" onClick={()=>go({name:"catalog"})}>
              Ver catálogo
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
            </button>
            <button className="btn lg" onClick={()=>go({name:"product", id:"ic"})}>
              Ver um exemplo grátis
            </button>
          </div>
          <div style={{display:"grid", gridTemplateColumns:"repeat(4, auto)", columnGap: 24, rowGap: 14, marginTop: 38, color:"var(--muted)", fontSize: 13, justifyContent:"start"}}>
            <StatItem n="26+" label="resumos" />
            <StatItem n="R$ 29" label="a partir de" />
            <StatItem n="Online" label="leitor protegido" />
            <StatItem n="∞" label="acesso vitalício" />
          </div>
        </div>

        <HeroVisual/>
      </div>
    </section>
  );
}

function Underline(){
  return (
    <svg style={{position:"absolute", left:"-4%", bottom:"-12px", width:"108%"}} height="22" viewBox="0 0 200 22" fill="none" preserveAspectRatio="none">
      <path d="M2 14 C 40 4, 80 18, 198 8" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round" fill="none" opacity=".55"/>
      <path d="M2 18 C 60 12, 120 22, 198 14" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".3"/>
    </svg>
  );
}

function StatItem({ n, label }){
  return (
    <div className="col" style={{gap: 2, minWidth: 0}}>
      <div className="display" style={{fontSize: 20, color:"var(--fg)", fontWeight: 700, whiteSpace:"nowrap"}}>{n}</div>
      <div style={{fontSize: 11, textTransform:"uppercase", letterSpacing:".06em", whiteSpace:"nowrap"}}>{label}</div>
    </div>
  );
}

function FloatingDecor(){
  return (
    <div aria-hidden style={{position:"absolute", inset: 0, pointerEvents:"none"}}>
      <div style={{position:"absolute", top:"8%", left:"-2%", animation:"float 6s ease-in-out infinite"}}>
        <Illu.Cross size={56} color="var(--acc-1)"/>
      </div>
      <div style={{position:"absolute", top:"68%", left:"22%", animation:"float 7s ease-in-out infinite .8s"}}>
        <div style={{transform:"rotate(-20deg)"}}><Illu.Pill size={56} color="var(--acc-3)" bg="var(--bg)"/></div>
      </div>
      <div style={{position:"absolute", top:"12%", right:"-3%", animation:"float 8s ease-in-out infinite 1.5s"}}>
        <Illu.Virus size={72} color="var(--acc-2)"/>
      </div>
    </div>
  );
}

function HeroVisual(){
  const cards = [
    {
      area: "Endocrinologia",
      title: "Diabetes Mellitus",
      accent: "var(--primary)",
      tint: "var(--surface)",
      border: true,
      tags: [
        { label: "HbA1c", color: "var(--acc-2)" },
        { label: "Insulinas", color: "var(--acc-3)" },
      ],
      highlight: "var(--acc-1)",
    },
    {
      area: "Cardiologia",
      title: "Insuficiência Cardíaca",
      accent: "var(--primary)",
      tint: "color-mix(in oklab, var(--acc-1) 35%, var(--surface))",
      border: false,
      tags: [
        { label: "NYHA I-IV", color: "var(--primary)" },
        { label: "ECA/BRA", color: "var(--acc-2)" },
      ],
      highlight: "var(--acc-3)",
    },
    {
      area: "Neurologia",
      title: "AVC Isquêmico",
      accent: "var(--fg)",
      tint: "color-mix(in oklab, var(--acc-3) 30%, var(--surface))",
      border: false,
      tags: [
        { label: "NIHSS", color: "var(--acc-4)" },
        { label: "Trombólise", color: "var(--primary)" },
      ],
      highlight: "var(--acc-2)",
    },
  ];

  const [top, setTop] = React.useState(0);
  const [animating, setAnimating] = React.useState(false);
  const total = cards.length;

  const cycle = () => {
    if (animating) return;
    setAnimating(true);
    setTop(t => (t + 1) % total);
    setTimeout(()=>setAnimating(false), 480);
  };

  // pos: 0 = topo (na frente), 1 = meio, 2 = fundo
  const stylesForPos = (pos) => {
    if (pos === 0) return {
      transform: "rotate(-1deg) translateY(0) translateX(0)",
      zIndex: 3, opacity: 1, filter: "none",
      inset: "0 50px 50px 50px",
    };
    if (pos === 1) return {
      transform: "rotate(4deg) translateY(20px) translateX(40px)",
      zIndex: 2, opacity: .96, filter: "saturate(.85)",
      inset: "20px 30px 30px 70px",
    };
    // pos 2
    return {
      transform: "rotate(-5deg) translateY(40px) translateX(-40px)",
      zIndex: 1, opacity: .88, filter: "saturate(.7)",
      inset: "40px 70px 60px 30px",
    };
  };

  return (
    <div style={{position:"relative", height: 480}}>
      {cards.map((card, i) => {
        const pos = (i - top + total) % total;
        const posStyles = stylesForPos(pos);
        return (
          <PdfCard
            key={i}
            card={card}
            style={{
              position:"absolute",
              ...posStyles,
              background: card.tint,
              border: card.border ? "1px solid var(--line)" : undefined,
              transition: "transform .48s cubic-bezier(.2,.7,.1,1), opacity .48s ease, filter .48s ease, inset .48s cubic-bezier(.2,.7,.1,1)",
              cursor: pos === 0 ? "pointer" : "default",
            }}
            onClick={pos === 0 ? cycle : undefined}
          />
        );
      })}

      {/* Sticker badge */}
      <div style={{position:"absolute", top: -16, right: 8, zIndex: 4, background:"var(--fg)", color:"var(--bg)", padding:"10px 14px", borderRadius: 999, fontFamily:"var(--font-mono)", fontSize: 11, fontWeight: 600, letterSpacing:".04em", animation:"wiggle 3s ease-in-out infinite", transformOrigin:"center"}}>
        ★ Leitor protegido
      </div>

      {/* Indicadores embaixo (dots clicáveis pra pular entre cards) */}
      <div style={{position:"absolute", bottom: -28, left: "50%", transform:"translateX(-50%)", display:"flex", gap: 5}}>
        {cards.map((_, i) => (
          <button key={i} onClick={()=>{ if (i !== top){ setAnimating(true); setTop(i); setTimeout(()=>setAnimating(false), 480); }}}
            aria-label={`Mostrar resumo ${i+1}`}
            style={{
              width: i === top ? 22 : 7, height: 7, borderRadius: 999,
              background: i === top ? "var(--primary)" : "var(--line-strong)",
              border: 0, cursor:"pointer", transition: "width .3s ease, background .2s ease", padding: 0,
            }}/>
        ))}
      </div>
    </div>
  );
}

function PdfCard({ style, card, onClick }){
  return (
    <div
      onClick={onClick}
      style={{
        borderRadius: 18, padding: 24, boxShadow:"var(--shadow-pop)",
        display:"flex", flexDirection:"column", justifyContent:"space-between",
        ...style
      }}>
      <div className="row between" style={{alignItems:"flex-start"}}>
        <div>
          <div style={{fontFamily:"var(--font-mono)", fontSize: 10, textTransform:"uppercase", letterSpacing:".1em", opacity:.6}}>resumosmed · {card.area}</div>
          <div className="display" style={{fontSize: 26, fontWeight: 700, marginTop: 6, color:"var(--fg)", lineHeight: 1.05}}>{card.title}</div>
        </div>
        <div style={{width: 30, height: 30, borderRadius: 8, background: card.accent, opacity:.9}}/>
      </div>
      <div style={{marginTop: 18, display:"flex", flexDirection:"column", gap: 8}}>
        <Bar w="84%"/><Bar w="92%"/><Bar w="60%"/>
        <div style={{height: 8}}/>
        <Bar w="78%"/><Bar w="88%" highlight={card.highlight}/><Bar w="55%"/>
        <div style={{height: 8}}/>
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap: 8}}>
          {card.tags.map(t => <MiniBox key={t.label} color={t.color} label={t.label}/>)}
        </div>
      </div>
    </div>
  );
}
function Bar({ w, highlight }){
  return (
    <div style={{height: 9, width:"100%", borderRadius: 4, background:"rgba(0,0,0,.07)", position:"relative", overflow:"hidden"}}>
      <div style={{position:"absolute", inset: 0, width: w, background: highlight || "rgba(0,0,0,.18)", borderRadius: 4}}/>
    </div>
  );
}
function MiniBox({ color, label }){
  return (
    <div style={{background: color, borderRadius: 8, padding:"8px 10px", fontSize: 11, fontFamily:"var(--font-mono)", color:"var(--fg)", fontWeight: 600}}>
      ★ {label}
    </div>
  );
}

function SocialBar(){
  const items = [
    "Leitor online protegido",
    "Usado em 14 faculdades",
    "Atualizado em Mai/26",
    "Garantia de 7 dias",
    "Pix · 5% off",
    "Acesso vitalício",
    "Atualizações grátis pra sempre",
  ];
  return (
    <div style={{borderTop:"1px solid var(--line)", borderBottom:"1px solid var(--line)", background:"var(--surface)", padding:"14px 0"}}>
      <div className="marquee">
        <div className="marquee-track" style={{fontSize: 13, color:"var(--muted)", fontWeight: 500}}>
          {[...items, ...items].map((it, i)=>(
            <span key={i} style={{display:"inline-flex", alignItems:"center", gap: 12}}>
              <span>{it}</span>
              <span style={{opacity:.4}}>✦</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────── Feature Grid ───────────
function FeatureGrid(){
  return (
    <section className="page" style={{paddingTop: "var(--gap-xl)", paddingBottom: "var(--gap-xl)"}} id="como-funciona">
      <SectionHead
        eyebrow="Como funciona"
        title={["Resumo bom é resumo", "que economiza tempo."]}
      />
      <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap: "var(--gap-md)", marginTop: "var(--gap-lg)"}}>
        {[
          { icon: <Illu.Heart size={48}/>, title: "Direto ao ponto", text: "Só o que cai. Sem capítulos inteiros copiados do Goldman.", k:"01"},
          { icon: <Illu.Brain size={48} color="var(--acc-3)"/>, title: "Esquemas visuais", text: "Fluxogramas, tabelas e mnemônicos que grudam na memória.", k:"02"},
          { icon: <Illu.Pill size={48} color="var(--acc-1)" bg="var(--fg)"/>, title: "Pronto pra revisar", text: "Use no metrô, na semana da prova, na véspera da residência.", k:"03"},
          { icon: <Illu.Virus size={48} color="var(--acc-2)"/>, title: "Atualizado", text: "Diretrizes novas, condutas atualizadas. Reviso a cada semestre.", k:"04"},
          { icon: <Illu.Kidney size={48} color="var(--acc-4)"/>, title: "Leitor próprio", text: "Tudo na sua biblioteca: lê online, em qualquer dispositivo, com seu acesso vitalício.", k:"05"},
          { icon: <Illu.Cross size={48} color="var(--primary)"/>, title: "Garantia de 7 dias", text: "Não curtiu? Devolvo o dinheiro, sem perguntas embaraçosas.", k:"06"},
        ].map((f, i)=>(
          <div key={i} className="card" style={{padding:"var(--card-pad)", display:"flex", flexDirection:"column", gap: 14}}>
            <div className="row between">
              {f.icon}
              <div className="mono" style={{fontSize: 11, color:"var(--muted)"}}>{f.k}</div>
            </div>
            <div className="display" style={{fontSize: 22, fontWeight: 600, marginTop: 6}}>{f.title}</div>
            <div style={{color:"var(--muted)", fontSize: 14.5, lineHeight: 1.55}}>{f.text}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionHead({ eyebrow, title }){
  return (
    <div className="col" style={{gap: 14, maxWidth: 760}}>
      <div className="mono" style={{fontSize: 12, textTransform:"uppercase", letterSpacing:".1em", color:"var(--primary)"}}>{eyebrow}</div>
      <h2 className="display" style={{fontSize:"clamp(34px, 5vw, 60px)", fontWeight: 700, margin: 0, lineHeight: 1.05}}>
        {title[0]} <span className="serif" style={{fontWeight: 400}}>{title[1]}</span>
      </h2>
    </div>
  );
}

// ─────────── Preview Section ───────────
function PreviewSection({ go }){
  return (
    <section className="page" style={{paddingBottom:"var(--gap-xl)"}}>
      <div style={{background:"var(--surface)", border:"1px solid var(--line)", borderRadius:"var(--radius-lg)", padding:"clamp(24px, 5vw, 60px)", display:"grid", gridTemplateColumns:".95fr 1.05fr", gap: 48, alignItems:"center"}}>
        <div>
          <div className="mono" style={{fontSize: 12, textTransform:"uppercase", letterSpacing:".1em", color:"var(--primary)", marginBottom: 14}}>
            Um exemplo de página
          </div>
          <h3 className="display" style={{fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 700, margin: "0 0 18px", lineHeight: 1.05}}>
            Não é qualquer resumo.<br/>
            <span className="serif" style={{fontWeight: 400}}>É design pensado pra estudo.</span>
          </h3>
          <p style={{color:"var(--muted)", fontSize: 16, lineHeight: 1.6, margin: 0, marginBottom: 22}}>
            Cada página foi pensada pra você varrer rápido na véspera da prova. Hierarquia clara, destaques pro que cai, e nunca um parágrafo gigante que ninguém lê.
          </p>
          <ul style={{margin: 0, padding: 0, listStyle:"none", display:"flex", flexDirection:"column", gap: 10, color:"var(--fg)", fontSize: 15}}>
            {["Hierarquia visual clara", "Quadros de \"cai na prova\"", "Mnemônicos e esquemas", "Referência rápida no topo"].map(t=>(
              <li key={t} className="row" style={{gap: 12}}>
                <span style={{width: 22, height: 22, borderRadius: 6, background:"var(--acc-2)", display:"inline-flex", alignItems:"center", justifyContent:"center", color:"var(--fg)", fontSize: 13, fontWeight: 700}}>✓</span>
                {t}
              </li>
            ))}
          </ul>
          <button className="btn primary" style={{marginTop: 24}} onClick={()=>go({name:"product", id:"ic"})}>
            Ver página de exemplo
          </button>
        </div>

        <PreviewPdf/>
      </div>
    </section>
  );
}

function PreviewPdf(){
  return (
    <div style={{background:"var(--bg)", borderRadius: 18, border:"1px solid var(--line)", padding: 24, fontFamily:"var(--font-body)", boxShadow:"var(--shadow-card)"}}>
      <div className="row between" style={{marginBottom: 16}}>
        <div className="row" style={{gap: 10}}>
          <Illu.Heart size={28}/>
          <div>
            <div style={{fontFamily:"var(--font-mono)", fontSize: 10, letterSpacing:".08em", textTransform:"uppercase", color:"var(--muted)"}}>Cardiologia</div>
            <div className="display" style={{fontSize: 17, fontWeight: 700}}>Insuficiência Cardíaca</div>
          </div>
        </div>
        <div className="mono" style={{fontSize: 11, color:"var(--muted)"}}>pg 4 / 42</div>
      </div>

      <div style={{borderTop:"1.5px solid var(--fg)", paddingTop: 14}}>
        <div className="serif" style={{fontSize: 24, color:"var(--fg)", marginBottom: 10}}>3. Classificação NYHA</div>
        <div style={{display:"grid", gridTemplateColumns:"auto 1fr", gap:"10px 16px", fontSize: 13.5, lineHeight: 1.45}}>
          <div className="mono" style={{fontWeight: 600, color:"var(--primary)"}}>I</div>
          <div>Sem limitação. Atividade habitual não causa sintomas.</div>
          <div className="mono" style={{fontWeight: 600, color:"var(--primary)"}}>II</div>
          <div>Limitação <i>leve</i>. Sintomas com esforços moderados.</div>
          <div className="mono" style={{fontWeight: 600, color:"var(--primary)"}}>III</div>
          <div>Limitação <i>importante</i>. Sintomas com pequenos esforços.</div>
          <div className="mono" style={{fontWeight: 600, color:"var(--primary)"}}>IV</div>
          <div>Sintomas em <i>repouso</i>. Não tolera atividade.</div>
        </div>

        <div style={{marginTop: 18, padding: 14, background:"var(--acc-1)", borderRadius: 10, color:"var(--fg)"}}>
          <div className="mono" style={{fontSize: 11, fontWeight: 700, letterSpacing:".08em", textTransform:"uppercase", marginBottom: 6}}>★ Cai na prova</div>
          <div style={{fontSize: 13.5}}>NYHA é <b>funcional</b> e pode mudar. Stage A-D (ACC/AHA) é <b>estrutural</b> e só progride.</div>
        </div>

        <div style={{marginTop: 14, display:"flex", gap: 8}}>
          <Tag>Sintomas</Tag>
          <Tag>NYHA</Tag>
          <Tag>ACC/AHA</Tag>
        </div>
      </div>
    </div>
  );
}
function Tag({ children }){
  return (
    <span style={{display:"inline-flex", padding:"4px 10px", borderRadius: 999, background:"var(--surface)", border:"1px solid var(--line)", fontSize: 11, fontWeight: 500, color:"var(--muted)", fontFamily:"var(--font-mono)"}}>
      {children}
    </span>
  );
}

// ─────────── Areas grid ───────────
function Areas({ go }){
  return (
    <section className="page" style={{paddingBottom:"var(--gap-xl)"}}>
      <div className="row between" style={{alignItems:"flex-end", marginBottom: "var(--gap-lg)", flexWrap:"wrap", gap: 16}}>
        <SectionHead eyebrow="Áreas" title={["Tudo organizado por","matéria."]}/>
        <button className="btn" onClick={()=>go({name:"catalog"})}>Ver catálogo completo →</button>
      </div>
      <div style={{display:"grid", gridTemplateColumns:"repeat(5, 1fr)", gap: 14}}>
        {AREAS.map(a => {
          const I = ILLU_FOR_AREA[a.id];
          const count = RESUMOS.filter(r=>r.area===a.id).length;
          return (
            <button key={a.id} onClick={()=>go({name:"catalog", filter:a.id})} className="card" style={{padding: 18, display:"flex", flexDirection:"column", gap: 14, alignItems:"flex-start", cursor:"pointer", fontFamily:"inherit", textAlign:"left", color:"var(--fg)"}}>
              <I size={42}/>
              <div>
                <div className="display" style={{fontSize: 15, fontWeight: 600, lineHeight: 1.2}}>{a.name}</div>
                <div className="mono" style={{fontSize: 11, color:"var(--muted)", marginTop: 4}}>{count} resumos</div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ─────────── Testimonials ───────────
function Testimonials(){
  const list = [
    { name:"Júlia M.", role:"M4 · USP", text:"Comprei o de Cardio na semana da prova. Tirei 9.5. Sem palavras.", stars: 5, bg:"var(--acc-1)" },
    { name:"Rafael S.", role:"M3 · UFMG", text:"O resumo de Diabetes resolveu a vida. Fluxograma de insulina é ouro.", stars: 5, bg:"var(--acc-2)" },
    { name:"Camila T.", role:"M5 · Santa Casa", text:"Tô usando pra revisar antes da residência. Conteúdo extremamente enxuto.", stars: 5, bg:"var(--acc-3)" },
    { name:"Pedro G.", role:"M2 · UFRJ", text:"Achei caro até abrir. Vale cada centavo, sério.", stars: 5, bg:"var(--acc-4)" },
  ];
  return (
    <section className="page" style={{paddingBottom:"var(--gap-xl)"}} id="sobre">
      <SectionHead eyebrow="Quem já usou" title={["Antes que pergunte:","sim, funciona."]}/>
      <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap: 14, marginTop: "var(--gap-lg)"}}>
        {list.map((t, i)=>(
          <div key={i} className="card" style={{padding: "var(--card-pad)", display:"flex", flexDirection:"column", gap: 18, position:"relative", overflow:"hidden"}}>
            <div style={{position:"absolute", top:-30, right:-30, width: 140, height: 140, borderRadius: 999, background: t.bg, opacity: .35}}/>
            <div style={{position:"relative", color:"var(--primary)", fontSize: 14, letterSpacing:"2px"}}>{"★".repeat(t.stars)}</div>
            <div style={{position:"relative", fontSize: 15.5, lineHeight: 1.55, color:"var(--fg)"}}>"{t.text}"</div>
            <div style={{position:"relative", marginTop:"auto", display:"flex", alignItems:"center", gap: 10}}>
              <div style={{width: 32, height: 32, borderRadius: 999, background: t.bg, display:"flex", alignItems:"center", justifyContent:"center", fontWeight: 700, fontSize: 13, color:"var(--fg)"}}>{t.name[0]}</div>
              <div>
                <div style={{fontSize: 13, fontWeight: 600}}>{t.name}</div>
                <div style={{fontSize: 11, color:"var(--muted)"}}>{t.role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────── Pricing ───────────
function Pricing({ go }){
  return (
    <section className="page" style={{paddingBottom:"var(--gap-xl)"}}>
      <SectionHead eyebrow="Preço" title={["Compre 1, compre 5,","compre o pack."]}/>
      <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap: 16, marginTop: "var(--gap-lg)"}}>
        {[
          { name:"Avulso", price:"R$ 29–59", desc:"Compre só o resumo que precisa. Sem assinatura, sem pegadinha.", btn:"Ver resumos", action:()=>go({name:"catalog"}), feats:["1 resumo em PDF", "Acesso vitalício", "Atualizações grátis", "Garantia de 7 dias"] },
          { name:"Pack por área", price:"R$ 99", desc:"Todos os resumos de uma área (Cardio, Neuro, etc). Economize 35%.", btn:"Ver packs", action:()=>go({name:"catalog"}), feats:["Todos os resumos da área", "Bônus: mapa mental", "Acesso vitalício", "Atualizações grátis"], highlight: true },
          { name:"Combo completo", price:"R$ 299", desc:"Todos os 26 resumos. Tudo, atualizado, pronto pros 6 anos.", btn:"Quero o combo", action:()=>go({name:"catalog"}), feats:["Catálogo completo", "Atualizações vitalícias", "Bônus: flashcards de revisão", "Suporte direto comigo"] },
        ].map((p, i)=>(
          <div key={i} className="card" style={{padding: 26, display:"flex", flexDirection:"column", gap: 14, position:"relative", border: p.highlight ? "2px solid var(--primary)" : undefined}}>
            {p.highlight && <div style={{position:"absolute", top:-10, left: 22, background:"var(--primary)", color:"var(--primary-ink)", padding:"3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing:".05em"}}>MAIS POPULAR</div>}
            <div className="display" style={{fontSize: 22, fontWeight: 700}}>{p.name}</div>
            <div className="display" style={{fontSize: 40, fontWeight: 700, color:"var(--primary)", lineHeight: 1}}>{p.price}</div>
            <div style={{color:"var(--muted)", fontSize: 14, lineHeight: 1.5}}>{p.desc}</div>
            <ul style={{listStyle:"none", padding: 0, margin:"10px 0", display:"flex", flexDirection:"column", gap: 8, fontSize: 14}}>
              {p.feats.map(f=><li key={f} className="row" style={{gap: 8}}><span style={{color:"var(--acc-2)", fontWeight: 700}}>✓</span>{f}</li>)}
            </ul>
            <button onClick={p.action} className={"btn " + (p.highlight ? "primary" : "")} style={{justifyContent:"center", marginTop:"auto"}}>{p.btn}</button>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────── FAQ ───────────
function FAQ(){
  const [open, setOpen] = useStateP(0);
  const items = [
    { q:"Os resumos são atualizados?", a:"Sim. Reviso todo semestre conforme novas diretrizes saem (SBC, BTS, ADA, etc) e você recebe a versão atualizada de graça, pra sempre." },
    { q:"Como acesso os resumos?", a:"Direto na sua biblioteca aqui no site, leitor próprio, qualquer dispositivo. Sem download — é leitura online com seu acesso vitalício." },
    { q:"Posso imprimir ou baixar?", a:"Não. É leitura online no nosso leitor protegido. Isso garante que o conteúdo não vaze e você consegue acessar de qualquer dispositivo a qualquer hora." },
    { q:"E se eu não gostar?", a:"7 dias de garantia, sem perguntas. Não gostou, devolvo. Simples assim." },
    { q:"Funciona pra residência?", a:"Funciona pra base. Pros últimos meses, faça questões — mas o conteúdo conceitual está todo lá." },
    { q:"Quem faz esses resumos?", a:"Eu, estudante de medicina. Comecei resumindo pra mim e pros amigos da turma. Agora estou abrindo pra quem quiser." },
  ];
  return (
    <section className="page" style={{paddingBottom:"var(--gap-xl)"}} id="faq">
      <div style={{display:"grid", gridTemplateColumns:".7fr 1fr", gap: "var(--gap-lg)", alignItems:"flex-start"}}>
        <div style={{position:"sticky", top: 96}}>
          <SectionHead eyebrow="FAQ" title={["Quase tudo","que perguntam."]}/>
          <p style={{color:"var(--muted)", marginTop: 18, fontSize: 15, lineHeight: 1.6}}>
            Não achou sua resposta? Manda DM no meu Insta — respondo geralmente em algumas horas.
          </p>
        </div>
        <div className="col" style={{gap: 10}}>
          {items.map((it, i)=>(
            <button key={i} onClick={()=>setOpen(open===i?-1:i)} className="card" style={{padding: "var(--card-pad)", textAlign:"left", cursor:"pointer", fontFamily:"inherit", color:"var(--fg)"}}>
              <div className="row between" style={{alignItems:"flex-start", gap: 16}}>
                <div className="display" style={{fontSize: 18, fontWeight: 600}}>{it.q}</div>
                <div style={{width: 28, height: 28, borderRadius: 999, background:"var(--bg)", border:"1px solid var(--line)", display:"flex", alignItems:"center", justifyContent:"center", flex:"0 0 auto", transform: open===i?"rotate(45deg)":"rotate(0)", transition:"transform .2s"}}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 1v10M1 6h10"/></svg>
                </div>
              </div>
              <div style={{maxHeight: open===i ? 200 : 0, overflow:"hidden", transition:"max-height .25s ease, margin .2s", color:"var(--muted)", fontSize: 14.5, lineHeight: 1.6, marginTop: open===i ? 12 : 0}}>
                {it.a}
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────── CTA Banner ───────────
function CtaBanner({ go }){
  return (
    <section className="page" style={{paddingBottom:"var(--gap-xl)"}}>
      <div style={{position:"relative", overflow:"hidden", background:"var(--fg)", color:"var(--bg)", borderRadius:"var(--radius-lg)", padding:"clamp(40px, 6vw, 80px)", textAlign:"center"}}>
        <div style={{position:"absolute", top: 16, left: 16, animation:"float 5s ease-in-out infinite"}}><Illu.Cross size={48}/></div>
        <div style={{position:"absolute", bottom: 16, right: 16, animation:"float 6s ease-in-out infinite 1s"}}><Illu.Pill size={56}/></div>
        <div style={{position:"absolute", top: 30, right: 50, animation:"float 7s ease-in-out infinite .5s"}}><Illu.Heart size={42} color="var(--acc-1)"/></div>

        <div style={{position:"relative", maxWidth: 680, margin: "0 auto"}}>
          <h2 className="display" style={{fontSize:"clamp(36px, 5.5vw, 64px)", margin: 0, fontWeight: 700, lineHeight: 1.05}}>
            Sua próxima prova<br/>começa <span className="serif" style={{color:"var(--acc-1)", fontWeight: 400}}>hoje</span>.
          </h2>
          <p style={{fontSize: 17, lineHeight: 1.5, color:"rgba(255,255,255,.7)", marginTop: 18, marginBottom: 28}}>
            Pega o catálogo, escolhe os resumos e abre na sua biblioteca. Em 5 minutos você já tá estudando.
          </p>
          <button className="btn lg primary" onClick={()=>go({name:"catalog"})} style={{padding:"18px 28px", fontSize: 16}}>
            Ver todos os resumos →
          </button>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────
//  CATALOG PAGE
// ─────────────────────────────────────────────────────────
function Catalog({ go, addToCart, cart, initialFilter }){
  const [filter, setFilter] = useStateP(initialFilter || "all");
  const [query, setQuery] = useStateP("");
  const [sort, setSort] = useStateP("popular");
  const [products, setProducts] = useStateP([]);
  const [loading, setLoading] = useStateP(true);

  useEffectP(()=>{
    let mounted = true;
    fetchProducts()
      .then(p => { if (mounted){ setProducts(p); setLoading(false); }})
      .catch(err => { console.error("[catalog]", err); if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  useEffectP(()=>{ if (initialFilter) setFilter(initialFilter); }, [initialFilter]);

  const list = useMemoP(()=>{
    let r = products.slice();
    if (filter !== "all") r = r.filter(x=>x.area === filter);
    if (query) r = r.filter(x => (x.title + " " + (x.topics||[]).join(" ")).toLowerCase().includes(query.toLowerCase()));
    if (sort==="price-low") r.sort((a,b)=>a.price-b.price);
    else if (sort==="price-high") r.sort((a,b)=>b.price-a.price);
    else if (sort==="pages") r.sort((a,b)=>b.pages-a.pages);
    return r;
  }, [products, filter, query, sort]);

  return (
    <div className="pagewrap">
      {/* Header */}
      <section className="page" style={{paddingTop: 40, paddingBottom: 28}}>
        <div className="row" style={{gap: 6, fontSize: 13, color:"var(--muted)", marginBottom: 16}}>
          <a onClick={()=>go({name:"landing"})} style={{cursor:"pointer"}}>Início</a>
          <span>›</span>
          <span>Catálogo</span>
        </div>
        <div className="row between" style={{alignItems:"flex-end", flexWrap:"wrap", gap: 24}}>
          <div>
            <h1 className="display" style={{fontSize:"clamp(40px, 6vw, 72px)", margin: 0, fontWeight: 700, lineHeight: 1.05}}>
              Catálogo<span style={{color:"var(--primary)"}}>.</span>
            </h1>
            <p style={{color:"var(--muted)", fontSize: 17, marginTop: 10, maxWidth: 540}}>
              {products.length} resumos em {AREAS.length} áreas. Escolhe o que precisa e estuda direto na sua biblioteca.
            </p>
          </div>
          <div className="row" style={{gap: 10, flexWrap:"wrap"}}>
            <div style={{position:"relative"}}>
              <svg style={{position:"absolute", left: 14, top: "50%", transform:"translateY(-50%)", opacity:.5}} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
              <input
                value={query}
                onChange={e=>setQuery(e.target.value)}
                placeholder="Buscar resumo ou tópico..."
                style={{padding:"12px 16px 12px 40px", borderRadius: 999, border:"1px solid var(--line)", background:"var(--surface)", color:"var(--fg)", fontFamily:"inherit", fontSize: 14, width: 260, outline:"none"}}
              />
            </div>
            <select value={sort} onChange={e=>setSort(e.target.value)} style={{padding:"12px 14px", borderRadius: 999, border:"1px solid var(--line)", background:"var(--surface)", color:"var(--fg)", fontFamily:"inherit", fontSize: 14, cursor:"pointer"}}>
              <option value="popular">Mais populares</option>
              <option value="price-low">Menor preço</option>
              <option value="price-high">Maior preço</option>
              <option value="pages">Mais páginas</option>
            </select>
          </div>
        </div>

        {/* Filter chips */}
        <div className="tag-rail" style={{marginTop: 24}}>
          <button className={"chip " + (filter==="all"?"active":"")} onClick={()=>setFilter("all")}>
            Todos <span className="mono" style={{opacity:.5, fontSize: 11}}>{products.length}</span>
          </button>
          {AREAS.map(a => {
            const c = products.filter(r=>r.area===a.id).length;
            return (
              <button key={a.id} className={"chip " + (filter===a.id?"active":"")} onClick={()=>setFilter(a.id)}>
                {a.name} <span className="mono" style={{opacity:.5, fontSize: 11}}>{c}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Grid */}
      <section className="page" style={{paddingBottom: "var(--gap-xl)"}}>
        {loading ? (
          <div style={{padding: 80, textAlign:"center", color:"var(--muted)"}}>
            <div className="display" style={{fontSize: 18, color:"var(--muted)"}}>Carregando catálogo…</div>
          </div>
        ) : list.length === 0 ? (
          <div style={{padding: 80, textAlign:"center", color:"var(--muted)"}}>
            <div className="display" style={{fontSize: 24, color:"var(--fg)", marginBottom: 8}}>Nada encontrado.</div>
            Tente outra busca ou área.
          </div>
        ) : (
          <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(260px, 1fr))", gap: 16}}>
            {list.map(r => (
              <ResumoCard key={r.id} r={r} go={go} addToCart={addToCart} cart={cart}/>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ResumoCard({ r, go, addToCart, cart }){
  const area = AREAS.find(a=>a.id===r.area) || { name: r.area };
  const I = ILLU_FOR_AREA[r.area] || Illu.Cross;
  const inCart = cart?.some(c=>c.id===r.id);
  return (
    <div className="card" style={{padding:"var(--card-pad)", display:"flex", flexDirection:"column", gap: 14, cursor:"pointer", transition:"transform .15s ease"}}
         onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"}
         onMouseLeave={e=>e.currentTarget.style.transform="translateY(0)"}
         onClick={()=>go({name:"product", id:r.id})}>
      <div className="row between" style={{alignItems:"flex-start"}}>
        <I size={48}/>
        <div className="mono" style={{fontSize: 11, color:"var(--muted)"}}>{r.pages}pg</div>
      </div>
      <div>
        <div className="mono" style={{fontSize: 10, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".1em", marginBottom: 4}}>{area.name}</div>
        <div className="display" style={{fontSize: 19, fontWeight: 600, lineHeight: 1.15}}>{r.title}</div>
      </div>
      <div style={{display:"flex", gap: 5, flexWrap:"wrap", minHeight: 22}}>
        {r.topics.slice(0,3).map(t=>(
          <span key={t} style={{fontSize: 11, padding:"2px 8px", borderRadius: 999, background:"var(--bg)", border:"1px solid var(--line)", color:"var(--muted)"}}>{t}</span>
        ))}
      </div>
      <div className="row between" style={{marginTop:"auto", paddingTop: 8}}>
        <div className="display" style={{fontSize: 22, fontWeight: 700, color:"var(--fg)"}}>R$ {r.price}</div>
        <button onClick={(e)=>{e.stopPropagation(); addToCart(r);}} className={"btn " + (inCart ? "" : "primary")} style={{padding:"8px 14px", fontSize: 13}}>
          {inCart ? "No carrinho ✓" : "+ Adicionar"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  PRODUCT PAGE
// ─────────────────────────────────────────────────────────
function Product({ id, go, addToCart, cart }){
  const [r, setR] = useStateP(null);
  const [related, setRelated] = useStateP([]);
  const [loading, setLoading] = useStateP(true);

  useEffectP(()=>{
    let mounted = true;
    (async ()=>{
      try {
        const prod = await fetchProductById(id);
        if (!mounted) return;
        setR(prod);
        if (prod){
          const all = await fetchProducts();
          if (mounted) setRelated(all.filter(x=>x.area===prod.area && x.id!==prod.id).slice(0,3));
        }
      } catch (err) {
        console.error("[product]", err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return ()=>{ mounted = false; };
  }, [id]);

  if (loading) return <div className="page" style={{padding: 80, textAlign:"center", color:"var(--muted)"}}>Carregando…</div>;
  if (!r) return (
    <div className="page" style={{padding: 80, textAlign:"center"}}>
      <div className="display" style={{fontSize: 24, fontWeight: 700}}>Resumo não encontrado.</div>
      <button className="btn primary" style={{marginTop: 16}} onClick={()=>go({name:"catalog"})}>Ver catálogo</button>
    </div>
  );

  const area = AREAS.find(a=>a.id===r.area) || AREAS[0];
  const I = ILLU_FOR_AREA[r.area] || Illu.Cross;
  const inCart = cart?.some(c=>c.id===r.id);

  return (
    <div className="pagewrap">
      <section className="page" style={{paddingTop: 32, paddingBottom: "var(--gap-lg)"}}>
        <div className="row" style={{gap: 6, fontSize: 13, color:"var(--muted)", marginBottom: 26}}>
          <a onClick={()=>go({name:"landing"})} style={{cursor:"pointer"}}>Início</a>
          <span>›</span>
          <a onClick={()=>go({name:"catalog"})} style={{cursor:"pointer"}}>Catálogo</a>
          <span>›</span>
          <a onClick={()=>go({name:"catalog", filter: r.area})} style={{cursor:"pointer"}}>{area.name}</a>
          <span>›</span>
          <span style={{color:"var(--fg)"}}>{r.title}</span>
        </div>

        <div style={{display:"grid", gridTemplateColumns:"1.1fr .9fr", gap: 48, alignItems:"flex-start"}}>
          {/* Left: PDF mock + content list */}
          <div>
            <ProductPagePreview r={r} area={area} I={I}/>

            <div className="row" style={{gap: 10, marginTop: 12, justifyContent:"center"}}>
              {[1,2,3,4].map(p=>(
                <div key={p} style={{width: 8, height: 8, borderRadius: 999, background: p===1?"var(--primary)":"var(--line-strong)"}}/>
              ))}
            </div>
          </div>

          {/* Right: details */}
          <div style={{position:"sticky", top: 96}}>
            <div className="row" style={{gap: 8, marginBottom: 18}}>
              <span className="pill" style={{background:"var(--acc-2)", borderColor:"transparent", color:"var(--fg)"}}>
                <span>★</span> Atualizado em {r.updated}
              </span>
              <span className="pill"><span className="mono">{r.pages} páginas</span></span>
            </div>

            <div className="mono" style={{fontSize: 11, textTransform:"uppercase", letterSpacing:".1em", color:"var(--muted)", marginBottom: 8}}>{area.name}</div>
            <h1 className="display" style={{fontSize: "clamp(36px, 4.8vw, 56px)", fontWeight: 700, margin: 0, lineHeight: 1.05}}>{r.title}</h1>

            <p style={{color:"var(--muted)", fontSize: 17, lineHeight: 1.55, marginTop: 18, marginBottom: 24}}>
              Tudo que você precisa saber sobre {r.title.toLowerCase()} pra graduação. Diretrizes atualizadas, fluxogramas, mnemônicos e o que <i>realmente</i> cai na prova.
            </p>

            <div className="row" style={{alignItems:"baseline", gap: 12, marginBottom: 22}}>
              <div className="display" style={{fontSize: 48, fontWeight: 700, color:"var(--fg)", lineHeight: 1}}>R$ {r.price}</div>
              <div style={{color:"var(--muted)", fontSize: 14}}>à vista · ou 3x sem juros</div>
            </div>

            <div className="row gap-md" style={{flexWrap:"wrap", marginBottom: 24}}>
              <button className="btn primary lg" onClick={()=>{addToCart(r); go({name:"cart"});}} style={{flex:"1 1 220px", justifyContent:"center"}}>
                Comprar agora
              </button>
              <button className="btn lg" onClick={()=>addToCart(r)} style={{flex:"0 1 auto"}}>
                {inCart ? "✓ No carrinho" : "Add ao carrinho"}
              </button>
            </div>

            <div className="card" style={{padding: 18, marginBottom: 18}}>
              <div className="display" style={{fontSize: 16, fontWeight: 600, marginBottom: 12}}>O que está dentro</div>
              <div style={{display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap: 8}}>
                {r.topics.map(t=>(
                  <div key={t} className="row" style={{gap: 8, fontSize: 14}}>
                    <span style={{color:"var(--primary)", fontWeight: 700}}>›</span>{t}
                  </div>
                ))}
              </div>
            </div>

            <div className="col" style={{gap: 12, fontSize: 14, color:"var(--muted)"}}>
              <div className="row" style={{gap: 10}}>
                <Icon name="download"/> Leitor online protegido · libera na hora
              </div>
              <div className="row" style={{gap: 10}}>
                <Icon name="refresh"/> Atualizações grátis pra sempre
              </div>
              <div className="row" style={{gap: 10}}>
                <Icon name="shield"/> Garantia de 7 dias · devolução total
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Related */}
      <section className="page" style={{paddingBottom:"var(--gap-xl)"}}>
        <SectionHead eyebrow="Mais em " title={[area.name, "também."]}/>
        <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap: 16, marginTop: "var(--gap-lg)"}}>
          {related.length ? related.map(rr=>(
            <ResumoCard key={rr.id} r={rr} go={go} addToCart={addToCart} cart={cart}/>
          )) : <div style={{color:"var(--muted)"}}>Em breve mais resumos nessa área.</div>}
        </div>
      </section>
    </div>
  );
}

function ProductPagePreview({ r, area, I }){
  const pvSection   = r.preview?.section   || r.topics?.[0] || "";
  const pvHighlight = r.preview?.highlight || null;
  const pvBox1      = r.preview?.box1 || r.topics?.[1] || "";
  const pvBox2      = r.preview?.box2 || r.topics?.[2] || "";
  const boxes       = [pvBox1, pvBox2].filter(Boolean);

  return (
    <div style={{position:"relative", aspectRatio:"4 / 5", background:"var(--surface)", border:"1px solid var(--line)", borderRadius:"var(--radius-lg)", overflow:"hidden"}}>
      <div style={{position:"absolute", top: 28, left: 28, right: 28, bottom: 28, background:"var(--bg)", borderRadius: 14, padding: 28, display:"flex", flexDirection:"column", gap: 14, fontFamily:"var(--font-body)", overflow:"hidden"}}>
        <div className="row between">
          <div className="row" style={{gap: 10}}>
            <I size={32}/>
            <div>
              <div className="mono" style={{fontSize: 10, letterSpacing:".08em", textTransform:"uppercase", color:"var(--muted)"}}>{area.name}</div>
              <div className="display" style={{fontSize: 18, fontWeight: 700}}>{r.title || "Título do resumo"}</div>
            </div>
          </div>
          <div className="mono" style={{fontSize: 11, color:"var(--muted)"}}>resumosmed</div>
        </div>
        <div style={{borderTop:"1.5px solid var(--fg)"}}/>
        {pvSection && <div className="serif" style={{fontSize: 28, lineHeight: 1.1, color:"var(--fg)"}}>{pvSection}</div>}
        <div style={{display:"flex", flexDirection:"column", gap: 6}}>
          <Bar w="86%"/><Bar w="92%"/><Bar w="68%"/><Bar w="80%"/>
        </div>
        <div style={{padding: 14, background:"var(--acc-1)", borderRadius: 10}}>
          <div className="mono" style={{fontSize: 10, fontWeight: 700, letterSpacing:".08em", textTransform:"uppercase", marginBottom: 6, color:"var(--fg)"}}>★ Cai na prova</div>
          {pvHighlight ? (
            <div style={{fontSize: 12, lineHeight: 1.5, color:"var(--fg)"}}>{pvHighlight}</div>
          ) : (
            <div style={{display:"flex", flexDirection:"column", gap: 5}}>
              <Bar w="78%" highlight="rgba(0,0,0,.3)"/>
              <Bar w="62%" highlight="rgba(0,0,0,.3)"/>
            </div>
          )}
        </div>
        {boxes.length > 0 && (
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap: 8}}>
            {boxes.map(t=>(
              <div key={t} style={{background:"var(--surface)", borderRadius: 10, padding:"10px 12px", border:"1px solid var(--line)"}}>
                <div className="mono" style={{fontSize: 10, color:"var(--primary)", fontWeight: 700, textTransform:"uppercase", letterSpacing:".08em"}}>{t}</div>
                <div style={{marginTop: 6, display:"flex", flexDirection:"column", gap: 4}}>
                  <Bar w="72%"/><Bar w="55%"/>
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{marginTop:"auto", display:"flex", justifyContent:"space-between", alignItems:"center", fontSize: 11, color:"var(--muted)"}} className="mono">
          <span>pg 4 / {r.pages || "?"}</span>
          <span>★ resumosmed</span>
        </div>
      </div>
      <div style={{position:"absolute", inset: 0, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none"}}>
        <div className="display" style={{fontSize: 56, fontWeight: 800, color:"rgba(0,0,0,.04)", letterSpacing:"-0.04em", transform:"rotate(-20deg)"}}>PRÉVIA · PRÉVIA · PRÉVIA</div>
      </div>
    </div>
  );
}

function Icon({ name }){
  const props = { width: 16, height: 16, viewBox:"0 0 24 24", fill:"none", stroke:"currentColor", strokeWidth: 2, strokeLinecap:"round", strokeLinejoin:"round" };
  if (name==="download") return <svg {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>;
  if (name==="refresh") return <svg {...props}><path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-7-3.3M3 12a9 9 0 0 1 9-9 9 9 0 0 1 7 3.3M3 21v-6h6M21 3v6h-6"/></svg>;
  if (name==="shield") return <svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
  return null;
}

// ─────────────────────────────────────────────────────────
//  CART PAGE
// ─────────────────────────────────────────────────────────
function Cart({ go, cart, removeFromCart, currentUser, clearCart, refreshUser }){
  const [paying, setPaying] = useStateP(false);
  const [success, setSuccess] = useStateP(false);
  const [errMsg, setErrMsg] = useStateP("");
  const total = cart.reduce((s,r)=>s+r.price, 0);
  const discount = Math.round(total*0.05);
  const finalTotal = total - discount;

  const checkout = async () => {
    if (!currentUser){
      go({ name: "login" });
      return;
    }
    setPaying(true);
    setErrMsg("");
    // simula latência do gateway
    await new Promise(r => setTimeout(r, 800));
    const result = await recordPurchase(currentUser, cart);
    if (result?.error){
      setPaying(false);
      setErrMsg("Erro ao registrar compra: " + result.error);
      return;
    }
    await refreshUser?.();
    setPaying(false);
    setSuccess(true);
    setTimeout(()=>{
      clearCart();
      go({ name:"library" });
    }, 1500);
  };

  if (success){
    return (
      <div className="pagewrap page" style={{paddingTop: 60, paddingBottom: "var(--gap-xl)", textAlign:"center"}}>
        <div style={{width: 96, height: 96, margin:"0 auto 20px", borderRadius: 999, background:"var(--acc-2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize: 48, animation:"pageIn .4s cubic-bezier(.2,.7,.1,1)"}}>✓</div>
        <h1 className="display" style={{fontSize:"clamp(36px, 5vw, 56px)", margin: 0, fontWeight: 700}}>Pagamento confirmado!</h1>
        <p style={{color:"var(--muted)", marginTop: 12, fontSize: 16}}>Já liberei seus resumos. Te levando pra biblioteca...</p>
      </div>
    );
  }

  return (
    <div className="pagewrap page" style={{paddingTop: 40, paddingBottom: "var(--gap-xl)"}}>
      <h1 className="display" style={{fontSize:"clamp(40px, 6vw, 64px)", margin: 0, fontWeight: 700}}>Carrinho<span style={{color:"var(--primary)"}}>.</span></h1>
      <p style={{color:"var(--muted)", marginTop: 8, fontSize: 16}}>{cart.length} {cart.length===1?"item":"itens"} prontinhos pra você levar.</p>

      {cart.length === 0 ? (
        <div className="card" style={{padding: 60, textAlign:"center", marginTop: 32}}>
          <Illu.Cross size={56}/>
          <div className="display" style={{fontSize: 22, fontWeight: 700, marginTop: 14}}>Tá vazio por aqui.</div>
          <p style={{color:"var(--muted)", marginTop: 6, marginBottom: 20}}>Vai dar uma volta no catálogo, tem resumo de monte te esperando.</p>
          <button className="btn primary" onClick={()=>go({name:"catalog"})}>Ver catálogo</button>
        </div>
      ) : (
        <div style={{display:"grid", gridTemplateColumns:"1.5fr 1fr", gap: 32, marginTop: 32}}>
          <div className="col" style={{gap: 12}}>
            {cart.map(r => {
              const area = AREAS.find(a=>a.id===r.area) || AREAS[0];
              const I = ILLU_FOR_AREA[r.area] || Illu.Cross;
              return (
                <div key={r.id} className="card" style={{padding: 18, display:"flex", alignItems:"center", gap: 16}}>
                  <I size={56}/>
                  <div style={{flex: 1}}>
                    <div className="mono" style={{fontSize: 10, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".1em"}}>{area.name}</div>
                    <div className="display" style={{fontSize: 18, fontWeight: 600}}>{r.title}</div>
                    <div className="mono" style={{fontSize: 12, color:"var(--muted)", marginTop: 2}}>{r.pages} páginas · atualizado {r.updated}</div>
                  </div>
                  <div className="display" style={{fontSize: 20, fontWeight: 700}}>R$ {r.price}</div>
                  <button onClick={()=>removeFromCart(r.id)} className="btn ghost" style={{padding: 8}} aria-label="Remover">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              );
            })}
          </div>

          <div className="card" style={{padding: 24, height:"fit-content", position:"sticky", top: 96}}>
            <div className="display" style={{fontSize: 18, fontWeight: 700, marginBottom: 14}}>Resumo</div>
            <div className="row between" style={{fontSize: 14, color:"var(--muted)", marginBottom: 8}}><span>Subtotal</span><span className="mono">R$ {total},00</span></div>
            <div className="row between" style={{fontSize: 14, color:"var(--muted)", marginBottom: 8}}><span>Desconto pix</span><span className="mono" style={{color:"var(--acc-2)"}}>-R$ {discount},00</span></div>
            <div style={{borderTop:"1px solid var(--line)", margin:"14px 0"}}/>
            <div className="row between" style={{marginBottom: 18}}>
              <span style={{fontWeight: 700}}>Total</span>
              <span className="display" style={{fontSize: 28, fontWeight: 700}}>R$ {finalTotal}</span>
            </div>

            {!currentUser && (
              <div style={{padding: 12, background:"var(--bg)", borderRadius: 10, border:"1px dashed var(--line-strong)", fontSize: 12.5, color:"var(--muted)", marginBottom: 12, lineHeight: 1.5}}>
                Pra finalizar, você precisa <a onClick={()=>go({name:"login"})} style={{color:"var(--primary)", cursor:"pointer", fontWeight: 600}}>entrar</a> ou <a onClick={()=>go({name:"signup"})} style={{color:"var(--primary)", cursor:"pointer", fontWeight: 600}}>criar uma conta</a>.
              </div>
            )}

            {errMsg && (
              <div style={{padding: 12, background:"color-mix(in oklab, var(--primary) 12%, var(--bg))", borderRadius: 10, border:"1px solid var(--primary)", fontSize: 12.5, color:"var(--primary)", fontWeight: 600, marginBottom: 12, lineHeight: 1.5}}>
                {errMsg}
              </div>
            )}

            <button className="btn primary lg" style={{width:"100%", justifyContent:"center"}} onClick={checkout} disabled={paying}>
              {paying ? "Processando pagamento..." : currentUser ? "Finalizar com Pix →" : "Entrar e finalizar →"}
            </button>
            <div style={{fontSize: 12, color:"var(--muted)", marginTop: 12, textAlign:"center"}}>Resumos liberados na sua biblioteca na hora.</div>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { Landing, Catalog, Product, Cart, HERO_COPY, ProductPagePreview });
