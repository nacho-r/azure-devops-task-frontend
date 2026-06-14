export type TaskStatus = 'pending' | 'validated' | 'created' | 'error'

export type TaskDraft = {
  title: string
  isCustomTitle: boolean
  description: string
  taskType: string
  remainingWork: string
  originalEstimateHH: string
  status: TaskStatus
  error?: string
  id?: string
  url?: string
}

export type TaskPayload = {
  title: string
  description: string
  taskType?: string
  remainingWork?: number
  originalEstimateHH?: number
}

export type BulkTasksRequest = {
  project: string
  parentId: string
  dryRun: boolean
  tasks: TaskPayload[]
}

export type AzureProject = {
  id: string
  name: string
  state?: string
  visibility?: string
}

export type WorkItemLookup = {
  id: number
  title: string
  type?: string
  state?: string
  url?: string
}

export type BulkTaskResult = {
  index: number
  status: 'validated' | 'created' | 'failed'
  title: string
  id?: number | string
  url?: string
  error?: string
}

export type BulkTasksResponse = {
  ok: boolean
  dryRun: boolean
  project?: string
  parentId: string
  total: number
  created?: number
  failed?: number
  tasks?: BulkTaskResult[]
  results?: BulkTaskResult[]
  errors?: string[]
  error?: string
}
