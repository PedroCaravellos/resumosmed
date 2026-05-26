// library.jsx — MyLibrary + protected PdfReader

const { useState: useStateLib, useEffect: useEffectLib, useMemo: useMemoLib, useCallback: useCallbackLib, useRef: useRefLib } = React;

// ─────────── My Library ───────────
function MyLibrary({ go, currentUser }){
  if (!currentUser){
    return (
      <div className="page" style={{paddingTop: 60, paddingBottom: 60, textAlign:"center"}}>
        <div className="display" style={{fontSize: 28, fontWeight: 700, marginBottom: 10}}>Entre pra ver sua biblioteca</div>
        <p style={{color:"var(--muted)", marginBottom: 20}}>Crie uma conta ou entre pra acessar seus resumos.</p>
        <div className="row" style={{gap: 10, justifyContent:"center"}}>
          <button className="btn primary" onClick={()=>go({name:"login"})}>Entrar</button>
          <button className="btn" onClick={()=>go({name:"signup"})}>Criar conta</button>
        </div>
      </div>
    );
  }

  const isAdmin = currentUser.role === "admin";
  const [products, setProducts] = useStateLib([]);
  const [purchases, setPurchases] = useStateLib([]);
  const [loading, setLoading] = useStateLib(true);

  useEffectLib(()=>{
    let mounted = true;
    const finish = (p, pu) => {
      if (!mounted) return;
      setProducts(p || []);
      if (pu){
        const map = new Map();
        pu.forEach(x => { if (!map.has(x.product_id)) map.set(x.product_id, x); });
        setPurchases([...map.values()]);
      } else {
        setPurchases([]);
      }
      setLoading(false);
    };
    if (isAdmin){
      fetchProducts()
        .then(p => finish(p, null))
        .catch(err => { console.error("[library/admin]", err); if (mounted) setLoading(false); });
    } else {
      Promise.all([fetchProducts(), fetchUserPurchases(currentUser.id)])
        .then(([p, pu]) => finish(p, pu))
        .catch(err => { console.error("[library/user]", err); if (mounted) setLoading(false); });
    }
    return ()=>{ mounted = false; };
  }, [currentUser.id, isAdmin]);

  const owned = isAdmin
    ? products.map(p => ({ ...p, purchasedAt: p.created_at, paidPrice: p.price, _adminItem: true }))
    : purchases.map(p => {
        const prod = products.find(x => x.id === p.product_id);
        return prod ? { ...prod, purchasedAt: p.created_at, paidPrice: p.price } : null;
      }).filter(Boolean);

  return (
    <div className="pagewrap">
      <section className="page" style={{paddingTop: 40, paddingBottom: 24}}>
        <div className="row" style={{gap: 6, fontSize: 13, color:"var(--muted)", marginBottom: 14}}>
          <a onClick={()=>go({name:"landing"})} style={{cursor:"pointer"}}>Início</a>
          <span>›</span>
          <span>{isAdmin ? "Biblioteca de revisão" : "Minha biblioteca"}</span>
        </div>
        <div className="row between" style={{flexWrap:"wrap", gap: 16}}>
          <div>
            <div className="mono" style={{fontSize: 11, textTransform:"uppercase", letterSpacing:".1em", color:"var(--primary)", marginBottom: 8}}>
              {isAdmin ? "Modo admin · revisão" : `Olá, ${currentUser.name.split(" ")[0]}`}
            </div>
            <h1 className="display" style={{fontSize:"clamp(36px, 5vw, 56px)", margin: 0, fontWeight: 700, lineHeight: 1.05}}>
              {isAdmin ? "Biblioteca de revisão" : "Minha biblioteca"}<span style={{color:"var(--primary)"}}>.</span>
            </h1>
            <p style={{color:"var(--muted)", fontSize: 16, marginTop: 10}}>
              {isAdmin
                ? `${owned.length} resumos publicados. Clique em qualquer um pra abrir no leitor e revisar.`
                : (owned.length === 0 ? "Você ainda não comprou nenhum resumo." : `${owned.length} ${owned.length===1?"resumo seu":"resumos seus"}, acesso vitalício.`)}
            </p>
          </div>
          {!isAdmin && <button className="btn" onClick={()=>go({name:"catalog"})}>+ Comprar mais resumos</button>}
          {isAdmin && <button className="btn" onClick={()=>go({name:"admin"})}>Voltar ao painel</button>}
        </div>
      </section>

      <section className="page" style={{paddingBottom:"var(--gap-xl)"}}>
        {loading ? (
          <div style={{padding: 80, display:"flex", justifyContent:"center"}}><Spinner label="carregando biblioteca"/></div>
        ) : owned.length === 0 ? (
          <div className="card" style={{padding: 60, textAlign:"center", marginTop: 16}}>
            <Illu.Brain size={64}/>
            <div className="display" style={{fontSize: 22, fontWeight: 700, marginTop: 14}}>Sua biblioteca está vazia.</div>
            <p style={{color:"var(--muted)", marginTop: 6, marginBottom: 20}}>Bora dar uma volta no catálogo — tem resumo pra todas as matérias.</p>
            <button className="btn primary" onClick={()=>go({name:"catalog"})}>Ver catálogo</button>
          </div>
        ) : (
          <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap: 16}}>
            {owned.map(r => <LibraryCard key={r.id} r={r} go={go}/>)}
          </div>
        )}
      </section>
    </div>
  );
}

