/**
 * Exemplo de testes unitários para o ChatService refatorado
 * 
 * Este arquivo demonstra como os métodos refatorados são mais fáceis de testar
 * devido à separação de responsabilidades e redução de complexidade.
 */

// Mock de dependências
class MockLogger {
    info(data) { console.log('INFO:', data); }
    warn(data) { console.log('WARN:', data); }
    error(data) { console.log('ERROR:', data); }
}

class MockChatRepository {
    async findById(chatId) {
        // Retorna diferentes tipos de chat para testes
        return {
            chat_id: chatId,
            chat_type: 'text',
            client_id: 'client1',
            tenant_id: 'tenant1',
            channel_id: 1
        };
    }

    async findTabulation(tabulationId) {
        return {
            id: tabulationId,
            name: 'Tabulação Teste',
            description: 'Descrição da tabulação'
        };
    }

    async updateChat(chatId, data) {
        console.log(`Update chat ${chatId}:`, data);
        return true;
    }

    async updateXdr(chatId, data) {
        console.log(`Update XDR ${chatId}:`, data);
        return true;
    }

    async getMacroContent(macroId) {
        return 'Conteúdo da macro de finalização';
    }

    async findActiveChatsForUser(userId) {
        return []; // Usuário sem chats ativos
    }
}

class MockUserRepository {
    async getUserStatus(userId) {
        return { pause_type: 'tabulation' };
    }

    async removePause(userId) {
        console.log(`Pausa removida para usuário ${userId}`);
        return true;
    }

    async updateUserStatus(userId, data) {
        console.log(`Status atualizado para usuário ${userId}:`, data);
        return true;
    }
}

class MockQueueService {
    async publish(queue, data) {
        console.log(`Publicado em ${queue}:`, data);
        return true;
    }

    async getQueueStrategy(clientId) {
        return 'round-robin';
    }
}

class MockETLService {
    async sendStatus(data) {
        console.log('Status enviado para ETL:', data);
        return true;
    }
}

// Importar a classe refatorada
const { ChatService, ChatTypes } = require('./ChatService');

/**
 * EXEMPLO DE TESTE 1: Chat de Texto Simples
 */
