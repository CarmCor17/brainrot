require("dotenv").config();
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require("discord.js");
const express = require("express");
const moment = require("moment-timezone");

/* =========================
   🌐 SERVIDOR WEB (Express)
========================= */
const app = express();
const PORT = process.env.PORT || 3000;

// Ruta raíz para UptimeRobot
app.get("/", (req, res) => res.send("Bot Brainrot activo ✅"));

// Función para iniciar servidor con manejo de puerto ocupado
function iniciarServidor(port) {
  const server = app.listen(port, () => console.log(`🌐 Servidor web activo en puerto ${port}`));

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log(`❌ Puerto ${port} ocupado, intentando de nuevo en 3000`);
      setTimeout(() => iniciarServidor(port), 2000); // reintenta en 2 segundos
    } else {
      console.error(err);
    }
  });
}

// Inicia el servidor
iniciarServidor(PORT);

/* =========================
   🤖 DISCORD CLIENT
========================= */
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

/* =========================
   🏠 SERVIDORES Y CANALES
========================= */
const SERVIDORES = {
  "1468120013432164393": ["1468120014023299156"],
};

/* =========================
   ⏰ FUNCIONES DE TIEMPO (Hora de Nogales, Sonora)
========================= */
function obtenerAhoraNogales() {
  return moment.tz("America/Hermosillo");
}

function programarEvento(ev, hora, minuto) {
  let ahora = obtenerAhoraNogales();
  let nuevaFecha = ahora.clone().hour(hora).minute(minuto).second(0).millisecond(0);
  if (nuevaFecha.isBefore(ahora)) nuevaFecha.add(1, "day");
  ev.proximoInicio = nuevaFecha;
}

function nextUnixEvento(ev) {
  let ahora = obtenerAhoraNogales();
  let evento = ev.proximoInicio.clone();
  const intervaloMs = (ev.intervaloHoras * 60 + ev.intervaloMinutos) * 60 * 1000;
  while (evento.isBefore(ahora)) evento = evento.add(intervaloMs, "ms");
  return evento.valueOf();
}

function tiempoRestante(ms) {
  let diff = ms - Date.now();
  if (diff < 0) diff = 0;
  const totalSeg = Math.floor(diff / 1000);
  const h = Math.floor(totalSeg / 3600);
  const m = Math.floor((totalSeg % 3600) / 60);
  const s = totalSeg % 60;
  if (totalSeg < 60) return `${s}s`;
  if (h === 0) return `${m}m ${s}s`;
  return `${h}h ${m}m`;
}

/* =========================
   📌 EVENTOS
========================= */
const eventos = [
  { nombre: "darkness", nombreTabla: "🌑 Darkness", intervaloHoras: 2, intervaloMinutos: 40, color: 0x4b4b4b, alerta10min: false, alertaInicio: false, proximoInicio: null },
  { nombre: "aqua", nombreTabla: "💧 Aqua", intervaloHoras: 2, intervaloMinutos: 40, color: 0x00ffff, alerta10min: false, alertaInicio: false, proximoInicio: null },
  { nombre: "lucky rot", nombreTabla: "🍀 Lucky Rot", intervaloHoras: 5, intervaloMinutos: 40, color: 0x00ff00, alerta10min: false, alertaInicio: false, proximoInicio: null },
  { nombre: "toxic", nombreTabla: "☢️ Toxic", intervaloHoras: 3, intervaloMinutos: 0, color: 0xff0000, alerta10min: false, alertaInicio: false, proximoInicio: null },
  { nombre: "neon", nombreTabla: "🔮 Neon", intervaloHoras: 10, intervaloMinutos: 40, color: 0xff00ff, alerta10min: false, alertaInicio: false, proximoInicio: null },
  { nombre: "chocolate", nombreTabla: "🍫 Chocolate", intervaloHoras: 2, intervaloMinutos: 40, color: 0x8b4513, alerta10min: false, alertaInicio: false, proximoInicio: null },
];

// Configurar horarios iniciales
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
const alertasPendientes = [];

async function manejarAlertas(ev, tipo) {
  for (const servidorId in SERVIDORES) {
    for (const canalId of SERVIDORES[servidorId]) {
      const canal = await client.channels.fetch(canalId).catch(() => null);
      if (!canal) continue;
      const texto = tipo === "10min" ? `⏳ Faltan 10 minutos para **${ev.nombreTabla}**` : `✅ ¡Comenzó el evento **${ev.nombreTabla}**!`;
      const mensaje = await canal.send(texto);

      const timeout = setTimeout(async () => {
        try { await mensaje.delete(); } catch (e) {}
        const index = alertasPendientes.findIndex(a => a.mensaje.id === mensaje.id);
        if (index !== -1) alertasPendientes.splice(index, 1);
        if (alertasPendientes.length === 0) {
          ultimaTabla = "";
          await actualizarTabla();
        }
      }, 10 * 60_000);

      alertasPendientes.push({ mensaje, timeout });
    }
  }
}