function LibraryCard({ r, go }){
  const area = AREAS.find(a=>a.id===r.area) || AREAS[0];
  const I = ILLU_FOR_AREA[r.area] || Illu.Cross;
  const fmt = (d) => d ? new Date(d).toLocaleDateString("pt-BR",{day:"2-digit",month:"short",year:"numeric"}) : "—";
  return (
    <div className="card" style={{padding:"var(--card-pad)", display:"flex", flexDirection:"column", gap: 14, cursor:"pointer", transition:"transform .15s ease"}}
         onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"}
         onMouseLeave={e=>e.currentTarget.style.transform="translateY(0)"}
         onClick={()=>go({name:"reader", id:r.id})}>
      <div className="row between" style={{alignItems:"flex-start"}}>
        <I size={48}/>
        {r._adminItem ? (
          <span className="pill" style={{background:"var(--fg)", color:"var(--bg)", borderColor:"var(--fg)", fontSize: 11}}>
            ★ Publicado
          </span>
        ) : (
          <span className="pill" style={{background:"var(--acc-2)", borderColor:"transparent", color:"var(--fg)", fontSize: 11}}>
            ✓ Seu
          </span>
        )}
      </div>
      <div>
        <div className="mono" style={{fontSize: 10, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".1em", marginBottom: 4}}>{area.name}</div>
        <div className="display" style={{fontSize: 19, fontWeight: 600, lineHeight: 1.15}}>{r.title}</div>
      </div>
      <div className="mono" style={{fontSize: 11.5, color:"var(--muted)"}}>
        {r._adminItem
          ? <>Publicado em {fmt(r.purchasedAt)} · {r.pages} páginas{r.file_path ? " · PDF ✓" : " · sem PDF"}</>
          : <>Comprado em {fmt(r.purchasedAt)} · {r.pages} páginas</>}
      </div>
      <button className="btn primary" style={{justifyContent:"center", marginTop:"auto", padding:"10px 14px", fontSize: 13.5}} onClick={(e)=>{e.stopPropagation(); go({name:"reader", id:r.id});}}>
        {r._adminItem ? "Abrir pra revisar →" : "Ler online →"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  PROTECTED PDF READER
// ─────────────────────────────────────────────────────────
function PdfReader({ id, go, currentUser }){
  const [r, setR] = useStateLib(null);
  const [loading, setLoading] = useStateLib(true);
  const [signedUrl, setSignedUrl] = useStateLib(null);
  const [canRead, setCanRead] = useStateLib(null); // null = ainda verificando
  const isAdmin = currentUser?.role === "admin";

  useEffectLib(()=>{
    let mounted = true;
    setLoading(true);
    setSignedUrl(null);
    setCanRead(null);
    (async () => {
      try {
        const prod = await fetchProductById(id);
        if (!mounted) return;
        setR(prod);
        if (prod?.file_path){
          const access = isAdmin || (currentUser && (currentUser.purchases||[]).includes(prod.id));
          if (mounted) setCanRead(access);
          if (access){
            try {
              const url = await getSignedPdfUrl(prod.file_path, 60*60);
              if (mounted) setSignedUrl(url);
            } catch (e) { console.warn("[reader] signed url:", e); }
          }
        } else {
          if (mounted) setCanRead(isAdmin);
        }
      } catch (err) {
        console.error("[reader] fetchProductById:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return ()=>{ mounted = false; };
  }, [id, currentUser?.id, currentUser?.purchases?.length]);

  if (!currentUser) {
    return (
      <div className="page" style={{paddingTop: 60, textAlign:"center"}}>
        <div className="display" style={{fontSize: 24, fontWeight: 700}}>Entre pra ler.</div>
        <button className="btn primary" style={{marginTop: 16}} onClick={()=>go({name:"login"})}>Entrar</button>
      </div>
    );
  }
  if (loading || canRead === null){
    return <div className="page" style={{paddingTop: 80, display:"flex", justifyContent:"center"}}><Spinner/></div>;
  }
  if (!r) {
    return (
      <div className="page" style={{paddingTop: 60, textAlign:"center"}}>
        <div className="display" style={{fontSize: 24, fontWeight: 700}}>Resumo não encontrado.</div>
        <button className="btn" style={{marginTop: 16}} onClick={()=>go({name: isAdmin ? "admin" : "library"})}>Voltar</button>
      </div>
    );
  }
  if (!canRead){
    return (
      <div className="page" style={{paddingTop: 60, textAlign:"center"}}>
        <div className="display" style={{fontSize: 24, fontWeight: 700}}>Você ainda não comprou este resumo.</div>
        <p style={{color:"var(--muted)", marginTop: 8, marginBottom: 18}}>Compre pra ter acesso vitalício.</p>
        <button className="btn primary" onClick={()=>go({name:"product", id:r.id})}>Ver na loja</button>
      </div>
    );
  }

  return <ReaderInner r={r} go={go} currentUser={currentUser} signedUrl={signedUrl} isAdmin={isAdmin}/>;
}

function ReaderInner({ r, go, currentUser, signedUrl, isAdmin }){
  const fakePages = useMemoLib(()=>buildPages(r), [r]);
  const hasPdf = !!signedUrl;
  const [page, setPage] = useStateLib(0);
  const [showHelp, setShowHelp] = useStateLib(false);
  const [showTerms, setShowTerms] = useStateLib(false);
  const [termsChecking, setTermsChecking] = useStateLib(true);
  const [deviceStatus, setDeviceStatus] = useStateLib("checking");
  const [currentFp, setCurrentFp] = useStateLib("");
  const [revealed, setRevealed] = useStateLib(false);
  const [isFullscreen, setIsFullscreen] = useStateLib(false);
  const [flashOn, setFlashOn] = useStateLib(false);
  const [testAsUser, setTestAsUser] = useStateLib(false);
  const [showQuiz, setShowQuiz] = useStateLib(false);
  // effAdmin: true só quando admin E não está no modo de teste
  const effAdmin = isAdmin && !testAsUser;
  const rootRef = useRefLib(null);
  const logRef = useRefLib({ blurCount: 0, lastLog: 0 });
  const flashTimerRef = useRefLib(null);
  const rerenderRef = useRefLib(0);
  const [rerenderTick, setRerenderTick] = useStateLib(0);

  // Flash de aviso ("Conteúdo protegido"). Definido antes dos effects que usam.
  const flash = () => {
    setFlashOn(true);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(()=>setFlashOn(false), 1400);
  };

  // Reset ao entrar no modo de teste como usuário
  useEffectLib(()=>{
    if (testAsUser){ setRevealed(false); setShowTerms(true); setTermsChecking(false); }
  }, [testAsUser]);

  // Helper de log com debounce simples por tipo
  const trackEvent = useCallbackLib((event, severity, meta) => {
    if (effAdmin) return;
    if (!currentUser) return;
    const now = Date.now();
    if (now - logRef.current.lastLog < 800 && event === "blur") return;
    logRef.current.lastLog = now;
    logEvent(currentUser.id, r.id, event, severity, meta || null);
  }, [currentUser?.id, effAdmin, r?.id]);

  // Termo de uso anti-vazamento: exibido a cada abertura do leitor
  useEffectLib(()=>{
    if (!currentUser || effAdmin){ setTermsChecking(false); return; }
    setShowTerms(true);
    setTermsChecking(false);
  }, [currentUser?.id, effAdmin]);

  // Verificação de dispositivo — roda após terms serem resolvidos
  useEffectLib(()=>{
    if (effAdmin){ setDeviceStatus("ok"); return; }
    if (!currentUser || termsChecking || showTerms) return;
    generateDeviceFingerprint().then(fp => {
      setCurrentFp(fp);
      if (!currentUser.device_fingerprint) {
        setDeviceStatus("unbound");
      } else if (currentUser.device_fingerprint === fp) {
        setDeviceStatus("ok");
      } else {
        setDeviceStatus("blocked");
      }
    });
  }, [currentUser?.id, currentUser?.device_fingerprint, effAdmin, termsChecking, showTerms]);

  // Loga abertura
  useEffectLib(()=>{
    if (!hasPdf || effAdmin || !currentUser || showTerms || termsChecking || deviceStatus !== "ok") return;
    trackEvent("open", "info", { title: r.title });
  }, [hasPdf, showTerms, termsChecking, deviceStatus, currentUser?.id, r?.id, effAdmin, trackEvent]);

  // PDF.js state
  const [pdfDoc, setPdfDoc] = useStateLib(null);
  const [pdfTotal, setPdfTotal] = useStateLib(0);
  const [pdfError, setPdfError] = useStateLib("");
  const [pdfLoading, setPdfLoading] = useStateLib(false);
  const canvasRef = useRefLib(null);
  const frameRef = useRefLib(null);
  const renderTaskRef = useRefLib(null);
  const [scale, setScale] = useStateLib(1.0); // user-zoom factor relative to fit-width

  // Load PDF document
  useEffectLib(()=>{
    if (!hasPdf || !window.pdfjsLib) return;
    let cancelled = false;
    setPdfLoading(true);
    setPdfError("");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
    const task = pdfjsLib.getDocument({
      url: signedUrl,
      // disableStream/Range improve cross-origin compatibility
      disableStream: true,
      disableRange: true,
      withCredentials: false,
    });
    task.promise.then(doc => {
      if (cancelled){ doc.destroy?.(); return; }
      setPdfDoc(doc);
      setPdfTotal(doc.numPages);
      setPage(0);
      setPdfLoading(false);
    }).catch(err => {
      if (cancelled) return;
      console.error("[pdf]", err);
      setPdfError("Não foi possível carregar o PDF. Tente novamente.");
      setPdfLoading(false);
    });
    return ()=>{ cancelled = true; try { task.destroy?.(); } catch {} };
  }, [signedUrl, hasPdf]);

  // Render current page
  useEffectLib(()=>{
    if (!pdfDoc || !canvasRef.current || !frameRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const p = await pdfDoc.getPage(page + 1);
        if (cancelled) return;
        if (renderTaskRef.current){
          try { renderTaskRef.current.cancel(); } catch {}
          renderTaskRef.current = null;
        }
        const frame = frameRef.current;
        const canvas = canvasRef.current;
        if (!frame || !canvas) return;
        // Fit to width (page scrolls vertically if tall) — text fica grande e nítido
        const padX = 24;
        const availW = Math.max(320, frame.clientWidth - padX);
        const base = p.getViewport({ scale: 1 });
        const fitScale = availW / base.width;
        // High-DPI render: usa ao menos 2x device pixel ratio pra texto crispy
        const dpr = Math.max(2, window.devicePixelRatio || 1);
        const cssScale = fitScale * scale;
        const viewport = p.getViewport({ scale: cssScale * dpr });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = Math.floor(viewport.width / dpr) + "px";
        canvas.style.height = Math.floor(viewport.height / dpr) + "px";
        const ctx = canvas.getContext("2d", { alpha: false });
        ctx.fillStyle = "#fff";
        ctx.fillRect(0,0,canvas.width,canvas.height);
        const task = p.render({
          canvasContext: ctx,
          viewport,
          intent: "display",
          enableWebGL: false,
        });
        renderTaskRef.current = task;
        await task.promise;
        renderTaskRef.current = null;
        // Draw watermark ON the canvas itself — fica embutido na imagem renderizada,
        // acompanha scroll naturalmente e é mais difícil de remover do que overlay HTML.
        try {
          const wm = (currentUser?.email || "anonimo") + "  ·  " + (currentUser?.id || "").slice(0,8);
          const w = canvas.width, h = canvas.height;
          // Grid diagonal SUTIL — pouco texto, opacidade baixa, espaçamento generoso
          ctx.save();
          ctx.font = `${Math.round(11 * dpr)}px ui-monospace, "Geist Mono", monospace`;
          ctx.fillStyle = "rgba(0,0,0,0.14)";
          ctx.textBaseline = "middle";
          ctx.textAlign = "center";
          ctx.translate(w/2, h/2);
          ctx.rotate(-22 * Math.PI/180);
          const stepX = Math.round(520 * dpr);   // espaçamento horizontal maior = menos repetição
          const stepY = Math.round(180 * dpr);   // espaçamento vertical maior = menos poluído
          for (let y = -h; y < h; y += stepY){
            for (let x = -w; x < w; x += stepX){
              ctx.fillText(wm, x, y);
            }
          }
          ctx.restore();
          // Sem faixa topo/rodapé — o grid já cobre tudo + as faixas fixas do leitor (header/footer)
          // mantêm a identidade do usuário visível na UI.
        } catch (e) { console.warn("[watermark]", e); }
        // Reset scroll ao trocar de página
        if (frame && !cancelled) frame.scrollTop = 0;
      } catch (err) {
        if (err?.name !== "RenderingCancelledException") console.error("[pdf render]", err);
      }
    })();
    return ()=>{ cancelled = true; };
  }, [pdfDoc, page, scale, currentUser?.email, currentUser?.id, rerenderTick]);

  // Re-render on resize (debounced) — usa tick em vez de mutar scale
  useEffectLib(()=>{
    if (!hasPdf) return;
    let t;
    const onResize = () => { clearTimeout(t); t = setTimeout(()=>setRerenderTick(x=>x+1), 180); };
    window.addEventListener("resize", onResize);
    return ()=>{ clearTimeout(t); window.removeEventListener("resize", onResize); };
  }, [hasPdf]);

  // Re-render quando entrar/sair fullscreen pra ajustar dimensões
  useEffectLib(()=>{
    if (!hasPdf || !revealed) return;
    const t = setTimeout(()=>setRerenderTick(x=>x+1), 250);
    return ()=>clearTimeout(t);
  }, [isFullscreen, revealed, hasPdf]);

  // Tracking fullscreen state nativo (esc fora do nosso controle, etc)
  // Sair do fullscreen oculta o conteúdo de novo (volta o gate)
  useEffectLib(()=>{
    const onFsChange = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (!fs && !effAdmin) setRevealed(false);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return ()=>document.removeEventListener("fullscreenchange", onFsChange);
  }, [effAdmin]);

  // Wheel + Ctrl/Cmd → zoom
  useEffectLib(()=>{
    if (!hasPdf || !revealed) return;
    const frame = frameRef.current;
    if (!frame) return;
    const onWheel = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      setScale(s => Math.min(3, Math.max(.5, s + delta)));
    };
    frame.addEventListener("wheel", onWheel, { passive: false });
    return ()=>frame.removeEventListener("wheel", onWheel);
  }, [hasPdf, revealed]);

  const reveal = useCallbackLib(async () => {
    // Tenta fullscreen — se falhar (ex: iframe sem allow="fullscreen" no preview),
    // revela mesmo assim. Em produção (domínio próprio) o fullscreen vai funcionar.
    try {
      const el = rootRef.current;
      if (el && el.requestFullscreen) {
        await el.requestFullscreen();
      }
    } catch (err) {
      console.warn("[fullscreen] indisponível neste contexto:", err);
    }
    setRevealed(true);
  }, []);

  const exitReader = useCallbackLib(async () => {
    if (document.fullscreenElement){
      try { await document.exitFullscreen(); } catch {}
    }
    go({ name: isAdmin ? "admin" : "library" });
  }, [go, isAdmin]);

  const goPrev = () => setPage(p => Math.max(0, p - 1));
  const goNext = () => setPage(p => Math.min(total - 1, p + 1));

  // Anti-easy-copy: block context menu, drag, common shortcuts
  useEffectLib(()=>{
    const stop = (e)=>{ e.preventDefault(); flash(); trackEvent("context_menu","warning"); };
    const stopKeys = (e)=>{
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && ["s","p","c","a"].includes(k)){
        e.preventDefault(); flash();
        trackEvent(k === "p" ? "print" : (k === "c" || k === "a" ? "copy" : "save"), "warning");
      }
      // F12 e Ctrl/Cmd+Shift+I/J/C → DevTools
      if (k === "f12" || ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i","j","c"].includes(k))){
        e.preventDefault(); flash();
        trackEvent("devtools","high");
      }
      // PrintScreen (Windows dispara)
      if (k === "printscreen"){ trackEvent("print_screen","high"); flash(); }
      if (k === "arrowright" || k === " ") { e.preventDefault(); setPage(p=>Math.min(total-1, p+1)); }
      if (k === "arrowleft") { e.preventDefault(); setPage(p=>Math.max(0, p-1)); }
      if (k === "+" || k === "=") { e.preventDefault(); setScale(s=>Math.min(3, s+0.15)); }
      if (k === "-") { e.preventDefault(); setScale(s=>Math.max(.5, s-0.15)); }
      if (k === "0") { e.preventDefault(); setScale(1.0); }
      if (k === "escape") {
        if (document.fullscreenElement){ document.exitFullscreen?.(); }
        else { go({ name: isAdmin ? "admin" : "library" }); }
      }
    };
    const onCopy = () => { trackEvent("copy","warning"); flash(); };
    document.addEventListener("contextmenu", stop);
    document.addEventListener("dragstart", stop);
    document.addEventListener("keydown", stopKeys);
    document.addEventListener("copy", onCopy);
    return ()=>{
      document.removeEventListener("contextmenu", stop);
      document.removeEventListener("dragstart", stop);
      document.removeEventListener("keydown", stopKeys);
      document.removeEventListener("copy", onCopy);
    };
  }, [pdfTotal, fakePages.length, isAdmin, trackEvent]);

  // Anti-piracy: blur quando janela perde foco
  useEffectLib(()=>{
    if (effAdmin) return;
    const onBlur = () => {
      document.body.classList.add("__blurred");
      logRef.current.blurCount = (logRef.current.blurCount || 0) + 1;
      trackEvent("blur", logRef.current.blurCount > 2 ? "warning" : "info");
    };
    const onFocus = () => document.body.classList.remove("__blurred");
    const onVis = () => document.hidden ? onBlur() : onFocus();
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return ()=>{
      document.body.classList.remove("__blurred");
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [trackEvent, effAdmin]);

  // Anti-piracy: detecta DevTools abertos.
  useEffectLib(()=>{
    if (effAdmin) return;
    let wasOpen = false;
    const check = () => {
      const threshold = 200;
      const widthGap  = window.outerWidth  - window.innerWidth;
      const heightGap = window.outerHeight - window.innerHeight;
      const open = widthGap > threshold || heightGap > threshold;
      if (open && !wasOpen){ trackEvent("devtools","high"); }
      wasOpen = open;
    };
    const t = setInterval(check, 1500);
    return ()=>{ clearInterval(t); };
  }, [trackEvent, effAdmin]);

  const area = AREAS.find(a=>a.id===r.area) || AREAS[0];
  const I = ILLU_FOR_AREA[r.area] || Illu.Cross;
  const total = hasPdf ? Math.max(1, pdfTotal) : fakePages.length;
  const pagerReady = !hasPdf || (pdfTotal > 0 && !pdfLoading);

  return (
    <div ref={rootRef} style={{
      position:"fixed", inset: 0, background:"var(--bg)", zIndex: 100,
      display:"flex", flexDirection:"column",
      userSelect:"none", WebkitUserSelect:"none", MozUserSelect:"none",
    }}>
      {/* Top bar */}
      <header className="reader-toolbar" style={{
        display:"flex", alignItems:"center", justifyContent:"space-between", gap: 16,
        padding:"14px 24px",
        borderBottom:"1px solid var(--line)",
        background:"var(--surface)",
        flex:"0 0 auto",
      }}>
        <div className="row" style={{gap: 14, minWidth: 0}}>
          <button className="btn" onClick={exitReader}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            {isAdmin ? "Painel" : "Biblioteca"}
          </button>
          <div className="row" style={{gap: 12, minWidth: 0}}>
            <I size={32}/>
            <div style={{minWidth: 0}}>
              <div className="mono" style={{fontSize: 10, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".1em"}}>{area.name}</div>
              <div className="display" style={{fontSize: 16, fontWeight: 700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{r.title}</div>
            </div>
          </div>
          {isAdmin && !testAsUser && (
            <span className="pill" style={{background:"var(--fg)", color:"var(--bg)", borderColor:"var(--fg)"}}>
              ★ Modo revisão
            </span>
          )}
          {isAdmin && (
            <button
              className={testAsUser ? "btn primary" : "btn"}
              onClick={()=>setTestAsUser(s=>!s)}
              style={{fontSize: 12, padding:"6px 12px"}}
              title={testAsUser ? "Voltar ao modo de revisão (sem proteções)" : "Simula a experiência do usuário normal"}
            >
              {testAsUser ? "← Sair do teste" : "Testar como usuário"}
            </button>
          )}
        </div>

        <div className="row" style={{gap: 10, alignItems:"center"}}>
          <div className="mono" style={{fontSize: 12, color:"var(--muted)"}}>{currentUser.email}</div>
          <span className="pill" style={{background:"var(--acc-2)", borderColor:"transparent"}}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Proteção ativa
          </span>
          {revealed && (
            <button
              className="btn ghost"
              onClick={async () => {
                if (document.fullscreenElement){ try { await document.exitFullscreen(); } catch {} }
                else if (rootRef.current?.requestFullscreen){ try { await rootRef.current.requestFullscreen(); } catch {} }
              }}
              aria-label="Tela cheia"
              title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
              style={{padding: 10}}
            >
              {isFullscreen ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
              )}
            </button>
          )}
          <button className="btn ghost" onClick={()=>setShowHelp(s=>!s)} aria-label="Ajuda" style={{padding: 10}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/></svg>
          </button>
        </div>
      </header>

      {/* Help popover */}
      {showHelp && (
        <div style={{position:"absolute", top: 60, right: 16, background:"var(--surface)", border:"1px solid var(--line)", borderRadius: 14, padding: 18, boxShadow:"var(--shadow-pop)", zIndex: 110, maxWidth: 320, fontSize: 13.5, lineHeight: 1.5}}>
          <div className="display" style={{fontSize: 15, fontWeight: 700, marginBottom: 8}}>Atalhos</div>
          <div className="col" style={{gap: 6, color:"var(--muted)"}}>
            <div className="row between"><span>Clique do lado</span><span className="mono">esquerda / direita</span></div>
            <div className="row between"><span>Próxima página</span><span className="mono">→ ou Espaço</span></div>
            <div className="row between"><span>Página anterior</span><span className="mono">←</span></div>
            <div className="row between"><span>Zoom</span><span className="mono">Ctrl + scroll · + / − / 0</span></div>
            <div className="row between"><span>Sair</span><span className="mono">Esc</span></div>
          </div>
          <div style={{borderTop:"1px solid var(--line)", marginTop: 12, paddingTop: 12, color:"var(--muted)", fontSize: 12}}>
            Conteúdo bloqueado contra cópia, download e screenshot fácil. Cada página tem watermark único com seu email.
          </div>
        </div>
      )}

      {/* Page area */}
      <div style={{flex:"1 1 auto", overflow:"hidden", position:"relative", display:"flex", alignItems:"center", justifyContent:"center", padding: 16}}>

        <div ref={frameRef} className="pdf-reader-frame"
             style={{
          width: "min(1100px, 100%)",
          height: "100%",
          maxHeight: "100%",
          background: hasPdf ? "var(--bg)" : "var(--surface)",
          border:"1px solid var(--line)",
          borderRadius: 14,
          boxShadow:"var(--shadow-pop)",
          position:"relative",
          overflow: hasPdf ? "auto" : "hidden",
          display: "block",
          filter: (hasPdf && !revealed && !effAdmin) ? "blur(18px) saturate(.7)" : undefined,
          transition: "filter .3s ease",
          pointerEvents: (hasPdf && !revealed && !effAdmin) ? "none" : "auto",
        }}>
          {/* Modo fake/demo só pra placeholder visual quando não tem PDF — sem watermark.
              Watermark de verdade vai direto no canvas quando hasPdf. */}
          {hasPdf ? (
            <>
              {pdfLoading && (
                <div style={{position:"absolute", inset: 0, display:"flex", alignItems:"center", justifyContent:"center", zIndex: 2}}>
                  <Spinner label="carregando pdf"/>
                </div>
              )}
              {pdfError && (
                <div style={{padding: 40, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap: 10, textAlign:"center"}}>
                  <div className="display" style={{fontSize: 18, color:"var(--primary)", fontWeight: 700}}>{pdfError}</div>
                  <div className="mono" style={{fontSize: 12, color:"var(--muted)"}}>O link assinado pode ter expirado. Recarregue a página.</div>
                </div>
              )}
              <div style={{padding: 12, display:"flex", justifyContent:"center"}}>
                <canvas
                  ref={canvasRef}
                  style={{ display:"block", borderRadius: 4, position:"relative", zIndex: 1, boxShadow:"0 1px 0 rgba(0,0,0,.04), 0 6px 16px -8px rgba(0,0,0,.15)" }}
                  draggable="false"
                />
              </div>
            </>
          ) : (
            <div key={page} style={{position:"absolute", inset: 0, padding:"clamp(28px, 4vw, 56px)", display:"flex", flexDirection:"column", animation:"pageIn .25s cubic-bezier(.2,.7,.1,1)"}}>
              <PageContent page={fakePages[page]} resumo={r} area={area} I={I} pageNum={page+1} total={total}/>
            </div>
          )}
        </div>

        {/* Reveal gate — modal sobre o blur com botão "Visualizar conteúdo" */}
        {hasPdf && !revealed && !effAdmin && (
          <div style={{
            position:"absolute", inset: 0, zIndex: 50,
            display:"flex", alignItems:"center", justifyContent:"center",
            background: "color-mix(in oklab, var(--bg) 30%, transparent)",
            backdropFilter:"blur(4px)", WebkitBackdropFilter:"blur(4px)",
          }}>
            <div className="card" style={{padding: 32, textAlign:"center", maxWidth: 420, animation:"pageIn .35s cubic-bezier(.2,.7,.1,1)", background:"var(--surface)"}}>
              <div style={{display:"flex", justifyContent:"center", marginBottom: 18}}>
                <div style={{width: 56, height: 56, borderRadius: 16, background:"var(--primary)", display:"flex", alignItems:"center", justifyContent:"center"}}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--primary-ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </div>
              </div>
              <div className="display" style={{fontSize: 22, fontWeight: 700, marginBottom: 8}}>Pronto pra ler?</div>
              <p style={{color:"var(--muted)", fontSize: 14.5, marginBottom: 22, lineHeight: 1.55}}>
                Vou abrir o resumo em <b style={{color:"var(--fg)"}}>tela cheia</b> pra você ter a melhor experiência. Clique no lado direito da página pra avançar e no esquerdo pra voltar.
              </p>
              <button className="btn primary lg" onClick={reveal} style={{justifyContent:"center", width:"100%", padding:"14px 18px", fontSize: 15}}>
                Visualizar conteúdo
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
              </button>
              <div className="mono" style={{fontSize: 11, color:"var(--muted)", marginTop: 14}}>
                Toda página fica marcada com seu email. Vazamento é rastreável.
              </div>
            </div>
          </div>
        )}

        {/* Click zones — só ativas quando conteúdo está revelado */}
        {hasPdf && revealed && (
          <>
            <button
              onClick={goPrev}
              disabled={page===0}
              aria-label="Página anterior"
              style={{
                position:"absolute", left: 0, top: 0, bottom: 0, width:"22%",
                background:"transparent", border: 0, cursor: page===0 ? "default" : "w-resize",
                zIndex: 30, padding: 0,
                opacity: page===0 ? 0 : 1,
              }}
              className="reader-zone reader-zone-prev"
            >
              <ZoneHint dir="prev"/>
            </button>
            <button
              onClick={goNext}
              disabled={page===total-1}
              aria-label="Próxima página"
              style={{
                position:"absolute", right: 0, top: 0, bottom: 0, width:"22%",
                background:"transparent", border: 0, cursor: page===total-1 ? "default" : "e-resize",
                zIndex: 30, padding: 0,
                opacity: page===total-1 ? 0 : 1,
              }}
              className="reader-zone reader-zone-next"
            >
              <ZoneHint dir="next"/>
            </button>
          </>
        )}
      </div>

      {/* Bottom pager — esconde durante carregamento do PDF pra não mostrar 0/0 */}
      {pagerReady && <footer className="reader-toolbar" style={{
        flex:"0 0 auto",
        padding:"12px 24px",
        borderTop:"1px solid var(--line)",
        background:"var(--surface)",
        display:"flex", alignItems:"center", justifyContent:"space-between", gap: 16,
      }}>
        <div className="mono" style={{fontSize: 12, color:"var(--muted)"}}>
          Página <b style={{color:"var(--fg)"}}>{page+1}</b> de {total}
        </div>
        <div style={{flex: 1, height: 4, background:"var(--bg)", borderRadius: 999, overflow:"hidden", maxWidth: 280}}>
          <div style={{height:"100%", width: `${((page+1)/total)*100}%`, background:"var(--primary)", borderRadius: 999, transition:"width .25s ease"}}/>
        </div>
        {hasPdf && (
          <div className="row" style={{gap: 4}}>
            <button className="btn ghost" title="Diminuir zoom" onClick={()=>setScale(s=>Math.max(.5, s-0.15))} style={{padding: 8}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M7 11h8"/></svg>
            </button>
            <div className="mono" style={{fontSize: 11, color:"var(--muted)", width: 44, textAlign:"center"}}>
              {Math.round(scale*100)}%
            </div>
            <button className="btn ghost" title="Aumentar zoom" onClick={()=>setScale(s=>Math.min(3, s+0.15))} style={{padding: 8}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M11 7v8M7 11h8"/></svg>
            </button>
          </div>
        )}
        <div className="row" style={{gap: 8}}>
          <button className="btn reader-nav-btn" disabled={page===0} onClick={()=>setPage(p=>Math.max(0,p-1))} style={{opacity: page===0?.4:1}}>← Anterior</button>
          <button className="btn primary reader-nav-btn" disabled={page===total-1} onClick={()=>setPage(p=>Math.min(total-1, p+1))} style={{opacity: page===total-1?.4:1}}>Próxima →</button>
        </div>
        {r.quiz_json?.questions?.length > 0 && (
          <button className="btn" onClick={()=>setShowQuiz(true)} style={{display:"flex", alignItems:"center", gap: 6, fontSize: 13}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/></svg>
            Questionário
          </button>
        )}
      </footer>}

      {/* Quiz modal */}
      {showQuiz && <QuizModal quiz={r.quiz_json} title={r.title} onClose={()=>setShowQuiz(false)}/>}

      {/* Flash banner — shows when blocked action attempted */}
      {flashOn && (
        <div style={{position:"fixed", top: 80, left:"50%", transform:"translateX(-50%)", background:"var(--fg)", color:"var(--bg)", padding:"12px 20px", borderRadius: 999, fontSize: 13.5, fontWeight: 600, boxShadow:"var(--shadow-pop)", zIndex: 200, animation:"pageIn .2s ease"}}>
          🔒 Conteúdo protegido — sua tentativa foi registrada
        </div>
      )}

      {/* Terms of use modal */}
      {showTerms && currentUser && !effAdmin && (
        <TermsModal user={currentUser} onAccept={()=>setShowTerms(false)} onDecline={()=>go({ name:"library" })}/>
      )}

      {/* Device bind modal — primeiro acesso após compra */}
      {!showTerms && !termsChecking && deviceStatus === "unbound" && currentUser && !effAdmin && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",backdropFilter:"blur(6px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
          <div style={{background:"var(--surface)",border:"1px solid var(--line)",borderRadius:"var(--radius-lg)",padding:36,maxWidth:440,width:"100%",boxShadow:"var(--shadow-pop)"}}>
            <div style={{fontSize:32,marginBottom:16,textAlign:"center"}}>🔒</div>
            <h2 style={{margin:"0 0 10px",fontSize:21,fontWeight:700,textAlign:"center"}}>Vincular dispositivo</h2>
            <p style={{color:"var(--muted)",fontSize:14.5,lineHeight:1.6,textAlign:"center",margin:"0 0 20px"}}>
              Antes de abrir seu primeiro resumo, vincule um dispositivo à sua conta.
            </p>
            <div style={{background:"var(--bg)",border:"1px solid var(--line-strong)",borderRadius:12,padding:"14px 18px",textAlign:"center",marginBottom:20}}>
              <div style={{fontSize:13,color:"var(--muted)",marginBottom:4}}>Dispositivo detectado</div>
              <div style={{fontWeight:700,fontSize:16}}>{getDeviceName()}</div>
            </div>
            <p style={{fontSize:12.5,color:"var(--muted)",lineHeight:1.55,textAlign:"center",marginBottom:24}}>
              A partir de agora, seus resumos só poderão ser acessados neste dispositivo. Para trocar, entre em contato com o suporte.
            </p>
            <button className="btn primary lg" style={{width:"100%",justifyContent:"center"}} onClick={async ()=>{
              const r2 = await saveDeviceFingerprint(currentUser.id, currentFp, getDeviceName());
              if (!r2.error) setDeviceStatus("ok");
            }}>
              Vincular este dispositivo →
            </button>
          </div>
        </div>
      )}

      {/* Tela de bloqueio — dispositivo diferente */}
      {!showTerms && !termsChecking && deviceStatus === "blocked" && currentUser && !effAdmin && (
        <div style={{position:"fixed",inset:0,background:"var(--bg)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
          <div style={{maxWidth:420,width:"100%",textAlign:"center"}}>
            <div style={{fontSize:48,marginBottom:20}}>🔒</div>
            <h2 style={{margin:"0 0 12px",fontSize:24,fontWeight:700}}>Acesso bloqueado</h2>
            <p style={{color:"var(--muted)",fontSize:15,lineHeight:1.65,marginBottom:8}}>
              Esta conta está vinculada a:
            </p>
            <div style={{display:"inline-block",background:"var(--surface)",border:"1px solid var(--line-strong)",borderRadius:10,padding:"10px 20px",fontWeight:700,fontSize:15,marginBottom:24}}>
              {currentUser.device_name || "outro dispositivo"}
            </div>
            <p style={{color:"var(--muted)",fontSize:14,lineHeight:1.6,marginBottom:28}}>
              Se quiser trocar de dispositivo, abra um ticket de suporte. Sua solicitação será analisada pela equipe.
            </p>
            <button className="btn primary lg" style={{width:"100%",justifyContent:"center",marginBottom:12}} onClick={()=>{
              sessionStorage.setItem("ticket_prefill", JSON.stringify({subject:"acesso", message:"Preciso trocar o dispositivo vinculado à minha conta.\n\nDispositivo atual: " + getDeviceName()}));
              go({name:"profile"});
            }}>
              Solicitar troca de dispositivo
            </button>
            <button className="btn lg" style={{width:"100%",justifyContent:"center"}} onClick={()=>go({name:"library"})}>
              Voltar à biblioteca
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TermsModal({ user, onAccept, onDecline }){
  const [checked, setChecked] = useStateLib(false);

  const accept = () => {
    if (!checked) return;
    onAccept();
  };

  return (
    <div style={{
      position:"fixed", inset: 0, zIndex: 300,
      background:"rgba(0,0,0,.55)", backdropFilter:"blur(8px)", WebkitBackdropFilter:"blur(8px)",
      display:"flex", alignItems:"center", justifyContent:"center",
      padding:"24px", animation:"pageIn .25s ease",
    }}>
      <div style={{
        background:"var(--surface)", borderRadius:"var(--radius-lg)",
        border:"1px solid var(--line)", boxShadow:"var(--shadow-pop)",
        width:"100%", maxWidth: 580, padding: 0, overflow:"hidden",
        animation:"pageIn .3s cubic-bezier(.2,.7,.1,1)",
      }}>
        <div style={{padding:"26px 30px 18px", borderBottom:"1px solid var(--line)", display:"flex", gap: 14, alignItems:"center"}}>
          <div style={{width: 44, height: 44, borderRadius: 12, background:"var(--primary)", display:"flex", alignItems:"center", justifyContent:"center"}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary-ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div>
            <div className="mono" style={{fontSize: 11, textTransform:"uppercase", letterSpacing:".1em", color:"var(--primary)", marginBottom: 4}}>
              Lembrete a cada acesso
            </div>
            <div className="display" style={{fontSize: 22, fontWeight: 700, lineHeight: 1.1}}>
              Termo de uso anti-vazamento
            </div>
          </div>
        </div>

        <div style={{padding:"22px 30px", fontSize: 14.5, color:"var(--fg)", lineHeight: 1.6}}>
          <p style={{margin: 0, marginBottom: 14}}>
            Os resumos da <b>resumosmed</b> são protegidos por direitos autorais e licenciados <b>apenas para uso pessoal</b>. Ao continuar, você concorda que:
          </p>

          <ul style={{margin: 0, padding: 0, listStyle:"none", display:"flex", flexDirection:"column", gap: 10, marginBottom: 16}}>
            <TermsItem n="01" t="Não compartilhar, distribuir ou revender" d="Não posso passar o PDF nem trechos pra colegas, grupos de WhatsApp/Telegram/Discord, redes sociais ou qualquer site."/>
            <TermsItem n="02" t="Não imprimir, capturar tela nem fotografar" d="Toda página tem watermark com meu email, ID e horário. Se vazar, é fácil identificar de quem saiu."/>
            <TermsItem n="03" t="Atividade é registrada" d="O sistema registra tentativas de cópia, print, abertura em outras janelas e uso de ferramentas suspeitas."/>
            <TermsItem n="04" t="Em caso de vazamento" d="Conta é suspensa imediatamente, sem reembolso, e o conteúdo vazado pode ser usado como prova em ação legal por violação de direitos autorais (Lei 9.610/98)."/>
          </ul>

          <div style={{padding: 12, background:"var(--bg)", borderRadius: 10, border:"1px dashed var(--line-strong)", fontSize: 12.5, color:"var(--muted)", lineHeight: 1.55}}>
            <b style={{color:"var(--fg)"}}>Watermark do seu acesso:</b>
            <div className="mono" style={{marginTop: 6, color:"var(--fg)", fontSize: 11.5}}>{user.email} · {user.id?.slice(0,8)} · {new Date().toLocaleString("pt-BR")}</div>
          </div>

          <label style={{display:"flex", gap: 10, marginTop: 18, cursor:"pointer", alignItems:"flex-start"}}>
            <input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)} style={{marginTop: 3, width: 16, height: 16, accentColor:"var(--primary)"}}/>
            <span style={{fontSize: 13.5, lineHeight: 1.5}}>Li e aceito os termos. Entendo que minhas ações no leitor são registradas e que vazamento causa suspensão imediata da conta.</span>
          </label>
        </div>

        <div style={{padding:"16px 30px", borderTop:"1px solid var(--line)", display:"flex", justifyContent:"flex-end", gap: 10}}>
          <button className="btn" onClick={onDecline}>Não aceito</button>
          <button className="btn primary" onClick={accept} disabled={!checked} style={{opacity: !checked?.5:1}}>
            Aceito e continuar
          </button>
        </div>
      </div>
    </div>
  );
}

function TermsItem({ n, t, d }){
  return (
    <li style={{display:"flex", gap: 12, padding: 12, background:"var(--bg)", borderRadius: 10, alignItems:"flex-start"}}>
      <div className="mono" style={{fontSize: 11, color:"var(--primary)", fontWeight: 700, letterSpacing:".06em", paddingTop: 2, minWidth: 22}}>{n}</div>
      <div>
        <div style={{fontWeight: 700, fontSize: 14}}>{t}</div>
        <div style={{fontSize: 13, color:"var(--muted)", marginTop: 2}}>{d}</div>
      </div>
    </li>
  );
}

function ZoneHint({ dir }){
  return (
    <span className="reader-zone-arrow" style={{
      position:"absolute", top:"50%", transform:"translateY(-50%)",
      [dir==="prev"?"left":"right"]: 18,
      width: 48, height: 48, borderRadius: 999,
      background:"color-mix(in oklab, var(--surface) 88%, transparent)",
      border:"1px solid var(--line-strong)",
      display:"inline-flex", alignItems:"center", justifyContent:"center",
      color:"var(--fg)", boxShadow:"var(--shadow-card)",
      opacity: 0, transition:"opacity .15s ease, transform .15s ease",
      pointerEvents:"none",
    }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        {dir==="prev" ? <path d="M15 18l-6-6 6-6"/> : <path d="M9 18l6-6-6-6"/>}
      </svg>
    </span>
  );
}

// ─────────── Page content (mock book pages) ───────────
function buildPages(r){
  const topics = r.topics || ["Conceitos","Diagnóstico","Tratamento","Referências"];
  return [
    { type: "cover" },
    { type: "index", topics },
    ...topics.map((t, i)=>({ type: "content", topic: t, idx: i+1, total: topics.length })),
    { type: "tips" },
    { type: "refs" },
  ];
}

function PageContent({ page, resumo, area, I, pageNum, total }){
  if (page.type === "cover") return <PageCover r={resumo} area={area} I={I}/>;
  if (page.type === "index") return <PageIndex topics={page.topics} area={area}/>;
  if (page.type === "content") return <PageTopic topic={page.topic} idx={page.idx} total={page.total} area={area}/>;
  if (page.type === "tips") return <PageTips r={resumo} area={area}/>;
  if (page.type === "refs") return <PageRefs/>;
  return null;
}

function PageCover({ r, area, I }){
  return (
    <div style={{flex: 1, display:"flex", flexDirection:"column"}}>
      <div className="mono" style={{fontSize: 11, color:"var(--muted)", letterSpacing:".1em", textTransform:"uppercase"}}>resumosmed · {area.name}</div>
      <div style={{flex: 1, display:"flex", flexDirection:"column", justifyContent:"center"}}>
        <I size={88}/>
        <div className="display" style={{fontSize:"clamp(36px, 5vw, 56px)", fontWeight: 700, lineHeight: 1.05, marginTop: 24}}>
          {r.title}
        </div>
        <div className="serif" style={{fontSize: 22, color:"var(--muted)", marginTop: 12}}>
          Um resumo de medicina, direto ao ponto.
        </div>
      </div>
      <div className="row between" style={{paddingTop: 24, borderTop:"1.5px solid var(--fg)"}}>
        <div className="mono" style={{fontSize: 11, color:"var(--muted)"}}>v1.0 · atualizado {r.updated}</div>
        <div className="mono" style={{fontSize: 11, color:"var(--muted)"}}>{r.pages} páginas</div>
      </div>
    </div>
  );
}

function PageIndex({ topics, area }){
  return (
    <div style={{flex: 1, display:"flex", flexDirection:"column"}}>
      <div className="mono" style={{fontSize: 11, color:"var(--muted)", letterSpacing:".1em", textTransform:"uppercase", marginBottom: 8}}>Sumário</div>
      <div className="display" style={{fontSize: 36, fontWeight: 700, lineHeight: 1.05}}>O que tem aqui dentro</div>
      <div style={{marginTop: 32, display:"flex", flexDirection:"column", gap: 14}}>
        {topics.map((t, i)=>(
          <div key={t} className="row" style={{gap: 18, paddingBottom: 14, borderBottom:"1px dashed var(--line)", alignItems:"baseline"}}>
            <div className="mono" style={{fontSize: 13, color:"var(--primary)", fontWeight: 700, width: 32}}>{String(i+1).padStart(2,"0")}</div>
            <div className="serif" style={{fontSize: 24, flex: 1}}>{t}</div>
            <div className="mono" style={{fontSize: 12, color:"var(--muted)"}}>pg {(i+1)*4 + 2}</div>
          </div>
        ))}
      </div>
      <div style={{marginTop:"auto", padding: 18, background:"var(--bg)", borderRadius: 10, border:"1px solid var(--line)", color:"var(--muted)", fontSize: 13, lineHeight: 1.5}}>
        ★ <b style={{color:"var(--fg)"}}>Dica:</b> os quadros amarelos marcam o que mais cai na prova. Foque neles se o tempo for curto.
      </div>
    </div>
  );
}

function PageTopic({ topic, idx, total, area }){
  return (
    <div style={{flex: 1, display:"flex", flexDirection:"column"}}>
      <div className="row between" style={{marginBottom: 18}}>
        <div className="mono" style={{fontSize: 11, color:"var(--muted)", letterSpacing:".1em", textTransform:"uppercase"}}>
          {area.name} · {String(idx).padStart(2,"0")}/{String(total).padStart(2,"0")}
        </div>
      </div>
      <div className="display" style={{fontSize: 38, fontWeight: 700, lineHeight: 1.05}}>{topic}</div>
      <div className="serif" style={{fontSize: 18, color:"var(--muted)", marginTop: 8}}>O essencial em uma página.</div>

      <div style={{marginTop: 24, display:"grid", gridTemplateColumns:"1fr 1fr", gap: 18, flex: 1}}>
        <div>
          <SubH>Definição</SubH>
          <Para w={[92, 96, 80, 88]}/>
          <SubH>Quadro clínico</SubH>
          <BulletList items={["sintoma cardinal a observar","achados ao exame físico","sinais de alarme imediatos","evolução típica do caso"]}/>
        </div>
        <div>
          <SubH>Diagnóstico</SubH>
          <BulletList items={["primeiro exame a pedir","critério diagnóstico chave","diferencial principal","quando indicar imagem"]}/>
          <div style={{marginTop: 16, padding: 16, background:"var(--acc-1)", borderRadius: 10}}>
            <div className="mono" style={{fontSize: 11, fontWeight: 700, letterSpacing:".08em", textTransform:"uppercase", marginBottom: 6, color:"var(--fg)"}}>★ Cai na prova</div>
            <Para color="rgba(0,0,0,.55)" w={[94, 80]}/>
          </div>
        </div>
      </div>

      <div style={{marginTop: 18}}>
        <SubH>Tratamento</SubH>
        <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap: 10}}>
          {["Primeira linha","Segunda linha","Refratário"].map(s=>(
            <div key={s} style={{padding: 12, background:"var(--bg)", borderRadius: 10, border:"1px solid var(--line)"}}>
              <div className="mono" style={{fontSize: 10, fontWeight: 700, color:"var(--primary)", textTransform:"uppercase", letterSpacing:".08em", marginBottom: 6}}>{s}</div>
              <Para w={[80,60]} small/>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PageTips({ r, area }){
  return (
    <div style={{flex: 1, display:"flex", flexDirection:"column"}}>
      <div className="mono" style={{fontSize: 11, color:"var(--muted)", letterSpacing:".1em", textTransform:"uppercase"}}>Resumo do resumo</div>
      <div className="display" style={{fontSize: 36, fontWeight: 700, lineHeight: 1.05, marginTop: 6}}>Pra levar pra prova</div>

      <div style={{marginTop: 24, display:"grid", gridTemplateColumns:"1fr 1fr", gap: 14}}>
        {(r.topics||[]).slice(0,4).map((t,i)=>(
          <div key={t} className="row" style={{gap: 12, padding: 16, background:"var(--bg)", borderRadius: 12, border:"1px solid var(--line)", alignItems:"flex-start"}}>
            <div className="display" style={{fontSize: 28, fontWeight: 700, color:"var(--primary)", lineHeight: 1}}>{i+1}</div>
            <div>
              <div className="display" style={{fontSize: 16, fontWeight: 700, marginBottom: 4}}>{t}</div>
              <Para w={[90,70]} small/>
            </div>
          </div>
        ))}
      </div>

      <div style={{marginTop: 18, padding: 20, background:"var(--fg)", color:"var(--bg)", borderRadius: 14}}>
        <div className="mono" style={{fontSize: 11, fontWeight: 700, letterSpacing:".08em", textTransform:"uppercase", marginBottom: 8, color:"var(--acc-1)"}}>Mnemônico</div>
        <div className="serif" style={{fontSize: 26, lineHeight: 1.15}}>Pega a primeira letra de cada conceito acima — funciona melhor que decoreba.</div>
      </div>
    </div>
  );
}

function PageRefs(){
  return (
    <div style={{flex: 1, display:"flex", flexDirection:"column"}}>
      <div className="mono" style={{fontSize: 11, color:"var(--muted)", letterSpacing:".1em", textTransform:"uppercase"}}>Referências</div>
      <div className="display" style={{fontSize: 36, fontWeight: 700, lineHeight: 1.05, marginTop: 6}}>De onde veio isso</div>
      <div style={{marginTop: 24, display:"flex", flexDirection:"column", gap: 14}}>
        {[
          ["Diretrizes nacionais", "Sociedade Brasileira da especialidade · última atualização."],
          ["Diretrizes internacionais", "Consensus statement · ESC/ACC/ADA conforme tema."],
          ["Livros-texto", "Capítulos relevantes do Goldman / Harrison / Kumar e Clark."],
          ["Aulas e revisões", "Materiais da faculdade + revisões de residência."],
        ].map(([t, d])=>(
          <div key={t} style={{paddingBottom: 14, borderBottom:"1px dashed var(--line)"}}>
            <div className="display" style={{fontSize: 16, fontWeight: 700}}>{t}</div>
            <div style={{color:"var(--muted)", fontSize: 13.5, marginTop: 4}}>{d}</div>
          </div>
        ))}
      </div>
      <div style={{marginTop:"auto", display:"flex", justifyContent:"center", alignItems:"center", paddingTop: 24}}>
        <Logo size={28}/>
      </div>
    </div>
  );
}

// ─────────── Atoms ───────────
function SubH({ children }){
  return <div className="display" style={{fontSize: 13, fontWeight: 700, letterSpacing:".02em", color:"var(--primary)", textTransform:"uppercase", marginTop: 14, marginBottom: 8}}>{children}</div>;
}
function Para({ w=[90,80,70], color="rgba(0,0,0,.7)", small }){
  return (
    <div style={{display:"flex", flexDirection:"column", gap: small?5:6}}>
      {w.map((p,i)=>(
        <div key={i} style={{height: small?7:9, width: `${p}%`, background:"rgba(0,0,0,.08)", borderRadius: 4}}/>
      ))}
    </div>
  );
}
function BulletList({ items }){
  return (
    <ul style={{listStyle:"none", padding: 0, margin: 0, display:"flex", flexDirection:"column", gap: 8}}>
      {items.map((t, i)=>(
        <li key={i} className="row" style={{gap: 8, fontSize: 13.5, color:"var(--fg)", alignItems:"baseline"}}>
          <span style={{color:"var(--primary)", fontWeight: 700, lineHeight: 1}}>›</span>
          <span style={{opacity:.78}}>{t}</span>
        </li>
      ))}
    </ul>
  );
}

// ─────────── Quiz Modal ───────────
function QuizModal({ quiz, title, onClose }){
  const questions = quiz?.questions || [];
  const totalQ = questions.length;
  const [current, setCurrent] = useStateLib(0);
  const [answers, setAnswers] = useStateLib({});
  const [phase, setPhase] = useStateLib("quiz");

  const q = questions[current];
  const answered = answers[current];
  const allAnswered = Object.keys(answers).length === totalQ;

  const select = (letter) => {
    if (answered) return;
    setAnswers(prev => ({...prev, [current]: letter}));
  };

  const next = () => {
    if (current < totalQ - 1) setCurrent(c => c + 1);
    else setPhase("results");
  };

  const reset = () => { setCurrent(0); setAnswers({}); setPhase("quiz"); };

  const score = questions.filter((q, i) => q.correct === answers[i]).length;
  const pct = totalQ > 0 ? Math.round((score / totalQ) * 100) : 0;
  const scoreColor = pct >= 80 ? "#22c55e" : pct >= 60 ? "#f59e0b" : "var(--primary)";

  const optionLabels = ["a","b","c","d","e"];

  const optionStyle = (letter) => {
    if (!answered){
      return { background:"var(--bg)", border:"1.5px solid var(--line-strong)", color:"var(--fg)", cursor:"pointer" };
    }
    if (letter === q.correct){
      return { background:"#dcfce7", border:"1.5px solid #22c55e", color:"#166534", cursor:"default" };
    }
    if (letter === answered){
      return { background:"#fee2e2", border:"1.5px solid var(--primary)", color:"var(--primary)", cursor:"default" };
    }
    return { background:"var(--bg)", border:"1.5px solid var(--line)", color:"var(--muted)", cursor:"default", opacity:.7 };
  };

  return (
    <div style={{position:"fixed", inset:0, zIndex:250, background:"rgba(0,0,0,.6)", backdropFilter:"blur(6px)", WebkitBackdropFilter:"blur(6px)", display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"40px 20px", overflowY:"auto", animation:"pageIn .2s ease"}}
      onClick={(e)=>{ if (e.target===e.currentTarget) onClose(); }}>
      <div style={{background:"var(--surface)", borderRadius:"var(--radius-lg)", border:"1px solid var(--line)", boxShadow:"var(--shadow-pop)", width:"100%", maxWidth:680, overflow:"hidden", animation:"pageIn .25s cubic-bezier(.2,.7,.1,1)"}}>

        {/* Header */}
        <div style={{padding:"20px 26px 16px", borderBottom:"1px solid var(--line)", display:"flex", alignItems:"center", justifyContent:"space-between", gap:14}}>
          <div style={{minWidth:0}}>
            <div className="mono" style={{fontSize:11, textTransform:"uppercase", letterSpacing:".1em", color:"var(--primary)", marginBottom:4}}>Questionário</div>
            <div className="display" style={{fontSize:18, fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{title}</div>
          </div>
          <div className="row" style={{gap:12, flexShrink:0}}>
            {phase === "quiz" && (
              <div className="mono" style={{fontSize:13, color:"var(--muted)", fontWeight:600}}>{current+1} / {totalQ}</div>
            )}
            <button onClick={onClose} aria-label="Fechar" style={{width:34, height:34, borderRadius:999, border:"1px solid var(--line)", background:"var(--bg)", color:"var(--fg)", display:"inline-flex", alignItems:"center", justifyContent:"center", cursor:"pointer"}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        {/* Body */}
        {phase === "quiz" && q && (
          <div style={{padding:"24px 26px"}}>
            {/* Progress bar */}
            <div style={{height:4, background:"var(--bg)", borderRadius:999, marginBottom:22, overflow:"hidden"}}>
              <div style={{height:"100%", width:`${((current+1)/totalQ)*100}%`, background:"var(--primary)", borderRadius:999, transition:"width .3s ease"}}/>
            </div>

            {/* Question */}
            <div className="display" style={{fontSize:17, fontWeight:700, lineHeight:1.5, marginBottom:20}}>
              {q.text}
            </div>

            {/* Options */}
            <div style={{display:"flex", flexDirection:"column", gap:10}}>
              {optionLabels.map(letter => {
                const opt = q.options?.[letter];
                if (!opt) return null;
                const style = optionStyle(letter);
                return (
                  <button key={letter} onClick={()=>select(letter)} style={{
                    display:"flex", alignItems:"flex-start", gap:12, padding:"12px 16px",
                    borderRadius:12, fontFamily:"inherit", textAlign:"left", fontSize:14.5,
                    lineHeight:1.5, transition:"all .12s ease",
                    ...style,
                  }}>
                    <span style={{fontFamily:"var(--font-mono)", fontWeight:700, fontSize:13, marginTop:1, minWidth:18}}>
                      {letter.toUpperCase()}
                    </span>
                    <span>{opt}</span>
                    {answered && letter === q.correct && <span style={{marginLeft:"auto", flexShrink:0}}>✓</span>}
                    {answered && letter === answered && letter !== q.correct && <span style={{marginLeft:"auto", flexShrink:0}}>✗</span>}
                  </button>
                );
              })}
            </div>

            {/* Explanation */}
            {answered && q.explanation && (
              <div style={{marginTop:18, padding:"14px 16px", background:"var(--bg)", borderRadius:12, border:"1px solid var(--line)", fontSize:14, lineHeight:1.65, color:"var(--fg)"}}>
                <div className="mono" style={{fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:".08em", color:"var(--primary)", marginBottom:8}}>Explicação</div>
                {q.explanation}
              </div>
            )}

            {answered && (
              <div style={{marginTop:18, display:"flex", justifyContent:"flex-end"}}>
                <button className="btn primary" onClick={next} style={{padding:"10px 22px", fontSize:14}}>
                  {current < totalQ - 1 ? "Próxima →" : "Ver resultado →"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {phase === "results" && (
          <div style={{padding:"24px 26px"}}>
            {/* Score */}
            <div style={{textAlign:"center", marginBottom:28}}>
              <div className="display" style={{fontSize:52, fontWeight:700, color:scoreColor, lineHeight:1}}>{score} / {totalQ}</div>
              <div style={{fontSize:17, color:"var(--muted)", marginTop:8}}>{pct}% de acerto</div>
              <div style={{height:10, background:"var(--bg)", borderRadius:999, margin:"16px auto 0", maxWidth:280, overflow:"hidden"}}>
                <div style={{height:"100%", width:`${pct}%`, background:scoreColor, borderRadius:999, transition:"width .5s ease"}}/>
              </div>
              <div style={{fontSize:13, color:"var(--muted)", marginTop:10}}>
                {pct >= 80 ? "Excelente! Você domina o conteúdo." : pct >= 60 ? "Bom resultado! Revise os pontos errados." : "Continue estudando — releia o resumo e refaça o quiz."}
              </div>
            </div>

            {/* Question breakdown */}
            <div style={{display:"flex", flexDirection:"column", gap:8, maxHeight:"44vh", overflowY:"auto"}}>
              {questions.map((q, i) => {
                const userAns = answers[i];
                const correct = userAns === q.correct;
                return (
                  <div key={i} style={{display:"flex", alignItems:"flex-start", gap:12, padding:"12px 14px", borderRadius:10, border:`1px solid ${correct ? "#22c55e" : "var(--primary)"}`, background:correct ? "#f0fdf4" : "#fef2f2"}}>
                    <div style={{fontSize:16, flexShrink:0, marginTop:1}}>{correct ? "✓" : "✗"}</div>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:13.5, fontWeight:600, lineHeight:1.4, marginBottom:4}}>{q.text}</div>
                      <div className="mono" style={{fontSize:12, color: correct ? "#166534" : "var(--primary)"}}>
                        Sua resposta: <b>{(userAns||"—").toUpperCase()}</b>
                        {!correct && <> · Certa: <b>{q.correct.toUpperCase()}</b></>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="row" style={{gap:10, marginTop:20, justifyContent:"flex-end"}}>
              <button className="btn" onClick={reset}>Refazer</button>
              <button className="btn primary" onClick={onClose}>Fechar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { MyLibrary, PdfReader });
