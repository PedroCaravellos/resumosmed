// admin.jsx — Admin dashboard: products upload + purchase history

const { useState: useStateAdmin, useMemo: useMemoAdmin, useEffect: useEffectAdmin, useRef: useRefAdmin } = React;

function AdminDashboard({ go, currentUser, onLogout }){
  const [tab, setTab] = useStateAdmin("upload");

  if (!currentUser || currentUser.role !== "admin") {
    return (
      <div className="page" style={{paddingTop: 60, paddingBottom: 60, textAlign:"center"}}>
        <div className="display" style={{fontSize: 28, fontWeight: 700, marginBottom: 10}}>Acesso restrito</div>
        <p style={{color:"var(--muted)", marginBottom: 20}}>Você precisa entrar como admin pra ver este painel.</p>
        <button className="btn primary" onClick={()=>go({name:"login"})}>Entrar</button>
      </div>
    );
  }

  return (
    <div className="pagewrap">
      <section className="page" style={{paddingTop: 36, paddingBottom: 24}}>
        <div className="row between" style={{flexWrap:"wrap", gap: 16, marginBottom: 22}}>
          <div>
            <div className="mono" style={{fontSize: 11, textTransform:"uppercase", letterSpacing:".1em", color:"var(--primary)", marginBottom: 8}}>
              Painel administrativo
            </div>
            <h1 className="display" style={{fontSize:"clamp(36px, 5vw, 56px)", margin: 0, fontWeight: 700, lineHeight: 1.05}}>
              Olá, {currentUser.name.split(" ")[0]}<span style={{color:"var(--primary)"}}>.</span>
            </h1>
          </div>
          <button className="btn" onClick={onLogout}>Sair</button>
        </div>

        <AdminStats/>

        <div className="row" style={{gap: 8, marginTop: 24, borderBottom:"1px solid var(--line)"}}>
          <TabBtn active={tab==="upload"} onClick={()=>setTab("upload")}>Upload de resumo</TabBtn>
          <TabBtn active={tab==="products"} onClick={()=>setTab("products")}>Resumos publicados</TabBtn>
          <TabBtn active={tab==="history"} onClick={()=>setTab("history")}>Histórico de compras</TabBtn>
          <TabBtn active={tab==="descontos"} onClick={()=>setTab("descontos")}>Descontos</TabBtn>
          <TabBtn active={tab==="users"} onClick={()=>setTab("users")}>Usuários & atividade</TabBtn>
          <TabBtn active={tab==="suporte"} onClick={()=>setTab("suporte")}>Suporte</TabBtn>
        </div>
      </section>

      <section className="page" style={{paddingBottom:"var(--gap-xl)"}}>
        {tab === "upload"    && <AdminUpload/>}
        {tab === "products"  && <AdminProducts go={go}/>}
        {tab === "history"   && <AdminHistory/>}
        {tab === "descontos" && <AdminDiscounts/>}
        {tab === "users"     && <AdminUsers/>}
        {tab === "suporte"   && <AdminSupport currentUser={currentUser}/>}
      </section>
    </div>
  );
}

function TabBtn({ active, onClick, children }){
  return (
    <button
      onClick={onClick}
      style={{
        padding: "12px 18px", border: 0, background:"transparent", cursor:"pointer", fontFamily:"inherit",
        fontSize: 14, fontWeight: 600, color: active ? "var(--fg)" : "var(--muted)",
        borderBottom: active ? "2px solid var(--primary)" : "2px solid transparent",
        marginBottom: -1, transition:"color .15s ease"
      }}
    >
      {children}
    </button>
  );
}

