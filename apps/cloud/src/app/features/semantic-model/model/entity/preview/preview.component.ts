import { CommonModule } from '@angular/common'
import { ChangeDetectionStrategy, Component, ViewChild, computed, inject } from '@angular/core'
import { PropertyCapacity, PropertySelectComponent } from '@metad/components/property'
import { AnalyticalGridComponent, AnalyticalGridModule } from '@metad/ocap-angular/analytical-grid'
import { AggregationRole, C_MEASURES, Dimension, EntityType, ISlicer, Measure, Syntax, serializeUniqueName } from '@metad/ocap-core'
import { TranslateModule } from '@ngx-translate/core'
import { MaterialModule } from 'apps/cloud/src/app/@shared'
import { BehaviorSubject, combineLatest, filter, from, map, of, switchMap } from 'rxjs'
import { ModelEntityService } from '../entity.service'
import { differenceBy, isEmpty, uniq } from 'lodash-es'
import { toSignal } from '@angular/core/rxjs-interop'
import { SemanticModelService } from '../../model.service'
import { nonNullable } from '@metad/core'
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop'
import { serializeMeasureName } from '@metad/ocap-sql'
import { MODEL_TYPE } from '../../types'
import { FormsModule } from '@angular/forms'
import { NgmCommonModule } from '@metad/ocap-angular/common'
import { DisplayDensity } from '@metad/ocap-angular/core'
import { ContentLoaderModule } from '@ngneat/content-loader'
import { NgmControlsModule } from '@metad/ocap-angular/controls'

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'pac-model-entity-preview',
  templateUrl: './preview.component.html',
  styleUrls: ['./preview.component.scss'],
  host: {
    class: 'pac-model-entity-preview'
  },
  imports: [
    CommonModule,
    FormsModule,
    MaterialModule,
    TranslateModule,
    ContentLoaderModule,

    NgmCommonModule,
    PropertySelectComponent,
    AnalyticalGridModule,
    NgmControlsModule
  ]
})
export class ModelEntityPreviewComponent {
    DisplayDensity = DisplayDensity
  Syntax = Syntax
    propertyCapacities = [
        PropertyCapacity.Dimension,
        PropertyCapacity.MeasureGroup,
        PropertyCapacity.Measure,
        PropertyCapacity.Order,
        PropertyCapacity.MeasureAttributes
      ]

    readonly modelService = inject(SemanticModelService)
    readonly entityService = inject(ModelEntityService)

    @ViewChild(AnalyticalGridComponent) grid!: AnalyticalGridComponent<any>
    
    private rows$ = new BehaviorSubject<Array<Dimension | Measure>>([...(this.entityService.preview?.rows ?? [])])
  get rows() {
    return this.rows$.value
  }
  set rows(value) {
    this.rows$.next(value)
  }

  get columns() {
    return this.columns$.value
  }
  set columns(value) {
    this.columns$.next(value)
  }
  public readonly columns$ = new BehaviorSubject<Array<Dimension | Measure>>([
    ...(this.entityService.preview?.columns ?? [])
  ])

  get slicers() {
    return this.slicers$.value
  }
  set slicers(value) {
    this.slicers$.next(value)
  }
  public readonly slicers$ = new BehaviorSubject<ISlicer[]>([...(this.entityService.preview?.slicers ?? [])])

  reverse = false

  private refresh$ = new BehaviorSubject<boolean | null>(null)

  public readonly analytics$ = combineLatest([
    this.refresh$.pipe(switchMap((refresh) => (this.manualRefresh ? from([refresh, false]) : of(refresh)))),
    this.rows$,
    this.columns$,
    this.slicers$
  ]).pipe(
    filter(([refresh, rows, columns]) => {
      return (!this.manualRefresh || refresh) && (!isEmpty(rows) || !isEmpty(columns))
    }),
    map(([, rows, columns, slicers]) => {
      slicers = (slicers?.filter(Boolean) ?? []).map((item) => ({ ...item }))
      return this.reverse
        ? {
            rows: [...columns],
            columns: [...rows],
            slicers: [...slicers]
          }
        : {
            rows: [...rows],
            columns: [...columns],
            slicers: [...slicers]
          }
    })
  )

