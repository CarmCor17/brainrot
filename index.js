require("dotenv").config();
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const moment = require("moment-timezone");
const fs = require("fs");

const ZONA_HORARIA = "America/Hermosillo";
const AVISO_BORRADO_MS = 10 * 60 * 1000;
const ESTADO_FILE = "./estado.json";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ================= SERVIDORES =================
if (!process.env.SERVIDORES_Y_CANALES) {
  console.error("❌ Falta SERVIDORES_Y_CANALES");
  process.exit(1);
}

const SERVIDORES = {};
process.env.SERVIDORES_Y_CANALES.split(";").forEach(e => {
  const [s, c] = e.split(":");
  if (s && c) SERVIDORES[s.trim()] = c.split(",").map(x => x.trim());
});

// ================= EVENTOS (ORDEN REAL) =================
const eventos = [
  { nombre: "🌑 Darkness", intervaloHoras: 4, color: 0x2B2B2B },
  { nombre: "🧪 Toxic", intervaloHoras: 4, color: 0x00FF66 },
  { nombre: "🍀 Lucky Rot", intervaloHoras: 5, color: 0x66FF00 },
  { nombre: "💧 Aqua", intervaloHoras: 4, color: 0x00E5FF },
  { nombre: "💜 Neon", intervaloHoras: 4, color: 0xB026FF },
  { nombre: "🍫 Chocolate", intervaloHoras: 6, color: 0x5A2D0C }
];

// ================= ESTADO PERSISTENTE =================
let indiceEventoActual = 0;
let inicioEventoActual = Date.now();

function guardarEstado() {
  fs.writeFileSync(
    ESTADO_FILE,
    JSON.stringify(
      { indiceEvento: indiceEventoActual, inicioEvento: inicioEventoActual },
      null,
      2
    )
  );
}

function cargarEstado() {
  if (!fs.existsSync(ESTADO_FILE)) return;

  try {
    const data = JSON.parse(fs.readFileSync(ESTADO_FILE));
    indiceEventoActual = data.indiceEvento ?? 0;
    inicioEventoActual = data.inicioEvento ?? Date.now();
    console.log("📂 Estado cargado desde archivo");
  } catch {
    console.log("⚠️ No se pudo leer estado.json, usando valores por defecto");
  }
}

// ================= UTILIDADES =================
function eventoActual() {
  return eventos[indiceEventoActual];
}

function finEvento() {
  return inicioEventoActual + eventoActual().intervaloHoras * 60 * 60 * 1000;
}

function tiempoRestante(fin) {
  const diff = Math.max(0, fin - Date.now());
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

// ================= MENSAJE FIJO =================
const mensajesFijos = {};

async function actualizarTabla() {
  const ahora = Date.now();

  const embed = new EmbedBuilder()
    .setTitle("📅 Eventos – Steal the Brainrot")
    .setColor(0x00FF00)
    .setTimestamp(new Date());

  eventos.forEach((e, i) => {
    if (i === indiceEventoActual && ahora < finEvento()) {
      embed.addFields({
        name: `🔥 ${e.nombre} (Activo)`,
        value: `⏳ Termina en ${tiempoRestante(finEvento())}`
      });
    } else {
      embed.addFields({
        name: e.nombre,
        value: "⏱️ En rotación"
      });
    }
  });

  for (const sid in SERVIDORES) {
    for (const cid of SERVIDORES[sid]) {
      const canal = await client.channels.fetch(cid).catch(() => null);
      if (!canal) continue;

      if (!mensajesFijos[cid]) {
        mensajesFijos[cid] = await canal.send("Cargando eventos...");
      }

      await mensajesFijos[cid].edit({ embeds: [embed] }).catch(() => null);
    }
  }
}

// ================= ALERTAS =================
async function enviarAviso(texto, embed = null) {
  for (const sid in SERVIDORES) {
    for (const cid of SERVIDORES[sid]) {
      const canal = await client.channels.fetch(cid).catch(() => null);
      if (!canal) continue;

      const msg = await canal.send(embed ? { embeds: [embed] } : texto).catch(() => null);
      if (msg) setTimeout(() => msg.delete().catch(() => null), AVISO_BORRADO_MS);
    }
  }
}

// ================= ROTACIÓN =================
function iniciarEvento() {
  const evento = eventoActual();
  inicioEventoActual = Date.now();
  guardarEstado();

  enviarAviso(`🔥 ¡El evento **${evento.nombre}** ha comenzado!`);

  setTimeout(() => {
    indiceEventoActual = (indiceEventoActual + 1) % eventos.length;
    guardarEstado();
    programarEvento();
  }, evento.intervaloHoras * 60 * 60 * 1000);
}

function programarEvento() {
  const evento = eventoActual();
  const fin = finEvento();

  const aviso10m = fin - 10 * 60 * 1000;

  setTimeout(() => {
    const embed = new EmbedBuilder()
      .setTitle(`⏰ ${evento.nombre} termina en 10 minutos`)
      .setColor(evento.color);
    enviarAviso(null, embed);
  }, aviso10m - Date.now());

  setTimeout(iniciarEvento, fin - Date.now());
}

// ================= READY =================
client.once("ready", () => {
  console.log("🤖 Bot Brainrot listo");
  cargarEstado();
  actualizarTabla();
  setInterval(actualizarTabla, 5000);
  programarEvento();
});

client.login(process.env.DISCORD_TOKEN);
