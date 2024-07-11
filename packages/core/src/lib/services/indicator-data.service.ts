import { BehaviorSubject, combineLatest, EMPTY, filter, map, Observable, withLatestFrom } from 'rxjs'
import { PeriodFunctions, Semantics } from '../annotations'
import {
  calcRange,
  TimeGranularity,
  TimeRangeType,
  getEntityCalendar,
  getEntityProperty,
  getIndicatorMeasureName,
  Indicator,
  Property,
  PropertyHierarchy,
  PropertyLevel,
  QueryReturn,
  mapTimeGranularitySemantic,
  getEntityDimensions
} from '../models/index'
import { C_MEASURES, FilterOperator, QueryOptions } from '../types'
import { isEmpty, isString, nonNullable } from '../utils'
import { SmartBusinessService, SmartBusinessState } from './smart-business.service'

export interface IndicatorBusinessState extends SmartBusinessState {
  indicatorId: string
  /**
   * time period functions for indicator measure
   */
  measures: Array<PeriodFunctions>
  lookBack?: number
}

/**
 *
 */
export class SmartIndicatorDataService<
  T,
  S extends IndicatorBusinessState = IndicatorBusinessState
> extends SmartBusinessService<T, S> {
  get indicator() {
    return this._indicator$.value
  }
  set indicator(value: Indicator) {
    this._indicator$.next(value)
  }

  get lookBack() {
    return this.get((state) => state.lookBack)
  }

  private _indicator$ = new BehaviorSubject<Indicator>(null)
  public readonly indicator$ = this._indicator$.pipe(filter((value) => !!value))

  public readonly indicatorId$ = this.select((state) => state.indicatorId)
  public readonly measures$ = this.select((state) => state.measures)

  calendar: Property
  calendarHierarchy: PropertyHierarchy
  calendarLevel: PropertyLevel
  /**
   * 指标的时间计算成员的缓存
   */
  indicatorMeasures: Record<string, Record<string, string>> = {}

  currentTime: { today: Date; timeGranularity: TimeGranularity }

  override onInit(): Observable<any> {
    return combineLatest([this.indicatorId$, this.dsCoreService.currentTime$]).pipe(
      withLatestFrom(this.measures$),
      map(([[id, currentTime], measures]) => {
        if (id) {
          this.indicator = this.getIndicator(id as string)
          if (this.indicator) {
            this.currentTime = currentTime
            const { dimension, hierarchy, level } = this.getEntityCalendar(
              this.indicator,
              this.currentTime.timeGranularity
            )
            this.calendar = dimension
            this.calendarHierarchy = hierarchy
            this.calendarLevel = level

            if (!isEmpty(measures)) {
              this.registerMembers(this.indicator, measures)
            }
          } else {
            /**
             * This should be avoided
             */
            console.error(
              `没有找到相应指标, 一般为 Entity 与 Indicator 没有同时更新而没有对应上导致. Entity is`,
              this.dataSettings.entitySet,
              `Schema is`,
              this.entityService.dataSource.options.schema,
              `Indicator is`,
              id
            )
          }
        }

        return this.indicator
      })
    )
  }

  registerMembers(indicator: Indicator, members: Array<PeriodFunctions>) {
    return members.map((type) => {
      const name = this.getOrRegisterMember(indicator, type)
      return [type, name]
    })
  }

  queryIndicator(
    indicator: Indicator | string,
    measures: Array<PeriodFunctions>,
    lookBack?: number,
    force?: boolean | void
  ): Observable<QueryReturn<T>> {
    indicator = isString(indicator) ? this.getIndicator(indicator as string) : (indicator as Indicator)

    if (!indicator) {
      /**
       * This should be avoided
       */
      console.error(
        `没有找到相应指标, 一般为 Entity 与 Indicator 没有同时更新而没有对应上导致. Entity is`,
        this.dataSettings.entitySet,
        `Schema is`,
        this.entityService.dataSource.options.schema,
        `Indicator is`,
        indicator
      )

      return EMPTY
    }

    const measureNames = this.registerMembers(indicator, measures)

    let timeRange = []
    if (this.currentTime) {
      if (this.calendarLevel) {
        timeRange = calcRange(this.currentTime?.today || new Date(), {
          type: TimeRangeType.Standard,
          granularity: this.currentTime?.timeGranularity,
          formatter: this.calendarLevel.semantics?.formatter,
          lookBack
        })
      } else {
        throw new Error(`Can't found calendar level in ${this.calendarHierarchy.name}`)
      }
    } else {
      throw new Error(`Not set current period`)
    }

    const tFilter = this.timeRange2Slicer(timeRange)

    return super
      .selectQuery({
        rows: [
          {
            dimension: this.calendar.name,
            hierarchy: this.calendarHierarchy.name,
            zeroSuppression: true
          }
        ],
        columns: [
          {
            dimension: C_MEASURES,
            members: measureNames.map((item) => item[1]).filter(nonNullable)
          }
        ],
        filters: [...(indicator.filters ?? []), tFilter],
        force
      })
      .pipe(
        map((result) => {
          return {
            ...result,
            data: result.data?.map((item) => {
              measureNames.forEach(([measure, name]) => {
                item[measure] = item[name]
              })
              return item
            }),
            stats: {
              ...(result.stats ?? {}),
              indicator
            }
          }
        })
      )
  }

  /**
   * 获取或注册指标的时间计算成员，如何某指标的同比环比
   * 
   * @param indicator 
   * @param type 
   * @returns 
   */
  getOrRegisterMember(indicator: Indicator, type: PeriodFunctions) {
    if (!this.indicatorMeasures[indicator.id]) {
      const measureName = getIndicatorMeasureName(indicator)
      if (!measureName) {
        throw new Error(`Can't found measure name for indicator '${indicator.code}'`)
      }
      this.indicatorMeasures[indicator.id] = {
        CurrentPeriod: measureName
      }
    }
    const measureNames = this.indicatorMeasures[indicator.id]
    // 缓存中并且 EntityType Measures 中已存在相应时间计算成员才可以
    if (!(measureNames[type] && getEntityProperty(this.entityType, measureNames[type][1]))) {
      try {
        measureNames[type] = this.getCalculatedMember(measureNames['CurrentPeriod'], type, this.calendarHierarchy.name)?.name
      } catch(err) {
        return null
      }
    }
    return measureNames[type]
  }

  override selectQuery(
    options: QueryOptions,
    indicator?: Indicator,
    measures?: Array<PeriodFunctions>,
    lookBack?: number
  ) {
    return this.queryIndicator(
      indicator ?? this.indicator,
      measures ?? this.get((state) => state.measures),
      lookBack ?? this.lookBack,
      options?.force
    )
  }

  timeRange2Slicer(timeRange: string[]) {
    return timeRange[0] === timeRange[1]
      ? {
          dimension: {
            dimension: this.calendar.name,
            hierarchy: this.calendarHierarchy.name
          },
          members: [{ key: timeRange[0] }]
        }
      : {
          dimension: {
            dimension: this.calendar.name,
            hierarchy: this.calendarHierarchy.name
          },
          members: timeRange.map((key) => ({ key })),
          operator: FilterOperator.BT
        }
  }

  getEntityCalendar(indicator: Indicator, timeGranularity: TimeGranularity) {
    if (indicator.calendar) {
      return getEntityCalendar(
        this.entityType,
        indicator.calendar,
        timeGranularity
      )
    }

    let dimension = null
    let hierarchy = null
    let level = null
    const calendarSemantic = mapTimeGranularitySemantic(timeGranularity)
    getEntityDimensions(this.entityType).filter(
      (property) => property.semantics?.semantic.startsWith(Semantics.Calendar)
    ).reduce((acc, curr) => {
      if (acc) {
        return acc
      }
      
      const _hierarchy = curr.hierarchies?.find((_hierarchy) => {
        const _level = _hierarchy.levels.find((level) => level.semantics?.semantic === calendarSemantic)
        if (_level) {
          level = _level
          hierarchy = _hierarchy
          dimension = curr
          return true
        }
        
        return false
      })

      if (_hierarchy) {
        return curr
      }

      return null
    }, null)

    return {
      dimension,
      hierarchy,
      level
    }
  }
}
