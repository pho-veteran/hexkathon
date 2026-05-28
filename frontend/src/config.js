export const API_URL = import.meta.env.VITE_API_URL

export const COGNITO = {
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
  region: import.meta.env.VITE_COGNITO_REGION || 'ap-southeast-1',
}
