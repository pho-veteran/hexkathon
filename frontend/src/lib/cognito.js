import { COGNITO } from '../config'

const ENDPOINT = `https://cognito-idp.${COGNITO.region}.amazonaws.com/`

async function cognitoFetch(action, payload) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `AWSCognitoIdentityProviderService.${action}`,
    },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) {
    const msg = data.message || data.__type || 'Auth request failed'
    throw new Error(msg)
  }
  return data
}

export async function signIn(email, password) {
  const data = await cognitoFetch('InitiateAuth', {
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: COGNITO.clientId,
    AuthParameters: { USERNAME: email, PASSWORD: password },
  })
  if (data.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
    throw new Error('NEW_PASSWORD_REQUIRED')
  }
  return {
    accessToken: data.AuthenticationResult.AccessToken,
    idToken: data.AuthenticationResult.IdToken,
    refreshToken: data.AuthenticationResult.RefreshToken,
  }
}

export async function signUp(email, password) {
  return cognitoFetch('SignUp', {
    ClientId: COGNITO.clientId,
    Username: email,
    Password: password,
    UserAttributes: [{ Name: 'email', Value: email }],
  })
}

export async function confirmSignUp(email, code) {
  return cognitoFetch('ConfirmSignUp', {
    ClientId: COGNITO.clientId,
    Username: email,
    ConfirmationCode: code,
  })
}

export async function forgotPassword(email) {
  return cognitoFetch('ForgotPassword', {
    ClientId: COGNITO.clientId,
    Username: email,
  })
}

export async function confirmNewPassword(email, code, newPassword) {
  return cognitoFetch('ConfirmForgotPassword', {
    ClientId: COGNITO.clientId,
    Username: email,
    ConfirmationCode: code,
    Password: newPassword,
  })
}

export async function refreshSession(refreshToken) {
  const data = await cognitoFetch('InitiateAuth', {
    AuthFlow: 'REFRESH_TOKEN_AUTH',
    ClientId: COGNITO.clientId,
    AuthParameters: { REFRESH_TOKEN: refreshToken },
  })
  return {
    accessToken: data.AuthenticationResult.AccessToken,
    idToken: data.AuthenticationResult.IdToken,
  }
}

export function signOut() {
  localStorage.removeItem('refreshToken')
}
