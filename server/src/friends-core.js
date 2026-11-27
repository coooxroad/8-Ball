/* 친구 (owner 11-27): names with a tag - 닉네임#1234 - as other games have, requests both ways, and a game with a friend
   started from the list. Plan and the owner's answers: the project doc claude/cue-friends-plan.md.

   Three parts, each on its own SQLite:
   - HandleBook (in the directory lobby, directory.js): who is 닉네임#1234, and each account's face for its friends' lists -
     the name, the card it shows, the rating, when it was last seen and what it is playing. One place, so a list of
     friends is one read.
   - FriendsCore (in each vault, core.js): this account's friends, the requests sent and received, the blocked, the games
     with each friend (won, lost), and the invitations come in (two minutes each).
   - FriendsFlow: what a request does - this vault, the directory and the other vault in turn. It is given the ways to
     reach them (vault.js: Durable Object fetches; the tests: the objects themselves), so the same steps run in both.

   The rules (owner 11-27):
   - A request is answered by the other side or it goes: one not taken in 7 days is gone from both lists, and a request
     turned down stays on the sender's list till then (the sender is not told). A request to the opponent of a ranked game
     who was a stand-in (ranked.js - never shown to be one) is the same - kept 7 days, then gone, as one never taken.
   - At most FR_MAX friends, FR_SENT_MAX requests waiting, FR_DAY requests a day.
   - The blocked: their requests and invitations never arrive, and they are not told. */

export const FR_MAX = 100, FR_SENT_MAX = 30, FR_DAY = 30;
export const FR_KEEP = 7 * 86400000;        // ms an untaken request is kept
export const INVITE_KEEP = 2 * 60000;       // ms an invitation stays
export const FACE_EVERY = 30000;            // ms at most between the face's writes to the directory (unless it changed)
const ACCT = /^[0-9a-f]{32}$/, GHOST = /^g[0-9a-f]{31}$/;
export const isAcct = a => typeof a === 'string' && ACCT.test(a);

