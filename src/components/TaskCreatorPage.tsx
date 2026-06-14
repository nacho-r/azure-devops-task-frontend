import { useMsal } from '@azure/msal-react'
import { useEffect, useMemo, useState } from 'react'
import { clearPatSession } from '../api/authApi'
import { listProjects, searchWorkItems, submitTasks } from '../api/tasksApi'
import { CUSTOM_TITLE_OPTION, ITERATION_PO_TITLE, TASK_TYPE_OPTIONS, TITLE_OPTIONS } from '../constants/taskOptions'
import type { AzureProject, BulkTaskResult, TaskDraft, TaskPayload, WorkItemLookup } from '../types/tasks'
import {
  applyTitleDefaults,
  createEmptyTask,
  isEmptyRow,
  parsePastedRows,
  sanitizeText,
  toTaskPayload,
  validateTaskRow,
} from '../utils/taskRows'

type ThemeMode = 'light' | 'dark'
const projectStorageKey = 'taskCreatorProject'

const statusLabels: Record<TaskDraft['status'], string> = {
  pending: 'pendiente',
  validated: 'validada',
  created: 'creada',
  error: 'error',
}

type TaskCreatorPageProps = {
  onExitPatMode?: () => void
}

export function TaskCreatorPage({ onExitPatMode }: TaskCreatorPageProps) {
  const { instance } = useMsal()
  const account = instance.getActiveAccount()
  const [theme, setTheme] = useState<ThemeMode>(() => getStoredTheme())
  const [projects, setProjects] = useState<AzureProject[]>([])
  const [selectedProject, setSelectedProject] = useState(() => getStoredProject())
  const [isLoadingProjects, setIsLoadingProjects] = useState(true)
  const [parentId, setParentId] = useState('')
  const [workItemResults, setWorkItemResults] = useState<WorkItemLookup[]>([])
  const [isSearchingWorkItems, setIsSearchingWorkItems] = useState(false)
  const [isWorkItemLookupOpen, setIsWorkItemLookupOpen] = useState(false)
  const [rows, setRows] = useState<TaskDraft[]>([createEmptyTask()])
  const [pasteText, setPasteText] = useState('')
  const [isPasteOpen, setIsPasteOpen] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<'ok' | 'error' | 'warning' | ''>('')
  const [pendingCreate, setPendingCreate] = useState<Extract<ValidationResult, { ok: true }> | null>(null)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('taskCreatorTheme', theme)
  }, [theme])

  useEffect(() => {
    let isMounted = true

    listProjects()
      .then((projectList) => {
        if (!isMounted) {
          return
        }

        setProjects(projectList)
      })
      .catch((error) => {
        if (!isMounted) {
          return
        }

        const errorMessage = error instanceof Error ? error.message : 'No se pudieron cargar los proyectos.'
        setMessage(`${errorMessage} Puedes mantener o editar el proyecto manualmente.`)
        setMessageTone('warning')
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingProjects(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  const projectOptions = useMemo(() => {
    const currentProject = sanitizeText(selectedProject)
    const hasCurrentProject = projects.some((project) => project.name === currentProject)

    if (currentProject && !hasCurrentProject) {
      return [{ id: currentProject, name: currentProject }, ...projects]
    }

    return projects
  }, [projects, selectedProject])

  useEffect(() => {
    const project = sanitizeText(selectedProject)

    if (project) {
      localStorage.setItem(projectStorageKey, project)
      return
    }

    localStorage.removeItem(projectStorageKey)
  }, [selectedProject])

  useEffect(() => {
    const query = sanitizeText(parentId)
    const project = sanitizeText(selectedProject)

    if (!project || !/^\d{2,}$/.test(query)) {
      return
    }

    let isMounted = true
    const timeoutId = window.setTimeout(() => {
      setIsSearchingWorkItems(true)
      searchWorkItems(project, query)
        .then((items) => {
          if (!isMounted) {
            return
          }

          setWorkItemResults(items)
          setIsWorkItemLookupOpen(true)
        })
        .catch(() => {
          if (!isMounted) {
            return
          }

          setWorkItemResults([])
        })
        .finally(() => {
          if (isMounted) {
            setIsSearchingWorkItems(false)
          }
        })
    }, 300)

    return () => {
      isMounted = false
      window.clearTimeout(timeoutId)
    }
  }, [parentId, selectedProject])

  const summary = useMemo(() => {
    const populatedRows = rows.filter((row) => !isEmptyRow(row))

    return {
      total: populatedRows.length,
      validated: rows.filter((row) => row.status === 'validated').length,
      created: rows.filter((row) => row.status === 'created').length,
      failed: rows.filter((row) => row.status === 'error').length,
    }
  }, [rows])

  const updateRow = (index: number, patch: Partial<TaskDraft>) => {
    setRows((currentRows) =>
      currentRows.map((row, rowIndex) => {
        if (rowIndex !== index) {
          return row
        }

        const nextRow = {
          ...row,
          ...patch,
          status: 'pending' as const,
          error: undefined,
          id: undefined,
          url: undefined,
        }

        if (Object.prototype.hasOwnProperty.call(patch, 'title')) {
          return applyTitleDefaults(nextRow)
        }

        return nextRow
      }),
    )
  }

  const addRow = () => {
    setRows((currentRows) => [...currentRows, createEmptyTask()])
  }

  const removeRow = (index: number) => {
    setRows((currentRows) => (currentRows.length === 1 ? currentRows : currentRows.filter((_, rowIndex) => rowIndex !== index)))
  }

  const importRows = () => {
    const parsedRows = parsePastedRows(pasteText)

    if (parsedRows.length === 0) {
      showMessage('No hay filas para importar.', 'warning')
      return
    }

    setRows(parsedRows)
    setPasteText('')
    setIsPasteOpen(false)
    showMessage(`${parsedRows.length} fila(s) importada(s).`, 'ok')
  }

  const validateBeforeCreate = () => {
    clearMessage()

    const validation = validateForm(rows, parentId, selectedProject)

    if (!validation.ok) {
      setRows(validation.rows)
      showMessage(validation.message, 'error')
      return
    }

    setPendingCreate(validation)
  }

  const submit = async (validCreate?: Extract<ValidationResult, { ok: true }>) => {
    clearMessage()

    const validation = validCreate ?? validateForm(rows, parentId, selectedProject)

    if (!validation.ok) {
      setRows(validation.rows)
      showMessage(validation.message, 'error')
      return
    }

    setIsSending(true)
    setPendingCreate(null)
    setRows((currentRows) =>
      currentRows.map((row, index) =>
        validation.sourceIndexes.includes(index)
          ? {
              ...row,
              status: 'pending',
              error: undefined,
              id: undefined,
              url: undefined,
            }
          : row,
      ),
    )

    try {
      const response = await submitTasks({
        project: validation.project,
        parentId: validation.parentId,
        dryRun: false,
        tasks: validation.tasks,
      })

      applyCreateResult(response.results || [], validation.sourceIndexes)
      showMessage('Proceso finalizado.', response.failed && response.failed > 0 ? 'warning' : 'ok')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'No se pudo conectar con el backend.'
      setRows((currentRows) =>
        currentRows.map((row, index) =>
          validation.sourceIndexes.includes(index)
            ? {
                ...row,
                status: 'error',
                error: errorMessage,
              }
            : row,
        ),
      )
      showMessage(errorMessage, 'error')
    } finally {
      setIsSending(false)
    }
  }

  const applyCreateResult = (results: BulkTaskResult[], sourceIndexes: number[]) => {
    setRows((currentRows) =>
      currentRows.map((row, rowIndex) => {
        const requestIndex = sourceIndexes.indexOf(rowIndex)

        if (requestIndex === -1) {
          return row
        }

        const result = results.find((item) => item.index === requestIndex)

        if (result?.status === 'created') {
          return {
            ...row,
            status: 'created',
            id: result.id ? String(result.id) : undefined,
            url: result.url,
            error: undefined,
          }
        }

        return {
          ...row,
          status: 'error',
          error: result?.error || 'No se pudo crear la tarea.',
        }
      }),
    )
  }

  const showMessage = (text: string, tone: 'ok' | 'error' | 'warning' | '') => {
    setMessage(text)
    setMessageTone(tone)
  }

  const clearMessage = () => {
    showMessage('', '')
  }

  const exitPatMode = async () => {
    await clearPatSession()
    onExitPatMode?.()
  }

  const displayName = onExitPatMode ? 'Modo PAT local' : account?.name || account?.username || 'Usuario autenticado'
  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))
  }

  const selectParentWorkItem = (workItem: WorkItemLookup) => {
    setParentId(String(workItem.id))
    setWorkItemResults([])
    setIsWorkItemLookupOpen(false)
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>Azure DevOps Tasks</h1>
          <p>Creacion masiva de tareas hijas</p>
        </div>
        <div className="user-panel">
          <span>{displayName}</span>
          <button type="button" className="secondary" onClick={toggleTheme} disabled={isSending}>
            {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          </button>
          {onExitPatMode ? (
            <button type="button" className="secondary" onClick={exitPatMode} disabled={isSending}>
              Salir modo PAT
            </button>
          ) : (
            <button type="button" className="secondary" onClick={() => instance.logoutRedirect()} disabled={isSending}>
              Cerrar sesion
            </button>
          )}
        </div>
      </header>

      {onExitPatMode ? (
        <section className="pat-bar">
          <label className="field">
            <span>PAT local</span>
            <input
              type="password"
              value="********"
              autoComplete="off"
              spellCheck={false}
              readOnly
              aria-readonly="true"
            />
          </label>
          <p className="muted">PAT bloqueado para esta sesion. Para cambiarlo, usa Salir modo PAT.</p>
        </section>
      ) : null}

      <section className="summary-grid" aria-live="polite">
        <SummaryItem label="Total" value={summary.total} />
        <SummaryItem label="Validadas" value={summary.validated} />
        <SummaryItem label="Creadas" value={summary.created} />
        <SummaryItem label="Fallidas" value={summary.failed} />
      </section>

      <section className="control-bar" aria-label="Controles principales">
        <label className="field project-field">
          <span>Proyecto {isLoadingProjects ? '(cargando)' : ''}</span>
          <input
            value={selectedProject}
            list="azure-project-options"
            autoComplete="off"
            placeholder="Seleccionar proyecto"
            onChange={(event) => {
              setSelectedProject(event.target.value)
              setWorkItemResults([])
              setIsWorkItemLookupOpen(false)
            }}
            disabled={isSending}
          />
          <datalist id="azure-project-options">
            {projectOptions.map((project) => (
              <option value={project.name} key={project.id || project.name} />
            ))}
          </datalist>
        </label>

        <label className="field parent-field">
          <span>ID work item padre</span>
          <div className="lookup-field">
            <input
              value={parentId}
              inputMode="numeric"
              autoComplete="off"
              placeholder={isSearchingWorkItems ? 'Buscando...' : 'Ej: 4151'}
              onFocus={() => setIsWorkItemLookupOpen(true)}
              onChange={(event) => {
                const nextParentId = event.target.value

                setParentId(nextParentId)
                setIsWorkItemLookupOpen(true)

                if (!/^\d{2,}$/.test(sanitizeText(nextParentId))) {
                  setWorkItemResults([])
                  setIsSearchingWorkItems(false)
                }
              }}
            />
            {isWorkItemLookupOpen && workItemResults.length > 0 ? (
              <div className="lookup-results">
                {workItemResults.map((workItem) => (
                  <button
                    type="button"
                    className="lookup-option"
                    key={workItem.id}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectParentWorkItem(workItem)}
                  >
                    <strong>{workItem.id}</strong>
                    <span>{workItem.title || 'Sin titulo'}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </label>

        <div className="actions">
          <button type="button" className="secondary" onClick={addRow} disabled={isSending}>
            + Fila
          </button>
          <button type="button" className="secondary" onClick={() => setIsPasteOpen(true)} disabled={isSending}>
            Pegar Excel
          </button>
          <button type="button" className="primary" onClick={validateBeforeCreate} disabled={isSending}>
            Crear
          </button>
        </div>
      </section>

      {isPasteOpen ? (
        <section className="paste-panel">
          <label className="field">
            <span>Datos desde Excel o Google Sheets</span>
            <textarea value={pasteText} rows={6} spellCheck={false} onChange={(event) => setPasteText(event.target.value)} />
          </label>
          <div className="paste-actions">
            <button type="button" className="primary" onClick={importRows} disabled={isSending}>
              Importar
            </button>
            <button type="button" className="secondary" onClick={() => setIsPasteOpen(false)} disabled={isSending}>
              Cancelar
            </button>
          </div>
        </section>
      ) : null}

      <section className="table-wrap" aria-label="Tasks">
        <table>
          <thead>
            <tr>
              <th className="title-col">Titulo</th>
              <th className="description-col">Descripcion</th>
              <th className="type-col">Tipo de tarea</th>
              <th className="number-col">Horas restantes</th>
              <th className="number-col">Estimacion original</th>
              <th className="status-col">Estado</th>
              <th className="action-col">Accion</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                <td className="title-cell">
                  <div className="title-editor">
                    <Select
                      value={row.isCustomTitle ? CUSTOM_TITLE_OPTION : row.title}
                      options={[...TITLE_OPTIONS, CUSTOM_TITLE_OPTION]}
                      onChange={(value) =>
                        updateRow(
                          index,
                          value === CUSTOM_TITLE_OPTION
                            ? { title: '', isCustomTitle: true }
                            : { title: value, isCustomTitle: false },
                        )
                      }
                    />
                    {row.isCustomTitle ? (
                      <input
                        value={row.title}
                        placeholder="Ingresar titulo"
                        onChange={(event) => updateRow(index, { title: event.target.value, isCustomTitle: true })}
                      />
                    ) : null}
                  </div>
                </td>
                <td className="description-cell">
                  <input value={row.description} onChange={(event) => updateRow(index, { description: event.target.value })} />
                </td>
                <td className="taskType-cell">
                  <Select
                    value={row.taskType}
                    options={TASK_TYPE_OPTIONS}
                    onChange={(value) => updateRow(index, { taskType: value })}
                  />
                </td>
                <td>
                  <input
                    className="number-input"
                    value={row.remainingWork}
                    onChange={(event) => updateRow(index, { remainingWork: event.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="number-input"
                    value={row.originalEstimateHH}
                    onChange={(event) => updateRow(index, { originalEstimateHH: event.target.value })}
                  />
                </td>
                <td className="status-cell">
                  <span className={`status-pill status-${row.status}`}>{statusLabels[row.status]}</span>
                  {row.id || row.url ? (
                    <a className="created-link" href={row.url || '#'} target="_blank" rel="noreferrer">
                      {row.id ? `#${row.id}` : 'Abrir task'}
                    </a>
                  ) : null}
                  {row.error ? <div className="row-error">{row.error}</div> : null}
                </td>
                <td>
                  <button
                    type="button"
                    className="icon-button"
                    title="Eliminar fila"
                    disabled={isSending || rows.length === 1}
                    onClick={() => removeRow(index)}
                  >
                    x
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className={`message ${messageTone}`} role="status" aria-live="polite">
        {message}
      </div>

      <p className="footnote">
        Al seleccionar {ITERATION_PO_TITLE}, las horas quedan en 0.5 si estaban vacias.
      </p>

      {pendingCreate ? (
        <ConfirmCreateModal
          taskCount={pendingCreate.tasks.length}
          project={pendingCreate.project}
          parentId={pendingCreate.parentId}
          isSending={isSending}
          onCancel={() => setPendingCreate(null)}
          onConfirm={() => submit(pendingCreate)}
        />
      ) : null}
    </main>
  )
}

function ConfirmCreateModal({
  taskCount,
  project,
  parentId,
  isSending,
  onCancel,
  onConfirm,
}: {
  taskCount: number
  project: string
  parentId: string
  isSending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-create-title">
        <div>
          <p className="eyebrow">Confirmacion</p>
          <h2 id="confirm-create-title">Crear tareas reales</h2>
          <p className="muted">
            Se crearan {taskCount} tarea(s) hijas del work item {parentId} en el proyecto {project}.
          </p>
        </div>
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onCancel} disabled={isSending}>
            Cancelar
          </button>
          <button type="button" className="danger" onClick={onConfirm} disabled={isSending}>
            Crear
          </button>
        </div>
      </section>
    </div>
  )
}

function SummaryItem({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function Select({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  const normalizedOptions = value && !options.includes(value) ? [...options, value] : options

  return (
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Seleccionar</option>
      {normalizedOptions.map((option) => (
        <option value={option} key={option}>
          {option}
        </option>
      ))}
    </select>
  )
}

type ValidationResult =
  | {
      ok: true
      project: string
      parentId: string
      rows: TaskDraft[]
      tasks: TaskPayload[]
      sourceIndexes: number[]
    }
  | {
      ok: false
      rows: TaskDraft[]
      message: string
    }

function validateForm(rows: TaskDraft[], parentId: string, project: string): ValidationResult {
  const nextRows: TaskDraft[] = rows.map((row) => ({
    ...row,
    status: 'pending' as const,
    error: undefined,
    id: undefined,
    url: undefined,
  }))
  const sanitizedProject = sanitizeText(project)
  const sanitizedParentId = sanitizeText(parentId)
  const tasks: TaskPayload[] = []
  const sourceIndexes: number[] = []

  if (!sanitizedProject) {
    return {
      ok: false,
      message: 'Proyecto es requerido.',
      rows: nextRows,
    }
  }

  if (!sanitizedParentId) {
    return {
      ok: false,
      message: 'El ID del work item padre es requerido.',
      rows: nextRows,
    }
  }

  nextRows.forEach((row, index) => {
    if (isEmptyRow(row)) {
      return
    }

    const errors = validateTaskRow(row)

    if (errors.length > 0) {
      row.status = 'error'
      row.error = errors.join(' ')
      return
    }

    tasks.push(toTaskPayload(row))
    sourceIndexes.push(index)
  })

  if (tasks.length === 0 && nextRows.every((row) => row.status !== 'error')) {
    return {
      ok: false,
      message: 'Agrega al menos una tarea.',
      rows: nextRows,
    }
  }

  if (nextRows.some((row) => row.status === 'error')) {
    return {
      ok: false,
      message: 'Corrige las filas marcadas.',
      rows: nextRows,
    }
  }

  return {
    ok: true,
    project: sanitizedProject,
    parentId: sanitizedParentId,
    tasks,
    sourceIndexes,
    rows: nextRows,
  }
}

function getStoredTheme(): ThemeMode {
  if (typeof localStorage === 'undefined') {
    return 'light'
  }

  return localStorage.getItem('taskCreatorTheme') === 'dark' ? 'dark' : 'light'
}

function getStoredProject(): string {
  if (typeof localStorage === 'undefined') {
    return ''
  }

  return sanitizeText(localStorage.getItem(projectStorageKey))
}
