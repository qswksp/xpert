import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { TypeOrmModule } from '@nestjs/typeorm'
import { RouterModule } from 'nest-router'
import { TenantModule } from '../tenant'
import { UserModule } from '../user'
import { CopilotKnowledge } from './copilot-example.entity'
import { CopilotKnowledgeService } from './copilot-example.service'
import { CopilotKnowledgeController } from './copilot-example.controller'
import { CopilotModule } from '../copilot/copilot.module'
import { CommandHandlers } from './commands/handlers'
import { DatabaseModule } from '../database/database.module'

@Module({
	imports: [
		RouterModule.forRoutes([{ path: '/copilot-knowledge', module: CopilotKnowledgeModule }]),
		TypeOrmModule.forFeature([ CopilotKnowledge ]),
		TenantModule,
		CqrsModule,
		UserModule,
		CopilotModule,
		DatabaseModule
	],
	controllers: [CopilotKnowledgeController],
	providers: [CopilotKnowledgeService, ...CommandHandlers],
	exports: [CopilotKnowledgeService]
})
export class CopilotKnowledgeModule {}
