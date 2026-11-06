(() => {
  "use strict";

  const SITE = window.SITE || {};
  const PROJECTS = window.PROJECTS || [];
  const PUBS = window.PUBLICATIONS || [];
  const NEWS = window.NEWS || [];
  const body = document.body;
  const base = body.dataset.base || "";
  const page = body.dataset.page;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- tiny DOM helper ---------- */
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") n.className = v;
      else if (k === "html") n.innerHTML = v; // only used for the static icons below
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) {
      if (kid == null) continue;
      n.append(kid.nodeType ? kid : document.createTextNode(kid));
    }
    return n;
  };

  const ICON_SUN = '<svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const ICON_MOON = '<svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  const ICON_BACK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';

  /* ---------- theme ---------- */
  const currentTheme = () => document.documentElement.dataset.theme || "dark";
  const THEME_COLOR = { dark: "#0A1428", light: "#F5F7FC" };
  const syncThemeColor = () => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEME_COLOR[currentTheme()]);
  };
  let themeTimer;
  const setTheme = (t) => {
    const root = document.documentElement;
    root.classList.add("theme-anim");
    clearTimeout(themeTimer);
    themeTimer = setTimeout(() => root.classList.remove("theme-anim"), 450);
    root.dataset.theme = t;
    syncThemeColor();
    try { localStorage.setItem("theme", t); } catch (e) {}
    const btn = document.querySelector(".theme-toggle");
    if (btn) btn.setAttribute("aria-label", t === "dark" ? "Switch to light theme" : "Switch to dark theme");
    document.dispatchEvent(new CustomEvent("themechange"));
  };

  /* ---------- header / footer ---------- */
  function renderChrome() {
    const home = base + "index.html";
    const header = document.getElementById("site-header");
    if (header) {
      header.className = "site-header";
      header.append(
        el("div", { class: "wrap bar" },
          el("a", { class: "brand", href: home, "aria-label": SITE.name },
            el("span", { class: "brand-full" }, SITE.name),
            el("span", { class: "brand-short", "aria-hidden": "true" }, (SITE.name || "").split(/\s+/).map((w) => w.charAt(0)).join(""))
          ),
          el("nav", { class: "nav", "aria-label": "Primary" },
            el("a", { href: home + "#about" }, "About"),
            el("a", { href: home + "#work" }, "Projects"),
            PUBS.length ? el("a", { href: base + "publications.html" }, "Publications")
              : SITE.scholar ? el("a", { href: SITE.scholar, target: "_blank", rel: "noopener noreferrer" }, "Publications") : null,
            el("a", { href: home + "#contact" }, "Contact")
          ),
          el("div", { class: "bar-tools" },
            el("button", {
              class: "theme-toggle", type: "button",
              "aria-label": currentTheme() === "dark" ? "Switch to light theme" : "Switch to dark theme",
              html: ICON_SUN + ICON_MOON,
              onclick: () => setTheme(currentTheme() === "dark" ? "light" : "dark")
            })
          )
        )
      );
    }
    const footer = document.getElementById("site-footer");
    if (footer) {
      footer.append(
        el("div", { class: "wrap" },
          el("span", {}, `© ${new Date().getFullYear()} ${SITE.name}`, SITE.updated ? el("span", { class: "updated" }, ` · Last updated ${SITE.updated}`) : null),
          el("a", { href: "#main", onclick: () => window.scrollTo({ top: 0 }) }, "Back to top")
        )
      );
    }
  }

  const imgOrPlaceholder = (p, cls) => {
    const wrap = el("div", { class: cls, style: `--hue:${p.hue ?? 220}` });
    if (p.image) wrap.append(el("img", { src: base + p.image, alt: p.imageAlt || "", loading: "lazy", decoding: "async" }));
    else wrap.append(el("div", { class: "ph", "aria-hidden": "true" }, (p.title || "?").trim().charAt(0)));
    return wrap;
  };

  /* ---------- home page ---------- */
  function fillSiteText() {
    document.querySelectorAll("[data-site]").forEach((n) => { n.textContent = SITE[n.dataset.site] || ""; });

    const about = document.getElementById("about-text");
    if (about) (SITE.about || []).forEach((t) => about.append(el("p", {}, t)));

    const facts = document.getElementById("facts");
    if (facts) (SITE.facts || []).forEach((f) => facts.append(el("div", {}, el("dt", {}, f.label), el("dd", {}, f.value))));

    const timeline = (id, items) => {
      const ol = document.getElementById(id);
      if (!ol) return;
      (items || []).forEach((it) => ol.append(el("li", {},
        el("span", { class: "when" }, it.when),
        el("h3", {}, it.title),
        el("p", { class: "where" }, it.where),
        it.note ? el("p", { class: "note" }, it.note) : null
      )));
    };
    timeline("education-list", SITE.education);
    timeline("experience-list", SITE.experience);

    const skills = document.getElementById("skill-list");
    if (skills) (SITE.skills || []).forEach((g) => skills.append(el("div", { class: "skill-row" },
      el("dt", {}, g.group),
      el("dd", {}, el("ul", {}, ...(g.items || []).map((i) => el("li", {}, i)))))));
    const skillSec = document.getElementById("skills");
    if (skillSec && !(SITE.skills || []).length) skillSec.hidden = true;

    const note = document.getElementById("contact-note");
    if (note) { if (SITE.contactNote) note.textContent = SITE.contactNote; else note.hidden = true; }

    const mail = document.getElementById("contact-mail");
    if (mail) { mail.href = "mailto:" + SITE.email; mail.textContent = SITE.email; }

    const scholarLine = document.getElementById("scholar-line");
    if (scholarLine && SITE.scholar) {
      scholarLine.hidden = false;
      document.getElementById("scholar-link").href = SITE.scholar;
    }
    initNews(4);

    const links = document.getElementById("contact-links");
    if (links) [...(SITE.scholar ? [{ label: "Google Scholar", href: SITE.scholar }] : []), ...(SITE.links || [])].forEach((l) => links.append(el("li", {}, el("a", { href: l.href, target: "_blank", rel: "noopener noreferrer" }, l.label))));
  }


  /* ---------- dates, news ---------- */
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fmtDate = (d) => {
    const m = /^(\d{4})(?:-(\d{2}))?/.exec(d || "");
    if (!m) return d || "";
    return m[2] ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : m[1];
  };
  function newsItem(n) {
    const href = n.link && n.link.href ? (/^https?:/.test(n.link.href) ? n.link.href : base + n.link.href) : null;
    return el("li", { class: "news-item" },
      el("time", { class: "news-date", datetime: n.date }, fmtDate(n.date)),
      el("p", { class: "news-text" }, n.text,
        href ? [" ", el("a", Object.assign({ href }, /^https?:/.test(href) ? { target: "_blank", rel: "noopener noreferrer" } : {}), n.link.label || "More")] : null));
  }
  function initNews(limit) {
    const list = document.getElementById("news-list");
    const sec = document.getElementById("news");
    if (!list) return;
    if (!NEWS.length) { if (sec) sec.hidden = true; return; }
    (limit ? NEWS.slice(0, limit) : NEWS).forEach((n) => list.append(newsItem(n)));
    const more = document.getElementById("news-all");
    if (more && (!limit || NEWS.length <= limit)) more.hidden = true;
  }

  /* ---------- publications ---------- */
  const TEX = { "ş": "{\\c{s}}", "Ş": "{\\c{S}}", "ğ": "{\\u{g}}", "Ğ": "{\\u{G}}", "ı": "{\\i}", "İ": "{\\.{I}}", "Ç": "{\\c{C}}", "ç": "{\\c{c}}", "ö": "{\\\"o}", "ü": "{\\\"u}", "Ö": "{\\\"O}", "Ü": "{\\\"U}", "–": "--" };
  const tex = (t) => String(t).replace(/[şŞğĞıİÇçöüÖÜ–]/g, (c) => TEX[c]);
  const bibAuthor = (a) => {
    if (/^et al\.?$/i.test(a)) return "others";
    const parts = a.trim().split(/\s+/); const last = parts.pop();
    return tex(`${last}, ${parts.join(" ")}`);
  };
  function bibtexFor(pub) {
    if (pub.doi) {
      const hand = PROJECTS.find((p) => p.bibtex && p.bibtex.includes(`{${pub.doi}}`));
      if (hand) return hand.bibtex;
    }
    const first = pub.authors[0].trim().split(/\s+/).pop().toLowerCase().replace(/[^a-z]/g, "");
    const word = (pub.title.toLowerCase().match(/[a-z]{4,}/g) || ["paper"]).find((w) => !["with", "from", "that", "using", "applying"].includes(w)) || "paper";
    const key = `${first}${pub.year}${word}`;
    const kind = pub.type === "inproceedings" ? "inproceedings" : "article";
    const f = [["author", pub.authors.map(bibAuthor).join(" and ")], ["title", `{${tex(pub.title)}}`],
      [kind === "article" ? "journal" : "booktitle", tex(pub.venue)], ["year", pub.year],
      ["volume", pub.volume], ["number", pub.number], ["pages", pub.pages && tex(pub.pages)], ["doi", pub.doi]]
      .filter((x) => x[1]);
    const w = Math.max(...f.map((x) => x[0].length));
    return `@${kind}{${key},\n` + f.map(([k, v]) => `  ${k.padEnd(w)} = {${v}}`).join(",\n") + "\n}";
  }
  function pubItem(pub, i) {
    const isEtAl = pub.authors[pub.authors.length - 1] === "et al.";
    const names = pub.authors.filter((x) => x !== "et al.").map((x) => (x === "F. Mirlou" ? el("strong", {}, x) : x));
    const authorNodes = [];
    names.forEach((a, k) => {
      authorNodes.push(a);
      if (isEtAl) authorNodes.push(k < names.length - 1 ? ", " : ", et al.");
      else if (k < names.length - 2) authorNodes.push(", ");
      else if (k === names.length - 2) authorNodes.push(names.length > 2 ? ", and " : " and ");
    });
    const biblio = [pub.volume ? pub.volume + (pub.number ? `(${pub.number})` : "") + (pub.pages ? `:${pub.pages}` : "") : (pub.pages || ""), pub.year].filter(Boolean).join(", ");
    const text = el("p", { class: "pub-text" }, ...authorNodes, (isEtAl ? " " : ". ") + "“" + pub.title + "”, ", el("em", {}, pub.venue), ", " + biblio + ".");
    const bib = bibtexFor(pub);
    const code = el("code", {}, bib);
    const status = el("span", { class: "cite-status", role: "status", "aria-live": "polite" });
    const flash = (m) => { status.textContent = m; setTimeout(() => { status.textContent = ""; }, 2200); };
    const copy = el("button", { class: "btn btn-small", type: "button", onclick: async () => {
      try { await navigator.clipboard.writeText(bib); flash("Copied"); }
      catch (e) { const r = document.createRange(); r.selectNodeContents(code); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); flash("Press Ctrl+C (or Cmd+C)"); }
    } }, "Copy BibTeX");
    const panel = el("div", { class: "pub-bib", id: "bib-" + i, hidden: true },
      el("pre", { class: "bibtex", tabindex: "0", "aria-label": "BibTeX entry" }, code),
      el("div", { class: "cite-actions" }, copy, status));
    const toggle = el("button", { class: "linklike", type: "button", "aria-expanded": "false", "aria-controls": "bib-" + i, onclick: () => {
      panel.hidden = !panel.hidden; toggle.setAttribute("aria-expanded", String(!panel.hidden));
    } }, "BibTeX");
    const links = [];
    if (pub.doi) links.push(el("a", { href: "https://doi.org/" + pub.doi, target: "_blank", rel: "noopener noreferrer" }, "DOI"));
    if (pub.pdf) links.push(el("a", { href: pub.pdf, target: "_blank", rel: "noopener noreferrer" }, "PDF"));
    links.push(toggle);
    const proj = pub.doi && PROJECTS.find((p) => p.bibtex && p.bibtex.includes(`{${pub.doi}}`));
    if (proj) links.push(el("a", { href: `${base}projects/${proj.slug}.html` }, "Project page"));
    const row = [];
    links.forEach((l, k) => { if (k) row.push(" · "); row.push(l); });
    return el("li", { class: "pub" }, text, el("p", { class: "pub-links" }, ...row), panel);
  }
  function initPublications() {
    const main = document.getElementById("main"); if (!main) return;
    const list = el("ol", { class: "pub-list" }, ...PUBS.map(pubItem));
    main.replaceChildren(el("div", { class: "wrap page-narrow" },
      el("a", { class: "back", href: base + "index.html", html: ICON_BACK + "<span>Home</span>" }),
      el("h1", { class: "page-title" }, "Publications"),
      el("p", { class: "page-lede" }, "Journal and conference publications, newest first. Each entry has a BibTeX you can copy.",
        SITE.scholar ? [" The same list is on ", el("a", { href: SITE.scholar, target: "_blank", rel: "noopener noreferrer" }, "Google Scholar"), "."] : null),
      el("h2", { class: "pub-heading" }, "Journal and Conference Publications"),
      list));
  }
  function initNewsPage() {
    const main = document.getElementById("main"); if (!main) return;
    const list = el("ul", { class: "news-list" }, ...NEWS.map(newsItem));
    main.replaceChildren(el("div", { class: "wrap page-narrow" },
      el("a", { class: "back", href: base + "index.html", html: ICON_BACK + "<span>Home</span>" }),
      el("h1", { class: "page-title" }, "News and updates"),
      list));
  }

  function initGrid() {
    const grid = document.getElementById("grid");
    if (!grid) return;

    const cards = PROJECTS.map((p) => {
      const media = el("div", { class: "card-media" });
      /* a small 3D model of the device; the paper photo sits in the corner. Without WebGL the photo is shown instead. */
      let modelOn = false;
      if (p.model && window.Models) {
        const box = el("div", { class: "card-model ph", style: `--hue:${p.hue ?? 220}`, "aria-hidden": "true" });
        media.append(box);
        modelOn = !!window.Models.mount(box, p.model, { interactive: false });
        if (!modelOn) box.remove();
      }
      if (modelOn) {
        if (p.image) media.append(el("img", { class: "card-photo", src: base + p.image, alt: p.imageAlt || "", loading: "lazy", decoding: "async" }));
        media.classList.add("has-model");
      } else media.append(imgOrPlaceholder(p, "card-img"));
      return el("a", { class: "card", href: `${base}projects/${p.slug}.html`, "data-tags": p.tags.join("|") },
        media,
        el("div", { class: "card-body" },
          el("div", { class: "card-title" }, el("h3", {}, p.title), el("span", { class: "year" }, String(p.year))),
          el("p", {}, p.summary),
          el("ul", { class: "tags" }, p.tags.map((t) => el("li", {}, t)))
        )
      );
    });
    cards.forEach((c) => grid.append(c));

    /* filters */
    const filters = document.getElementById("project-filters");
    const count = document.getElementById("grid-count");
    const tags = [...new Set(PROJECTS.flatMap((p) => p.tags))];
    const buttons = ["All", ...tags].map((t) =>
      el("button", { type: "button", class: "chip", "aria-pressed": String(t === "All"), onclick: () => apply(t) }, t)
    );
    if (filters && tags.length > 1) buttons.forEach((b) => filters.append(b));

    function apply(tag) {
      buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.textContent === tag)));
      let i = 0;
      cards.forEach((c) => {
        const show = tag === "All" || c.dataset.tags.split("|").includes(tag);
        c.hidden = !show;
        if (show) c.dataset.slot = String(i++ % 4);
      });
      if (count) count.textContent = `${i} project${i === 1 ? "" : "s"} shown`;
    }
    apply("All");

    /* gentle 3D tilt that follows the pointer */
    if (matchMedia("(hover: hover)").matches && !reduceMotion) {
      cards.forEach((c) => {
        const media = c.querySelector(".card-media");
        const img = c.querySelector(".card-img");
        if (!img) return;
        c.addEventListener("pointermove", (e) => {
          const r = media.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width - 0.5;
          const y = (e.clientY - r.top) / r.height - 0.5;
          img.style.setProperty("--rx", (-y * 5).toFixed(2) + "deg");
          img.style.setProperty("--ry", (x * 7).toFixed(2) + "deg");
        });
        c.addEventListener("pointerleave", () => {
          img.style.setProperty("--rx", "0deg");
          img.style.setProperty("--ry", "0deg");
        });
      });
    }
  }

  /* ---------- project page ---------- */
  function initProject() {
    const main = document.getElementById("main");
    const slug = body.dataset.slug;
    const idx = PROJECTS.findIndex((p) => p.slug === slug);

    if (idx < 0) {
      main.append(el("div", { class: "not-found" },
        el("h1", {}, "Project not found"),
        el("p", {}, `No project with the slug "${slug}" exists in js/content.js.`),
        el("a", { class: "btn", href: base + "index.html#work" }, "Back to projects")
      ));
      return;
    }

    const p = PROJECTS[idx];
    /* one 3D model of the whole device, and one photo from the paper next to it */
    function visuals(p) {
      const wrapV = el("div", { class: "p-visuals" + (p.image ? " has-photo" : "") });
      let on = false;
      if (p.model && window.Models) {
        const box = el("div", { class: "p-model ph", style: `--hue:${p.hue ?? 220}`, role: "img", "aria-label": `Interactive 3D model of the device in this project. Drag to rotate.` });
        wrapV.append(box);
        on = !!window.Models.mount(box, p.model, { interactive: true });
        if (on) box.append(el("span", { class: "model-hint", "aria-hidden": "true" }, "Drag to rotate"));
        else box.remove();
      }
      if (p.image) {
        wrapV.append(el("figure", { class: "p-photo" },
          el("img", { src: base + p.image, alt: p.imageAlt || "", decoding: "async" }),
          el("figcaption", {}, p.imageCaption || "", p.imageCredit ? el("span", {}, p.imageCredit) : null)));
      }
      if (!on && !p.image) wrapV.append(imgOrPlaceholder(p, "p-hero"));
      if (!on) wrapV.classList.add("no-model");
      return wrapV;
    }
    document.title = `${p.title} · ${SITE.name}`;

    const paras = (v) => (Array.isArray(v) ? v : [v]).filter(Boolean).map((t) => el("p", {}, t));
    const meta = el("dl", { class: "meta" },
      el("div", {}, el("dt", {}, "Year"), el("dd", {}, String(p.year))),
      p.status ? el("div", {}, el("dt", {}, "Status"), el("dd", {}, p.status)) : null,
      p.venue ? el("div", {}, el("dt", {}, "Published in"), el("dd", {}, p.venue)) : null,
      el("div", {}, el("dt", {}, "Topics"), el("dd", {}, p.tags.join(", "))),
      (p.links || []).length
        ? el("div", {}, el("dt", {}, "Links"), el("dd", {}, el("ul", {}, p.links.map((l) =>
            el("li", {}, el("a", { href: l.href, target: "_blank", rel: "noopener noreferrer" }, l.label))))))
        : null
    );

    const blocks = [el("section", { class: "p-block" }, el("h2", {}, "Overview"), el("div", { class: "lead" }, paras(p.intro)))];
    (p.sections || []).forEach((s) => blocks.push(el("section", { class: "p-block" }, el("h2", {}, s.heading), el("div", {}, paras(s.body)))));

    /* BibTeX, with a copy button and a .bib download */
    if (p.bibtex) {
      const status = el("span", { class: "cite-status", role: "status", "aria-live": "polite" });
      const flash = (msg) => { status.textContent = msg; setTimeout(() => { status.textContent = ""; }, 2200); };
      const code = el("code", {}, p.bibtex);
      const copy = el("button", { class: "btn btn-small", type: "button", onclick: async () => {
        try { await navigator.clipboard.writeText(p.bibtex); flash("Copied"); }
        catch (e) {
          const r = document.createRange(); r.selectNodeContents(code);
          const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
          flash("Press Ctrl+C (or Cmd+C) to copy");
        }
      } }, "Copy BibTeX");
      const dl = el("a", { class: "btn btn-small", href: "data:text/plain;charset=utf-8," + encodeURIComponent(p.bibtex + "\n"), download: p.slug + ".bib" }, "Download .bib");
      blocks.push(el("section", { class: "p-block cite" },
        el("h2", {}, "Cite this work"),
        el("div", { class: "cite-body" },
          el("pre", { class: "bibtex", tabindex: "0", "aria-label": "BibTeX entry" }, code),
          el("div", { class: "cite-actions" }, copy, dl, status))));
    }

    const wrap = el("div", { class: "wrap" },
      el("header", { class: "p-head" },
        el("a", { class: "back", href: base + "index.html#work", html: ICON_BACK + "<span>All projects</span>" }),
        el("h1", { class: "p-title" }, p.title),
        el("p", { class: "p-summary" }, p.summary)
      ),
      meta,
      visuals(p),
      el("div", { class: "p-body" }, blocks)
    );

    /* gallery with lightbox */
    if ((p.gallery || []).length) {
      const dlg = el("dialog", { class: "lightbox", "aria-label": "Image viewer" });
      const big = el("img", { alt: "" });
      const cap = el("p", {});
      dlg.append(el("button", { class: "close", type: "button", onclick: () => dlg.close() }, "Close"), big, cap);
      dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
      const g = el("div", { class: "gallery" }, p.gallery.map((s) =>
        el("button", {
          class: "shot", type: "button", "aria-label": `Enlarge image: ${s.alt || s.caption || "project image"}`,
          onclick: () => { big.src = base + s.src; big.alt = s.alt || ""; cap.textContent = s.caption || ""; dlg.showModal(); }
        }, el("img", { src: base + s.src, alt: s.alt || "", loading: "lazy", decoding: "async" }))
      ));
      wrap.append(g, dlg);
    }

    /* previous / next */
    if (PROJECTS.length > 1) {
      const n = PROJECTS.length;
      const prev = PROJECTS[(idx - 1 + n) % n];
      const next = PROJECTS[(idx + 1) % n];
      wrap.append(el("nav", { class: "pager", "aria-label": "More projects" },
        el("a", { class: "prev", href: `${prev.slug}.html` }, el("small", {}, "Previous project"), el("strong", {}, prev.title)),
        el("a", { class: "next", href: `${next.slug}.html` }, el("small", {}, "Next project"), el("strong", {}, next.title))
      ));
    }
    main.append(wrap);
  }

  /* ---------- boot ---------- */
  renderChrome();
  if (page === "home") { fillSiteText(); initGrid(); }
  if (page === "project") initProject();
  if (page === "publications") initPublications();
  if (page === "news") initNewsPage();
})();
