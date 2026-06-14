import { LogLevel, type Configuration, type RedirectRequest } from '@azure/msal-browser'

const clientId = import.meta.env.VITE_AZURE_CLIENT_ID || ''
const tenantId = import.meta.env.VITE_AZURE_TENANT_ID || 'common'

export const isAuthConfigured = Boolean(clientId)

export const msalConfig: Configuration = {
  auth: {
    clientId: clientId || 'missing-client-id',
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) {
          return
        }

        if (level === LogLevel.Error) {
          console.error(message)
        }
      },
    },
  },
}

export const loginRequest: RedirectRequest = {
  scopes: ['openid', 'profile', 'email'],
}
