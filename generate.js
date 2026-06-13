const fs = require("fs");
const https = require("https");

const TOKEN = process.env.NOTION_TOKEN;
const DB_SERVICIOS    = process.env.DB_SERVICIOS;
const DB_CLIENTES     = process.env.DB_CLIENTES;
const DB_HERO         = process.env.DB_HERO;
const DB_CONTACTO     = process.env.DB_CONTACTO;
const DB_APLICACIONES = process.env.DB_APLICACIONES;

function notionRequest(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: "api.notion.com",
      path,
      method: "POST",
      headers: {
        "Authorization": `Bearer ${TOKEN}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data)
      }
    };
    const req = https.request(options, res => {
      let body = "";
      res.on("data", d => body += d);
      res.on("end", () => resolve(JSON.parse(body)));
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function queryDB(dbId, sorts) {
  const body = sorts ? { sorts } : {};
  const res = await notionRequest(`/v1/databases/${dbId}/query`, body);
  if (res.object === "error") {
    throw new Error(`Notion API error en DB ${dbId}: ${res.code} - ${res.message}`);
  }
  return res.results || [];
}

async function getConfig(dbId) {
  const pages = await queryDB(dbId);
  const map = {};
  for (const page of pages) {
    const clave = page.properties["Clave"]?.title?.[0]?.plain_text;
    const valor = page.properties["Valor"]?.rich_text?.[0]?.plain_text;
    if (clave) map[clave] = valor || "";
  }
  return map;
}

function getText(prop) {
  if (!prop) return "";
  if (prop.title)     return (prop.title[0]?.plain_text     || "").trim();
  if (prop.rich_text) return (prop.rich_text[0]?.plain_text || "").trim();
  return "";
}

(async () => {
  const byOrden = [{ property: "Orden", direction: "ascending" }];

  const resultados = await Promise.allSettled([
    queryDB(DB_SERVICIOS, byOrden),
    queryDB(DB_CLIENTES, byOrden),
    getConfig(DB_HERO),
    getConfig(DB_CONTACTO),
    queryDB(DB_APLICACIONES, byOrden),
  ]);
  const nombres = ["Servicios", "Clientes", "Hero", "Contacto", "Aplicaciones"];
  resultados.forEach((r, i) => {
    console.log(`${nombres[i]}: ${r.status === "fulfilled" ? "OK" : "FALLO - " + r.reason.message}`);
  });
  if (resultados.some(r => r.status === "rejected")) {
    throw new Error("una o mas bases de Notion fallaron, ver detalle arriba");
  }
  const [serviciosTodos, clientesTodos, heroConfig, contactoConfig, appsRaw] = resultados.map(r => r.value);
  const config = { ...heroConfig, ...contactoConfig };

  const serviciosRaw = serviciosTodos.filter(p => p.properties["Activo"]?.checkbox === true);
  const clientesRaw  = clientesTodos.filter(p => p.properties["Visible"]?.checkbox === true);

  if (serviciosRaw.length === 0) throw new Error("DB Servicios devolvio 0 filas activas: no se publica una pagina vacia");
  if (clientesRaw.length === 0)  throw new Error("DB Clientes devolvio 0 filas visibles: no se publica una pagina vacia");

  const heroPalabras = (config["hero_palabras_rotativas"] ||
    "dibujo de planos,renders,retoque fotografico,fotos con drone,edicion de video,documentacion de obra,presupuestos,metrados,tramites municipales,declaraciones juradas,modelado 3D,asesorias")
    .split(",").map(s => s.trim());

  const whatsapp = config["whatsapp"] || "+598 92 459 376";
  const email    = config["email"]    || "ilchervonero@gmail.com";
  const waNum    = whatsapp.replace(/\D/g, "");

  const serviciosHTML = serviciosRaw.map((p, i) => {
    const nombre = getText(p.properties["Nombre"]);
    const desc   = getText(p.properties["Descripcion"]);
    const num    = String(i + 1).padStart(2, "0");
    return '      <div class="serv" data-item="' + nombre + '"><div class="serv-num">' + num + '</div><div class="serv-title">' + nombre + '</div><div class="serv-desc">' + desc + '</div><div class="serv-arrow">→</div></div>';
  }).join("\n");

  const clientesHTML = clientesRaw.map(p => {
    const nombre = getText(p.properties["Nombre"]);
    const rol    = getText(p.properties["Titulo"]);
    const span   = rol ? '<span class="role">' + rol + '</span>' : "";
    return '      <div class="cl">' + span + nombre + '</div>';
  }).join("\n");

  const appsActivas = appsRaw.filter(p => p.properties["Activo"]?.checkbox === true);
  const appsHTML = appsActivas.map(p => {
    const nombre = getText(p.properties["Nombre"]);
    const desc   = getText(p.properties["Descripcion"]);
    const url    = p.properties["URL"]?.url || "#";
    const icono  = getText(p.properties["Icono"]) || "⚙";
    const slugM  = url.match(/\/apps\/([^\/]+)\//);
    const icHtml = slugM ? '<img src="/apps/' + slugM[1] + '/icon-192.svg" alt="" style="width:100%;height:100%;display:block">' : icono;
    return '      <a class="app-card" href="' + url + '" target="_blank" rel="noopener">'
      + '<div class="app-ic">' + icHtml + '</div>'
      + '<div class="app-info"><div class="app-name">' + nombre + '</div><div class="app-desc">' + desc + '</div></div>'
      + '<div class="app-arrow">→</div>'
      + '</a>';
  }).join("\n");

  const palabrasJS = JSON.stringify(heroPalabras);

  const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800;900&display=swap');

  :root{--bg:#ffffff;--ink:#171717;--ink-2:#2a2a2a;--gray:#8a8d92;--gray-l:#bcc1c6;--plata:#aab0b6;--plata-l:#e5e7ea;--red:#fe0000}
  *{margin:0;padding:0;box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{background:var(--bg);color:var(--ink);font-family:'Geist',sans-serif;line-height:1.55;font-size:16px;-webkit-font-smoothing:antialiased;overflow-x:hidden}
  .wrap{max-width:1100px;margin:0 auto;padding:0 26px;position:relative}
  nav{position:sticky;top:0;z-index:60;background:rgba(255,255,255,.85);backdrop-filter:blur(14px)}
  .nav-in{display:flex;justify-content:space-between;align-items:center;height:64px}
  .brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--ink)}
  .burger{background:none;border:none;cursor:pointer;display:flex;flex-direction:column;gap:5px;padding:8px}
  .burger span{width:22px;height:2px;background:var(--ink);display:block;transition:.2s}
  .nav-links{display:flex;align-items:center;gap:26px}
  .nav-links a{color:var(--gray);text-decoration:none;font-size:14px;font-weight:500;transition:.18s}
  .nav-links a:hover{color:var(--red)}
  .nav-cta{color:var(--red)!important;font-weight:600!important}
  .nav-portal{background:var(--ink);color:#fff!important;padding:8px 18px;border-radius:20px;font-size:13px!important;font-weight:600!important;transition:.2s!important}
  .nav-portal:hover{background:var(--red)!important;color:#fff!important}
  @media(max-width:760px){.nav-links{display:none;position:fixed;top:64px;left:0;right:0;background:rgba(255,255,255,.97);backdrop-filter:blur(14px);flex-direction:column;align-items:flex-start;gap:0;padding:14px 26px 22px}.nav-links.open{display:flex}.nav-links a{width:100%;padding:14px 0;font-size:18px}}
  @media(min-width:761px){.burger{display:none}}
  .hero{padding:80px 24px;text-align:center;position:relative;overflow:hidden;width:100%}
  .audience{font-size:clamp(17px,2.6vw,24px);color:var(--red);text-transform:uppercase;letter-spacing:2.5px;margin-bottom:30px;font-weight:600;animation:fadeIn .8s ease}
  .hero h1{font-weight:900;font-size:clamp(52px,11vw,200px);line-height:.92;letter-spacing:-4px;color:var(--ink);animation:slideIn 1s cubic-bezier(.2,.7,.2,1);margin:0;text-align:center;word-break:keep-all;hyphens:none}
  .rotwrap{display:block;margin-top:40px;font-weight:400;font-size:clamp(20px,4vw,38px);letter-spacing:-.6px;color:var(--gray);animation:fadeIn 1.2s ease}
  .rot{display:inline-block;min-width:8ch;color:var(--red);font-weight:700;transition:opacity .35s,transform .35s,filter .35s}
  .rot.swap{opacity:0;transform:translateY(-14px) scale(.94);filter:blur(8px)}
  @keyframes slideIn{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:none}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  .blob{position:absolute;border-radius:50%;filter:blur(80px);opacity:.07;pointer-events:none;z-index:-1}
  .blob-1{width:380px;height:380px;background:var(--red);top:-100px;right:-80px;animation:float 14s ease-in-out infinite}
  .blob-2{width:300px;height:300px;background:var(--plata);bottom:-80px;left:-60px;animation:float 18s ease-in-out infinite reverse}
  @keyframes float{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(40px,30px) scale(1.1)}}
  .ps{padding:60px 0 100px;text-align:center}
  .ps .blk{max-width:680px;margin:0 auto 70px}
  .ps .blk:last-child{margin-bottom:0}
  .ps h2{font-weight:800;font-size:clamp(28px,4.5vw,40px);letter-spacing:-1.2px;margin-bottom:20px}
  .ps h2 b{color:var(--red);font-weight:800}
  .ps p{color:var(--ink-2);font-size:18px;line-height:1.6;max-width:54ch;margin:0 auto}
  .ps p b{color:var(--red);font-weight:600}
  .marquee{padding:24px 0;overflow:hidden;white-space:nowrap;background:linear-gradient(90deg,transparent 0%,var(--plata-l) 12%,var(--plata-l) 88%,transparent 100%)}
  .marquee .track{display:inline-block;animation:scroll 28s linear infinite;font-weight:700;font-size:clamp(20px,3vw,28px);letter-spacing:-.5px;color:var(--ink)}
  .marquee span em{color:var(--red);font-style:normal;margin:0 20px;font-weight:900}
  @keyframes scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
  .servicios{padding:100px 0}
  .serv-list{display:flex;flex-direction:column;gap:0}
  .serv{display:flex;align-items:baseline;gap:24px;padding:30px 0;cursor:pointer;position:relative;transition:.3s cubic-bezier(.2,.7,.2,1);border-bottom:1px solid var(--plata-l)}
  .serv:hover{padding-left:30px;border-color:var(--red)}
  .serv:hover .serv-num{color:var(--red);transform:rotate(-8deg) scale(1.15)}
  .serv:hover .serv-title{color:var(--red);letter-spacing:-1.5px}
  .serv:hover .serv-desc{opacity:1;transform:translateX(0)}
  .serv:hover .serv-arrow{transform:translateX(12px) scale(1.4);color:var(--red)}
  .serv-num{font-weight:700;font-size:18px;color:var(--gray-l);width:48px;flex-shrink:0;transition:.3s}
  .serv-title{font-weight:800;font-size:clamp(28px,5vw,56px);letter-spacing:-2px;line-height:1;color:var(--ink);transition:.3s;flex:1}
  .serv-desc{position:absolute;right:60px;top:50%;transform:translate(20px,-50%);color:var(--gray);font-size:15px;max-width:34ch;text-align:right;opacity:0;transition:.3s;pointer-events:none}
  .serv-arrow{font-size:28px;color:var(--gray-l);transition:.3s;flex-shrink:0;display:inline-block}
  @media(max-width:760px){.serv-desc{display:none}.serv-title{font-size:26px;letter-spacing:-1px}.serv:hover{padding-left:8px}}
  .about{padding:50px 0 40px;position:relative;overflow:hidden}
  .about-in{display:grid;grid-template-columns:1fr 240px;gap:60px;align-items:center}
  @media(max-width:760px){.about-in{grid-template-columns:1fr;text-align:center;gap:40px}.about .ph{margin:0 auto}}
  .about .k{font-size:clamp(20px,3vw,28px);color:var(--red);font-weight:600;letter-spacing:-.5px;margin-bottom:18px;display:block}
  .about p{color:var(--ink-2);font-size:clamp(18px,2.4vw,22px);max-width:54ch;line-height:1.55;font-weight:400}
  .about .ph{width:240px;height:240px;border-radius:50%;overflow:hidden;animation:gentle 7s ease-in-out infinite}
  .about .ph img{width:100%;height:100%;object-fit:cover;display:block}
  @keyframes gentle{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
  .clients{padding:50px 0 80px;text-align:center}
  .clients h2{font-weight:800;font-size:clamp(26px,4vw,38px);letter-spacing:-1px;margin-bottom:50px;color:var(--ink)}
  .client-cloud{display:flex;flex-wrap:wrap;justify-content:center;gap:14px 32px;max-width:900px;margin:0 auto}
  .cl{font-weight:700;font-size:clamp(20px,3vw,32px);letter-spacing:-.8px;color:var(--gray);transition:.3s;cursor:default}
  .cl:hover{color:var(--red);transform:translateY(-4px)}
  .cl .role{font-size:.55em;color:var(--gray-l);font-weight:500;letter-spacing:0;margin-right:8px;text-transform:uppercase}
  .contact{padding:100px 0 60px;text-align:center}
  .contact h2{font-weight:900;font-size:clamp(48px,9vw,110px);letter-spacing:-3.5px;line-height:.95;margin-bottom:50px;color:var(--ink)}
  .ch-buttons{display:flex;flex-direction:column;gap:18px;max-width:520px;margin:0 auto}
  .ch-btn{display:flex;align-items:center;gap:18px;padding:22px 28px;background:var(--plata-l);border-radius:60px;text-decoration:none;color:var(--ink);transition:.3s cubic-bezier(.2,.7,.2,1);text-align:left;position:relative;overflow:hidden}
  .ch-btn::before{content:"";position:absolute;inset:0;background:var(--red);transform:translateX(-100%);transition:.4s cubic-bezier(.2,.7,.2,1)}
  .ch-btn:hover::before{transform:translateX(0)}
  .ch-btn:hover{color:#fff;transform:scale(1.02)}
  .ch-btn:hover .ch-ic{background:#fff;color:var(--red)}
  .ch-btn:hover .ch-arrow{transform:translateX(8px);color:#fff}
  .ch-ic,.ch-tx,.ch-arrow{position:relative;z-index:1}
  .ch-ic{width:50px;height:50px;border-radius:50%;background:var(--red);color:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;transition:.3s}
  .ch-tx{flex:1}
  .ch-tx .lbl{font-size:12px;color:var(--gray);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:2px;transition:.3s}
  .ch-btn:hover .ch-tx .lbl{color:rgba(255,255,255,.7)}
  .ch-tx .val{font-weight:700;font-size:19px;letter-spacing:-.3px}
  .ch-arrow{font-size:24px;color:var(--gray);transition:.3s}
  footer{padding:50px 0;text-align:center;color:var(--gray);font-size:13px}
  footer a{color:var(--gray);text-decoration:none;margin:0 10px;transition:.2s}
  footer a:hover{color:var(--red)}
  .reveal{opacity:0;transform:translateY(28px);transition:.8s cubic-bezier(.2,.7,.2,1)}
  .reveal.in{opacity:1;transform:none}
  .wa-float{position:fixed;right:20px;bottom:20px;z-index:70;background:var(--red);color:#fff;width:58px;height:58px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:26px;text-decoration:none;box-shadow:0 10px 30px rgba(254,0,0,.4);animation:pulse 2.4s infinite;transition:.3s}
  .wa-float:hover{transform:scale(1.12) rotate(8deg)}
  @keyframes pulse{0%,100%{box-shadow:0 10px 30px rgba(254,0,0,.4)}50%{box-shadow:0 10px 30px rgba(254,0,0,.7),0 0 0 14px rgba(254,0,0,0)}}
  .apps{padding:80px 0}
  .apps h2{font-weight:800;font-size:clamp(26px,4vw,38px);letter-spacing:-1px;margin-bottom:40px;color:var(--ink)}
  .app-grid{display:flex;flex-direction:column;gap:0}
  .app-card{display:flex;align-items:center;gap:20px;padding:22px 0;text-decoration:none;color:var(--ink);border-bottom:1px solid var(--plata-l);transition:.3s cubic-bezier(.2,.7,.2,1)}
  .app-card:hover{padding-left:20px;border-color:var(--red)}
  .app-card:hover .app-arrow{transform:translateX(8px);color:var(--red)}
  .app-ic{font-size:28px;width:52px;height:52px;background:var(--plata-l);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:.3s;overflow:hidden}
  .app-card:hover .app-ic{background:var(--red);color:#fff}
  .app-info{flex:1}
  .app-name{font-weight:700;font-size:20px;letter-spacing:-.4px;margin-bottom:4px}
  .app-desc{color:var(--gray);font-size:14px}
  .app-arrow{font-size:22px;color:var(--gray-l);transition:.3s;flex-shrink:0}`;

  const JS = `
  const burger=document.getElementById('burger'),nav=document.getElementById('navlinks');
  burger.addEventListener('click',()=>nav.classList.toggle('open'));
  nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>nav.classList.remove('open')));
  const words=` + palabrasJS + `;
  let i=0;const rot=document.getElementById('rot');
  setInterval(()=>{rot.classList.add('swap');setTimeout(()=>{i=(i+1)%words.length;rot.textContent=words[i];rot.classList.remove('swap')},350)},2400);
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:0,rootMargin:'0px 0px -10px 0px'});
  document.querySelectorAll('.reveal').forEach(el=>io.observe(el));
  document.querySelectorAll('.serv[data-item]').forEach(b=>b.addEventListener('click',()=>{
    const msg=encodeURIComponent('Hola Chervo, me gustaria una cotizacion para: '+b.dataset.item+'.');
    window.open('https://wa.me/` + waNum + `?text='+msg,'_blank');
  }));`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Chervo</title>
<style>${CSS}
</style>
</head>
<body>

<nav>
  <div class="wrap nav-in">
    <a class="brand" href="#top">
      <img src="chervo_logo.svg" alt="Chervo" style="height:52px;width:auto">
    </a>
    <button class="burger" id="burger" aria-label="Menu"><span></span><span></span><span></span></button>
    <div class="nav-links" id="navlinks">
      <a href="#servicios">Servicios</a>
      <a href="#sobre">Equipo</a>
      <a href="#clientes">Clientes</a>
      <a href="#apps">Apps</a>
      <a href="#contacto" class="nav-cta">Por consultas</a>
      <a href="/clientes/" class="nav-portal">Area clientes</a>
    </div>
  </div>
</nav>

<header class="hero" id="top">
  <div class="blob blob-1"></div>
  <div class="blob blob-2"></div>
  <div class="audience">Tienes una idea o proyecto en mente</div>
  <h1>Buscando<br>ayuda?</h1>
  <div class="rotwrap">con <span class="rot" id="rot">` + heroPalabras[0] + `</span></div>
</header>

<section class="ps">
  <div class="wrap">
    <div class="blk reveal">
      <h2>El Problema</h2>
      <p>Tienes una idea y no sabes por dónde empezar. Tienes trabajo atrasado y necesitas retomarlo. Te falta tiempo para una entrega. Quieres armar un proyecto y no tienes personal suficiente.</p>
    </div>
    <div class="blk reveal">
      <h2>La Solucion</h2>
      <p>Te ofrecemos <b>20 años de experiencia</b> en diseño y construcción, trabajando con estudios de arquitectura y arquitectos freelance. Desarrollamos proyectos desde la idea hasta su documentación para entrega a clientes y entidades gubernamentales.</p>
    </div>
  </div>
</section>

<div class="marquee">
  <div class="track">
    <span>DIBUJO 2D &amp; 3D<em>·</em>RENDERS<em>·</em>DRONE<em>·</em>VIDEO<em>·</em>DECLARACIONES JURADAS<em>·</em>PRESUPUESTOS<em>·</em>METRADOS<em>·</em>INTENDENCIA &amp; BPS<em>·</em>ASESORIAS<em>·</em>SOFTWARE REMOTO<em>·</em></span>
    <span>DIBUJO 2D &amp; 3D<em>·</em>RENDERS<em>·</em>DRONE<em>·</em>VIDEO<em>·</em>DECLARACIONES JURADAS<em>·</em>PRESUPUESTOS<em>·</em>METRADOS<em>·</em>INTENDENCIA &amp; BPS<em>·</em>ASESORIAS<em>·</em>SOFTWARE REMOTO<em>·</em></span>
  </div>
</div>

<section class="servicios" id="servicios">
  <div class="wrap">
    <div class="serv-list">
` + serviciosHTML + `
    </div>
  </div>
</section>

<section class="about" id="sobre">
  <div class="wrap about-in reveal">
    <div>
      <span class="k">Un equipo para ti</span>
      <p>Somos un equipo con más de 20 años de experiencia en representación de ideas y desarrollo de proyectos. Nos ajustamos a tus necesidades y a tu presupuesto.</p>
    </div>
    <div class="ph"><img src="chervo_retrato.jpg" alt="Chervo"></div>
  </div>
</section>

<section class="clients" id="clientes">
  <div class="wrap reveal">
    <h2>Clientes</h2>
    <div class="client-cloud">
` + clientesHTML + `
    </div>
  </div>
</section>

<section class="apps" id="apps">
  <div class="wrap reveal">
    <h2>Aplicaciones</h2>
    <div class="app-grid">
` + appsHTML + `
    </div>
  </div>
</section>

<section class="contact" id="contacto">
  <div class="wrap reveal">
    <h2>Por consultas</h2>
    <div class="ch-buttons">
      <a class="ch-btn" href="https://wa.me/` + waNum + `" target="_blank" rel="noopener">
        <div class="ch-ic">&#9990;</div>
        <div class="ch-tx"><div class="lbl">WhatsApp</div><div class="val">` + whatsapp + `</div></div>
        <div class="ch-arrow">&#8594;</div>
      </a>
      <a class="ch-btn" href="mailto:` + email + `">
        <div class="ch-ic">&#9993;</div>
        <div class="ch-tx"><div class="lbl">Correo</div><div class="val">` + email + `</div></div>
        <div class="ch-arrow">&#8594;</div>
      </a>
    </div>
  </div>
</section>

<footer>
  <div class="wrap">
    &copy; 2026 Chervo &middot; IlChervoNero &middot;
    <a href="https://wa.me/` + waNum + `" target="_blank" rel="noopener">WhatsApp</a> &middot;
    <a href="mailto:` + email + `">Correo</a>
  </div>
</footer>

<a class="wa-float" href="https://wa.me/` + waNum + `" target="_blank" rel="noopener" aria-label="WhatsApp">&#9990;</a>

<script>${JS}
</script>

</body>
</html>`;

  fs.writeFileSync("index.html", html, "utf8");
  console.log(`generado index.html desde Notion (${serviciosRaw.length} servicios, ${clientesRaw.length} clientes, ${appsActivas.length} apps)`);
})().catch(err => {
  console.error("ERROR:", err.message);
  process.exit(1);
});
