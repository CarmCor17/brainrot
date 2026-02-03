require("dotenv").config();
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const moment = require("moment-timezone");
const express = require("express");

/* =======================
   🌐 SERVIDOR WEB (REPLIT)
======================= */
const app = express();
app.get("/", (req, res) => {
  res.send("🤖 Bot Steal the Brainrot activo ✅");
});
app.listen(3000, () => {
  console.log("🌐 Servidor web activo (Replit + UptimeRobot)");
});

/* =======================
   🤖 CONFIG BOT DISCORD
======================= */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const ZONA_HORARIA = "America/Hermosillo";

/* =======================
   📡 SERVIDORES / CANALES
======================= */
if (!process.env.SERVIDORES_Y_CANALES) {
  console.error("❌ Falta SERVIDORES_Y_CANALES en .env");
  process.exit(1);
}

const SERVIDORES = {};
process.env.SERVIDORES_Y_CANALES.split(";").forEach(entry => {
  const [serverId, canales] = entry.split(":");
  if (serverId && canales) {
    SERVIDORES[serverId.trim()] = canales.split(",").map(c => c.trim());
  }
});

/* =======================
   ⏱️ FUNCIONES TIEMPO
======================= */
function nextUnixEvento(hora, minuto, intervaloHoras) {
  const ahora = moment().tz(ZONA_HORARIA);
  let evento = ahora.clone().hour(hora).minute(minuto).second(0);

  while (evento.valueOf() <= ahora.valueOf()) {
    evento.add(intervaloHoras, "hours");
  }
  return evento.valueOf();
}

function tiempoRestante(timestamp) {
  const ahora = moment().tz(ZONA_HORARIA).valueOf();
  let diff = timestamp - ahora;
  if (diff < 0) diff = 0;

  const s = Math.floor(diff / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  if (s < 60) return `${sec}s`;
  return `${h}h ${m}m`;
}

/* =======================
   🎮 EVENTOS BRAINROT
======================= */
const eventos = [
  { nombre: "🌑 Darkness",  nextUnix: nextUnixEvento(2, 35, 4), intervaloHoras: 4, color: 0x4B4B4B },
  { nombre: "🧪 Toxic",     nextUnix: nextUnixEvento(4, 30, 4), intervaloHoras: 4, color: 0x00FF00 },
  { nombre: "🍀 Lucky Rot", nextUnix: nextUnixEvento(7, 0, 5),  intervaloHoras: 5, color: 0xFFD700 },
  { nombre: "💧 Aqua",      nextUnix: nextUnixEvento(9, 0, 6),  intervaloHoras: 6, color: 0x00BFFF },
  { nombre: "🌈 Neon",      nextUnix: nextUnixEvento(12, 0, 6), intervaloHoras: 6, color: 0xFF00FF },
  { nombre: "🍫 Chocolate", nextUnix: nextUnixEvento(15, 0, 8), intervaloHoras: 8, color: 0x8B4513 }
];

function eventosOrdenados() {
  return eventos.slice().sort((a, b) => a.nextUnix - b.nextUnix);
}

/* =======================
   📌 MENSAJES FIJOS
======================= */
const mensajesDinamicos = {};
const ultimoEmbedStringPorCanal = {};

/* =======================
   📅 ACTUALIZAR EMBED
======================= */
async function actualizarMensajes() {
  const ahora = moment().tz(ZONA_HORARIA).valueOf();

  eventos.forEach(evento => {
    while (evento.nextUnix <= ahora) {
      evento.nextUnix += evento.intervaloHoras * 60 * 60 * 1000;
    }
  });

  const ordenados = eventosOrdenados();
  const siguiente = ordenados[0];

  const embed = new EmbedBuilder()
    .setTitle("📅 Próximos eventos de Steal the Brainrot")
    .setColor(siguiente.color)
    .setTimestamp(moment().tz(ZONA_HORARIA).toDate())
    .setFooter({ text: "Tiempo restante para que empiece cada evento" });

  ordenados.forEach(evento => {
    embed.addFields({
      name: evento === siguiente
        ? `➡️ **${evento.nombre} (Siguiente)**`
        : evento.nombre,
      value: `🕒 Empieza en **${tiempoRestante(evento.nextUnix)}**`,
      inline: false
    });
  });

  for (const serverId in SERVIDORES) {
    for (const canalId of SERVIDORES[serverId]) {
      const canal = await client.channels.fetch(canalId).catch(() => null);
      if (!canal) continue;

      if (!mensajesDinamicos[canalId]) {
        mensajesDinamicos[canalId] = await canal.send("Cargando eventos...");
      }

      const mensaje = mensajesDinamicos[canalId];
      const embedString = JSON.stringify(embed.data);

      if (embedString !== ultimoEmbedStringPorCanal[canalId]) {
        await mensaje.edit({ embeds: [embed] }).catch(() => null);
        ultimoEmbedStringPorCanal[canalId] = embedString;
      }
    }
  }
}

/* =======================
   ⏰ ALERTAS EVENTOS
======================= */
function programarEvento(evento) {
  const ahora = moment().tz(ZONA_HORARIA).valueOf();
  while (evento.nextUnix <= ahora) {
    evento.nextUnix += evento.intervaloHoras * 60 * 60 * 1000;
  }

  const aviso10m = evento.nextUnix - 10 * 60 * 1000;

  setTimeout(async () => {
    for (const serverId in SERVIDORES) {
      for (const canalId of SERVIDORES[serverId]) {
        const canal = await client.channels.fetch(canalId).catch(() => null);
        if (!canal) continue;

        const msg = await canal.send(
          `⏰ **${evento.nombre}** empieza en 10 minutos`
        ).catch(() => null);

        if (msg) setTimeout(() => msg.delete().catch(() => null), 10 * 60 * 1000);
      }
    }

    const espera = evento.nextUnix - moment().tz(ZONA_HORARIA).valueOf();
    setTimeout(async () => {
      for (const serverId in SERVIDORES) {
        for (const canalId of SERVIDORES[serverId]) {
          const canal = client.channels.cache.get(canalId);
          if (!canal) continue;

          const msg = await canal.send(
            `🚨 **${evento.nombre}** ha comenzado`
          ).catch(() => null);

          if (msg) setTimeout(() => msg.delete().catch(() => null), 10 * 60 * 1000);
        }
      }

      evento.nextUnix += evento.intervaloHoras * 60 * 60 * 1000;
      programarEvento(evento);
    }, espera);

  }, aviso10m - ahora);
}

/* =======================
   🚀 BOT READY
======================= */
client.once("ready", () => {
  console.log("🤖 Bot conectado correctamente");
  actualizarMensajes();
  setInterval(actualizarMensajes, 5000);
  eventos.forEach(e => programarEvento(e));
});

/* =======================
   🧪 COMANDO TEST
======================= */
client.on("messageCreate", msg => {
  if (msg.author.bot) return;
  if (msg.content === "!ping") msg.channel.send("🏓 Pong!");
});

client.login(process.env.DISCORD_TOKEN);
