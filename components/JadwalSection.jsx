'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';

const DAY_NAMES = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const PERIOD_LABELS = { harian: 'Harian', mingguan: 'Mingguan', bulanan: 'Bulanan', sekali: 'Sekali' };

const toISODate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  x.setHours(0, 0, 0, 0);
  return x;
};

const weekdayName = (d) => DAY_NAMES[(d.getDay() + 6) % 7];

const formatDateShort = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });

const formatDateLong = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const emptyForm = { judul: '', keterangan: '', tipe: 'harian', hari: [], hari_bulan: '', tanggal: '', jam: '', aktif: true };

export default function JadwalSection() {
  const [activities, setActivities] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [period, setPeriod] = useState('harian');
  const [weekRef, setWeekRef] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [monthRef, setMonthRef] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedDay, setSelectedDay] = useState(() => toISODate(new Date()));

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [savingLogKey, setSavingLogKey] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [loadError, setLoadError] = useState('');

  const todayISO = toISODate(new Date());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!supabase) {
      setLoadError('Supabase belum dikonfigurasi.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError('');
    const { data: acts, error: errA } = await supabase
      .from('jadwal_activities')
      .select('*')
      .order('created_at', { ascending: false });
    const { data: logs, error: errL } = await supabase.from('jadwal_logs').select('*');

    if (errA || errL) {
      setLoadError((errA || errL).message);
    } else {
      setActivities(acts || []);
      setLogs(logs || []);
    }
    setLoading(false);
  };

  const sortByTime = (list) =>
    [...list].sort((a, b) => {
      const ta = a.jam || '99:99';
      const tb = b.jam || '99:99';
      if (ta !== tb) return ta < tb ? -1 : 1;
      return (a.judul || '').localeCompare(b.judul || '');
    });

  const activitiesOnDate = (iso) => {
    const d = new Date(`${iso}T00:00:00`);
    const wd = weekdayName(d);
    return sortByTime(
      activities.filter((a) => {
        if (a.tipe === 'harian') return true;
        if (a.tipe === 'mingguan') return (a.hari || []).includes(wd);
        if (a.tipe === 'bulanan') return (a.hari_bulan || []).includes(d.getDate());
        if (a.tipe === 'sekali') return a.tanggal === iso;
        return false;
      })
    );
  };

  const logsByKey = useMemo(() => {
    const map = {};
    logs.forEach((l) => {
      map[`${l.activity_id}|${l.tanggal}`] = l;
    });
    return map;
  }, [logs]);

  const isDone = (activityId, iso) => logsByKey[`${activityId}|${iso}`]?.selesai === true;

  const toggleLog = async (activity, iso) => {
    const key = `${activity.id}|${iso}`;
    const next = !isDone(activity.id, iso);
    setSavingLogKey(key);
    try {
      const res = await fetch('/api/jadwal-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity_id: activity.id, tanggal: iso, selesai: next }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      setLogs((prev) => [...prev.filter((l) => !(l.activity_id === activity.id && l.tanggal === iso)), result.data]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingLogKey('');
    }
  };

  const weeklyDays = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(weekRef, i));

  const monthCells = useMemo(() => {
    const calYear = monthRef.getFullYear();
    const calMonth = monthRef.getMonth();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const offset = (new Date(calYear, calMonth, 1).getDay() + 6) % 7;
    const cells = [];
    const total = Math.ceil((offset + daysInMonth) / 7) * 7;
    for (let i = 0; i < total; i++) {
      const dayNum = i - offset + 1;
      const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
      const iso = inMonth
        ? `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
        : null;
      cells.push({ dayNum: inMonth ? dayNum : null, iso, inMonth });
    }
    return cells;
  }, [monthRef]);

  const monthLabel = monthRef.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  const weekLabel = `${formatDateShort(toISODate(weeklyDays[0]))} – ${formatDateShort(toISODate(weeklyDays[6]))}`;

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (activity) => {
    setEditing(activity);
    setForm({
      judul: activity.judul || '',
      keterangan: activity.keterangan || '',
      tipe: activity.tipe || 'harian',
      hari: activity.hari || [],
      hari_bulan: (activity.hari_bulan || []).join(', '),
      tanggal: activity.tanggal || '',
      jam: activity.jam || '',
      aktif: activity.aktif !== false,
    });
    setFormError('');
    setFormOpen(true);
  };

  const parseHariBulan = (str) => {
    if (str === '') return [];
    return [...new Set(
      String(str).split(/[,;\s]+/).filter(Boolean).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 31)
    )].sort((a, b) => a - b);
  };

  const saveActivity = async (e) => {
    e.preventDefault();
    if (!form.judul.trim()) {
      setFormError('Judul kegiatan wajib diisi.');
      return;
    }
    if (form.tipe === 'sekali' && !form.tanggal) {
      setFormError('Pilih tanggal untuk kegiatan sekali.');
      return;
    }

    setSaving(true);
    setFormError('');
    const payload = {
      judul: form.judul.trim(),
      keterangan: form.keterangan.trim(),
      tipe: form.tipe,
      jam: form.jam || null,
      aktif: form.aktif !== false,
    };
    if (form.tipe === 'mingguan') payload.hari = form.hari;
    if (form.tipe === 'bulanan') payload.hari_bulan = parseHariBulan(form.hari_bulan);
    if (form.tipe === 'sekali') payload.tanggal = form.tanggal;

    try {
      const res = await fetch('/api/jadwal', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      const saved = result.data;
      setActivities((prev) => {
        if (editing) return prev.map((a) => (a.id === saved.id ? saved : a));
        return [saved, ...prev];
      });
      setFormOpen(false);
      setEditing(null);
      setForm(emptyForm);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteActivity = async (id) => {
    if (!window.confirm('Hapus kegiatan ini? Riwayat checklist ikut terhapus.')) return;
    setDeletingId(id);
    try {
      const res = await fetch('/api/jadwal', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      setActivities((prev) => prev.filter((a) => a.id !== id));
      setLogs((prev) => prev.filter((l) => l.activity_id !== id));
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId('');
    }
  };

  const toggleAktif = async (activity) => {
    try {
      const res = await fetch('/api/jadwal', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activity.id, aktif: !activity.aktif }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      setActivities((prev) => prev.map((a) => (a.id === result.data.id ? result.data : a)));
    } catch (err) {
      setError(err.message);
    }
  };

  const CheckRow = ({ activity, iso, dim }) => {
    const done = isDone(activity.id, iso);
    const key = `${activity.id}|${iso}`;
    const busy = savingLogKey === key;
    return (
      <li
        className={`flex items-center gap-3 rounded-xl border p-3 transition-opacity dark:border-white/10 dark:bg-white/[0.06] ${
          dim ? 'opacity-50' : 'bg-white/70 border-amber-100/70 shadow-sm backdrop-blur-md'
        }`}
      >
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          title={done ? 'Tandai belum selesai' : 'Tandai selesai'}
          onClick={() => toggleLog(activity, iso)}
          disabled={busy}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 transition-colors disabled:opacity-50 ${
            done
              ? 'border-emerald-500 bg-emerald-500 text-white'
              : 'border-slate-300 bg-white text-slate-400 hover:border-amber-400 dark:border-slate-600 dark:bg-white/10 dark:text-slate-500'
          }`}
        >
          {busy ? (
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          ) : done ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <p className={`truncate font-semibold text-slate-800 dark:text-slate-100 ${done ? 'line-through opacity-60' : ''}`}>
            {activity.judul}
          </p>
          {(activity.jam || activity.keterangan) && (
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {activity.jam && <span className="font-medium text-amber-700 dark:text-amber-400">{activity.jam}</span>}
              {activity.jam && activity.keterangan ? ' · ' : ''}
              {activity.keterangan}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {activity.tipe !== 'harian' && (
            <span className="hidden rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 sm:inline dark:bg-white/10 dark:text-slate-400">
              {PERIOD_LABELS[activity.tipe]}
            </span>
          )}
          {!activity.aktif && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-white/10 dark:text-slate-400">
              nonaktif
            </span>
          )}
          <button
            type="button"
            onClick={() => openEdit(activity)}
            title="Edit kegiatan"
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 transition-colors hover:bg-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:hover:bg-indigo-500/25"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => deleteActivity(activity.id)}
            disabled={deletingId === activity.id}
            title="Hapus kegiatan"
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-100 text-red-700 transition-colors hover:bg-red-200 disabled:opacity-50 dark:bg-red-500/15 dark:text-red-300 dark:hover:bg-red-500/25"
          >
            {deletingId === activity.id ? '…' : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
          </button>
        </div>
      </li>
    );
  };

  const dayList = (iso) => {
    const items = activitiesOnDate(iso);
    if (items.length === 0) {
      return <p className="text-sm text-slate-400 dark:text-slate-500">Tidak ada kegiatan.</p>;
    }
    return (
      <ul className="space-y-2">
        {items.map((a) => (
          <CheckRow key={a.id} activity={a} iso={iso} dim={!a.aktif} />
        ))}
      </ul>
    );
  };

  const todayActivities = activitiesOnDate(todayISO);
  const todayDone = todayActivities.filter((a) => isDone(a.id, todayISO)).length;

  return (
    <section className="rounded-2xl border border-amber-200/70 bg-white/60 p-6 shadow-lg shadow-amber-100/50 backdrop-blur-xl dark:border-amber-300/20 dark:bg-white/[0.06] dark:shadow-black/20 sm:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500 text-white shadow-md">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-extrabold tracking-tight text-amber-900 dark:text-amber-100">Jadwal Kegiatan</h2>
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Agenda pribadi harian, mingguan, dan bulanan — terpisah dari proyek.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600"
        >
          ＋ Tambah Kegiatan
        </button>
      </div>

      {loadError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{loadError}</p>}
      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {/* Tabs periode */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {['harian', 'mingguan', 'bulanan'].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              period === p
                ? 'bg-amber-500 text-white'
                : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20'
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">Memuat jadwal…</p>
      ) : period === 'harian' ? (
        <div className="mt-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-slate-800 dark:text-slate-100">{formatDateLong(todayISO)}</h3>
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              ✓ {todayDone} selesai dari {todayActivities.length}
            </span>
          </div>
          <div className="mt-3">{dayList(todayISO)}</div>
        </div>
      ) : period === 'mingguan' ? (
        <div className="mt-5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setWeekRef(addDays(weekRef, -7))}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20"
              aria-label="Minggu sebelumnya"
            >
              ‹
            </button>
            <span className="min-w-[150px] text-center text-sm font-bold text-slate-700 dark:text-slate-200">{weekLabel}</span>
            <button
              type="button"
              onClick={() => setWeekRef(addDays(weekRef, 7))}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20"
              aria-label="Minggu berikutnya"
            >
              ›
            </button>
            <button
              type="button"
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
                d.setHours(0, 0, 0, 0);
                setWeekRef(d);
              }}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
            >
              Minggu Ini
            </button>
          </div>

          {/* Desktop: grid 7 kolom */}
          <div className="mt-4 hidden gap-2 md:grid md:grid-cols-7">
            {weeklyDays.map((day) => {
              const iso = toISODate(day);
              const items = activitiesOnDate(iso);
              const done = items.filter((a) => isDone(a.id, iso)).length;
              const isToday = iso === todayISO;
              return (
                <div
                  key={iso}
                  className={`rounded-xl border p-2 ${
                    isToday
                      ? 'border-amber-400 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10'
                      : 'border-slate-200/70 bg-white/60 dark:border-white/10 dark:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${isToday ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'}`}>
                      {weekdayName(day)}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">{formatDateShort(iso)}</span>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {items.slice(0, 2).map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => toggleLog(a, iso)}
                        title={a.judul}
                        className={`w-full truncate rounded px-1.5 py-1 text-left text-[11px] font-medium leading-tight transition-colors ${
                          isDone(a.id, iso)
                            ? 'bg-emerald-100 text-emerald-800 line-through dark:bg-emerald-500/15 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:hover:bg-amber-500/25'
                        } ${!a.aktif ? 'opacity-50' : ''}`}
                        disabled={savingLogKey === `${a.id}|${iso}`}
                      >
                        {isDone(a.id, iso) ? '✓ ' : ''}{a.judul}
                      </button>
                    ))}
                    {items.length > 2 && (
                      <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">+{items.length - 2} lainnya</div>
                    )}
                  </div>
                  {items.length > 0 && (
                    <p className="mt-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">{done}/{items.length} selesai</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Mobile: list per hari */}
          <div className="mt-4 space-y-5 md:hidden">
            {weeklyDays.map((day) => {
              const iso = toISODate(day);
              const items = activitiesOnDate(iso);
              const isToday = iso === todayISO;
              return (
                <div key={iso}>
                  <div className="flex items-center gap-2">
                    <h4 className={`font-bold ${isToday ? 'text-amber-700 dark:text-amber-300' : 'text-slate-700 dark:text-slate-200'}`}>
                      {formatDateLong(iso)}
                    </h4>
                    {items.length > 0 && (
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        {items.filter((a) => isDone(a.id, iso)).length}/{items.length} selesai
                      </span>
                    )}
                  </div>
                  <div className="mt-2">{dayList(iso)}</div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setMonthRef(new Date(monthRef.getFullYear(), monthRef.getMonth() - 1, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20"
              aria-label="Bulan sebelumnya"
            >
              ‹
            </button>
            <span className="min-w-[140px] text-center text-sm font-bold text-slate-700 dark:text-slate-200">{monthLabel}</span>
            <button
              type="button"
              onClick={() => setMonthRef(new Date(monthRef.getFullYear(), monthRef.getMonth() + 1, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20"
              aria-label="Bulan berikutnya"
            >
              ›
            </button>
            <button
              type="button"
              onClick={() => {
                const d = new Date();
                d.setDate(1);
                d.setHours(0, 0, 0, 0);
                setMonthRef(d);
                setSelectedDay(todayISO);
              }}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
            >
              Hari Ini
            </button>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1 text-center sm:gap-1.5">
            {DAY_NAMES.map((d) => (
              <div key={d} className="py-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {d.slice(0, 3)}
              </div>
            ))}
            {monthCells.map((cell, idx) => {
              const items = cell.iso ? activitiesOnDate(cell.iso) : [];
              const done = items.filter((a) => isDone(a.id, cell.iso)).length;
              const isToday = cell.iso === todayISO;
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!cell.inMonth}
                  onClick={() => cell.iso && setSelectedDay(cell.iso)}
                  className={`relative min-h-[56px] rounded-lg p-1 text-left text-sm transition-colors sm:min-h-[64px] sm:p-1.5 ${
                    !cell.inMonth
                      ? 'pointer-events-none opacity-30'
                      : isToday
                        ? 'bg-amber-500 shadow-md'
                        : selectedDay === cell.iso
                          ? 'bg-amber-50 ring-2 ring-amber-400 dark:bg-amber-500/20'
                          : 'bg-slate-50 hover:bg-amber-50 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]'
                  }`}
                >
                  <span className={`font-medium ${isToday ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>{cell.dayNum}</span>
                  <div className="mt-1 space-y-0.5">
                    {items.slice(0, 1).map((a) => (
                      <div
                        key={a.id}
                        className={`truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight ${
                          done > 0
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200'
                        } ${!a.aktif ? 'opacity-50' : ''}`}
                      >
                        {a.judul}
                      </div>
                    ))}
                    {items.length > 1 && (
                      <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">+{items.length - 1}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-5">
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">Kegiatan {formatDateLong(selectedDay)}</h4>
            <div className="mt-3">{dayList(selectedDay)}</div>
          </div>
        </div>
      )}

      {/* Modal Tambah / Edit */}
      {formOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setFormOpen(false)} />
          <div className="relative w-full max-w-md overflow-y-auto max-h-[90vh] rounded-2xl border border-amber-200/70 bg-white/90 p-6 shadow-2xl backdrop-blur-xl dark:border-amber-300/20 dark:bg-slate-900/95">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {editing ? 'Edit Kegiatan' : 'Tambah Kegiatan'}
              </h3>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-lg bg-slate-100 p-1.5 text-slate-500 transition-colors hover:bg-slate-200 dark:bg-white/10 dark:text-slate-400 dark:hover:bg-white/20"
                aria-label="Tutup"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={saveActivity} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-amber-900 dark:text-amber-100">Nama Kegiatan *</label>
                <input
                  type="text"
                  value={form.judul}
                  onChange={(e) => setForm({ ...form, judul: e.target.value })}
                  placeholder="Contoh: Olahraga pagi"
                  className="w-full rounded-lg border border-amber-300 bg-white p-3 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none dark:border-amber-400/40 dark:bg-slate-800/60 dark:text-amber-50 dark:placeholder-amber-200/50"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-amber-900 dark:text-amber-100">Tipe Jadwal</label>
                <select
                  value={form.tipe}
                  onChange={(e) => setForm({ ...form, tipe: e.target.value })}
                  className="w-full rounded-lg border border-amber-300 bg-white p-3 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none dark:border-amber-400/40 dark:bg-slate-800/60 dark:text-amber-50"
                >
                  <option value="harian">Harian (setiap hari)</option>
                  <option value="mingguan">Mingguan (hari tertentu)</option>
                  <option value="bulanan">Bulanan (tanggal tertentu)</option>
                  <option value="sekali">Sekali (tanggal pasti)</option>
                </select>
              </div>

              {form.tipe === 'mingguan' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-amber-900 dark:text-amber-100">Hari</label>
                  <div className="flex flex-wrap gap-1.5">
                    {DAY_NAMES.map((d) => {
                      const active = form.hari.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() =>
                            setForm({ ...form, hari: active ? form.hari.filter((h) => h !== d) : [...form.hari, d] })
                          }
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                            active
                              ? 'bg-amber-500 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20'
                          }`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {form.tipe === 'bulanan' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-amber-900 dark:text-amber-100">
                    Tanggal (pisahkan dengan koma, contoh: 1, 15)
                  </label>
                  <input
                    type="text"
                    value={form.hari_bulan}
                    onChange={(e) => setForm({ ...form, hari_bulan: e.target.value })}
                    placeholder="1, 15, 30"
                    className="w-full rounded-lg border border-amber-300 bg-white p-3 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none dark:border-amber-400/40 dark:bg-slate-800/60 dark:text-amber-50 dark:placeholder-amber-200/50"
                  />
                </div>
              )}

              {form.tipe === 'sekali' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-amber-900 dark:text-amber-100">Tanggal</label>
                  <input
                    type="date"
                    value={form.tanggal}
                    onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                    className="w-full rounded-lg border border-amber-300 bg-white p-3 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none dark:border-amber-400/40 dark:bg-slate-800/60 dark:text-amber-50"
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-amber-900 dark:text-amber-100">Jam (opsional)</label>
                <input
                  type="time"
                  value={form.jam}
                  onChange={(e) => setForm({ ...form, jam: e.target.value })}
                  className="w-full rounded-lg border border-amber-300 bg-white p-3 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none dark:border-amber-400/40 dark:bg-slate-800/60 dark:text-amber-50"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-amber-900 dark:text-amber-100">Keterangan (opsional)</label>
                <textarea
                  rows={2}
                  value={form.keterangan}
                  onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                  placeholder="Detail kegiatan"
                  className="w-full rounded-lg border border-amber-300 bg-white p-3 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none dark:border-amber-400/40 dark:bg-slate-800/60 dark:text-amber-50 dark:placeholder-amber-200/50"
                />
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-100">
                <input
                  type="checkbox"
                  checked={form.aktif !== false}
                  onChange={(e) => setForm({ ...form, aktif: e.target.checked })}
                  className="h-4 w-4 rounded border-amber-300 text-amber-500 focus:ring-amber-500"
                />
                Aktif (tampil di jadwal)
              </label>

              {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  disabled={saving}
                  className="flex-1 rounded-lg bg-slate-100 px-4 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-50 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-amber-500 px-4 py-2.5 font-medium text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
                >
                  {saving ? 'Menyimpan…' : editing ? 'Simpan Perubahan' : 'Tambah'}
                </button>
              </div>
            </form>
          </div>
          </div>,
          document.body
        )}
    </section>
  );
}