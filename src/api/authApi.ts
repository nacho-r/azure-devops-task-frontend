import { apiFetchOptions, apiUrl } from './http'

export async function savePatSession(pat: string): Promise<void> {
  const response = await fetch(apiUrl('/api/auth/pat'), {
    method: 'POST',
    ...apiFetchOptions,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pat }),
  })

  if (!response.ok) {
    throw new Error('No se pudo registrar el PAT en el backend local.')
  }
}

export async function clearPatSession(): Promise<void> {
  await fetch(apiUrl('/api/auth/pat'), {
    method: 'DELETE',
    ...apiFetchOptions,
  })
}

export async function hasPatSession(): Promise<boolean> {
  const response = await fetch(apiUrl('/api/auth/pat/status'), apiFetchOptions)

  if (!response.ok) {
    return false
  }

  const body = (await response.json()) as { configured?: boolean }
  return Boolean(body.configured)
}