// a nickname as it is looked up: one form of each letter, case and spaces aside
export const nickKey = n => String(n || '').normalize('NFC').toLowerCase().replace(/\s+/g, '');
// '닉네임#1234' (or '닉네임 #1234', '닉네임#12') -> { nick, tag } | null
export const parseHandle = s => {
  const m = /^(.+?)\s*#\s*(\d{1,4})$/.exec(String(s || '').trim()); if (!m) return null;
  const nick = m[1].trim(); return nick ? { nick, tag: m[2].padStart(4, '0') } : null;
};
// the name the others see, cleaned as core.js nick does (2 to 10 characters)
export const cleanNick = n => { const s = String(n || '').replace(/[\u0000-\u001f\u007f#]/g, '').replace(/\s+/g, ' ').trim(); const len = [...s].length; return len >= 2 && len <= 10 ? s : null; };
const tagOf = n => String(n).padStart(4, '0');
// a stand-in's tag on the sender's list: the same for the same name in the same game (never a real account's lookup)
const hashHex = (s, n) => { let h = 2166136261 >>> 0, out = ''; for (let k = 0; out.length < n; k++) { for (const c of s + ':' + k) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; out += h.toString(16).padStart(8, '0'); } return out.slice(0, n); };

/* ---------- the directory's half ---------- */
export class HandleBook {
  constructor(sql, rnd) {
    this.sql = sql; this.rnd = rnd || Math.random;
    sql.exec(`CREATE TABLE IF NOT EXISTS handles (k TEXT, tag TEXT, acct TEXT, PRIMARY KEY (k, tag))`);
    sql.exec(`CREATE UNIQUE INDEX IF NOT EXISTS handles_acct ON handles (acct)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS faces (acct TEXT PRIMARY KEY, nick TEXT, tag TEXT, face TEXT, seen INTEGER, doing TEXT)`);
  }
  /* the account's tag under this nickname: the one it had if no one else has it under the new name, else a free one at
     random (9999 under one name at most - then no). -> { ok, tag } */
  claim({ acct, nick, tag }) {
    if (!isAcct(acct)) return { ok: false, why: 'who' };
    const n = cleanNick(nick); if (!n) return { ok: false, why: 'nick length' };
    const k = nickKey(n), taken = t => { const r = this.sql.exec(`SELECT acct FROM handles WHERE k = ? AND tag = ?`, k, t).toArray()[0]; return r && r.acct !== acct; };
    let t = /^\d{4}$/.test(tag || '') && tag !== '0000' && !taken(tag) ? tag : null;
    for (let i = 0; !t && i < 60; i++) { const c = tagOf(1 + Math.floor(this.rnd() * 9999)); if (!taken(c)) t = c; }
    if (!t) { const used = new Set(this.sql.exec(`SELECT tag FROM handles WHERE k = ?`, k).toArray().map(r => r.tag)); for (let i = 1; i <= 9999 && !t; i++) if (!used.has(tagOf(i))) t = tagOf(i); }
    if (!t) return { ok: false, why: 'name full' };
    this.sql.exec(`DELETE FROM handles WHERE acct = ?`, acct);
    this.sql.exec(`INSERT INTO handles (k, tag, acct) VALUES (?, ?, ?)`, k, t, acct);
    this.sql.exec(`INSERT INTO faces (acct, nick, tag, face, seen, doing) VALUES (?, ?, ?, '{}', 0, NULL) ON CONFLICT(acct) DO UPDATE SET nick = excluded.nick, tag = excluded.tag`, acct, n, t);
    return { ok: true, nick: n, tag: t };
  }
  // who is 닉네임#1234 -> { ok, acct, nick, tag }
  find({ nick, tag }) {
    const r = this.sql.exec(`SELECT acct FROM handles WHERE k = ? AND tag = ?`, nickKey(nick), tagOf(tag)).toArray()[0];
    if (!r) return { ok: false, why: 'no one' };
    const f = this.sql.exec(`SELECT nick, tag FROM faces WHERE acct = ?`, r.acct).toArray()[0];
    return { ok: true, acct: r.acct, nick: f ? f.nick : nick, tag: tagOf(tag) };
  }
  // the account's face and where it is (seen: now, doing: a game's mode or null)
  put({ acct, face, doing, seen }) {
    if (!isAcct(acct)) return { ok: false };
    const f = JSON.stringify(face && typeof face === 'object' ? face : {}).slice(0, 600);
    this.sql.exec(`UPDATE faces SET face = ?, seen = ?, doing = ? WHERE acct = ?`, f, seen || Date.now(), typeof doing === 'string' ? doing.slice(0, 16) : null, acct);
    return { ok: true };
  }
  // the faces of these accounts (one bound value: a JSON list) -> { ok, faces: { [acct]: { nick, tag, face, seen, doing } } }
  faces({ accts }) {
    const list = (Array.isArray(accts) ? accts : []).filter(isAcct).slice(0, 400), out = {};
    if (list.length) for (const r of this.sql.exec(`SELECT acct, nick, tag, face, seen, doing FROM faces WHERE acct IN (SELECT value FROM json_each(?))`, JSON.stringify(list)).toArray())
      out[r.acct] = { nick: r.nick, tag: r.tag, face: JSON.parse(r.face || '{}'), seen: r.seen || 0, doing: r.doing || null };
    return { ok: true, faces: out };
  }
  forget(acct) { this.sql.exec(`DELETE FROM handles WHERE acct = ?`, acct); this.sql.exec(`DELETE FROM faces WHERE acct = ?`, acct); return { ok: true }; }
}

/* ---------- the vault's half ---------- */
export class FriendsCore {
  constructor(sql, now) {
    this.sql = sql; this.now = now || Date.now;
    // st: 'friend' | 'sent' | 'recv' | 'blocked'; nick, tag: as last heard (the directory's face wins in a list)
    sql.exec(`CREATE TABLE IF NOT EXISTS friends (acct TEXT PRIMARY KEY, st TEXT, at INTEGER, nick TEXT, tag TEXT, w INTEGER DEFAULT 0, l INTEGER DEFAULT 0, d INTEGER DEFAULT 0)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS fr_inbox (acct TEXT PRIMARY KEY, nick TEXT, tag TEXT, code TEXT, mode TEXT, rules TEXT, at INTEGER)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS fr_day (day TEXT PRIMARY KEY, n INTEGER)`);
  }
  row(acct) { return this.sql.exec(`SELECT * FROM friends WHERE acct = ?`, acct).toArray()[0] || null; }
  st(acct) { const r = this.row(acct); return r ? r.st : null; }
  count(st) { return this.sql.exec(`SELECT COUNT(*) AS n FROM friends WHERE st = ?`, st).toArray()[0].n; }
  set(acct, st, nick, tag, keepAt) {
    const r = this.row(acct), at = keepAt && r ? r.at : this.now();
    this.sql.exec(`INSERT INTO friends (acct, st, at, nick, tag) VALUES (?, ?, ?, ?, ?) ON CONFLICT(acct) DO UPDATE SET st = excluded.st, at = excluded.at, nick = COALESCE(excluded.nick, friends.nick), tag = COALESCE(excluded.tag, friends.tag)`, acct, st, at, nick || null, tag || null);
  }
  drop(acct) { this.sql.exec(`DELETE FROM friends WHERE acct = ?`, acct); this.sql.exec(`DELETE FROM fr_inbox WHERE acct = ?`, acct); }
  // requests past their days, and invitations past their minutes, go
  tidy() {
    const t = this.now();
    this.sql.exec(`DELETE FROM friends WHERE st IN ('sent', 'recv') AND at < ?`, t - FR_KEEP);
    this.sql.exec(`DELETE FROM fr_inbox WHERE at < ?`, t - INVITE_KEEP);
  }
  // one more request today, if there is room for it
  spend() {
    const day = new Date(this.now()).toISOString().slice(0, 10), r = this.sql.exec(`SELECT n FROM fr_day WHERE day = ?`, day).toArray()[0];
    if (r && r.n >= FR_DAY) return false;
    this.sql.exec(`DELETE FROM fr_day WHERE day != ?`, day);
    this.sql.exec(`INSERT INTO fr_day (day, n) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET n = fr_day.n + 1`, day);
    return true;
  }
  /* the other side heard from (vault.js /fr/hear, from that account's vault only): { from, nick, tag, what, ... } ->
     { st } - what this side now has with them ('quiet': nothing, and the asker is not told why) */
  hear({ from, nick, tag, what, code, mode, rules }) {
    this.tidy();
    if (!isAcct(from)) return { st: 'quiet' };
    const mine = this.st(from);
    if (mine === 'blocked') return { st: 'quiet' };
    if (what === 'req') {
      if (mine === 'friend') return { st: 'friend' };
      if (mine === 'sent') { this.set(from, 'friend', nick, tag); return { st: 'friend' }; }   // (both asked)
      this.set(from, 'recv', nick, tag, mine === 'recv'); return { st: 'sent' };
    }
    if (what === 'accept') {
      if (mine !== 'sent' && mine !== 'friend') return { st: 'quiet' };     // (withdrawn meanwhile)
      if (mine !== 'friend' && this.count('friend') >= FR_MAX) return { st: 'quiet' };
      this.set(from, 'friend', nick, tag); return { st: 'friend' };
    }
    if (what === 'remove') { if (mine) this.drop(from); return { st: null }; }
    if (what === 'invite') {
      if (mine !== 'friend' || typeof code !== 'string' || !/^[A-Z0-9]{6}$/.test(code)) return { st: 'quiet' };
      this.sql.exec(`INSERT INTO fr_inbox (acct, nick, tag, code, mode, rules, at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(acct) DO UPDATE SET nick = excluded.nick, tag = excluded.tag, code = excluded.code, mode = excluded.mode, rules = excluded.rules, at = excluded.at`,
        from, nick || null, tag || null, code, String(mode || '').slice(0, 16), JSON.stringify(rules || null).slice(0, 400), this.now());
      return { st: 'friend' };
    }
    if (what === 'uninvite') { this.sql.exec(`DELETE FROM fr_inbox WHERE acct = ?`, from); return { st: mine }; }
    return { st: 'quiet' };
  }
  // a game with a friend over (core.js ranked, kind 'invite'): who won, once per room (the caller's once)
  record(accts, won, draw) {
    for (const a of accts || []) if (isAcct(a) && this.st(a) === 'friend') this.sql.exec(`UPDATE friends SET ${draw ? 'd = d + 1' : won ? 'w = w + 1' : 'l = l + 1'} WHERE acct = ?`, a);
  }
  // everything for the list (the faces are the directory's: FriendsFlow.list)
  all() {
    this.tidy();
    return { rows: this.sql.exec(`SELECT acct, st, at, nick, tag, w, l, d FROM friends ORDER BY at DESC`).toArray(),
      inbox: this.sql.exec(`SELECT acct, nick, tag, code, mode, rules, at FROM fr_inbox ORDER BY at DESC`).toArray().map(r => Object.assign(r, { rules: JSON.parse(r.rules || 'null') })) };
  }
  erase() { for (const t of ['friends', 'fr_inbox', 'fr_day']) this.sql.exec(`DELETE FROM ${t}`); }
}

/* ---------- the steps: this vault (core), the directory (dir), another vault (vault), a game's room (room) ----------
   me: { acct, nick, tag } - this account's handle (vault.js keeps the tag in kv 'tag') */
export class FriendsFlow {
  constructor({ core, dir, vault, room, me }) { Object.assign(this, { core, dir, vault, room, me }); }
  async tell(acct, what, extra) { return this.vault(acct, '/fr/hear', Object.assign({ from: this.me.acct, nick: this.me.nick, tag: this.me.tag, what }, extra || {})).catch(() => null); }
  /* a request: to 닉네임#1234 ({ handle }), or to the opponent of a game just played ({ room }) */
  async add({ handle, room }) {
    const F = this.core; F.tidy();
    if (!this.me.tag) return { ok: false, why: 'no name' };
    let to, nick, tag;
    if (room != null) {
      if (typeof room !== 'string' || !/^[0-9a-f]{32}$/.test(room)) return { ok: false, why: 'no room' };
      const w = await this.room(room, '/who', { acct: this.me.acct }).catch(() => null);
      if (!w || !w.ok) return { ok: false, why: 'no room' };
      if (w.ghost) {
        // (a stand-in: a request like any, never taken - gone in 7 days, as one turned down; owner 11-27 (다))
        const g = 'g' + hashHex(room + ':' + (w.name || ''), 31), gt = tagOf(1 + parseInt(hashHex(w.name + room, 4), 16) % 9999);
        if (F.st(g)) return { ok: true, st: F.st(g), nick: w.name, tag: gt };
        if (F.count('sent') >= FR_SENT_MAX) return { ok: false, why: 'too many waiting' };
        if (!F.spend()) return { ok: false, why: 'too many today' };
        F.set(g, 'sent', w.name, gt); return { ok: true, st: 'sent', nick: w.name, tag: gt };
      }
      to = w.acct;
    } else {
      const h = typeof handle === 'string' ? parseHandle(handle) : handle && handle.nick ? { nick: handle.nick, tag: tagOf(handle.tag) } : null;
      if (!h) return { ok: false, why: 'bad name' };
      const f = await this.dir('/dir/handle-find', h); if (!f || !f.ok) return { ok: false, why: 'no one' };
      to = f.acct; nick = f.nick; tag = f.tag;
    }
    if (!isAcct(to) || to === this.me.acct) return { ok: false, why: 'self' };
    const mine = F.st(to);
    if (mine === 'friend' || mine === 'sent') return { ok: true, st: mine, nick, tag };
    if (mine === 'blocked') return { ok: false, why: 'blocked' };
    if (mine === 'recv') return this.accept({ acct: to });             // (they asked first: taking it)
    if (F.count('friend') >= FR_MAX) return { ok: false, why: 'full' };
    if (F.count('sent') >= FR_SENT_MAX) return { ok: false, why: 'too many waiting' };
    if (!F.spend()) return { ok: false, why: 'too many today' };
    if (!nick) { const fc = await this.dir('/dir/faces', { accts: [to] }); const x = fc && fc.faces && fc.faces[to]; if (x) { nick = x.nick; tag = x.tag; } }
    const r = await this.tell(to, 'req');
    if (!r) return { ok: false, why: 'try again' };
    // ('quiet' - they blocked this one: kept as sent, gone in 7 days, as any not taken)
    F.set(to, r.st === 'friend' ? 'friend' : 'sent', nick, tag);
    return { ok: true, st: r.st === 'friend' ? 'friend' : 'sent', nick, tag };
  }
  async accept({ acct }) {
    const F = this.core; F.tidy();
    if (F.st(acct) !== 'recv') return { ok: false, why: 'no request' };
    if (F.count('friend') >= FR_MAX) return { ok: false, why: 'full' };
    const r = await this.tell(acct, 'accept');
    if (!r) return { ok: false, why: 'try again' };
    if (r.st === 'friend') { F.set(acct, 'friend'); return { ok: true, st: 'friend' }; }
    F.drop(acct); return { ok: true, st: null };
  }
  // turned down: gone from this list; the sender is not told (theirs goes in its 7 days)
  async decline({ acct }) { const F = this.core; if (F.st(acct) === 'recv') F.drop(acct); return { ok: true }; }
  async remove({ acct }) {
    const F = this.core, st = F.st(acct); if (!st) return { ok: true };
    F.drop(acct); if (isAcct(acct) && st !== 'blocked') await this.tell(acct, 'remove');
    return { ok: true };
  }
  async block({ acct }) {
    if (!isAcct(acct) && !GHOST.test(acct || '')) return { ok: false, why: 'who' };
    const F = this.core, st = F.st(acct), r = F.row(acct);
    F.drop(acct); F.set(acct, 'blocked', r && r.nick, r && r.tag);
    // (a friend: off their list, as removed; one who only asked keeps theirs waiting till its 7 days - never told)
    if (isAcct(acct) && st === 'friend') await this.tell(acct, 'remove');
    return { ok: true };
  }
  async unblock({ acct }) { const F = this.core; if (F.st(acct) === 'blocked') F.drop(acct); return { ok: true }; }
  // a game with a friend: the code the app opened for them (/v1/invite/open), put on their list for two minutes
  async invite({ acct, code, mode, rules }) {
    if (this.core.st(acct) !== 'friend') return { ok: false, why: 'not a friend' };
    const r = await this.tell(acct, 'invite', { code: String(code || '').toUpperCase(), mode, rules });
    return r && r.st === 'friend' ? { ok: true } : { ok: false, why: 'not a friend' };
  }
  async uninvite({ acct }) { if (isAcct(acct)) await this.tell(acct, 'uninvite'); return { ok: true }; }
  // an invitation answered (taken or not): off this list
  drop({ acct }) { this.core.sql.exec(`DELETE FROM fr_inbox WHERE acct = ?`, String(acct || '')); return { ok: true }; }
  /* the list: friends with their faces and where they are, requests both ways, invitations; friends whose account is
     gone (no face) leave it */
  async list() {
    const { rows, inbox } = this.core.all(), real = rows.filter(r => isAcct(r.acct)).map(r => r.acct);
    const fc = real.length ? await this.dir('/dir/faces', { accts: real }) : { faces: {} }, faces = (fc && fc.faces) || {};
    const out = { friends: [], recv: [], sent: [], blocked: [] };
    for (const r of rows) {
      const f = faces[r.acct];
      if (isAcct(r.acct) && !f && r.st !== 'blocked') { if (fc && fc.ok) this.core.drop(r.acct); continue; }
      const one = { acct: r.acct, nick: f ? f.nick : r.nick, tag: f ? f.tag : r.tag, at: r.at };
      if (r.st === 'friend') out.friends.push(Object.assign(one, { face: f ? f.face : {}, seen: f ? f.seen : 0, doing: f ? f.doing : null, w: r.w, l: r.l, d: r.d }));
      else if (r.st === 'recv') out.recv.push(Object.assign(one, { face: f ? f.face : {} }));
      else if (r.st === 'sent') out.sent.push(one);
      else if (r.st === 'blocked') out.blocked.push(one);
    }
    out.inbox = inbox.filter(i => out.friends.some(f => f.acct === i.acct));
    return Object.assign({ ok: true, me: { nick: this.me.nick, tag: this.me.tag } }, out);
  }
}

/* ---------- a request to /v1/friends or /v1/friend/<what>, in the vault (vault.js), with the ways out ----------
   core: the VaultCore; hooks: { acct, dir(path, body), vault(acct, path, body), room(id, path, body), cache: {} kept
   between requests (when the face was last written) }. The handle is made the first time: a member's own nickname, a
   guest's the name the app plays under (body.name) - and changed with it. */
export async function friendsRoute(core, what, body, { acct, dir, vault, room, cache }) {
  body = body || {}; cache = cache || {};
  const safe = f => (...a) => Promise.resolve().then(() => f(...a)).catch(() => null);
  dir = safe(dir); room = safe(room);
  const me = core.me(); let nick = me.nick, tag = core.get('tag', null);
  const want = me.joined ? me.nick : (cleanNick(body.name) || me.nick);
  if (want && (!tag || want !== nick)) {
    const c = await dir('/dir/handle', { acct, nick: want, tag });
    if (c && c.ok) { if (c.nick !== nick) core.set('nick', c.nick); core.set('tag', c.tag); nick = c.nick; tag = c.tag; }
  }
  const flow = new FriendsFlow({ core: core.fr, dir, vault, room, me: { acct, nick, tag } });
  if (what === 'friends' || what === 'friend/hi') {
    // (the face its friends see: the rating from here; the card's look and the 연속 출석 days as the app says - only a look)
    const look = body.look && typeof body.look === 'object' ? body.look : {};
    const face = { dama: me.dama, joined: !!me.joined, card: typeof look.card === 'string' && core.known('card', look.card) ? look.card : null,
      title: typeof look.title === 'string' && core.known('title', look.title) ? look.title : null, streak: Math.max(0, Math.min(9999, look.streak | 0)), icon: Math.max(0, Math.min(63, look.icon | 0)) };
    const doing = typeof body.doing === 'string' && /^[a-z]{2,12}$/.test(body.doing) ? body.doing : null;
    const key = JSON.stringify([face, doing]), t = Date.now();
    if (tag && (key !== cache.faceKey || t - (cache.faceAt || 0) > FACE_EVERY)) { const r = await dir('/dir/face', { acct, face, doing, seen: t }); if (r && r.ok) { cache.faceKey = key; cache.faceAt = t; } }
    if (what === 'friend/hi') return { ok: true };
    return Object.assign(await flow.list(), { now: t });
  }
  const w = what.startsWith('friend/') ? what.slice(7) : '';
  if (['add', 'accept', 'decline', 'remove', 'block', 'unblock', 'invite', 'uninvite', 'drop'].includes(w)) {
    if (w !== 'drop' && w !== 'decline' && !tag) return { ok: false, why: 'no name' };
    const r = await flow[w](body);
    return Object.assign({ me: { nick, tag } }, r);
  }
  return { ok: false, why: 'no such thing' };
}
