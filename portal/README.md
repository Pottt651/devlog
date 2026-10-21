# Pott 主页

入口 / 未登录时展示账号与邮箱登录。pott1587 使用 AUTH_PASSWORD 加密配置，只可读取 /prepare/ 课件。指定主人邮箱通过内部 MAILER 服务收取验证码，可访问全部模块。AUTH_COOKIE_SECRET 用于验证码 HMAC，密码和会话令牌不能写入源码或日志。

会话保存于 devlog-db，数据库只保存随机令牌摘要，选中保持登录时有效 180 天。服务器对每个模块执行权限检查，863 与 AlphaMath 仅接受指定邮箱身份。oyboss 使用原独立 Worker 路由，不在主页展示。

node build.mjs 构建主站；课程由其私有 GitHub 仓库的 web-publish 独立自动发布，主站仅在登录校验后代理固定课件服务。主站不再复制旧的本地课件快照。

863 必须基于 work/live/etf-b863 当前生产源码包装，不能用落后的 GitHub master 覆盖业务代码。详细状态见 outputs/网站实施记录.md。
