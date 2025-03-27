// executor_backend.js
const admin = require("firebase-admin");
const { getDocs } = require("firebase-admin/firestore");
const db = require("./firebaseAdmin");

const delay = (ms) => new Promise((res) => setTimeout(res, ms));
let numerosSorteados = [];

// 🔁 Busca cartelas ativas
async function buscarCartelas() {
  const snapshot = await db.collectionGroup("userCartelas").get();
  return snapshot.docs.length > 0;
}

// 🔢 Sorteia número e atualiza Firestore
async function sortearNumero() {
  // ✅ Verifica se já foi executado
  const snapshot = await db.collection("sorteios_agendados")
    .where("status", "==", "executado")
    .get();

  if (!snapshot.empty) {
    console.log("🛑 Sorteio já executado (status no Firestore). Parando.");
    return false;
  }

  if (numerosSorteados.length >= 90) {
    console.log("✅ Todos os 90 números já foram sorteados. Parando.");
    return false;
  }

  let novoNumero;
  do {
    novoNumero = Math.floor(Math.random() * 90) + 1;
  } while (numerosSorteados.includes(novoNumero));

  numerosSorteados.push(novoNumero);
  await db.collection("sorteio").doc("atual").update({
    numerosSorteados,
    numeroAtual: novoNumero,
  });

  console.log("🎯 Número sorteado:", novoNumero);
  return true;
}

// 🚀 Executa o sorteio com delay inicial
async function iniciarSorteioBackend() {
  const cartelasAtivas = await buscarCartelas();

  if (!cartelasAtivas) {
    console.log("⚠️ Nenhuma cartela ativa encontrada.");
    return;
  }

  numerosSorteados = [];
  console.log("⏳ Aguardando 8 segundos para alinhar com o frontend...");
  await delay(8000); // delay para sincronizar com frontend

  console.log("🚀 Iniciando sorteio (somente geração de números)");

  let continuar = true;
  while (continuar) {
    continuar = await sortearNumero();
    await delay(2000);
  }

  console.log("✅ Sorteio encerrado (todos os números foram sorteados).");
}

// ⏱️ Checa hora atual no formato "HH:mm"
function horaAtualFormatada() {
  const agora = new Date();

  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const [hora, minuto] = formatter.format(agora).split(":");
  return `${hora}:${minuto}`;
}


// 🔍 Monitora sorteios pendentes e compara hora
async function monitorarSorteios() {
  console.log("🕒 Iniciando monitoramento de sorteios pendentes...");

  while (true) {
    try {
      const snapshot = await db.collection("sorteios_agendados")
        .where("status", "==", "pendente")
        .get();

      const agora = horaAtualFormatada();
      console.log("🕵️‍♂️ Verificando sorteios... Hora atual:", agora);

      for (const doc of snapshot.docs) {
        const sorteio = doc.data();
        console.log("📋 Sorteio encontrado:", sorteio.hora);

        if (sorteio.hora === agora && !sorteio.executado) {
          console.log(`⏰ Sorteio agendado para agora (${sorteio.hora}). Iniciando backend...`);

          console.log("📋 Sorteio executado");

          await iniciarSorteioBackend();
        }
      }

    } catch (err) {
      console.error("❌ Erro durante monitoramento:", err);
    }

    await delay(5000); // continuar checando
  }
}


// ▶️ Inicia monitoramento
monitorarSorteios();
