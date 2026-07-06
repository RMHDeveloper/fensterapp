import { describe, it, expect } from 'vitest'
import { hasPermission, canAccessScreen, canUpdateTask } from '../../utils/permissions'

describe('hasPermission', () => {
  describe('owner', () => {
    it('has full access including approve, delete, profit', () => {
      expect(hasPermission('owner', 'approve_quotation')).toBe(true)
      expect(hasPermission('owner', 'view_profit')).toBe(true)
      expect(hasPermission('owner', 'delete_data')).toBe(true)
      expect(hasPermission('owner', 'manage_users')).toBe(true)
      expect(hasPermission('owner', 'reject_quotation')).toBe(true)
    })
  })

  describe('lead_manager', () => {
    it('can send quotations but not approve them', () => {
      expect(hasPermission('lead_manager', 'send_quotation_for_approval')).toBe(true)
      expect(hasPermission('lead_manager', 'approve_quotation')).toBe(false)
      expect(hasPermission('lead_manager', 'reject_quotation')).toBe(false)
    })

    it('cannot see profit or delete data', () => {
      expect(hasPermission('lead_manager', 'view_profit')).toBe(false)
      expect(hasPermission('lead_manager', 'delete_data')).toBe(false)
    })

    it('can manage leads and payments', () => {
      expect(hasPermission('lead_manager', 'view_leads')).toBe(true)
      expect(hasPermission('lead_manager', 'create_lead')).toBe(true)
      expect(hasPermission('lead_manager', 'view_payments')).toBe(true)
      expect(hasPermission('lead_manager', 'update_payments')).toBe(true)
    })
  })

  describe('site_engineer', () => {
    it('can only access site visit related permissions', () => {
      expect(hasPermission('site_engineer', 'view_site_visit')).toBe(true)
      expect(hasPermission('site_engineer', 'update_site_visit')).toBe(true)
    })

    it('cannot access leads, payments, or quotations', () => {
      expect(hasPermission('site_engineer', 'view_leads')).toBe(false)
      expect(hasPermission('site_engineer', 'view_payments')).toBe(false)
      expect(hasPermission('site_engineer', 'view_quotation')).toBe(false)
      expect(hasPermission('site_engineer', 'view_production')).toBe(false)
    })
  })

  describe('production_admin', () => {
    it('can update production but not QC', () => {
      expect(hasPermission('production_admin', 'view_production')).toBe(true)
      expect(hasPermission('production_admin', 'update_production')).toBe(true)
      expect(hasPermission('production_admin', 'update_qc')).toBe(false)
    })

    it('cannot access leads or payments', () => {
      expect(hasPermission('production_admin', 'view_leads')).toBe(false)
      expect(hasPermission('production_admin', 'view_payments')).toBe(false)
    })
  })

  describe('production_manager', () => {
    it('can do production and QC', () => {
      expect(hasPermission('production_manager', 'view_production')).toBe(true)
      expect(hasPermission('production_manager', 'update_qc')).toBe(true)
      expect(hasPermission('production_manager', 'view_delivery_qc')).toBe(true)
    })

    it('cannot approve quotations or see profit', () => {
      expect(hasPermission('production_manager', 'approve_quotation')).toBe(false)
      expect(hasPermission('production_manager', 'view_profit')).toBe(false)
    })
  })

  describe('technician', () => {
    it('can only do installation', () => {
      expect(hasPermission('technician', 'view_installation')).toBe(true)
      expect(hasPermission('technician', 'update_installation')).toBe(true)
    })

    it('cannot access leads, production, or payments', () => {
      expect(hasPermission('technician', 'view_leads')).toBe(false)
      expect(hasPermission('technician', 'view_production')).toBe(false)
      expect(hasPermission('technician', 'view_payments')).toBe(false)
    })
  })

  describe('viewer', () => {
    it('can only view basic screens', () => {
      expect(hasPermission('viewer', 'view_home')).toBe(true)
      expect(hasPermission('viewer', 'view_quotation')).toBe(true)
    })

    it('cannot create, edit, or delete anything', () => {
      expect(hasPermission('viewer', 'create_lead')).toBe(false)
      expect(hasPermission('viewer', 'delete_data')).toBe(false)
      expect(hasPermission('viewer', 'view_profit')).toBe(false)
      expect(hasPermission('viewer', 'approve_quotation')).toBe(false)
    })
  })

  describe('legacy aliases', () => {
    it('installation_incharge has same permissions as technician', () => {
      expect(hasPermission('installation_incharge', 'view_installation')).toBe(true)
      expect(hasPermission('installation_incharge', 'update_installation')).toBe(true)
      expect(hasPermission('installation_incharge', 'view_leads')).toBe(false)
    })

    it('production_team has same permissions as production_manager', () => {
      expect(hasPermission('production_team', 'view_production')).toBe(true)
      expect(hasPermission('production_team', 'update_qc')).toBe(true)
      expect(hasPermission('production_team', 'view_leads')).toBe(false)
    })
  })

  it('returns false for unknown role', () => {
    // @ts-expect-error intentional invalid role
    expect(hasPermission('unknown_role', 'view_home')).toBe(false)
  })
})

