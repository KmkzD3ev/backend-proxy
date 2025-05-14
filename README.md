# Backend Proxy - Servidor Central de Sorteios e Transações para Jogo de Bingo

Este projeto é o núcleo de backend para um sistema de bingo online automatizado. Ele é responsável por executar e controlar o sorteio dos números, gerenciar atualizações em tempo real com Firebase, lidar com saques automáticos e gerar códigos Pix dinâmicos para depósitos, sempre utilizando credenciais seguras e integração com serviços externos.

## Funcionalidades

### Sorteio Automatizado
- Início de sorteios com timers configuráveis
- Controle de delay entre números sorteados
- Embaralhamento do array numérico com persistência no Firebase
- Disparo automático dos números sorteados no Realtime Database

### Atualização em Tempo Real
- Integração com Firebase Admin SDK
- Envio de atualizações diretamente para nós específicos no Firebase Realtime Database
- Sincronização imediata com o frontend via observadores de estado

### Integração com Pix
- Geração de QR Code Pix dinâmico com base nos dados do proprietário
- Encapsulamento da lógica de cobrança em um serviço dedicado
- Retorno do payload pronto para exibição no frontend

### Sistema de Saque Automático
- Recebimento de solicitação de saque do jogador vencedor
- Verificação de autorização
- Processamento da lógica de "payout" com validação de dados
- Atualização de status do Firebase após conclusão

### Segurança e Configuração
- Uso de variáveis de ambiente (.env) para gerenciamento de credenciais sensíveis
- Isolamento das chaves privadas do Firebase e tokens de integração
- Modularização de lógica para facilitar manutenção e deploy

## Tecnologias Utilizadas

- Node.js
- Express.js
- Firebase Admin SDK
- Axios
- Pix Payload Generator (customizado ou via lib)
- Dotenv
- UUID

## Estrutura do Projeto

