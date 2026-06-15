import type {
  AzureProject,
  BulkTasksRequest,
  BulkTasksResponse,
  ClassificationNode,
  WorkItemLookup,
} from '../types/tasks'
import { apiFetchOptions, apiUrl } from './http'

export async function submitTasks(request: BulkTasksRequest): Promise<BulkTasksResponse> {
  const response = await fetch(apiUrl('/api/tasks/bulk'), {
    method: 'POST',
    ...apiFetchOptions,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  const body = (await readJsonSafely(response)) as BulkTasksResponse | null

  if (!body) {
    throw new Error('El backend no devolvio una respuesta valida.')
  }

  if (!response.ok && !body.tasks && !body.results) {
    const message = body.errors?.[0] || body.error || 'El backend rechazo la solicitud.'
    throw new Error(message)
  }

  return body
}

export async function listProjects(): Promise<AzureProject[]> {
  const response = await fetch(apiUrl('/api/azure/projects'), apiFetchOptions)
  const body = (await readJsonSafely(response)) as { ok?: boolean; projects?: AzureProject[]; error?: string } | null

  if (!response.ok || !body?.ok) {
    throw new Error(body?.error || 'No se pudieron cargar los proyectos.')
  }

  return Array.isArray(body.projects) ? body.projects : []
}

export async function searchWorkItems(project: string, query: string): Promise<WorkItemLookup[]> {
  const params = new URLSearchParams({
    project,
    q: query,
  })
  const response = await fetch(apiUrl(`/api/work-items/search?${params.toString()}`), apiFetchOptions)
  const body = (await readJsonSafely(response)) as { ok?: boolean; workItems?: WorkItemLookup[]; error?: string } | null

  if (!response.ok || !body?.ok) {
    throw new Error(body?.error || 'No se pudieron buscar work items.')
  }

  return Array.isArray(body.workItems) ? body.workItems : []
}

export async function listClassificationNodes(
  project: string,
  type: 'areas' | 'iterations',
  query = '',
): Promise<ClassificationNode[]> {
  const params = new URLSearchParams({
    project,
    type,
  })

  if (query.trim()) {
    params.set('q', query.trim())
  }

  const response = await fetch(apiUrl(`/api/classification-nodes?${params.toString()}`), apiFetchOptions)
  const body = (await readJsonSafely(response)) as { ok?: boolean; nodes?: ClassificationNode[]; error?: string } | null

  if (!response.ok || !body?.ok) {
    throw new Error(body?.error || 'No se pudieron cargar las rutas del proyecto.')
  }

  return Array.isArray(body.nodes) ? body.nodes : []
}

async function readJsonSafely(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}
