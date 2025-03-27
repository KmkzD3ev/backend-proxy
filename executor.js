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
  const hora = agora.getHours().toString().padStart(2, '0');
  const minuto = agora.getMinutes().toString().padStart(2, '0');
  return `${hora}:${minuto}`;
}

// 🔍 Monitora sorteios pendentes e compara hora
async function monitorarSorteios() {
  console.log("🕒 Aguardando sorteios agendados com status 'pendente'...");

  while (true) {
    const snapshot = await db.collection("sorteios_agendados")
      .where("status", "==", "pendente")
      .get();

    const agora = horaAtualFormatada();

    for (const doc of snapshot.docs) {
      const sorteio = doc.data();
      if (sorteio.hora === agora) {
        console.log(`⏰ Sorteio agendado para agora (${sorteio.hora}). Iniciando backend...`);
        await iniciarSorteioBackend();
        return;
      }
    }

    await delay(5000); // Checa a cada 5 segundos
  }
}

// ▶️ Inicia monitoramento
monitorarSorteios();
