# 分享与社交预留契约

更新时间：2026-07-23

## 当前实现

当前只实现球局分享邀请，不开放动态社区。球局详情页和球局列表统一使用 `miniprogram/utils/share.js` 生成文案与路径。

分享路径格式：

```text
/pages/game-detail/game-detail?id={gameId}&inviter={userId}
```

文案类型：散客局、赛事局、默认邀请好友。

## 后续数据表预留

### user_follows

- `follower_user_id`
- `followed_user_id`
- `status`
- `create_time`

唯一约束建议：`follower_user_id + followed_user_id`。

### social_messages

- `sender_user_id`
- `receiver_user_id`
- `message_type`
- `content`
- `related_game_id`
- `status`
- `create_time`

私信能力需要举报、拉黑、频率限制和内容安全审核后才能开放。

### social_posts

- `author_user_id`
- `post_type`
- `content`
- `media_json`
- `related_game_id`
- `visibility`
- `moderation_status`
- `create_time`

## 边界

- 本阶段不创建上述数据库表，也不在前端硬编码虚假社区数据。
- 分享落地只读取球局 ID 和邀请人标识，不因邀请关系自动加好友。
- 正式接入社交能力前必须增加隐私说明、内容审核、举报和账号封禁策略。
