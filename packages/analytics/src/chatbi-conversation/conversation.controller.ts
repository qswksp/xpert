import { IPagination } from '@metad/contracts'
import { CrudController, PaginationParams, ParseJsonPipe, RequestContext } from '@metad/server-core'
import { Controller, Get, HttpStatus, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ChatBIConversation } from './conversation.entity'
import { ChatBIConversationService } from './conversation.service'

@ApiTags('ChatBIConversation')
@ApiBearerAuth()
@Controller()
export class ChatBIConversationController extends CrudController<ChatBIConversation> {
	constructor(private readonly service: ChatBIConversationService) {
		super(service)
	}

	@ApiOperation({ summary: 'find my all' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found my records'
	})
	@Get('my')
	async findMyAll(
		@Query('data', ParseJsonPipe) filter?: PaginationParams<ChatBIConversation>,
		...options: any[]
	): Promise<IPagination<ChatBIConversation>> {
		return this.service.findAll({...filter, where: {createdById: RequestContext.currentUserId()}})
	}
}
