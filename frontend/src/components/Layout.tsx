import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import ChatWidget from './ChatWidget';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex bg-slate-950 min-h-screen text-slate-100">
      {/* Backdrop mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar : fixé sur mobile, relatif sur desktop */}
      <div
        className={`fixed inset-y-0 left-0 z-30 md:relative md:flex-shrink-0 transition-transform duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Contenu principal */}
      <main className="flex-1 overflow-auto min-w-0">
        {/* Barre mobile */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-slate-900 border-b border-slate-700 sticky top-0 z-10 print:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-slate-400 hover:text-white"
            aria-label="Ouvrir le menu"
          >
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="" className="w-7 h-7 object-contain" />
            <span className="text-white font-semibold text-sm">POMIA</span>
          </div>
        </div>
        <Outlet />
      </main>

      <ChatWidget />
    </div>
  );
}
