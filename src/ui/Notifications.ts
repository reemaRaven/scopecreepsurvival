import { addToFeed } from './SidePanel.js'

interface Toast {
  message: string
  type: 'info' | 'success' | 'warning' | 'danger'
  duration?: number
}

const container = (): HTMLElement => document.getElementById('notifications')!

export function showToast({ message, type = 'info', duration = 3000 }: Toast): void {
  // Add to side panel feed
  addToFeed(message)

  // Floating toast
  const el = document.createElement('div')
  el.className = `toast toast-${type}`
  el.textContent = message
  container().appendChild(el)

  requestAnimationFrame(() => el.classList.add('visible'))

  setTimeout(() => {
    el.classList.remove('visible')
    el.classList.add('hiding')
    setTimeout(() => el.remove(), 400)
  }, duration)
}

export function showItemUsed(itemName: string): void {
  showToast({ message: `Used: ${itemName}`, type: 'info', duration: 2000 })
}

export function showStatWarning(stat: string, value: number): void {
  const msg = `⚠ ${stat} critical (${value})`
  if (value <= 1) {
    showToast({ message: msg, type: 'danger', duration: 4000 })
  } else {
    showToast({ message: msg, type: 'warning', duration: 3000 })
  }
}
