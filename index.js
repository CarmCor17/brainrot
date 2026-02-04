require("dotenv").config();
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require("discord.js");
const express = require("express");
const moment = require("moment-timezone");

/* =========================
   🌐 SERVIDOR WEB (Fly.io + UptimeRobot)
========================= */
const app = express();
const PORT = process.env.PORT || 3000;

// Ruta raíz (UptimeRobot)
app.get("/", (req, res) => {
  res.status(200).send("Bot Brainrot activo ✅");
});

// ⚠️ Fly.io REQUIERE esto
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Servidor web activo en puerto ${PORT}`);
});

/* =========================
   🤖 CLIENTE DE DISCORD
========================= */
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

/* =========================
   🏠 SERVIDORES Y CANALES
========================= */
const SERVIDORES = {
  "1468120013432164393": ["1468120014023299156"],
};

/* =========================
   ⏰ TIEMPO (Nogales, Sonora)
========================= */
function ahoraNogales() {
  return moment.tz("America/Hermosillo");
}

function programarEvento(ev, hora, minuto) {
  const ahora = ahoraNogales();
  let fecha = ahora.clone().hour(hora).minute(minuto).second(0).millisecond(0);
  if (fecha.isBefore(ahora)) fecha.add(1, "day");
  ev.proximoInicio = fecha;
}

function siguienteEvento(ev) {
  const ahora = ahoraNogales();
  let fecha = ev.proximoInicio.clone();
  const intervaloMs = (ev.intervaloHoras * 60 + ev.intervaloMinutos) * 60 * 1000;
  while (fecha.isBefore(ahora)) fecha.add(intervaloMs, "ms");
  return fecha.valueOf();
}

function tiempoRestante(ms) {
  let diff = ms - Date.now();
  if (diff < 0) diff = 0;

  const s = Math.floor(diff / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  if (s < 60) return `${sec}s`;
  if (h === 0) return `${m}m ${sec}s`;
  return `${h}h ${m}m`;
}

/* =========================
   📌 EVENTOS
========================= */
const eventos = [
  { nombre: "darkness", nombreTabla: "🌑 Darkness", intervaloHoras: 2, intervaloMinutos: 40, color: 0x4b4b4b, alerta10: false, alertaInicio: false },
  { nombre: "aqua", nombreTabla: "💧 Aqua", intervaloHoras: 2, intervaloMinutos: 40, color: 0x00ffff, alerta10: false, alertaInicio: false },
  { nombre: "lucky rot", nombreTabla: "🍀 Lucky Rot", intervaloHoras: 5, intervaloMinutos: 40, color: 0x00ff00, alerta10: false, alertaInicio: false },
  { nombre: "toxic", nombreTabla: "☢️ Toxic", intervaloHoras: 3, intervaloMinutos: 0, color: 0xff0000, alerta10: false, alertaInicio: false },
  { nombre: "neon", nombreTabla: "🔮 Neon", intervaloHoras: 10, intervaloMinutos: 40, color: 0xff00ff, alerta10: false, alertaInicio: false },
  { nombre: "chocolate", nombreTabla: "🍫 Chocolate", intervaloHoras: 2, intervaloMinutos: 40, color: 0x8b4513, alerta10: false, alertaInicio: false },
];

// Horarios iniciales
programarEvento(eventos[0], 22, 0);
programarEvento(eventos[1], 5, 30);
programarEvento(eventos[2], 0, 0);
programarEvento(eventos[3], 21, 0);
programarEvento(eventos[4], 1, 0);
programarEvento(eventos[5], 20, 20);

/* =========================
   📊 TABLA Y ALERTAS
========================= */
const mensajesTabla = {};
let ultimaTabla = "";
const alertasActivas = [];

async function enviarAlerta(ev, tipo) {
  const texto =
    tipo === "10"
      ? `⏳ Faltan 10 minutos para **${ev.nombreTabla}**`
      : `✅ ¡Comenzó el evento **${ev.nombreTabla}**!`;

  for (const sid in SERVIDORES) {
    for (const cid of SERVIDORES[sid]) {
      const canal = await client.channels.fetch(cid).catch(() => null);
      if (!canal) continue;

      const msg = await canal.send(texto);

      const timeout = setTimeout(async () => {
        try { await msg.delete(); } catch {}
        const i = alertasActivas.findIndex(a => a.msg.id === msg.id);
        if (i !== -1) alertasActivas.splice(i, 1);
        if (alertasActivas.length === 0) {
          ultimaTabla = "";
          await actualizarTabla();
        }
      }, 10 * 60_000);

      alertasActivas.push({ msg, timeout });
    }
  }
}

async function actualizarTabla() {
  const embed = new EmbedBuilder()
    .setTitle("📆 Eventos – Steal The Brainrot")
    .setFooter({ text: "Tiempo restante para que COMIENCE cada evento" })
    .setTimestamp();

  let contenido = "";

  const ordenados = eventos
    .map(ev => ({ ev, next: siguienteEvento(ev) }))
    .sort((a, b) => a.next - b.next);

  for (const { ev, next } of ordenados) {
    const restante = tiempoRestante(next);
    const diff = next - Date.now();

    if (!ev.alerta10 && diff <= 10 * 60_000 && diff > 0) {
      ev.alerta10 = true;
      enviarAlerta(ev, "10");
    }

    if (!ev.alertaInicio && diff <= 0) {
      ev.alertaInicio = true;
      enviarAlerta(ev, "inicio");
      ev.alerta10 = false;
      ev.alertaInicio = false;
    }

    embed.setColor(diff < 60_000 ? 0xff0000 : ev.color);
    embed.addFields({ name: ev.nombreTabla, value: `⏳ Empieza en **${restante}**` });
    contenido += `${ev.nombreTabla}:${restante}\n`;
  }

  if (contenido !== ultimaTabla) {
    for (const sid in SERVIDORES) {
      for (const cid of SERVIDORES[sid]) {
        const canal = await client.channels.fetch(cid).catch(() => null);
        if (!canal) continue;

        if (!mensajesTabla[cid]) mensajesTabla[cid] = await canal.send({ embeds: [embed] });
        else await mensajesTabla[cid].edit({ embeds: [embed] });
      }
    }
    ultimaTabla = contenido;
  }
}

/* =========================
   ⏱️ INTERVALO
========================= */
setInterval(actualizarTabla, 1000);

/* =========================
   🧾 COMANDOS SLASH
========================= */
const comandos = [
  new SlashCommandBuilder()
    .setName("reiniciar-evento")
    .setDescription("Reinicia un evento")
    .addStringOption(o => o.setName("evento").setRequired(true)),
  new SlashCommandBuilder()
    .setName("reiniciar-todos")
    .setDescription("Reinicia todos los eventos"),
  new SlashCommandBuilder()
    .setName("programar-evento")
    .setDescription("Programa un evento")
    .addStringOption(o => o.setName("evento").setRequired(true))
    .addIntegerOption(o => o.setName("hora").setRequired(true))
    .addIntegerOption(o => o.setName("minuto").setRequired(true)),
].map(c => c.toJSON());

/* =========================
   🚀 INICIO
========================= */
client.once("ready", async () => {
  console.log(`🤖 Bot conectado como ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(client.user.id, "1468120013432164393"),
    { body: comandos }
  );

  console.log("✅ Comandos registrados");
});

client.on("interactionCreate", async i => {
  if (!i.isChatInputCommand()) return;

  if (i.commandName === "reiniciar-evento") {
    const ev = eventos.find(e => e.nombre === i.options.getString("evento").toLowerCase());
    if (!ev) return i.reply({ content: "Evento no encontrado", ephemeral: true });
    ev.proximoInicio = ahoraNogales();
    i.reply({ content: "Evento reiniciado ✅", ephemeral: true });
  }

  if (i.commandName === "reiniciar-todos") {
    eventos.forEach(ev => (ev.proximoInicio = ahoraNogales()));
    i.reply({ content: "Todos reiniciados ✅", ephemeral: true });
  }

  if (i.commandName === "programar-evento") {
    const ev = eventos.find(e => e.nombre === i.options.getString("evento").toLowerCase());
    if (!ev) return i.reply({ content: "Evento no encontrado", ephemeral: true });
    programarEvento(ev, i.options.getInteger("hora"), i.options.getInteger("minuto"));
    i.reply({ content: "Evento programado ✅", ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
