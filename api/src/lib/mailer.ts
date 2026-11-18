import type { Config } from '../config.js'

/** Envoie le code de connexion. Sans SMTP configuré, le code est affiché dans le terminal. */
export interface Mailer {
  sendLoginCode(email: string, code: string): Promise<void>
  /** true si les emails ne partent pas vraiment (mode développement) */
  readonly console: boolean
}

export async function createMailer(config: Config, log: (msg: string) => void): Promise<Mailer> {
  if (!config.SMTP_URL) {
    return {
      console: true,
      async sendLoginCode(email, code) {
        log(`📧 [mode dev] Code de connexion pour ${email} : ${code}`)
      },
    }
  }
  const { default: nodemailer } = await import('nodemailer')
  const transport = nodemailer.createTransport(config.SMTP_URL)
  return {
    console: false,
    async sendLoginCode(email, code) {
      await transport.sendMail({
        from: config.MAIL_FROM,
        to: email,
        subject: `${code} est ton code Poké Card`,
        text: `Bonjour !\n\nVoici ton code de connexion à Poké Card : ${code}\n\nIl est valable 15 minutes. Si tu n'as rien demandé, ignore simplement cet email.\n`,
        html: `<p>Bonjour !</p><p>Voici ton code de connexion à <b>Poké Card</b> :</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p><p>Il est valable 15 minutes. Si tu n'as rien demandé, ignore simplement cet email.</p>`,
      })
    },
  }
}
