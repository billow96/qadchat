# Stream Trace 使用说明

这份文档用于记录 `window.__QADCHAT_STREAM_TRACE__` 的常用操作，方便后续排查聊天流式渲染、批处理节奏、组件提交和页面可见刷新等问题。

## 使用前提

- 先重启或刷新前端页面，确保已经加载到最新代码。
- 建议在浏览器开发者工具的 Console 中执行下面的命令。

## 开关与清空

开启 trace：

```js
window.__QADCHAT_STREAM_TRACE__.enable();
```

关闭 trace：

```js
window.__QADCHAT_STREAM_TRACE__.disable();
```

清空旧数据：

```js
window.__QADCHAT_STREAM_TRACE__.clear();
```

如果想确认是否已经开启：

```js
window.__QADCHAT_STREAM_TRACE__.isEnabled();
```

## 标准抓数流程

1. 刷新页面，确认前端已经是最新版本。
2. 在控制台执行：

```js
window.__QADCHAT_STREAM_TRACE__.enable();
window.__QADCHAT_STREAM_TRACE__.clear();
```

3. 发一条你要测试的消息。
4. 等回复结束。
5. 导出数据：

```js
copy(window.__QADCHAT_STREAM_TRACE__.exportJSON());
```

这样会把当前 trace 的 JSON 文本复制到剪贴板，之后可以保存为本地文件再进一步分析。

## 常用命令

查看所有 trace 的摘要：

```js
window.__QADCHAT_STREAM_TRACE__.summary();
```

作用：

- 返回当前已记录的所有 trace 摘要
- 适合先看 `traceId`、`durationMs`、各阶段 transition 统计

查看 ring buffer 中的全量事件：

```js
window.__QADCHAT_STREAM_TRACE__.events();
```

作用：

- 返回当前 trace 缓冲区里的全部事件
- 适合按阶段、`seq`、`contentLength`、`remainLength` 手动排查

重新打印摘要到控制台：

```js
window.__QADCHAT_STREAM_TRACE__.printSummary();
```

作用：

- 以表格形式重新输出当前 trace 的摘要
- 适合快速查看，不需要自己手动格式化

导出完整 JSON：

```js
window.__QADCHAT_STREAM_TRACE__.exportJSON();
```

作用：

- 返回 JSON 字符串
- 包含 trace 摘要和全部事件

## 只查看某一条消息

如果只想看某一条消息的 trace，先执行：

```js
window.__QADCHAT_STREAM_TRACE__.summary();
```

从结果里拿到目标 `traceId` 之后，再执行下面这些命令。

查看单条 trace 摘要：

```js
window.__QADCHAT_STREAM_TRACE__.summary("<traceId>");
```

查看单条 trace 的全部事件：

```js
window.__QADCHAT_STREAM_TRACE__.events("<traceId>");
```

导出单条 trace 的完整 JSON：

```js
window.__QADCHAT_STREAM_TRACE__.exportJSON("<traceId>");
```

如果要直接复制单条 trace 的 JSON：

```js
copy(window.__QADCHAT_STREAM_TRACE__.exportJSON("<traceId>"));
```

## 推荐的最小操作集

如果只是日常抓一份数据，通常只需要这几步：

```js
window.__QADCHAT_STREAM_TRACE__.enable();
window.__QADCHAT_STREAM_TRACE__.clear();
```

发起测试消息，等回复结束后执行：

```js
copy(window.__QADCHAT_STREAM_TRACE__.exportJSON());
```

如果还想先看摘要再决定是否导出：

```js
window.__QADCHAT_STREAM_TRACE__.summary();
window.__QADCHAT_STREAM_TRACE__.printSummary();
```

## 适合重点关注的字段

查看摘要时，通常优先关注：

- `durationMs`
- `eventCount`
- `anim_emit -> store_onUpdate`
- `optimizer_enqueue -> optimizer_flush`
- `optimizer_flush -> store_batch_apply_done`
- `store_batch_apply_done -> assistant_render_commit`
- `assistant_render_commit -> markdown_render_commit`
- `markdown_render_commit -> paint_approx`
- `anim_emit -> paint_approx`

查看事件明细时，通常优先关注：

- `seq`
- `stage`
- `relTs`
- `contentLength`
- `chunkLength`
- `remainLength`
- `note`

## 建议保存方式

如果后续要让我继续分析，建议把导出的 JSON 保存成类似这样的文件名：

- `trace-normal.json`
- `trace-retry.json`
- `trace-after-fix.json`

这样更方便做前后对比。
