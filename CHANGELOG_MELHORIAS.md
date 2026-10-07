# Melhorias do fluxo de distratos

## Implementado nesta versão

- separação entre andamento do distrato e situação financeira;
- distrato permanece **Em andamento** mesmo quando o financeiro estiver **Quitado**;
- finalização formal disponível ao supervisor após quitação e conclusão das verificações;
- reabertura de distrato finalizado com registro no histórico;
- aluguel de equipamento transformado em verificação com múltiplos lançamentos e anexos;
- compatibilidade automática com o aluguel dos distratos antigos;
- nomes ajustados para **Manutenção**, **Estadia**, **Estacionamento** e **Pneus**;
- responsável pelo custo: **Agregado** ou **Transpanorama**;
- valores atribuídos à Transpanorama não entram na dívida do agregado;
- Pneus com quantidade, valor unitário e total calculado;
- Câmera e Rastreador com quantidades e valores unitários;
- ANTT com os estados **Vinculado**, **Em andamento** e **Desvinculado**;
- remoção do rótulo “Parecer Técnico”;
- descrição automática para lançamento salvo sem texto, evitando reutilização do nome anterior;
- cadastro e edição de empresa, data do engate inicial e data do engate final.
- pagamento vinculado a várias pendências em uma única baixa;
- seleção de todas as pendências e preenchimento automático do valor total;
- rateio automático de pagamentos parciais entre as dívidas selecionadas;
- conferência da Auditoria de Suprimentos separada dos valores financeiros originais;
- comparação entre valor lançado, valor auditado e diferença no relatório;
- inclusão, pela auditoria, de nova pendência não registrada com descrição obrigatória.
- Auditoria de Suprimentos convertida em fluxo próprio de achados, separado dos lançamentos departamentais;
- registro de critério, situação encontrada, causa, efeito/risco, recomendação, criticidade, responsável e prazo;
- evidência obrigatória para concluir uma auditoria;
- resumo da auditoria sem exibir o valor como se fosse uma nova dívida;
- edição e visualização completa do achado de auditoria;
- relatório de auditoria com comparação financeira e plano de ação;
- conversão automática dos lançamentos antigos de suprimentos para o novo formato.
- documentos opcionais no cadastro inicial, com categoria, descrição e envio de vários arquivos;
- menu principal reduzido a Painel, Distratos, Minhas Tarefas e Supervisão;
- Financeiro, Jurídico, Documentos, Auditoria e relatórios mantidos dentro do respectivo distrato;
- fila de tarefas combinada para usuários com acesso a dois ou mais departamentos;
- painel de conduta e boas práticas no Painel Geral.
- opção de recolher e expandir cada categoria de verificação;
- categoria exibida como quitada quando todos os seus lançamentos estiverem pagos;
- substituição dos anexos ao editar um lançamento ou registro de auditoria;
- conferências da Auditoria separadas do cálculo da dívida e do saldo;
- novas pendências da Auditoria identificadas como valores extras no resumo financeiro.
- proteção dos identificadores, tipos e títulos das categorias ao incluir pendências;
- correção automática de categorias e lançamentos duplicados em dados antigos.

## Próximas etapas

- permissões departamentais para exclusão de documentos;
- histórico completo pesquisável por placa;
- cancelamento de eventos duplicados sem apagar o histórico;
- envio automático de e-mails por evento;
