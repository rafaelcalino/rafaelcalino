# 🏗️ Arquitetura da Refatoração - Diagrama Visual

## 📊 Estrutura Completa do ChatService Refatorado

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                           ChatService (Class)                               │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                      PUBLIC INTERFACE                                 │ │
│  │                                                                       │ │
│  │   async endChat(query, typeEndChat) → {success, chat_id}            │ │
│  │   ┌─────────────────────────────────────────────────────────────┐   │ │
│  │   │ 1. Validações iniciais                                      │   │ │
│  │   │ 2. Busca chatDocument                                       │   │ │
│  │   │ 3. DELEGAÇÃO POR TIPO ──────────┐                          │   │ │
│  │   │ 4. Processamento pós-finalização│                          │   │ │
│  │   └─────────────────────────────────┼───────────────────────────┘   │ │
│  └───────────────────────────────────────┼─────────────────────────────┘ │
│                                          │                                 │
│                    ┌─────────────────────┴──────────────────────┐         │
│                    │                                             │         │
│           ┌────────▼────────┐                           ┌────────▼────────┐│
│           │   VOICE CHAT    │                           │   TEXT CHAT     ││
│           └────────┬────────┘                           └────────┬────────┘│
│                    │                                             │         │
│  ┏━━━━━━━━━━━━━━━━━┷━━━━━━━━━━━━━━━━━┓         ┏━━━━━━━━━━━━━━━┷━━━━━━━━━┓│
│  ┃  #endVoiceChat(...)               ┃         ┃  #endTextChat(...)      ┃│
│  ┃  ┌─────────────────────────────┐  ┃         ┃  ┌───────────────────┐  ┃│
│  ┃  │ Identifica type_flag        │  ┃         ┃  │ Envia macro       │  ┃│
│  ┃  │ e delega para subfunção     │  ┃         ┃  │ Dispara exit flow │  ┃│
│  ┃  └─────────────────────────────┘  ┃         ┃  │ Aplica tabulação  │  ┃│
│  ┃           │                        ┃         ┃  │ Notifica users    │  ┃│
│  ┃  ┌────────┴────────┐              ┃         ┃  └───────────────────┘  ┃│
│  ┃  │                 │              ┃         ┗━━━━━━━━━━━━━━━━━━━━━━━━━┛│
│  ┃  │  ┌──────────────┴─────────┐   ┃                                     │
│  ┃  │  │                        │   ┃                                     │
│  ┃  ▼  ▼                        ▼   ┃                                     │
│  ┃ ┌──────────┐  ┌───────────┐ ┌────────────┐                            │
│  ┃ │  Manual  │  │  Journey  │ │ Receptive  │                            │
│  ┃ │type_flag=6│  │type_flag=8│ │  (default) │                            │
│  ┃ └──────────┘  └───────────┘ └────────────┘                            │
│  ┃      │              │              │                                    │
│  ┃      ▼              ▼              ▼                                    │
│  ┃ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓                                │
│  ┃ ┃ #endVoiceManualChat(...)          ┃                                │
│  ┃ ┃ ┌───────────────────────────────┐ ┃                                │
│  ┃ ┃ │ if chat_id_owner exists:      │ ┃                                │
│  ┃ ┃ │   send newMessage to text     │ ┃                                │
│  ┃ ┃ │ else:                          │ ┃                                │
│  ┃ ┃ │   notify removedChat           │ ┃                                │
│  ┃ ┃ └───────────────────────────────┘ ┃                                │
│  ┃ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛                                │
│  ┃ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓                                │
│  ┃ ┃ #endVoiceJourneyChat(...)         ┃                                │
│  ┃ ┃ ┌───────────────────────────────┐ ┃                                │
│  ┃ ┃ │ publish journey/dialer        │ ┃                                │
│  ┃ ┃ │ handleTabulationProcess()     │ ┃                                │
│  ┃ ┃ │ notifyUsers()                 │ ┃                                │
│  ┃ ┃ └───────────────────────────────┘ ┃                                │
│  ┃ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛                                │
│  ┃ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓                                │
│  ┃ ┃ #endVoiceReceptiveChat(...)       ┃                                │
│  ┃ ┃ ┌───────────────────────────────┐ ┃                                │
│  ┃ ┃ │ handleTabulationProcess()     │ ┃                                │
│  ┃ ┃ │ updateXdrAndStatus()          │ ┃                                │
│  ┃ ┃ │ notifyUsers()                 │ ┃                                │
│  ┃ ┃ └───────────────────────────────┘ ┃                                │
│  ┃ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛                                │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛                                │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                     GENERIC REUSABLE HELPERS                          │ │
│  │                                                                       │ │
│  │  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │ │
│  │  ┃  #handleTabulationProcess(chatId, tabulationId, userId, ...)   ┃ │ │
│  │  ┃  ┌──────────────────────────────────────────────────────────┐  ┃ │ │
│  │  ┃  │ • Busca dados da tabulação                               │  ┃ │ │
│  │  ┃  │ • Atualiza chat com informações                          │  ┃ │ │
│  │  ┃  │ • Remove pausa de tabulação se usuário em pausa          │  ┃ │ │
│  │  ┃  └──────────────────────────────────────────────────────────┘  ┃ │ │
│  │  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │ │
│  │                                                                       │ │
│  │  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │ │
│  │  ┃  #handleExitFlow(chatDocument, exitFlowActionId, userId, ...)  ┃ │ │
│  │  ┃  ┌──────────────────────────────────────────────────────────┐  ┃ │ │
│  │  ┃  │ • Verifica regra especial canal 11                       │  ┃ │ │
│  │  ┃  │ • Se não pular, publica exitFlow                         │  ┃ │ │
│  │  ┃  └──────────────────────────────────────────────────────────┘  ┃ │ │
│  │  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │ │
│  │                                                                       │ │
│  │  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │ │
│  │  ┃  #sendFinalizationMacro(chatId, finalizationMacroId)           ┃ │ │
│  │  ┃  ┌──────────────────────────────────────────────────────────┐  ┃ │ │
│  │  ┃  │ • Busca conteúdo da macro                                │  ┃ │ │
│  │  ┃  │ • Publica newMessage no chat                             │  ┃ │ │
│  │  ┃  └──────────────────────────────────────────────────────────┘  ┃ │ │
│  │  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │ │
│  │                                                                       │ │
│  │  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │ │
│  │  ┃  #notifyUsers(chatDocument, userId, queueStrategy)             ┃ │ │
│  │  ┃  ┌──────────────────────────────────────────────────────────┐  ┃ │ │
│  │  ┃  │ • Publica removedChat                                    │  ┃ │ │
│  │  ┃  │ • Inclui estratégia de fila se fornecida                 │  ┃ │ │
│  │  ┃  └──────────────────────────────────────────────────────────┘  ┃ │ │
│  │  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │ │
│  │                                                                       │ │
│  │  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │ │
│  │  ┃  #updateXdrAndStatus(chatId, updateBody, abandonedChatStatus)  ┃ │ │
│  │  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │ │
│  │                                                                       │ │
│  │  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │ │
│  │  ┃  #handleIdleUser(userId, documentTenantId, ...)                ┃ │ │
│  │  ┃  ┌──────────────────────────────────────────────────────────┐  ┃ │ │
│  │  ┃  │ • Verifica chats ativos do usuário                       │  ┃ │ │
│  │  ┃  │ • Se zero, marca usuário como idle                       │  ┃ │ │
│  │  ┃  └──────────────────────────────────────────────────────────┘  ┃ │ │
│  │  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │ │
│  │                                                                       │ │
│  │  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │ │
│  │  ┃  #sendPersonalizedStatusToETL(chatId, statusPersonalized)      ┃ │ │
│  │  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │ │
│  │                                                                       │ │
│  │  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │ │
│  │  ┃  #handleSLAFinalization(chatId, typeEndChat)                   ┃ │ │
│  │  ┃  ┌──────────────────────────────────────────────────────────┐  ┃ │ │
│  │  ┃  │ • Aplica tabulação padrão se necessário                  │  ┃ │ │
│  │  ┃  │ • Aplica status personalizado                            │  ┃ │ │
│  │  ┃  └──────────────────────────────────────────────────────────┘  ┃ │ │
│  │  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │ │
│  │                                                                       │ │
│  │  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │ │
│  │  ┃  #formatPhoneNumber(number)                                    ┃ │ │
│  │  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Fluxo de Execução

