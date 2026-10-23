-- DeepSeek Bot Group Pet · initial schema
-- Plain SQLite only: no vector extension, no embeddings, all knowledge is text.

CREATE TABLE IF NOT EXISTS bots (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  avatar          TEXT NOT NULL DEFAULT '🤖',
  accent          TEXT NOT NULL DEFAULT '#446DF6',
  system_prompt   TEXT NOT NULL DEFAULT '',
  model           TEXT NOT NULL DEFAULT 'deepseek-chat',
  temperature     REAL NOT NULL DEFAULT 0.7,
  max_tokens      INTEGER NOT NULL DEFAULT 4096,
  muted           INTEGER NOT NULL DEFAULT 0,
  auto_memory     INTEGER NOT NULL DEFAULT 1,
  share_memories  INTEGER NOT NULL DEFAULT 0,
  memory_scope    TEXT NOT NULL DEFAULT 'all',
  memory_limit    INTEGER NOT NULL DEFAULT 30,
  role            TEXT NOT NULL DEFAULT 'planner',
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rooms (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  kind               TEXT NOT NULL DEFAULT 'group',
  auto_poll          INTEGER NOT NULL DEFAULT 1,
  allow_bot_mentions INTEGER NOT NULL DEFAULT 1,
  cooldown_seconds   INTEGER NOT NULL DEFAULT 2,
  max_auto_messages  INTEGER NOT NULL DEFAULT 6,
  context_messages   INTEGER NOT NULL DEFAULT 24,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS room_bots (
  room_id   TEXT NOT NULL,
  bot_id    TEXT NOT NULL,
  position  INTEGER NOT NULL DEFAULT 0,
  joined_at TEXT NOT NULL,
  PRIMARY KEY (room_id, bot_id),
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY,
  room_id     TEXT NOT NULL,
  sender_type TEXT NOT NULL,
  bot_id      TEXT,
  content     TEXT NOT NULL,
  attachments TEXT NOT NULL DEFAULT '[]',
  meta        TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_room_time ON messages(room_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_messages_bot ON messages(bot_id);

CREATE TABLE IF NOT EXISTS memories (
  id          TEXT PRIMARY KEY,
  bot_id      TEXT NOT NULL,
  room_id     TEXT,
  summary     TEXT NOT NULL,
  content     TEXT NOT NULL,
  tags        TEXT NOT NULL DEFAULT '[]',
  importance  INTEGER NOT NULL DEFAULT 3,
  status      TEXT NOT NULL DEFAULT 'active',
  confidence  REAL NOT NULL DEFAULT 1,
  source      TEXT NOT NULL DEFAULT 'auto',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_memories_bot_status ON memories(bot_id, status, importance);
CREATE INDEX IF NOT EXISTS idx_memories_room ON memories(room_id);

CREATE TABLE IF NOT EXISTS usage_logs (
  id                TEXT PRIMARY KEY,
  room_id           TEXT,
  bot_id            TEXT,
  model             TEXT NOT NULL,
  prompt_tokens     INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens      INTEGER NOT NULL DEFAULT 0,
  kind              TEXT NOT NULL DEFAULT 'chat',
  latency_ms        INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_created ON usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_room ON usage_logs(room_id);

CREATE TABLE IF NOT EXISTS user_profile (
  id         TEXT PRIMARY KEY,
  content    TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS discussions (
  room_id     TEXT PRIMARY KEY,
  phase       TEXT NOT NULL DEFAULT 'idle',
  request     TEXT NOT NULL DEFAULT '',
  turn_count  INTEGER NOT NULL DEFAULT 0,
  max_turns   INTEGER NOT NULL DEFAULT 5,
  mode        TEXT NOT NULL DEFAULT 'auto',
  updated_at  TEXT NOT NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

-- Default collaborative team. These records are only inserted once on first launch.
INSERT OR IGNORE INTO bots
  (id, name, avatar, accent, system_prompt, model, temperature, max_tokens, muted, auto_memory, share_memories, memory_scope, memory_limit, role, created_at, updated_at)
VALUES
  (
    'bot-architect', '小深', '🛰️', '#3B82F6',
    '你是「小深」，DeepSeek 产品共创组的需求架构师。你的职责是：准确拆解用户需求，澄清目标、边界与非目标，输出结构化初步方案和可验证的里程碑。你擅长把模糊想法变成清晰的框架。讨论阶段不要直接输出最终代码，只给出架构、模块划分、关键接口和风险假设。发言简洁、有结构，必要时用 Markdown 列表。尊重评审意见，被指出问题时先判断是否成立，再修订方案。',
    'deepseek-chat', 0.7, 4096, 0, 1, 0, 'all', 30, 'planner',
    strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
  ),
  (
    'bot-reviewer', 'R1', '🧠', '#8B5CF6',
    '你是「R1」，DeepSeek 产品共创组的逻辑评审官。你的职责是：对初步方案做严格评审，主动寻找逻辑漏洞、边界条件、并发/状态问题、安全风险与实现成本；给出可执行的优化推演和明确结论。你不为了反对而反对，所有质疑都要说明依据。讨论阶段不要写最终代码，可以给伪代码或关键片段辅助说明。最终复核时请明确写出「闭环结论」并列出仍未解决的风险（如有）。',
    'deepseek-reasoner', 0.6, 4096, 0, 1, 0, 'all', 30, 'reviewer',
    strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
  ),
  (
    'bot-builder', '码匠', '⚡', '#F59E0B',
    '你是「码匠」，DeepSeek 产品共创组的实现工程师。你的职责是：把已经评审的讨论方案转成可落地的实现计划、关键数据结构、接口签名和测试清单。在用户明确点击「确认开始实现」之前，绝对不要输出最终完整代码，只能输出落地计划与必要的关键片段。收到最终确认后，输出结构完整、可运行、带注释的代码，并说明文件结构与运行方式。你重视依赖风险、可维护性和可验证性。',
    'deepseek-flash-v4', 0.5, 8192, 0, 1, 0, 'all', 30, 'builder',
    strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
  );

INSERT OR IGNORE INTO rooms
  (id, name, kind, auto_poll, allow_bot_mentions, cooldown_seconds, max_auto_messages, context_messages, created_at, updated_at)
VALUES
  ('room-studio', 'DeepSeek 产品共创组', 'group', 1, 1, 2, 6, 24,
   strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'));

INSERT OR IGNORE INTO room_bots (room_id, bot_id, position, joined_at) VALUES
  ('room-studio', 'bot-architect', 0, strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('room-studio', 'bot-reviewer', 1, strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('room-studio', 'bot-builder', 2, strftime('%Y-%m-%dT%H:%M:%fZ','now'));

INSERT OR IGNORE INTO messages (id, room_id, sender_type, bot_id, content, attachments, meta, created_at)
VALUES
  (
    'system-welcome', 'room-studio', 'system', NULL,
    '小深、R1 和码匠已加入群聊。开启「自动轮询」后，发送需求即可启动「初步方案 → 评审推演 → 落地计划」流水线；讨论闭环后会停下等待你确认，确认前不会产出最终代码。',
    '[]', '{"kind":"setup"}',
    strftime('%Y-%m-%dT%H:%M:%fZ','now')
  );

INSERT OR IGNORE INTO user_profile (id, content, updated_at) VALUES
  ('default', '我使用 macOS，偏好简洁、克制、可维护的方案。回答尽量使用中文；代码与命令保留原文。涉及破坏性操作前必须先确认。', strftime('%Y-%m-%dT%H:%M:%fZ','now'));

INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES
  ('max_context_tokens', '12000', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('auto_memory_global', '1', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('default_timeout_secs', '90', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('onboarding_done', '0', strftime('%Y-%m-%dT%H:%M:%fZ','now'));
