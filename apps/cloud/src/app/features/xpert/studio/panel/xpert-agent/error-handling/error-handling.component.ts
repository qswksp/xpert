import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { TranslateModule } from '@ngx-translate/core'
import { MatTooltipModule } from '@angular/material/tooltip'
import { CommonModule } from '@angular/common'
import { NgxControlValueAccessor } from 'ngxtension/control-value-accessor'
import { CdkMenuModule } from '@angular/cdk/menu'
import { TXpertAgentOptions } from '@metad/contracts'
import { NgmI18nPipe, TSelectOption } from '@metad/ocap-angular/core'
import { FormsModule } from '@angular/forms'
import { injectHelpWebsite } from 'apps/cloud/src/app/@core'


@Component({
  selector: 'xpert-error-handling',
  templateUrl: './error-handling.component.html',
  styleUrls: ['./error-handling.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, CdkMenuModule, TranslateModule, MatTooltipModule, NgmI18nPipe],
  hostDirectives: [NgxControlValueAccessor]
})
export class XpertErrorHandlingComponent {
  readonly helpWebsite = injectHelpWebsite()
  protected cva = inject<NgxControlValueAccessor<TXpertAgentOptions['errorHandling']>>(NgxControlValueAccessor)

  readonly value$ = this.cva.value$

  readonly type = computed(() => this.value$()?.type)
  readonly defaultValue = computed(() => this.value$()?.defaultValue)
  readonly selectedOption = computed(() => {
    return this.typeOptions.find((_) => _.value === this.type()) ?? this.typeOptions[0]
  })

  readonly expand = signal(false)

  readonly typeOptions: TSelectOption<TXpertAgentOptions['errorHandling']['type']>[] = [
    {
      value: null,
      label: {
        zh_Hans: '无',
        en_US: 'None'
      },
      description: {
        zh_Hans: '当发生异常且未处理时，节点将直接抛错',
        en_US: 'The agent will throw error if an exception occurs and is not handled'
      }
    },
    {
      value: 'defaultValue',
      label: {
        zh_Hans: '默认值',
        en_US: 'Default Value'
      },
      description: {
        zh_Hans: '当发生异常时，指定默认输出内容',
        en_US: 'When an error occurs, specify a default output content'
      }
    },
    {
      value: 'failBranch',
      label: {
        zh_Hans: '失败分支',
        en_US: 'Fail Branch'
      },
      description: {
        zh_Hans: '当发生异常时，将路由到异常分支',
        en_US: 'When an error occurs, it will route to the exception branch'
      }
    }
  ]

  toggle() {
    this.expand.update((state) => !state)
  }

  setType(type: TXpertAgentOptions['errorHandling']['type']) {
    this.value$.update((state) => ({
      ...(state ?? {}),
      type
    }))
  }

  updateDefaultValue(value: string) {
    this.value$.update((state) => ({
      ...(state ?? {}),
      defaultValue: value
    }))
  }
}
