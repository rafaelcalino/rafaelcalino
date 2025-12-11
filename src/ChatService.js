/**
 * ChatService - Service for managing chat operations
 * This file contains the complex endChat method that needs refactoring
 */

const ChatTypes = {
    TEXT: 'text',
    VOICE: 'voice'
};

class ChatService {
    constructor(logger, chatRepository, userRepository, queueService, etlService) {
        this.logger = logger;
        this.chatRepository = chatRepository;
        this.userRepository = userRepository;
        this.queueService = queueService;
        this.etlService = etlService;
    }

    /**
     * Finaliza um chat (texto ou voz) aplicando a lógica apropriada
     * Método público principal que delega para funções específicas
     * 
     * @param {Object} query - Objeto com chat_id e user_id
     * @param {Object} typeEndChat - Configurações de finalização (tabulação, macro, etc)
     * @returns {Promise<Object>} Resultado da finalização
     */
    async endChat(query, typeEndChat) {
        try {
            // 1. Validações iniciais
            const { chat_id: chatId, user_id: userId } = query;

            this.logger.info({
                description: `[${chatId}] Iniciando finalização de chat`,
                typeEndChat,
                userId
            });

            const chatDocument = await this.chatRepository.findById(chatId);
            
            if (!chatDocument) {
                throw new Error(`Chat ${chatId} não encontrado`);
            }

            // 2. Preparação de dados comuns
            const chatType = chatDocument.chat_type;
            const clientId = chatDocument.client_id;

            // 3. Delegação por tipo de chat (decisão principal com no máximo 1 nível de IF)
            if (chatType === ChatTypes.VOICE) {
                await this.#endVoiceChat(chatDocument, query, typeEndChat);
            } else {
                await this.#endTextChat(chatDocument, query, typeEndChat);
            }

            // 4. Processamento comum pós-finalização
            // Finalização por SLA requer tratamento especial
            if (typeEndChat?.endChatBySLA) {
                await this.#handleSLAFinalization(chatId, typeEndChat);
            }

            // Enviar status personalizado para ETL se configurado
            if (typeEndChat?.statusPersonalized) {
                await this.#sendPersonalizedStatusToETL(chatId, typeEndChat.statusPersonalized);
            }

            // Verificar se usuário ficou ocioso após finalizar chat
            await this.#handleIdleUser(userId, chatDocument.tenant_id, clientId, chatId);

            this.logger.info({
                description: `[${chatId}] Chat finalizado com sucesso`
            });

            return {
                success: true,
                chat_id: chatId
            };

        } catch (error) {
            this.logger.error({
                description: 'Erro ao finalizar chat',
                error: error.message,
                stack: error.stack,
                query,
                typeEndChat
            });

            throw error;
        }
    }

    /**
     * Finaliza chat de voz delegando para subfunções específicas
     * @private
     */
    async #endVoiceChat(chatDocument, query, typeEndChat) {
        const { chat_id: chatId } = query;
        
        this.logger.info({
            description: `[${chatId}] Processando finalização de CHAT DE VOZ`,
            type_flag: chatDocument.type_flag
        });

        // Decisão por tipo de chamada de voz (máximo 1 nível de profundidade)
        if (chatDocument.type_flag == 6) {
            return await this.#endVoiceManualChat(chatDocument, query, typeEndChat);
        }
        
        if (chatDocument.type_flag == 8 && chatDocument.journey_id) {
            return await this.#endVoiceJourneyChat(chatDocument, query, typeEndChat);
        }
        
