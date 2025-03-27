// executor_backend.js
const admin = require("firebase-admin");
const { collection, getDocs, doc, updateDoc, arrayUnion } = require("firebase-admin/firestore");
const db = require("./firebaseAdmin");

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

let numerosSorteados = [];

async function buscarCartelas() {
  const snapshot = await db.collectionGroup("userCartelas").get();
  return snapshot.docs.length > 0;
}

async function sortearNumero() {
  // 🔴 Se já foram sorteados todos os 90 números, finaliza
  if (numerosSorteados.length >= 90) {
    console.log("✅ Todos os 90 números já foram sorteados. Parando.");
    return false;
  }

  let novoNumero;
  do {
    novoNumero = Math.floor(Math.random() * 90) + 1;
  } while (numerosSorteados.includes(novoNumero));

  numerosSorteados.push(novoNumero);

  await updateDoc(doc(db, "sorteio", "atual"), {
    numerosSorteados,
    numeroAtual: novoNumero,
  });

  console.log("🎯 Número sorteado:", novoNumero);
  return true;
}

async function iniciarSorteioBackend() {
  const cartelasAtivas = await buscarCartelas();

  if (!cartelasAtivas) {
    console.log("⚠️ Nenhuma cartela ativa encontrada.");
    return;
  }

  numerosSorteados = [];
  console.log("🚀 Iniciando sorteio (somente geração de números)");

  let continuar = true;
  while (continuar) {
    continuar = await sortearNumero();
    await delay(2000); // espera 2 segundos entre os sorteios
  }

  console.log("✅ Sorteio encerrado (todos os números foram sorteados).");
}

// Iniciar imediatamente
iniciarSorteioBackend();