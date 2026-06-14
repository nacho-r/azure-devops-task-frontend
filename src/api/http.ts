const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL || ''
const apiBaseUrl = rawApiBaseUrl.replace(/\/+$/, '')

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${apiBaseUrl}${normalizedPath}`
}

export const apiFetchOptions = {
  credentials: 'include' as const,
}
