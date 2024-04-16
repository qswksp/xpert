import { CommonModule } from '@angular/common'
import { Component, Input, OnChanges, SimpleChanges, effect, forwardRef, inject, signal } from '@angular/core'
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop'
import {
  ControlValueAccessor,
  FormControl,
  FormGroup,
  FormsModule,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
  Validators
} from '@angular/forms'
import { MatFormFieldAppearance } from '@angular/material/form-field'
import { BusinessAreasService, NgmSemanticModel } from '@metad/cloud/state'
import { NxSelectionModule, SlicersCapacity } from '@metad/components/selection'
import { IsNilPipe, calcEntityTypePrompt, nonBlank, nonNullable } from '@metad/core'
import { NgmMatSelectComponent, NgmTreeSelectComponent } from '@metad/ocap-angular/common'
import { injectCopilotCommand, injectMakeCopilotActionable } from '@metad/ocap-angular/copilot'
import { ISelectOption, NgmDSCoreService } from '@metad/ocap-angular/core'
import { NgmHierarchySelectComponent } from '@metad/ocap-angular/entity'
import { WasmAgentService } from '@metad/ocap-angular/wasm-agent'
import {
  ISlicer,
  Indicator,
  IndicatorType,
  Syntax,
  getEntityDimensions,
  getEntityMeasures,
  isEntityType,
  isSemanticCalendar
} from '@metad/ocap-core'
import { TranslateModule, TranslateService } from '@ngx-translate/core'
import { ISemanticModel, ITag, registerModel } from 'apps/cloud/src/app/@core'
import { MaterialModule, TagEditorComponent } from 'apps/cloud/src/app/@shared'
import { NGXLogger } from 'ngx-logger'
import {
  BehaviorSubject,
  EMPTY,
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  shareReplay,
  startWith,
  switchMap,
  tap
} from 'rxjs'
import { CalculatedMeasureComponent } from '@metad/components/property'
import { INDICATOR_AGGREGATORS } from '../../../indicator/types'
import { injectFetchModelDetails } from '../../types'


@Component({
  standalone: true,
  selector: 'pac-indicator-register-form',
  templateUrl: 'register-form.component.html',
  styleUrls: ['register-form.component.scss'],
  imports: [
    CommonModule,
    MaterialModule,
    TranslateModule,
    FormsModule,
    ReactiveFormsModule,
    NgmMatSelectComponent,
    NgmTreeSelectComponent,
    TagEditorComponent,
    NgmHierarchySelectComponent,
    NxSelectionModule,
    IsNilPipe,
    CalculatedMeasureComponent
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      multi: true,
      useExisting: forwardRef(() => IndicatorRegisterFormComponent)
    }
  ]
})
export class IndicatorRegisterFormComponent implements OnChanges, ControlValueAccessor {
  IndicatorType = IndicatorType
  Syntax = Syntax
  SlicersCapacity = SlicersCapacity
  AGGREGATORS = INDICATOR_AGGREGATORS
  appearance: MatFormFieldAppearance = 'fill'

  readonly businessAreasStore = inject(BusinessAreasService)
  readonly dsCoreService = inject(NgmDSCoreService)
  readonly wasmAgent = inject(WasmAgentService)
  readonly fetchModelDetails = injectFetchModelDetails()
  readonly #logger = inject(NGXLogger)
  readonly #translate = inject(TranslateService)

  @Input() certifications: ISelectOption[]
  @Input() models: ISemanticModel[]

  modelsOptions: ISelectOption[]

