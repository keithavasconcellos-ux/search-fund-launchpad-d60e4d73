import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { AUTH_KEY, isAuthed } from '@/components/auth/RequireAuth';

const VALID_EMAIL = 'kvasconcellos@mba2027.hbs.edu';
const VALID_PASSWORD = 'DSAIL2026!';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthed()) navigate('/', { replace: true });
  }, [navigate]);

  const triggerShake = () => {
    setShake(true);
    window.setTimeout(() => setShake(false), 380);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      triggerShake();
      setError('Enter your email and password.');
      return;
    }
    setSubmitting(true);
    window.setTimeout(() => {
      if (email.trim().toLowerCase() === VALID_EMAIL && password === VALID_PASSWORD) {
        sessionStorage.setItem(AUTH_KEY, '1');
        navigate('/', { replace: true });
      } else {
        setSubmitting(false);
        setError('Invalid credentials.');
        triggerShake();
      }
    }, 450);
  };

  return (
    <div className="acquira-login-root">
      <style>{loginStyles}</style>

      {/* LEFT */}
      <div className="al-left">
        <div className="al-nodes">
          <div className="al-node" style={{ width: 3, height: 3, background: 'var(--al-teal)', top: '18%', left: '12%', animationDuration: '6s', animationDelay: '-1s', boxShadow: '0 0 8px var(--al-teal)' }} />
          <div className="al-node" style={{ width: 2, height: 2, background: 'var(--al-teal)', top: '42%', left: '28%', animationDuration: '8s', animationDelay: '-3s', opacity: 0.4 }} />
          <div className="al-node" style={{ width: 4, height: 4, background: 'var(--al-teal2)', top: '65%', left: '8%', animationDuration: '7s', animationDelay: '-2s', boxShadow: '0 0 10px rgba(10,171,154,0.4)' }} />
          <div className="al-node" style={{ width: 2, height: 2, background: 'var(--al-teal)', top: '30%', left: '55%', animationDuration: '9s', animationDelay: '-4s', opacity: 0.3 }} />
          <div className="al-node" style={{ width: 3, height: 3, background: 'var(--al-teal)', top: '78%', left: '40%', animationDuration: '7.5s', animationDelay: '-.5s', opacity: 0.5 }} />
          <div className="al-node" style={{ width: 2, height: 2, background: 'var(--al-teal2)', top: '55%', left: '70%', animationDuration: '6.5s', animationDelay: '-2.5s', opacity: 0.35 }} />
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 800 900" preserveAspectRatio="none">
            <line x1="96" y1="162" x2="224" y2="378" stroke="#0fd4c0" strokeWidth=".5" opacity=".12" />
            <line x1="224" y1="378" x2="440" y2="270" stroke="#0fd4c0" strokeWidth=".5" opacity=".10" />
            <line x1="64" y1="585" x2="320" y2="702" stroke="#0fd4c0" strokeWidth=".5" opacity=".12" />
            <line x1="440" y1="270" x2="560" y2="495" stroke="#0fd4c0" strokeWidth=".5" opacity=".08" />
          </svg>
        </div>

        <div className="al-left-logo">
          <div className="al-logo-mark">
            <div className="al-logo-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 12L8 4L14 12" stroke="#0fd4c0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5 9L8 5L11 9" stroke="#0fd4c0" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity=".5" />
              </svg>
            </div>
            acquira
          </div>
          <div className="al-logo-sub">Search Fund Intelligence</div>
        </div>

        <div className="al-left-center">
          <h1 className="al-headline">
            Find the right<br />
            business.<br />
            <em>Own the process.</em>
          </h1>
          <p className="al-desc">
            The operating system for search fund acquirers. 30,000+ businesses tracked, outreach managed, and deals analysed — all in one place.
          </p>
          <div className="al-stats">
            <div className="al-stat"><div className="al-stat-num">30<span>K</span></div><div className="al-stat-label">Businesses</div></div>
            <div className="al-stat"><div className="al-stat-num">6<span>+</span></div><div className="al-stat-label">States tracked</div></div>
            <div className="al-stat"><div className="al-stat-num">8</div><div className="al-stat-label">DD memo sections</div></div>
          </div>
        </div>

        <div className="al-left-footer">
          <div className="al-quote">"In over 80% of the phone calls they knew who I was and had read the letters."</div>
          <div className="al-quote-attr">— Paul Thomson, Scottish American Capital · 2011</div>
        </div>
      </div>

      {/* RIGHT */}
      <div className="al-right">
        <form className="al-form-wrap" onSubmit={handleSubmit} noValidate>
          <div className="al-eyebrow">Welcome back</div>
          <h2 className="al-form-title">Sign in to Acquira</h2>
          <p className="al-form-sub">Your search, your pipeline, your deals.</p>

          <div className="al-field">
            <label className="al-field-label" htmlFor="al-email">Email address</label>
            <input
              id="al-email"
              className={`al-input ${email ? 'has-value' : ''}`}
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
            />
          </div>

          <div className="al-field">
            <div className="al-field-row">
              <label className="al-field-label" htmlFor="al-password" style={{ marginBottom: 0 }}>Password</label>
              <button type="button" className="al-forgot" onClick={() => setError('Access is by invitation. Contact the team.')}>Forgot password?</button>
            </div>
            <div className="al-pw-wrap">
              <input
                id="al-password"
                className={`al-input ${password ? 'has-value' : ''}`}
                type={showPw ? 'text' : 'password'}
                placeholder="••••••••••••"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={200}
              />
              <button
                type="button"
                className="al-pw-toggle"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && <div className="al-error">{error}</div>}

          <button
            type="submit"
            className={`al-submit ${shake ? 'al-shake' : ''}`}
            disabled={submitting}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="al-divider">
            <div className="al-divider-line" />
            <div className="al-divider-text">or continue with</div>
            <div className="al-divider-line" />
          </div>

          <button
            type="button"
            className="al-sso"
            onClick={() => setError('SSO is not enabled in private beta.')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>

          <div className="al-form-footer">
            Access is by invitation only.<br />
            <a href="#" onClick={(e) => e.preventDefault()}>Contact the team</a> if you need access.
          </div>
        </form>
      </div>

      <div className="al-version">v0.9.4 · private beta</div>
    </div>
  );
}

