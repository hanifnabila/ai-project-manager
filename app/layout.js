import './globals.css'

export const metadata = {
  title: 'AI Project Manager',
  description: 'Manage your projects with AI assistance',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
