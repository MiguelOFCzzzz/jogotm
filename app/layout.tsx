// app/layout.tsx
import './globals.css';
import { Cinzel } from 'next/font/google'; // Fonte estilo RPG

const cinzel = Cinzel({ subsets: ['latin'] });

export const metadata = {
  title: 'Glory DARK - RPG',
  description: 'Uma jornada épica em Next.js',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-br" className="overflow-hidden"> 
      <body className={`${cinzel.className} bg-slate-950 text-amber-100 antialiased`}>
        {/* Camada fixa de atmosfera (opcional) */}
        <div className="fixed inset-0 pointer-events-none z-50 bg-[url('/images/vignette.png')] opacity-40"></div>
        
        {children}
      </body>
    </html>
  );
}