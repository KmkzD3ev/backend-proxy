// ✅ Lógica completa de sorteio no BACKEND (Node.js com Firebase Admin)

const admin = require("firebase-admin");
const { getDoc, doc, updateDoc, setDoc, collectionGroup, deleteDoc } = require("firebase-admin/firestore");
const db = require("./firebaseAdmin"); // Instância do Firestore via admin.initializeApp()

let numerosSorteados = [];
let numeroAtual = null;
let quadraSaiu = false;
let quinaSaiu = false;
let cartelaCheiaSaiu = false;
let vencedores = [];

function marcar(cartela, numero) {
  if (!cartela.marcados.includes(numero) && cartela.casas.includes(numero)) {
    cartela.marcados.push(numero);
  }
}

function verificarPremios(cartelas) {
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
        vencedores.push({ tipo: "Quadra", cartela: cartela.idNumerico, usuario: cartela.nome });
      }
      if (!quinaSaiu && acertos === 5) {
        quinaSaiu = true;
        vencedores.push({ tipo: "Quina", cartela: cartela.idNumerico, usuario: cartela.nome });
      }
    });

    if (!cartelaCheiaSaiu && cartela.marcados.length === 25) {
      cartelaCheiaSaiu = true;
      vencedores.push({ tipo: "Cartela Cheia", cartela: cartela.idNumerico, usuario: cartela.nome });
    }
  });
}

async function buscarCartelas() {
  const snapshot = await db.collectionGroup("userCartelas").get();
  const cartelas = [];
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    if (docSnap.id === "init") continue;
    const userId = docSnap.ref.parent.parent.id;
    const userDoc = await db.collection("usuarios").doc(userId).get();
    cartelas.push({
      id: docSnap.id,
      idNumerico: data.idNumerico || "SEM ID",
      casas: Array.isArray(data.casas) ? data.casas : [],
      userId,
      nome: userDoc.exists ? userDoc.data().nome || userId : userId,
      marcados: [],
    });
  }
  return cartelas;
}

async function sortearNumero(cartelas) {
  if ((quadraSaiu && quinaSaiu && cartelaCheiaSaiu) || numerosSorteados.length >= 90) {
    return false;
  }
  let novoNumero;
  do {
    novoNumero = Math.floor(Math.random() * 90) + 1;
  } while (numerosSorteados.includes(novoNumero));

  numerosSorteados.push(novoNumero);
  numeroAtual = novoNumero;

  cartelas.forEach(cartela => marcar(cartela, novoNumero));
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
  const deletions = snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref));
  await Promise.all(deletions);

  console.log("✅ Sorteio finalizado com sucesso.");
}

async function iniciarSorteioBackend() {
  const sorteioAtualDoc = await getDoc(doc(db, "sorteio", "atual"));
  if (sorteioAtualDoc.exists()) {
    const { executandoNoFrontend } = sorteioAtualDoc.data();
    if (executandoNoFrontend) return;
  }

  const sorteiosRef = db.collection("sorteios_agendados");
  const agora = new Date();
  const horaAtual = agora.getHours().toString().padStart(2, '0') + ':' + agora.getMinutes().toString().padStart(2, '0');
  const querySnapshot = await sorteiosRef
    .where("status", "==", "pendente")
    .where("hora", "<=", horaAtual)
    .get();

  if (querySnapshot.empty) return;

  const sorteio = querySnapshot.docs[0];
  const sorteioId = sorteio.id;

  numerosSorteados = [];
  quadraSaiu = false;
  quinaSaiu = false;
  cartelaCheiaSaiu = false;
  vencedores = [];

  const cartelas = await buscarCartelas();
  if (!cartelas.length) return;

  let continuar = true;
  while (continuar) {
    continuar = await sortearNumero(cartelas);
    await new Promise((r) => setTimeout(r, 2000));
  }
  await finalizarSorteio(sorteioId);
}

iniciarSorteioBackend();
// Ou usar: setInterval(iniciarSorteioBackend, 60000);
