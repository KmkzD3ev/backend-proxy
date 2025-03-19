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


let pagamentosRecebidos = {};

// 🔥 Webhook para receber notificações de pagamento da Zendry
app.post("/webhook/pagamento", async (req, res) => {
    try {
        console.log("🔔 Notificação de pagamento recebida:", req.body);

        const { qrcode } = req.body;
        if (!qrcode || !qrcode.status || !qrcode.reference_code) {
            console.warn("⚠️ Notificação recebida sem dados válidos:", req.body);
            return res.status(400).json({ error: "Dados inválidos no webhook" });
        }

        if (qrcode.status === "paid") {
            console.log(`✅ Pagamento confirmado para ${qrcode.reference_code}`);

            // 🔥 Armazena o pagamento na memória do backend
            pagamentosRecebidos[qrcode.reference_code] = {
                reference_code: qrcode.reference_code,
                status: "paid",
                valor: qrcode.value,
                timestamp: new Date().toISOString(),
            };
        }

        res.status(200).json({ message: "Operation succeeded" }); // Confirma que recebemos a notificação

    } catch (error) {
        console.error("❌ Erro ao processar Webhook:", error);
        res.status(500).json({ error: "Erro ao processar webhook" });
    }
});

// 🔥 Obtém o token de autenticação da API da Zendry
const getTokenFromExternalAPI = async () => {
    try {
        const response = await axios.post("https://bingodasorte2-f9u6qndyf-eduardos-projects-77342803.vercel.app/api/getToken");
        return response.data.access_token;
    } catch (error) {
        console.error("❌ Erro ao obter token externo:", error);
        return null;
    }
};

// 🔥 Endpoint para consultar pagamento manualmente
app.get("/webhook/pagamento/:reference_code", async (req, res) => {
    try {
        const referenceCode = req.params.reference_code;

        // 🔍 Primeiro, verifica se o pagamento já foi recebido pelo Webhook
        if (pagamentosRecebidos[referenceCode]) {
            console.log(`🔍 Pagamento encontrado na memória: ${referenceCode}`);
            return res.json(pagamentosRecebidos[referenceCode]);
        }

        // 🔥 Obtém o token antes da consulta
        const token = await getTokenFromExternalAPI();
        if (!token) {
            return res.status(500).json({ error: "Erro ao obter token de autenticação" });
        }

        // 🔥 Faz a requisição para a API da Zendry para verificar o status do pagamento
        const response = await axios.get(`https://api.zendry.com.br/v1/pix/qrcodes/${referenceCode}`, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        });

        res.json(response.data); // 🔥 Retorna o status do pagamento para o frontend
    } catch (error) {
        console.error("❌ Erro ao consultar pagamento:", error);
        res.status(error.response?.status || 500).json(error.response?.data || { error: "Erro ao consultar pagamento" });
    }
});

////////////////////////////////////////////
// 🔥 Endpoint para criar um pagamento Pix na API da Zendry
app.post("/proxy/pagamento", async (req, res) => {
    try {
        const token = req.headers.authorization; // Token recebido no frontend
        const { receiver_name, receiver_document, pix_key, value_cents } = req.body; // Dados do pagador

        // 🔹 Definição do corpo da requisição (DICT - com chave Pix)
        const payload = {
            initiation_type: "dict", // Indica que o pagamento será feito via chave Pix
            idempotent_id: `PAGAMENTO_${Date.now()}`, // Identificador único para evitar duplicações
            receiver_name: receiver_name,
            receiver_document: receiver_document,
            value_cents: value_cents, // Valor do pagamento em centavos
            pix_key_type: "cpf", // Tipo de chave Pix (cpf, cnpj, email, phone, token)
            pix_key: pix_key, // Chave Pix do destinatário
            authorized: false // Se `true`, autoriza automaticamente
        };

        console.log("📌 Enviando pagamento para API da Zendry:", payload);

        // 🔥 Faz a requisição para a API da Zendry
        const response = await axios.post("https://api.zendry.com.br/v1/pix/payments", payload, {
            headers: {
                "Authorization": token,
                "Content-Type": "application/json",
            },
        });

        console.log("✅ Pagamento cadastrado com sucesso:", response.data);
        res.json(response.data); // Retorna a resposta para o frontend

    } catch (error) {
        console.error("❌ Erro ao cadastrar pagamento:", error.response?.data || error);
        res.status(error.response?.status || 500).json(error.response?.data || { error: "Erro ao cadastrar pagamento" });
    }
});


// 🔹 Configuração do Servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Proxy rodando na porta ${PORT}`));


  
  