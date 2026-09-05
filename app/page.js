'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

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
      if (!result.success) throw new Error(result.error);

      setRawText('');
      fetchHistory(); // Refresh daftar riwayat dari database
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredHistory = history.filter(item => {
    const matchesSearch = item.project_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const projectCounts = history.reduce((acc, item) => {
    acc[item.project_name] = (acc[item.project_name] || 0) + 1;
    return acc;
  }, {});

  // ... (lanjutan return UI HTML seperti sebelumnya)

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
          </form>
        </div>

        {/* Hasil Rekap / Riwayat */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight">Rekap Progress</h2>

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
          ) : (
            filteredHistory.map((item, index) => (
              <div key={index} className="bg-white shadow-sm border border-slate-200 rounded-xl p-6 space-y-3">
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
              </div>
            ))
          )}
        </div>

      </div>
    </main>
  );
}