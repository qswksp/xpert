import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { IsNull, Repository } from 'typeorm'
import { TenantAwareCrudService } from '../core/crud'
import { CopilotUser } from './copilot-user.entity'
import { RequestContext } from '../core'
import { ICopilotUser } from '@metad/contracts'

@Injectable()
export class CopilotUserService extends TenantAwareCrudService<CopilotUser> {
	readonly #logger = new Logger(CopilotUserService.name)

	constructor(
		@InjectRepository(CopilotUser)
		repository: Repository<CopilotUser>,
	) {
		super(repository)
	}

	async upsert(user: Partial<CopilotUser>): Promise<void> {
		const existing = await this.findOneOrFail({
			tenantId: user.tenantId,
			organizationId: user.organizationId ?? IsNull(),
			userId: user.userId,
			provider: user.provider
		})
		if (existing.success) {
			await this.update(existing.record.id, {
				tokenUsed: existing.record.tokenUsed + user.tokenUsed
			})
		} else {
			await this.create({
				tenantId: user.tenantId,
				organizationId: user.organizationId,
				userId: user.userId,
				provider: user.provider,
				tokenUsed: user.tokenUsed
			})
		}
	}

	async renew(id: string, entity: Partial<ICopilotUser>) {
		const record = await this.findOne(id, { where: {tenantId: RequestContext.currentTenantId()}})
		record.tokenTotalUsed += record.tokenUsed
		record.tokenUsed = 0
		record.tokenLimit = entity.tokenLimit
		return await this.repository.save(record)
	}
}
