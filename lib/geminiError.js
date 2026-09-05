export function isQuotaOrTempError(error) {
  const msg = `${error?.message || error?.toString?.() || ''}`;
  return /quota|RESOURCE_EXHAUSTED|429|UNAVAILABLE|503|high demand|no longer available/i.test(msg);
}

export function getGeminiErrorCode(error) {
  const msg = `${error?.message || error?.toString?.() || ''}`;
  if (/quota|RESOURCE_EXHAUSTED|429/i.test(msg)) return 'QUOTA';
  if (/UNAVAILABLE|503|high demand/i.test(msg)) return 'UNAVAILABLE';
  if (/no longer available|NOT_FOUND/i.test(msg)) return 'MODEL';
  return 'UNKNOWN';
}

export function getFriendlyGeminiError(error) {
  const msg = `${error?.message || error?.toString?.() || ''}`;

  if (/quota|RESOURCE_EXHAUSTED|429/i.test(msg)) {
    return 'Kuota AI Gemini hari ini sudah habis (limit 20 permintaan/hari). Silakan coba lagi besok, atau naikkan kuota di https://ai.dev/rate-limit.';
  }
  if (/UNAVAILABLE|503|high demand/i.test(msg)) {
    return 'Layanan AI Gemini sedang sibuk / tidak tersedia. Silakan coba lagi beberapa saat lagi.';
  }
  if (/no longer available|NOT_FOUND/i.test(msg)) {
    return 'Model AI yang dipakai sudah tidak tersedia. Silakan hubungi pengelola aplikasi.';
  }
  return 'Terjadi kesalahan yang tidak terduga. Silakan coba lagi nanti.';
}