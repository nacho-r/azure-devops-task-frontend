# Azure DevOps Task Frontend

Frontend separado en Vite + React + TypeScript para crear tasks hijas en Azure DevOps usando el backend API.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

La app corre en:

```text
http://localhost:5173
```

El backend debe estar levantado en:

```text
http://127.0.0.1:3000
```

Vite proxy redirige `/api` y `/health` al backend.

Para produccion en Netlify configura:

```env
VITE_API_BASE_URL=https://azure-devops-task-backend.onrender.com
```

Si `VITE_API_BASE_URL` no existe, el frontend usa rutas relativas como `/api`, lo que permite seguir usando el proxy local de Vite.

## Login Microsoft Entra

Configura `.env`:

```env
VITE_AZURE_CLIENT_ID=application-client-id
VITE_AZURE_TENANT_ID=directory-tenant-id
```

En Microsoft Entra ID registra una SPA con redirect URI:

```text
http://localhost:5173
```

El frontend soporta dos modos:

- MSAL con `sessionStorage` para la sesion de Microsoft.
- PAT local en memoria para desarrollo cuando no tienes permisos para registrar la SPA en Entra.

El PAT local no se guarda en `localStorage` ni `sessionStorage`. El frontend lo envía una vez a `/api/auth/pat`; el backend lo guarda en memoria con una cookie `HttpOnly` y lo usa en `/api/tasks/bulk`.

## Uso

1. Inicia sesion con Microsoft.
2. Escoge el proyecto desde la lista o edita el valor manualmente.
3. Ingresa `parentId`.
4. Carga tasks manualmente o pegando desde Excel.
5. Crea reales con confirmacion.

El proyecto seleccionado se mantiene en pantalla despues de crear tasks mientras la app siga abierta.

Orden de columnas al pegar:

```text
title    description    taskType    remainingWork    originalEstimateHH
```

Al seleccionar `[QA]SL -Iteración PO`, las horas quedan en `0.5` si estaban vacias.
