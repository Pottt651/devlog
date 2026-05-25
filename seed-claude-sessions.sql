-- 删除之前作为 /projects 卡片注入的条目（已改为左侧导航）
DELETE FROM projects WHERE slug = 'claude-sessions';