  manualRefresh = false
  entities = []

  public readonly analytics = toSignal(this.analytics$)

  private readonly modelKey = toSignal(this.modelService.model$.pipe(map((model) => model.key ?? model.name)))
  private readonly cubeName = toSignal(
    this.entityService.cube$.pipe(
      map((cube) => cube?.name),
      filter(nonNullable)
    )
  )

  readonly modelType = toSignal(this.modelService.modelType$)
  readonly dialect = toSignal(this.modelService.dialect$)

  public readonly dataSettings = computed(() => ({
    dataSource: this.modelKey(),
    entitySet: this.cubeName()
  }))

  public readonly analyticsDataSettings = computed(() => ({
    ...this.dataSettings(),
    analytics: this.analytics(),
    selectionVariant: {
      selectOptions: this.analytics()?.slicers
    }
  }))

  public readonly entityType = toSignal<EntityType, EntityType>(this.entityService.entityType$, {
    initialValue: { syntax: Syntax.MDX, properties: {} } as EntityType
  })

  trackByIndex(index: number, el: any): number {
    return index
  }

  refresh() {
    this.refresh$.next(true)
    this.grid.refresh(true)
  }

  onRowChange(event, i: number) {
    const rows = [...this.rows]
    rows[i] = event
    this.rows = rows
  }
  onColumnChange(event, i: number) {
    const columns = [...this.columns]
    columns[i] = event
    this.columns = columns
  }
  onSlicerChange(event: ISlicer, i: number) {
    const filters = [...this.slicers]
    filters[i] = event
    this.slicers = filters
  }

  trackByDim(i: number, item: any) {
    return item?.dimension?.dimension
  }

  removeRow(index: number) {
    this.rows.splice(index, 1)
    this.rows = this.rows
  }

  removeColumn(index: number) {
    this.columns.splice(index, 1)
    this.columns = this.columns
  }

  removeSlicer(i: number) {
    const filters = [...this.slicers]
    filters.splice(i, 1)
    this.slicers = filters
  }

  newSlicer() {
    this.slicers = [...this.slicers, null]
  }

  add(type: 'columns' | 'rows') {
    if (type === 'columns') {
      this.columns = [...this.columns, {}]
    } else if (type === 'rows') {
      this.rows = [...this.rows, {}]
    }
  }

  getDropProperty(event: CdkDragDrop<unknown[]>) {
    const modelType = this.modelType()
    const dialect = this.dialect()

    const property = event.item.data
    const item = {
      dimension: null,
      hierarchy: null,
      level: null,
      zeroSuppression: false
    } as Dimension
    if (property.role === AggregationRole.dimension) {
      item.dimension = modelType !== MODEL_TYPE.XMLA ? serializeUniqueName(dialect, property.name) : property.name
      // 取默认 hierarchy 或者默认与 dimension 同名的
      item.hierarchy = property.defaultHierarchy || item.dimension
    } else if (property.role === AggregationRole.hierarchy) {
      item.dimension =
        modelType !== MODEL_TYPE.XMLA ? serializeUniqueName(dialect, property.dimension) : property.dimension
      item.hierarchy =
        modelType !== MODEL_TYPE.XMLA
          ? serializeUniqueName(dialect, property.dimension, property.name)
          : property.name
    } else if (property.role === AggregationRole.level) {
      item.dimension =
        modelType !== MODEL_TYPE.XMLA ? serializeUniqueName(dialect, property.dimension) : property.dimension
      item.hierarchy =
        modelType !== MODEL_TYPE.XMLA
          ? serializeUniqueName(dialect, property.dimension, property.hierarchy)
          : property.hierarchy
      item.level =
        modelType !== MODEL_TYPE.XMLA
          ? serializeUniqueName(dialect, property.dimension, property.hierarchy, property.name)
          : property.name
    } else if (property.source && modelType !== MODEL_TYPE.XMLA) {
      // Dimension Usage
      item.dimension = serializeUniqueName(dialect, property.source)
    }

    return item
  }

