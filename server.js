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
// 🔥 Webhook para receber notificações de pagamento da Zendry
app.post("/webhook/pagamento", async (req, res) => {
    try {
        console.log("🔔 Notificação de pagamento recebida:", req.body);

        const { notification_type, message } = req.body;

        // 🔍 Verifica se a notificação é do tipo correto e se a estrutura do payload é válida
        if (notification_type !== "pix_qrcode" || !message || !message.reference_code || !message.status) {
            console.warn("⚠️ Notificação recebida sem dados válidos:", req.body);
            return res.status(400).json({ error: "Dados inválidos no webhook" });
        }

        // 🔥 Verifica se o pagamento foi realizado
        if (message.status === "paid") {
            console.log(`✅ Pagamento confirmado para ${message.reference_code}`);

            // 🔥 Armazena o pagamento na memória do backend
            pagamentosRecebidos[message.reference_code] = {
                reference_code: message.reference_code,
                external_reference: message.external_reference,
                status: "paid",
                valor: message.value_cents,
                generator_name: message.generator_name,
                generator_document: message.generator_document,
                payer_name: message.payer_name,
                payer_document: message.payer_document,
                registration_date: message.registration_date,
                payment_date: message.payment_date,
                end_to_end: message.end_to_end,
                timestamp: new Date().toISOString(),
            };

            console.log("📝 Dados do pagamento armazenados:", pagamentosRecebidos[message.reference_code]);
        }

        res.status(200).json({ message: "Operation succeeded" }); // Confirma que recebemos a notificação

    } catch (error) {
        console.error("❌ Erro ao processar Webhook:", error);
        res.status(500).json({ error: "Erro ao processar webhook" });
    }
});

// 🔥 Verificação periódica de pagamentos
setInterval(async () => {
    console.log("🔄 Verificando pagamentos pendentes...");

    for (const reference_code in pagamentosRecebidos) {
        if (pagamentosRecebidos[reference_code].status !== "paid") {
            try {
                console.log(`🔍 Consultando status do pagamento: ${reference_code}`);

                const token = await getTokenFromExternalAPI();
                if (!token) {
                    console.warn("⚠️ Não foi possível obter o token de autenticação");
                    continue;
                }

                const response = await axios.get(`https://api.zendry.com.br/v1/pix/qrcodes/${reference_code}`, {
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                });

                const paymentData = response.data;

                if (paymentData.status === "paid") {
                    console.log(`✅ Pagamento confirmado automaticamente para ${reference_code}`);

                    // Atualiza o status do pagamento na memória
                    pagamentosRecebidos[reference_code] = {
                        ...pagamentosRecebidos[reference_code],
                        status: "paid",
                        payment_date: paymentData.payment_date,
                    };
                }
            } catch (error) {
                console.error(`❌ Erro ao consultar status de ${reference_code}:`, error);
            }
        }
    }
}, 60000); // 🔄 Executa a cada 1 minuto (60000ms)



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


  
  