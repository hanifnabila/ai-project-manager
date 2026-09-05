'use client';

import { useState, useEffect, Fragment } from 'react';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [recap, setRecap] = useState('');
  const [recapLoading, setRecapLoading] = useState(false);
  const [recapError, setRecapError] = useState('');
  const [view, setView] = useState('cards');
  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    project_name: '',
    tasks: '',
    status: 'In Progress',
    summary: '',
  });
  const [manualError, setManualError] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ project_name: '', tasks: '', status: 'In Progress', summary: '' });
  const [editError, setEditError] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Ambil data dari Supabase saat halaman pertama kali dibuka
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    if (!supabase) return;

    const { data, error } = await supabase
      .from('progress_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      // Format ulang data tasks dari string JSON kembali ke array
      const formattedData = data.map(item => ({
        ...item,
        tasks: typeof item.tasks === 'string' ? JSON.parse(item.tasks) : item.tasks
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
      summary: manualForm.summary,
      tasks: manualForm.tasks,
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
      setManualForm({ project_name: '', tasks: '', status: 'In Progress', summary: '' });
      setError('');
      fetchHistory();
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
      summary: item.summary || '',
    });
    setEditError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ project_name: '', tasks: '', status: 'In Progress', summary: '' });
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
        body: JSON.stringify({ id: editingId, ...editForm }),
      });

      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      cancelEdit();
      fetchHistory();
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
      lines.push(`## ${item.project_name} (${item.status})`, '');
      lines.push(`**Ringkasan:** "${item.summary}"`, '');
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

  const filteredHistory = history.filter(item => {
    const matchesSearch = item.project_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatDate = (iso) => {
    const date = new Date(iso);
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const taskRows = filteredHistory.flatMap(item =>
    (item.tasks || []).map(task => ({
      id: item.id,
      date: formatDate(item.created_at),
      project_name: item.project_name,
      task,
      status: item.status,
      summary: item.summary,
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
        <label className="block text-sm font-medium text-slate-700 mb-1">Ringkasan</label>
        <input
          type="text"
          value={editForm.summary}
          onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
          className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          required
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
    <main className="min-h-screen bg-slate-50 text-slate-900 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">

        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight">AI Project Manager Pribadi</h1>
          <p className="mt-2 text-sm text-slate-600">
            Tulis catatan bebas apa saja yang sudah Anda kerjakan hari ini, biarkan AI yang merapikannya.
          </p>
        </div>

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
            <div className="flex gap-2">
              {['All', 'In Progress', 'Completed', 'Blocked'].map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    statusFilter === status
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {status}
                </button>
              ))}
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
                            <td colSpan={6} className="px-4 py-3 bg-indigo-50/50">
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
            filteredHistory.map((item, index) => (
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

                    <p className="text-sm text-slate-700 italic">"{item.summary}"</p>

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
        </div>

      </div>
    </main>
  );
}