  drop(event: CdkDragDrop<unknown[]>) {
    const dialect = this.dialect()

    const data = event.item.data
    if (event.previousContainer === event.container) {
      if (event.previousContainer.id === 'property-modeling-rows') {
        moveItemInArray(this.rows, event.previousIndex, event.currentIndex)
      } else if (event.previousContainer.id === 'property-modeling-columns') {
        moveItemInArray(this.columns, event.previousIndex, event.currentIndex)
      }
    } else {
      if (event.previousContainer.id === 'list-dimensions') {
        const item = this.getDropProperty(event)

        if (event.container.id === 'property-modeling-rows') {
          const rows = differenceBy(this.rows, [item], 'dimension')
          rows.splice(event.currentIndex, 0, item)
          this.rows = rows
        } else if (event.container.id === 'property-modeling-columns') {
          const columns = differenceBy(this.columns, [item], 'dimension')
          columns.splice(event.currentIndex, 0, item)
          this.columns = columns
        } else if (event.container.id === 'property-modeling-slicers') {
          this.slicers = [
            ...this.slicers,
            {
              dimension: item,
              members: []
            }
          ]
        }
      } else if (
        event.previousContainer.id === 'list-measures' ||
        event.previousContainer.id === 'list-calculated-members'
      ) {
        let rows = null
        if (event.container.id === 'property-modeling-rows') {
          rows = [...this.rows]
        } else if (event.container.id === 'property-modeling-columns') {
          rows = [...this.columns]
        }
        if (rows) {
          const index = rows.findIndex((row) => row.dimension === C_MEASURES)
          const item =
            index > -1
              ? { ...rows.splice(index, 1)[0] }
              : {
                  dimension: C_MEASURES,
                  members: []
                }
          item.members = [...item.members, serializeMeasureName(dialect, data.name)]
          item.members = uniq(item.members)
          rows.splice(event.currentIndex, 0, item)
        }
        if (event.container.id === 'property-modeling-rows') {
          this.rows = rows
        } else if (event.container.id === 'property-modeling-columns') {
          this.columns = rows
        }
      } else if (event.previousContainer.id === 'property-modeling-rows') {
        if (event.container.id === 'property-modeling-columns') {
          transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex)
        } else if (event.container.id === 'property-modeling-slicers') {
          const moves = this.rows.splice(event.previousIndex, 1)
          this.slicers.splice(event.currentIndex, 0, ...moves.map((dimension) => ({ dimension })))
        }
      } else if (event.previousContainer.id === 'property-modeling-columns') {
        if (event.container.id === 'property-modeling-rows') {
          transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex)
        } else if (event.container.id === 'property-modeling-slicers') {
          const moves = this.columns.splice(event.previousIndex, 1)
          this.slicers.splice(event.currentIndex, 0, ...moves.map((dimension) => ({ dimension })))
        }
      } else if (event.previousContainer.id === 'property-modeling-slicers') {
        if (event.container.id === 'property-modeling-rows') {
          const moves = this.slicers.splice(event.previousIndex, 1)
          this.rows.splice(event.currentIndex, 0, ...moves.map((slicer) => slicer.dimension))
        } else if (event.container.id === 'property-modeling-columns') {
          const moves = this.slicers.splice(event.previousIndex, 1)
          this.columns.splice(event.currentIndex, 0, ...moves.map((slicer) => slicer.dimension))
        }
      }
    }
  }

  ngOnDestroy() {
    this.entityService.setPreview({
        rows: this.rows,
        columns: this.columns,
        slicers: this.slicers
      })
  }
}
