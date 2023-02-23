export const isProduction = (): boolean =>
  typeof window === 'undefined' || window.location.host === 'app.prepo.io'
