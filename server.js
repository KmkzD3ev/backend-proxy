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

///////////// DEPOSITO ////////////////////////////////

// 🔹 Proxy para a API da Zendry
app.post("/proxy/qrcode", async (req, res) => {
    try {
        const token = req.headers.authorization; // Captura o token enviado pelo frontend

        const response = await axios.get(`https://api.zendry.com.br/v1/pix/payments/${referenceCode}`, {
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



let pagamentosRecebidos = {}; // Armazena os pagamentos recebidos via webhook

// 🔥 Webhook para receber notificações de pagamento Pix
app.post("/webhook/pix", (req, res) => {
    try {
        const { notification_type, message } = req.body;

        if (!message || !message.reference_code || !message.status) {
            console.error("❌ Webhook recebido sem dados válidos:", req.body);
            return res.status(400).json({ error: "Dados inválidos no webhook" });
        }

        // Armazena o pagamento na memória
        pagamentosRecebidos[message.reference_code] = message;
        console.log(`✅ Pagamento atualizado: ${message.reference_code} - Status: ${message.status}`);

        res.status(200).json({ message: "Webhook recebido com sucesso" });
    } catch (error) {
        console.error("❌ Erro ao processar webhook:", error);
        res.status(500).json({ error: "Erro ao processar webhook" });
    }
});

// 🔥 Endpoint para cadastrar webhook na Zendry
app.post("/cadastrar-webhook", async (req, res) => {
    try {
        const { url, authorization } = req.body;
        const webhookType = 1; // Defina conforme necessário

        const response = await axios.post(`https://api.zendry.com.br/v1/webhooks/${webhookType}`, {
            url,
            authorization
        }, {
            headers: {
                "Authorization": `Bearer ${authorization}`,
                "Content-Type": "application/json",
            },
        });

        res.json(response.data); // Retorna a resposta da API
    } catch (error) {
        console.error("❌ Erro ao cadastrar webhook:", error);
        res.status(error.response?.status || 500).json(error.response?.data || { error: "Erro ao cadastrar webhook" });
    }
});


//////////// PAGAMENTOS /////////////////////////

// 🔥 Endpoint para consultar pagamento manualmente
app.get("/webhook/pagamento/:reference_code", async (req, res) => {
    try {
        const referenceCode = req.params.reference_code;

        // 🔍 Verifica se o pagamento já foi recebido pelo Webhook
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

///// WEBHOOK PARA PAGAMENTO ///////////////////
// 🔥 Endpoint para cadastrar Webhook de pagamentos (pix_payments)
app.post("/cadastrar-webhook-pagamentos", async (req, res) => {
    try {
        const { url, authorization } = req.body;
        const webhookType = 2; // ✅ Alterado para capturar pagamentos

        const response = await axios.post(`https://api.zendry.com.br/v1/webhooks/${webhookType}`, {
            url
        }, {
            headers: {
                "Authorization": `Bearer ${authorization}`, // ✅ Corrigido o token
                "Content-Type": "application/json",
            },
        });

        res.json(response.data); // ✅ Retorna a resposta da API
    } catch (error) {
        console.error("❌ Erro ao cadastrar webhook de pagamentos:", error);
        res.status(error.response?.status || 500).json(error.response?.data || { error: "Erro ao cadastrar webhook de pagamentos" });
    }
});

// 🔥 Webhook para receber notificações de pagamento Pix
app.post("/webhook/pix-pagamentos", (req, res) => {
    try {
        const { notification_type, message } = req.body;

        if (!message || !message.reference_code || !message.status) {
            console.error("❌ Webhook de pagamento recebido sem dados válidos:", req.body);
            return res.status(400).json({ error: "Dados inválidos no webhook de pagamento" });
        }

        // 🔹 Armazena o pagamento na memória (ou banco de dados, se necessário)
        pagamentosRecebidos[message.reference_code] = message;
        console.log(`✅ Pagamento atualizado: ${message.reference_code} - Status: ${message.status}`);

        res.status(200).json({ message: "Webhook de pagamento recebido com sucesso" });
    } catch (error) {
        console.error("❌ Erro ao processar webhook de pagamento:", error);
        res.status(500).json({ error: "Erro ao processar webhook de pagamento" });
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
            pix_key_type: "phone", // Tipo de chave Pix (cpf, cnpj, email, phone, token)
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


  
  