  formGroup = new FormGroup({
    id: new FormControl<string>(null),
    name: new FormControl<string>(null, [Validators.required]),
    code: new FormControl<string>(null, [Validators.required]),
    isActive: new FormControl<boolean>(true),
    isApplication: new FormControl<boolean>(false),
    visible: new FormControl<boolean>(true),
    businessAreaId: new FormControl<string>(null),
    certificationId: new FormControl<string>(null),
    createdByName: new FormControl<string>('Me'),
    principal: new FormControl<string>(null),
    unit: new FormControl<string>(null),
    validity: new FormControl<string>(null),
    business: new FormControl<string>(null),
    modelId: new FormControl<string>(null),
    entity: new FormControl<string>(null),
    type: new FormControl<IndicatorType>(IndicatorType.BASIC),
    measure: new FormControl<string>(null),
    formula: new FormControl<string>(null),
    aggregator: new FormControl<string>(null),
    calendar: new FormControl<string>(null),
    dimensions: new FormControl<string[]>(null),
    filters: new FormControl<ISlicer[]>(null),

    tags: new FormControl<ITag[]>([])
  })

  get id() {
    return this.formGroup.get('id').value
  }
  get code() {
    return this.formGroup.get('code').value
  }
  get name() {
    return this.formGroup.get('name').value
  }
  get group() {
    return this.formGroup.get('group').value
  }
  get entity() {
    return this.formGroup.get('entity') as FormControl
  }
  get typeControl() {
    return this.formGroup.get('type')
  }
  get formula() {
    return this.formGroup.get('formula').value
  }
  set formula(value: string) {
    this.formGroup.patchValue({
      formula: value
    })
  }

  get isDirty() {
    return this.formGroup.dirty
  }

  // states
  private readonly dataSourceName$ = new BehaviorSubject<string>(null)

  private readonly dataSource$ = this.dataSourceName$.pipe(
    distinctUntilChanged(),
    filter(nonNullable),
    switchMap((modelName) => this.dsCoreService.getDataSource(modelName))
  )
  public readonly entitiesLoading$ = new BehaviorSubject<boolean>(false)
  public readonly entities$ = this.dataSource$.pipe(
    switchMap((dataSource) => {
      this.entitiesLoading$.next(true)
      return dataSource.discoverMDCubes().pipe(
        map((entities) => entities.map((item) => ({ value: item.name, label: item.caption }))),
        catchError((error) => {
          console.error(error)
          this.entitiesLoading$.next(false)
          return EMPTY
        }),
        tap(() => this.entitiesLoading$.next(false))
      )
    })
  )

  public readonly groupTree$ = this.businessAreasStore.getMyAreasTree().pipe(startWith([]))

  private readonly entitySet$ = this.entity.valueChanges.pipe(distinctUntilChanged(), filter(nonBlank))
  public readonly dataSettings$ = combineLatest([this.dataSourceName$, this.entitySet$]).pipe(
    map(([dataSource, entitySet]) => ({
      dataSource,
      entitySet
    })),
    takeUntilDestroyed(),
    shareReplay(1)
  )
  public readonly entityTypeLoading$ = new BehaviorSubject<boolean>(false)
  public readonly entityType$ = this.dataSettings$.pipe(
    tap(() => this.entityTypeLoading$.next(true)),
    switchMap(({ dataSource, entitySet }) =>
      this.dsCoreService
        .getDataSource(dataSource)
        .pipe(switchMap((dataSource) => dataSource.selectEntityType(entitySet)))
    ),
    tap(() => this.entityTypeLoading$.next(false)),
    filter(isEntityType),
    takeUntilDestroyed(),
    shareReplay(1)
  )
  public readonly measures$ = this.entityType$.pipe(
    map(getEntityMeasures),
    map((items) => items.map((item) => ({ value: item.name, label: item.caption })))
  )
  public readonly dimensions$ = this.entityType$.pipe(
    map(getEntityDimensions),
    map((items) => items.map((item) => ({ value: item.name, label: item.caption })))
  )
  public readonly calendars$ = this.entityType$.pipe(
    map(getEntityDimensions),
    map((items) => items.filter((property) => isSemanticCalendar(property)))
  )
  public readonly syntax$ = this.entityType$.pipe(map((entityType) => entityType?.syntax))

  _onChange: any
  _onTouched: any