### Exemplo 1: Chat de Texto com Tabulação

```
User Request
    │
    ▼
endChat(query, {tabulationId: 'tab1'})
    │
    ├─ 1. Valida query
    ├─ 2. Busca chatDocument
    ├─ 3. Identifica chatType = 'text'
    │
    ▼
#endTextChat(chatDocument, query, typeEndChat)
    │
    ├─ (sem macro)
    ├─ (sem exit flow)
    ├─ #handleTabulationProcess('chat123', 'tab1', 'user456', 'client1')
    │   │
    │   ├─ Busca tabulação
    │   ├─ Atualiza chat
    │   └─ Remove pausa de usuário
    │
    ├─ Atualiza status do chat
    └─ #notifyUsers(chatDocument, 'user456', 'round-robin')
        └─ Publica removedChat
    │
    ▼
Processamento pós-finalização
    │
    ├─ (sem SLA)
    ├─ (sem status personalizado)
    └─ #handleIdleUser('user456', ...)
        └─ Marca usuário como idle
    │
    ▼
Retorna {success: true, chat_id: 'chat123'}
```

### Exemplo 2: Chamada de Voz Manual com Chat Texto

```
User Request
    │
    ▼
endChat(query, {})
    │
    ├─ 1. Valida query
    ├─ 2. Busca chatDocument
    ├─ 3. Identifica chatType = 'voice'
    │
    ▼
#endVoiceChat(chatDocument, query, typeEndChat)
    │
    ├─ Identifica type_flag = 6
    │
    ▼
#endVoiceManualChat(chatDocument, query, typeEndChat)
    │
    ├─ Verifica chat_id_owner existe
    ├─ #formatPhoneNumber('11987654321')
    │   └─ Retorna '(11) 98765-4321'
    │
    └─ Publica newMessage no chat texto vinculado
        └─ 'Chamada de voz para (11) 98765-4321 Finalizada.'
    │
    ▼
Processamento pós-finalização
    │
    └─ #handleIdleUser('user456', ...)
    │
    ▼
Retorna {success: true, chat_id: 'voice_chat_123'}
```

