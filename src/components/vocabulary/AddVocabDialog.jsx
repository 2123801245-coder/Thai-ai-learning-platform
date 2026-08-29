import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';

export default function AddVocabDialog({ open, onOpenChange, onAdded }) {
  const [form, setForm] = useState({
    thai_word: '',
    chinese_meaning: '',
    pronunciation: '',
    example_thai: '',
    example_chinese: '',
    category: '',
    difficulty: 'beginner',
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (!form.thai_word.trim() || !form.chinese_meaning.trim()) {
      toast({ title: '请填写泰语单词和中文释义', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await base44.entities.Vocabulary.create({
        ...form,
        category: form.category || '自定义',
      });
      toast({ title: '添加成功！', description: `${form.thai_word} 已加入词库` });
      setForm({
        thai_word: '', chinese_meaning: '', pronunciation: '',
        example_thai: '', example_chinese: '', category: '', difficulty: 'beginner',
      });
      onOpenChange(false);
      onAdded?.();
    } catch (err) {
      toast({ title: '添加失败', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-thai-green">添加新词汇</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto px-1">
          <div className="space-y-1.5">
            <Label>泰语单词 <span className="text-destructive">*</span></Label>
            <Input
              value={form.thai_word}
              onChange={(e) => update('thai_word', e.target.value)}
              placeholder="例如：สวัสดี"
              className="font-thai text-lg"
            />
          </div>
          <div className="space-y-1.5">
            <Label>中文释义 <span className="text-destructive">*</span></Label>
            <Input
              value={form.chinese_meaning}
              onChange={(e) => update('chinese_meaning', e.target.value)}
              placeholder="例如：你好"
            />
          </div>
          <div className="space-y-1.5">
            <Label>发音</Label>
            <Input
              value={form.pronunciation}
              onChange={(e) => update('pronunciation', e.target.value)}
              placeholder="例如：sà-wàt-dii"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>类别</Label>
              <Input
                value={form.category}
                onChange={(e) => update('category', e.target.value)}
                placeholder="例如：日常"
              />
            </div>
            <div className="space-y-1.5">
              <Label>难度</Label>
              <Select value={form.difficulty} onValueChange={(v) => update('difficulty', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">初级</SelectItem>
                  <SelectItem value="intermediate">中级</SelectItem>
                  <SelectItem value="advanced">高级</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>例句（泰语）</Label>
            <Input
              value={form.example_thai}
              onChange={(e) => update('example_thai', e.target.value)}
              placeholder="泰语例句"
              className="font-thai"
            />
          </div>
          <div className="space-y-1.5">
            <Label>例句（中文）</Label>
            <Input
              value={form.example_chinese}
              onChange={(e) => update('example_chinese', e.target.value)}
              placeholder="中文翻译"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSubmit} disabled={saving} className="bg-thai-green hover:bg-thai-green-light">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : '添加'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}