import { UserModule } from '@metad/server-core'
import { Module, forwardRef } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { AIModule } from './ai'
import { ChatModule } from './chat'
import { ChatConversationModule } from './chat-conversation'
import { CopilotModule } from './copilot'
import { CopilotCheckpointModule } from './copilot-checkpoint'
import { CopilotKnowledgeModule } from './copilot-knowledge'
import { CopilotOrganizationModule } from './copilot-organization'
import { CopilotUserModule } from './copilot-user'
import { EventHandlers } from './core/events'
import { GraphragModule } from './graphrag/graphrag.module'
import { KnowledgeDocumentModule } from './knowledge-document/index'
import { KnowledgebaseModule } from './knowledgebase/index'
import { XpertRoleModule } from './xpert-role/index'
import { XpertToolModule } from './xpert-tool/index'
import { XpertToolsetModule } from './xpert-toolset/index'
import { XpertAgentModule } from './xpert-agent/index'

@Module({
	imports: [
		forwardRef(() => CqrsModule),
		forwardRef(() => UserModule),
		KnowledgebaseModule,
		KnowledgeDocumentModule,
		ChatModule,
		ChatConversationModule,
		CopilotCheckpointModule,
		AIModule,
		CopilotModule,
		CopilotKnowledgeModule,
		CopilotUserModule,
		CopilotOrganizationModule,
		GraphragModule,
		XpertAgentModule,
		XpertRoleModule,
		XpertToolModule,
		XpertToolsetModule
	],
	controllers: [],
	providers: [...EventHandlers]
})
export class ServerAIModule {}
