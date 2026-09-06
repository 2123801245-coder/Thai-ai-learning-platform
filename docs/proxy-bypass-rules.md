# ThaiAI 代理绕过规则

## Surge

在 Surge 的配置文件 `[Rule]` 部分**最前面**添加：

```
DOMAIN-SUFFIX,thai-ai.online,DIRECT
DOMAIN-SUFFIX,thaiai.online,DIRECT
IP-CIDR,8.140.225.225/32,DIRECT
```

### 操作步骤（Surge Mac）

1. 打开 Surge → 偏好设置 → 配置
2. 编辑当前配置文件
3. 找到 `[Rule]` 段落
4. **在最顶部**粘贴上面 3 行
5. 保存并重载配置

---

## Clash / ClashX / Clash Verge / mihomo

在配置文件的 `rules:` 部分**最前面**添加：

```yaml
  - DOMAIN-SUFFIX,thai-ai.online,DIRECT
  - DOMAIN-SUFFIX,thaiai.online,DIRECT
  - IP-CIDR,8.140.225.225/32,DIRECT,no-resolve
```

### 操作步骤（ClashX）

1. 打开 ClashX → 配置 → 编辑配置
2. 滚动到文件最底部，找到 `rules:` 
3. **在 rules 列表最顶部**粘贴上面 3 行（注意缩进 2 个空格）
4. 保存 → 切换配置 → 重新加载

### 操作步骤（Clash Verge）

1. 打开 Clash Verge → 订阅 → 编辑配置
2. 找到 `rules:` 部分
3. 在最顶部添加上面 3 行
4. 保存并应用

---

## 通用排除规则（适用于所有代理工具）

如果上面的规则不起作用，也可以直接在代理工具的 **"不代理的域名"** 列表中添加：

```
thai-ai.online
*.thai-ai.online
```

---

## 验证方法

添加规则后，打开终端运行：

```bash
# 应该直接返回 8.140.225.225，不再返回 198.18.x.x
dig +short thai-ai.online

# 应该能正常访问
curl -s https://thai-ai.online | head -5
```
