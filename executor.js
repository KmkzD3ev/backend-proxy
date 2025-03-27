const admin = require("firebase-admin");
const { collection, getDocs, doc, getDoc, updateDoc, arrayUnion, deleteDoc, setDoc, query, where } = require("firebase-admin/firestore");
const db = require("./firebaseAdmin");

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

let numerosSorteados = [];
let numeroAtual = null;
let quadraSaiu = false;
let quinaSaiu = false;
let cartelaCheiaSaiu = false;
let vencedores = [];

async function obterSorteiosAgendados() {
  const sorteiosRef = collection(db, "sorteios_agendados");
  const agora = new Date();
  const horaAtual = agora.getHours().toString().padStart(2, '0') + ':' + agora.getMinutes().toString().padStart(2, '0');

  const q = query(sorteiosRef, where("status", "==", "pendente"), where("hora", "<=", horaAtual));
  const snapshot = await getDocs(q);
  return snapshot.docs;
}

async function buscarCartelas() {
  const snapshot = await db.collectionGroup("userCartelas").get();
  const cartelas = [];

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    if (docSnap.id === "init") return;
    cartelas.push({
      id: docSnap.id,
      idNumerico: data.idNumerico || "SEM ID",
      casas: Array.isArray(data.casas) ? data.casas : [],
      userId: docSnap.ref.parent.parent.id,
      marcados: [],
    });
  });

  return cartelas;
}

function marcar(cartela, numero) {
  if (!cartela.marcados.includes(numero) && cartela.casas.includes(numero)) {
    cartela.marcados.push(numero);
  }
}

function verificarPremios(cartelas) {
  const novosVencedores = [];

  cartelas.forEach(cartela => {
    const linhas = [
      cartela.casas.slice(0, 5),
      cartela.casas.slice(5, 10),
      cartela.casas.slice(10, 15),
      cartela.casas.slice(15, 20),
      cartela.casas.slice(20, 25),
    ];

    linhas.forEach(linha => {
      const acertos = linha.filter(num => cartela.marcados.includes(num)).length;

      if (!quadraSaiu && acertos === 4) {
        quadraSaiu = true;
        novosVencedores.push({ tipo: "Quadra", cartela: cartela.idNumerico, usuario: cartela.userId });
      }

      if (!quinaSaiu && acertos === 5) {
        quinaSaiu = true;
        novosVencedores.push({ tipo: "Quina", cartela: cartela.idNumerico, usuario: cartela.userId });
      }
    });

    if (!cartelaCheiaSaiu && cartela.marcados.length === 25) {
      cartelaCheiaSaiu = true;
      novosVencedores.push({ tipo: "Cartela Cheia", cartela: cartela.idNumerico, usuario: cartela.userId });
    }
  });

  vencedores.push(...novosVencedores);
}

async function sortearNumero(cartelas) {
  if (quadraSaiu && quinaSaiu && cartelaCheiaSaiu || numerosSorteados.length >= 90) {
    return false; // Encerrar sorteio
  }

  let novoNumero;
  do {
    novoNumero = Math.floor(Math.random() * 90) + 1;
  } while (numerosSorteados.includes(novoNumero));

  numerosSorteados.push(novoNumero);
  numeroAtual = novoNumero;

  cartelas.forEach((cartela) => marcar(cartela, novoNumero));
  verificarPremios(cartelas);

  await updateDoc(doc(db, "sorteio", "atual"), {
    numerosSorteados,
    numeroAtual,
  });

  console.log("🎯 Número sorteado:", novoNumero);
  return true;
}

async function finalizarSorteio(sorteioId) {
  const idFinalizado = Date.now().toString();
  await setDoc(doc(db, "Sorteios Finalizados", idFinalizado), {
    idSorteio: idFinalizado,
    sorteioAgendadoId: sorteioId,
    vencedores,
    data: new Date().toISOString(),
  });

  await updateDoc(doc(db, "sorteio", "atual"), {
    numerosSorteados: [],
    numeroAtual: 0,
  });

  await updateDoc(doc(db, "sorteios_agendados", sorteioId), {
    status: "executado",
  });

  const snapshot = await db.collectionGroup("userCartelas").get();
  const deletions = snapshot.docs.map((docSnap) => docSnap.ref.delete());
  await Promise.all(deletions);

  console.log("✅ Sorteio finalizado com sucesso.");
}

async function iniciarSorteioBackend() {
    const sorteioAtualDoc = await getDoc(doc(db, "sorteio", "atual"));

    if (sorteioAtualDoc.exists()) {
      const { executandoNoFrontend } = sorteioAtualDoc.data();
  
      if (executandoNoFrontend) {
        console.log("⚠️ Frontend está executando o sorteio. Backend pausado.");
        return; // Backend não executa enquanto frontend estiver executando
      }
    }
  const sorteios = await obterSorteiosAgendados();

  if (sorteios.length === 0) {
    console.log("⏳ Nenhum sorteio pendente encontrado no horário atual.");
    return;
  }

  const sorteioAtual = sorteios[0]; // pega o primeiro sorteio pendente
  const sorteioId = sorteioAtual.id;

  console.log(`🚀 Iniciando sorteio agendado: ${sorteioId}`);

  numerosSorteados = [];
  quadraSaiu = false;
  quinaSaiu = false;
  cartelaCheiaSaiu = false;
  vencedores = [];

  const cartelas = await buscarCartelas();

  if (cartelas.length === 0) {
    console.log("⚠️ Nenhuma cartela ativa encontrada.");
    return;
  }

  let continuar = true;
  while (continuar) {
    continuar = await sortearNumero(cartelas);
    await delay(2000); // espera 2 segundos entre números sorteados
  }

  await finalizarSorteio(sorteioId);
}

// Executar o sorteio imediatamente ao iniciar o script
iniciarSorteioBackend();

// Opcional: Executar em intervalos regulares, por exemplo, a cada minuto
setInterval(iniciarSorteioBackend, 60000);