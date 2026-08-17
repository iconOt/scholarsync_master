import React, { useState } from 'react'

type Props = {
  onDone?: () => void
}

export default function OnboardingPage({ onDone }: Props) {
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [owner, setOwner] = useState('')
  const [email, setEmail] = useState('')

  const next = () => setStep((s) => Math.min(4, s + 1))
  const prev = () => setStep((s) => Math.max(1, s - 1))

  const submit = async () => {
    // call API to create school provisioning job
    try {
      const res = await fetch('/api/onboard', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ schoolName: name, subdomain: slug, proprietor: owner, email }) })
      if (res.ok) {
        onDone?.()
      } else {
        console.error('Onboarding failed', await res.text())
      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div>
      <h2>Onboarding wizard</h2>
      <p className="muted">Step {step} of 4</p>

      {step === 1 && (
        <div>
          <label>School name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
          <button onClick={next} className="primary-button">Next</button>
        </div>
      )}

      {step === 2 && (
        <div>
          <label>Subdomain slug</label>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} />
          <div>
            <button onClick={prev} className="secondary-button">Back</button>
            <button onClick={next} className="primary-button">Next</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <label>Proprietor contact</label>
          <input value={owner} onChange={(e) => setOwner(e.target.value)} />
          <label>Proprietor email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
          <div>
            <button onClick={prev} className="secondary-button">Back</button>
            <button onClick={next} className="primary-button">Next</button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div>
          <h3>Confirm</h3>
          <p>{name} — {slug}.scholarsync.ng — Owner: {owner}</p>
          <div>
            <button onClick={prev} className="secondary-button">Back</button>
            <button onClick={submit} className="primary-button">Create</button>
          </div>
        </div>
      )}
    </div>
  )
}
