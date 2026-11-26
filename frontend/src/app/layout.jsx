import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { CommandShell } from '@/components/layout/CommandShell';
const sans = Inter({
    subsets: ['latin'],
    variable: '--font-sans',
    display: 'swap',
});
const mono = JetBrains_Mono({
    subsets: ['latin'],
    variable: '--font-mono',
    display: 'swap',
});
export const metadata = {
    title: 'Roster Engine — Workforce Scheduling & Operations',
    description: 'Deterministic workforce scheduling, multi-lens operations matrix, SPOF audit, and disruption simulation',
};
export default function RootLayout({ children, }) {
    return (<html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-[#fafafa] text-zinc-950 font-sans selection:bg-zinc-900 selection:text-white">
        <CommandShell>{children}</CommandShell>
      </body>
    </html>);
}
