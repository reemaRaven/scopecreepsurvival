import { track } from '@vercel/analytics'

const REFERRER_MAP: Record<string, string> = {
  'linkedin.com':   'LinkedIn',
  'instagram.com':  'Instagram',
  'l.instagram.com':'Instagram',
  'facebook.com':   'Facebook',
  'fb.com':         'Facebook',
  'm.facebook.com': 'Facebook',
  'reddit.com':     'Reddit',
  'old.reddit.com': 'Reddit',
  'youtube.com':    'YouTube',
  'youtu.be':       'YouTube',
  'discord.com':    'Discord',
  'discord.gg':     'Discord',
  'whatsapp.com':   'WhatsApp',
  'twitter.com':    'Twitter',
  't.co':           'Twitter',
  'x.com':          'Twitter',
}

function getSource(): string {
  const params = new URLSearchParams(window.location.search)
  const utm = params.get('utm_source')
  if (utm) return utm.charAt(0).toUpperCase() + utm.slice(1).toLowerCase()

  const ref = document.referrer
  if (!ref) return 'Direct'

  try {
    const host = new URL(ref).hostname.replace(/^www\./, '')
    for (const [key, name] of Object.entries(REFERRER_MAP)) {
      if (host === key || host.endsWith('.' + key)) return name
    }
    return host
  } catch {
    return 'Direct'
  }
}

export function trackPageVisit(page: string): void {
  const source = getSource()
  const params = new URLSearchParams(window.location.search)

  track('page_visit', {
    page,
    source,
    utm_source:   params.get('utm_source')   ?? '',
    utm_medium:   params.get('utm_medium')   ?? '',
    utm_campaign: params.get('utm_campaign') ?? '',
  })
}
