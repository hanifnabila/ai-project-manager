'use client';

import { useEffect, useState } from 'react';
import {
  isWebAuthnSupported,
  getSetupState,
  registerPasskey,
  setQuestion,
  setCode,
  getQuestion,
} from '@/lib/authLocal';

export default function SecuritySettings({ open, onClose }) {
  const [state, setState] = useState({ hasPasskey: false, hasQA: false, hasCode: false });
  const [bioSupported, setBioSupported] = useState(false);
  const [working, setWorking] = useState(false);
  const [msg, setMsg] = useState(null);

  const [qText, setQText] = useState('');
  const [qQuestion, setQQuestion] = useState('');
  const [qAnswer, setQAnswer] = useState('');
  const [cCode, setCCode] = useState('');
  const [cCode2, setCCode2] = useState('');

  useEffect(() => {
    if (!open) return;
    setMsg(null);
    getSetupState().then(setState);
    getQuestion().then(setQText);
    if (isWebAuthnSupported()) {
      window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.()
        .then(setBioSupported)
        .catch(() => setBioSupported(false));
    }
  }, [open]);

  const note = (type, text) => setMsg({ type, text });

  const handleRegisterBio = async () => {
    setWorking(true);
    try {
      await registerPasskey();
      note('ok', 'Biometrik berhasil didaftarkan ulang.');
      setState((s) => ({ ...s, hasPasskey: true }));
    } catch (err) {
      note('err', err.message);
    } finally {
      setWorking(false);
    }
  };

  const handleSaveQA = async () => {
    if (!qQuestion.trim() || !qAnswer.trim()) {
      note('err', 'Pertanyaan dan jawaban wajib diisi.');
      return;
    }
    setWorking(true);
    try {
      await setQuestion(qQuestion, qAnswer);
      setQText(qQuestion);
      await getSetupState().then(setState);
      setQAnswer('');
      setQQuestion('');
      note('ok', 'Pertanyaan & jawaban disimpan.');
    } catch (err) {
      note('err', err.message);
    } finally {
      setWorking(false);
    }
  };

  const handleSaveCode = async () => {
    if (cCode.trim().length < 4) {
      note('err', 'Kode minimal 4 karakter.');
      return;
    }
    if (cCode !== cCode2) {
      note('err', 'Kode tidak sama.');
      return;
    }
    setWorking(true);
    try {
      await setCode(cCode);
      await getSetupState().then(setState);
      setCCode('');
      setCCode2('');
      note('ok', 'Kode akses diperbarui.');
    } catch (err) {
      note('err', err.message);
    } finally {
      setWorking(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-y-auto max-h-[90vh] rounded-2xl border border-emerald-200/70 bg-white/90 p-6 shadow-2xl backdrop-blur-xl dark:border-emerald-300/20 dark:bg-slate-900/95">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-mono text-lg font-bold tracking-tight text-emerald-900 dark:text-emerald-100">
            ⌂ GANTI KUNCI AKSES
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-100 p-1.5 text-slate-500 transition-colors hover:bg-slate-200 dark:bg-white/10 dark:text-slate-400 dark:hover:bg-white/20"
            aria-label="Tutup"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {msg && (
          <p className={`mt-3 font-mono text-xs ${msg.type === 'err' ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {msg.text}
          </p>
        )}

        <div className="mt-4 space-y-4">
          {/* Biometric */}
          <div className="rounded-xl border border-slate-200/70 p-4 dark:border-white/10">
            <p className="font-bold text-slate-800 dark:text-slate-100">◉ Biometrik (Face ID / Sidik Jari)</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Status:{' '}
              <span className={state.hasPasskey ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}>
                {state.hasPasskey ? 'Terdaftar' : 'Belum terdaftar'}
              </span>
            </p>
            {bioSupported && (
              <button
                type="button"
                onClick={handleRegisterBio}
                disabled={working}
                className="mt-2 rounded-lg border border-emerald-400 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-400/40 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
              >
                {working ? 'Memproses...' : state.hasPasskey ? 'Daftar Ulang Biometrik' : 'Daftarkan Biometrik'}
              </button>
            )}
            {!bioSupported && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                Biometrik tidak didukung di perangkat/browser ini.
              </p>
            )}
          </div>

          {/* Security question */}
          <div className="rounded-xl border border-slate-200/70 p-4 dark:border-white/10">
            <p className="font-bold text-slate-800 dark:text-slate-100">⚿ Pertanyaan &amp; Jawaban</p>
            {qText && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Saat ini: &quot;{qText}&quot;</p>}
            <input
              type="text"
              value={qQuestion}
              onChange={(e) => setQQuestion(e.target.value)}
              placeholder="Pertanyaan baru"
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-100"
            />
            <input
              type="text"
              value={qAnswer}
              onChange={(e) => setQAnswer(e.target.value)}
              placeholder="Jawaban (disimpan ter-hash)"
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={handleSaveQA}
              disabled={working}
              className="mt-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              Simpan Pertanyaan &amp; Jawaban
            </button>
          </div>

          {/* Access code */}
          <div className="rounded-xl border border-slate-200/70 p-4 dark:border-white/10">
            <p className="font-bold text-slate-800 dark:text-slate-100">⌨ Kode Akses</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Status:{' '}
              <span className={state.hasCode ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}>
                {state.hasCode ? 'Terpasang' : 'Belum ada'}
              </span>
            </p>
            <input
              type="password"
              value={cCode}
              onChange={(e) => setCCode(e.target.value)}
              placeholder="Kode baru (min 4)"
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-100"
            />
            <input
              type="password"
              value={cCode2}
              onChange={(e) => setCCode2(e.target.value)}
              placeholder="Ulangi kode"
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={handleSaveCode}
              disabled={working}
              className="mt-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              Simpan Kode
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}