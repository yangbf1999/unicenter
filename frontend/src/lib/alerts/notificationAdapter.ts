type RecordValue = Record<string, any>

function alertMinimumSeverity(value: unknown): unknown {
  return value === 'success' ? 'warning' : value
}

function alertNotificationsEnabled(alertEnabled: unknown, emailEnabled: unknown): unknown {
  if (alertEnabled === undefined) return emailEnabled
  if (emailEnabled === undefined) return alertEnabled
  return Boolean(alertEnabled) && Boolean(emailEnabled)
}

export function notificationSettingsToBrowser(settings: RecordValue): RecordValue {
  return {
    email: {
      enabled: settings.enabled,
      smtp_host: settings.smtp_host,
      smtp_port: settings.smtp_port,
      smtp_user: settings.smtp_user,
      smtp_password: '',
      smtp_from: settings.smtp_from,
      smtp_from_name: settings.smtp_from_name,
      use_starttls: settings.starttls,
      use_tls: settings.direct_tls,
      skip_verify: settings.skip_verify,
      default_recipients: settings.recipients || [],
      password_configured: settings.password_configured,
    },
    enable_alerts: settings.enabled,
    min_severity: settings.min_severity,
    category_min_severity: { alert: settings.min_severity },
    rate_limit_per_hour: settings.rate_limit_per_hour,
    notify_on_recovery: settings.notify_on_recovery,
  }
}

export function notificationSettingsToUniserver(body: RecordValue): RecordValue {
  const email = body?.email && typeof body.email === 'object' ? body.email : {}
  return {
    smtp_host: email.smtp_host,
    smtp_port: email.smtp_port,
    smtp_user: email.smtp_user,
    smtp_password: email.smtp_password,
    smtp_from: email.smtp_from,
    smtp_from_name: email.smtp_from_name,
    starttls: email.use_starttls,
    direct_tls: email.use_tls,
    skip_verify: email.skip_verify,
    recipients: email.default_recipients,
    enabled: alertNotificationsEnabled(body.enable_alerts, email.enabled),
    min_severity: alertMinimumSeverity(
      body.category_min_severity?.alert ?? body.min_severity,
    ),
    rate_limit_per_hour: body.rate_limit_per_hour,
    notify_on_recovery: body.notify_on_recovery,
  }
}

export function smtpConfigToUniserver(email: RecordValue | undefined): RecordValue | undefined {
  if (!email || typeof email !== 'object') return undefined
  return {
    smtp_host: email.smtp_host,
    smtp_port: email.smtp_port,
    smtp_user: email.smtp_user,
    smtp_password: email.smtp_password,
    smtp_from: email.smtp_from,
    smtp_from_name: email.smtp_from_name,
    starttls: email.use_starttls,
    direct_tls: email.use_tls,
    skip_verify: email.skip_verify,
    recipients: email.default_recipients,
  }
}
