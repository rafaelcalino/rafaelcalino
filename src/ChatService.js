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
     * COMPLEX METHOD THAT NEEDS REFACTORING
     * This method handles ending chats for different types (text/voice) with nested logic
     */
    async endChat(query, typeEndChat) {
        try {
            const { chat_id: chatId, user_id: userId } = query;

            this.logger.info({
                description: `[${chatId}] Iniciando finalização de chat`,
                typeEndChat,
                userId
            });

            // Buscar documento do chat
            const chatDocument = await this.chatRepository.findById(chatId);
            
            if (!chatDocument) {
                throw new Error(`Chat ${chatId} não encontrado`);
            }

            const chatType = chatDocument.chat_type;
            const clientId = chatDocument.client_id;
            const tenantId = chatDocument.tenant_id;

            // INICIO DA LÓGICA COMPLEXA COM MUITOS IFs ANINHADOS
            if (chatType === ChatTypes.VOICE) {
                // Lógica de voz
                this.logger.info({ description: `[${chatId}] Processando chat de voz` });

                if (chatDocument.type_flag == 6) {
                    // Chamada manual vinculada a texto
                    const chatIdText = chatDocument.chat_id_owner;
                    
                    if (chatIdText) {
                        const numberFormat = await this.#formatPhoneNumber(chatDocument?.origin_dst);
                        const description = `Chamada de voz para ${numberFormat} Finalizada.`;
                        
                        // Enviar mensagem para o chat texto
                        await this.queueService.publish('newMessage', {
                            chat_id: chatIdText,
                            message: description,
                            timestamp: new Date()
                        });

                        this.logger.info({
                            description: `[${chatId}] Mensagem enviada ao chat texto ${chatIdText}`
                        });
                    } else {
                        // Chamada manual sem vínculo
                        await this.queueService.publish('removedChat', {
                            user_id: userId,
                            chat_id: chatId
                        });
                    }
                } else if (chatDocument.type_flag == 8 && chatDocument.journey_id) {
                    // Chamada de jornada
                    this.logger.info({
                        description: `[${chatId}] Processando chamada de jornada`,
                        journey_id: chatDocument.journey_id
                    });

                    // Enviar para fila de jornada
                    await this.queueService.publish('journey/dialer', {
                        chat_id: chatId,
                        journey_id: chatDocument.journey_id,
                        status: 'completed',
                        end_time: new Date()
                    });

                    // Verificar se há tabulação
                    if (typeEndChat?.tabulationId) {
                        await this.#processTabulationForJourney(
                            chatId,
                            typeEndChat.tabulationId,
                            userId,
                            clientId
                        );
                    }

                    // Notificar usuário
                    await this.queueService.publish('removedChat', {
                        user_id: userId,
                        chat_id: chatId
                    });
                } else {
                    // Chamada receptiva (padrão)
                    this.logger.info({
                        description: `[${chatId}] Processando chamada receptiva`
                    });

                    // Verificar tabulação
                    if (typeEndChat?.tabulationId) {
                        const tabulationData = await this.chatRepository.findTabulation(
                            typeEndChat.tabulationId
                        );

                        if (tabulationData) {
                            await this.chatRepository.updateChat(chatId, {
                                tabulation_id: typeEndChat.tabulationId,
                                tabulation_name: tabulationData.name,
                                tabulation_description: tabulationData.description
                            });

                            // Remover pausa de tabulação se ativa
                            const userStatus = await this.userRepository.getUserStatus(userId);
                            if (userStatus?.pause_type === 'tabulation') {
                                await this.userRepository.removePause(userId);
                                this.logger.info({
                                    description: `[${chatId}] Pausa de tabulação removida para usuário ${userId}`
                                });
                            }
                        }
                    }

                    // Atualizar XDR
                    const updateBody = {
                        end_time: new Date(),
                        status: 'completed',
                        ended_by: userId
                    };

                    await this.chatRepository.updateXdr(chatId, updateBody);

                    // Notificar usuário
                    await this.queueService.publish('removedChat', {
                        user_id: userId,
                        chat_id: chatId
                    });
                }
            } else {
                // Lógica de texto
                this.logger.info({ description: `[${chatId}] Processando chat de texto` });

                // Verificar macro de finalização
                if (typeEndChat?.finalizationMacro) {
                    const macroContent = await this.chatRepository.getMacroContent(
                        typeEndChat.finalizationMacro
                    );
                    
                    if (macroContent) {
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
                }

                // Verificar fluxo de saída
                if (typeEndChat?.exitFlowActionId) {
                    // Verificar se deve pular fluxo (canal 11 com status personalizado)
                    if (!(chatDocument.channel_id === 11 && typeEndChat?.statusPersonalized)) {
                        await this.queueService.publish('exitFlow', {
                            chat_id: chatId,
                            action_id: typeEndChat.exitFlowActionId,
                            user_id: userId,
                            tenant_id: tenantId
                        });

                        this.logger.info({
                            description: `[${chatId}] Fluxo de saída disparado`,
                            action_id: typeEndChat.exitFlowActionId
                        });
                    } else {
                        this.logger.info({
                            description: `[${chatId}] Fluxo de saída pulado (canal 11 com status personalizado)`
                        });
                    }
                }

                // Tabulação
                if (typeEndChat?.tabulationId) {
                    const tabulationData = await this.chatRepository.findTabulation(
                        typeEndChat.tabulationId
                    );

                    if (tabulationData) {
                        await this.chatRepository.updateChat(chatId, {
                            tabulation_id: typeEndChat.tabulationId,
                            tabulation_name: tabulationData.name,
                            tabulation_description: tabulationData.description
                        });

                        // Remover pausa de tabulação se ativa
                        const userStatus = await this.userRepository.getUserStatus(userId);
                        if (userStatus?.pause_type === 'tabulation') {
                            await this.userRepository.removePause(userId);
                            this.logger.info({
                                description: `[${chatId}] Pausa de tabulação removida para usuário ${userId}`
                            });
                        }
                    }
                }

                // Atualizar status do chat
                const updateBody = {
                    end_time: new Date(),
                    status: 'completed',
                    ended_by: userId
                };

                await this.chatRepository.updateChat(chatId, updateBody);

                // Verificar estratégia de fila para notificação
                const queueStrategy = await this.queueService.getQueueStrategy(clientId);
                
                await this.queueService.publish('removedChat', {
                    user_id: userId,
                    chat_id: chatId,
                    queue_strategy: queueStrategy
                });

                this.logger.info({
                    description: `[${chatId}] Notificação removedChat enviada`
                });
            }

            // Verificar finalização por SLA
            if (typeEndChat?.endChatBySLA) {
                this.logger.info({
                    description: `[${chatId}] Finalização por SLA detectada`
                });

                // Aplicar tabulação padrão se não houver
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

            // Enviar status personalizado para ETL
            if (typeEndChat?.statusPersonalized) {
                await this.etlService.sendStatus({
                    chat_id: chatId,
                    status: typeEndChat.statusPersonalized,
                    timestamp: new Date()
                });

                this.logger.info({
                    description: `[${chatId}] Status personalizado enviado ao ETL`,
                    status: typeEndChat.statusPersonalized
                });
            }

            // Verificar ociosidade do usuário
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

    /**
     * Processa tabulação para chamada de jornada
     * @private
     */
    async #processTabulationForJourney(chatId, tabulationId, userId, clientId) {
        const tabulationData = await this.chatRepository.findTabulation(tabulationId);
        
        if (tabulationData) {
            await this.chatRepository.updateChat(chatId, {
                tabulation_id: tabulationId,
                tabulation_name: tabulationData.name,
                tabulation_description: tabulationData.description,
                tabulation_type: 'journey'
            });

            this.logger.info({
                description: `[${chatId}] Tabulação de jornada aplicada`,
                tabulation_id: tabulationId
            });
        }
    }
}

module.exports = { ChatService, ChatTypes };
