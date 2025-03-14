const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors()); // Permite requisições do frontend
app.use(express.json()); // Permite enviar JSON no corpo das requisições


/* 🔒 Proteção para permitir apenas requisições do seu site
app.use((req, res, next) => {
    const allowedOrigins = ["https://bingodasorte.tech"];
    if (!allowedOrigins.includes(req.headers.origin)) {
        return res.status(403).json({ error: "Acesso não autorizado" });
    }
    next();
});*/


// 🔹 Proxy para a API da Zendry
app.post("/proxy/qrcode", async (req, res) => {
    try {
        const token = req.headers.authorization; // Captura o token enviado pelo frontend

        const response = await axios.post("https://api.zendry.com.br/v1/pix/qrcodes", req.body, {
            headers: {
                "Authorization": token,
                "Content-Type": "application/json",
            },
        });

        res.json(response.data); // Retorna a resposta da API da Zendry para o frontend
    } catch (error) {
        console.error("❌ Erro no proxy:", error);
        res.status(error.response?.status || 500).json(error.response?.data || { error: "Erro no proxy" });
    }
});

// 🔹 Configuração do Servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Proxy rodando na porta ${PORT}`));


//WEBHOOK NOTIFICAÇAO DE PAGAMENTO 

app.post("/webhook/pagamento", async (req, res) => {
    try {
      const pagamento = req.body; // Dados recebidos da Zendry
      console.log("🔔 Notificação de pagamento recebida:", pagamento);
  
      if (pagamento.qrcode?.status === "paid") {
        console.log(`✅ Pagamento confirmado para esse  ${pagamento.qrcode.reference_code}`);
        // 🔹 Aqui você pode atualizar banco de dados, liberar saldo, notificar o cliente, etc.
      }
  
      res.sendStatus(200); // Confirma que recebemos a notificação
    } catch (error) {
      console.error("❌ Erro ao processar Webhook:", error);
      res.sendStatus(500);
    }
  });
  