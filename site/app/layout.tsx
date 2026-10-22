import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /* `suppressHydrationWarning` : le script plus bas ajoute un attribut à
       <html> avant l'hydratation. */
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=Inter:wght@400;500&display=swap"
          rel="stylesheet"
        />
        {/* Note la plateforme avant le rendu, pour ne proposer que le bon
            installeur sans clignotement (même script que la vitrine Hublink). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try {
  var ua = navigator.userAgent || '';
  var pf = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  var tactile = navigator.maxTouchPoints > 1;
  var os = '';
  if (/win/i.test(pf) || /Windows/.test(ua)) os = 'win';
  else if ((/mac/i.test(pf) || /Mac OS X/.test(ua)) && !tactile) os = 'mac';
  if (os) document.documentElement.dataset.os = os;
} catch (e) {}`
          }}
        />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