const loginStyles = `
.acquira-login-root {
  --al-bg: #060b12;
  --al-bg2: #0a1220;
  --al-bg3: #0e1928;
  --al-teal: #0fd4c0;
  --al-teal2: #0aab9a;
  --al-text: #e4edf8;
  --al-mid: #6b899e;
  --al-dim: #2e4460;
  --al-border: #112030;
  --al-border2: #1a3048;
  --al-input-bg: #091520;
  --al-input-border: #1a3050;

  position: fixed;
  inset: 0;
  display: flex;
  background: var(--al-bg);
  color: var(--al-text);
  font-family: 'DM Sans', sans-serif;
  overflow: hidden;
  z-index: 100;
}
.acquira-login-root * { box-sizing: border-box; }

.al-left {
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 52px 56px;
  overflow: hidden;
}
.al-left::before {
  content: '';
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse 60% 50% at 20% 60%, rgba(15,212,192,0.06) 0%, transparent 70%),
    radial-gradient(ellipse 40% 60% at 80% 20%, rgba(10,171,154,0.03) 0%, transparent 70%),
    radial-gradient(ellipse 50% 40% at 60% 80%, rgba(15,212,192,0.025) 0%, transparent 60%);
  pointer-events: none;
}
.al-left::after {
  content: '';
  position: absolute; inset: 0;
  background-image:
    linear-gradient(var(--al-border) 1px, transparent 1px),
    linear-gradient(90deg, var(--al-border) 1px, transparent 1px);
  background-size: 48px 48px;
  opacity: .35;
  pointer-events: none;
}

.al-nodes { position: absolute; inset: 0; pointer-events: none; z-index: 1; }
.al-node {
  position: absolute;
  border-radius: 50%;
  animation: al-float linear infinite;
}
@keyframes al-float {
  0%   { transform: translateY(0px) scale(1); opacity: .6; }
  50%  { transform: translateY(-20px) scale(1.05); opacity: .9; }
  100% { transform: translateY(0px) scale(1); opacity: .6; }
}

.al-left-logo, .al-left-center, .al-left-footer { position: relative; z-index: 2; animation: al-fadeUp .6s ease both; }
.al-left-center { animation-delay: .15s; }
.al-left-footer { animation-delay: .3s; }

.al-logo-mark {
  font-weight: 700; font-size: 22px; color: var(--al-teal);
  letter-spacing: -.4px; display: flex; align-items: center; gap: 10px;
}
.al-logo-icon {
  width: 32px; height: 32px;
  border: 1.5px solid var(--al-teal);
  border-radius: 7px;
  display: flex; align-items: center; justify-content: center;
  position: relative; overflow: hidden;
}
.al-logo-sub {
  font-family: 'DM Mono', monospace;
  font-size: 9px; color: var(--al-dim);
  text-transform: uppercase; letter-spacing: 2.5px;
  margin-top: 5px; padding-left: 42px;
}

.al-headline {
  font-family: 'Instrument Serif', serif;
  font-style: italic;
  font-size: clamp(36px, 4vw, 54px);
  color: var(--al-text);
  line-height: 1.15; letter-spacing: -.5px;
  margin-bottom: 20px;
  font-weight: 400;
}
.al-headline em { color: var(--al-teal); font-style: italic; }
.al-desc {
  font-size: 15px; color: var(--al-mid);
  line-height: 1.7; max-width: 400px; margin-bottom: 40px;
}

.al-stats { display: flex; gap: 36px; flex-wrap: wrap; }
.al-stat { display: flex; flex-direction: column; gap: 4px; }
.al-stat-num {
  font-family: 'DM Mono', monospace;
  font-size: 26px; font-weight: 500;
  color: var(--al-text); letter-spacing: -1px; line-height: 1;
}
.al-stat-num span { color: var(--al-teal); }
.al-stat-label {
  font-family: 'DM Mono', monospace;
  font-size: 9px; color: var(--al-dim);
  text-transform: uppercase; letter-spacing: 1.5px;
}

.al-quote {
  font-family: 'Instrument Serif', serif;
  font-style: italic;
  font-size: 14px; color: var(--al-mid);
  line-height: 1.6; max-width: 420px;
  padding-left: 16px; border-left: 2px solid var(--al-dim);
}
.al-quote-attr {
  font-family: 'DM Mono', monospace;
  font-size: 9px; color: var(--al-dim);
  text-transform: uppercase; letter-spacing: 1.5px;
  margin-top: 10px; padding-left: 16px;
}

.al-right {
  width: 420px; min-width: 420px;
  background: var(--al-bg2);
  border-left: 1px solid var(--al-border);
  display: flex; flex-direction: column; justify-content: center;
  padding: 56px 48px;
  position: relative; overflow: hidden;
}
.al-right::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent 0%, var(--al-teal) 50%, transparent 100%);
  opacity: .5;
}
.al-right::after {
  content: '';
  position: absolute; top: -120px; left: 50%; transform: translateX(-50%);
  width: 300px; height: 300px;
  background: radial-gradient(circle, rgba(15,212,192,0.03) 0%, transparent 70%);
  pointer-events: none;
}

.al-form-wrap { position: relative; z-index: 2; animation: al-fadeUp .5s ease .1s both; }

.al-eyebrow {
  font-family: 'DM Mono', monospace;
  font-size: 9px; color: var(--al-teal);
  text-transform: uppercase; letter-spacing: 2.5px;
  margin-bottom: 12px;
}
.al-form-title {
  font-family: 'Instrument Serif', serif;
  font-size: 28px; font-weight: 400;
  color: var(--al-text); letter-spacing: -.3px;
  margin: 0 0 6px;
}
.al-form-sub {
  font-size: 13.5px; color: var(--al-mid);
  margin: 0 0 36px; line-height: 1.5;
}

.al-field { margin-bottom: 18px; }
.al-field-label {
  font-family: 'DM Mono', monospace;
  font-size: 9.5px; color: var(--al-mid);
  text-transform: uppercase; letter-spacing: 1.5px;
  margin-bottom: 8px; display: block;
}
.al-input {
  width: 100%;
  background: var(--al-input-bg);
  border: 1px solid var(--al-input-border);
  border-radius: 7px;
  padding: 12px 14px;
  font-family: 'DM Sans', sans-serif;
  font-size: 14px; color: var(--al-text);
  outline: none;
  transition: border-color .2s, box-shadow .2s;
  -webkit-appearance: none;
}
.al-input::placeholder { color: var(--al-dim); }
.al-input:focus {
  border-color: var(--al-teal);
  box-shadow: 0 0 0 3px rgba(15,212,192,0.33);
}
.al-input:focus::placeholder { color: transparent; }
.al-input.has-value { border-color: rgba(15,212,192,0.38); }

.al-field-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.al-forgot {
  background: none; border: none; cursor: pointer;
  font-family: 'DM Mono', monospace;
  font-size: 9.5px; color: var(--al-mid);
  letter-spacing: .5px; text-transform: uppercase;
  transition: color .15s;
  padding: 0;
}
.al-forgot:hover { color: var(--al-teal); }

.al-pw-wrap { position: relative; }
.al-pw-toggle {
  position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
  background: none; border: none; cursor: pointer;
  color: var(--al-dim); padding: 4px;
  display: flex; align-items: center;
  transition: color .15s;
}
.al-pw-toggle:hover { color: var(--al-mid); }

.al-error {
  font-family: 'DM Mono', monospace;
  font-size: 11px; color: #ff6b81;
  margin: -6px 0 14px;
  letter-spacing: .3px;
}

.al-submit {
  width: 100%;
  padding: 13px;
  background: var(--al-teal2);
  border: 1px solid var(--al-teal);
  border-radius: 7px;
  font-family: 'DM Sans', sans-serif;
  font-size: 14.5px; font-weight: 600;
  color: var(--al-bg);
  cursor: pointer;
  transition: all .2s;
  margin-top: 8px;
  position: relative; overflow: hidden;
  letter-spacing: -.1px;
}
.al-submit:hover:not(:disabled) {
  background: var(--al-teal);
  box-shadow: 0 0 24px rgba(15,212,192,0.25);
  transform: translateY(-1px);
}
.al-submit:disabled { opacity: .8; cursor: default; }

@keyframes al-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-5px); }
  40% { transform: translateX(5px); }
  60% { transform: translateX(-3px); }
  80% { transform: translateX(3px); }
}
.al-shake { animation: al-shake .38s ease; }

.al-divider { display: flex; align-items: center; gap: 14px; margin: 24px 0; }
.al-divider-line { flex: 1; height: 1px; background: var(--al-border2); }
.al-divider-text {
  font-family: 'DM Mono', monospace;
  font-size: 9px; color: var(--al-dim);
  text-transform: uppercase; letter-spacing: 1.5px; white-space: nowrap;
}

.al-sso {
  width: 100%;
  padding: 12px;
  background: transparent;
  border: 1px solid var(--al-border2);
  border-radius: 7px;
  font-family: 'DM Sans', sans-serif;
  font-size: 13.5px; font-weight: 500;
  color: var(--al-mid);
  cursor: pointer;
  transition: all .2s;
  display: flex; align-items: center; justify-content: center; gap: 10px;
}
.al-sso:hover {
  border-color: var(--al-dim);
  color: var(--al-text);
  background: var(--al-bg3);
}

.al-form-footer {
  margin-top: 28px;
  text-align: center;
  font-size: 12px;
  color: var(--al-dim);
  font-family: 'DM Mono', monospace;
  letter-spacing: .3px; line-height: 1.6;
}
.al-form-footer a { color: var(--al-teal); text-decoration: none; }
.al-form-footer a:hover { text-decoration: underline; }

.al-version {
  position: fixed; bottom: 20px; right: 24px;
  font-family: 'DM Mono', monospace;
  font-size: 9px; color: var(--al-dim);
  letter-spacing: 1px; text-transform: uppercase;
  z-index: 101;
}

@keyframes al-fadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}

@media (max-width: 900px) {
  .al-left { display: none; }
  .al-right { width: 100%; min-width: 0; border-left: none; }
}
`;
