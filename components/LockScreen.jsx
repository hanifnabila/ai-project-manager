'use client';

import { useEffect, useRef, useState } from 'react';
import {
  isWebAuthnSupported,
  getSetupState,
  registerPasskey,
  setQuestion,
  setCode,
  authCheck,
  getQuestion,
  throttleState,
} from '@/lib/authLocal';

const BOOT_LINES = [
  '> APM_OS v2.7.1 -- SECURE BOOT',
  '> INITIALIZING KERNEL ............ OK',
  '> VERIFYING INTEGRITY ............ OK',
  '> ENCRYPTION MODULE .............. ONLINE',
  '> ACCESS REQUIRED',
];

const MATRIX_CHARS = 'アイウエオカキクケコ011010010101AGENT▒░▓';

function MatrixRain({ className }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let raf = 0;
    let cols = 0;
    let drops = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      cols = Math.floor(canvas.width / 18);
      drops = Array.from({ length: cols }, () => Math.floor(Math.random() * -canvas.height / 18));
    };

    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = '16px monospace';
      ctx.fillStyle = '#22ff6e';
      for (let i = 0; i < cols; i++) {
        const ch = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
        const x = i * 18;
        const y = drops[i] * 18;
        const r = Math.random();
        if (r > 0.97) ctx.fillStyle = '#c8ffd8';
        else if (r > 0.5) ctx.fillStyle = '#22ff6e';
        else ctx.fillStyle = '#178a44';
        ctx.fillText(ch, x, y);
        if (y > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
      raf = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} />;
}

