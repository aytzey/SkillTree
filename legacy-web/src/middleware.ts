// Middleware disabled — auth is checked at page level via getSessionUser()
// This avoids Edge Runtime cookie issues with __Secure- prefix behind reverse proxy

export const config = {
  matcher: [],
};
