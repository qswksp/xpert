import { CommonModule } from '@angular/common'
import { Component, forwardRef, inject, signal } from '@angular/core'
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop'
import { ControlValueAccessor, FormGroup, FormsModule, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms'
import { nonNullable } from '@metad/core'
import { cloneDeep } from '@metad/ocap-core'
import { FormlyModule } from '@ngx-formly/core'
import { TranslateModule } from '@ngx-translate/core'
import { isEqual } from 'lodash-es'
import { NGXLogger } from 'ngx-logger'
import { filter, isObservable, of } from 'rxjs'
import { DesignerSchema, STORY_DESIGNER_FORM, STORY_DESIGNER_SCHEMA } from '../types'

/**
 * Designer form component
 * Two ways to bind model value:
 * 1. Through STORY_DESIGNER_FORM to bind model value
 * 2. Through ControlValueAccessor to bind model value
 * 
 * Both ways are build formly form through STORY_DESIGNER_SCHEMA
 */
@Component({
  standalone: true,
  selector: 'ngm-designer-form',
  templateUrl: 'designer-form.component.html',
  styleUrls: ['designer-form.component.scss'],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, FormlyModule, TranslateModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      multi: true,
      useExisting: forwardRef(() => NgmDesignerFormComponent)
    }
  ]
})
export class NgmDesignerFormComponent implements ControlValueAccessor {
  readonly #logger = inject(NGXLogger)
  private schema: DesignerSchema = inject(STORY_DESIGNER_SCHEMA)
  readonly #settingsComponent? = inject(STORY_DESIGNER_FORM, { optional: true })

  formGroup = new FormGroup({})
  model = {}
  options = {}

  readonly initial = signal(true)
  readonly isEmpty = signal(false)

  public readonly fields = toSignal(this.schema.getSchema())

  private modelSub = (isObservable(this.#settingsComponent?.model)
    ? this.#settingsComponent.model
    : of(this.#settingsComponent?.model)
  )
    .pipe(
      filter((model) => this.initial() || !isEqual(model, this.model)),
      takeUntilDestroyed()
    )
    .subscribe((model) => {
      // if (!nonNullable(model?.modeling) && !this.initial()) {
      if (!nonNullable(model) && !this.initial()) {
        this.isEmpty.set(true)
      } else {
        this.initial.set(false)
        // this.model = cloneDeep(model)
        this.schema.model = model
      }
    })

  onChange: (input: any) => void
  onTouched: () => void

  writeValue(obj: any): void {
    if (obj) {
      this.formGroup.patchValue(obj)
      this.model = cloneDeep(obj)
    }
  }
  registerOnChange(fn: any): void {
    this.onChange = fn
  }
  registerOnTouched(fn: any): void {
    this.onTouched = fn
  }
  setDisabledState?(isDisabled: boolean): void {
    isDisabled ? this.formGroup.disable() : this.formGroup.enable()
  }

  onModelChange(event) {
    this.#logger.log(`onModelChange`, event)
    this.onSubmit(event)
  }

  /**
   * Submit the form value back
   * @param value
   */
  onSubmit(value?: unknown) {
    const newValue = value ?? this.model
    this.#settingsComponent?.submit.next(newValue)
    this.onChange?.(newValue)
  }
}
