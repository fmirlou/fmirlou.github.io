/*
  Writes the page title, description and share-preview tags (Open Graph / Twitter)
  into index.html and every projects/<slug>.html, using the text in js/content.js.
  Run it after you change a project or the site address:   npm run meta
  (Needs Node.js only for this step. The site itself does not need it.)
*/
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "js", "content.js"), "utf8"), ctx);
const SITE = ctx.window.SITE;
const PROJECTS = ctx.window.PROJECTS;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const origin = (SITE.url || "").replace(/\/+$/, "");
const abs = (rel, prefix = "") => (origin ? `${origin}/${rel}` : prefix + rel);

function block({ title, description, image, imageAlt, pagePath, prefix, type, extra = "" }) {
  const url = origin ? `${origin}/${pagePath}` : "";
  const lines = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}">`,
    url ? `<link rel="canonical" href="${esc(url)}">` : "",
    `<meta property="og:type" content="${type}">`,
    `<meta property="og:site_name" content="${esc(SITE.name)}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    url ? `<meta property="og:url" content="${esc(url)}">` : "",
    `<meta property="og:image" content="${esc(abs(image, prefix))}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${esc(imageAlt)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(description)}">`,
    `<meta name="twitter:image" content="${esc(abs(image, prefix))}">`,
    extra
  ].filter(Boolean);
  return `<!-- meta:start (written by scripts/sync-meta.js) -->\n  ${lines.join("\n  ")}\n  <!-- meta:end -->`;
}

function apply(file, html) {
  let s = fs.readFileSync(file, "utf8");
  const re = /<!-- meta:start[\s\S]*?<!-- meta:end -->/;
  if (re.test(s)) s = s.replace(re, html);
  else {
    // first run: replace the old <title> and description lines
    s = s.replace(/\s*<title>[\s\S]*?<\/title>/, "").replace(/\s*<meta name="description"[^>]*>/, "");
    s = s.replace(/(<meta name="viewport"[^>]*>)/, `$1\n  ${html}`);
  }
  fs.writeFileSync(file, s);
}

// home
const person = {
  "@context": "https://schema.org", "@type": "Person", name: SITE.name,
  jobTitle: "Postdoctoral Research Associate", worksFor: { "@type": "Organization", name: "Max Planck Institute for Informatics" },
  alumniOf: { "@type": "CollegeOrUniversity", name: "Koç University" },
  sameAs: [SITE.scholar, ...(SITE.links || []).map((l) => l.href)].filter(Boolean),
  ...(origin ? { url: origin + "/" } : {})
};
apply(path.join(root, "index.html"), block({
  title: SITE.metaTitle || SITE.name,
  description: SITE.metaDescription || SITE.tagline,
  image: "assets/img/og/home.png", imageAlt: `${SITE.name}: ${SITE.tagline}`,
  pagePath: "", prefix: "", type: "website",
  extra: `<script type="application/ld+json">${JSON.stringify(person)}</script>`
}));

// publications and news pages
for (const [file, title, description] of [
  ["publications.html", `Publications · ${SITE.name}`, "Journal and conference publications of " + SITE.name + ", with DOI links and BibTeX."],
  ["news.html", `News and updates · ${SITE.name}`, "News and updates from " + SITE.name + "."]
]) {
  const f = path.join(root, file);
  if (!fs.existsSync(f)) continue;
  apply(f, block({ title, description, image: "assets/img/og/home.png", imageAlt: `${SITE.name}: ${SITE.tagline}`, pagePath: file, prefix: "", type: "website" }));
}

// projects
let n = 0;
for (const p of PROJECTS) {
  const file = path.join(root, "projects", p.slug + ".html");
  if (!fs.existsSync(file)) { console.warn("missing page for", p.slug); continue; }
  apply(file, block({
    title: `${p.title} · ${SITE.name}`,
    description: p.summary,
    image: `assets/img/og/${p.slug}.png`, imageAlt: (p.model ? `3D model of the device: ${p.title}` : `Microscope image of the device: ${p.title}`),
    pagePath: `projects/${p.slug}.html`, prefix: "../", type: "article"
  }));
  n++;
}
console.log(`Updated index.html and ${n} project page(s).` + (origin ? "" : " (No site address set yet: preview images use relative paths.)"));
