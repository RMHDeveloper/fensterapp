import type { ComponentType } from 'react'
import type { LucideProps } from 'lucide-react'
import {
  Home, CalendarCheck, FolderOpen, Layers, Wallet,
  BarChart2, Settings, Users, MapPin, FileText,
  Wrench, AlertTriangle, CheckSquare, File,
  LayoutDashboard, ClipboardCheck, Circle,
} from 'lucide-react'
import type { Permission } from '../../types'

export interface NavItem {
  icon: ComponentType<LucideProps>
  label: string
  path: string
  permission: Permission
}

export function getMainItems(isOwner: boolean): NavItem[] {
  if (isOwner) {
    return [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', permission: 'view_home'     },
      { icon: FolderOpen,      label: 'Projects',  path: '/projects',  permission: 'view_projects' },
    ]
  }
  return [
    { icon: Home,          label: 'Task',       path: '/home',     permission: 'view_home'     },
    { icon: CalendarCheck, label: 'Today Work', path: '/tasks',    permission: 'view_today'    },
    { icon: FolderOpen,    label: 'Projects',   path: '/projects', permission: 'view_projects' },
  ]
}

export const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: '',
    items: [
      { icon: Users,          label: 'Leads',        path: '/leads',        permission: 'view_leads'       },
      { icon: MapPin,         label: 'Site Visits',  path: '/site-visits',  permission: 'view_site_visit'  },
      { icon: FileText,       label: 'Quotations',   path: '/quotations',   permission: 'view_quotation'   },
      { icon: File,           label: 'Orders',       path: '/orders',       permission: 'view_orders'      },
      { icon: Layers,         label: 'Production',   path: '/production',   permission: 'view_production'  },
      { icon: CheckSquare,    label: 'Delivery QC',  path: '/delivery-qc',  permission: 'view_delivery_qc' },
      { icon: ClipboardCheck, label: 'Approvals',    path: '/approvals',    permission: 'approve_work'     },
      { icon: AlertTriangle,  label: 'Problems',     path: '/mistakes',     permission: 'view_mistakes'    },
      { icon: Wallet,         label: 'Payments',     path: '/payments',     permission: 'view_payments'    },
      { icon: Wrench,         label: 'Installation', path: '/installation', permission: 'view_installation'},
      { icon: File,           label: 'Files',        path: '/files',        permission: 'view_files'       },
    ],
  },
  {
    label: 'Lead Sort',
    items: [
      { icon: Circle, label: 'Active',      path: '/leads?filter=active',      permission: 'view_leads' },
      { icon: Circle, label: 'Contacted',   path: '/leads?filter=contact',     permission: 'view_leads' },
      { icon: Circle, label: 'Measurement', path: '/leads?filter=measurement', permission: 'view_leads' },
      { icon: Circle, label: 'Quotation',   path: '/leads?filter=quotation',   permission: 'view_leads' },
      { icon: Circle, label: 'Negotiation', path: '/leads?filter=negotiation', permission: 'view_leads' },
      { icon: Circle, label: 'Won',         path: '/leads?filter=won',         permission: 'view_leads' },
      { icon: Circle, label: 'Lost',        path: '/leads?filter=lost',        permission: 'view_leads' },
    ],
  },
  {
    label: 'Project Sort',
    items: [
      { icon: Circle, label: 'Active',            path: '/projects?filter=active',            permission: 'view_projects' },
      { icon: Circle, label: 'Pre-Production',     path: '/projects?filter=pre_production',     permission: 'view_projects' },
      { icon: Circle, label: 'Production',         path: '/projects?filter=production',         permission: 'view_projects' },
      { icon: Circle, label: 'Ready to Dispatch',  path: '/projects?filter=ready_to_dispatch',  permission: 'view_projects' },
      { icon: Circle, label: 'Installation',       path: '/projects?filter=installation',       permission: 'view_projects' },
      { icon: Circle, label: 'Collection',         path: '/projects?filter=collection',         permission: 'view_projects' },
      { icon: Circle, label: 'Complete',           path: '/projects?filter=completed',          permission: 'view_projects' },
    ],
  },
  {
    label: 'Reporting',
    items: [
      { icon: BarChart2, label: 'Reports',  path: '/reports',  permission: 'view_reports'  },
      { icon: Settings,  label: 'Settings', path: '/settings', permission: 'view_settings' },
    ],
  },
]
