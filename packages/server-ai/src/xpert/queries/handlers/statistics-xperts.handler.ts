import { IQueryHandler, QueryBus, QueryHandler } from '@nestjs/cqrs'
import { getRepository } from 'typeorm'
import { StatisticsXpertsQuery } from '../statistics-xperts.query'
import { Xpert } from '../../xpert.entity'
import { RequestContext } from '@metad/server-core'

@QueryHandler(StatisticsXpertsQuery)
export class StatisticsXpertsHandler implements IQueryHandler<StatisticsXpertsQuery> {
	constructor(
		private readonly queryBus: QueryBus
	) {}

	public async execute(command: StatisticsXpertsQuery) {
		const { start, end } = command
		const tenantId = RequestContext.currentTenantId()
		const organizationId = RequestContext.getOrganizationId()

		const repository = getRepository(Xpert)

		const query = repository
			.createQueryBuilder('xpert')
			.select('COUNT(DISTINCT xpert.id) AS count')
			.where('xpert.tenantId = :tenantId', {tenantId})
			.andWhere('xpert.organizationId = :organizationId', {organizationId})
			.andWhere('xpert.latest = true')
			.andWhere('xpert.active = true')
			.andWhere('xpert.version IS NOT NULL')

		if (start) {
			query.andWhere('xpert.createdAt >= :start', { start })
		}
		if (end) {
			query.andWhere('xpert.createdAt <= :end', { end })
		}

		return await query.getRawMany()
	}
}
