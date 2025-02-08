import { Clipboard } from '@angular/cdk/clipboard'
import { CdkMenuModule } from '@angular/cdk/menu'
import { Overlay, OverlayRef } from '@angular/cdk/overlay'
import { TemplatePortal } from '@angular/cdk/portal'
import { CommonModule } from '@angular/common'
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  HostListener,
  inject,
  input,
  model,
  numberAttribute,
  output,
  signal,
  TemplateRef,
  ViewChild,
  ViewContainerRef
} from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatDialog } from '@angular/material/dialog'
import { MatTooltipModule } from '@angular/material/tooltip'
import { NgmHighlightVarDirective } from '@metad/ocap-angular/common'
import { TranslateModule } from '@ngx-translate/core'
import { effectAction, NgmI18nPipe } from '@metad/ocap-angular/core'
import { CopilotPromptGeneratorComponent } from '../prompt-generator/generator.component'
import { agentLabel, TStateVariable, TWorkflowVarGroup } from '../../../@core'
import { switchMap, tap } from 'rxjs/operators'
import { timer } from 'rxjs'

@Component({
  selector: 'copilot-prompt-editor',
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CdkMenuModule, FormsModule, TranslateModule, MatTooltipModule, NgmI18nPipe, NgmHighlightVarDirective],
  host: {
    '[class.fullscreen]': 'fullscreen()'
  }
})
export class CopilotPromptEditorComponent {
  agentLabel = agentLabel
  
  readonly #clipboard = inject(Clipboard)
  readonly #dialog = inject(MatDialog)
  readonly #vcr = inject(ViewContainerRef)
  readonly elementRef = inject(ElementRef)

  readonly regex = `{{(.*?)}}`

  // Inputs
  readonly prompt = model<string>()
  readonly initHeight = input<number, number | string>(210, {
    transform: numberAttribute
  })
  readonly tooltip = input<string>()
  readonly variables = input<TWorkflowVarGroup[]>()
  readonly role = input<'system' | 'ai' | 'human'>()
  readonly fullscreen = input<boolean, string | boolean>(false, {
    transform: booleanAttribute
  })

  // Outputs
  readonly deleted = output<void>()

  // Children
  @ViewChild('editablePrompt', { static: true }) editablePrompt!: ElementRef
  @ViewChild('suggestionsTemplate', { static: true }) suggestionsTemplate!: TemplateRef<any>
  overlayRef: OverlayRef | null = null

  // States
  readonly promptLength = computed(() => this.prompt()?.length)

  height = this.initHeight()
  private isResizing = false
  private startY = 0
  private startHeight = 0
  readonly copied = signal(false)

  constructor(private overlay: Overlay) {
    effect(() => {
      if (this.initHeight()) {
        this.height = this.initHeight()
      }
    })
  }

  generate() {
    this.#dialog
      .open(CopilotPromptGeneratorComponent, {
        panelClass: 'large'
      })
      .afterClosed()
      .subscribe({
        next: (result) => {
          if (result) {
            this.prompt.set(result)
          }
        }
      })
  }

  onPromptChange(editor: HTMLDivElement) {
    this.prompt.set(formatInnerHTML(editor.innerHTML))
  }

  onKeyup(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      return this.hideSuggestions()
    }

    const inputText = (event.target as HTMLElement).innerText
    const regex = /{{(?=\s+\S*)|{{$/

    if (regex.test(inputText)) {
      this.showSuggestions()
    } else {
      this.hideSuggestions()
    }
  }

  selectVariable(g: string, variable: TStateVariable) {
    const editablePrompt: HTMLDivElement = this.editablePrompt.nativeElement
    const text = editablePrompt.innerText
    const regex = /{{(?=\s+\S*)|{{$/
    const updatedText = text.replace(regex, g ? `{{${g}.${variable.name}}}` : `{{${variable.name}}}`)
    editablePrompt.innerText = updatedText
    this.hideSuggestions()

    // focus the edit div and insert cursor in end
    editablePrompt.focus()
    const range = document.createRange()
    const selection = window.getSelection()
    range.selectNodeContents(editablePrompt)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
  }

  getCaretCoordinates(): { top: number; left: number } {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0).cloneRange()
      const rect = range.getClientRects()[0]
      if (rect) {
        return { top: rect.top, left: rect.left }
      }
    }
    return { top: 0, left: 0 }
  }

  showSuggestions() {
    if (!this.variables()?.length) {
      return
    }
    const caretCoords = this.getCaretCoordinates()
    const positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo(caretCoords.left ? { x: caretCoords.left, y: caretCoords.top } : this.editablePrompt.nativeElement)
      .withPositions([{ originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom' }])

    if (!this.overlayRef) {
      this.overlayRef = this.overlay.create({ positionStrategy })
      const portal = new TemplatePortal(this.suggestionsTemplate, this.#vcr)
      this.overlayRef.attach(portal)
    } else {
      this.overlayRef.updatePositionStrategy(positionStrategy)
    }
  }

  hideSuggestions() {
    if (this.overlayRef) {
      this.overlayRef.detach()
      this.overlayRef = null
    }
  }

  remove() {
    this.prompt.set(null)
    this.deleted.emit()
  }

  copy = effectAction((origin$) => origin$.pipe(
      tap(() => {
        this.#clipboard.copy(this.prompt())
        this.copied.set(true)
      }),
      switchMap(() => timer(3000)),
      tap(() => this.copied.set(false))
    ))

  onMouseDown(event: MouseEvent): void {
    this.isResizing = true
    this.startY = event.clientY
    this.startHeight = this.height
    event.preventDefault()
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (this.isResizing) {
      const offset = event.clientY - this.startY
      this.height = this.startHeight + offset
      if (this.height < 50) this.height = 50 // 设置最小高度
      event.preventDefault()
    }
  }

  @HostListener('document:mouseup')
  onMouseUp(): void {
    this.isResizing = false
  }
}

function formatInnerHTML(htmlContent: string) {
  // Step 1: 处理段落 <p> 标签并替换为换行符
  let formattedText = htmlContent
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n') // 替换段落间的换行
    .replace(/<div><br\s*\/?><\/div>/gi, '\n') // 替换 <br> 标签为换行
    .replace(/<br\s*\/?>/gi, '\n') // 替换 <br> 标签为换行
    .replace(/<\/?p[^>]*>/gi, '') // 移除 <p> 标签
    .replace(/<\/?span[^>]*>/gi, '') // 移除 <span> 标签
    .replace(/<mark[^>]*>(.*?)<\/mark>/gi, '$1') // 保留 <mark> 内的内容
    .replace(/<\/div><div>/gi, '\n') // 将 </div><div> 替换成换行符
    .replace(/<\/div>/gi, '\n') // 将 </div> 替换成换行符

  formattedText = formattedText.replace(/\n<div[^>]*>/gi, '\n')
    .replace(/<div[^>]*>/gi, '\n')

  return formattedText.trimEnd()
}
