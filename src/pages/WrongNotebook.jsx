import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  BookOpen,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Filter,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import WrongNotebookItem from '@/components/wrong-notebook/WrongNotebookItem';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

const DIFFICULTY_OPTIONS = [
  { id: 'all', label: '全部难度' },
  { id: 'beginner', label: '初级' },
  { id: 'intermediate', label: '中级' },
  { id: 'advanced', label: '高级' },
];

export default function WrongNotebook() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [difficulty, setDifficulty] = useState('all');
  const [bookFilter, setBookFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const navigate = useNavigate();
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.WrongNotebook.filter(
        { removed: false },
        '-last_wrong_date',
        500
      );
      setItems(data || []);
    } catch (e) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // 提取所有词书来源
  const books = useMemo(() => {
    const set = new Set();
    items.forEach(item => {
      if (item.category) set.add(item.category);
      else if (item.book) set.add(item.book);
    });
    return ['all', ...Array.from(set).sort()];
  }, [items]);

  // 筛选 + 排序
  const filtered = useMemo(() => {
    let result = items;

    if (difficulty !== 'all') {
      result = result.filter(i => i.difficulty === difficulty);
    }
    if (bookFilter !== 'all') {
      result = result.filter(i =>
        (i.category || i.book || '') === bookFilter
      );
    }

    if (sortBy === 'count') {
      result = [...result].sort((a, b) => (b.wrong_count || 1) - (a.wrong_count || 1));
    } else if (sortBy === 'alpha') {
      result = [...result].sort((a, b) => (a.thai_word || '').localeCompare(b.thai_word || ''));
    }
    // default: date (already sorted by API)

    return result;
  }, [items, difficulty, bookFilter, sortBy]);

  // 统计
  const stats = useMemo(() => {
    const total = items.length;
    const byDiff = { beginner: 0, intermediate: 0, advanced: 0 };
    items.forEach(i => {
      if (i.difficulty && byDiff[i.difficulty] !== undefined) byDiff[i.difficulty]++;
    });
    return { total, ...byDiff };
  }, [items]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(i => i.id)));
    }
  };

  const handleRemove = async (item) => {
    try {
      await base44.entities.WrongNotebook.update(item.id, { removed: true });
      setItems(prev => prev.filter(i => i.id !== item.id));
      setSelectedIds(prev => { const n = new Set(prev); n.delete(item.id); return n; });
      toast({ title: '已移除', description: '该单词已从错题本移除' });
    } catch (e) {
      toast({ title: '操作失败', variant: 'destructive' });
    }
  };

  const handleBatchRemove = async () => {
    const count = selectedIds.size;
    if (count === 0) return;
    try {
      for (const id of selectedIds) {
        await base44.entities.WrongNotebook.update(id, { removed: true });
      }
      setItems(prev => prev.filter(i => !selectedIds.has(i.id)));
      setSelectedIds(new Set());
      setSelectMode(false);
      toast({ title: '批量移除', description: `已移除 ${count} 个错题` });
    } catch (e) {
      toast({ title: '操作失败', variant: 'destructive' });
    }
  };

  const handleBatchPractice = () => {
    const words = filtered.filter(i => selectedIds.size === 0 || selectedIds.has(i.id));
    if (words.length === 0) {
      toast({ title: '无错题可练', description: '请选择要练习的错题' });
      return;
    }
    navigate('/vocabulary', {
      state: { quizFromWrong: true, wrongWords: words },
    });
  };

  const handlePractice = (item) => {
    navigate('/vocabulary', {
      state: { quizFromWrong: true, wrongWords: [item] },
    });
  };

  const clearFilters = () => {
    setDifficulty('all');
    setBookFilter('all');
    setSortBy('date');
  };

  const hasFilters = difficulty !== 'all' || bookFilter !== 'all' || sortBy !== 'date';

  return (
    <div className="min-h-screen bg-gradient-to-b from-thai-ivory via-white to-thai-cream/20">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 pb-24 md:pb-7 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-heading font-bold text-2xl text-thai-green">错题本</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {loading ? '加载中...' : `共 ${items.length} 个错题`}
            </p>
          </div>
          {!loading && items.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  selectMode
                    ? 'bg-thai-green text-white'
                    : 'bg-thai-ivory/60 text-thai-green hover:bg-thai-ivory'
                }`}
              >
                {selectMode ? <X className="w-3.5 h-3.5" /> : <CheckSquare className="w-3.5 h-3.5" />}
                {selectMode ? '取消' : '选择'}
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 rounded-2xl bg-thai-ivory/40 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-thai-ivory/60 flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-thai-green/30" />
            </div>
            <p className="text-thai-green/60 font-medium">错题本为空</p>
            <p className="text-sm text-muted-foreground mt-1">完成词汇测验后，答错的单词会出现在这里</p>
            <button onClick={() => navigate('/vocabulary')} className="mt-4 px-4 py-2 rounded-lg bg-thai-green text-white text-sm">
              去测验
            </button>
          </div>
        ) : (
          <>
            {/* Stats bar */}
            <div className="flex items-center gap-3 flex-wrap">
              {stats.beginner > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                  初级 {stats.beginner}
                </span>
              )}
              {stats.intermediate > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-600">
                  中级 {stats.intermediate}
                </span>
              )}
              {stats.advanced > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600">
                  高级 {stats.advanced}
                </span>
              )}
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-thai-green transition"
            >
              <Filter className="w-3.5 h-3.5" />
              筛选与排序
              {showFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {hasFilters && (
                <span className="w-1.5 h-1.5 rounded-full bg-thai-green" />
              )}
            </button>

            {/* Filter panel */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-2xl border border-thai-green/8 bg-white/80 p-4 space-y-3">
                    {/* Difficulty */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">难度</label>
                      <div className="flex flex-wrap gap-1.5">
                        {DIFFICULTY_OPTIONS.map(opt => (
                          <button
                            key={opt.id}
                            onClick={() => setDifficulty(opt.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                              difficulty === opt.id
                                ? 'bg-thai-green text-white'
                                : 'bg-thai-ivory/40 text-muted-foreground hover:bg-thai-ivory'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Book */}
                    {books.length > 2 && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">词书</label>
                        <div className="flex flex-wrap gap-1.5">
                          {books.map(b => (
                            <button
                              key={b}
                              onClick={() => setBookFilter(b)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                                bookFilter === b
                                  ? 'bg-thai-blue text-white'
                                  : 'bg-thai-ivory/40 text-muted-foreground hover:bg-thai-ivory'
                              }`}
                            >
                              {b === 'all' ? '全部' : b}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sort */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">排序</label>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { id: 'date', label: '最近答错' },
                          { id: 'count', label: '错误最多' },
                          { id: 'alpha', label: '泰文排序' },
                        ].map(s => (
                          <button
                            key={s.id}
                            onClick={() => setSortBy(s.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                              sortBy === s.id
                                ? 'bg-thai-green text-white'
                                : 'bg-thai-ivory/40 text-muted-foreground hover:bg-thai-ivory'
                            }`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {hasFilters && (
                      <button
                        onClick={clearFilters}
                        className="text-xs text-red-400 hover:text-red-500 transition"
                      >
                        清除全部筛选
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Batch action bar */}
            {selectMode && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between rounded-2xl border border-thai-green/10 bg-thai-green/5 p-3"
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleSelectAll}
                    className="text-xs text-thai-green font-medium hover:underline"
                  >
                    {selectedIds.size === filtered.length ? '取消全选' : '全选'}
                  </button>
                  <span className="text-xs text-muted-foreground">
                    已选 {selectedIds.size}/{filtered.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {selectedIds.size > 0 && (
                    <button
                      onClick={handleBatchPractice}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-thai-green text-white text-xs font-medium"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      练习选中 ({selectedIds.size})
                    </button>
                  )}
                  {selectedIds.size > 0 && (
                    <button
                      onClick={handleBatchRemove}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-500 text-xs font-medium hover:bg-red-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      删除 ({selectedIds.size})
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* Word list */}
            <div className="space-y-2.5">
              <AnimatePresence>
                {filtered.map(item => (
                  <WrongNotebookItem
                    key={item.id}
                    item={item}
                    selectMode={selectMode}
                    selected={selectedIds.has(item.id)}
                    onToggleSelect={() => toggleSelect(item.id)}
                    onRemove={handleRemove}
                    onPractice={handlePractice}
                  />
                ))}
              </AnimatePresence>
            </div>

            {/* Bottom action */}
            {!selectMode && filtered.length > 0 && (
              <div className="flex justify-center pt-2">
                <button
                  onClick={handleBatchPractice}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-thai-green to-emerald-500 text-white text-sm font-semibold shadow-lg"
                >
                  <RotateCcw className="w-4 h-4" />
                  开始复习全部错题 ({filtered.length})
                </button>
              </div>
            )}

            {filtered.length === 0 && items.length > 0 && (
              <div className="text-center py-10">
                <p className="text-sm text-muted-foreground">当前筛选条件下没有错题</p>
                <button onClick={clearFilters} className="mt-2 text-xs text-thai-green hover:underline">
                  清除筛选
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
