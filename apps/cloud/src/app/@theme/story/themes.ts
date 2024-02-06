import { ElementRef, Renderer2 } from '@angular/core'
import { isEqual } from '@metad/ocap-core'
import { NxCoreService } from '@metad/core'
import { NxStoryService } from '@metad/story/core'
import { registerTheme } from 'echarts/core'
import { firstValueFrom } from 'rxjs'
import { delay, distinctUntilChanged, filter } from 'rxjs/operators'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'

export function registerStoryThemes(storyService: NxStoryService) {
  return storyService.echartsTheme$
    .pipe(filter(Boolean), distinctUntilChanged(isEqual), takeUntilDestroyed())
    .subscribe(async (echartsTheme) => {
      const story = await firstValueFrom(storyService.story$)
      const key = story.key || story.id
      ;['light', 'dark', 'thin'].forEach((theme) => {
        if (echartsTheme?.[theme]) {
          registerTheme(`${theme}-${key}`, echartsTheme[theme])
        }
      })
    })
}

export function subscribeStoryTheme(storyService: NxStoryService, coreService: NxCoreService, renderer: Renderer2, elementRef: ElementRef) {
  return storyService.themeChanging$.pipe(delay(300), takeUntilDestroyed()).subscribe(async ([prev, current]) => {
    const story = await firstValueFrom(storyService.story$)
    const key = story.key || story.id
    const echartsTheme = story.options?.echartsTheme

    if (prev === 'light' || !prev) {
      renderer.removeClass(elementRef.nativeElement, 'ngm-theme-default')
    }
    if (prev) {
      renderer.removeClass(elementRef.nativeElement, 'ngm-theme-' + prev)
      renderer.removeClass(elementRef.nativeElement, prev)
    }
    if (current) {
      renderer.addClass(elementRef.nativeElement, 'ngm-theme-' + current)
      renderer.addClass(elementRef.nativeElement, current)
      if (echartsTheme?.[current]) {
        coreService.changeTheme(`${current}-${key}`)
      } else {
        coreService.changeTheme(current)
      }
    }
  })
}