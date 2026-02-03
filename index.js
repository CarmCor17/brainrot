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

// Zona horaria principal para cálculos internos
const ZONA_HORARIA = "America/Hermosillo";

// Servidores y canales desde .env
// Formato: SERVIDOR_ID:CANAL_ID1,CANAL_ID2;SERVIDOR_ID2:CANAL_ID3
if (!process.env.SERVIDORES_Y_CANALES) {
  console.error("❌ No se ha definido SERVIDORES_Y_CANALES en las variables de entorno.");
  process.exit(1);
}

// Parsear SERVIDORES_Y_CANALES
const SERVIDORES = {};
process.env.SERVIDORES_Y_CANALES.split(";").forEach(entry => {
  const [serverId, channels] = entry.split(":");
  if (serverId && channels) {
    SERVIDORES[serverId.trim()] = channels.split(",").map(id => id.trim());
  }
});

console.log("🔹 SERVIDORES Y CANALES CONFIGURADOS:", SERVIDORES);

// Definición de eventos
const eventos = [
  { nombre: "🌑 Darkness", nextUnix: moment.tz("2026-02-02 14:00", ZONA_HORARIA).valueOf(), intervaloHoras: 4, color: 0x4B4B4B },
  { nombre: "🧪 Toxic", nextUnix: moment.tz("2026-02-02 04:30", ZONA_HORARIA).valueOf(), intervaloHoras: 4, color: 0x00FF00 },
  { nombre: "🍀 Lucky Rot", nextUnix: moment.tz("2026-02-02 00:00", ZONA_HORARIA).valueOf(), intervaloHoras: 5, color: 0xFFD700 }
];

const mensajesDinamicos = {}; // Mensaje por canal
const ultimoEmbedStringPorCanal = {};

// Función tiempo restante
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

// Ordenar eventos por próximo
function eventosOrdenados() {
  return eventos.slice().sort((a, b) => a.nextUnix - b.nextUnix);
}

// Actualiza mensajes fijos con tiempo restante (sin spamear)
async function actualizarMensajes() {
  const ahora = moment().tz(ZONA_HORARIA).valueOf();
  const embed = new EmbedBuilder()
    .setTitle("📅 Próximos eventos de Steal the Brainrot")
    .setColor(0x00FF00)
    .setTimestamp(moment().tz(ZONA_HORARIA).toDate())
    .setFooter({ text: "Tiempo restante mostrado para todos los usuarios" });

  const ordenados = eventosOrdenados();
  const proximoEvento = ordenados.find(e => e.nextUnix > ahora) || ordenados[0];

  ordenados.forEach(evento => {
    let nombre = evento.nombre;
    let valor = "";
    const inicio = evento.nextUnix;
    const fin = evento.nextUnix + evento.intervaloHoras * 60 * 60 * 1000;

    if (ahora >= inicio && ahora < fin) {
      nombre = `🔥 ${nombre} (En curso)`;
      valor = `🕒 Termina en ${tiempoRestante(fin)}`;
    } else {
      if (evento === proximoEvento) nombre = `➡️ **${nombre}**`;
      valor = `🕒 Comienza en ${tiempoRestante(inicio)}`;
    }

    embed.addFields({ name: nombre, value: valor, inline: false });
  });

  for (const serverId in SERVIDORES) {
    for (const canalId of SERVIDORES[serverId]) {
      const canal = await client.channels.fetch(canalId).catch(() => null);
      if (!canal) continue;

      if (!mensajesDinamicos[canalId]) {
        const mensajes = await canal.messages.fetch({ limit: 10 }).catch(() => []);
        const encontrado = mensajes.find(msg => msg.author.id === client.user.id && msg.embeds.length > 0 && msg.embeds[0].title?.includes("Próximos eventos"));
        if (encontrado) {
          mensajesDinamicos[canalId] = encontrado;
        } else {
          mensajesDinamicos[canalId] = await canal.send({ content: "Cargando próximos eventos..." }).catch(() => null);
        }
      }

      const mensaje = mensajesDinamicos[canalId];
      if (!mensaje) continue;

      const embedString = JSON.stringify(embed.data);
      if (embedString !== ultimoEmbedStringPorCanal[canalId]) {
        await mensaje.edit({ embeds: [embed] }).catch(() => null);
        ultimoEmbedStringPorCanal[canalId] = embedString;
      }
    }
  }
}

// Programar eventos con alertas de 10 minutos
function programarEvento(evento) {
  const ahora = moment().tz(ZONA_HORARIA).valueOf();

  while (evento.nextUnix <= ahora) {
    evento.nextUnix += evento.intervaloHoras * 60 * 60 * 1000;
  }

  const avisoUnix = evento.nextUnix - 10 * 60 * 1000; // 10 minutos antes

  setTimeout(async () => {
    for (const serverId in SERVIDORES) {
      for (const canalId of SERVIDORES[serverId]) {
        const canal = await client.channels.fetch(canalId).catch(() => null);
        if (!canal) continue;

        // Borrar mensaje anterior de tiempo restante
        if (mensajesDinamicos[canalId]) {
          await mensajesDinamicos[canalId].delete().catch(() => null);
          mensajesDinamicos[canalId] = null;
        }

        // Enviar mensaje nuevo con alerta de 10 minutos
        const embed = new EmbedBuilder()
          .setTitle(`⏰ ¡El evento ${evento.nombre} comienza en 10 minutos!`)
          .setColor(evento.color)
          .setTimestamp(moment().tz(ZONA_HORARIA).toDate())
          .addFields([
            {
              name: "Tiempo restante",
              value: `🕒 ${tiempoRestante(evento.nextUnix)}`,
              inline: false
            }
          ]);

        const mensaje = await canal.send({ embeds: [embed] }).catch(() => null);
        mensajesDinamicos[canalId] = mensaje;

        // Enviar alerta de texto adicional
        await canal.send(`🚨 ¡El evento **${evento.nombre}** empieza en 10 minutos!`).catch(() => null);
      }
    }

    // Esperar hasta que comience el evento
    const tiempoParaEvento = evento.nextUnix - moment().tz(ZONA_HORARIA).valueOf();
    setTimeout(() => {
      for (const serverId in SERVIDORES) {
        for (const canalId of SERVIDORES[serverId]) {
          const canal = client.channels.cache.get(canalId);
          if (canal) canal.send(`🚨 ¡El evento **${evento.nombre}** ha comenzado!`).catch(() => null);
        }
      }

      // Preparar siguiente ciclo del evento
      evento.nextUnix += evento.intervaloHoras * 60 * 60 * 1000;
      programarEvento(evento);
    }, tiempoParaEvento);

  }, avisoUnix - ahora);
}

// Inicio del bot
client.once("ready", async () => {
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
