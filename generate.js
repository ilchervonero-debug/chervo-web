const { Client } = require("@notionhq/client");
const fs = require("fs");

const notion = new Client({ auth: process.env.NOTION_TOKEN });

async function getDB(dbId) {
  const res = await notion.databases.query({ database_id: dbId, sorts: [{ property: "Orden", direction: "ascending" }] });
  return res.results;
}

async function getConfigDB(dbId) {
  const res = await notion.databases.query({ database_id: dbId });
  const map = {};
  for (const page of res.results) {
    const clave = page.properties["Clave"]?.title?.[0]?.plain_text;
    const valor = page.properties["Valor"]?.rich_text?.[0]?.plain_text;
    if (clave) map[clave] = valor || "";
  }
  return map;
}

function getText(prop) {
  if (!prop) return "";
  if (prop.title) return prop.title[0]?.plain_text || "";
  if (prop.rich_text) return prop.rich_text[0]?.plain_text || "";
  return "";
}

function getCheck(prop) {
  return prop?.checkbox === true;
}

function getNum(prop) {
  return prop?.number ?? 0;
}

(async () => {
  const [serviciosRaw, clientesRaw, hero, contacto] = await Promise.all([
    getDB(process.env.DB_SERVICIOS),
    getDB(process.env.DB_CLIENTES),
    getConfigDB(process.env.DB_HERO),
    getConfigDB(process.env.DB_CONTACTO),
  ]);

  const servicios = serviciosRaw
    .filter(p => getCheck(p.properties["Activo"]))
    .sort((a, b) => getNum(a.properties["Orden"]) - getNum(b.properties["Orden"]));

  const clientes = clientesRaw
    .filter(p => getCheck(p.properties["Visible"]))
    .sort((a, b) => getNum(a.properties["Orden"]) - getNum(b.properties["Orden"]));

  const heroTitulo = hero["hero_titulo"] || "¿Buscando ayuda?";
  const heroPalabras = (hero["hero_palabras_rotativas"] || "con dibujo de planos").split(",").map(s => s.trim());
  const whatsapp = contacto["whatsapp"] || "+598 92 459 376";
  const email = contacto["email"] || "ilchervonero@gmail.com";
  const waNum = whatsapp.replace(/\D/g, "");

  const serviciosHTML = servicios.map((p, i) => {
    const nombre = getText(p.properties["Nombre"]);
    const desc = getText(p.properties["Descripcion"]);
    const num = String(i + 1).padStart(2, "0");
    return `
      <div class="service-item">
        <span class="service-num">${num}</span>
        <div class="service-info">
          <h3>${nombre}</h3>
          <p>${desc}</p>
        </div>
        <a href="https://wa.me/${waNum}?text=Hola,%20consulta%20sobre%20${encodeURIComponent(nombre)}" class="service-arrow">→</a>
      </div>`;
  }).join("\n");

  const clientesHTML = clientes.map(p => {
    const nombre = getText(p.properties["Nombre"]);
    return `<li>${nombre}</li>`;
  }).join("\n");

  const palabrasJS = JSON.stringify(heroPalabras);

  const tickerItems = ["DIBUJO 2D & 3D", "RENDERS", "DRONE", "VIDEO", "DECLARACIONES JURADAS", "PRESUPUESTOS", "METRADOS", "INTENDENCIA & BPS", "ASESORÍAS", "SOFTWARE REMOTO"];
  const tickerHTML = [...tickerItems, ...tickerItems].map(t => `<span>${t}</span>`).join(" · ");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chervo</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #f5f4f0;
      --fg: #1a1a1a;
      --muted: #6b6b6b;
      --accent: #1a1a1a;
      --line: #e0ddd6;
    }
    html { scroll-behavior: smooth; }
    body { font-family: 'Geist', sans-serif; background: var(--bg); color: var(--fg); font-size: 16px; line-height: 1.6; }
    a { color: inherit; text-decoration: none; }

    /* NAV */
    nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; display: flex; justify-content: space-between; align-items: center; padding: 1.2rem 2rem; background: var(--bg); border-bottom: 1px solid var(--line); }
    .nav-logo img { height: 28px; }
    .nav-links { display: flex; gap: 2rem; font-size: 0.85rem; color: var(--muted); }
    .nav-links a:hover { color: var(--fg); }
    .nav-cta { font-size: 0.85rem; font-weight: 500; }

    /* HERO */
    #top { min-height: 100vh; display: flex; flex-direction: column; justify-content: center; padding: 8rem 2rem 4rem; max-width: 900px; margin: 0 auto; }
    .hero-sub { font-size: 0.9rem; color: var(--muted); margin-bottom: 1rem; }
    .hero-title { font-size: clamp(3rem, 8vw, 6rem); font-weight: 600; line-height: 1.05; letter-spacing: -0.02em; }
    .hero-rotating { display: inline-block; color: var(--muted); font-weight: 300; }

    /* TICKER */
    .ticker-wrap { overflow: hidden; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); padding: 0.8rem 0; margin: 3rem 0; }
    .ticker { display: flex; gap: 2rem; white-space: nowrap; animation: ticker 30s linear infinite; font-size: 0.78rem; color: var(--muted); letter-spacing: 0.08em; }
    @keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }

    /* SECTIONS */
    section { padding: 5rem 2rem; max-width: 900px; margin: 0 auto; }
    .section-label { font-size: 0.75rem; color: var(--muted); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 2rem; }

    /* PROBLEMA / SOLUCION */
    #problema { display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; }
    #problema h2 { font-size: 1rem; font-weight: 500; margin-bottom: 1rem; }
    #problema p { font-size: 0.9rem; color: var(--muted); line-height: 1.7; }

    /* SERVICIOS */
    #servicios { border-top: 1px solid var(--line); }
    .service-item { display: flex; align-items: center; gap: 1.5rem; padding: 1.2rem 0; border-bottom: 1px solid var(--line); }
    .service-num { font-size: 0.75rem; color: var(--muted); width: 2rem; flex-shrink: 0; }
    .service-info { flex: 1; }
    .service-info h3 { font-size: 0.95rem; font-weight: 500; }
    .service-info p { font-size: 0.82rem; color: var(--muted); margin-top: 0.2rem; }
    .service-arrow { font-size: 1rem; color: var(--muted); transition: color 0.2s; }
    .service-arrow:hover { color: var(--fg); }

    /* SOBRE */
    #sobre { display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; align-items: center; border-top: 1px solid var(--line); }
    #sobre img { width: 100%; aspect-ratio: 3/4; object-fit: cover; }
    #sobre p { font-size: 0.9rem; color: var(--muted); line-height: 1.8; }

    /* CLIENTES */
    #clientes { border-top: 1px solid var(--line); }
    #clientes ul { list-style: none; display: flex; flex-direction: column; gap: 0.8rem; }
    #clientes li { font-size: 1rem; padding-bottom: 0.8rem; border-bottom: 1px solid var(--line); }

    /* CONTACTO */
    #contacto { border-top: 1px solid var(--line); }
    .contact-links { display: flex; flex-direction: column; gap: 1rem; margin-top: 1.5rem; }
    .contact-link { display: flex; align-items: center; gap: 1rem; font-size: 1rem; font-weight: 500; padding: 1rem 0; border-bottom: 1px solid var(--line); }
    .contact-link span { color: var(--muted); font-size: 0.85rem; font-weight: 400; }

    /* FOOTER */
    footer { border-top: 1px solid var(--line); padding: 2rem; display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: var(--muted); max-width: 900px; margin: 0 auto; }

    /* FAB */
    .fab { position: fixed; bottom: 2rem; right: 2rem; background: var(--fg); color: var(--bg); width: 3rem; height: 3rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; z-index: 200; }

    @media (max-width: 640px) {
      #problema, #sobre { grid-template-columns: 1fr; gap: 2rem; }
      .nav-links { display: none; }
    }
  </style>
