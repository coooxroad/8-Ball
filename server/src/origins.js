/* Which web pages may call the server (index.js guard) - see there. Its own file so node tests can import it. */
const ORIGINS = ['https://danguuu.com', 'https://www.danguuu.com', 'https://cue.oxcorp.workers.dev', 'null', 'file://'];
export const originOk = (origin, env) => !origin || ORIGINS.includes(origin)
  || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  || String((env && env.ORIGINS_EXTRA) || '').split(/\s+/).filter(Boolean).includes(origin);
