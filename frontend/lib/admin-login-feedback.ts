/** Actionable anonymous sign-in feedback without exposing Admin account state. */
export function adminLoginErrorMessage(status: number): string {
  if (status === 429) {
    return 'Too many sign-in attempts. Please stop retrying and wait before trying again. Repeated failures can lock sign-in for 15 minutes.';
  }
  if (status === 401) {
    return 'Sign-in failed. Check your email and password. After repeated failed attempts, sign-in may be locked for 15 minutes; wait before retrying.';
  }
  if (status === 403) {
    return 'Sign-in request was blocked. Open the official Admin sign-in page and try again.';
  }
  if (status >= 500) {
    return 'Sign-in is temporarily unavailable. Please try again later.';
  }
  return 'Unable to sign in. Please check your details and try again.';
}