const formatLocked = (ms) => {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export default function LockScreen({ onUnlocked }) {
  const [phase, setPhase] = useState('boot'); // boot | auth | granted | setup
  const [bootLines, setBootLines] = useState([]);
  const [setupState, setSetupState] = useState(null);
  const [method, setMethod] = useState(null); // null | qa | code
  const [input, setInput] = useState('');
  const [status, setStatus] = useState({ type: null, text: '' });
  const [working, setWorking] = useState(false);
  const [lockedRemaining, setLockedRemaining] = useState(0);
  const [granted, setGranted] = useState(false);
  const [shake, setShake] = useState(0);
  const [questionText, setQuestionText] = useState('');
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString('id-ID', { hour12: false }));

  // setup form
  const [sQuestion, setSQuestion] = useState('');
  const [sAnswer, setSAnswer] = useState('');
  const [sCode, setSCode] = useState('');
  const [sCode2, setSCode2] = useState('');
  const [sBio, setSBio] = useState(false);
  const [bioSupported, setBioSupported] = useState(false);

  // ── boot sequence ─────────────────────────────────────────────
  useEffect(() => {
    let i = 0;
    const t = setInterval(() => {
      i++;
      setBootLines(BOOT_LINES.slice(0, i));
      if (i >= BOOT_LINES.length) {
        clearInterval(t);
        setTimeout(async () => {
          const st = await getSetupState();
          setSetupState(st);
          setPhase(st.done ? 'auth' : 'setup');
        }, 500);
      }
    }, 320);
    return () => clearInterval(t);
  }, []);

  // bio support detection
  useEffect(() => {
    if (isWebAuthnSupported()) {
      window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.().then((v) => {
        setBioSupported(v);
      }).catch(() => setBioSupported(false));
    }
  }, []);

  // lock body scroll + ticking clock while mounted
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setInterval(() => setClock(new Date().toLocaleTimeString('id-ID', { hour12: false })), 1000);
    return () => {
      document.body.style.overflow = prev;
      clearInterval(t);
    };
  }, []);

  // lock countdown timer
  useEffect(() => {
    if (!lockedRemaining) return;
    const t = setInterval(async () => {
      const s = await throttleState();
      if (s.locked) setLockedRemaining(s.remainingMs);
      else {
        setLockedRemaining(0);
        setStatus({ type: 'info', text: 'SYSTEM UNLOCKED -- RETRY AUTHENTICATION' });
      }
    }, 1000);
    return () => clearInterval(t);
  }, [lockedRemaining > 0]);

  useEffect(() => {
    if (phase === 'auth') {
      throttleState().then((s) => {
        if (s.locked) setLockedRemaining(s.remainingMs);
      });
    }
  }, [phase]);

  const fail = (msg) => {
    setStatus({ type: 'error', text: `ACCESS DENIED -- ${msg || 'INVALID CREDENTIALS'}` });
    setShake((k) => k + 1);
    setInput('');
    setWorking(false);
    throttleState().then((s) => s.locked && setLockedRemaining(s.remainingMs));
  };

  const submitAuth = async () => {
    if (working) return;
    if (method === 'qa') {
      const q = await getQuestion();
      if (!q) {
        setStatus({ type: 'error', text: 'REFUSED -- NO SECURITY QUESTION REGISTERED' });
        return;
      }
    }
    setWorking(true);
    setStatus({ type: 'info', text: 'AUTHENTICATING...' });
    const res = await authCheck(method, input);
    if (res.ok) {
      await grant();
    } else if (res.locked) {
      setLockedRemaining(res.remainingMs);
      setStatus({ type: 'error', text: `ACCESS LOCKED -- RETRY IN ${formatLocked(res.remainingMs)}` });
      setShake((k) => k + 1);
      setInput('');
      setWorking(false);
    } else {
      fail(res.error);
    }
  };

  const grant = () => {
    setStatus({ type: 'info', text: 'AUTHENTICATING... OK' });
    setPhase('granted');
    setGranted(true);
    setTimeout(() => onUnlocked && onUnlocked(), 1800);
  };

  const handleBiometric = async () => {
    if (working) return;
    setMethod(null);
    setWorking(true);
    setStatus({ type: 'info', text: 'AUTHENTICATING...' });
    const res = await authCheck('biometric', '');
    if (res.ok) {
      await grant();
    } else if (res.locked) {
      setLockedRemaining(res.remainingMs);
      setStatus({ type: 'error', text: `ACCESS LOCKED -- RETRY IN ${formatLocked(res.remainingMs)}` });
      setShake((k) => k + 1);
      setWorking(false);
    } else {
      fail(res.error);
    }
  };

  const handleRegisterBio = async () => {
    setWorking(true);
    setStatus({ type: 'info', text: 'AWAITING BIOMETRIC REGISTRATION...' });
    try {
      await registerPasskey();
      setSBio(true);
      setStatus({ type: 'ok', text: 'BIOMETRIC REGISTERED' });
    } catch (err) {
      setStatus({ type: 'error', text: `REGISTRATION FAILED -- ${err.message}` });
    } finally {
      setWorking(false);
    }
  };

  const handleActivate = async () => {
    const useQA = sQuestion.trim() && sAnswer.trim();
    const useCode = sCode.trim();

    if (!useQA && !useCode) {
      setStatus({ type: 'error', text: 'REQUIRED -- SET SECURITY QUESTION OR ACCESS CODE' });
      return;
    }
    if (useCode && sCode.trim().length < 4) {
      setStatus({ type: 'error', text: 'REFUSED -- CODE MUST BE AT LEAST 4 CHARACTERS' });
      return;
    }
    if (useCode && sCode !== sCode2) {
      setStatus({ type: 'error', text: 'REFUSED -- CODE MISMATCH' });
      return;
    }

    setWorking(true);
    try {
      if (useQA) await setQuestion(sQuestion, sAnswer);
      if (useCode) await setCode(sCode);
      setStatus({ type: 'ok', text: 'CREDENTIALS STORED -- ENGAGING ACCESS PROTOCOL' });
      setPhase('granted');
      setGranted(true);
      setTimeout(() => onUnlocked && onUnlocked(), 1800);
    } catch (err) {
      setStatus({ type: 'error', text: `FAILED -- ${err.message}` });
      setWorking(false);
    }
  };

  const showLocked = lockedRemaining > 0;

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-black text-[#22ff6e]">
      <MatrixRain className="absolute inset-0 h-full w-full opacity-40" />
      <div className="apm-scanline-overlay" />
      <div className="apm-vignette absolute inset-0" />
      <div className="apm-crt absolute inset-0" />

      <div className="relative z-10 flex h-full flex-col items-center justify-center p-4">
        {phase === 'granted' && (
          <div className="text-center">
            <div className="apm-flash mx-auto h-3 w-full max-w-xs bg-[#22ff6e] shadow-[0_0_30px_#22ff6e]" />
            <p className="apm-glow-text mt-6 font-mono text-4xl font-bold tracking-widest sm:text-5xl">ACCESS GRANTED</p>
            <p className="mt-3 font-mono text-sm text-[#22ff6e]/80">WELCOME, AGENT. INITIALIZING DASHBOARD...</p>
          </div>
        )}

        {phase === 'boot' && (
          <div className="w-full max-w-lg font-mono text-sm leading-7">
            <p className="mb-4 font-bold tracking-widest text-[#22ff6e]/90 apm-glow-text">T-301 SECURE TERMINAL v2.7</p>
            {bootLines.map((line, i) => (
              <p key={i} className="text-[#22ff6e]/95">
                {line}
              </p>
            ))}
            <span className="apm-blink inline-block h-4 w-3 bg-[#22ff6e]" />
          </div>
        )}

        {(phase === 'auth' || phase === 'setup') && (
          <div
            key={shake}
            className={`w-full max-w-lg rounded-lg border border-[#22ff6e]/40 bg-black/70 p-6 font-mono shadow-[0_0_40px_rgba(34,255,110,0.15)] backdrop-blur-sm ${shake ? 'apm-shake' : ''}`}
          >
            <div className="mb-4 flex items-center justify-between border-b border-[#22ff6e]/30 pb-2 text-xs tracking-widest">
              <span className="apm-glow-text font-bold text-[#22ff6e]">APM_OS :: ACCESS CONTROL</span>
              <span className="text-[#22ff6e]/70" id="apm-lock-clock">
                {clock}
              </span>
            </div>

            {phase === 'setup' && (
              <div className="space-y-4">
                <p className="text-sm text-[#22ff6e]/90">
                  SECURITY PROTOCOL NOT CONFIGURED. REGISTER AT LEAST ONE METHOD:
                </p>

                {bioSupported && (
                  <div className="flex items-center justify-between gap-3 rounded border border-[#22ff6e]/30 p-3">
                    <div>
                      <p className="text-sm font-bold">BIOMETRIC (FACE ID / FINGERPRINT)</p>
                      <p className="text-xs text-[#22ff6e]/70">Recommended -- perangkat:{' '}
                        <span className={sBio ? 'text-[#22ff6e]' : 'text-red-400'}>{sBio ? 'REGISTERED' : 'NOT REGISTERED'}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRegisterBio}
                      disabled={working && !sBio}
                      className="shrink-0 rounded border border-[#22ff6e]/60 px-3 py-1.5 text-xs transition-colors hover:bg-[#22ff6e] hover:text-black disabled:opacity-50"
                    >
                      {working && !sBio ? '...' : 'REGISTER'}
                    </button>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-xs text-[#22ff6e]/80">SECURITY QUESTION &amp; ANSWER</p>
                  <input
                    type="text"
                    value={sQuestion}
                    onChange={(e) => setSQuestion(e.target.value)}
                    placeholder="QUESTION: e.g. NAMA AGENT PERTAMA"
                    className="w-full rounded border border-[#22ff6e]/40 bg-black px-3 py-2 text-sm focus:border-[#22ff6e] focus:outline-none"
                  />
                  <input
                    type="text"
                    value={sAnswer}
                    onChange={(e) => setSAnswer(e.target.value)}
                    placeholder="ANSWER (disimpan ter-hash)"
                    className="w-full rounded border border-[#22ff6e]/40 bg-black px-3 py-2 text-sm focus:border-[#22ff6e] focus:outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-[#22ff6e]/80">ACCESS CODE (opsional, min 4 karakter)</p>
                  <input
                    type="password"
                    value={sCode}
                    onChange={(e) => setSCode(e.target.value)}
                    placeholder="CODE"
                    className="w-full rounded border border-[#22ff6e]/40 bg-black px-3 py-2 text-sm focus:border-[#22ff6e] focus:outline-none"
                  />
                  <input
                    type="password"
                    value={sCode2}
                    onChange={(e) => setSCode2(e.target.value)}
                    placeholder="REPEAT CODE"
                    className="w-full rounded border border-[#22ff6e]/40 bg-black px-3 py-2 text-sm focus:border-[#22ff6e] focus:outline-none"
                  />
                </div>

                {status.text && (
                  <p className={`text-xs ${status.type === 'error' ? 'text-red-400' : 'text-[#22ff6e]'}`}>{status.text}</p>
                )}

                <button
                  type="button"
                  onClick={handleActivate}
                  disabled={working}
                  className="w-full rounded bg-[#22ff6e] py-2.5 text-sm font-bold tracking-widest text-black transition-colors hover:brightness-110 disabled:opacity-50"
                >
                  {working ? 'PROCESSING...' : '▶ ACTIVATE SECURITY PROTOCOL'}
                </button>
              </div>
            )}

            {phase === 'auth' && (
              <div className="space-y-4">
                <p className="text-sm text-[#22ff6e]/90">IDENTITY VERIFICATION REQUIRED -- SELECT METHOD:</p>

                {setupState?.hasPasskey && bioSupported && (
                  <button
                    type="button"
                    onClick={handleBiometric}
                    disabled={working || showLocked}
                    className="flex w-full items-center justify-center gap-2 rounded bg-[#22ff6e] py-3 text-sm font-bold tracking-widest text-black transition-colors hover:brightness-110 disabled:opacity-50"
                  >
                    {working ? 'AUTHENTICATING...' : '◉ AUTHENTICATE (FACE ID / FINGERPRINT)'}
                  </button>
                )}

                <div className="grid grid-cols-2 gap-2" style={{ visibility: showLocked ? 'hidden' : 'visible' }}>
                  {setupState?.hasQA && (
                    <button
                      type="button"
                      onClick={() => { setMethod('qa'); setInput(''); setStatus({ type: null, text: '' }); getQuestion().then(setQuestionText); }}
                      className={`rounded border border-[#22ff6e]/40 py-2.5 text-xs tracking-wide transition-colors hover:bg-[#22ff6e]/10 ${method === 'qa' ? 'bg-[#22ff6e]/15' : ''}`}
                    >
                      ⚿ SECURITY QUESTION
                    </button>
                  )}
                  {setupState?.hasCode && (
                    <button
                      type="button"
                      onClick={() => { setMethod('code'); setInput(''); setStatus({ type: null, text: '' }); }}
                      className={`rounded border border-[#22ff6e]/40 py-2.5 text-xs tracking-wide transition-colors hover:bg-[#22ff6e]/10 ${method === 'code' ? 'bg-[#22ff6e]/15' : ''}`}
                    >
                      ⌨ ACCESS CODE
                    </button>
                  )}
                </div>

                {method === 'qa' && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-[#22ff6e]/70">&gt; &quot;{questionText}&quot;</p>
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && submitAuth()}
                      autoFocus
                      placeholder="ANSWER..."
                      className="w-full rounded border border-[#22ff6e]/40 bg-black px-3 py-2 text-sm focus:border-[#22ff6e] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={submitAuth}
                      disabled={working || showLocked}
                      className="w-full rounded border border-[#22ff6e]/50 py-2 text-xs tracking-widest transition-colors hover:bg-[#22ff6e] hover:text-black disabled:opacity-50"
                    >
                      {working ? 'CHECKING...' : 'SEND'}
                    </button>
                  </div>
                )}

                {method === 'code' && (
                  <div className="space-y-1.5">
                    <input
                      type="password"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && submitAuth()}
                      autoFocus
                      placeholder="ENTER ACCESS CODE"
                      className="w-full rounded border border-[#22ff6e]/40 bg-black px-3 py-2 text-sm tracking-widest focus:border-[#22ff6e] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={submitAuth}
                      disabled={working || showLocked}
                      className="w-full rounded border border-[#22ff6e]/50 py-2 text-xs tracking-widest transition-colors hover:bg-[#22ff6e] hover:text-black disabled:opacity-50"
                    >
                      {working ? 'CHECKING...' : 'SEND'}
                    </button>
                  </div>
                )}

                {showLocked ? (
                  <p className="text-center text-sm font-bold tracking-widest text-red-400">
                    ACCESS LOCKED -- RETRY IN {formatLocked(lockedRemaining)}
                  </p>
                ) : (
                  status.text && (
                    <p
                      className={`text-xs tracking-widest ${
                        status.type === 'error' ? 'text-red-400' : status.type === 'ok' ? 'text-[#22ff6e]' : 'text-[#22ff6e]/80'
                      }`}
                    >
                      {status.text}
                    </p>
                  )
                )}
              </div>
            )}
          </div>
        )}

        <p className="relative z-10 mt-6 font-mono text-[10px] tracking-widest text-[#22ff6e]/50">
          CONNECTION: SECURE :: ENCRYPTION: AES-256 :: SESSION: LOCAL
        </p>
      </div>
    </div>
  );
}