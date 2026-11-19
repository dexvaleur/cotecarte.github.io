import type { Config } from '../config.js'

/** Envoie le code de connexion. Sans SMTP configuré, le code est affiché dans le terminal. */
export interface Mailer {
  sendLoginCode(email: string, code: string): Promise<void>
  /** true si les emails ne partent pas vraiment (mode développement) */
  readonly console: boolean
}

const subject = (code: string) => `${code} est ton code Cote Carte`
const text = (code: string) =>
  `Bonjour !\n\nVoici ton code de connexion à Cote Carte : ${code}\n\nIl est valable 15 minutes. Si tu n'as rien demandé, ignore simplement cet email.\n`
const html = (code: string) =>
  `<p>Bonjour !</p><p>Voici ton code de connexion à <b>Cote Carte</b> :</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p><p>Il est valable 15 minutes. Si tu n'as rien demandé, ignore simplement cet email.</p>`

/** « Cote Carte <moi@gmail.com> » → { name, email } */
export function parseFrom(from: string): { name?: string; email: string } {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from)
  return m ? { name: m[1] || undefined, email: m[2].trim() } : { email: from.trim() }
}

export async function createMailer(config: Config, log: (msg: string) => void, fetchImpl: typeof fetch = fetch): Promise<Mailer> {
  // API web de Brevo (HTTPS) : fonctionne même chez les hébergeurs qui bloquent le SMTP (Render gratuit).
  if (config.BREVO_API_KEY) {
    const sender = parseFrom(config.MAIL_FROM)
    return {
      console: false,
      async sendLoginCode(email, code) {
        const res = await fetchImpl('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'api-key': config.BREVO_API_KEY!, 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ sender, to: [{ email }], subject: subject(code), textContent: text(code), htmlContent: html(code) }),
          signal: AbortSignal.timeout(15_000),
        })
        if (!res.ok) throw new Error(`Brevo ${res.status} : ${(await res.text()).slice(0, 300)}`)
      },
    }
  }
  if (!config.SMTP_URL) {
    return {
      console: true,
      async sendLoginCode(email, code) {
        log(`📧 [mode dev] Code de connexion pour ${email} : ${code}`)
      },
    }
  }
  const { default: nodemailer } = await import('nodemailer')
  // Délais courts : si le SMTP est bloqué, on répond une erreur au lieu d'attendre indéfiniment.
  const transport = nodemailer.createTransport(config.SMTP_URL, {
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  } as never)
  return {
    console: false,
    async sendLoginCode(email, code) {
      await transport.sendMail({
        from: config.MAIL_FROM,
        to: email,
        subject: subject(code),
        text: text(code),
        html: html(code),
      })
    },
  }
}
