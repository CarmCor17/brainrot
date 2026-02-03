require("dotenv").config();
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const moment = require("moment-timezone");

// Configuración del bot
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const ZONA_HORARIA = "America/Hermosillo";

// IDs de canales separados por coma en .env
if (!process.env.ID_CANAL_EVENTOS) {
  console.error("❌ No se ha definido ID_CANAL_EVENTOS en las variables de entorno.");
  process.exit(1);
}

const CANALES_EVENTOS = process.env.ID_CANAL_EVENTOS.split(",").map(id => id.trim());

// Definición de eventos
const eventos = [
  { nombre: "🌑 Darkness", nextUnix: moment.tz("2026-02-02 00:00", ZONA_HORARIA).valueOf(), intervaloHoras: 4, color: 0x4B4B4B },
  { nombre: "🧪 Toxic", nextUnix: moment.tz("2026-02-02 01:30", ZONA_HORARIA).valueOf(), intervaloHoras: 4, color: 0x00FF00 },
  { nombre: "🍀 Lucky Rot", nextUnix: moment.tz("2026-02-02 03:00", ZONA_HORARIA).valueOf(), intervaloHoras: 5, color: 0xFFD700 }
];

const mensajesDinamicos = {}; // Para cada canal
const ultimoEmbedStringPorCanal = {};

// Calcula tiempo restante
function tiempoRestante(timestamp) {
  const ahora = moment().tz(ZONA_HORARIA).valueOf();
  let diff = timestamp - ahora;
  if (diff < 0) diff = 0;

  const totalSegundos = Math.floor(diff / 1000);
  const horas = Math.floor(totalSegundos / 3600);
  const minutos = Math.floor((totalSegundos % 3600) / 60);
  const segundos = totalSegundos % 60;

  if (totalSegundos < 60) return `${segundos}s`;
  return `${horas}h ${minutos}m`;
}

// Ordena eventos por próxima hora
function eventosOrdenados() {
  return eventos.slice().sort((a, b) => a.nextUnix - b.nextUnix);
}

// Actualiza embeds en todos los canales
async function actualizarMensajes() {
  const ahora = moment().tz(ZONA_HORARIA).valueOf();
  const embed = new EmbedBuilder()
    .setTitle("📅 Próximos eventos de Steal the Brainrot")
    .setColor(0x00FF00)
    .setTimestamp(moment().tz(ZONA_HORARIA).toDate())
    .setFooter({ text: "Zona horaria: Nogales, Sonora" });

  const ordenados = eventosOrdenados();
  const proximoEvento = ordenados.find(e => e.nextUnix > ahora) || ordenados[0];

  ordenados.forEach(evento => {
    let nombre = evento.nombre;
    let valor = "";
    const inicio = evento.nextUnix;
    const fin = evento.nextUnix + evento.intervaloHoras * 60 * 60 * 1000;

    if (ahora >= inicio && ahora < fin) {
      nombre = `🔥 ${nombre} (En curso)`;
      valor = `⏰ ${moment(inicio).tz(ZONA_HORARIA).format("HH:mm:ss")} hs - ${moment(fin).tz(ZONA_HORARIA).format("HH:mm:ss")} hs\n🕒 Termina en ${tiempoRestante(fin)}`;
    } else {
      if (evento === proximoEvento) nombre = `➡️ **${nombre}**`;
      valor = `⏰ ${moment(inicio).tz(ZONA_HORARIA).format("HH:mm:ss")} hs\n🕒 Comienza en ${tiempoRestante(inicio)}`;
    }

    embed.addFields({ name: nombre, value: valor, inline: false });
  });

  // Actualiza cada canal
  CANALES_EVENTOS.forEach(async id => {
    const canal = client.channels.cache.get(id);
    if (!canal) return;

    if (!mensajesDinamicos[id]) {
      // Buscar mensaje anterior
      const mensajes = await canal.messages.fetch({ limit: 10 }).catch(() => []);
      const encontrado = mensajes.find(msg => msg.author.id === client.user.id && msg.embeds.length > 0 && msg.embeds[0].title?.includes("Próximos eventos"));
      if (encontrado) {
        mensajesDinamicos[id] = encontrado;
      } else {
        mensajesDinamicos[id] = await canal.send({ content: "Cargando próximos eventos..." }).catch(() => null);
      }
    }

    const mensaje = mensajesDinamicos[id];
    if (!mensaje) return;

    const embedString = JSON.stringify(embed.data);
    if (embedString !== ultimoEmbedStringPorCanal[id]) {
      await mensaje.edit({ embeds: [embed] }).catch(() => null);
      ultimoEmbedStringPorCanal[id] = embedString;
    }
  });
}

// Programar avisos en todos los canales
function programarEvento(evento) {
  const ahora = moment().tz(ZONA_HORARIA).valueOf();

  while (evento.nextUnix <= ahora) {
    evento.nextUnix += evento.intervaloHoras * 60 * 60 * 1000;
  }

  const avisoUnix = evento.nextUnix - 10 * 60 * 1000;

  setTimeout(() => {
    CANALES_EVENTOS.forEach(id => {
      const canal = client.channels.cache.get(id);
      if (canal) canal.send(`⏰ ¡Atención! El evento **${evento.nombre}** comienza en 10 minutos (${moment(evento.nextUnix).tz(ZONA_HORARIA).format("HH:mm:ss")} hs). ¡Prepárate!`).catch(() => null);
    });

    const tiempoParaEvento = evento.nextUnix - moment().tz(ZONA_HORARIA).valueOf();
    setTimeout(() => {
      CANALES_EVENTOS.forEach(id => {
        const canal = client.channels.cache.get(id);
        if (canal) canal.send(`🚨 ¡El evento **${evento.nombre}** ha comenzado!`).catch(() => null);
      });
      evento.nextUnix += evento.intervaloHoras * 60 * 60 * 1000;
      programarEvento(evento);
    }, tiempoParaEvento);

  }, avisoUnix - ahora);
}

// Inicio del bot
client.once("clientReady", async () => {
  console.log("🤖 Bot encendido correctamente");

  setInterval(actualizarMensajes, 5000);
  actualizarMensajes();

  eventos.forEach(evento => programarEvento(evento));
});

// Comando de prueba
client.on("messageCreate", message => {
  if (message.author.bot) return;
  if (message.content.toLowerCase() === "!ping") {
    message.channel.send("🏓 Pong! El bot funciona").catch(() => null);
  }
});

// Confirmación de token cargado
console.log("Token cargado:", !!process.env.DISCORD_TOKEN);

// Login
client.login(process.env.DISCORD_TOKEN);
