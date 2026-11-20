// Tests du serveur : lance-les avec « npm test » dans le dossier api/.
// Base PGlite en mémoire + faux TCGdex local : aucun accès à internet nécessaire.
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, before, describe, test } from 'node:test'
import type { FastifyInstance } from 'fastify'
import { buildApp } from './app.js'
import { loadConfig } from './config.js'
import { createDb, migrate, type Db } from './db/index.js'
import { snapshotPrices } from './jobs.js'
import type { Mailer } from './lib/mailer.js'

// --- Faux TCGdex -------------------------------------------------------------
let tcgdexCalls = 0
let tcgdexDown = false
const fakeCard = {
  id: 'sv03.5-006',
  localId: '006',
  name: 'Dracaufeu-ex',
  rarity: 'Double rare',
  types: ['Feu'],
  pricing: { cardmarket: { trend: 7.87, avg: 7.76, low: 3.98, avg30: 8.12 }, tcgplayer: { holofoil: { marketPrice: 7.55 } } },
}
const tcgdex: Server = createServer((req, res) => {
  tcgdexCalls++
  if (tcgdexDown) return res.writeHead(500).end()
  if (req.url === '/v2/fr/cards/sv03.5-006') return res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(fakeCard))
  if (req.url === '/v2/ja/cards/SV2a-006')
    return res
      .writeHead(200, { 'content-type': 'application/json' })
      .end(JSON.stringify({ ...fakeCard, id: 'SV2a-006', name: 'リザードンex', pricing: { cardmarket: { trend: 2.87 } } }))
  res.writeHead(404).end()
})

// --- Serveur testé ------------------------------------------------------------
let app: FastifyInstance
let db: Db
const sentCodes: string[] = []
const mailer: Mailer = {
  console: true,
  async sendLoginCode(_email, code) {
    sentCodes.push(code)
  },
}
let config: ReturnType<typeof loadConfig>

before(async () => {
  await new Promise<void>((r) => tcgdex.listen(0, '127.0.0.1', r))
  const port = (tcgdex.address() as AddressInfo).port
  config = loadConfig({
    NODE_ENV: 'test',
    TCGDEX_URL: `http://127.0.0.1:${port}`,
    AUTH_SECRET: 'secret-de-test-assez-long',
    ADMIN_EMAILS: 'Admin@Example.com',
  })
  db = await createDb(undefined) // PGlite en mémoire
  await migrate(db)
  app = await buildApp({ db, config, mailer })
})

after(async () => {
  await app.close()
  await db.close()
  tcgdex.close()
})

async function login(email: string): Promise<string> {
  const r = await app.inject({ method: 'POST', url: '/auth/request', payload: { email, consent: true } })
  assert.equal(r.statusCode, 200)
  const code = r.json().devCode as string
  const v = await app.inject({ method: 'POST', url: '/auth/verify', payload: { email, code } })
  assert.equal(v.statusCode, 200)
  return v.json().token
}

const item = (over: Record<string, unknown> = {}) => ({
  cardId: 'sv03.5-006',
  name: 'Dracaufeu-ex',
  setId: 'sv03.5',
  setName: '151',
  localId: '006',
  rarity: 'Double rare',
  types: ['Feu'],
  condition: 'NM',
  quantity: 1,
  priceEur: 7.87,
  ...over,
})