        return await this.#endVoiceReceptiveChat(chatDocument, query, typeEndChat);
    }

    /**
     * Finaliza chamada manual de voz (type_flag === 6)
     * Chamadas manuais podem estar vinculadas a um chat de texto
     * @private
     */
    async #endVoiceManualChat(chatDocument, query, typeEndChat) {
        const { chat_id: chatId, user_id: userId } = query;
        
        this.logger.info({
            description: `[${chatId}] Finalizando CHAMADA MANUAL DE VOZ`,
            chat_id_owner: chatDocument.chat_id_owner
        });

        const chatIdText = chatDocument.chat_id_owner;
        
        // Se vinculada a chat texto, enviar mensagem; caso contrário, notificar remoção
        if (chatIdText) {
            const numberFormat = await this.#formatPhoneNumber(chatDocument?.origin_dst);
            const description = `Chamada de voz para ${numberFormat} Finalizada.`;
            
            await this.queueService.publish('newMessage', {
                chat_id: chatIdText,
                message: description,
                timestamp: new Date()
            });

            this.logger.info({
                description: `[${chatId}] Mensagem enviada ao chat texto ${chatIdText}`
            });
        } else {
            await this.#notifyUsers(chatDocument, userId, null);
        }
    }

    /**
     * Finaliza chamada de jornada (type_flag === 8 com journey_id)
     * Envia para fila específica de jornada/dialer
     * @private
     */
    async #endVoiceJourneyChat(chatDocument, query, typeEndChat) {
        const { chat_id: chatId, user_id: userId } = query;
        
        this.logger.info({
            description: `[${chatId}] Finalizando CHAMADA DE JORNADA`,
            journey_id: chatDocument.journey_id
        });

        // Enviar para fila de jornada
        await this.queueService.publish('journey/dialer', {
            chat_id: chatId,
            journey_id: chatDocument.journey_id,
            status: 'completed',
            end_time: new Date()
        });

        // Aplicar tabulação se configurada
        if (typeEndChat?.tabulationId) {
            await this.#handleTabulationProcess(
                chatId,
                typeEndChat.tabulationId,
                userId,
                chatDocument.client_id
            );
        }

        // Notificar usuário da remoção do chat
        await this.#notifyUsers(chatDocument, userId, null);
    }

    /**
     * Finaliza chamada receptiva (caso padrão para voz)
     * @private
     */
    async #endVoiceReceptiveChat(chatDocument, query, typeEndChat) {
        const { chat_id: chatId, user_id: userId } = query;
        
        this.logger.info({
            description: `[${chatId}] Finalizando CHAMADA RECEPTIVA DE VOZ`
        });

        // Aplicar tabulação se configurada
        if (typeEndChat?.tabulationId) {
            await this.#handleTabulationProcess(
                chatId,
                typeEndChat.tabulationId,
                userId,
                chatDocument.client_id
            );
        }

        // Atualizar XDR com dados de finalização
        const updateBody = {
            end_time: new Date(),
            status: 'completed',
            ended_by: userId
        };
        await this.#updateXdrAndStatus(chatId, updateBody, null);

        // Notificar usuário da remoção do chat
        await this.#notifyUsers(chatDocument, userId, null);
    }

    /**
     * Finaliza chat de texto aplicando macro, fluxo de saída e tabulação
     * @private
     */
    async #endTextChat(chatDocument, query, typeEndChat) {
        const { chat_id: chatId, user_id: userId } = query;
        const tenantId = chatDocument.tenant_id;
        const clientId = chatDocument.client_id;
        
        this.logger.info({
            description: `[${chatId}] Processando finalização de CHAT DE TEXTO`
        });

        // Enviar macro de finalização se configurada
        if (typeEndChat?.finalizationMacro) {
            await this.#sendFinalizationMacro(chatId, typeEndChat.finalizationMacro);
        }

        // Disparar fluxo de saída se configurado
        if (typeEndChat?.exitFlowActionId) {
            await this.#handleExitFlow(
                chatDocument,
                typeEndChat.exitFlowActionId,
                userId,
                typeEndChat
            );
        }

        // Aplicar tabulação se configurada
        if (typeEndChat?.tabulationId) {
            await this.#handleTabulationProcess(
                chatId,
                typeEndChat.tabulationId,
                userId,
                clientId
            );
        }

        // Atualizar status do chat
        const updateBody = {
            end_time: new Date(),
            status: 'completed',
            ended_by: userId
        };
        await this.chatRepository.updateChat(chatId, updateBody);

        // Obter estratégia de fila e notificar
        const queueStrategy = await this.queueService.getQueueStrategy(clientId);
        await this.#notifyUsers(chatDocument, userId, queueStrategy);
    }

    // ============================================
    // FUNÇÕES GENÉRICAS REUTILIZÁVEIS
    // ============================================

    /**
     * Processa tabulação do chat removendo pausa se necessário
     * @private
     */
    async #handleTabulationProcess(chatId, tabulationId, userId, clientId) {
        const tabulationData = await this.chatRepository.findTabulation(tabulationId);

        if (!tabulationData) {
            this.logger.warn({
                description: `[${chatId}] Tabulação ${tabulationId} não encontrada`
            });
            return;
        }

        await this.chatRepository.updateChat(chatId, {
            tabulation_id: tabulationId,
            tabulation_name: tabulationData.name,
            tabulation_description: tabulationData.description
        });

        // Remover pausa de tabulação se usuário estiver em pausa deste tipo
        const userStatus = await this.userRepository.getUserStatus(userId);
        if (userStatus?.pause_type === 'tabulation') {
            await this.userRepository.removePause(userId);
            this.logger.info({
                description: `[${chatId}] Pausa de tabulação removida para usuário ${userId}`
            });
        }

        this.logger.info({
            description: `[${chatId}] Tabulação aplicada`,
            tabulation_id: tabulationId
        });
    }

    /**
     * Dispara fluxo de saída respeitando regras específicas
     * Canal 11 com status personalizado pula o fluxo
     * @private
     */
    async #handleExitFlow(chatDocument, exitFlowActionId, userId, typeEndChat) {
        const chatId = chatDocument.chat_id;
        
        // Regra especial: Canal 11 com status personalizado não dispara fluxo de saída
        if (chatDocument.channel_id === 11 && typeEndChat?.statusPersonalized) {
            this.logger.info({
                description: `[${chatId}] Fluxo de saída IGNORADO (canal 11 com status personalizado)`
            });
            return;
        }

        await this.queueService.publish('exitFlow', {
            chat_id: chatId,
            action_id: exitFlowActionId,
            user_id: userId,
            tenant_id: chatDocument.tenant_id
        });

        this.logger.info({
            description: `[${chatId}] Fluxo de saída disparado`,
            action_id: exitFlowActionId
        });
    }

    /**
     * Atualiza XDR e status do chat
     * @private
     */
    async #updateXdrAndStatus(chatId, updateBody, abandonedChatStatus) {
        await this.chatRepository.updateXdr(chatId, updateBody);
        
        this.logger.info({
            description: `[${chatId}] XDR atualizado`,
            status: updateBody.status
        });
    }

    /**
     * Notifica usuários sobre remoção do chat
     * @private
     */
    async #notifyUsers(chatDocument, userId, queueStrategy) {
        const chatId = chatDocument.chat_id;
        
        await this.queueService.publish('removedChat', {
            user_id: userId,
            chat_id: chatId,
            queue_strategy: queueStrategy
        });

        this.logger.info({
            description: `[${chatId}] Notificação removedChat enviada`,
            user_id: userId
        });
    }

    /**
     * Verifica se usuário ficou ocioso e atualiza status
     * @private
     */
    async #handleIdleUser(userId, documentTenantId, documentClientId, chatId) {
        const activeChats = await this.chatRepository.findActiveChatsForUser(userId);
        
        if (activeChats.length === 0) {
            this.logger.info({
                description: `[${chatId}] Usuário ${userId} sem chats ativos, marcando como ocioso`
            });

            await this.userRepository.updateUserStatus(userId, {
                status: 'idle',
                last_chat_ended: new Date()
            });
        }
    }

    /**
     * Envia status personalizado para ETL
     * @private
     */
    async #sendPersonalizedStatusToETL(chatId, statusPersonalized) {
        await this.etlService.sendStatus({
            chat_id: chatId,
            status: statusPersonalized,
            timestamp: new Date()
        });

        this.logger.info({
            description: `[${chatId}] Status personalizado enviado ao ETL`,
            status: statusPersonalized
        });
    }

    /**
     * Trata finalização por SLA aplicando tabulação e status padrão
     * @private
     */
    async #handleSLAFinalization(chatId, typeEndChat) {
        this.logger.info({
            description: `[${chatId}] Processando finalização por SLA`
        });

        // Aplicar tabulação padrão se não houver tabulação configurada
        if (!typeEndChat?.tabulationId && typeEndChat?.defaultSLATabulationId) {
            await this.chatRepository.updateChat(chatId, {
                tabulation_id: typeEndChat.defaultSLATabulationId,
                tabulation_type: 'sla_timeout'
            });
        }

        // Aplicar status personalizado
        if (typeEndChat?.statusPersonalized) {
            await this.chatRepository.updateChat(chatId, {
                status_personalized: typeEndChat.statusPersonalized
            });
        }
    }

    /**
     * Envia macro de finalização para o chat
     * @private
     */
    async #sendFinalizationMacro(chatId, finalizationMacroId) {
        const macroContent = await this.chatRepository.getMacroContent(finalizationMacroId);
        
        if (!macroContent) {
            this.logger.warn({
                description: `[${chatId}] Macro de finalização ${finalizationMacroId} não encontrada`
            });
            return;
        }

        await this.queueService.publish('newMessage', {
            chat_id: chatId,
            message: macroContent,
            is_from_bot: true,
            timestamp: new Date()
        });

        this.logger.info({
            description: `[${chatId}] Macro de finalização enviada`
        });
    }

    /**
     * Formata número de telefone
     * @private
     */
    async #formatPhoneNumber(number) {
        if (!number) return 'Desconhecido';
        
        // Lógica simples de formatação
        const cleaned = number.replace(/\D/g, '');
        if (cleaned.length === 11) {
            return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
        }
        return number;
    }


}

module.exports = { ChatService, ChatTypes };
