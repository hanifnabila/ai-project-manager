'use client';

import { useState, useEffect, Fragment } from 'react';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState([]);
  const [tagFilter, setTagFilter] = useState([]);
  const [priorityFilter, setPriorityFilter] = useState([]);
  const [recap, setRecap] = useState('');
  const [recapLoading, setRecapLoading] = useState(false);
  const [recapError, setRecapError] = useState('');
  const [view, setView] = useState('cards');
  const [sortKey, setSortKey] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const pageSize = 6;
  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    project_name: '',
    tasks: '',
    status: 'In Progress',
    priority: 'sedang',
    summary: '',
    tags: '',
    deadline: '',
  });
  const [manualError, setManualError] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ project_name: '', tasks: '', status: 'In Progress', priority: 'sedang', summary: '', tags: '', deadline: '' });
  const [editError, setEditError] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState([]);
  const [deadlineError, setDeadlineError] = useState('');

  const PRIORITY_OPTIONS = [
    { value: 'rendah', label: 'Rendah' },
    { value: 'sedang', label: 'Sedang' },
    { value: 'tinggi', label: 'Tinggi' },
    { value: 'kritis', label: 'Kritis' },
  ];

  // Ambil data dari Supabase saat halaman pertama kali dibuka
  useEffect(() => {
    fetchHistory();
    fetchDeadlines();
  }, []);

  // Reset halaman ke 1 saat filter / pencarian / urutan berubah
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, tagFilter, priorityFilter, sortKey, sortDir]);

  const parseTags = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      return value.split(/,|;/).map(t => t.trim()).filter(Boolean);
    }
    return [];
  };

  const safeParse = (value, fallback) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string') return fallback;
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  };

  const fetchDeadlines = async () => {
    if (!supabase) return;

    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('progress_logs')
      .select('*')
      .neq('status', 'Completed')
      .gte('deadline', today)
      .not('deadline', 'is', null)
      .order('deadline', { ascending: true })
      .limit(5);

    if (error) {
      setDeadlineError(error.message);
      return;
    }
    setUpcomingDeadlines((data || []).map(item => ({
      ...item,
      tasks: safeParse(item.tasks, []),
      tags: safeParse(item.tags, []),
    })));
  };

  const fetchHistory = async () => {
    if (!supabase) return;

    const { data, error } = await supabase
      .from('progress_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      // Format ulang data tasks & tags dari string JSON kembali ke array
      const formattedData = data.map(item => ({
        ...item,
        tasks: safeParse(item.tasks, []),
        tags: safeParse(item.tags, []),
      }));
      setHistory(formattedData);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rawText.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText }),
      });

      const result = await res.json();
      if (!result.success) {
        // Jika AI gagal (kuota habis / layanan tidak tersedia), tawarkan input manual
        if (['QUOTA', 'UNAVAILABLE', 'MODEL'].includes(result.code)) {
          setManualOpen(true);
        }
        throw new Error(result.error);
      }

      setRawText('');
      fetchHistory(); // Refresh daftar riwayat dari database
      fetchDeadlines(); // Refresh daftar deadline terdekat
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      project_name: manualForm.project_name,
      status: manualForm.status,
      priority: manualForm.priority,
      summary: manualForm.summary,
      tasks: manualForm.tasks,
      tags: parseTags(manualForm.tags),
      deadline: manualForm.deadline || null,
    };

    setManualLoading(true);
    setManualError('');

    try {
      const res = await fetch('/api/manual-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      setManualOpen(false);
      setManualForm({ project_name: '', tasks: '', status: 'In Progress', priority: 'sedang', summary: '', tags: '', deadline: '' });
      setError('');
      fetchHistory();
      fetchDeadlines();
    } catch (err) {
      setManualError(err.message);
    } finally {
      setManualLoading(false);
    }
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setEditForm({
      project_name: item.project_name || '',
      tasks: (item.tasks || []).join('\n'),
      status: item.status || 'In Progress',
      priority: (item.priority || 'sedang').toLowerCase(),
      summary: item.summary || '',
      tags: (item.tags || []).join(', '),
      deadline: item.deadline || '',
    });
    setEditError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ project_name: '', tasks: '', status: 'In Progress', priority: 'sedang', summary: '', tags: '', deadline: '' });
    setEditError('');
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    setEditError('');

    try {
      const res = await fetch('/api/progress', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, ...editForm, tags: parseTags(editForm.tags) }),
      });

      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      cancelEdit();
      fetchHistory();
      fetchDeadlines();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus catatan ini? Tindakan tidak dapat dibatalkan.')) return;

    setDeletingId(id);
    try {
      const res = await fetch('/api/progress', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      fetchHistory();
      fetchDeadlines();
    } catch (err) {
      window.alert(`Gagal menghapus: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleWeeklyRecap = async () => {
    setRecapLoading(true);
    setRecapError('');
    setRecap('');

    try {
      const res = await fetch('/api/weekly-recap', {
        method: 'POST',
      });

      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      setRecap(result.summary);
    } catch (err) {
      setRecapError(err.message);
    } finally {
      setRecapLoading(false);
    }
  };

  const todayHistory = history.filter(item => {
    const date = new Date(item.created_at);
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  });

  const handleDownloadMarkdown = () => {
    if (todayHistory.length === 0) return;

    const dateStr = new Date().toISOString().slice(0, 10);
    const lines = [
      `# Progress Harian - ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
      '',
    ];

    todayHistory.forEach(item => {
      const priorityLabel = (item.priority || 'sedang').toLowerCase();
      lines.push(`## ${item.project_name} (${item.status}) [Prioritas: ${priorityLabels[priorityLabel] || 'Sedang'}]`, '');
      lines.push(`**Ringkasan:** "${item.summary}"`, '');
      if (item.tags && item.tags.length > 0) {
        lines.push('', `**Tag:** ${item.tags.join(', ')}`);
      }
      lines.push('', '**Tugas:**');
      item.tasks.forEach(task => lines.push(`- ${task}`));
      lines.push('', '---', '');
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `progress-harian-${dateStr}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const allTags = [...new Set(
    history.flatMap(item => item.tags || []).filter(Boolean).map(t => t.toLowerCase())
  )].sort();

  const priorityLabels = { kritis: 'Kritis', tinggi: 'Tinggi', sedang: 'Sedang', rendah: 'Rendah' };

  const filteredHistory = history.filter(item => {
    const matchesSearch = item.project_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(item.status);
    const matchesTags = tagFilter.length === 0 || (item.tags || []).some(tag => tagFilter.includes(tag.toLowerCase()));
    const itemPriority = (item.priority || 'sedang').toLowerCase();
    const matchesPriority = priorityFilter.length === 0 || priorityFilter.includes(itemPriority);
    return matchesSearch && matchesStatus && matchesTags && matchesPriority;
  });

  const statusOrder = { 'In Progress': 1, 'Completed': 2, 'Blocked': 3 };
  const priorityOrder = { kritis: 1, tinggi: 2, sedang: 3, rendah: 4 };

  const sortedHistory = [...filteredHistory].sort((a, b) => {
    let valA, valB;
    if (sortKey === 'created_at') {
      valA = new Date(a.created_at).getTime();
      valB = new Date(b.created_at).getTime();
    } else if (sortKey === 'project_name') {
      valA = (a.project_name || '').toLowerCase();
      valB = (b.project_name || '').toLowerCase();
    } else if (sortKey === 'status') {
      valA = statusOrder[a.status] || 99;
      valB = statusOrder[b.status] || 99;
    } else if (sortKey === 'priority') {
      valA = priorityOrder[(a.priority || 'sedang').toLowerCase()] || 99;
      valB = priorityOrder[(b.priority || 'sedang').toLowerCase()] || 99;
    }
    let cmp;
    if (valA < valB) cmp = -1;
    else if (valA > valB) cmp = 1;
    else cmp = 0;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const formatDate = (iso) => {
    const date = new Date(iso);
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const daysUntil = (iso) => {
    if (!iso) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(`${iso}T00:00:00`);
    return Math.round((target - today) / 86400000);
  };

  const deadlineBadge = (iso) => {
    const diff = daysUntil(iso);
    if (diff === null || diff === undefined) return null;
    if (diff === 0) return { text: 'Hari ini', cls: 'bg-rose-600 text-white' };
    if (diff === 1) return { text: 'Besok', cls: 'bg-orange-500 text-white' };
    if (diff < 0) return { text: `Lewat ${Math.abs(diff)} hari`, cls: 'bg-slate-500 text-white' };
    return { text: `${diff} hari lagi`, cls: 'bg-amber-400 text-amber-950' };
  };

  const totalPages = Math.max(1, Math.ceil(sortedHistory.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedHistory = sortedHistory.slice((safePage - 1) * pageSize, safePage * pageSize);

  const taskRows = paginatedHistory.flatMap(item =>
    (item.tasks || []).map(task => ({
      id: item.id,
      date: formatDate(item.created_at),
      project_name: item.project_name,
      task,
      status: item.status,
      priority: (item.priority || 'sedang').toLowerCase(),
      summary: item.summary,
      tags: item.tags || [],
      deadline: item.deadline,
      created_at: item.created_at,
    }))
  );

  const projectCounts = history.reduce((acc, item) => {
    acc[item.project_name] = (acc[item.project_name] || 0) + 1;
    return acc;
  }, {});

  const editFormJsx = (
    <form onSubmit={saveEdit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Nama Proyek</label>
        <input
          type="text"
          value={editForm.project_name}
          onChange={(e) => setEditForm({ ...editForm, project_name: e.target.value })}
          className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Tugas (satu per baris)</label>
        <textarea
          rows={3}
          value={editForm.tasks}
          onChange={(e) => setEditForm({ ...editForm, tasks: e.target.value })}
          className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
        <select
          value={editForm.status}
          onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
          className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
        >
          {['In Progress', 'Completed', 'Blocked'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Prioritas</label>
        <select
          value={editForm.priority}
          onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
          className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
        >
          {PRIORITY_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Deadline</label>
        <input
          type="date"
          value={editForm.deadline}
          onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })}
          className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Ringkasan</label>
        <input
          type="text"
          value={editForm.summary}
          onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
          className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Tag / Label (pisahkan dengan koma)</label>
        <input
          type="text"
          value={editForm.tags}
          onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
          placeholder="Contoh: Backend, Sistem Absensi, PT Klien"
          className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />
      </div>

      {editError && <p className="text-sm text-red-600">{editError}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={editLoading}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
        >
          {editLoading ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
        <button
          type="button"
          onClick={cancelEdit}
          className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium transition-colors"
        >
          Batal
        </button>
      </div>
    </form>
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <img
              src="/icons/logo.png"
              alt="Logo AI Project Manager"
              className="h-10 w-10 rounded-lg object-cover ring-2 ring-indigo-100"
            />
            <div className="leading-tight">
              <p className="font-extrabold tracking-tight">AI Project Manager</p>
              <p className="text-xs text-slate-500">Kelola progres proyek dengan bantuan AI</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full bg-slate-100 px-4 py-1.5 text-sm font-medium text-slate-600 sm:flex">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
        <div className="space-y-8">

          {/* Hero */}
          <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-700 p-6 text-white shadow-xl sm:p-10">
            <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-violet-400/25 blur-2xl" />
            <div className="pointer-events-none absolute right-10 bottom-0 h-24 w-24 rounded-full bg-indigo-300/30 blur-xl" />
            <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-center">
              <div className="shrink-0 rounded-2xl bg-white/10 p-3 ring-1 ring-white/30 backdrop-blur">
                <img
                  src="/icons/logo.png"
                  alt="Logo"
                  className="h-24 w-24 rounded-xl object-cover shadow-lg sm:h-28 sm:w-28"
                />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                  AI Project Manager Pribadi
                </h1>
                <p className="mt-2 text-sm text-indigo-100 sm:text-base">
                  Tulis catatan bebas apa saja yang sudah Anda kerjakan hari ini, biarkan AI yang
                  merapikannya menjadi data progres proyek yang rapi dan terstruktur.
                </p>
                <div className="mt-6 grid grid-cols-3 gap-3 sm:max-w-md">
                  <div className="rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/20 backdrop-blur">
                    <p className="text-2xl font-extrabold">{Object.keys(projectCounts).length}</p>
                    <p className="text-xs text-indigo-200">Proyek</p>
                  </div>
                  <div className="rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/20 backdrop-blur">
                    <p className="text-2xl font-extrabold">{todayHistory.length}</p>
                    <p className="text-xs text-indigo-200">Catatan Hari Ini</p>
                  </div>
                  <div className="rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/20 backdrop-blur">
                    <p className="text-2xl font-extrabold">{history.length}</p>
                    <p className="text-xs text-indigo-200">Total Catatan</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Deadline Terdekat */}
          {upcomingDeadlines.length > 0 && (
            <section className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 via-white to-amber-50 p-6 shadow-sm sm:p-8">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-600 text-white shadow-md">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-extrabold tracking-tight text-rose-900">Deadline Terdekat</h2>
                  <p className="text-sm text-rose-700">
                    5 tugas teratas yang belum selesai dan paling mendekati tenggat waktunya.
                  </p>
                </div>
                <span className="rounded-full bg-rose-600 px-3 py-1 text-xs font-bold text-white">
                  {upcomingDeadlines.length} tugas
                </span>
              </div>

              {deadlineError && <p className="mt-3 text-sm text-red-600">{deadlineError}</p>}

              <ul className="mt-5 space-y-3">
                {upcomingDeadlines.map((item) => {
                  const badge = deadlineBadge(item.deadline) || { text: '-', cls: 'bg-slate-100 text-slate-600' };
                  return (
                    <li
                      key={item.id}
                      className="flex items-center gap-4 rounded-xl border border-rose-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-bold ${badge.cls}`}>
                        {daysUntil(item.deadline)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-800">{item.project_name}</p>
                        <p className="truncate text-xs text-slate-500">"{item.summary}"</p>
                      </div>
                      <div className="text-right whitespace-nowrap">
                        <p className="text-xs font-semibold text-rose-600">{badge.text}</p>
                        <p className="text-xs text-slate-400">{formatDate(item.deadline)}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

        {/* Input Form */}
        <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="rawText" className="block text-sm font-medium text-slate-700 mb-1">
                Catatan / Progress Hari Ini
              </label>
              <textarea
                id="rawText"
                rows={4}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Contoh: Tadi pagi bereskan migrasi tabel database siswa untuk project sistem absensi, terus sorenya lanjut debugging API login NestJS..."
                className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                required
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'AI Sedang Menganalisis...' : 'Catat & Analisis dengan AI'}
            </button>

            <button
              type="button"
              onClick={() => setManualOpen(v => !v)}
              className="w-full text-sm text-slate-500 hover:text-indigo-600"
            >
              {manualOpen ? '− Sembunyikan Form Input Manual' : '＋ Atau input manual (tanpa AI)'}
            </button>
          </form>
        </div>

        {/* Form Input Manual (fallback saat AI error / kuota habis) */}
        {manualOpen && (
          <div className="bg-amber-50 shadow-sm border border-amber-300 rounded-xl p-6">
            <h2 className="text-lg font-bold tracking-tight text-amber-900">Input Progress Manual</h2>
            <p className="mt-1 text-sm text-amber-800">
              Input langsung sesuai kolom tabel (Proyek, Tugas, Status, Ringkasan) tanpa AI.
            </p>
            <form onSubmit={handleManualSubmit} className="mt-4 space-y-4">
              <div>
                <label htmlFor="manualProject" className="block text-sm font-medium text-amber-900 mb-1">
                  Nama Proyek
                </label>
                <input
                  id="manualProject"
                  type="text"
                  value={manualForm.project_name}
                  onChange={(e) => setManualForm({ ...manualForm, project_name: e.target.value })}
                  placeholder="Contoh: Sistem Absensi"
                  className="w-full rounded-lg border border-amber-300 p-3 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label htmlFor="manualTasks" className="block text-sm font-medium text-amber-900 mb-1">
                  Tugas (satu per baris)
                </label>
                <textarea
                  id="manualTasks"
                  rows={3}
                  value={manualForm.tasks}
                  onChange={(e) => setManualForm({ ...manualForm, tasks: e.target.value })}
                  placeholder={'Migrasi tabel database siswa\nDebugging API login'}
                  className="w-full rounded-lg border border-amber-300 p-3 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="manualStatus" className="block text-sm font-medium text-amber-900 mb-1">
                  Status
                </label>
                <select
                  id="manualStatus"
                  value={manualForm.status}
                  onChange={(e) => setManualForm({ ...manualForm, status: e.target.value })}
                  className="w-full rounded-lg border border-amber-300 p-3 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                >
                  {['In Progress', 'Completed', 'Blocked'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="manualPriority" className="block text-sm font-medium text-amber-900 mb-1">
                  Prioritas
                </label>
                <select
                  id="manualPriority"
                  value={manualForm.priority}
                  onChange={(e) => setManualForm({ ...manualForm, priority: e.target.value })}
                  className="w-full rounded-lg border border-amber-300 p-3 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                >
                  {PRIORITY_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="manualDeadline" className="block text-sm font-medium text-amber-900 mb-1">
                  Deadline (opsional)
                </label>
                <input
                  id="manualDeadline"
                  type="date"
                  value={manualForm.deadline}
                  onChange={(e) => setManualForm({ ...manualForm, deadline: e.target.value })}
                  className="w-full rounded-lg border border-amber-300 p-3 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                />
              </div>

              <div>
                <label htmlFor="manualSummary" className="block text-sm font-medium text-amber-900 mb-1">
                  Ringkasan
                </label>
                <input
                  id="manualSummary"
                  type="text"
                  value={manualForm.summary}
                  onChange={(e) => setManualForm({ ...manualForm, summary: e.target.value })}
                  placeholder="Contoh: Selesai migrasi database siswa"
                  className="w-full rounded-lg border border-amber-300 p-3 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label htmlFor="manualTags" className="block text-sm font-medium text-amber-900 mb-1">
                  Tag / Label (pisahkan dengan koma)
                </label>
                <input
                  id="manualTags"
                  type="text"
                  value={manualForm.tags}
                  onChange={(e) => setManualForm({ ...manualForm, tags: e.target.value })}
                  placeholder="Contoh: Backend, Sistem Absensi, PT Klien"
                  className="w-full rounded-lg border border-amber-300 p-3 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {manualError && <p className="text-sm text-red-600">{manualError}</p>}

              <button
                type="submit"
                disabled={manualLoading}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50"
              >
                {manualLoading ? 'Menyimpan...' : 'Simpan Progress Manual'}
              </button>
            </form>
          </div>
        )}

        {/* Ringkasan Mingguan */}
        <div className="bg-white shadow-sm border border-indigo-200 rounded-xl p-6">
          <h2 className="text-xl font-bold tracking-tight">Ringkasan Mingguan</h2>
          <p className="mt-1 text-sm text-slate-600">
            AI akan merangkum seluruh progress, pencapaian, kendala, dan rencana minggu depan dari data 7 hari terakhir.
          </p>
          <button
            type="button"
            onClick={handleWeeklyRecap}
            disabled={recapLoading}
            className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            {recapLoading ? 'AI Sedang Menyusun Ringkasan...' : 'Buat Ringkasan Mingguan'}
          </button>

          {recapError && <p className="mt-3 text-sm text-red-600">{recapError}</p>}

          {recap && (
            <div className="mt-5 rounded-lg bg-slate-50 border border-slate-200 p-5">
              <div className="prose prose-sm max-w-none whitespace-pre-line text-sm text-slate-800">
                {recap}
              </div>
            </div>
          )}
        </div>

        {/* Hasil Rekap / Riwayat */}
        <div className="space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h2 className="text-xl font-bold tracking-tight">Dashboard / Tabel Progress</h2>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                {['cards', 'table'].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                      view === v ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {v === 'cards' ? 'Kartu' : 'Tabel'}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleDownloadMarkdown}
                disabled={todayHistory.length === 0}
                title={todayHistory.length === 0 ? 'Belum ada catatan hari ini' : 'Unduh riwayat hari ini sebagai file .md'}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  todayHistory.length === 0
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                Download Markdown
              </button>
            </div>
          </div>

          {/* Filter & Pencarian */}
          <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-4 space-y-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama proyek..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            <div className="flex flex-wrap gap-2">
              {['All', 'In Progress', 'Completed', 'Blocked'].map(status => {
                const active = status === 'All'
                  ? statusFilter.length === 0
                  : statusFilter.includes(status);
                const handleClick = () => {
                  if (status === 'All') {
                    setStatusFilter([]);
                  } else {
                    setStatusFilter(prev =>
                      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
                    );
                  }
                };
                return (
                  <button
                    key={status}
                    onClick={handleClick}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {status}
                  </button>
                );
              })}
            </div>
            {allTags.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Tag / Label:</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setTagFilter([])}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      tagFilter.length === 0
                        ? 'bg-violet-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Semua
                  </button>
                  {allTags.map(tag => {
                    const active = tagFilter.includes(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => setTagFilter(prev =>
                          prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                        )}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                          active
                            ? 'bg-violet-600 text-white'
                            : 'bg-violet-50 text-violet-700 hover:bg-violet-100'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-sm text-slate-500">Urutkan:</span>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
              >
                <option value="created_at">Tanggal</option>
                <option value="project_name">Proyek</option>
                <option value="status">Status</option>
                <option value="priority">Prioritas</option>
              </select>
              <button
                type="button"
                onClick={() => setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))}
                title={sortDir === 'asc' ? 'Urutan menaik' : 'Urutan menurun'}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors flex items-center gap-1"
              >
                {sortDir === 'asc' ? '▲ Naik' : '▼ Turun'}
              </button>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Prioritas:</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setPriorityFilter([])}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    priorityFilter.length === 0
                      ? 'bg-orange-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Semua
                </button>
                {PRIORITY_OPTIONS.map(o => {
                  const active = priorityFilter.includes(o.value);
                  return (
                    <button
                      key={o.value}
                      onClick={() => setPriorityFilter(prev =>
                        prev.includes(o.value) ? prev.filter(v => v !== o.value) : [...prev, o.value]
                      )}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        active
                          ? 'bg-orange-600 text-white'
                          : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
                      }`}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center text-slate-500">
              {history.length === 0
                ? 'Belum ada catatan hari ini. Mulai ketik di atas!'
                : 'Tidak ada hasil yang cocok dengan filter.'}
            </div>
          ) : view === 'table' ? (
            <div className="bg-white shadow-sm border border-slate-200 rounded-xl overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Tanggal</th>
                    <th className="px-4 py-3 font-semibold">Proyek</th>
                    <th className="px-4 py-3 font-semibold">Tugas</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Prioritas</th>
                    <th className="px-4 py-3 font-semibold">Deadline</th>
                    <th className="px-4 py-3 font-semibold">Tag</th>
                    <th className="px-4 py-3 font-semibold">Ringkasan</th>
                    <th className="px-4 py-3 font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {taskRows.map((row, idx) => {
                    const isEditing = row.id === editingId;
                    const firstOfId = taskRows.findIndex(r => r.id === row.id) === idx;
                    return (
                      <Fragment key={idx}>
                        {isEditing && firstOfId && (
                          <tr>
                            <td colSpan={9} className="px-4 py-3 bg-indigo-50/50">
                              {editFormJsx}
                            </td>
                          </tr>
                        )}
                        {!isEditing && (
                          <tr className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap text-slate-500">{row.date}</td>
                            <td className="px-4 py-3 font-medium text-indigo-600 whitespace-nowrap">{row.project_name}</td>
                            <td className="px-4 py-3 text-slate-700">{row.task}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${row.status === 'Completed' ? 'bg-green-100 text-green-800' :
                                row.status === 'Blocked' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                {row.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${row.priority === 'kritis' ? 'bg-red-100 text-red-800' :
                                row.priority === 'tinggi' ? 'bg-orange-100 text-orange-800' :
                                row.priority === 'rendah' ? 'bg-slate-100 text-slate-600' : 'bg-sky-100 text-sky-800'
                                }`}>
                                {priorityLabels[row.priority] || 'Sedang'}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {row.deadline ? (() => {
                                const badge = deadlineBadge(row.deadline);
                                return (
                                  <div className="flex flex-col gap-0.5">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badge ? badge.cls : 'bg-slate-100 text-slate-600'}`}>
                                      {formatDate(row.deadline)}
                                    </span>
                                    {badge && <span className="text-[10px] font-medium text-rose-600">{badge.text}</span>}
                                  </div>
                                );
                              })() : (
                                <span className="text-xs text-slate-300">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex flex-wrap gap-1">
                                {(row.tags || []).map(tag => (
                                  <span key={tag} className="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-500 italic text-xs">"{row.summary}"</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const editItem = filteredHistory.find(i => i.id === row.id);
                                    if (editItem) openEdit(editItem);
                                  }}
                                  className="px-2 py-1 rounded text-xs font-medium bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(row.id)}
                                  disabled={deletingId === row.id}
                                  className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50"
                                >
                                  {deletingId === row.id ? '...' : 'Hapus'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            paginatedHistory.map((item, index) => (
              <div key={item.id || index} className="bg-white shadow-sm border border-slate-200 rounded-xl p-6 space-y-3">
                {editingId === item.id ? (
                  editFormJsx
                ) : (
                  <>
                    <div className="flex justify-between items-start">
                      <h3 className="text-lg font-bold text-indigo-600">{item.project_name}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${item.status === 'Completed' ? 'bg-green-100 text-green-800' :
                        item.status === 'Blocked' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                        {item.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${(item.priority || 'sedang') === 'kritis' ? 'bg-red-100 text-red-800' :
                        (item.priority || 'sedang') === 'tinggi' ? 'bg-orange-100 text-orange-800' :
                        (item.priority || 'sedang') === 'rendah' ? 'bg-slate-100 text-slate-600' : 'bg-sky-100 text-sky-800'
                        }`}>
                        {priorityLabels[(item.priority || 'sedang').toLowerCase()] || 'Sedang'}
                      </span>
                      <span className="text-xs text-slate-400">Prioritas</span>
                    </div>

                    {item.deadline && (() => {
                      const badge = deadlineBadge(item.deadline);
                      return (
                        <div className="flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${badge ? badge.cls : 'bg-slate-100 text-slate-600'}`}>
                            {formatDate(item.deadline)}
                          </span>
                          {badge && <span className="text-xs font-medium text-rose-600">{badge.text}</span>}
                        </div>
                      );
                    })()}

                    <p className="text-sm text-slate-700 italic">"{item.summary}"</p>

                    {(item.tags && item.tags.length > 0) && (
                      <div className="flex flex-wrap gap-1">
                        {item.tags.map(tag => (
                          <span key={tag} className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Detail Tugas:</h4>
                      <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                        {item.tasks.map((task, idx) => (
                          <li key={idx}>{task}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50"
                      >
                        {deletingId === item.id ? 'Menghapus...' : 'Hapus'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm text-slate-500">
                Menampilkan {((safePage - 1) * pageSize) + 1}–{Math.min(safePage * pageSize, sortedHistory.length)} dari {sortedHistory.length} catatan
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage(safePage - 1)}
                  disabled={safePage <= 1}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ‹ Sebelumnya
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                        p === safePage
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setPage(safePage + 1)}
                  disabled={safePage >= totalPages}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Berikutnya ›
                </button>
              </div>
            </div>
          )}
        </div>

          <footer className="border-t border-slate-200 pt-6 text-center text-xs text-slate-400">
            &copy; {new Date().getFullYear()} AI Project Manager &mdash; Dibangun dengan Supabase &amp; Gemini
          </footer>
        </div>
      </main>
    </div>
  );
}