describe('connexion par email', () => {
  test('code envoyé, mauvais code refusé, bon code accepté', async () => {
    const r = await app.inject({ method: 'POST', url: '/auth/request', payload: { email: '  Sacha@Example.com ', consent: true } })
    assert.equal(r.statusCode, 200)
    assert.match(r.json().devCode, /^\d{6}$/)
    const code = r.json().devCode as string
    const wrong = code === '000000' ? '111111' : '000000'

    const bad = await app.inject({ method: 'POST', url: '/auth/verify', payload: { email: 'sacha@example.com', code: wrong } })
    assert.equal(bad.statusCode, 400)
    assert.equal(bad.json().error, 'Code incorrect.')

    const ok = await app.inject({ method: 'POST', url: '/auth/verify', payload: { email: 'sacha@example.com', code } })
    assert.equal(ok.statusCode, 200)
    assert.equal(ok.json().user.email, 'sacha@example.com')

    const me = await app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${ok.json().token}` } })
    assert.equal(me.json().user.email, 'sacha@example.com')

    // Un code ne sert qu'une fois.
    const again = await app.inject({ method: 'POST', url: '/auth/verify', payload: { email: 'sacha@example.com', code } })
    assert.equal(again.statusCode, 400)
  })

  test('email invalide refusé', async () => {
    const r = await app.inject({ method: 'POST', url: '/auth/request', payload: { email: 'pas-un-email', consent: true } })
    assert.equal(r.statusCode, 400)
  })

  test('case 15 ans / conditions obligatoire', async () => {
    const r = await app.inject({ method: 'POST', url: '/auth/request', payload: { email: 'jeune@example.com' } })
    assert.equal(r.statusCode, 400)
    assert.match(r.json().error, /15 ans/)
  })

  test('5 essais maximum par code', async () => {
    const email = 'essais@example.com'
    const r = await app.inject({ method: 'POST', url: '/auth/request', payload: { email, consent: true } })
    const code = r.json().devCode as string
    const wrong = code === '123456' ? '654321' : '123456'
    for (let i = 0; i < 5; i++) await app.inject({ method: 'POST', url: '/auth/verify', payload: { email, code: wrong } })
    const blocked = await app.inject({ method: 'POST', url: '/auth/verify', payload: { email, code } })
    assert.equal(blocked.statusCode, 429)
  })

  test('5 codes maximum par heure', async () => {
    const email = 'rafale@example.com'
    for (let i = 0; i < 5; i++) await app.inject({ method: 'POST', url: '/auth/request', payload: { email, consent: true } })
    const r = await app.inject({ method: 'POST', url: '/auth/request', payload: { email, consent: true } })
    assert.equal(r.statusCode, 429)
  })

  test('jeton invalide = non connecté', async () => {
    const r = await app.inject({ method: 'GET', url: '/collection', headers: { authorization: 'Bearer faux' } })
    assert.equal(r.statusCode, 401)
  })
})

describe('collection', () => {
  test('ajout, ajout répété sans doublon, modification, suppression', async () => {
    const token = await login('collec@example.com')
    const headers = { authorization: `Bearer ${token}` }
    const uid = '7d3f0a52-9c1e-4c1e-8a7e-1d2c3b4a5f60'

    for (let i = 0; i < 2; i++) {
      const r = await app.inject({ method: 'PUT', url: `/collection/items/${uid}`, headers, payload: item() })
      assert.equal(r.statusCode, 200)
    }
    let list = (await app.inject({ method: 'GET', url: '/collection', headers })).json()
    assert.equal(list.items.length, 1)

    await app.inject({ method: 'PUT', url: `/collection/items/${uid}`, headers, payload: item({ quantity: 3, condition: 'EX' }) })
    list = (await app.inject({ method: 'GET', url: '/collection', headers })).json()
    assert.equal(list.items[0].quantity, 3)
    assert.equal(list.items[0].condition, 'EX')
    assert.deepEqual(list.items[0].types, ['Feu'])

    await app.inject({ method: 'DELETE', url: `/collection/items/${uid}`, headers })
    list = (await app.inject({ method: 'GET', url: '/collection', headers })).json()
    assert.equal(list.items.length, 0)
  })

  test('impossible de modifier l’exemplaire d’un autre compte', async () => {
    const a = await login('a@example.com')
    const b = await login('b@example.com')
    const uid = '11111111-2222-4333-8444-555555555555'
    await app.inject({ method: 'PUT', url: `/collection/items/${uid}`, headers: { authorization: `Bearer ${a}` }, payload: item() })
    const r = await app.inject({
      method: 'PUT',
      url: `/collection/items/${uid}`,
      headers: { authorization: `Bearer ${b}` },
      payload: item({ quantity: 99 }),
    })
    assert.equal(r.statusCode, 409)
    const listA = (await app.inject({ method: 'GET', url: '/collection', headers: { authorization: `Bearer ${a}` } })).json()
    assert.equal(listA.items[0].quantity, 1)
  })

  test('données invalides refusées', async () => {
    const token = await login('invalide@example.com')
    const r = await app.inject({
      method: 'PUT',
      url: '/collection/items/22222222-2222-4333-8444-555555555555',
      headers: { authorization: `Bearer ${token}` },
      payload: item({ condition: 'PARFAIT', quantity: 0 }),
    })
    assert.equal(r.statusCode, 400)
  })

  test('import du téléphone + wishlist', async () => {
    const token = await login('import@example.com')
    const headers = { authorization: `Bearer ${token}` }
    const r = await app.inject({
      method: 'POST',
      url: '/collection/import',
      headers,
      payload: {
        items: [{ ...item(), uid: '33333333-2222-4333-8444-555555555555', addedAt: '2026-11-01T10:00:00.000Z' }],
        wishlist: [{ cardId: 'base1-4', name: 'Dracaufeu', setName: 'Set de Base' }],
      },
    })
    assert.equal(r.json().imported, 1)
    const list = (await app.inject({ method: 'GET', url: '/collection', headers })).json()
    assert.equal(list.items[0].addedAt, '2026-11-01T10:00:00.000Z')
    assert.equal(list.wishlist[0].cardId, 'base1-4')

    await app.inject({ method: 'DELETE', url: '/wishlist/base1-4', headers })
    assert.equal((await app.inject({ method: 'GET', url: '/collection', headers })).json().wishlist.length, 0)
  })

  test('suppression du compte : tout est effacé', async () => {
    const token = await login('adieu@example.com')
    const headers = { authorization: `Bearer ${token}` }
    await app.inject({ method: 'PUT', url: '/collection/items/44444444-2222-4333-8444-555555555555', headers, payload: item() })
    assert.equal((await app.inject({ method: 'DELETE', url: '/me', headers })).statusCode, 200)
    assert.equal((await app.inject({ method: 'GET', url: '/me', headers })).statusCode, 401)
    const rows = await db.query("SELECT 1 FROM collection_items WHERE uid = '44444444-2222-4333-8444-555555555555'")
    assert.equal(rows.length, 0)
  })
})

describe('cartes, cache et prix', () => {
  test('relais TCGdex : cache, prix du jour enregistré, copie de secours', async () => {
    tcgdexCalls = 0
    const first = await app.inject({ method: 'GET', url: '/tcgdex/v2/fr/cards/sv03.5-006' })
    assert.equal(first.statusCode, 200)
    assert.equal(first.headers['x-cache'], 'miss')
    assert.equal(first.json().name, 'Dracaufeu-ex')

    const second = await app.inject({ method: 'GET', url: '/tcgdex/v2/fr/cards/sv03.5-006' })
    assert.equal(second.headers['x-cache'], 'hit')
    assert.equal(tcgdexCalls, 1)

    const history = (await app.inject({ method: 'GET', url: '/prices/sv03.5-006/history' })).json()
    assert.equal(history.points.length, 1)
    assert.equal(history.points[0].trend, 7.87)

    // TCGdex en panne + cache expiré : on sert la dernière copie.
    await db.query(`UPDATE api_cache SET fetched_at = now() - interval '2 days'`)
    tcgdexDown = true
    const stale = await app.inject({ method: 'GET', url: '/tcgdex/v2/fr/cards/sv03.5-006' })
    assert.equal(stale.statusCode, 200)
    assert.equal(stale.headers['x-cache'], 'stale')
    tcgdexDown = false
  })

  test('chemins non autorisés refusés', async () => {
    assert.equal((await app.inject({ method: 'GET', url: '/tcgdex/v2/fr/../../etc/passwd' })).statusCode, 404)
    assert.equal((await app.inject({ method: 'GET', url: '/tcgdex/v2/fr/users' })).statusCode, 404)
  })

  test('relais d’images limité à TCGdex', async () => {
    const r = await app.inject({ method: 'GET', url: '/img?u=' + encodeURIComponent('https://exemple.com/a.png') })
    assert.equal(r.statusCode, 403)
    const local = await app.inject({ method: 'GET', url: '/img?u=' + encodeURIComponent('http://127.0.0.1/a.png') })
    assert.equal(local.statusCode, 403)
  })

  test('prix actuels en lot + valeur de la collection dans le temps', async () => {
    const latest = await app.inject({ method: 'POST', url: '/prices/latest', payload: { ids: ['sv03.5-006', 'inconnue-1'] } })
    assert.equal(latest.json().prices['sv03.5-006'].eur, 7.87)
    assert.deepEqual(latest.json().prices['sv03.5-006'].types, ['Feu'])
    assert.equal(latest.json().prices['inconnue-1'], undefined)

    const token = await login('valeur@example.com')
    const headers = { authorization: `Bearer ${token}` }
    await app.inject({
      method: 'PUT',
      url: '/collection/items/55555555-2222-4333-8444-555555555555',
      headers,
      payload: item({ quantity: 2, condition: 'EX', addedAt: '2026-01-01T00:00:00.000Z' }),
    })
    // Un prix plus ancien, pour avoir deux points sur la courbe.
    await db.query(`INSERT INTO price_snapshots (card_id, day, trend) VALUES ('sv03.5-006', current_date - 3, 10) ON CONFLICT DO NOTHING`)
    const h = (await app.inject({ method: 'GET', url: '/collection/value-history', headers })).json()
    assert.equal(h.points.length, 2)
    assert.equal(h.points[0].value, 10 * 2 * 0.8)
    assert.ok(Math.abs(h.points[1].value - 7.87 * 2 * 0.8) < 1e-9)
  })

  test('tâche quotidienne : photographie les cartes suivies', async () => {
    await db.query(`DELETE FROM price_snapshots WHERE day = current_date`)
    const n = await snapshotPrices(db, config)
    assert.ok(n >= 1)
    const rows = await db.query(`SELECT 1 FROM price_snapshots WHERE card_id = 'sv03.5-006' AND day = current_date`)
    assert.equal(rows.length, 1)
  })
})

test('cartes japonaises : prix et historique avec l’identifiant « ja:… »', async () => {
  const r = await app.inject({ method: 'POST', url: '/prices/latest', payload: { ids: ['ja:SV2a-006'] } })
  assert.equal(r.json().prices['ja:SV2a-006'].eur, 2.87)
  const h = await app.inject({ method: 'GET', url: '/prices/ja%3ASV2a-006/history' })
  assert.equal(h.json().points.at(-1).trend, 2.87)
  const proxy = await app.inject({ method: 'GET', url: '/tcgdex/v2/ja/cards/SV2a-006' })
  assert.equal(proxy.statusCode, 200)
})

describe('classeurs', () => {
  const binder = (over: Record<string, unknown> = {}) => ({
    name: 'Mon classeur Feu',
    color: '#e8572a',
    perPage: 9,
    slots: [{ cardId: 'sv03.5-006', name: 'Dracaufeu-ex', image: null }, null],
    createdAt: '2026-11-19T10:00:00.000Z',
    updatedAt: '2026-11-19T10:00:00.000Z',
    ...over,
  })
  const id = '6f0c4a43-8c51-4a7a-9f43-1b3a8c0b2e11'

  test('création, version plus récente, ancienne version ignorée, suppression', async () => {
    const token = await login('classeur@example.com')
    const auth = { authorization: `Bearer ${token}` }
    const put = (body: unknown) => app.inject({ method: 'PUT', url: `/binders/${id}`, headers: auth, payload: body })
    assert.equal((await put(binder())).statusCode, 200)
    assert.equal((await put(binder({ name: 'Renommé', updatedAt: '2026-11-19T11:00:00.000Z' }))).statusCode, 200)
    assert.equal((await put(binder({ name: 'Vieux', updatedAt: '2026-11-19T09:00:00.000Z' }))).statusCode, 200)
    assert.equal((await put(binder({ perPage: 7 }))).statusCode, 400)

    let data = (await app.inject({ method: 'GET', url: '/collection', headers: auth })).json()
    assert.equal(data.binders.length, 1)
    assert.equal(data.binders[0].name, 'Renommé')
    assert.equal(data.binders[0].slots[1], null)

    // Un autre compte ne peut pas écraser ce classeur.
    const other = await login('pirate@example.com')
    const stolen = await app.inject({ method: 'PUT', url: `/binders/${id}`, headers: { authorization: `Bearer ${other}` }, payload: binder({ updatedAt: '2027-01-01T00:00:00.000Z' }) })
    assert.equal(stolen.statusCode, 409)

    await app.inject({ method: 'DELETE', url: `/binders/${id}`, headers: auth })
    data = (await app.inject({ method: 'GET', url: '/collection', headers: auth })).json()
    assert.equal(data.binders.length, 0)
  })
})

test('profil : pseudo et avatar enregistrés, refus si trop gros', async () => {
  const token = await login('profil@example.com')
  const auth = { authorization: `Bearer ${token}` }
  assert.equal((await app.inject({ method: 'GET', url: '/profile', headers: auth })).json().profile, null)
  const body = { pseudo: 'Sacha', avatar: { gender: 'boy', height: 0.5, skin: '#c68642' }, updatedAt: '2026-11-19T10:00:00.000Z' }
  assert.equal((await app.inject({ method: 'PUT', url: '/profile', headers: auth, payload: body })).statusCode, 200)
  assert.equal((await app.inject({ method: 'GET', url: '/profile', headers: auth })).json().profile.pseudo, 'Sacha')
  const big = { ...body, pseudo: 'x'.repeat(50) }
  assert.equal((await app.inject({ method: 'PUT', url: '/profile', headers: auth, payload: big })).statusCode, 400)
  assert.equal((await app.inject({ method: 'GET', url: '/profile' })).statusCode, 401)
})

describe('statistiques de visite', () => {
  test('compteurs anonymes par jour, visibles par l’administrateur seulement', async () => {
    const hit = (events: unknown) => app.inject({ method: 'POST', url: '/stats/hit', payload: { events } })
    assert.equal((await hit(['open', 'visitor', 'new'])).statusCode, 204)
    assert.equal((await hit(['open', 'scan', 'scan'])).statusCode, 204)
    assert.equal((await hit(['pirate'])).statusCode, 400)
    assert.equal((await hit([])).statusCode, 400)

    const anon = await app.inject({ method: 'GET', url: '/admin/stats' })
    assert.equal(anon.statusCode, 401)
    const user = await login('curieux@example.com')
    const refused = await app.inject({ method: 'GET', url: '/admin/stats', headers: { authorization: `Bearer ${user}` } })
    assert.equal(refused.statusCode, 403)
    const me = await app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${user}` } })
    assert.equal(me.json().isAdmin, false)

    const admin = await login('admin@example.com')
    const meAdmin = await app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${admin}` } })
    assert.equal(meAdmin.json().isAdmin, true)
    const r = await app.inject({ method: 'GET', url: '/admin/stats', headers: { authorization: `Bearer ${admin}` } })
    assert.equal(r.statusCode, 200)
    const { totals, days } = r.json()
    assert.equal(days.length, 30)
    assert.deepEqual({ open: days[0].open, visitor: days[0].visitor, new: days[0].new, scan: days[0].scan }, { open: 2, visitor: 1, new: 1, scan: 1 })
    assert.ok(days[0].signups >= 2)
    assert.ok(totals.users >= 2)
    assert.equal(totals.visitors30, 1)
  })
})

describe('accès privé', () => {
  test('seuls les emails autorisés peuvent se connecter', async () => {
    const db2 = await createDb(undefined)
    await migrate(db2)
    const app2 = await buildApp({
      db: db2,
      config: loadConfig({ NODE_ENV: 'test', AUTH_SECRET: 'secret-de-test-assez-long', ALLOWED_EMAILS: ' Moi@Example.com , ami@example.com' }),
      mailer,
    })
    const refused = await app2.inject({ method: 'POST', url: '/auth/request', payload: { email: 'inconnu@example.com', consent: true } })
    assert.equal(refused.statusCode, 403)
    assert.match(refused.json().error, /accès privé/)
    const ok = await app2.inject({ method: 'POST', url: '/auth/request', payload: { email: 'moi@example.com', consent: true } })
    assert.equal(ok.statusCode, 200)
    const v = await app2.inject({ method: 'POST', url: '/auth/verify', payload: { email: 'moi@example.com', code: ok.json().devCode } })
    assert.equal(v.statusCode, 200)
    await app2.close()
    await db2.close()
  })
})

test('mailer Brevo : envoie le code via l’API HTTPS', async () => {
  const { createMailer, parseFrom } = await import('./lib/mailer.js')
  assert.deepEqual(parseFrom('DexValeur <moi@gmail.com>'), { name: 'DexValeur', email: 'moi@gmail.com' })
  assert.deepEqual(parseFrom('moi@gmail.com'), { email: 'moi@gmail.com' })
  const calls: { url: string; init: RequestInit }[] = []
  const fakeFetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return new Response('{}', { status: 201 })
  }) as unknown as typeof fetch
  const config = { BREVO_API_KEY: 'cle', MAIL_FROM: 'DexValeur <moi@gmail.com>' } as never
  const mailer = await createMailer(config, () => {}, fakeFetch)
  await mailer.sendLoginCode('ami@gmail.com', '123456')
  assert.equal(calls[0].url, 'https://api.brevo.com/v3/smtp/email')
  const body = JSON.parse(String(calls[0].init.body))
  assert.deepEqual(body.sender, { name: 'DexValeur', email: 'moi@gmail.com' })
  assert.deepEqual(body.to, [{ email: 'ami@gmail.com' }])
  assert.match(body.subject, /123456/)
  const failing = await createMailer(config, () => {}, (async () => new Response('bad key', { status: 401 })) as unknown as typeof fetch)
  await assert.rejects(failing.sendLoginCode('ami@gmail.com', '123456'), /Brevo 401/)
})

test('packs : statistiques d’une extension', async () => {
  const { computeSetStats } = await import('./packs.js')
  const pricing = (trend: number | null) => ({ cardmarket: { trend, avg: null, low: null, avg30: null } })
  const set = { id: 'x1', name: 'Test', releaseDate: '2025-01-01', serie: { id: 'me', name: 'Méga' }, cardCount: { official: 3, total: 5 } }
  const cards = [
    { id: 'x1-001', localId: '001', name: 'A', pricing: pricing(0.1) },
    { id: 'x1-002', localId: '002', name: 'B', pricing: pricing(6) },
    { id: 'x1-003', localId: '003', name: 'C', pricing: pricing(null) },
    { id: 'x1-004', localId: '004', name: 'D', pricing: pricing(25) },
    { id: 'x1-005', localId: '005', name: 'E', pricing: pricing(15) },
  ]
  const s = computeSetStats(set, cards)
  assert.equal(s.priced, 4)
  assert.deepEqual(s.top.map((c) => c.id), ['x1-004', 'x1-005', 'x1-002', 'x1-001'])
  assert.equal(s.over5, 3)
  assert.equal(s.over20, 1)
  assert.equal(s.secretCount, 2)
  assert.equal(s.secretAvg, 20)
  assert.equal(s.fullSetEur, 46.1)
})

test('packs : liste vide au premier lancement, sans erreur', async () => {
  const r = await app.inject({ method: 'GET', url: '/packs' })
  assert.equal(r.statusCode, 200)
  assert.deepEqual(r.json().sets, [])
})

test('actus : lecture du flux RSS et tri des articles « cartes »', async () => {
  const { parseRss, isCardNews } = await import('./news.js')
  const xml = `<rss><channel>
    <item><title><![CDATA[Nouvelle extension JCC : Règne Delta]]></title><link>https://www.pokebip.com/a</link>
      <pubDate>Thu, 12 Nov 2026 10:00:00 +0100</pubDate><description>&lt;p&gt;Les boosters arrivent &amp;amp; plus&lt;/p&gt;</description>
      <enclosure url="https://www.pokebip.com/a.jpg" type="image/jpeg"/></item>
    <item><title>Pokémon Pocket : nouveau booster promo</title><link>https://www.pokebip.com/b</link><pubDate>Thu, 12 Nov 2026 09:00:00 +0100</pubDate></item>
    <item><title>Pokémon GO : Journée de Raids</title><link>https://www.pokebip.com/c</link></item>
    <item><title>Lien douteux</title><link>javascript:alert(1)</link></item>
  </channel></rss>`
  const items = parseRss(xml, 'Pokébip')
  assert.equal(items.length, 3)
  assert.equal(items[0].title, 'Nouvelle extension JCC : Règne Delta')
  assert.equal(items[0].image, 'https://www.pokebip.com/a.jpg')
  assert.equal(items[0].date, '2026-11-12T09:00:00.000Z')
  assert.deepEqual(items.filter(isCardNews).map((a) => a.link), ['https://www.pokebip.com/a'])
})

test('actus : réponse sans données ni réseau', async () => {
  const { buildNews, resetNewsCache } = await import('./news.js')
  resetNewsCache()
  const offline = (async () => {
    throw new Error('hors ligne')
  }) as unknown as typeof fetch
  const n = await buildNews(db, offline)
  assert.deepEqual(n, { releases: [], up: [], down: [], articles: [] })
})

describe('onglet Vendre : annonces et chat', () => {
  // Petit « JPEG » valide pour le serveur (commence par FF D8).
  const jpeg = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.alloc(300, 7)]).toString('base64')
  const auth = (t: string) => ({ authorization: `Bearer ${t}` })
  const setPseudo = (t: string, pseudo: string) =>
    app.inject({ method: 'PUT', url: '/profile', headers: auth(t), payload: { pseudo, avatar: { gender: 'boy' }, updatedAt: new Date().toISOString() } })

  test('publier, chercher, discuter, bloquer, signaler', async () => {
    const sacha = await login('sacha@example.com')
    const ondine = await login('ondine@example.com')
    const ad = { title: 'Dracaufeu ex 151', description: 'Très bon état #rare', hashtags: ['#Dracaufeu', 'ex', 'pas bon!'], kind: 'vente', priceEur: 12, condition: 'NM', photos: [jpeg] }

    // Sans pseudo, on ne peut pas publier.
    let r = await app.inject({ method: 'POST', url: '/listings', headers: auth(sacha), payload: ad })
    assert.equal(r.statusCode, 400)
    assert.equal(r.json().code, 'pseudo')
    await setPseudo(sacha, 'Sacha')
    await setPseudo(ondine, 'Ondine')

    r = await app.inject({ method: 'POST', url: '/listings', headers: auth(sacha), payload: { ...ad, photos: [] } })
    assert.equal(r.statusCode, 400)
    r = await app.inject({ method: 'POST', url: '/listings', headers: auth(sacha), payload: { ...ad, photos: ['data:image/jpeg;base64,AAAA'] } })
    assert.equal(r.statusCode, 400)
    r = await app.inject({ method: 'POST', url: '/listings', headers: auth(sacha), payload: ad })
    assert.equal(r.statusCode, 200)
    const id = r.json().id as string

    // Visible par tous, sans email, avec hashtags nettoyés.
    r = await app.inject({ method: 'GET', url: '/listings' })
    const list = r.json().listings
    assert.equal(list.length, 1)
    assert.deepEqual(list[0].hashtags, ['dracaufeu', 'ex', 'pasbon'])
    assert.equal(list[0].seller.pseudo, 'Sacha')
    assert.ok(!JSON.stringify(r.json()).includes('@example.com'))
    assert.equal((await app.inject({ method: 'GET', url: '/listings?tag=%23dracaufeu' })).json().listings.length, 1)
    assert.equal((await app.inject({ method: 'GET', url: '/listings?q=dracau' })).json().listings.length, 1)
    assert.equal((await app.inject({ method: 'GET', url: '/listings?q=pikachu' })).json().listings.length, 0)
    r = await app.inject({ method: 'GET', url: `/listings/${id}/photos/0` })
    assert.equal(r.statusCode, 200)
    assert.equal(r.headers['content-type'], 'image/jpeg')

    // Ondine ne peut pas modifier l'annonce de Sacha.
    r = await app.inject({ method: 'PUT', url: `/listings/${id}/status`, headers: auth(ondine), payload: { status: 'vendue' } })
    assert.equal(r.statusCode, 403)

    // Chat : Ondine contacte Sacha.
    r = await app.inject({ method: 'POST', url: `/listings/${id}/chat`, headers: auth(sacha) })
    assert.equal(r.statusCode, 400) // pas avec soi-même
    r = await app.inject({ method: 'POST', url: `/listings/${id}/chat`, headers: auth(ondine) })
    const chatId = r.json().id as string
    assert.equal((await app.inject({ method: 'POST', url: `/listings/${id}/chat`, headers: auth(ondine) })).json().id, chatId)
    // Pas encore de message : Sacha ne voit pas la discussion.
    assert.equal((await app.inject({ method: 'GET', url: '/chats', headers: auth(sacha) })).json().chats.length, 0)
    r = await app.inject({ method: 'POST', url: `/chats/${chatId}/messages`, headers: auth(ondine), payload: { body: 'Bonjour, elle est dispo ?' } })
    assert.equal(r.statusCode, 200)
    assert.equal((await app.inject({ method: 'GET', url: '/chats/unread', headers: auth(sacha) })).json().count, 1)
    r = await app.inject({ method: 'GET', url: '/chats', headers: auth(sacha) })
    assert.equal(r.json().chats[0].other.pseudo, 'Ondine')
    assert.equal(r.json().chats[0].unread, 1)
    r = await app.inject({ method: 'GET', url: `/chats/${chatId}`, headers: auth(sacha) })
    assert.equal(r.json().messages[0].body, 'Bonjour, elle est dispo ?')
    assert.equal(r.json().messages[0].mine, false)
    assert.equal((await app.inject({ method: 'GET', url: '/chats/unread', headers: auth(sacha) })).json().count, 0)

    // Un inconnu ne peut pas lire la discussion.
    const pierre = await login('pierre@example.com')
    assert.equal((await app.inject({ method: 'GET', url: `/chats/${chatId}`, headers: auth(pierre) })).statusCode, 404)

    // Sacha bloque Ondine : plus de messages, et Ondine ne voit plus ses annonces.
    await app.inject({ method: 'POST', url: `/users/${r.json().chat.other.id}/block`, headers: auth(sacha) })
    r = await app.inject({ method: 'POST', url: `/chats/${chatId}/messages`, headers: auth(ondine), payload: { body: 'Allô ?' } })
    assert.equal(r.statusCode, 403)
    assert.equal((await app.inject({ method: 'GET', url: '/listings', headers: auth(ondine) })).json().listings.length, 0)

    // Signalement, visible par l'administrateur.
    r = await app.inject({ method: 'POST', url: `/listings/${id}/report`, headers: auth(pierre), payload: { reason: 'Fausse carte' } })
    assert.equal(r.statusCode, 200)
    const admin = await login('admin@example.com')
    r = await app.inject({ method: 'GET', url: '/admin/reports', headers: auth(admin) })
    assert.equal(r.json().reports[0].reason, 'Fausse carte')
    assert.equal((await app.inject({ method: 'GET', url: '/admin/reports', headers: auth(pierre) })).statusCode, 403)

    // Vendue : disparaît du fil mais reste dans « Mes annonces ».
    await app.inject({ method: 'PUT', url: `/listings/${id}/status`, headers: auth(sacha), payload: { status: 'vendue' } })
    assert.equal((await app.inject({ method: 'GET', url: '/listings' })).json().listings.length, 0)
    assert.equal((await app.inject({ method: 'GET', url: '/listings?mine=1', headers: auth(sacha) })).json().listings.length, 1)

    // L'administrateur peut supprimer une annonce.
    r = await app.inject({ method: 'DELETE', url: `/listings/${id}`, headers: auth(admin) })
    assert.equal(r.statusCode, 200)
    assert.equal((await app.inject({ method: 'GET', url: `/listings/${id}` })).statusCode, 404)
  })
})