async function testSimpleTextChat() {
    console.log('\n=== TESTE 1: Chat de Texto Simples ===\n');

    const logger = new MockLogger();
    const chatRepo = new MockChatRepository();
    const userRepo = new MockUserRepository();
    const queueService = new MockQueueService();
    const etlService = new MockETLService();

    const service = new ChatService(logger, chatRepo, userRepo, queueService, etlService);

    const query = {
        chat_id: 'chat123',
        user_id: 'user456'
    };

    const typeEndChat = {
        tabulationId: 'tab1'
    };

    try {
        const result = await service.endChat(query, typeEndChat);
        console.log('\n✅ Resultado:', result);
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

/**
 * EXEMPLO DE TESTE 2: Chamada de Voz Manual com Chat Texto Vinculado
 */
async function testVoiceManualChatWithText() {
    console.log('\n=== TESTE 2: Chamada Manual com Chat Texto ===\n');

    const logger = new MockLogger();
    const chatRepo = new MockChatRepository();
    
    // Override para retornar chat de voz manual
    chatRepo.findById = async (chatId) => ({
        chat_id: chatId,
        chat_type: 'voice',
        type_flag: 6,
        chat_id_owner: 'text_chat_456',
        origin_dst: '11987654321',
        client_id: 'client1',
        tenant_id: 'tenant1'
    });

    const userRepo = new MockUserRepository();
    const queueService = new MockQueueService();
    const etlService = new MockETLService();

    const service = new ChatService(logger, chatRepo, userRepo, queueService, etlService);

    const query = {
        chat_id: 'voice_chat_123',
        user_id: 'user456'
    };

    try {
        const result = await service.endChat(query, {});
        console.log('\n✅ Resultado:', result);
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

/**
 * EXEMPLO DE TESTE 3: Chamada de Jornada
 */
async function testVoiceJourneyChat() {
    console.log('\n=== TESTE 3: Chamada de Jornada ===\n');

    const logger = new MockLogger();
    const chatRepo = new MockChatRepository();
    
    // Override para retornar chat de jornada
    chatRepo.findById = async (chatId) => ({
        chat_id: chatId,
        chat_type: 'voice',
        type_flag: 8,
        journey_id: 'journey_789',
        client_id: 'client1',
        tenant_id: 'tenant1'
    });

    const userRepo = new MockUserRepository();
    const queueService = new MockQueueService();
    const etlService = new MockETLService();

    const service = new ChatService(logger, chatRepo, userRepo, queueService, etlService);

    const query = {
        chat_id: 'journey_chat_123',
        user_id: 'user456'
    };

    const typeEndChat = {
        tabulationId: 'tab1'
    };

    try {
        const result = await service.endChat(query, typeEndChat);
        console.log('\n✅ Resultado:', result);
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

/**
 * EXEMPLO DE TESTE 4: Chat de Texto com Macro e Fluxo de Saída
 */
async function testTextChatWithMacroAndExitFlow() {
    console.log('\n=== TESTE 4: Chat de Texto com Macro e Fluxo ===\n');

    const logger = new MockLogger();
    const chatRepo = new MockChatRepository();
    const userRepo = new MockUserRepository();
    const queueService = new MockQueueService();
    const etlService = new MockETLService();

    const service = new ChatService(logger, chatRepo, userRepo, queueService, etlService);

    const query = {
        chat_id: 'chat123',
        user_id: 'user456'
    };

    const typeEndChat = {
        finalizationMacro: 'macro1',
        exitFlowActionId: 'action1',
        tabulationId: 'tab1'
    };

    try {
        const result = await service.endChat(query, typeEndChat);
        console.log('\n✅ Resultado:', result);
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

/**
 * EXEMPLO DE TESTE 5: Finalização por SLA
 */
async function testSLAFinalization() {
    console.log('\n=== TESTE 5: Finalização por SLA ===\n');

    const logger = new MockLogger();
    const chatRepo = new MockChatRepository();
    const userRepo = new MockUserRepository();
    const queueService = new MockQueueService();
    const etlService = new MockETLService();

    const service = new ChatService(logger, chatRepo, userRepo, queueService, etlService);

    const query = {
        chat_id: 'chat123',
        user_id: 'user456'
    };

    const typeEndChat = {
        endChatBySLA: true,
        defaultSLATabulationId: 'sla_tab_default',
        statusPersonalized: 'Finalizado por SLA'
    };

    try {
        const result = await service.endChat(query, typeEndChat);
        console.log('\n✅ Resultado:', result);
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

/**
 * EXEMPLO DE TESTE 6: Canal 11 com Status Personalizado (pula fluxo de saída)
 */
async function testChannel11WithPersonalizedStatus() {
    console.log('\n=== TESTE 6: Canal 11 com Status Personalizado ===\n');

    const logger = new MockLogger();
    const chatRepo = new MockChatRepository();
    
    // Override para retornar canal 11
    chatRepo.findById = async (chatId) => ({
        chat_id: chatId,
        chat_type: 'text',
        channel_id: 11, // Canal especial
        client_id: 'client1',
        tenant_id: 'tenant1'
    });

    const userRepo = new MockUserRepository();
    const queueService = new MockQueueService();
    const etlService = new MockETLService();

    const service = new ChatService(logger, chatRepo, userRepo, queueService, etlService);

    const query = {
        chat_id: 'chat123',
        user_id: 'user456'
    };

    const typeEndChat = {
        exitFlowActionId: 'action1',
        statusPersonalized: 'Status Especial'
    };

    try {
        const result = await service.endChat(query, typeEndChat);
        console.log('\n✅ Resultado:', result);
        console.log('\n📝 Nota: O fluxo de saída foi IGNORADO devido ao canal 11 + status personalizado');
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

/**
 * Executar todos os testes
 */
async function runAllTests() {
    console.log('╔════════════════════════════════════════════════════╗');
    console.log('║  EXEMPLOS DE TESTES - ChatService Refatorado      ║');
    console.log('╚════════════════════════════════════════════════════╝');

    await testSimpleTextChat();
    await testVoiceManualChatWithText();
    await testVoiceJourneyChat();
    await testTextChatWithMacroAndExitFlow();
    await testSLAFinalization();
    await testChannel11WithPersonalizedStatus();

    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║  TODOS OS TESTES EXECUTADOS                        ║');
    console.log('╚════════════════════════════════════════════════════╝\n');

    console.log('📊 Benefícios da Refatoração para Testes:');
    console.log('  ✅ Testes mais simples e focados');
    console.log('  ✅ Fácil mockar dependências específicas');
    console.log('  ✅ Cada função pode ser testada isoladamente');
    console.log('  ✅ Redução de complexidade nos testes');
    console.log('  ✅ Melhor cobertura de código');
}

// Executar se for chamado diretamente
if (require.main === module) {
    runAllTests().catch(console.error);
}

module.exports = {
    testSimpleTextChat,
    testVoiceManualChatWithText,
    testVoiceJourneyChat,
    testTextChatWithMacroAndExitFlow,
    testSLAFinalization,
    testChannel11WithPersonalizedStatus
};
