import { ITERATION_PO_DEFAULT_HOURS, ITERATION_PO_TITLE, TITLE_OPTIONS } from '../constants/taskOptions'
import type { TaskDraft, TaskPayload } from '../types/tasks'

export function createEmptyTask(): TaskDraft {
  return {
    title: '',
    isCustomTitle: false,
    description: '',
    taskType: '',
    remainingWork: '',
    originalEstimateHH: '',
    status: 'pending',
  }
}

export function sanitizeText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
}

export function applyTitleDefaults(row: TaskDraft): TaskDraft {
  if (row.title !== ITERATION_PO_TITLE) {
    return row
  }

  return {
    ...row,
    remainingWork: sanitizeText(row.remainingWork) || ITERATION_PO_DEFAULT_HOURS,
    originalEstimateHH: sanitizeText(row.originalEstimateHH) || ITERATION_PO_DEFAULT_HOURS,
  }
}

export function parsePastedRows(text: string): TaskDraft[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.split('\t').map((value) => sanitizeText(value)))
    .filter((columns) => columns.some(Boolean))
    .map((columns) => {
      const [title = '', second = '', third = '', fourth = '', fifth = ''] = columns
      const hasDescriptionColumn = columns.length >= 5

      return applyTitleDefaults({
        title,
        isCustomTitle: Boolean(title) && !TITLE_OPTIONS.includes(title),
        description: hasDescriptionColumn ? second : '',
        taskType: hasDescriptionColumn ? third : second,
        remainingWork: hasDescriptionColumn ? fourth : third,
        originalEstimateHH: hasDescriptionColumn ? fifth : fourth,
        status: 'pending',
      })
    })
}

export function isEmptyRow(row: TaskDraft): boolean {
  return (
    !sanitizeText(row.title) &&
    !sanitizeText(row.description) &&
    !sanitizeText(row.taskType) &&
    !sanitizeText(row.remainingWork) &&
    !sanitizeText(row.originalEstimateHH)
  )
}

export function toTaskPayload(row: TaskDraft): TaskPayload {
  return {
    title: sanitizeText(row.title),
    description: sanitizeText(row.description),
    taskType: sanitizeText(row.taskType) || undefined,
    remainingWork: toOptionalNumber(row.remainingWork),
    originalEstimateHH: toOptionalNumber(row.originalEstimateHH),
  }
}

export function validateTaskRow(row: TaskDraft): string[] {
  const errors: string[] = []

  if (!sanitizeText(row.title)) {
    errors.push('Title es requerido.')
  }

  if (!sanitizeText(row.description)) {
    errors.push('Description es requerido.')
  }

  if (!isOptionalNumber(row.remainingWork)) {
    errors.push('Remaining Work debe ser numerico.')
  }

  if (!isOptionalNumber(row.originalEstimateHH)) {
    errors.push('Original Estimate HH debe ser numerico.')
  }

  return errors
}

function isOptionalNumber(value: string): boolean {
  return sanitizeText(value) === '' || Number.isFinite(Number(value))
}

function toOptionalNumber(value: string): number | undefined {
  const sanitizedValue = sanitizeText(value)
  return sanitizedValue === '' ? undefined : Number(sanitizedValue)
}
