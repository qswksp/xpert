import { IPagination, IXpertTool, IXpertToolset } from '@metad/contracts'
import {
	CrudController,
	PaginationParams,
	ParseJsonPipe,
	Public,
	RequestContext,
	TransformInterceptor
} from '@metad/server-core'
import {
	Body,
	Controller,
	Get,
	HttpException,
	HttpStatus,
	Logger,
	Param,
	Post,
	Query,
	Res,
	UseInterceptors
} from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ServerResponse } from 'http'
import { TestOpenAPICommand } from '../xpert-tool/commands/'
import { ParserOpenAPISchemaCommand } from './commands/'
import { ToolProviderDTO, ToolsetPublicDTO } from './dto'
import {
	ListBuiltinCredentialsSchemaQuery,
	ListBuiltinToolProvidersQuery,
	ListBuiltinToolsQuery,
	ToolProviderIconQuery
} from './queries'
import { XpertToolset } from './xpert-toolset.entity'
import { XpertToolsetService } from './xpert-toolset.service'
import { ToolNotFoundError, ToolProviderNotFoundError } from './errors'


@ApiTags('XpertToolset')
@ApiBearerAuth()
@UseInterceptors(TransformInterceptor)
@Controller()
export class XpertToolsetController extends CrudController<XpertToolset> {
	readonly #logger = new Logger(XpertToolsetController.name)
	constructor(
		private readonly service: XpertToolsetService,
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus
	) {
		super(service)
	}

	@Get('by-workspace/:id')
	async getAllByWorkspace(
		@Param('id') workspaceId: string,
		@Query('data', ParseJsonPipe) data: PaginationParams<XpertToolset>,
		@Query('published') published?: boolean
	) {
		const result = await this.service.getAllByWorkspace(workspaceId, data, published, RequestContext.currentUser())
		return {
			...result,
			items: result.items.map((item) => new ToolsetPublicDTO(item))
		}
	}

	@ApiOperation({ summary: 'find all' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found records'
	})
	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) options?: PaginationParams<XpertToolset>
	): Promise<IPagination<XpertToolset>> {
		const { items, ...rest } = await this.service.findAll(options)
		return {
			items: items.map((item) => new ToolsetPublicDTO(item)),
			...rest
		}
	}

	@Get('tags')
	async getAllTags() {
		return this.service.getAllTags()
	}

	@Get('providers')
	async getAllToolProviders() {
		return this.queryBus.execute(new ListBuiltinToolProvidersQuery()).then((items) =>
			items.map(
				(schema) =>
					new ToolProviderDTO({
						...schema.identity
					})
			)
		)
	}

	@Post('provider/openapi/schema')
	async parseOpenAPISchema(@Body() { schema }: { schema: string }) {
		return this.commandBus.execute(new ParserOpenAPISchemaCommand(schema))
	}

	@Post('provider/openapi/test')
	async testOpenAPI(@Body() tool: IXpertTool) {
		return this.commandBus.execute(new TestOpenAPICommand(tool))
	}

	@Get('provider/:name')
	async getToolProvider(@Param('name') provider: string) {
		const providers = await this.queryBus.execute(new ListBuiltinToolProvidersQuery([provider]))
		if (!providers[0]) {
			throw new ToolProviderNotFoundError(`Tool provider '${provider}' not found!`)
		}

		return new ToolProviderDTO({
			...providers[0].identity
		})
	}

	@Public()
	@Get('builtin-provider/:name/icon')
	async getProviderIcon(@Param('name') provider: string, @Res() res: ServerResponse) {
		const [icon, mimetype] = await this.queryBus.execute(new ToolProviderIconQuery(provider))

		if (!icon) {
			throw new HttpException('Icon not found', HttpStatus.NOT_FOUND)
		}

		res.setHeader('Content-Type', mimetype)
		res.end(icon)
	}

	@Get('builtin-provider/:name/tools')
	async getBuiltinTools(@Param('name') provider: string) {
		return this.queryBus.execute(new ListBuiltinToolsQuery(provider))
	}

	@Get('builtin-provider/:name/credentials-schema')
	async getBuiltinCredentialsSchema(@Param('name') provider: string) {
		return this.queryBus.execute(new ListBuiltinCredentialsSchemaQuery(provider))
	}

	@Post('builtin-provider/:name/instance')
	async createBuiltinInstance(@Param('name') provider: string, @Body() body: Partial<IXpertToolset>) {
		return await this.service.createBuiltinToolset(provider, body)
	}
}
