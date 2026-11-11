import { describe, expect, it } from 'vitest'

import {
  notificationSettingsToBrowser,
  notificationSettingsToUniserver,
} from './notificationAdapter'

describe('alert notification adapter', () => {
  it('does not send non-alert notification fields to uniserver', () => {
    const result = notificationSettingsToUniserver({
      email: {
        enabled: true,
        smtp_host: 'smtp.example.com',
        default_recipients: ['ops@example.com'],
      },
      enable_alerts: true,
      enable_backups: false,
      enable_migrations: false,
      enable_replication: false,
      category_min_severity: { alert: 'critical', backup: 'info' },
    })

    expect(result).toMatchObject({
      smtp_host: 'smtp.example.com',
      recipients: ['ops@example.com'],
      enabled: true,
      min_severity: 'critical',
    })
    expect(result).not.toHaveProperty('enable_backups')
    expect(result).not.toHaveProperty('enable_migrations')
    expect(result).not.toHaveProperty('enable_replication')
    expect(result).not.toHaveProperty('category_min_severity')
  })

  it('never places an SMTP password in the browser response', () => {
    const result = notificationSettingsToBrowser({
      enabled: true,
      smtp_host: 'smtp.example.com',
      recipients: [],
      password_configured: true,
    })

    expect(result.email.smtp_password).toBe('')
    expect(result.email.password_configured).toBe(true)
  })

  it('maps the shared success threshold to the next alert severity', () => {
    expect(notificationSettingsToUniserver({ min_severity: 'success' })).toMatchObject({
      min_severity: 'warning',
    })
  })

  it('disables alert mail when either alert or SMTP mail is disabled', () => {
    expect(notificationSettingsToUniserver({
      email: { enabled: false },
      enable_alerts: true,
    })).toMatchObject({ enabled: false })
    expect(notificationSettingsToUniserver({
      email: { enabled: true },
      enable_alerts: false,
    })).toMatchObject({ enabled: false })
  })
})
