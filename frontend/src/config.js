export const API_URL = import.meta.env.VITE_API_URL

export const COGNITO = {
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
  userPoolDomain: import.meta.env.VITE_COGNITO_USER_POOL_DOMAIN,
  region: import.meta.env.VITE_COGNITO_REGION || 'ap-southeast-1',
  redirectUri: import.meta.env.VITE_REDIRECT_URI,
  signOutUri: import.meta.env.VITE_SIGNOUT_URI,
}