### Exemplo 3: Chamada de Jornada

```
User Request
    │
    ▼
endChat(query, {tabulationId: 'tab1'})
    │
    ├─ 1. Valida query
    ├─ 2. Busca chatDocument
    ├─ 3. Identifica chatType = 'voice'
    │
    ▼
#endVoiceChat(chatDocument, query, typeEndChat)
    │
    ├─ Identifica type_flag = 8 && journey_id existe
    │
    ▼
#endVoiceJourneyChat(chatDocument, query, typeEndChat)
    │
    ├─ Publica journey/dialer
    │   └─ {chat_id, journey_id: 'journey_789', status: 'completed'}
    │
    ├─ #handleTabulationProcess('journey_chat_123', 'tab1', 'user456', 'client1')
    │
    └─ #notifyUsers(chatDocument, 'user456', null)
    │
    ▼
Processamento pós-finalização
    │
    └─ #handleIdleUser('user456', ...)
    │
    ▼
Retorna {success: true, chat_id: 'journey_chat_123'}
```

---

## 📊 Métricas de Complexidade

### Antes da Refatoração
```
┌──────────────────────────────────┐
│     endChat() - Monolítico       │
│                                  │
│  Linhas: 250+                    │
│  Níveis IF: 4+                   │
│  Complexidade Ciclomática: ~25   │
│  Funções privadas: 1             │
│  Código duplicado: 3x            │
│                                  │
│  ❌ Difícil de testar            │
│  ❌ Difícil de manter            │
│  ❌ Alto acoplamento             │
└──────────────────────────────────┘
```

### Depois da Refatoração
```
┌──────────────────────────────────┐
│    endChat() - Orquestrador      │  ← 70 linhas, 2 níveis IF
│           │                      │
│      ┌────┴────┐                 │
│      │         │                 │
│   Voice      Text                │  ← Delegação clara
│      │         │                 │
│   ┌──┴──┐     │                 │
│   │  │  │     │                 │
│   M  J  R     │                 │  ← 3 subfunções voz + 1 texto
│      │  │  │  │                 │
│      └──┴──┴──┘                 │
│          │                      │
│    Generic Helpers              │  ← 9 funções reutilizáveis
│                                  │
│  ✅ Fácil de testar              │
│  ✅ Fácil de manter              │
│  ✅ Baixo acoplamento            │
└──────────────────────────────────┘
```

---

## 🎯 Princípios de Design Aplicados

### Single Responsibility Principle (SRP)
```
✅ endChat() → Orquestra o fluxo
✅ #endVoiceChat() → Decide subtipo de voz
✅ #endVoiceManualChat() → Processa chamada manual
✅ #handleTabulationProcess() → Apenas tabulação
```

### DRY (Don't Repeat Yourself)
```
❌ ANTES: Tabulação repetida 3x
✅ DEPOIS: #handleTabulationProcess() usado em múltiplos lugares
```

### Separation of Concerns
```
✅ Voz separado de texto
✅ Lógica de negócio separada de infraestrutura
✅ Validação separada de processamento
```

### Open/Closed Principle
```
✅ Fácil adicionar novo tipo de chat
✅ Não precisa modificar código existente
✅ Extensível via novas funções privadas
```

---

## 🚀 Benefícios da Arquitetura

### Manutenibilidade
- 🎯 **Modificar voz não afeta texto**
- 🎯 **Funções pequenas (10-40 linhas)**
- 🎯 **Fácil localizar bugs**

### Testabilidade
- ✅ **Teste unitário por função**
- ✅ **Mock de dependências simples**
- ✅ **Cobertura alta e confiável**

### Legibilidade
- 📖 **Fluxo claro e linear**
- 📖 **Nomes descritivos**
- 📖 **Logs informativos**

### Extensibilidade
- 🚀 **Adicionar tipos facilmente**
- 🚀 **Reutilizar helpers existentes**
- 🚀 **Zero breaking changes**

---

<div align="center">

**Arquitetura limpa = Código sustentável** 🏗️

</div>