function AdminStats(){
  const [stats, setStats] = useStateAdmin({ purchases: 0, products: 0, users: 0, revenue: 0, lastMonthRev: 0, lastMonthCount: 0 });

  useEffectAdmin(()=>{
    let mounted = true;
    (async () => {
      try {
        const [sales, products, usersCount] = await Promise.all([
          fetchAllSales(),
          fetchProducts(),
          fetchUsersCount(),
        ]);
        if (!mounted) return;
        const revenue = (sales||[]).reduce((s,p)=>s+(p.price||0), 0);
        const lastMonth = (sales||[]).filter(p=>(Date.now()-new Date(p.created_at).getTime()) < 30*86400000);
        const lastMonthRev = lastMonth.reduce((s,p)=>s+(p.price||0), 0);
        setStats({ purchases: (sales||[]).length, products: (products||[]).length, users: usersCount, revenue, lastMonthRev, lastMonthCount: lastMonth.length });
      } catch (err) {
        console.error("[admin/stats]", err);
      }
    })();
    return ()=>{ mounted = false; };
  }, []);

  const cards = [
    { label:"Receita total", value: "R$ "+stats.revenue, sub:`+R$ ${stats.lastMonthRev} nos últimos 30d`, color:"var(--acc-2)" },
    { label:"Vendas", value: stats.purchases, sub:`${stats.lastMonthCount} nos últimos 30d`, color:"var(--acc-1)" },
    { label:"Resumos publicados", value: stats.products, sub:`${stats.products} disponíveis na loja`, color:"var(--acc-3)" },
    { label:"Clientes", value: stats.users, sub:`${stats.users} contas criadas`, color:"var(--acc-4)" },
  ];

  return (
    <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap: 14}}>
      {cards.map((c, i) => (
        <div key={i} className="card" style={{padding: "var(--card-pad)", position:"relative", overflow:"hidden"}}>
          <div style={{position:"absolute", top: -20, right: -20, width: 90, height: 90, borderRadius: 999, background: c.color, opacity:.3}}/>
          <div style={{fontSize: 12, color:"var(--muted)", fontWeight: 600, textTransform:"uppercase", letterSpacing:".06em", position:"relative"}}>{c.label}</div>
          <div className="display" style={{fontSize: 36, fontWeight: 700, marginTop: 6, position:"relative"}}>{c.value}</div>
          <div style={{fontSize: 12.5, color:"var(--muted)", marginTop: 4, position:"relative"}}>{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ─────────── Upload ───────────
function AdminUpload(){
  const fileRef = useRefAdmin(null);
  const [form, setForm] = useStateAdmin({
    title:"", area:"cardio", price: 39, pages: 30, topics:"",
    previewSection:"", previewHighlight:"", previewBox1:"", previewBox2:"",
  });
  const [file, setFile] = useStateAdmin(null);
  const [dragOver, setDragOver] = useStateAdmin(false);
  const [success, setSuccess] = useStateAdmin(null);
  const [err, setErr] = useStateAdmin("");
  const [busy, setBusy] = useStateAdmin(false);
  const [quizJson, setQuizJson] = useStateAdmin(null);
  const [quizPreview, setQuizPreview] = useStateAdmin(null);
  const [quizErr, setQuizErr] = useStateAdmin("");
  const quizFileRef = useRefAdmin(null);

  const upd = k => e => setForm({...form, [k]: e.target.value});

  const handleQuizFile = (f) => {
    if (!f) return;
    setQuizErr("");
    const ext = f.name.split(".").pop().toLowerCase();
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target.result;
      if (ext === "json") {
        try {
          const parsed = JSON.parse(content);
          if (!Array.isArray(parsed.questions) || parsed.questions.length === 0){
            setQuizErr("JSON inválido: precisa ter 'questions' com ao menos 1 item."); return;
          }
          const bad = parsed.questions.find(q => !q.options || !q.correct || !q.explanation);
          if (bad){ setQuizErr("Pergunta inválida: cada item precisa ter 'options', 'correct' e 'explanation'."); return; }
          setQuizJson(parsed);
          setQuizPreview({ title: parsed.title, count: parsed.questions.length });
        } catch { setQuizErr("Arquivo não é um JSON válido."); }
      } else {
        setQuizErr("Formato não suportado. Use .json");
      }
    };
    reader.readAsText(f, "UTF-8");
  };

  const handleFile = (f) => {
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")){
      setErr("Apenas arquivos PDF são aceitos."); return;
    }
    if (f.size > 100 * 1024 * 1024){
      setErr("Máximo 100MB por arquivo."); return;
    }
    setErr("");
    setFile({ name: f.name, size: f.size, type: f.type, _native: f });
    if (!form.title) {
      const base = f.name.replace(/\.pdf$/i,"").replace(/_/g," ").replace(/-/g," ");
      setForm(prev => ({...prev, title: base[0].toUpperCase() + base.slice(1)}));
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!file){ setErr("Selecione um arquivo PDF."); return; }
    if (!form.title.trim()){ setErr("Dê um título ao resumo."); return; }
    setErr("");
    setBusy(true);
    const topics = form.topics.split(",").map(t=>t.trim()).filter(Boolean).slice(0,4);
    const preview = {
      section:   form.previewSection.trim()   || null,
      highlight: form.previewHighlight.trim() || null,
      box1:      form.previewBox1.trim()      || null,
      box2:      form.previewBox2.trim()      || null,
    };
    const r = await createProduct({
      title: form.title,
      area: form.area,
      price: form.price,
      pages: form.pages,
      topics,
      file: file._native,
      preview: Object.values(preview).some(Boolean) ? preview : null,
      quiz_json: quizJson || null,
    });
    setBusy(false);
    if (r.error){ setErr("Falha ao publicar: " + r.error); return; }
    setSuccess(r.product);
    setForm({ title:"", area:"cardio", price: 39, pages: 30, topics:"", previewSection:"", previewHighlight:"", previewBox1:"", previewBox2:"" });
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
    setQuizJson(null); setQuizPreview(null); setQuizErr("");
    if (quizFileRef.current) quizFileRef.current.value = "";
    setTimeout(()=>setSuccess(null), 6000);
  };

  return (
    <div style={{display:"grid", gridTemplateColumns:"1.1fr .9fr", gap: 28, marginTop: 28}}>
      <div className="card" style={{padding: 28}}>
        <div className="display" style={{fontSize: 22, fontWeight: 700, marginBottom: 4}}>Publicar novo resumo</div>
        <p style={{color:"var(--muted)", fontSize: 14, marginBottom: 22}}>
          Faça upload do PDF e preencha os dados. Assim que publicar, ele aparece no catálogo.
        </p>

        {success && (
          <div style={{padding: 16, background:"var(--acc-2)", borderRadius: 12, marginBottom: 18, color:"var(--fg)", display:"flex", gap: 12, alignItems:"flex-start"}}>
            <div style={{fontSize: 22}}>✓</div>
            <div>
              <div style={{fontWeight: 700, marginBottom: 2}}>"{success.title}" publicado!</div>
              <div style={{fontSize: 13, opacity:.85}}>Já está no catálogo, à venda por R$ {success.price}.</div>
            </div>
          </div>
        )}

        <form onSubmit={submit}>
          {/* Dropzone */}
          <div
            onDragOver={e=>{ e.preventDefault(); setDragOver(true); }}
            onDragLeave={()=>setDragOver(false)}
            onDrop={e=>{ e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
            onClick={()=>fileRef.current?.click()}
            style={{
              border: "2px dashed " + (dragOver ? "var(--primary)" : "var(--line-strong)"),
              borderRadius: 16,
              padding: 28,
              textAlign: "center",
              cursor: "pointer",
              background: dragOver ? "color-mix(in oklab, var(--primary) 6%, var(--bg))" : "var(--bg)",
              transition: "all .15s ease",
              marginBottom: 16,
            }}
          >
            <input ref={fileRef} type="file" accept="application/pdf" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
            {!file ? (
              <>
                <div style={{display:"inline-flex", padding: 14, borderRadius: 999, background:"var(--surface)", marginBottom: 12}}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>
                </div>
                <div className="display" style={{fontSize: 17, fontWeight: 600}}>Arraste o PDF aqui</div>
                <div style={{color:"var(--muted)", fontSize: 13, marginTop: 4}}>ou clique pra escolher · máx 100MB</div>
              </>
            ) : (
              <div style={{display:"flex", alignItems:"center", gap: 14, textAlign:"left"}}>
                <div style={{width: 48, height: 60, borderRadius: 6, background:"var(--primary)", color:"var(--primary-ink)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", fontFamily:"var(--font-mono)", fontWeight: 700, fontSize: 11}}>
                  PDF
                </div>
                <div style={{flex: 1}}>
                  <div style={{fontWeight: 600, fontSize: 14}}>{file.name}</div>
                  <div style={{fontSize: 12, color:"var(--muted)"}}>{(file.size/1024/1024).toFixed(2)} MB</div>
                </div>
                <button type="button" onClick={(e)=>{e.stopPropagation(); setFile(null); if (fileRef.current) fileRef.current.value="";}} className="btn ghost" style={{padding: 8}} aria-label="Remover">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
            )}
          </div>

          {err && <div style={{fontSize: 13, color:"var(--primary)", fontWeight: 600, marginBottom: 12}}>{err}</div>}

          <Field label="Título do resumo">
            <TextInput required placeholder="Ex: Insuficiência Cardíaca" value={form.title} onChange={upd("title")}/>
          </Field>

          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap: 12}}>
            <Field label="Especialidade">
              <select value={form.area} onChange={upd("area")} style={{padding:"13px 14px", borderRadius: 12, border:"1px solid var(--line-strong)", background:"var(--bg)", color:"var(--fg)", fontSize: 14.5, fontFamily:"inherit", cursor:"pointer", outline:"none"}}>
                {AREAS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
            <Field label="Número de páginas">
              <TextInput type="number" min="1" required value={form.pages} onChange={upd("pages")}/>
            </Field>
          </div>

          <Field label="Preço (R$)" hint="Sem centavos. Ex: 39.">
            <TextInput type="number" min="0" required value={form.price} onChange={upd("price")}/>
          </Field>

          <Field label="Tópicos principais" hint="Separe por vírgula. Até 4. Aparecem no card e na página do resumo.">
            <TextInput placeholder="Ex: NYHA, ECA/BRA, Fração de ejeção, Sacubitril" value={form.topics} onChange={upd("topics")}/>
          </Field>

          <div style={{padding: 16, background:"var(--bg)", borderRadius: 12, border:"1px dashed var(--line-strong)", marginBottom: 14}}>
            <div style={{fontSize: 13, fontWeight: 700, color:"var(--fg)", marginBottom: 14}}>
              Prévia do produto
              <span style={{fontSize: 11, color:"var(--muted)", fontWeight: 400, marginLeft: 8}}>personaliza o mockup na página</span>
            </div>
            <Field label="Seção em destaque" hint="Heading em serif no mockup. Padrão: 1º tópico.">
              <TextInput placeholder="Ex: Diagnóstico" value={form.previewSection} onChange={upd("previewSection")}/>
            </Field>
            <Field label='Texto "Cai na prova"' hint="Box amarelo. Deixe vazio para exibir linhas simuladas.">
              <textarea
                value={form.previewHighlight} onChange={upd("previewHighlight")}
                placeholder={'Ex: NYHA é funcional e pode mudar. Stage A-D (ACC/AHA) é estrutural e só progride.'}
                style={{padding:"13px 14px", borderRadius: 12, border:"1px solid var(--line-strong)", background:"var(--surface)", color:"var(--fg)", fontSize: 14, fontFamily:"inherit", outline:"none", resize:"vertical", minHeight: 80, lineHeight: 1.5, width:"100%", boxSizing:"border-box"}}
              />
            </Field>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap: 12}}>
              <Field label="Mini-box 1">
                <TextInput placeholder="Ex: Diagnóstico" value={form.previewBox1} onChange={upd("previewBox1")}/>
              </Field>
              <Field label="Mini-box 2">
                <TextInput placeholder="Ex: Tratamento" value={form.previewBox2} onChange={upd("previewBox2")}/>
              </Field>
            </div>
          </div>

          <div style={{padding: 16, background:"var(--bg)", borderRadius: 12, border:"1px dashed var(--line-strong)", marginBottom: 14}}>
            <div style={{fontSize: 13, fontWeight: 700, color:"var(--fg)", marginBottom: 10}}>
              Questionário (opcional)
              <span style={{fontSize: 11, color:"var(--muted)", fontWeight: 400, marginLeft: 8}}>JSON ou TSX com perguntas gerado pelo Claude</span>
            </div>
            {!quizPreview ? (
              <label style={{display:"flex", alignItems:"center", gap: 10, padding:"12px 14px", borderRadius: 10, border:"1.5px dashed var(--line-strong)", cursor:"pointer", background:"var(--surface)"}}>
                <input ref={quizFileRef} type="file" accept="application/json,.json" style={{display:"none"}} onChange={e=>handleQuizFile(e.target.files[0])}/>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>
                <span style={{fontSize: 13.5, color:"var(--muted)"}}>Clique para escolher .json</span>
              </label>
            ) : (
              <div style={{display:"flex", alignItems:"center", gap: 12, padding:"12px 14px", background:"color-mix(in oklab, var(--acc-2) 18%, var(--bg))", borderRadius: 10, border:"1px solid var(--acc-2)"}}>
                <div style={{fontSize: 20}}>✓</div>
                <div style={{flex: 1}}>
                  <div style={{fontWeight: 600, fontSize: 13.5}}>{quizPreview.count} perguntas carregadas</div>
                  <div className="mono" style={{fontSize: 11, color:"var(--muted)"}}>{quizPreview.title} · JSON</div>
                </div>
                <button type="button" className="btn ghost" style={{padding: 6}} onClick={()=>{ setQuizJson(null); setQuizPreview(null); if (quizFileRef.current) quizFileRef.current.value=""; }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
            )}
            {quizErr && <div style={{fontSize: 12.5, color:"var(--primary)", fontWeight: 600, marginTop: 8}}>{quizErr}</div>}
          </div>

          <button type="submit" className="btn primary lg" disabled={busy} style={{width:"100%", justifyContent:"center", marginTop: 6, opacity: busy?.7:1}}>
            {busy ? "Publicando…" : "Publicar no catálogo →"}
          </button>
        </form>
      </div>

      {/* Right: Live preview */}
      <div style={{position:"sticky", top: 96, alignSelf:"flex-start"}}>
        <div className="mono" style={{fontSize: 11, textTransform:"uppercase", letterSpacing:".1em", color:"var(--muted)", marginBottom: 10}}>
          Prévia ao vivo
        </div>
        <UploadPreview form={form}/>
        <div style={{marginTop: 18, padding: 16, background:"var(--bg)", borderRadius: 12, border:"1px dashed var(--line-strong)", fontSize: 12.5, color:"var(--muted)", lineHeight: 1.5}}>
          <b style={{color:"var(--fg)"}}>PDF de verdade:</b> arquivos são enviados pro bucket <span className="mono">resumos</span> (privado) e servidos por <span className="mono">signed URLs</span> de 1h. Só quem comprou consegue ler.
        </div>
      </div>
    </div>
  );
}

function UploadPreview({ form }){
  const area = AREAS.find(a=>a.id===form.area) || AREAS[0];
  const I = ILLU_FOR_AREA[area.id];
  const r = {
    title: form.title || "Título do resumo",
    area: form.area,
    pages: parseInt(form.pages) || 30,
    topics: form.topics.split(",").map(t=>t.trim()).filter(Boolean),
    preview: {
      section:   form.previewSection,
      highlight: form.previewHighlight,
      box1:      form.previewBox1,
      box2:      form.previewBox2,
    },
  };
  return <ProductPagePreview r={r} area={area} I={I}/>;
}

// ─────────── Products (existing) ───────────
function AdminProducts({ go }){
  const [products, setProducts] = useStateAdmin([]);
  const [loading, setLoading] = useStateAdmin(true);
  const [editing, setEditing] = useStateAdmin(null);
  const [editingQuiz, setEditingQuiz] = useStateAdmin(null);
  const [confirmDelete, setConfirmDelete] = useStateAdmin(null); // { id, title }
  const [deleting, setDeleting] = useStateAdmin(false);
  const [deleteErr, setDeleteErr] = useStateAdmin("");

  const reload = () => fetchProducts().then(p => setProducts(p)).catch(err => console.error("[admin/products reload]", err));

  useEffectAdmin(()=>{
    let mounted = true;
    fetchProducts()
      .then(p => { if (mounted){ setProducts(p); setLoading(false); }})
      .catch(err => { console.error("[admin/products]", err); if (mounted) setLoading(false); });
    return ()=>{ mounted = false; };
  }, []);

  const remove = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    setDeleteErr("");
    const r = await deleteProduct(confirmDelete.id);
    setDeleting(false);
    if (r.error){ setDeleteErr(r.error); return; }
    setProducts(prev => prev.filter(p=>p.id!==confirmDelete.id));
    setConfirmDelete(null);
  };

  const onSaved = (updated) => {
    setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
    setEditing(null);
  };

  return (
    <div style={{marginTop: 28}}>
      <div className="row between" style={{marginBottom: 16}}>
        <div className="display" style={{fontSize: 20, fontWeight: 700}}>
          {loading ? "Carregando…" : `${products.length} resumos publicados`}
        </div>
        {!loading && products.length === 0 && (
          <button className="btn" onClick={reload} style={{fontSize: 13}}>
            Recarregar
          </button>
        )}
      </div>
      <div className="card" style={{padding: 0, overflow:"hidden"}}>
        {loading ? (
          <div style={{padding: 60, display:"flex", justifyContent:"center"}}><Spinner/></div>
        ) : (
        <table style={{width:"100%", borderCollapse:"collapse", fontSize: 14}}>
          <thead>
            <tr style={{textAlign:"left", color:"var(--muted)", fontSize: 11, textTransform:"uppercase", letterSpacing:".08em"}}>
              <th style={th()}>Resumo</th>
              <th style={th()}>Área</th>
              <th style={{...th(), textAlign:"right"}}>Páginas</th>
              <th style={{...th(), textAlign:"right"}}>Preço</th>
              <th style={th()}>Atualizado</th>
              <th style={{...th(), textAlign:"right"}}></th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => {
              const area = AREAS.find(a=>a.id===p.area);
              const I = ILLU_FOR_AREA[p.area] || Illu.Cross;
              return (
                <tr key={p.id} style={{borderTop:"1px solid var(--line)"}}>
                  <td style={td()}>
                    <div className="row" style={{gap: 12}}>
                      <I size={32}/>
                      <div>
                        <div style={{fontWeight: 600}}>{p.title}</div>
                        <div className="row" style={{gap: 6, marginTop: 3, flexWrap:"wrap"}}>
                          {p._custom && <div className="mono" style={{fontSize: 10, color:"var(--acc-2)"}}>★ Adicionado por você</div>}
                          {p.quiz_json?.questions?.length > 0 && <div className="mono" style={{fontSize: 10, color:"var(--acc-3)"}}>✓ {p.quiz_json.questions.length} perguntas</div>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={td()}><span className="pill">{area?.name || p.area}</span></td>
                  <td style={{...td(), textAlign:"right"}} className="mono">{p.pages}</td>
                  <td style={{...td(), textAlign:"right", fontWeight: 700}}>R$ {p.price}</td>
                  <td style={td()} className="mono" >{p.updated}</td>
                  <td style={{...td(), textAlign:"right"}}>
                    <div className="row" style={{gap: 4, justifyContent:"flex-end"}}>
                      <IconBtn title="Abrir no leitor" onClick={()=>go({name:"reader", id:p.id})}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                      </IconBtn>
                      {p.quiz_json?.questions?.length > 0 && (
                        <IconBtn title="Editar imagens do quiz" onClick={()=>setEditingQuiz(p)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                        </IconBtn>
                      )}
                      <IconBtn title="Editar" onClick={()=>setEditing(p)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </IconBtn>
                      <IconBtn title="Ver na loja" onClick={()=>go({name:"product", id:p.id})}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      </IconBtn>
                      <IconBtn title="Remover" onClick={()=>{ setConfirmDelete({id:p.id, title:p.title}); setDeleteErr(""); }} danger>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </IconBtn>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        )}
      </div>
      {editing && <EditProductModal product={editing} onClose={()=>setEditing(null)} onSaved={onSaved}/>}
      {editingQuiz && <QuizEditorModal product={editingQuiz} onClose={()=>setEditingQuiz(null)} onSaved={(updated)=>{ setProducts(ps=>ps.map(p=>p.id===updated.id?{...p,quiz_json:updated.quiz_json}:p)); setEditingQuiz(null); }}/>}

      {confirmDelete && (
        <div style={{position:"fixed", inset:0, zIndex:200, background:"rgba(0,0,0,.45)", backdropFilter:"blur(4px)", WebkitBackdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px"}}
          onClick={(e)=>{ if (e.target===e.currentTarget && !deleting) setConfirmDelete(null); }}>
          <div style={{background:"var(--surface)", borderRadius:"var(--radius-lg)", border:"1px solid var(--line)", boxShadow:"var(--shadow-pop)", width:"100%", maxWidth:440, padding:28, animation:"pageIn .2s cubic-bezier(.2,.7,.1,1)"}}>
            <div style={{width:44, height:44, borderRadius:12, background:"color-mix(in oklab, var(--primary) 12%, var(--surface))", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:16}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </div>
            <div className="display" style={{fontSize:20, fontWeight:700, marginBottom:6}}>Ocultar resumo?</div>
            <div style={{fontSize:14, color:"var(--muted)", lineHeight:1.6, marginBottom:6}}>
              <b style={{color:"var(--fg)"}}>{confirmDelete.title}</b> vai desaparecer do catálogo.
            </div>
            <div style={{fontSize:13, color:"var(--muted)", lineHeight:1.6, marginBottom:20}}>
              O arquivo não é deletado — quem já comprou continua acessando normalmente.
            </div>
            {deleteErr && (
              <div style={{padding:"10px 14px", borderRadius:10, background:"color-mix(in oklab, var(--primary) 10%, var(--bg))", border:"1px solid var(--primary)", fontSize:13, color:"var(--primary)", fontWeight:600, marginBottom:16}}>
                {deleteErr}
              </div>
            )}
            <div className="row" style={{gap:10, justifyContent:"flex-end"}}>
              <button className="btn" onClick={()=>setConfirmDelete(null)} disabled={deleting}>Cancelar</button>
              <button className="btn primary" onClick={remove} disabled={deleting} style={{opacity:deleting?.7:1}}>
                {deleting ? "Ocultando…" : "Sim, ocultar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IconBtn({ children, onClick, title, danger }){
  return (
    <button
      onClick={onClick} title={title} aria-label={title}
      style={{
        width: 32, height: 32, borderRadius: 8,
        border:"1px solid var(--line)", background:"var(--surface)",
        color: danger ? "var(--primary)" : "var(--fg)",
        display:"inline-flex", alignItems:"center", justifyContent:"center",
        cursor:"pointer", fontFamily:"inherit", transition:"all .12s ease",
      }}
      onMouseEnter={e=>{ e.currentTarget.style.background = danger ? "color-mix(in oklab, var(--primary) 12%, var(--surface))" : "var(--bg)"; e.currentTarget.style.borderColor = "var(--line-strong)"; }}
      onMouseLeave={e=>{ e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.borderColor = "var(--line)"; }}
    >
      {children}
    </button>
  );
}

// ─────────── History ───────────
function AdminHistory(){
  const [query, setQuery] = useStateAdmin("");
  const [areaFilter, setAreaFilter] = useStateAdmin("all");
  const [sales, setSales] = useStateAdmin([]);
  const [loading, setLoading] = useStateAdmin(true);

  useEffectAdmin(()=>{
    let mounted = true;
    fetchAllSales()
      .then(s => { if (mounted){ setSales(s); setLoading(false); }})
      .catch(err => { console.error("[admin/history]", err); if (mounted) setLoading(false); });
    return ()=>{ mounted = false; };
  }, []);

  const rows = useMemoAdmin(()=>{
    return sales.filter(r=>{
      if (areaFilter !== "all" && r.product_area !== areaFilter) return false;
      if (query){
        const q = query.toLowerCase();
        return (r.user_name||"").toLowerCase().includes(q)
            || (r.user_email||"").toLowerCase().includes(q)
            || (r.product_title||"").toLowerCase().includes(q);
      }
      return true;
    });
  }, [sales, query, areaFilter]);

  const totalRev = rows.reduce((s,r)=>s+(r.price||0), 0);

  const fmt = (d) => {
    const dt = new Date(d);
    return dt.toLocaleDateString("pt-BR",{day:"2-digit",month:"short",year:"numeric"}) + " · " + dt.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
  };

  return (
    <div style={{marginTop: 28}}>
      <div className="row between" style={{flexWrap:"wrap", gap: 12, marginBottom: 16}}>
        <div>
          <div className="display" style={{fontSize: 20, fontWeight: 700}}>Histórico de compras</div>
          <div style={{color:"var(--muted)", fontSize: 13.5, marginTop: 4}}>
            {loading ? "Carregando…" : <>{rows.length} {rows.length===1?"venda":"vendas"} · receita filtrada: <b style={{color:"var(--fg)"}}>R$ {totalRev}</b></>}
          </div>
        </div>
        <div className="row" style={{gap: 10}}>
          <div style={{position:"relative"}}>
            <svg style={{position:"absolute", left: 14, top: "50%", transform:"translateY(-50%)", opacity:.5}} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            <input
              value={query} onChange={e=>setQuery(e.target.value)}
              placeholder="Buscar cliente, email ou resumo..."
              style={{padding:"10px 14px 10px 36px", borderRadius: 999, border:"1px solid var(--line)", background:"var(--surface)", color:"var(--fg)", fontFamily:"inherit", fontSize: 13.5, width: 280, outline:"none"}}
            />
          </div>
          <select value={areaFilter} onChange={e=>setAreaFilter(e.target.value)} style={{padding:"10px 14px", borderRadius: 999, border:"1px solid var(--line)", background:"var(--surface)", color:"var(--fg)", fontFamily:"inherit", fontSize: 13.5, cursor:"pointer"}}>
            <option value="all">Todas as áreas</option>
            {AREAS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      </div>

      <div className="card" style={{padding: 0, overflow:"hidden"}}>
        {loading ? (
          <div style={{padding: 60, display:"flex", justifyContent:"center"}}><Spinner/></div>
        ) : rows.length === 0 ? (
          <div style={{padding: 60, textAlign:"center", color:"var(--muted)"}}>Nenhuma venda encontrada.</div>
        ) : (
        <table style={{width:"100%", borderCollapse:"collapse", fontSize: 14}}>
          <thead>
            <tr style={{textAlign:"left", color:"var(--muted)", fontSize: 11, textTransform:"uppercase", letterSpacing:".08em", background:"var(--bg)"}}>
              <th style={th()}>Cliente</th>
              <th style={th()}>Resumo</th>
              <th style={th()}>Data</th>
              <th style={th()}>Pagamento</th>
              <th style={th()}>Cupom</th>
              <th style={{...th(), textAlign:"right"}}>Valor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} style={{borderTop:"1px solid var(--line)"}}>
                <td style={td()}>
                  <div className="row" style={{gap: 12}}>
                    <div style={{width: 32, height: 32, borderRadius: 999, background:"var(--acc-3)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight: 700, fontSize: 13, color:"var(--fg)"}}>{(r.user_name||"—")[0]?.toUpperCase()}</div>
                    <div>
                      <div style={{fontWeight: 600}}>{r.user_name || "—"}</div>
                      <div className="mono" style={{fontSize: 12, color:"var(--muted)"}}>{r.user_email || "—"}</div>
                    </div>
                  </div>
                </td>
                <td style={td()}>{r.product_title}</td>
                <td style={td()} className="mono">{fmt(r.created_at)}</td>
                <td style={td()}><span className="pill">{r.method}</span></td>
                <td style={td()}>
                  {r.discount_code ? (
                    <div>
                      <span className="mono" style={{fontSize: 12, fontWeight: 600, background:"color-mix(in oklab, var(--acc-2) 30%, var(--bg))", padding:"2px 7px", borderRadius: 6, color:"var(--fg)"}}>{r.discount_code}</span>
                      {r.discount_amount > 0 && <div style={{fontSize: 11, color:"var(--primary)", marginTop: 3}}>- R$ {r.discount_amount}</div>}
                    </div>
                  ) : <span style={{color:"var(--muted)"}}>—</span>}
                </td>
                <td style={{...td(), textAlign:"right", fontWeight: 700}}>R$ {r.price}</td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}

function th(){ return { padding:"14px 18px", fontWeight: 600 }; }
function td(){ return { padding:"14px 18px", verticalAlign:"middle" }; }
function iStyle(){ return { padding:"11px 13px", borderRadius: 10, border:"1px solid var(--line-strong)", background:"var(--bg)", color:"var(--fg)", fontSize: 14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }; }

function Tip({ text }){
  const [show, setShow] = useStateAdmin(false);
  return (
    <span style={{position:"relative", display:"inline-flex", verticalAlign:"middle", marginLeft: 5}}>
      <span
        onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)}
        onFocus={()=>setShow(true)} onBlur={()=>setShow(false)}
        tabIndex={0}
        style={{
          width: 15, height: 15, borderRadius: "50%",
          background: "var(--line-strong)", color: "var(--muted)",
          fontSize: 10, fontWeight: 700, display: "inline-flex",
          alignItems: "center", justifyContent: "center",
          cursor: "help", userSelect: "none", flexShrink: 0,
        }}
      >?</span>
      {show && (
        <span style={{
          position: "absolute", bottom: "calc(100% + 7px)", left: "50%",
          transform: "translateX(-50%)",
          background: "var(--fg)", color: "var(--bg)",
          fontSize: 12, lineHeight: 1.45, fontWeight: 400,
          padding: "9px 13px", borderRadius: 9,
          width: 230, whiteSpace: "normal",
          zIndex: 300, pointerEvents: "none",
          boxShadow: "0 6px 24px rgba(0,0,0,.25)",
          textTransform: "none", letterSpacing: "normal",
        }}>
          {text}
          <span style={{
            position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)",
            border: "5px solid transparent", borderTopColor: "var(--fg)",
          }}/>
        </span>
      )}
    </span>
  );
}

// ─────────── Quiz Editor Modal ───────────
function QuizEditorModal({ product, onClose, onSaved }){
  const [questions, setQuestions] = useStateAdmin(() => JSON.parse(JSON.stringify(product.quiz_json?.questions || [])));
  const [uploading, setUploading] = useStateAdmin({}); // { [idx]: true }
  const [uploadErr, setUploadErr] = useStateAdmin({});
  const [saving, setSaving] = useStateAdmin(false);
  const [saveErr, setSaveErr] = useStateAdmin("");

  useEffectAdmin(()=>{
    const k = (e)=>{ if (e.key==="Escape" && !saving) onClose(); };
    document.addEventListener("keydown", k);
    return ()=>document.removeEventListener("keydown", k);
  }, [saving]);

  const handleImageFile = async (idx, file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")){ setUploadErr(e=>({...e,[idx]:"Apenas imagens (JPG, PNG, WebP)."})); return; }
    if (file.size > 8 * 1024 * 1024){ setUploadErr(e=>({...e,[idx]:"Máximo 8MB por imagem."})); return; }
    setUploadErr(e=>({...e,[idx]:""}));
    setUploading(u=>({...u,[idx]:true}));
    const r = await uploadQuizImage(product.id, questions[idx].id ?? (idx+1), file);
    setUploading(u=>({...u,[idx]:false}));
    if (r.error){ setUploadErr(e=>({...e,[idx]:"Erro: "+r.error})); return; }
    setQuestions(qs => qs.map((q,i) => i===idx ? {...q, imageUrl: r.url} : q));
  };

  const removeImage = (idx) => setQuestions(qs => qs.map((q,i) => { if(i!==idx) return q; const {imageUrl,...rest}=q; return rest; }));

  const save = async () => {
    setSaving(true); setSaveErr("");
    const newQuiz = { ...product.quiz_json, questions };
    const r = await saveQuizJson(product.id, newQuiz);
    setSaving(false);
    if (r.error){ setSaveErr("Erro ao salvar: "+r.error); return; }
    onSaved({ ...product, quiz_json: newQuiz });
  };

  return (
    <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,.45)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"40px 20px",overflowY:"auto",animation:"pageIn .2s ease"}}
      onClick={(e)=>{ if(e.target===e.currentTarget && !saving) onClose(); }}>
      <div style={{background:"var(--surface)",borderRadius:"var(--radius-lg)",border:"1px solid var(--line)",boxShadow:"var(--shadow-pop)",width:"100%",maxWidth:700,overflow:"hidden",animation:"pageIn .25s cubic-bezier(.2,.7,.1,1)"}}>

        {/* Header */}
        <div style={{padding:"20px 28px 14px",borderBottom:"1px solid var(--line)",display:"flex",alignItems:"center",justifyContent:"space-between",gap:16}}>
          <div>
            <div className="mono" style={{fontSize:11,textTransform:"uppercase",letterSpacing:".1em",color:"var(--primary)",marginBottom:4}}>Imagens do questionário</div>
            <div className="display" style={{fontSize:20,fontWeight:700,lineHeight:1.15}}>{product.quiz_json?.title || product.title}</div>
            <div style={{fontSize:13,color:"var(--muted)",marginTop:3}}>{questions.length} perguntas</div>
          </div>
          <button onClick={()=>!saving&&onClose()} style={{width:34,height:34,borderRadius:999,border:"1px solid var(--line)",background:"var(--bg)",color:"var(--fg)",display:"inline-flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Question list */}
        <div style={{padding:"16px 28px",display:"flex",flexDirection:"column",gap:10,maxHeight:"60vh",overflowY:"auto"}}>
          {questions.map((q, idx) => (
            <div key={idx} style={{display:"flex",alignItems:"flex-start",gap:14,padding:"14px 16px",borderRadius:12,border:"1px solid var(--line)",background:"var(--bg)"}}>

              {/* Question number + text */}
              <div style={{width:28,height:28,borderRadius:8,background:"var(--surface)",border:"1px solid var(--line-strong)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--font-mono)",fontSize:11,fontWeight:700,color:"var(--muted)",flexShrink:0}}>
                {idx+1}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13.5,fontWeight:600,lineHeight:1.45,color:"var(--fg)",overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>
                  {q.text}
                </div>

                {/* Image preview or upload */}
                <div style={{marginTop:10}}>
                  {q.imageUrl ? (
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <img src={q.imageUrl} alt="" style={{width:80,height:54,objectFit:"cover",borderRadius:8,border:"1px solid var(--line)",flexShrink:0}}
                        onError={e=>{ e.target.style.display="none"; }}/>
                      <div style={{display:"flex",flexDirection:"column",gap:5}}>
                        <label style={{cursor:"pointer"}}>
                          <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleImageFile(idx, e.target.files[0])} disabled={uploading[idx]}/>
                          <span className="btn" style={{fontSize:11,padding:"4px 10px",display:"inline-block"}}>
                            {uploading[idx] ? "Enviando…" : "Substituir"}
                          </span>
                        </label>
                        <button type="button" className="btn" onClick={()=>removeImage(idx)} style={{fontSize:11,padding:"4px 10px",color:"var(--primary)",borderColor:"var(--primary)"}}>Remover</button>
                      </div>
                    </div>
                  ) : (
                    <label style={{display:"inline-flex",alignItems:"center",gap:7,padding:"7px 12px",borderRadius:8,border:"1.5px dashed var(--line-strong)",cursor:"pointer",background:"var(--surface)",fontSize:12.5,color:"var(--muted)"}}>
                      <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleImageFile(idx, e.target.files[0])} disabled={uploading[idx]}/>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                      {uploading[idx] ? "Enviando…" : "Adicionar imagem"}
                    </label>
                  )}
                  {uploadErr[idx] && <div style={{fontSize:12,color:"var(--primary)",marginTop:5,fontWeight:600}}>{uploadErr[idx]}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{padding:"14px 28px 20px",borderTop:"1px solid var(--line)",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
          {saveErr ? <div style={{fontSize:12.5,color:"var(--primary)",fontWeight:600}}>{saveErr}</div> : <div style={{fontSize:13,color:"var(--muted)"}}>Imagens são salvas no Supabase Storage e ficam públicas.</div>}
          <div className="row" style={{gap:8,flexShrink:0}}>
            <button type="button" className="btn" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="button" className="btn primary" onClick={save} disabled={saving} style={{opacity:saving?.7:1}}>
              {saving ? "Salvando…" : "Salvar alterações"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────── Edit Product Modal ───────────
function EditProductModal({ product, onClose, onSaved }){
  const fileRef = useRefAdmin(null);
  const pv = product.preview || {};
  const [form, setForm] = useStateAdmin({
    title: product.title || "",
    area: product.area || "cardio",
    price: product.price ?? 39,
    pages: product.pages ?? 30,
    topics: (product.topics || []).join(", "),
    previewSection:   pv.section   || "",
    previewHighlight: pv.highlight || "",
    previewBox1:      pv.box1      || "",
    previewBox2:      pv.box2      || "",
  });
  const [newFile, setNewFile] = useStateAdmin(null);
  const [dragOver, setDragOver] = useStateAdmin(false);
  const [err, setErr] = useStateAdmin("");
  const [busy, setBusy] = useStateAdmin(false);
  const [quizJson, setQuizJson] = useStateAdmin(product.quiz_json || null);
  const [quizErr, setQuizErr] = useStateAdmin("");
  const editQuizRef = useRefAdmin(null);

  const handleQuizFile = (f) => {
    if (!f) return;
    setQuizErr("");
    const ext = f.name.split(".").pop().toLowerCase();
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target.result;
      if (ext === "json") {
        try {
          const parsed = JSON.parse(content);
          if (!Array.isArray(parsed.questions) || parsed.questions.length === 0){
            setQuizErr("JSON inválido: precisa ter 'questions' com ao menos 1 item."); return;
          }
          const bad = parsed.questions.find(q => !q.options || !q.correct || !q.explanation);
          if (bad){ setQuizErr("Pergunta inválida: cada item precisa ter 'options', 'correct' e 'explanation'."); return; }
          setQuizJson(parsed);
        } catch { setQuizErr("Arquivo não é um JSON válido."); }
      } else {
        setQuizErr("Formato não suportado. Use .json");
      }
    };
    reader.readAsText(f, "UTF-8");
  };

  // Close on Esc
  useEffectAdmin(()=>{
    const k = (e)=>{ if (e.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", k);
    return ()=> document.removeEventListener("keydown", k);
  }, [busy]);

  const upd = k => e => setForm({...form, [k]: e.target.value});

  const handleFile = (f) => {
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")){
      setErr("Apenas arquivos PDF são aceitos."); return;
    }
    if (f.size > 100 * 1024 * 1024){
      setErr("Máximo 100MB."); return;
    }
    setErr("");
    setNewFile(f);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()){ setErr("Título é obrigatório."); return; }
    setBusy(true);
    setErr("");
    const topics = form.topics.split(",").map(t=>t.trim()).filter(Boolean).slice(0,4);
    const preview = {
      section:   form.previewSection.trim()   || null,
      highlight: form.previewHighlight.trim() || null,
      box1:      form.previewBox1.trim()      || null,
      box2:      form.previewBox2.trim()      || null,
    };
    const r = await updateProduct(product.id, {
      title: form.title,
      area: form.area,
      price: form.price,
      pages: form.pages,
      topics,
      preview,
      quiz_json: quizJson,
    }, newFile);
    setBusy(false);
    if (r.error){ setErr("Falha ao salvar: " + r.error); return; }
    onSaved(r.product);
  };

  const hasFile = !!product.file_path;
  const willReplace = !!newFile;

  return (
    <div style={{
      position:"fixed", inset: 0, zIndex: 200,
      background:"rgba(0,0,0,.45)",
      backdropFilter:"blur(4px)", WebkitBackdropFilter:"blur(4px)",
      display:"flex", alignItems:"flex-start", justifyContent:"center",
      padding:"40px 20px", overflowY:"auto",
      animation:"pageIn .2s ease",
    }}
      onClick={(e)=>{ if (e.target === e.currentTarget && !busy) onClose(); }}
    >
      <div style={{
        background:"var(--surface)", borderRadius:"var(--radius-lg)",
        border:"1px solid var(--line)", boxShadow:"var(--shadow-pop)",
        width:"100%", maxWidth: 680, padding: 0, overflow:"hidden",
        animation:"pageIn .25s cubic-bezier(.2,.7,.1,1)",
      }}>
        {/* Header */}
        <div style={{padding:"22px 28px 14px", borderBottom:"1px solid var(--line)", display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap: 16}}>
          <div>
            <div className="mono" style={{fontSize: 11, textTransform:"uppercase", letterSpacing:".1em", color:"var(--primary)", marginBottom: 6}}>
              Editando resumo
            </div>
            <div className="display" style={{fontSize: 22, fontWeight: 700, lineHeight: 1.15}}>
              {product.title}
            </div>
            <div className="mono" style={{fontSize: 11, color:"var(--muted)", marginTop: 4}}>
              ID: {product.id}
            </div>
          </div>
          <button onClick={()=>!busy && onClose()} disabled={busy} aria-label="Fechar" style={{
            width: 36, height: 36, borderRadius: 999, border:"1px solid var(--line)", background:"var(--bg)",
            color:"var(--fg)", display:"inline-flex", alignItems:"center", justifyContent:"center", cursor:"pointer",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={submit} style={{padding:"22px 28px 26px"}}>
          <Field label="Título do resumo">
            <TextInput required value={form.title} onChange={upd("title")}/>
          </Field>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap: 12}}>
            <Field label="Especialidade">
              <select value={form.area} onChange={upd("area")} style={selectStyle()}>
                {AREAS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
            <Field label="Páginas">
              <TextInput type="number" min="1" required value={form.pages} onChange={upd("pages")}/>
            </Field>
            <Field label="Preço (R$)">
              <TextInput type="number" min="0" required value={form.price} onChange={upd("price")}/>
            </Field>
          </div>
          <Field label="Tópicos" hint="Separe por vírgula. Até 4.">
            <TextInput value={form.topics} onChange={upd("topics")}/>
          </Field>

          <div style={{padding: 14, background:"var(--bg)", borderRadius: 12, border:"1px dashed var(--line-strong)", marginBottom: 14}}>
            <div style={{fontSize: 13, fontWeight: 700, color:"var(--fg)", marginBottom: 12}}>
              Prévia do produto
              <span style={{fontSize: 11, color:"var(--muted)", fontWeight: 400, marginLeft: 8}}>mockup na página</span>
            </div>
            <Field label="Seção em destaque" hint="Heading em serif no mockup. Padrão: 1º tópico.">
              <TextInput placeholder="Ex: Diagnóstico" value={form.previewSection} onChange={upd("previewSection")}/>
            </Field>
            <Field label='Texto "Cai na prova"' hint="Box amarelo. Deixe vazio para exibir linhas simuladas.">
              <textarea
                value={form.previewHighlight} onChange={upd("previewHighlight")}
                placeholder={'Ex: NYHA é funcional e pode mudar. Stage A-D (ACC/AHA) é estrutural e só progride.'}
                style={{padding:"13px 14px", borderRadius: 12, border:"1px solid var(--line-strong)", background:"var(--surface)", color:"var(--fg)", fontSize: 14, fontFamily:"inherit", outline:"none", resize:"vertical", minHeight: 72, lineHeight: 1.5, width:"100%", boxSizing:"border-box"}}
              />
            </Field>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap: 12}}>
              <Field label="Mini-box 1">
                <TextInput placeholder="Ex: Diagnóstico" value={form.previewBox1} onChange={upd("previewBox1")}/>
              </Field>
              <Field label="Mini-box 2">
                <TextInput placeholder="Ex: Tratamento" value={form.previewBox2} onChange={upd("previewBox2")}/>
              </Field>
            </div>
          </div>

          {/* PDF replacement */}
          <Field label="Arquivo PDF" hint={hasFile ? "Há um PDF associado. Envie outro pra substituir, ou deixe em branco pra manter." : "Nenhum PDF associado ainda. Envie um pra disponibilizar no leitor."}>
            {!willReplace ? (
              <div
                onDragOver={e=>{ e.preventDefault(); setDragOver(true); }}
                onDragLeave={()=>setDragOver(false)}
                onDrop={e=>{ e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
                onClick={()=>fileRef.current?.click()}
                style={{
                  border:"1.5px dashed " + (dragOver ? "var(--primary)" : "var(--line-strong)"),
                  borderRadius: 10, padding: 16, cursor:"pointer", background:"var(--bg)",
                  display:"flex", alignItems:"center", gap: 12, transition:"all .15s ease",
                }}
              >
                <input ref={fileRef} type="file" accept="application/pdf" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
                <div style={{width: 36, height: 44, borderRadius: 5, background: hasFile ? "var(--acc-2)" : "var(--line)", color:"var(--fg)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", fontFamily:"var(--font-mono)", fontWeight: 700, fontSize: 10}}>
                  PDF
                </div>
                <div style={{flex: 1, fontSize: 13.5}}>
                  {hasFile ? (
                    <>
                      <div style={{fontWeight: 600}}>{product.file_name || product.file_path}</div>
                      <div className="mono" style={{fontSize: 11, color:"var(--muted)"}}>arquivo atual · clique pra substituir</div>
                    </>
                  ) : (
                    <>
                      <div style={{fontWeight: 600}}>Nenhum arquivo</div>
                      <div className="mono" style={{fontSize: 11, color:"var(--muted)"}}>clique ou arraste um PDF aqui</div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div style={{display:"flex", alignItems:"center", gap: 12, padding: 14, background:"color-mix(in oklab, var(--acc-2) 18%, var(--bg))", borderRadius: 10, border:"1px solid var(--acc-2)"}}>
                <div style={{width: 36, height: 44, borderRadius: 5, background:"var(--primary)", color:"var(--primary-ink)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"var(--font-mono)", fontWeight: 700, fontSize: 10}}>NEW</div>
                <div style={{flex: 1}}>
                  <div style={{fontWeight: 600, fontSize: 14}}>{newFile.name}</div>
                  <div className="mono" style={{fontSize: 11, color:"var(--muted)"}}>{(newFile.size/1024/1024).toFixed(2)} MB · vai substituir o atual ao salvar</div>
                </div>
                <button type="button" onClick={()=>{ setNewFile(null); if (fileRef.current) fileRef.current.value=""; }} className="btn ghost" style={{padding: 8}} aria-label="Cancelar troca">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
            )}
          </Field>

          {/* Quiz section */}
          {(() => {
            const hasQuiz = !!quizJson;
            const quizLabel = quizJson
              ? `${quizJson.questions?.length || 0} perguntas · JSON · "${quizJson.title}"`
              : "Questionário JSON gerado pelo Claude. Deixe vazio para adicionar depois.";
            return (
              <Field label="Questionário" hint={quizLabel}>
                {hasQuiz ? (
                  <div style={{display:"flex", alignItems:"center", gap: 12, padding:"12px 14px", background:"color-mix(in oklab, var(--acc-2) 18%, var(--bg))", borderRadius: 10, border:"1px solid var(--acc-2)"}}>
                    <div style={{fontSize: 18}}>✓</div>
                    <div style={{flex: 1}}>
                      <div style={{fontWeight: 600, fontSize: 13.5}}>{quizJson.questions?.length || 0} perguntas</div>
                      <div className="mono" style={{fontSize: 11, color:"var(--muted)"}}>{quizJson.title} · JSON</div>
                    </div>
                    <label style={{cursor:"pointer"}}>
                      <input ref={editQuizRef} type="file" accept="application/json,.json" style={{display:"none"}} onChange={e=>handleQuizFile(e.target.files[0])}/>
                      <span className="btn" style={{fontSize: 12, padding:"6px 10px"}}>Substituir</span>
                    </label>
                    <button type="button" className="btn" onClick={()=>{ setQuizJson(null); if (editQuizRef.current) editQuizRef.current.value=""; }} style={{fontSize: 12, padding:"6px 10px", color:"var(--primary)", borderColor:"var(--primary)"}}>Remover</button>
                  </div>
                ) : (
                  <label style={{display:"flex", alignItems:"center", gap: 10, padding:"12px 14px", borderRadius: 10, border:"1.5px dashed var(--line-strong)", cursor:"pointer", background:"var(--bg)"}}>
                    <input ref={editQuizRef} type="file" accept="application/json,.json" style={{display:"none"}} onChange={e=>handleQuizFile(e.target.files[0])}/>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>
                    <span style={{fontSize: 13.5, color:"var(--muted)"}}>Clique para escolher .json</span>
                  </label>
                )}
                {quizErr && <div style={{fontSize: 12.5, color:"var(--primary)", fontWeight: 600, marginTop: 8}}>{quizErr}</div>}
              </Field>
            );
          })()}

          {err && (
            <div style={{padding: 12, background:"color-mix(in oklab, var(--primary) 12%, var(--bg))", borderRadius: 10, border:"1px solid var(--primary)", fontSize: 12.5, color:"var(--primary)", fontWeight: 600, marginBottom: 12, marginTop: 4}}>
              {err}
            </div>
          )}

          <div className="row" style={{gap: 10, marginTop: 18, justifyContent:"flex-end"}}>
            <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
            <button type="submit" className="btn primary" disabled={busy} style={{opacity: busy?.7:1}}>
              {busy ? "Salvando…" : "Salvar alterações"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function selectStyle(){
  return { padding:"13px 14px", borderRadius: 12, border:"1px solid var(--line-strong)", background:"var(--bg)", color:"var(--fg)", fontSize: 14.5, fontFamily:"inherit", cursor:"pointer", outline:"none" };
}

// ─────────── Users & activity ───────────
function AdminUsers(){
  const [users, setUsers] = useStateAdmin([]);
  const [loading, setLoading] = useStateAdmin(true);
  const [query, setQuery] = useStateAdmin("");
  const [filter, setFilter] = useStateAdmin("all"); // all | flagged | banned
  const [details, setDetails] = useStateAdmin(null);
  const [libraryUser, setLibraryUser] = useStateAdmin(null);
  const [resetDeviceUser, setResetDeviceUser] = useStateAdmin(null);

  const reload = async () => {
    setLoading(true);
    try {
      const u = await fetchUserActivity();
      setUsers(u);
    } catch (err) {
      console.error("[admin/users reload]", err);
    } finally {
      setLoading(false);
    }
  };
  useEffectAdmin(()=>{ reload(); }, []);

  const rows = useMemoAdmin(()=>{
    return users.filter(u=>{
      if (u.role === "admin") return false;
      if (filter === "flagged" && (u.high_events||0) === 0 && (u.warning_events||0) === 0) return false;
      if (filter === "banned" && !u.banned) return false;
      if (query){
        const q = query.toLowerCase();
        return (u.name||"").toLowerCase().includes(q) || (u.email||"").toLowerCase().includes(q);
      }
      return true;
    });
  }, [users, query, filter]);

  const toggleBan = async (u) => {
    if (u.banned){
      if (!confirm(`Remover banimento de ${u.name}?`)) return;
      const r = await setUserBan(u.id, false);
      if (r.error){ alert("Erro: " + r.error); return; }
    } else {
      const reason = prompt(`Banir ${u.name}? Descreva o motivo (aparece pro usuário ao tentar entrar):`, "Violação do termo de uso (vazamento de conteúdo)");
      if (reason === null) return;
      const r = await setUserBan(u.id, true, reason);
      if (r.error){ alert("Erro: " + r.error); return; }
    }
    await reload();
  };

  const fmt = (d) => d ? new Date(d).toLocaleDateString("pt-BR",{day:"2-digit",month:"short",year:"2-digit"}) : "—";

  const flaggedCount = users.filter(u => u.role !== "admin" && ((u.high_events||0) > 0 || (u.warning_events||0) > 2)).length;
  const bannedCount = users.filter(u => u.banned).length;

  return (
    <div style={{marginTop: 28}}>
      <div className="row between" style={{flexWrap:"wrap", gap: 12, marginBottom: 16}}>
        <div>
          <div className="display" style={{fontSize: 20, fontWeight: 700}}>Usuários & atividade</div>
          <div style={{color:"var(--muted)", fontSize: 13.5, marginTop: 4}}>
            {loading ? "Carregando…" : <>{rows.length} usuários · <span style={{color:"var(--primary)", fontWeight: 600}}>{flaggedCount} com atividade suspeita</span> · {bannedCount} banidos</>}
          </div>
        </div>
        <div className="row" style={{gap: 10}}>
          <div style={{position:"relative"}}>
            <svg style={{position:"absolute", left: 14, top: "50%", transform:"translateY(-50%)", opacity:.5}} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar nome ou email..." style={{padding:"10px 14px 10px 36px", borderRadius: 999, border:"1px solid var(--line)", background:"var(--surface)", color:"var(--fg)", fontFamily:"inherit", fontSize: 13.5, width: 260, outline:"none"}}/>
          </div>
          <select value={filter} onChange={e=>setFilter(e.target.value)} style={{padding:"10px 14px", borderRadius: 999, border:"1px solid var(--line)", background:"var(--surface)", color:"var(--fg)", fontFamily:"inherit", fontSize: 13.5, cursor:"pointer"}}>
            <option value="all">Todos</option>
            <option value="flagged">Só com atividade suspeita</option>
            <option value="banned">Só banidos</option>
          </select>
        </div>
      </div>

      <div className="card" style={{padding: 0, overflow:"hidden"}}>
        {loading ? (
          <div style={{padding: 60, display:"flex", justifyContent:"center"}}><Spinner/></div>
        ) : rows.length === 0 ? (
          <div style={{padding: 60, textAlign:"center", color:"var(--muted)"}}>Nenhum usuário encontrado.</div>
        ) : (
        <table style={{width:"100%", borderCollapse:"collapse", fontSize: 14}}>
          <thead>
            <tr style={{textAlign:"left", color:"var(--muted)", fontSize: 11, textTransform:"uppercase", letterSpacing:".08em", background:"var(--bg)"}}>
              <th style={th()}>Usuário</th>
              <th style={th()}>Status</th>
              <th style={{...th(), textAlign:"right"}}>Compras</th>
              <th style={{...th(), textAlign:"right"}}>Gasto</th>
              <th style={{...th(), textAlign:"center"}}>Atividade suspeita</th>
              <th style={th()}>Última atividade</th>
              <th style={{...th(), textAlign:"right"}}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(u => {
              const flagged = (u.high_events||0) > 0 || (u.warning_events||0) > 2;
              return (
                <tr key={u.id} style={{borderTop:"1px solid var(--line)", background: u.banned ? "color-mix(in oklab, var(--primary) 6%, transparent)" : undefined}}>
                  <td style={td()}>
                    <div className="row" style={{gap: 12}}>
                      <div style={{width: 32, height: 32, borderRadius: 999, background: u.banned ? "var(--primary)" : "var(--acc-3)", color: u.banned ? "var(--primary-ink)" : "var(--fg)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight: 700, fontSize: 13}}>{(u.name||"—")[0]?.toUpperCase()}</div>
                      <div>
                        <div style={{fontWeight: 600, textDecoration: u.banned ? "line-through" : "none"}}>{u.name}</div>
                        <div className="mono" style={{fontSize: 12, color:"var(--muted)"}}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={td()}>
                    {u.banned ? (
                      <span className="pill" style={{background:"var(--primary)", color:"var(--primary-ink)", borderColor:"var(--primary)"}}>BANIDO</span>
                    ) : flagged ? (
                      <span className="pill" style={{background:"var(--acc-1)", borderColor:"transparent", color:"var(--fg)"}}>⚠ Suspeito</span>
                    ) : (
                      <span className="pill" style={{color:"var(--muted)"}}>Normal</span>
                    )}
                  </td>
                  <td style={{...td(), textAlign:"right"}} className="mono">{u.purchase_count || 0}</td>
                  <td style={{...td(), textAlign:"right", fontWeight: 700}}>R$ {u.total_spent || 0}</td>
                  <td style={{...td(), textAlign:"center"}}>
                    <div className="row" style={{gap: 4, justifyContent:"center", alignItems:"center"}}>
                      <Counter n={u.high_events||0} kind="high"/>
                      <Counter n={u.warning_events||0} kind="warning"/>
                      <Counter n={u.total_events||0} kind="info"/>
                    </div>
                  </td>
                  <td style={td()} className="mono">{fmt(u.last_event_at)}</td>
                  <td style={{...td(), textAlign:"right"}}>
                    <div className="row" style={{gap: 4, justifyContent:"flex-end"}}>
                      <IconBtn title="Gerenciar biblioteca" onClick={()=>setLibraryUser(u)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                      </IconBtn>
                      <IconBtn title="Ver logs" onClick={()=>setDetails(u)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
                      </IconBtn>
                      <IconBtn title="Resetar dispositivo" onClick={()=>setResetDeviceUser(u)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18"/></svg>
                      </IconBtn>
                      <button onClick={()=>toggleBan(u)} className="btn" style={{padding:"6px 12px", fontSize: 12, background: u.banned ? "var(--acc-2)" : "var(--primary)", color: u.banned ? "var(--fg)" : "var(--primary-ink)", borderColor: u.banned ? "var(--acc-2)" : "var(--primary)"}}>
                        {u.banned ? "Desbanir" : "Banir"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        )}
      </div>

      {details && <UserLogsModal user={details} onClose={()=>setDetails(null)}/>}
      {libraryUser && <UserLibraryModal user={libraryUser} onClose={()=>setLibraryUser(null)}/>}
      {resetDeviceUser && <ResetDeviceModal user={resetDeviceUser} onClose={()=>setResetDeviceUser(null)}/>}
    </div>
  );
}

function ResetDeviceModal({ user, onClose }){
  const [busy, setBusy] = useStateAdmin(false);
  const [err, setErr] = useStateAdmin(null);
  const [done, setDone] = useStateAdmin(false);

  useEffectAdmin(()=>{
    const k = (e)=>{ if (e.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", k);
    return ()=>document.removeEventListener("keydown", k);
  }, [busy]);

  const confirmReset = async () => {
    setBusy(true);
    setErr(null);
    const r = await resetUserDevice(user.id);
    setBusy(false);
    if (r.error){ setErr(r.error); return; }
    setDone(true);
  };

  return (
    <div onClick={(e)=>{ if (e.target === e.currentTarget && !busy) onClose(); }}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex: 1000, padding: 20 }}>
      <div style={{ background:"var(--surface)", borderRadius:"var(--radius-lg)", boxShadow:"var(--shadow-pop)", padding: 28, width: 420, maxWidth:"100%" }}>
        {done ? (
          <>
            <div style={{ fontSize: 32, marginBottom: 10 }}>✓</div>
            <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 8 }}>Dispositivo resetado</div>
            <div style={{ fontSize: 13.5, color:"var(--muted)", lineHeight: 1.6, marginBottom: 20 }}>
              {user.name} já pode vincular um novo dispositivo na próxima vez que abrir um resumo.
            </div>
            <button className="btn primary" onClick={onClose} style={{ width:"100%" }}>Fechar</button>
          </>
        ) : (
          <>
            <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 8 }}>Resetar dispositivo?</div>
            <div style={{ fontSize: 13.5, color:"var(--muted)", lineHeight: 1.6, marginBottom: 20 }}>
              Tem certeza que vai reiniciar o dispositivo de <strong>{user.name}</strong> ({user.email})? O dispositivo atualmente vinculado será desvinculado e o usuário poderá linkar um novo na próxima abertura de resumo.
            </div>
            {err && <div style={{ fontSize: 13, color:"var(--primary)", marginBottom: 14 }}>Erro: {err}</div>}
            <div className="row" style={{ gap: 10, justifyContent:"flex-end" }}>
              <button className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
              <button className="btn primary" onClick={confirmReset} disabled={busy} style={{ opacity: busy ? .7 : 1 }}>
                {busy ? "Resetando…" : "Sim, resetar"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Counter({ n, kind }){
  if (!n) return <span style={{width: 28, height: 22, borderRadius: 6, background:"var(--bg)", display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize: 11, color:"var(--muted)", fontFamily:"var(--font-mono)"}}>0</span>;
  const colors = {
    high:    { bg:"var(--primary)", color:"var(--primary-ink)" },
    warning: { bg:"var(--acc-1)",   color:"var(--fg)" },
    info:    { bg:"var(--bg)",      color:"var(--muted)" },
  };
  const c = colors[kind] || colors.info;
  return (
    <span title={`${kind}: ${n}`} style={{width: 28, height: 22, borderRadius: 6, background: c.bg, color: c.color, display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize: 11, fontWeight: 700, fontFamily:"var(--font-mono)"}}>{n}</span>
  );
}

function UserLogsModal({ user, onClose }){
  const [logs, setLogs] = useStateAdmin([]);
  const [loading, setLoading] = useStateAdmin(true);

  useEffectAdmin(()=>{
    let mounted = true;
    fetchUserLogs(user.id, 100)
      .then(l => { if (mounted){ setLogs(l); setLoading(false); }})
      .catch(err => { console.error("[admin/userlogs]", err); if (mounted) setLoading(false); });
    const k = (e)=>{ if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", k);
    return ()=>{ mounted = false; document.removeEventListener("keydown", k); };
  }, [user.id]);

  const fmt = (d) => {
    const dt = new Date(d);
    return dt.toLocaleDateString("pt-BR",{day:"2-digit",month:"short"}) + " " + dt.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  };

  const eventLabel = (e) => {
    const labels = {
      open: "Abriu resumo", print_screen:"PrintScreen", print:"Tentou imprimir", copy:"Tentou copiar",
      save:"Tentou salvar", devtools:"Abriu DevTools", blur:"Saiu da aba/janela", context_menu:"Clicou com botão direito"
    };
    return labels[e] || e;
  };

  const sevDot = (s) => {
    const c = s === "high" ? "var(--primary)" : s === "warning" ? "var(--acc-1)" : "var(--muted)";
    return <span style={{width: 8, height: 8, borderRadius: 999, background: c, display:"inline-block", flex:"0 0 auto"}}/>;
  };

  return (
    <div style={{position:"fixed", inset: 0, zIndex: 200, background:"rgba(0,0,0,.45)", backdropFilter:"blur(4px)", display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"40px 20px", overflowY:"auto", animation:"pageIn .2s ease"}}
         onClick={(e)=>{ if (e.target === e.currentTarget) onClose(); }}>
      <div style={{background:"var(--surface)", borderRadius:"var(--radius-lg)", border:"1px solid var(--line)", boxShadow:"var(--shadow-pop)", width:"100%", maxWidth: 680, animation:"pageIn .25s cubic-bezier(.2,.7,.1,1)", overflow:"hidden"}}>
        <div style={{padding:"22px 28px 14px", borderBottom:"1px solid var(--line)", display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap: 16}}>
          <div>
            <div className="mono" style={{fontSize: 11, textTransform:"uppercase", letterSpacing:".1em", color:"var(--primary)", marginBottom: 6}}>Atividade do usuário</div>
            <div className="display" style={{fontSize: 22, fontWeight: 700}}>{user.name}</div>
            <div className="mono" style={{fontSize: 12, color:"var(--muted)", marginTop: 2}}>{user.email}</div>
          </div>
          <button onClick={onClose} aria-label="Fechar" style={{width: 36, height: 36, borderRadius: 999, border:"1px solid var(--line)", background:"var(--bg)", color:"var(--fg)", display:"inline-flex", alignItems:"center", justifyContent:"center", cursor:"pointer"}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div style={{maxHeight: "60vh", overflowY:"auto"}}>
          {loading ? (
            <div style={{padding: 40, display:"flex", justifyContent:"center"}}><Spinner size={40}/></div>
          ) : logs.length === 0 ? (
            <div style={{padding: 40, textAlign:"center", color:"var(--muted)"}}>Nenhuma atividade registrada.</div>
          ) : (
            <div style={{padding:"8px 0"}}>
              {logs.map(l => (
                <div key={l.id} className="row" style={{gap: 12, padding:"10px 28px", borderBottom:"1px solid var(--line)", alignItems:"center"}}>
                  {sevDot(l.severity)}
                  <div style={{flex: 1}}>
                    <div style={{fontWeight: 600, fontSize: 13.5}}>{eventLabel(l.event)}</div>
                    {l.product_id && <div className="mono" style={{fontSize: 11, color:"var(--muted)"}}>Resumo: {l.product_id}</div>}
                  </div>
                  <div className="mono" style={{fontSize: 11, color:"var(--muted)", whiteSpace:"nowrap"}}>{fmt(l.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{padding:"14px 28px", borderTop:"1px solid var(--line)", fontSize: 12, color:"var(--muted)", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
          <div>Últimos 100 eventos · severidade <span style={{color:"var(--primary)"}}>vermelho = alto</span>, <span style={{color:"var(--acc-1)"}}>amarelo = aviso</span></div>
          <button className="btn" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

// ─────────── User Library Modal ───────────
function UserLibraryModal({ user, onClose }){
  const [purchases, setPurchases] = useStateAdmin([]);
  const [products, setProducts] = useStateAdmin([]);
  const [loading, setLoading] = useStateAdmin(true);
  const [selectedId, setSelectedId] = useStateAdmin("");
  const [busy, setBusy] = useStateAdmin(false);
  const [err, setErr] = useStateAdmin("");
  const [revoking, setRevoking] = useStateAdmin(null); // purchaseId being revoked

  useEffectAdmin(()=>{
    let mounted = true;
    Promise.all([fetchUserPurchases(user.id), fetchProducts()])
      .then(([purch, prods]) => {
        if (!mounted) return;
        setPurchases(purch || []);
        setProducts(prods || []);
        setLoading(false);
      })
      .catch(err => { console.error("[library modal]", err); if (mounted) setLoading(false); });
    const k = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", k);
    return () => { mounted = false; document.removeEventListener("keydown", k); };
  }, [user.id]);

  const ownedIds = useMemoAdmin(() => new Set(purchases.map(p => p.product_id)), [purchases]);
  const available = useMemoAdmin(() => products.filter(p => !ownedIds.has(p.id)), [products, ownedIds]);

  const grant = async () => {
    if (!selectedId || busy) return;
    setBusy(true); setErr("");
    const prod = products.find(p => p.id === selectedId);
    const r = await adminGrantPurchase(user.id, prod);
    setBusy(false);
    if (r.error){ setErr(r.error); return; }
    setPurchases(prev => [r.purchase, ...prev]);
    setSelectedId("");
  };

  const revoke = async (purchaseId) => {
    setRevoking(purchaseId); setErr("");
    const r = await adminRevokePurchase(purchaseId);
    setRevoking(null);
    if (r.error){ setErr(r.error); return; }
    setPurchases(prev => prev.filter(p => p.id !== purchaseId));
  };

  const fmt = (d) => d ? new Date(d).toLocaleDateString("pt-BR", {day:"2-digit", month:"short", year:"numeric"}) : "—";

  return (
    <div style={{position:"fixed", inset:0, zIndex:200, background:"rgba(0,0,0,.45)", backdropFilter:"blur(4px)", WebkitBackdropFilter:"blur(4px)", display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"40px 20px", overflowY:"auto", animation:"pageIn .2s ease"}}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{background:"var(--surface)", borderRadius:"var(--radius-lg)", border:"1px solid var(--line)", boxShadow:"var(--shadow-pop)", width:"100%", maxWidth:600, overflow:"hidden", animation:"pageIn .25s cubic-bezier(.2,.7,.1,1)"}}>

        {/* Header */}
        <div style={{padding:"22px 28px 14px", borderBottom:"1px solid var(--line)", display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16}}>
          <div>
            <div className="mono" style={{fontSize:11, textTransform:"uppercase", letterSpacing:".1em", color:"var(--primary)", marginBottom:6}}>
              Gerenciar biblioteca
            </div>
            <div className="display" style={{fontSize:22, fontWeight:700, lineHeight:1.15}}>{user.name}</div>
            <div className="mono" style={{fontSize:12, color:"var(--muted)", marginTop:4}}>{user.email}</div>
          </div>
          <button onClick={onClose} aria-label="Fechar" style={{width:36, height:36, borderRadius:999, border:"1px solid var(--line)", background:"var(--bg)", color:"var(--fg)", display:"inline-flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Add resumo */}
        <div style={{padding:"18px 28px", borderBottom:"1px solid var(--line)", background:"var(--bg)"}}>
          <div style={{fontSize:13, fontWeight:700, marginBottom:10, color:"var(--fg)"}}>Adicionar resumo à biblioteca</div>
          <div className="row" style={{gap:10}}>
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              disabled={busy || loading}
              style={{flex:1, padding:"10px 14px", borderRadius:10, border:"1px solid var(--line-strong)", background:"var(--surface)", color: selectedId ? "var(--fg)" : "var(--muted)", fontFamily:"inherit", fontSize:14, cursor:"pointer", outline:"none"}}
            >
              <option value="">— Escolha um resumo —</option>
              {available.map(p => (
                <option key={p.id} value={p.id}>{p.title} · R$ {p.price}</option>
              ))}
            </select>
            <button
              className="btn primary"
              onClick={grant}
              disabled={!selectedId || busy}
              style={{whiteSpace:"nowrap", opacity:(!selectedId || busy) ? .5 : 1}}
            >
              {busy ? "Adicionando…" : "Adicionar"}
            </button>
          </div>
          {available.length === 0 && !loading && (
            <div style={{fontSize:12.5, color:"var(--muted)", marginTop:8}}>
              {products.length === 0 ? "Nenhum resumo publicado ainda." : "Este usuário já possui todos os resumos disponíveis."}
            </div>
          )}
          {err && (
            <div style={{marginTop:10, padding:"10px 14px", borderRadius:10, background:"color-mix(in oklab, var(--primary) 10%, var(--bg))", border:"1px solid var(--primary)", fontSize:13, color:"var(--primary)", fontWeight:600}}>
              {err}
            </div>
          )}
        </div>

        {/* Current library */}
        <div style={{maxHeight:"50vh", overflowY:"auto"}}>
          {loading ? (
            <div style={{padding:40, display:"flex", justifyContent:"center"}}><Spinner size={40}/></div>
          ) : purchases.length === 0 ? (
            <div style={{padding:40, textAlign:"center", color:"var(--muted)", fontSize:14}}>
              Biblioteca vazia — nenhum resumo adquirido ainda.
            </div>
          ) : (
            <>
              <div style={{padding:"12px 28px 6px", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:".08em", color:"var(--muted)"}}>{purchases.length} resumo{purchases.length !== 1 ? "s" : ""} na biblioteca</div>
              {purchases.map(p => (
                <div key={p.id} className="row" style={{gap:14, padding:"12px 28px", borderBottom:"1px solid var(--line)", alignItems:"center"}}>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontWeight:600, fontSize:14, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{p.product_title}</div>
                    <div className="mono" style={{fontSize:11, color:"var(--muted)", marginTop:2}}>
                      {p.method === "Admin" ? <span style={{color:"var(--acc-3)", fontWeight:700}}>★ Concedido pelo admin</span> : `R$ ${p.price} · ${p.method}`}
                      {" · "}{fmt(p.created_at)}
                    </div>
                  </div>
                  <button
                    className="btn"
                    onClick={() => revoke(p.id)}
                    disabled={revoking === p.id}
                    style={{fontSize:12, padding:"6px 12px", color:"var(--primary)", borderColor:"var(--primary)", flexShrink:0, opacity: revoking === p.id ? .5 : 1}}
                  >
                    {revoking === p.id ? "…" : "Remover"}
                  </button>
                </div>
              ))}
            </>
          )}
        </div>

        <div style={{padding:"14px 28px", borderTop:"1px solid var(--line)", display:"flex", justifyContent:"flex-end"}}>
          <button className="btn" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

// ─────────── Support ───────────
const TICKET_SUBJECT_ADMIN = {
  duvida: "Dúvida sobre conteúdo",
  problema: "Problema técnico",
  pagamento: "Pagamento",
  acesso: "Acesso ao resumo",
  outro: "Outro",
};

function AdminTicketCard({ ticket, currentUser, onResolved, onDeleted }){
  const [open, setOpen] = useStateAdmin(false);
  const [replies, setReplies] = useStateAdmin([]);
  const [loaded, setLoaded] = useStateAdmin(false);
  const [replyText, setReplyText] = useStateAdmin("");
  const [replyBusy, setReplyBusy] = useStateAdmin(false);
  const [resolving, setResolving] = useStateAdmin(false);
  const [deleting, setDeleting] = useStateAdmin(false);

  // Realtime: respostas do usuário em tempo real (ativo só quando expandido)
  useEffectAdmin(() => {
    if (!open || !loaded) return;
    const ch = sb.channel("tr-admin-" + ticket.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ticket_replies", filter: `ticket_id=eq.${ticket.id}` },
        p => setReplies(prev => prev.some(r => r.id === p.new.id) ? prev : [...prev, p.new]))
      .subscribe();
    return () => sb.removeChannel(ch);
  }, [open, loaded]);

  const toggle = async () => {
    if (!open && !loaded) {
      const r = await fetchTicketReplies(ticket.id);
      setReplies(r);
      setLoaded(true);
    }
    setOpen(o => !o);
  };

  const sendReply = async (e) => {
    e.preventDefault();
    const text = replyText.trim();
    if (!text || replyBusy || !currentUser?.id) return;
    setReplyBusy(true);
    const { reply, error } = await addTicketReply(ticket.id, currentUser.id, text, true);
    if (reply) { setReplies(prev => [...prev, reply]); setReplyText(""); }
    if (error) alert("Erro ao enviar: " + error);
    setReplyBusy(false);
  };

  const markResolved = async (e) => {
    e.stopPropagation();
    setResolving(true);
    const { error } = await resolveTicket(ticket.id);
    if (error) {
      alert("Erro ao marcar como resolvida: " + error);
    } else {
      onResolved(ticket.id);
    }
    setResolving(false);
  };

  const remove = async (e) => {
    e.stopPropagation();
    if (!window.confirm("Excluir esta solicitação? Não pode ser desfeito.")) return;
    setDeleting(true);
    const { error } = await deleteTicket(ticket.id);
    if (!error) onDeleted(ticket.id);
    else { alert("Erro ao excluir: " + error); setDeleting(false); }
  };

  const isOpen = ticket.status === "open";
  const subj = TICKET_SUBJECT_ADMIN[ticket.subject] || ticket.subject;
  const fmt = (d) => new Date(d).toLocaleDateString("pt-BR", { day:"numeric", month:"short", year:"numeric" }) +
    " · " + new Date(d).toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" });

  return (
    <div style={{ border:"1px solid var(--line)", borderRadius:"var(--radius-lg)", background:"var(--surface)", overflow:"hidden" }}>
      {/* Header */}
      <div onClick={toggle} style={{ padding:"16px 20px", display:"flex", alignItems:"center", gap:14, cursor:"pointer" }}>
        <span style={{
          flexShrink:0, fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:999,
          background: isOpen ? "color-mix(in oklab, var(--acc-1) 18%, transparent)" : "color-mix(in oklab, var(--acc-2) 18%, transparent)",
          color: isOpen ? "#a07800" : "var(--acc-2)",
        }}>
          {isOpen ? "Aberta" : "Resolvida"}
        </span>

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:600, fontSize:14, marginBottom:3 }}>{subj}</div>
          <div style={{ fontSize:12, color:"var(--muted)" }}>{ticket.email} · {fmt(ticket.created_at)}</div>
        </div>

        <div style={{ display:"flex", gap:6, flexShrink:0 }} onClick={e => e.stopPropagation()}>
          {isOpen && (
            <button className="btn" style={{ fontSize:12 }} disabled={resolving} onClick={markResolved}>
              {resolving ? "…" : "Marcar resolvida"}
            </button>
          )}
          <button style={{
            width:32, height:32, borderRadius:8, border:"1px solid var(--line)",
            background:"var(--surface)", color:"var(--primary)", cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center",
          }} disabled={deleting} onClick={remove} title="Excluir solicitação">
            {deleting
              ? <div style={{ width:12, height:12, border:"2px solid var(--line)", borderTopColor:"var(--primary)", borderRadius:"50%", animation:"spin .7s linear infinite" }} />
              : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            }
          </button>
        </div>

        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.2" strokeLinecap="round"
          style={{ flexShrink:0, transition:"transform .2s", transform: open ? "rotate(180deg)" : "none" }}>
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </div>

      {/* Thread */}
      {open && (
        <div style={{ padding:"0 20px 20px", borderTop:"1px solid var(--line)" }}>
          {/* Mensagem original (esquerda = usuário) */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", marginTop:16, marginBottom:10 }}>
            <div style={{ maxWidth:"82%", padding:"9px 14px", borderRadius:"4px 14px 14px 14px", background:"var(--bg)", border:"1px solid var(--line)", fontSize:13, lineHeight:1.6, wordBreak:"break-word" }}>
              {ticket.message}
            </div>
            <div style={{ fontSize:10, color:"var(--muted)", marginTop:3 }}>{fmt(ticket.created_at)}</div>
          </div>

          {!loaded && <div style={{ fontSize:13, color:"var(--muted)", padding:"6px 0" }}>Carregando...</div>}

          {replies.map(r => (
            <div key={r.id} style={{ display:"flex", flexDirection:"column", alignItems: r.is_admin ? "flex-end" : "flex-start", marginBottom:8 }}>
              {r.is_admin && <div style={{ fontSize:9, fontWeight:700, color:"var(--muted)", marginBottom:3, letterSpacing:".08em" }}>VOCÊ</div>}
              <div style={{
                maxWidth:"82%", padding:"9px 14px",
                borderRadius: r.is_admin ? "14px 4px 14px 14px" : "4px 14px 14px 14px",
                background: r.is_admin ? "var(--primary)" : "var(--bg)",
                color: r.is_admin ? "var(--primary-ink)" : "var(--fg)",
                border: r.is_admin ? "none" : "1px solid var(--line)",
                fontSize:13, lineHeight:1.5, wordBreak:"break-word",
              }}>
                {r.message}
              </div>
              <div style={{ fontSize:10, color:"var(--muted)", marginTop:3 }}>
                {new Date(r.created_at).toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" })}
              </div>
            </div>
          ))}

          {loaded && (
            <form onSubmit={sendReply} style={{ display:"flex", gap:8, marginTop:14 }}>
              <input className="input" value={replyText} onChange={e => setReplyText(e.target.value)}
                placeholder="Responder ao usuário..." style={{ flex:1, fontSize:13 }} />
              <button className="btn primary" type="submit" disabled={replyBusy || !replyText.trim()}
                style={{ opacity:replyBusy ? .7 : 1, whiteSpace:"nowrap" }}>
                {replyBusy ? "…" : "Enviar"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function AdminSupport({ currentUser }){
  const [tickets, setTickets] = useStateAdmin([]);
  const [loading, setLoading] = useStateAdmin(true);
  const [filter, setFilter] = useStateAdmin("open");

  useEffectAdmin(() => {
    let mounted = true;
    fetchAllTickets().then(t => { if (mounted){ setTickets(t); setLoading(false); } });
    return () => { mounted = false; };
  }, []);

  const openCount = useMemoAdmin(() => tickets.filter(t => t.status === "open").length, [tickets]);
  const filtered = useMemoAdmin(() =>
    filter === "all" ? tickets : tickets.filter(t => t.status === filter),
    [tickets, filter]
  );

  const handleResolved = (id) => setTickets(prev => prev.map(t => t.id === id ? { ...t, status:"resolved" } : t));
  const handleDeleted  = (id) => setTickets(prev => prev.filter(t => t.id !== id));

  return (
    <div style={{ marginTop:28 }}>
      <div style={{ display:"flex", gap:8, marginBottom:20 }}>
        {[["open", `Abertas (${openCount})`], ["resolved","Resolvidas"], ["all","Todas"]].map(([v,l]) => (
          <button key={v} className={filter === v ? "btn primary" : "btn"}
            onClick={() => setFilter(v)} style={{ fontSize:13 }}>{l}</button>
        ))}
      </div>

      {loading && <div style={{padding:60, display:"flex", justifyContent:"center"}}><Spinner/></div>}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign:"center", color:"var(--muted)", padding:60, fontSize:14, lineHeight:1.8 }}>
          <div style={{ fontSize:32, marginBottom:8 }}>✓</div>
          {filter === "open" ? "Nenhuma solicitação aberta." : filter === "resolved" ? "Nenhuma resolvida." : "Nenhuma solicitação ainda."}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {filtered.map(t => (
            <AdminTicketCard key={t.id} ticket={t} currentUser={currentUser}
              onResolved={handleResolved} onDeleted={handleDeleted} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────── Descontos ───────────
function AdminDiscounts(){
  const [codes, setCodes] = useStateAdmin([]);
  const [products, setProducts] = useStateAdmin([]);
  const [loading, setLoading] = useStateAdmin(true);
  const [err, setErr] = useStateAdmin("");
  const [section, setSection] = useStateAdmin("codes"); // codes | sale

  // Form: novo/editar cupom
  const emptyForm = { id:"", description:"", type:"percent", value:"", applies_to:"all", max_uses:"", active:true, starts_at:"", expires_at:"" };
  const [form, setForm] = useStateAdmin(emptyForm);
  const [editing, setEditing] = useStateAdmin(null); // code id being edited
  const [saving, setSaving] = useStateAdmin(false);
  const [formErr, setFormErr] = useStateAdmin("");

  // Form: sale em produto
  const [saleForm, setSaleForm] = useStateAdmin({}); // { [productId]: { type, value, expires_at } }
  const [saleSaving, setSaleSaving] = useStateAdmin({});

  const reload = async () => {
    setLoading(true);
    try {
      const [c, p] = await Promise.all([fetchDiscountCodes(), fetchProducts()]);
      setCodes(c || []);
      setProducts(p || []);
    } catch(e){ setErr(e.message); }
    finally { setLoading(false); }
  };
  useEffectAdmin(()=>{ reload(); }, []);

  const upd = k => e => setForm(f => ({...f, [k]: e.target.type==="checkbox" ? e.target.checked : e.target.value}));

  const startEdit = (c) => {
    setEditing(c.id);
    setForm({
      id: c.id, description: c.description||"", type: c.type, value: String(c.value),
      applies_to: c.applies_to, max_uses: c.max_uses != null ? String(c.max_uses) : "",
      active: c.active,
      starts_at: c.starts_at ? c.starts_at.slice(0,16) : "",
      expires_at: c.expires_at ? c.expires_at.slice(0,16) : "",
    });
  };
  const cancelEdit = () => { setEditing(null); setForm(emptyForm); setFormErr(""); };

  const submit = async (e) => {
    e.preventDefault();
    setFormErr("");
    if (!form.id.trim()){ setFormErr("Código obrigatório."); return; }
    if (!form.value || isNaN(Number(form.value)) || Number(form.value) <= 0){ setFormErr("Valor inválido."); return; }
    if (form.type==="percent" && Number(form.value) > 100){ setFormErr("Percentual não pode ser maior que 100."); return; }
    setSaving(true);
    const data = {
      description: form.description,
      type: form.type,
      value: Number(form.value),
      applies_to: form.applies_to,
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      active: form.active,
      starts_at: form.starts_at || null,
      expires_at: form.expires_at || null,
    };
    let r;
    if (editing){
      r = await updateDiscountCode(editing, data);
    } else {
      r = await createDiscountCode({ id: form.id.trim().toUpperCase(), ...data });
    }
    setSaving(false);
    if (r.error){ setFormErr(r.error); return; }
    cancelEdit();
    reload();
  };

  const handleDelete = async (id) => {
    if (!confirm(`Excluir cupom "${id}"? Esta ação não pode ser desfeita.`)) return;
    const r = await deleteDiscountCode(id);
    if (r.error){ alert("Erro: " + r.error); return; }
    reload();
  };

  const handleToggleActive = async (c) => {
    const r = await updateDiscountCode(c.id, { active: !c.active });
    if (r.error){ alert("Erro: " + r.error); return; }
    reload();
  };

  const fmtDate = d => d ? new Date(d).toLocaleDateString("pt-BR",{day:"2-digit",month:"short",year:"2-digit"}) : "—";

  const codeStatus = (c) => {
    const now = new Date();
    if (!c.active) return { label:"Inativo", color:"var(--muted)" };
    if (c.starts_at && new Date(c.starts_at) > now) return { label:"Agendado", color:"var(--acc-4)" };
    if (c.expires_at && new Date(c.expires_at) <= now) return { label:"Expirado", color:"var(--primary)" };
    if (c.max_uses != null && c.uses_count >= c.max_uses) return { label:"Esgotado", color:"var(--primary)" };
    return { label:"Ativo", color:"var(--acc-2)" };
  };

  // product sale helpers
  const initSaleForm = (p) => {
    setSaleForm(f => ({...f, [p.id]: {
      type: p.sale_type || "percent",
      value: p.sale_value != null ? String(p.sale_value) : "",
      expires_at: p.sale_expires_at ? p.sale_expires_at.slice(0,16) : "",
    }}));
  };
  const updSale = (pid, k) => e => setSaleForm(f => ({...f, [pid]: {...(f[pid]||{}), [k]: e.target.value}}));

  const saveSale = async (p) => {
    const f = saleForm[p.id] || {};
    setSaleSaving(s => ({...s, [p.id]: true}));
    const val = f.value ? Number(f.value) : null;
    const r = await setProductSale(p.id, f.value ? f.type : null, val, f.expires_at || null);
    setSaleSaving(s => ({...s, [p.id]: false}));
    if (r.error){ alert("Erro: " + r.error); return; }
    reload();
  };

  const clearSale = async (p) => {
    setSaleSaving(s => ({...s, [p.id]: true}));
    const r = await setProductSale(p.id, null, null, null);
    setSaleSaving(s => ({...s, [p.id]: false}));
    if (r.error){ alert("Erro: " + r.error); return; }
    setSaleForm(f => {const n={...f}; delete n[p.id]; return n;});
    reload();
  };

  if (loading) return <div style={{marginTop: 28, display:"flex", justifyContent:"center", padding: 60}}><Spinner/></div>;
  if (err) return <div style={{marginTop: 28, color:"var(--primary)"}}>{err}</div>;

  return (
    <div style={{marginTop: 28}}>
      <div className="row" style={{gap: 8, marginBottom: 24}}>
        <button onClick={()=>setSection("codes")} className={`btn${section==="codes" ? " primary" : ""}`} style={{fontSize: 13}}>Cupons de desconto</button>
        <button onClick={()=>setSection("sale")} className={`btn${section==="sale" ? " primary" : ""}`} style={{fontSize: 13}}>Promoção em produtos</button>
      </div>

      {/* ── Cupons ── */}
      {section === "codes" && (
        <div style={{display:"flex", flexDirection:"column", gap: 24}}>

          {/* Formulário criar/editar */}
          <div className="card" style={{padding: 24}}>
            <div className="display" style={{fontSize: 17, fontWeight: 700, marginBottom: 18}}>
              {editing ? `Editando: ${editing}` : "Novo cupom"}
            </div>
            <form onSubmit={submit}>
              <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap: 14, marginBottom: 14}}>
                <div>
                  <label style={{fontSize: 12, fontWeight: 600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", display:"flex", alignItems:"center", marginBottom: 5}}>Código *<Tip text="O código que o cliente digita no carrinho. Use letras maiúsculas sem espaço. Ex: MEDICINA20, BLACKFRIDAY50. Não pode ser alterado depois de criado."/></label>
                  <input value={form.id} onChange={e=>setForm(f=>({...f, id:e.target.value.toUpperCase()}))} disabled={!!editing} placeholder="EX: MEDICINA20" style={{...iStyle(), width:"100%", boxSizing:"border-box", fontFamily:"var(--font-mono)", textTransform:"uppercase"}} />
                </div>
                <div>
                  <label style={{fontSize: 12, fontWeight: 600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", display:"flex", alignItems:"center", marginBottom: 5}}>Tipo<Tip text="Percentual: desconta X% do valor. Fixo: desconta um valor em R$ independente do preço do produto."/></label>
                  <select value={form.type} onChange={upd("type")} style={{...iStyle(), width:"100%", boxSizing:"border-box"}}>
                    <option value="percent">Percentual (%)</option>
                    <option value="fixed">Fixo (R$)</option>
                  </select>
                </div>
                <div>
                  <label style={{fontSize: 12, fontWeight: 600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", display:"flex", alignItems:"center", marginBottom: 5}}>Valor *<Tip text="Quanto descontar. Se tipo for %, coloque 1–100 (ex: 20 = 20% off). Se for R$, o valor em reais (ex: 15 = R$ 15 off)."/></label>
                  <input type="number" min="0.01" step="0.01" value={form.value} onChange={upd("value")} placeholder={form.type==="percent" ? "20" : "10.00"} style={{...iStyle(), width:"100%", boxSizing:"border-box"}} />
                </div>
                <div>
                  <label style={{fontSize: 12, fontWeight: 600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", display:"flex", alignItems:"center", marginBottom: 5}}>Aplica em<Tip text="Em quais produtos o cupom funciona. 'Todos os produtos' vale para qualquer item do carrinho. Ou escolha um resumo específico."/></label>
                  <select value={form.applies_to} onChange={upd("applies_to")} style={{...iStyle(), width:"100%", boxSizing:"border-box"}}>
                    <option value="all">Todos os produtos</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{fontSize: 12, fontWeight: 600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", display:"flex", alignItems:"center", marginBottom: 5}}>Máx. usos<Tip text="Limite total de usos do código por todos os clientes. Ex: 50 = só as 50 primeiras pessoas conseguem usar. Se deixar em branco, não tem limite."/></label>
                  <input type="number" min="1" step="1" value={form.max_uses} onChange={upd("max_uses")} placeholder="Ilimitado" style={{...iStyle(), width:"100%", boxSizing:"border-box"}} />
                </div>
                <div>
                  <label style={{fontSize: 12, fontWeight: 600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", display:"flex", alignItems:"center", marginBottom: 5}}>Início<Tip text="Data a partir da qual o cupom começa a funcionar. Se deixar em branco, o cupom já vale imediatamente após ser criado."/></label>
                  <input type="datetime-local" value={form.starts_at} onChange={upd("starts_at")} style={{...iStyle(), width:"100%", boxSizing:"border-box"}} />
                </div>
                <div>
                  <label style={{fontSize: 12, fontWeight: 600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", display:"flex", alignItems:"center", marginBottom: 5}}>Expiração<Tip text="Data limite para usar o cupom. Após essa data, o código para de funcionar automaticamente. Se deixar em branco, o cupom não expira."/></label>
                  <input type="datetime-local" value={form.expires_at} onChange={upd("expires_at")} style={{...iStyle(), width:"100%", boxSizing:"border-box"}} />
                </div>
                <div>
                  <label style={{fontSize: 12, fontWeight: 600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", display:"flex", alignItems:"center", marginBottom: 5}}>Descrição interna<Tip text="Anotação só pra você. Não aparece para o cliente. Útil para lembrar o objetivo do cupom. Ex: 'Parceria com fulano', 'Black Friday 2026'."/></label>
                  <input value={form.description} onChange={upd("description")} placeholder="Para referência" style={{...iStyle(), width:"100%", boxSizing:"border-box"}} />
                </div>
              </div>
              <div className="row" style={{alignItems:"center", gap: 12, flexWrap:"wrap"}}>
                <label className="row" style={{gap: 8, cursor:"pointer", userSelect:"none", fontSize: 14}}>
                  <input type="checkbox" checked={form.active} onChange={upd("active")} style={{width: 16, height: 16, accentColor:"var(--primary)"}} />
                  Ativo
                </label>
                {formErr && <span style={{color:"var(--primary)", fontSize: 13, fontWeight: 600}}>{formErr}</span>}
                <div style={{marginLeft:"auto", display:"flex", gap: 8}}>
                  {editing && <button type="button" onClick={cancelEdit} className="btn">Cancelar</button>}
                  <button type="submit" disabled={saving} className="btn primary">{saving ? "Salvando…" : editing ? "Salvar alterações" : "Criar cupom"}</button>
                </div>
              </div>
            </form>
          </div>

          {/* Tabela de cupons */}
          <div className="card" style={{padding: 0, overflow:"hidden"}}>
            {codes.length === 0 ? (
              <div style={{padding: 60, textAlign:"center", color:"var(--muted)"}}>Nenhum cupom cadastrado.</div>
            ) : (
              <table style={{width:"100%", borderCollapse:"collapse", fontSize: 14}}>
                <thead>
                  <tr style={{textAlign:"left", color:"var(--muted)", fontSize: 11, textTransform:"uppercase", letterSpacing:".08em", background:"var(--bg)"}}>
                    <th style={th()}>Código</th>
                    <th style={th()}>Desconto</th>
                    <th style={th()}>Aplica em</th>
                    <th style={th()}>Usos</th>
                    <th style={th()}>Validade</th>
                    <th style={th()}>Status</th>
                    <th style={th()}></th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map(c => {
                    const st = codeStatus(c);
                    return (
                      <tr key={c.id} style={{borderTop:"1px solid var(--line)"}}>
                        <td style={td()}>
                          <span className="mono" style={{fontWeight: 700, fontSize: 13}}>{c.id}</span>
                          {c.description && <div style={{fontSize: 11, color:"var(--muted)", marginTop: 2}}>{c.description}</div>}
                        </td>
                        <td style={td()}>
                          <span style={{fontWeight: 700, color:"var(--primary)"}}>
                            {c.type==="percent" ? `${c.value}%` : `R$ ${c.value}`}
                          </span>
                        </td>
                        <td style={{...td(), fontSize: 12}} className="mono">
                          {c.applies_to === "all" ? "Todos" : (products.find(p=>p.id===c.applies_to)?.title || c.applies_to)}
                        </td>
                        <td style={td()}>
                          <span style={{fontWeight: 600}}>{c.uses_count}</span>
                          {c.max_uses != null && <span style={{color:"var(--muted)"}}>/{c.max_uses}</span>}
                        </td>
                        <td style={{...td(), fontSize: 12}} className="mono">
                          {c.expires_at ? fmtDate(c.expires_at) : "Sem limite"}
                        </td>
                        <td style={td()}>
                          <span style={{fontSize: 12, fontWeight: 600, color: st.color, background:`color-mix(in oklab, ${st.color} 15%, var(--bg))`, padding:"3px 8px", borderRadius: 6}}>{st.label}</span>
                        </td>
                        <td style={td()}>
                          <div className="row" style={{gap: 6, justifyContent:"flex-end"}}>
                            <button onClick={()=>handleToggleActive(c)} className="btn" style={{fontSize: 12, padding:"5px 10px"}}>{c.active ? "Desativar" : "Ativar"}</button>
                            <button onClick={()=>startEdit(c)} className="btn" style={{fontSize: 12, padding:"5px 10px"}}>Editar</button>
                            <button onClick={()=>handleDelete(c.id)} className="btn" style={{fontSize: 12, padding:"5px 10px", color:"var(--primary)"}}>Excluir</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Promoção em produtos ── */}
      {section === "sale" && (
        <div className="card" style={{padding: 0, overflow:"hidden"}}>
          {products.length === 0 ? (
            <div style={{padding: 60, textAlign:"center", color:"var(--muted)"}}>Nenhum produto encontrado.</div>
          ) : (
            <table style={{width:"100%", borderCollapse:"collapse", fontSize: 14}}>
              <thead>
                <tr style={{textAlign:"left", color:"var(--muted)", fontSize: 11, textTransform:"uppercase", letterSpacing:".08em", background:"var(--bg)"}}>
                  <th style={th()}>Produto</th>
                  <th style={th()}>Preço atual</th>
                  <th style={th()}>Promoção ativa</th>
                  <th style={th()}>Configurar</th>
                </tr>
              </thead>
              <tbody>
                {products.filter(p=>p.active).map(p => {
                  const sf = saleForm[p.id];
                  const hasSale = p.sale_type && p.sale_value != null;
                  const saleExpired = hasSale && p.sale_expires_at && new Date(p.sale_expires_at) <= new Date();
                  return (
                    <tr key={p.id} style={{borderTop:"1px solid var(--line)"}}>
                      <td style={td()}>
                        <div style={{fontWeight: 600}}>{p.title}</div>
                        <div className="mono" style={{fontSize: 11, color:"var(--muted)"}}>{p.id}</div>
                      </td>
                      <td style={{...td(), fontWeight: 700}}>R$ {p.price}</td>
                      <td style={td()}>
                        {hasSale && !saleExpired ? (
                          <div>
                            <span style={{color:"var(--primary)", fontWeight: 700}}>
                              {p.sale_type === "percent" ? `-${p.sale_value}%` : `-R$ ${p.sale_value}`}
                            </span>
                            {p.sale_expires_at && <div style={{fontSize: 11, color:"var(--muted)"}}>até {fmtDate(p.sale_expires_at)}</div>}
                          </div>
                        ) : saleExpired ? (
                          <span style={{color:"var(--muted)", fontSize: 12}}>Expirada</span>
                        ) : (
                          <span style={{color:"var(--muted)"}}>—</span>
                        )}
                      </td>
                      <td style={td()}>
                        {sf ? (
                          <div className="row" style={{gap: 8, alignItems:"flex-end", flexWrap:"wrap"}}>
                            <select value={sf.type} onChange={updSale(p.id,"type")} style={{...iStyle(), fontSize: 13, padding:"7px 10px"}}>
                              <option value="percent">%</option>
                              <option value="fixed">R$</option>
                            </select>
                            <input type="number" min="0.01" step="0.01" value={sf.value} onChange={updSale(p.id,"value")} placeholder={sf.type==="percent"?"20":"10"} style={{...iStyle(), fontSize: 13, padding:"7px 10px", width: 80}} />
                            <input type="datetime-local" value={sf.expires_at} onChange={updSale(p.id,"expires_at")} title="Expiração (opcional)" style={{...iStyle(), fontSize: 12, padding:"7px 10px"}} />
                            <button onClick={()=>saveSale(p)} disabled={saleSaving[p.id] || !sf.value} className="btn primary" style={{fontSize: 12, padding:"7px 12px"}}>{saleSaving[p.id] ? "…" : "Salvar"}</button>
                            <button onClick={()=>setSaleForm(f=>{const n={...f}; delete n[p.id]; return n;})} className="btn" style={{fontSize: 12, padding:"7px 12px"}}>Cancelar</button>
                            {hasSale && <button onClick={()=>clearSale(p)} className="btn" style={{fontSize: 12, padding:"7px 12px", color:"var(--primary)"}}>Remover promoção</button>}
                          </div>
                        ) : (
                          <button onClick={()=>initSaleForm(p)} className="btn" style={{fontSize: 12, padding:"7px 12px"}}>
                            {hasSale ? "Editar promoção" : "Adicionar promoção"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { AdminDashboard });