async function actualizarTabla() {
  const embed = new EmbedBuilder()
    .setTitle("📆 Eventos – Steal The Brainrot")
    .setFooter({ text: "Tiempo restante para que COMIENCE cada evento" })
    .setTimestamp();

  let contenido = "";

  const eventosOrdenados = eventos
    .map(ev => ({ ev, next: nextUnixEvento(ev) }))
    .sort((a, b) => a.next - b.next);

  eventosOrdenados.forEach(({ ev, next }) => {
    const tiempo = tiempoRestante(next);

    if (!ev.alerta10min && next - Date.now() <= 10*60_000 && next - Date.now() > 0) {
      ev.alerta10min = true;
      manejarAlertas(ev,"10min");
    }

    if (!ev.alertaInicio && next - Date.now() <= 0) {
      ev.alertaInicio = true;
      manejarAlertas(ev,"inicio");
      ev.alerta10min = false;
      ev.alertaInicio = false;
    }

    if (next - Date.now() <= 10_000) {
      const now = Date.now();
      embed.setColor(Math.floor(now/500)%2===0 ? 0xff0000 : 0xffa500);
    } else if (next - Date.now() < 60_000) {
      embed.setColor(0xff0000);
    } else {
      embed.setColor(ev.color);
    }

    embed.addFields({ name: ev.nombreTabla, value: `⏳ Empieza en **${tiempo}**`, inline: false });
    contenido += `${ev.nombreTabla}: ${tiempo}\n`;
  });

  if(!ultimaTabla || contenido !== ultimaTabla){
    for(const servidorId in SERVIDORES){
      for(const canalId of SERVIDORES[servidorId]){
        const canal = await client.channels.fetch(canalId).catch(()=>null);
        if(!canal) continue;

        if(!mensajesTabla[canalId]) mensajesTabla[canalId] = await canal.send({ embeds:[embed] });
        else await mensajesTabla[canalId].edit({ embeds:[embed] });
      }
    }
    ultimaTabla = contenido;
  }
}

let intervaloHandle = null;
function iniciarIntervalo() {
  clearInterval(intervaloHandle);
  intervaloHandle = setInterval(actualizarTabla, 1000);
}

/* =========================
   COMANDOS DE DISCORD
========================= */
const comandos = [
  new SlashCommandBuilder()
    .setName("reiniciar-evento")
    .setDescription("Reinicia un evento desde la hora actual")
    .addStringOption(option=>option.setName("evento").setDescription("Nombre del evento").setRequired(true)),
  new SlashCommandBuilder()
    .setName("reiniciar-todos")
    .setDescription("Reinicia todos los eventos desde la hora actual"),
  new SlashCommandBuilder()
    .setName("programar-evento")
    .setDescription("Programar un evento a una hora específica")
    .addStringOption(option=>option.setName("evento").setDescription("Nombre del evento").setRequired(true))
    .addIntegerOption(option=>option.setName("hora").setDescription("Hora inicio 0-23").setRequired(true))
    .addIntegerOption(option=>option.setName("minuto").setDescription("Minuto inicio 0-59").setRequired(true))
].map(cmd=>cmd.toJSON());

/* =========================
   🚀 INICIO DEL BOT
========================= */
client.once("ready", async () => {
  console.log(`🤖 Bot conectado como ${client.user.tag}`);

  const rest = new REST({ version:"10" }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(client.user.id,"1468120013432164393"), { body: comandos });
    console.log("✅ Comandos registrados en el servidor");
  } catch(err) { console.error(err); }

  iniciarIntervalo();
});

// Manejo de comandos
client.on("interactionCreate", async interaction => {
  if(!interaction.isChatInputCommand()) return;

  if(interaction.commandName === "reiniciar-evento") {
    const ev = eventos.find(e => e.nombre.toLowerCase() === interaction.options.getString("evento").toLowerCase());
    if(!ev) return interaction.reply({ content:"Evento no encontrado", ephemeral:true });
    ev.proximoInicio = obtenerAhoraNogales();
    iniciarIntervalo();
    interaction.reply({ content:`Evento ${ev.nombreTabla} reiniciado desde ahora ✅`, ephemeral:true });
    await actualizarTabla();
  }

  if(interaction.commandName === "reiniciar-todos") {
    eventos.forEach(ev => ev.proximoInicio = obtenerAhoraNogales());
    iniciarIntervalo();
    interaction.reply({ content:"✅ Todos los eventos reiniciados desde ahora", ephemeral:true });
    await actualizarTabla();
  }

  if(interaction.commandName === "programar-evento") {
    const nombre = interaction.options.getString("evento");
    const hora = interaction.options.getInteger("hora");
    const minuto = interaction.options.getInteger("minuto");
    const ev = eventos.find(e => e.nombre.toLowerCase() === nombre.toLowerCase());
    if(!ev) return interaction.reply({ content:"Evento no encontrado", ephemeral:true });
    programarEvento(ev, hora, minuto);
    iniciarIntervalo();
    await actualizarTabla();
    interaction.reply({ content:`✅ Evento ${ev.nombreTabla} programado a las ${hora}:${minuto<10?"0"+minuto:minuto}`, ephemeral:true });
  }
});

// Mantener Repl activo
setInterval(() => console.log("⏱️ Bot sigue activo"), 240_000);

client.login(process.env.DISCORD_TOKEN);
