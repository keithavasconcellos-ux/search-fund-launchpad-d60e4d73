import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Map, Kanban, Library, Mail, FileSearch, Search, LogOut } from 'lucide-react';
import { signOut } from './auth/RequireAuth';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/map', label: 'Map View', icon: Map },
  { path: '/crm', label: 'CRM', icon: Kanban },
  { path: '/library', label: 'Library', icon: Library },
  { path: '/email', label: 'Email Hub', icon: Mail },
  { path: '/dd-agent', label: 'DD Agent', icon: FileSearch },
];

export default function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = () => {
    signOut();
    navigate('/login', { replace: true });
  };

  return (
    <aside className="fixed left-0 top-0 w-[240px] h-screen bg-background-secondary border-r border-border overflow-y-auto z-50 flex flex-col">
      {/* Logo */}
      <div className="px-5 pt-6 pb-5 border-b border-border">
        <div className="font-display text-[22px] text-teal font-bold tracking-tight">acquira</div>
        <div className="font-mono text-[9px] text-text-tertiary uppercase tracking-[2px] mt-0.5">
          Search Fund Tool
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-3">
        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-background-tertiary text-text-tertiary text-sm hover:bg-background-quaternary transition-colors">
          <Search className="w-3.5 h-3.5" />
          <span>Search everything…</span>
          <span className="ml-auto font-mono text-[10px] bg-background-quaternary px-1.5 py-0.5 rounded">⌘K</span>
        </button>
      </div>

      {/* Nav */}
      <nav className="px-3 py-2 flex-1">
        <div className="font-mono text-[9px] text-text-tertiary uppercase tracking-[2px] px-2 mb-2">
          Modules
        </div>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-2.5 pl-2.5 pr-2.5 py-[7px] rounded-md text-[13px] transition-all mb-0.5 border-l-2 ${
                isActive
                  ? 'border-teal bg-teal/[0.08] text-teal'
                  : 'border-transparent text-text-secondary hover:bg-background-quaternary hover:text-foreground'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-border">
        <div className="flex items-center gap-2.5 px-2.5">
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-medium">
            KV
          </div>
          <div className="flex-1">
            <div className="text-xs text-foreground font-medium">Keith Vasconcellos</div>
            <div className="font-mono text-[10px] text-text-tertiary">Day 142</div>
          </div>
          <button
            onClick={handleSignOut}
            title="Sign out"
            aria-label="Sign out"
            className="p-1.5 rounded-md text-text-tertiary hover:text-foreground hover:bg-background-tertiary transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
