import './globals.css'

export const metadata = {
  title: 'AI Project Manager',
  description: 'Manage your projects with AI assistance',
  icons: {
    icon: [
      { url: '/icons/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/icons/icon.png',
  },
  themeColor: '#4f46e5',
}

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  )
}