</head>
<body>

<nav>
  <a href="#top" class="nav-logo"><img src="chervo_logo.svg" alt="Chervo"></a>
  <div class="nav-links">
    <a href="#servicios">Servicios</a>
    <a href="#sobre">Equipo</a>
    <a href="#clientes">Clientes</a>
    <a href="#contacto">Por consultas</a>
    <a href="/clientes/">Área clientes</a>
  </div>
  <a href="#contacto" class="nav-cta">Por consultas</a>
</nav>

<div id="top">
  <p class="hero-sub">Tienes una idea o proyecto en mente</p>
  <h1 class="hero-title">
    ${heroTitulo}<br>
    <span class="hero-rotating" id="rotating-word">${heroPalabras[0]}</span>
  </h1>
</div>

<div class="ticker-wrap">
  <div class="ticker">${tickerHTML}</div>
</div>

<section id="problema">
  <div>
    <h2>El Problema</h2>
    <p>Tienes una idea y no sabes por dónde empezar. Tienes trabajo atrasado y necesitas retomarlo. Te falta tiempo para una entrega. Quieres armar un proyecto y no tienes personal suficiente.</p>
  </div>
  <div>
    <h2>La Solución</h2>
    <p>Te ofrecemos <strong>20 años de experiencia</strong> en diseño y construcción, trabajando con estudios de arquitectura y arquitectos freelance. Desarrollamos proyectos desde la idea hasta su documentación para entrega a clientes y entidades gubernamentales.</p>
  </div>
</section>

<section id="servicios">
  <p class="section-label">Servicios</p>
  ${serviciosHTML}
</section>

<section id="sobre">
  <img src="chervo_retrato.jpg" alt="Chervo equipo">
  <div>
    <p class="section-label">Un equipo para ti</p>
    <p>Somos un equipo con más de 20 años de experiencia en representación de ideas y desarrollo de proyectos. Nos ajustamos a tus necesidades y a tu presupuesto.</p>
  </div>
</section>

<section id="clientes">
  <p class="section-label">Clientes</p>
  <ul>
    ${clientesHTML}
  </ul>
</section>

<section id="contacto">
  <p class="section-label">Por consultas</p>
  <div class="contact-links">
    <a href="https://wa.me/${waNum}" class="contact-link">✆ WhatsApp <span>${whatsapp} →</span></a>
    <a href="mailto:${email}" class="contact-link">✉ Correo <span>${email} →</span></a>
  </div>
</section>

<footer>
  <span>© 2026 Chervo · IlChervoNero</span>
  <div style="display:flex;gap:1.5rem">
    <a href="https://wa.me/${waNum}">WhatsApp</a>
    <a href="mailto:${email}">Correo</a>
  </div>
</footer>

<a href="https://wa.me/${waNum}" class="fab">✆</a>

<script>
  const palabras = ${palabrasJS};
  let i = 0;
  const el = document.getElementById('rotating-word');
  setInterval(() => {
    el.style.opacity = '0';
    setTimeout(() => {
      i = (i + 1) % palabras.length;
      el.textContent = palabras[i];
      el.style.opacity = '1';
    }, 300);
  }, 2500);
  el.style.transition = 'opacity 0.3s';
</script>

</body>
</html>`;

  fs.writeFileSync("index.html", html, "utf8");
  console.log("✓ index.html generado");
})();
