import { Component, effect, inject } from '@angular/core'
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { ActivatedRoute } from '@angular/router'
import { IOrganization } from '@metad/contracts'
import { nonBlank } from '@metad/core'
import { TranslateService } from '@ngx-translate/core'
import { MaterialModule, OrgAvatarComponent, OrgAvatarEditorComponent, SharedModule } from 'apps/cloud/src/app/@shared'
import { distinctUntilChanged, filter, map, switchMap } from 'rxjs/operators'
import { OrganizationsService, Store } from '../../../../@core'
import { OrganizationsComponent } from '../organizations.component'
import { EditOrganizationSettingsModule } from './edit-organization-settings/edit-organization-settings.module'
import { OrganizationDemoComponent } from '../organization-demo/organization-demo.component'


@Component({
  standalone: true,
  templateUrl: './edit-organization.component.html',
  styleUrls: ['./edit-organization.component.scss'],
  imports: [
    SharedModule,
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
    OrgAvatarEditorComponent,
    OrgAvatarComponent,
    EditOrganizationSettingsModule,
    OrganizationDemoComponent
  ]
})
export class EditOrganizationComponent {
  private readonly organizationsComponent = inject(OrganizationsComponent)

  public readonly organization = toSignal(
    this.route.params.pipe(
      map((params) => params.id),
      distinctUntilChanged(),
      filter(nonBlank),
      switchMap((id) => this.organizationsService.getById(id, null, ['tags']))
    )
  )

  selectedOrg: IOrganization
  selectedOrgFromHeader: IOrganization
  employeesCount: number
  params: any

  private orgSub = this.store.selectedOrganization$
    .pipe(
      filter((organization) => !!organization),
      takeUntilDestroyed()
    )
    .subscribe((organization) => {
      this.setSelectedOrg(organization)
    })
    
  constructor(
    private route: ActivatedRoute,
    private organizationsService: OrganizationsService,
    private store: Store,
    readonly translateService: TranslateService
  ) {
    effect(() => {
      if (this.organization()) {
        this.setSelectedOrg(this.organization())
      }
    }, { allowSignalWrites: true })
  }

  setSelectedOrg(selectedOrg: IOrganization) {
    this.store.selectedEmployee = null
    this.selectedOrg = selectedOrg
    this.store.selectedOrganization = this.selectedOrg
    this.store.organizationId = this.selectedOrg.id
    this.selectedOrgFromHeader = this.selectedOrg

    this.organizationsComponent.setCurrentLink(this.selectedOrg)
  }
}
