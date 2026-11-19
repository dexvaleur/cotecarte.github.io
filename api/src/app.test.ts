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
  config = loadConfig({ NODE_ENV: 'test', TCGDEX_URL: `http://127.0.0.1:${port}`, AUTH_SECRET: 'secret-de-test-assez-long' })
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
  assert.deepEqual(parseFrom('Poké Card <moi@gmail.com>'), { name: 'Poké Card', email: 'moi@gmail.com' })
  assert.deepEqual(parseFrom('moi@gmail.com'), { email: 'moi@gmail.com' })
  const calls: { url: string; init: RequestInit }[] = []
  const fakeFetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return new Response('{}', { status: 201 })
  }) as unknown as typeof fetch
  const config = { BREVO_API_KEY: 'cle', MAIL_FROM: 'Poké Card <moi@gmail.com>' } as never
  const mailer = await createMailer(config, () => {}, fakeFetch)
  await mailer.sendLoginCode('ami@gmail.com', '123456')
  assert.equal(calls[0].url, 'https://api.brevo.com/v3/smtp/email')
  const body = JSON.parse(String(calls[0].init.body))
  assert.deepEqual(body.sender, { name: 'Poké Card', email: 'moi@gmail.com' })
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