  /**
  |--------------------------------------------------------------------------
  | Signals
  |--------------------------------------------------------------------------
  */
  readonly dataSettings = toSignal(this.dataSettings$)
  readonly entityType = toSignal(this.entityType$)
  readonly showFormula = signal(false)
  readonly semanticModel = toSignal(this.formGroup.get('modelId').valueChanges.pipe(
    startWith(this.formGroup.get('modelId').value),
    distinctUntilChanged(),
    filter(nonBlank),
    switchMap((id) => this.fetchModelDetails(id)),
  ))
  readonly indicator = toSignal(this.formGroup.valueChanges.pipe(startWith(this.formGroup.value)))


  /**
  |--------------------------------------------------------------------------
  | Copilot Commands
  |--------------------------------------------------------------------------
  */
  #formula = injectCopilotCommand({
    name: 'formula',
    description: this.#translate.instant('PAC.INDICATOR.Copilot_CreateFormula', {Default: 'Create a formula for the indicator'}),
    systemPrompt: () => {
      let prompt = `你是一名 BI 指标体系管理的业务专家，你现在需要根据用户需求用 Multidimensional Expressions (MDX) 创建指标公式。`
      if (this.entityType()) {
        prompt += `当前选择的 Cube 信息为:
\`\`\`
${calcEntityTypePrompt(this.entityType())}
\`\`\`
`
      }
      return prompt
    },
    actions: [
      injectMakeCopilotActionable({
        name: 'new_formula',
        description: 'Create a new formula for the indicator',
        argumentAnnotations: [
          {
            name: 'formula',
            type: 'string',
            description: 'Provide the new formula',
            required: true
          },
          {
            name: 'unit',
            type: 'string',
            description: 'unit of the formula',
            required: true
          }
        ],
        implementation: async (formula: string, unit: string) => {
          this.#logger.debug(`Copilot command 'formula' params: formula is`, formula, `unit is`, unit)

          this.formGroup.patchValue({
            formula,
            unit,
            type: IndicatorType.DERIVE
          })

          return `✅`
        }
      })
    ]
  })

  /**
  |--------------------------------------------------------------------------
  | Subscriptions (effect)
  |--------------------------------------------------------------------------
  */
  #valueSub = this.formGroup.valueChanges.pipe(
    debounceTime(500),
    takeUntilDestroyed()
  ).subscribe((value) => this._onChange?.(value))

  constructor() {
    effect(() => {
      const indicator = this.indicator()
      const semanticModel = this.semanticModel()
      if (semanticModel && indicator) {
        // 指标公式编辑时需要用到现有 Indicators
        // const dataSource = registerModel(omit(storyModel, 'indicators'), this.dsCoreService, this.wasmAgent)
        const indicators = [...semanticModel.indicators]
        const index = indicators.findIndex((item) => item.id === indicator.id)
        if (index >= 0) {
          indicators.splice(index, 1, indicator as Indicator)
        } else {
          indicators.push(indicator as Indicator)
        }
        const dataSource = registerModel(
          {
            ...semanticModel,
            indicators
            // name: semanticModel.key || semanticModel.name, // xmla 中的 CATALOG_NAME 仍然在使用 model name 属性值， 所示改成 data source name 改成 key 之前需要先修改 CATALOG_NAME 的取值逻辑
          } as NgmSemanticModel,
          this.dsCoreService,
          this.wasmAgent
        )
        this.dataSourceName$.next(dataSource.key)
      }
    }, { allowSignalWrites: true })
  }

  ngOnChanges({ models }: SimpleChanges): void {
    if (models) {
      this.modelsOptions = models.currentValue?.map((item) => ({ value: item.id, label: item.name }))
    }
  }

  writeValue(obj: any): void {
    if (obj) {
      this.formGroup.patchValue(obj)
    }
  }
  registerOnChange(fn: any): void {
    this._onChange = fn
  }
  registerOnTouched(fn: any): void {
    this._onTouched = fn
  }
  setDisabledState?(isDisabled: boolean): void {
    isDisabled ? this.formGroup.disable() : this.formGroup.enable()
    // Disable createdby user as readonly whatever
    this.formGroup.get('createdByName').disable()
  }

  toggleFormula() {
    this.showFormula.update((state) => !state)
  }

}
