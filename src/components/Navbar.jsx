import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Bell, Sparkles, ChevronLeft, Menu, Sun, Moon } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useTheme } from '@/hooks/useTheme';
import ThemeQuickSwitcher from '@/components/theme/ThemeQuickSwitcher';

const navLinks = [
  { label: '首页', path: '/', activePath: '/' },
  { label: '词汇', path: '/vocabulary', activePath: '/vocabulary' },
  { label: '挑战赛', path: '/challenges', activePath: '/challenges' },
  { label: '错题本', path: '/wrong-notebook', activePath: '/wrong-notebook' },
  { label: '口语', path: '/speaking-practice', activePath: '/speaking-practice' },
  { label: '设置', path: '/settings', activePath: '/settings' },
  { label: 'AI辅导', path: '/#ai-teacher', activePath: null },
  { label: '进度', path: '/#progress', activePath: null },
];

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const handleBell = () => {
    toast({ title: '学习提醒', description: '保持每日学习习惯，泰语进步更快！' });
  };

  return (
    <nav className="sticky top-0 z-50 glass border-b border-thai-gold/10 safe-area-top">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2.5">
            {location.pathname !== '/' && (
              <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-lg hover:bg-thai-ivory/60 transition-all">
                <ChevronLeft className="w-5 h-5 text-thai-green" />
              </button>
            )}
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-thai-gold via-amber-500 to-thai-green flex items-center justify-center shadow-lg shadow-thai-gold/20">
              <span className="font-thai text-white font-bold text-sm">ไทย</span>
              <Sparkles className="absolute -top-1 -right-1 w-3.5 h-3.5 text-thai-gold-light bg-white rounded-full p-0.5" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-heading font-extrabold text-base text-thai-green">ThaiAI</span>
              <span className="text-[10px] text-muted-foreground tracking-wider">泰语AI学习</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-0.5">
            {navLinks.map((link) => {
              const active = link.activePath && location.pathname === link.activePath;
              return (
                <Link key={link.label} to={link.path}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    active ? 'text-thai-green bg-thai-ivory/80' : 'text-thai-green/50 hover:text-thai-green hover:bg-thai-ivory/50'
                  }`}>
                  {link.label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/vocabulary')} className="p-2 rounded-lg hover:bg-thai-ivory/60 transition-all">
              <Search className="w-4 h-4 text-thai-green/60" />
            </button>
            <ThemeQuickSwitcher compact />
            <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-thai-ivory/60 transition-all">
              {theme === 'dark' ? <Sun className="w-4 h-4 text-thai-gold" /> : <Moon className="w-4 h-4 text-thai-green/60" />}
            </button>
            <button onClick={handleBell} className="p-2 rounded-lg hover:bg-thai-ivory/60 transition-all relative">
              <Bell className="w-4 h-4 text-thai-green/60" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-thai-gold rounded-full ring-2 ring-white"></span>
            </button>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button className="md:hidden p-2 rounded-lg hover:bg-thai-ivory/60 transition-all">
                  <Menu className="w-5 h-5 text-thai-green" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <SheetHeader>
                  <SheetTitle className="text-thai-green">导航菜单</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-1 mt-4">
                  {navLinks.map((link) => {
                    const active = link.activePath && location.pathname === link.activePath;
                    return (
                      <Link key={link.label} to={link.path} onClick={() => setMobileOpen(false)}
                        className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                          active ? 'text-thai-green bg-thai-ivory/80' : 'text-thai-green/60 hover:text-thai-green hover:bg-thai-ivory/50'
                        }`}>
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
              </SheetContent>
            </Sheet>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-thai-blue to-thai-green flex items-center justify-center text-white text-xs font-bold shadow-md ring-2 ring-white">
              อ
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}