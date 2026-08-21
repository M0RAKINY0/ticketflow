import { ArrowLeft, ArrowUpRight } from "lucide-react"
import { useState } from "react"

type LoginPageProps = {
  onBack: () => void
}

export function LoginPage({ onBack }: LoginPageProps) {
  const [submitted, setSubmitted] = useState(false)

  return (
    <div className="events-app login-view" id="top">
      <header className="site-header">
        <div className="nav-wrap login-nav">
          <button className="login-back" onClick={onBack} type="button">
            <ArrowLeft aria-hidden="true" size={15} />
            Back to events
          </button>
          <button className="brand-lockup login-brand" onClick={onBack} type="button">
            <span aria-hidden="true" className="brand-mark" />
            <span>Events</span>
          </button>
        </div>
      </header>

      <main className="login-main">
        <section aria-labelledby="login-title" className="login-panel">
          <p className="eyebrow">Member access</p>
          <h1 id="login-title">Log in to reserve your spot.</h1>
          <p className="login-intro">
            Keep your plans together and make the next reservation in a few taps.
          </p>
          <form
            className="login-form"
            onSubmit={(submitEvent) => {
              submitEvent.preventDefault()
              setSubmitted(true)
            }}
          >
            <label className="login-field" htmlFor="login-email">
              Email address
              <input autoComplete="email" id="login-email" required type="email" />
            </label>
            <label className="login-field" htmlFor="login-password">
              Password
              <input autoComplete="current-password" id="login-password" required type="password" />
            </label>
            <button className="primary-button login-submit" type="submit">
              Continue <ArrowUpRight aria-hidden="true" size={16} />
            </button>
          </form>
          {submitted ? (
            <p className="login-status" role="status">
              Login is not connected in this demo yet.
            </p>
          ) : null}
          <button className="secondary-button login-return" onClick={onBack} type="button">
            Return to browsing <ArrowLeft aria-hidden="true" size={16} />
          </button>
        </section>
      </main>
    </div>
  )
}
