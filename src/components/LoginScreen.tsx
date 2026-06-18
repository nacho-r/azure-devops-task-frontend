import { useEffect, useState } from 'react'
import { InteractionStatus } from '@azure/msal-browser'
import { useMsal } from '@azure/msal-react'
import { hasPatSession, savePatSession } from '../api/authApi'
import { isAuthConfigured, loginRequest } from '../auth/authConfig'
import { TaskCreatorPage } from './TaskCreatorPage'

export function LoginScreen() {
  const { instance, inProgress } = useMsal()
  const [pat, setPat] = useState('')
  const [isPatMode, setIsPatMode] = useState(false)
  const [isPatHelpOpen, setIsPatHelpOpen] = useState(false)
  const [error, setError] = useState('')
  const activeAccount = instance.getActiveAccount()
  const isBusy = inProgress !== InteractionStatus.None

  useEffect(() => {
    hasPatSession()
      .then((configured) => setIsPatMode(configured))
      .catch(() => setIsPatMode(false))
  }, [])

  const handleLogin = () => {
    if (!isAuthConfigured || isBusy) {
      return
    }

    instance.loginRedirect(loginRequest)
  }

  const handlePatLogin = async () => {
    const sanitizedPat = pat.trim()

    if (!sanitizedPat) {
      return
    }

    try {
      setError('')
      await savePatSession(sanitizedPat)
      setPat('')
      setIsPatMode(true)
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'No se pudo registrar el PAT.')
    }
  }

  if (isPatMode) {
    return <TaskCreatorPage onExitPatMode={() => setIsPatMode(false)} />
  }

  if (activeAccount) {
    return <TaskCreatorPage />
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div>
          <p className="eyebrow">Azure DevOps Tasks</p>
          <h1>Ingresa con Microsoft</h1>
          <p className="muted">
            La creación de tareas queda disponible solo después de autenticar con Microsoft Entra ID.
          </p>
        </div>

        {!isAuthConfigured ? (
          <div className="alert error">
            Próximamente
          </div>
        ) : null}

        <button className="primary large" type="button" disabled={!isAuthConfigured || isBusy} onClick={handleLogin}>
          {isBusy ? 'Redirigiendo...' : 'Iniciar sesión'}
        </button>

        <div className="pat-login">
          <label className="field">
            <span>PAT para modo local</span>
            <input
              type="password"
              value={pat}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setPat(event.target.value)}
              placeholder="Pega tu PAT"
            />
          </label>
          <button className="secondary large" type="button" disabled={!pat.trim()} onClick={handlePatLogin}>
            Entrar con PAT local
          </button>
          <button className="secondary large" type="button" onClick={() => setIsPatHelpOpen(true)}>
            Cómo obtener PAT
          </button>
          {error ? <div className="alert error">{error}</div> : null}
        </div>

        {isPatHelpOpen ? <PatHelpModal onClose={() => setIsPatHelpOpen(false)} /> : null}
      </section>
    </main>
  )
}

function PatHelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="confirm-modal pat-help-modal" role="dialog" aria-modal="true" aria-labelledby="pat-help-title">
        <div>
          <p className="eyebrow">PAT Azure DevOps</p>
          <h2 id="pat-help-title">Cómo obtener PAT</h2>
        </div>
        <ol className="help-list">
          <li>Ingresar a Azure desde tu proyecto.</li>
          <li>Presionar configuración arriba a la derecha.</li>
          <li>Presionar Personal access tokens.</li>
          <li>Presionar Nuevo token.</li>
          <li>Ingresar nombre: PAT-TASK.</li>
          <li>Presionar Definido personalizado.</li>
          <li>Marcar Work Items con lectura y escritura.</li>
          <li>Dejar todas las demás opciones en lectura.</li>
          <li>Presionar Crear.</li>
        </ol>
        <div className="modal-actions">
          <button type="button" className="primary" onClick={onClose}>
            Entendido
          </button>
        </div>
      </section>
    </div>
  )
}
