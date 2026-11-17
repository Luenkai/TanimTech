(() => {
  const page = document.querySelector("[data-plants-page]");
  if (!page) return;
  const $ = (selector) => page.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const els = {
    form: $("[data-plant-form]"), q: $("[data-plant-q]"), group: $("[data-plant-group]"), life: $("[data-plant-life]"), source: $("[data-plant-source]"),
    status: $("[data-plant-status]"), count: $("[data-plant-count]"), results: $("[data-plant-results]"), pager: $("[data-plant-pager]"),
    request: $("[data-plant-request]"), toggle: $("[data-toggle-request]"),
  };
  const LIMIT = 24;
  let pageNo = 1;
  let lastTotals = { eco: 0, trefle: null };

  const band = (b) => Array.isArray(b) && b[0] != null ? `${b[0]}–${b[1]}` : "n/a";
  const card = (p) => {
    const bands = p.bands ? `<div class="mini-row"><span class="muted">Soil pH</span><b>${band(p.bands.soilPh)}</b></div><div class="mini-row"><span class="muted">Temp °C</span><b>${band(p.bands.temperature)}</b></div><div class="mini-row"><span class="muted">Rain mm/yr</span><b>${band(p.bands.rainfall)}</b></div>` : "";
    const image = p.imageUrl ? `<img class="h-40 w-full object-cover" loading="lazy" alt="${esc(p.name)}" src="${esc(p.imageUrl)}">` : "";
    const days = p.growingDays && p.growingDays[0] ? `<small class="muted">${p.growingDays[0]}–${p.growingDays[1]} day cycle</small>` : "";
    const scorable = p.source === "trefle" ? (p.ecocropId ? '<span class="badge">SCORABLE · ECOCROP MATCH</span>' : '<span class="badge" style="background:#edf0e9">REFERENCE ONLY</span>') : '<span class="badge">ECOCROP</span>';
    return `<article class="card overflow-hidden">${image}<div class="p-5"><div class="flex items-center justify-between gap-2">${p.source === "trefle" ? '<span class="badge" style="background:#edf0e9">TREFLE</span>' : scorable}${days}</div><h2 class="serif mt-3 text-2xl">${esc(p.name)}</h2><p class="muted text-xs"><i>${esc(p.scientific)}</i>${p.category ? " · " + esc(p.category) : ""}${p.lifeForm ? " · " + esc(p.lifeForm) : ""}</p>${bands ? `<div class="mt-3">${bands}</div>` : ""}<div class="mt-3 flex flex-wrap items-center gap-2">${p.source === "trefle" ? scorable : ""}</div><button class="button mt-4" type="button" data-plant-detail="${esc(p.id)}">Details ↗</button></div></article>`;
  };

  const detailRows = (rows) => rows.filter(([, v]) => v && v !== "n/a").map(([k, v]) => `<div class="mini-row"><span class="muted">${esc(k)}</span><b>${v}</b></div>`).join("");
  const showDetail = async (id) => {
    document.querySelector("[data-plant-dialog]")?.remove();
    const dialog = document.createElement("div");
    dialog.setAttribute("data-plant-dialog", "true");
    dialog.innerHTML = `<div style="position:fixed;inset:0;background:rgb(23 75 58 / 30%);z-index:100;display:grid;place-items:center;padding:20px;overflow:auto"><section class="card" style="max-width:560px;width:100%;padding:28px;max-height:90vh;overflow:auto" role="dialog" aria-modal="true"><p class="muted text-sm" data-dialog-body>Loading…</p><button class="button button-primary mt-6" type="button" data-close>Close</button></section></div>`;
    document.body.append(dialog);
    const close = () => dialog.remove();
    dialog.querySelector("[data-close]").addEventListener("click", close);
    dialog.firstElementChild.addEventListener("click", (event) => { if (event.target === dialog.firstElementChild) close(); });
    const body = dialog.querySelector("[data-dialog-body]");
    try {
      const response = await fetch(`/api/plants/${encodeURIComponent(id)}`);
      const p = await response.json();
      if (!response.ok) throw new Error(p.error || "Could not load this plant.");
      const eco = p.source === "trefle" ? p.ecocrop : p;
      const names = (p.commonNames || []).slice(0, 10).map(esc).join(", ");
      const trefleLimits = p.toleranceLimits ? detailRows([["Tolerance: soil pH", band(p.toleranceLimits.soilPh)], ["Tolerance: temperature °C", band(p.toleranceLimits.temperature)], ["Tolerance: rainfall mm/yr", band(p.toleranceLimits.rainfall)]]) : "";
      const ecoRows = eco ? detailRows([["Optimum soil pH", band(eco.bands.soilPh)], ["Optimum temperature °C", band(eco.bands.temperature)], ["Optimum rainfall mm/yr", band(eco.bands.rainfall)], ["Crop cycle (days)", band(eco.growingDays)], ["Soil texture", esc((eco.soil?.texture || []).join(", "))], ["Drainage", esc((eco.soil?.drainage || []).join("; "))], ["Fertility", esc((eco.soil?.fertility || []).join(", "))], ["Salinity", esc((eco.soil?.salinity || []).join(", "))]]) : "";
      body.outerHTML = `<div>${p.imageUrl ? `<img class="mb-4 h-48 w-full rounded object-cover" alt="${esc(p.name)}" src="${esc(p.imageUrl)}">` : ""}<p class="eyebrow">${p.source === "trefle" ? "TREFLE" : "FAO ECOCROP"} / ${esc(p.category || (p.edibleParts || []).join(", ") || "edible plant")}</p><h2 class="serif mt-3 text-3xl">${esc(p.name)}</h2><p class="muted text-sm"><i>${esc(p.scientific)}</i>${p.family ? " · " + esc(p.family) : ""}</p>${names ? `<p class="mt-3 text-xs"><b>Also called:</b> ${names}</p>` : ""}${p.edibleParts?.length ? `<p class="mt-2 text-xs"><b>Edible parts:</b> ${esc(p.edibleParts.join(", "))}</p>` : ""}${p.toxicity ? `<div class="warning mt-3 text-xs"><b>Toxicity note:</b> ${esc(p.toxicity)}</div>` : ""}<div class="mt-4">${ecoRows}${trefleLimits}</div>${p.note ? `<p class="muted mt-4 text-xs">${esc(p.note)}</p>` : ""}<p class="muted mt-3 text-xs">${esc(p.dataSource || "")}. Requirement bands are estimates; confirm with a local adviser and a soil test.</p><a class="button mt-4" href="conditions.html">Check fit for my field ↗</a></div>`;
    } catch (error) {
      body.textContent = error.message;
    }
  };

  const run = async (resetPage = true) => {
    if (resetPage) pageNo = 1;
    const params = new URLSearchParams({ page: pageNo, limit: LIMIT });
    if (els.q.value.trim()) params.set("q", els.q.value.trim());
    if (els.group.value) params.set("group", els.group.value);
    if (els.life.value) params.set("lifeForm", els.life.value);
    params.set("source", els.source.value);
    const url = `/api/plants/search?${params}`;
    els.request.textContent = `GET ${url}`;
    els.results.innerHTML = '<p class="muted text-sm">Loading…</p>';
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The plant search failed.");
      const eco = data.plants || [];
      const trefle = data.trefle?.items || [];
      lastTotals = { eco: data.count ?? 0, trefle: data.trefle?.total ?? null };
      els.results.innerHTML = eco.length || trefle.length ? [...eco, ...trefle].map(card).join("") : '<p class="muted text-sm">No edible plants matched. Try another name (English, Filipino or scientific) or clear the filters.</p>';
      const parts = [];
      if (data.plants) parts.push(`${data.count} in the ECOCROP catalog`);
      if (data.trefle?.configured && !data.trefle.error) parts.push(`${data.trefle.total ?? trefle.length} on Trefle`);
      els.count.textContent = parts.join(" · ");
      if (data.trefle?.error) els.count.textContent += ` · Trefle: ${data.trefle.error}`;
      const pages = Math.max(1, Math.ceil(Math.max(data.count || 0, data.trefle?.total || 0) / LIMIT));
      els.pager.innerHTML = pages > 1 ? `<button class="button" type="button" data-prev ${pageNo <= 1 ? "disabled" : ""}>← Previous</button><span class="muted text-xs">Page ${pageNo} of ${pages}</span><button class="button" type="button" data-next ${pageNo >= pages ? "disabled" : ""}>Next →</button>` : "";
      els.pager.querySelector("[data-prev]")?.addEventListener("click", () => { pageNo -= 1; run(false); window.scrollTo({ top: 0, behavior: "smooth" }); });
      els.pager.querySelector("[data-next]")?.addEventListener("click", () => { pageNo += 1; run(false); window.scrollTo({ top: 0, behavior: "smooth" }); });
    } catch (error) {
      els.results.innerHTML = `<div class="warning text-sm">${esc(error.message)}</div>`;
      els.pager.innerHTML = "";
      els.count.textContent = "";
    }
  };

  els.form.addEventListener("submit", (event) => { event.preventDefault(); run(); });
  [els.group, els.life, els.source].forEach((el) => el.addEventListener("change", () => run()));
  els.results.addEventListener("click", (event) => {
    const button = event.target.closest("[data-plant-detail]");
    if (button) showDetail(button.dataset.plantDetail);
  });
  els.toggle.addEventListener("click", () => {
    els.request.classList.toggle("hidden");
    els.toggle.textContent = els.request.classList.contains("hidden") ? "Show API request ↗" : "Hide API request";
  });

  fetch("/api/plants/status").then((r) => r.json()).then((s) => {
    els.status.innerHTML = `<b>Data sources</b> · ECOCROP catalog: ${s.ecocrop.available ? `${s.ecocrop.count} edible plants (always available)` : "not installed"} · Trefle live API: ${s.trefle.configured ? "connected" : `not configured. ${esc(s.trefle.setup)}`}`;
  }).catch(() => { els.status.textContent = "The plant API is not reachable. Start the backend (python app.py) to use the explorer."; });
  run();
})();
