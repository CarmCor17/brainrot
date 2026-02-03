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
const ID_CANAL_EVENTOS = "1467988584966652073";

// Definición de eventos
const eventos = [
  { nombre: "🌑 Darkness", nextUnix: moment.tz("2026-02-02 00:00", ZONA_HORARIA).valueOf(), intervaloHoras: 4, color: 0x4B4B4B },
  { nombre: "🧪 Toxic", nextUnix: moment.tz("2026-02-02 01:30", ZONA_HORARIA).valueOf(), intervaloHoras: 4, color: 0x00FF00 },
  { nombre: "🍀 Lucky Rot", nextUnix: moment.tz("2026-02-02 03:00", ZONA_HORARIA).valueOf(), intervaloHoras: 5, color: 0xFFD700 }
];

let mensajeDinamico;
let ultimoEmbedString = "";

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

// Actualiza el embed dinámico
async function actualizarMensaje() {
  if (!mensajeDinamico) return;

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

  const embedString = JSON.stringify(embed.data);
  if (embedString !== ultimoEmbedString) {
    try {
      await mensajeDinamico.edit({ embeds: [embed] });
      ultimoEmbedString = embedString;
    } catch (error) {
      console.error("No se pudo actualizar el mensaje dinámico:", error);
    }
  }
}

// Programar avisos de eventos
function programarEvento(evento) {
  const ahora = moment().tz(ZONA_HORARIA).valueOf();

  while (evento.nextUnix <= ahora) {
    evento.nextUnix += evento.intervaloHoras * 60 * 60 * 1000;
  }

  const avisoUnix = evento.nextUnix - 10 * 60 * 1000;

  setTimeout(() => {
    const canal = client.channels.cache.get(ID_CANAL_EVENTOS);
    if (canal) {
      canal.send(`⏰ ¡Atención! El evento **${evento.nombre}** comienza en 10 minutos (${moment(evento.nextUnix).tz(ZONA_HORARIA).format("HH:mm:ss")} hs). ¡Prepárate!`);
    }

    const tiempoParaEvento = evento.nextUnix - moment().tz(ZONA_HORARIA).valueOf();
    setTimeout(() => {
      if (canal) canal.send(`🚨 ¡El evento **${evento.nombre}** ha comenzado!`);
      evento.nextUnix += evento.intervaloHoras * 60 * 60 * 1000;
      programarEvento(evento);
    }, tiempoParaEvento);

  }, avisoUnix - ahora);
}

// Inicio del bot
client.once("clientReady", async () => {
  console.log("🤖 Bot encendido correctamente");

  const canal = client.channels.cache.get(ID_CANAL_EVENTOS);
  if (!canal) return console.error("No se encontró el canal de eventos.");

  const mensajes = await canal.messages.fetch({ limit: 10 });
  mensajeDinamico = mensajes.find(msg => msg.author.id === client.user.id && msg.embeds.length > 0 && msg.embeds[0].title?.includes("Próximos eventos"));

  if (!mensajeDinamico) {
    mensajeDinamico = await canal.send({ content: "Cargando próximos eventos..." });
  }

  setInterval(actualizarMensaje, 5000);
  actualizarMensaje();

  eventos.forEach(evento => programarEvento(evento));
});

// Comando de prueba
client.on("messageCreate", message => {
  if (message.author.bot) return;
  if (message.content.toLowerCase() === "!ping") {
    message.channel.send("🏓 Pong! El bot funciona").catch(console.error);
  }
});

// Confirmación de token cargado sin exponerlo
console.log("Token cargado:", !!process.env.DISCORD_TOKEN);

// Login seguro
client.login(process.env.DISCORD_TOKEN);






