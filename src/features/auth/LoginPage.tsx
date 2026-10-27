import { useEffect, useState, type FormEvent } from 'react'
import { Eye, EyeOff, LockKeyhole, Mail, MoveRight } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/app/AuthProvider'
import { Brand } from '@/components/Brand'
import { Button, Field, Notice, TextInput } from '@/components/ui'
import { useToast } from '@/components/ToastProvider'
import { supabase } from '@/lib/supabase'

export function LoginPage() {
  const { signIn, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { showToast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const target = (location.state as { from?: string } | null)?.from || '/dashboard'

  useEffect(() => {
    if (user) navigate(target, { replace: true })
  }, [user, navigate, target])

  if (user) {
    return null
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await signIn(email.trim(), password)
      showToast('Sesión iniciada. ¡Qué bueno tenerte de vuelta!')
      navigate(target, { replace: true })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Revisa el correo y la contraseña e inténtalo otra vez.'
      setError(message.includes('Invalid login') || message.includes('invalid_credentials')
        ? 'El correo o la contraseña no coinciden.'
        : message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login-page">
      <div className="login-page__glow login-page__glow--one" />
      <div className="login-page__glow login-page__glow--two" />
      <section className="login-card">
        <div className="login-card__brand"><Brand /></div>
        <div className="login-card__intro">
          <span className="eyebrow">panel de administración</span>
          <h1>Qué gusto<br /><em>verte por aquí.</em></h1>
          <p>Inicia sesión para continuar con tu negocio.</p>
        </div>

        {!supabase && (
          <Notice tone="warning">
            <strong>Falta conectar Supabase.</strong> Copia `.env.example` a `.env.local` y completa la URL y la clave anon. Para Vercel, agrégalas en Settings → Environment Variables.
          </Notice>
        )}
        {error && <Notice tone="error">{error}</Notice>}

        <form className="login-form" onSubmit={handleSubmit}>
          <Field label="Correo electrónico">
            <div className="input-with-icon"><Mail size={18} /><TextInput type="email" autoComplete="email" placeholder="tu@emprendimiento.com" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={!supabase} /></div>
          </Field>
          <Field label="Contraseña">
            <div className="input-with-icon"><LockKeyhole size={18} /><TextInput type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Tu contraseña" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={!supabase} /><button className="input-action" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}><span className="sr-only">{showPassword ? 'Ocultar' : 'Mostrar'}</span>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
          </Field>
          <Button className="login-submit" type="submit" loading={busy} disabled={!supabase} icon={<MoveRight size={17} />}>Entrar al panel</Button>
        </form>
        <p className="login-card__foot">Acceso privado · los usuarios los crea la administración</p>
      </section>
      <footer className="login-footer"><span>Fresas & Crema</span><span>hecho con cariño, para crecer contigo</span></footer>
    </main>
  )
}