describe('canAccessScreen', () => {
  it('owner can access every screen', () => {
    expect(canAccessScreen('owner', 'leads')).toBe(true)
    expect(canAccessScreen('owner', 'approvals')).toBe(true)
    expect(canAccessScreen('owner', 'payments')).toBe(true)
    expect(canAccessScreen('owner', 'production')).toBe(true)
  })

  it('site_engineer is blocked from leads, payments, production', () => {
    expect(canAccessScreen('site_engineer', 'leads')).toBe(false)
    expect(canAccessScreen('site_engineer', 'payments')).toBe(false)
    expect(canAccessScreen('site_engineer', 'production')).toBe(false)
  })

  it('site_engineer can access site-visits and files', () => {
    expect(canAccessScreen('site_engineer', 'site-visits')).toBe(true)
    expect(canAccessScreen('site_engineer', 'files')).toBe(true)
  })

  it('viewer is blocked from leads', () => {
    expect(canAccessScreen('viewer', 'leads')).toBe(false)
  })

  it('lead_manager is blocked from approvals', () => {
    expect(canAccessScreen('lead_manager', 'approvals')).toBe(false)
  })

  it('technician is blocked from leads and quotations', () => {
    expect(canAccessScreen('technician', 'leads')).toBe(false)
    expect(canAccessScreen('technician', 'quotations')).toBe(false)
  })

  it('technician can access installation', () => {
    expect(canAccessScreen('technician', 'installation')).toBe(true)
  })

  it('returns true for a screen with no permission requirement', () => {
    expect(canAccessScreen('viewer', 'nonexistent_screen')).toBe(true)
  })
})

describe('canUpdateTask', () => {
  it('owner can update any task type', () => {
    expect(canUpdateTask('owner', 'call')).toBe(true)
    expect(canUpdateTask('owner', 'site_visit')).toBe(true)
    expect(canUpdateTask('owner', 'production')).toBe(true)
    expect(canUpdateTask('owner', 'installation')).toBe(true)
  })

  it('lead_manager can update call, payment, delivery, site_visit, production — not installation', () => {
    expect(canUpdateTask('lead_manager', 'call')).toBe(true)
    expect(canUpdateTask('lead_manager', 'payment')).toBe(true)
    expect(canUpdateTask('lead_manager', 'delivery')).toBe(true)
    expect(canUpdateTask('lead_manager', 'site_visit')).toBe(true)
    expect(canUpdateTask('lead_manager', 'production')).toBe(true)
    expect(canUpdateTask('lead_manager', 'installation')).toBe(false)
  })

  it('site_engineer can only update site_visit tasks', () => {
    expect(canUpdateTask('site_engineer', 'site_visit')).toBe(true)
    expect(canUpdateTask('site_engineer', 'installation')).toBe(false)
    expect(canUpdateTask('site_engineer', 'call')).toBe(false)
    expect(canUpdateTask('site_engineer', 'production')).toBe(false)
  })

  it('technician can only update installation tasks', () => {
    expect(canUpdateTask('technician', 'installation')).toBe(true)
    expect(canUpdateTask('technician', 'site_visit')).toBe(false)
    expect(canUpdateTask('technician', 'production')).toBe(false)
  })

  it('installation_incharge can only update installation tasks', () => {
    expect(canUpdateTask('installation_incharge', 'installation')).toBe(true)
    expect(canUpdateTask('installation_incharge', 'site_visit')).toBe(false)
  })

  it('production_admin and production_manager can update production and qc_check', () => {
    expect(canUpdateTask('production_admin', 'production')).toBe(true)
    expect(canUpdateTask('production_admin', 'qc_check')).toBe(true)
    expect(canUpdateTask('production_admin', 'site_visit')).toBe(false)

    expect(canUpdateTask('production_manager', 'production')).toBe(true)
    expect(canUpdateTask('production_manager', 'qc_check')).toBe(true)
  })

  it('viewer cannot update any task', () => {
    expect(canUpdateTask('viewer', 'call')).toBe(false)
    expect(canUpdateTask('viewer', 'site_visit')).toBe(false)
    expect(canUpdateTask('viewer', 'production')).toBe(false)
  })
})
