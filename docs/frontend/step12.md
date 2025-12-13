## 📌 **IOTA 目前事件設計 & API 觀察（關鍵重點）**

### 📍 官方事件支持

IOTA 區塊鏈具有事件系統，可以讓你：

* **在 Move contract 裡 `event::emit(...)`** 事件（你現在 annual_party 已有很多 event.emit）
* 透過 RPC / GraphQL **query + subscribe** 來監控事件

  * 使用 GraphQL 的 `events` 訂閱介面來接收即時事件 ([IOTA 文件文件庫][1])
  * Event 結構包含：`packageId`, `transactionModule`, `sender`, `type`, `json`, 等欄位 ([IOTA 文件文件庫][2])

GraphQL subscription 的語句大致：

```graphql
subscription {
  events(filter: SubscriptionEventFilter) {
    ...fields...
  }
}
```

官方文檔雖有說明 GraphQL events subscription，但沒有給出完整 client 使用範例 ([IOTA 文件文件庫][1])

---

## 📌 **三種可行的實作方案（評估）**

### ✅ **方案 A：前端 WebSocket 訂閱 GraphQL events**

🎯 **適合用於 GitHub Pages 這種純前端應用：**

* 透過 WebSocket 連線到 IOTA GraphQL subscription endpoint
* 透過 subscription 接收事件，即時更新 UI

**優點：**

* 不需後端
* 可即時反應事件
* 與 GitHub Pages / SPA 前端非常契合

**缺點：**

* 需要在前端處理 WebSocket/GraphQL 握手
* CORS / endpoint 授權可能需要注意
  → 通常 IOTA public node 會支援這種 subscription

**必要步驟：**

1. 使用 WebSocket 連線到例如 `wss://api.testnet.iota.cafe/graphql`
2. 執行 `events(filter: {...}) { ... }` subscription
3. 解析接收到的 payload

**前端 libs 推薦：**

* `graphql-ws`
* `subscriptions-transport-ws`
* 或直接原生 WebSocket + GraphQL 協議

---

### ⚠️ **方案 B：前端定期 polling + queryEvents**

📌 不使用 subscription，而是定時查詢

如官方 SDK 有 `client.queryEvents({...})` 查詢事件的 API ([IOTA 文件文件庫][3])

**優點：**

* 簡單 → 不必維護 Websocket
* 與 CDN / GitHub Pages 更穩定

**缺點：**

* 不是 *即時*
* 需要自己管理 cursor/lastTimestamp 來避免漏掉資料

**適用情況：**

* 你不需要極度即時
* 只需要近乎即時（或每 3~5 秒更新）

---

### ⚠️ **方案 C：後端 Proxy / Event Indexer + Webhook**

* 自己跑一個後端訂閱事件
* 再用 API / webhook 推給前端

**優點：**

* 不受前端 CORS / 連線限制
* 邏輯更強大

**缺點：**

* 需要 server
* 不符合「GitHub Pages 全前端」需求

---

## 📌 **實作方案選擇建議**

| 方案                               | 是否 GitHub Pages 可行 | 即時性 | 複雜度 |
| -------------------------------- | ------------------ | --- | --- |
| A：WebSocket GraphQL subscription | ✅                  | ⭐⭐⭐ | ⭐⭐  |
| B：Polling queryEvents            | ✅                  | ⭐⭐  | ⭐   |
| C：後端 Proxy                       | ⚠️                 | ⭐⭐⭐ | ⭐⭐⭐ |

👉 **優先推薦方案 A**（WebSocket Subscription），
若遇到 CORS / Node 授權問題再 fallback 到 **方案 B**（Polling + queryEvents）。

---

## 📌 **要給 Codex 的實作規格書（Specification）**

下面這段你可以直接丟給 Codex，讓它幫你產生程式碼（TS/React/VanillaJS）：

---

```text
You are Codex.  
I need a frontend implementation specification to subscribe to on-chain events emitted by my IOTA Move contract (`weiya_master::annual_party`) using GraphQL subscription.

The frontend will be hosted as a **static site (GitHub Pages)** and must support:

1) **Real-time subscription to events** using IOTA GraphQL WebSocket endpoint.  
2) **Fallback to periodic polling** using queryEvents if WebSocket subscription fails.  
3) Parsing incoming events relevant to our Move events and updating UI state.

Provide TWO implementations:

────────────────────────────────────
A) WebSocket GraphQL subscription client (TypeScript/JS)
────────────────────────────────────

Requirements:

1. Uses `graphql-ws` or equivalent lib to connect to a GraphQL subscription endpoint (e.g., `wss://api.testnet.iota.cafe/graphql`).  
2. Subscribe to the `events` GraphQL subscription with a filter:
   - Filter Move events emitted by our package ID, OR  
   - Filter all events and then client‐side filter by Move package name/module.  
   - Include fields `sender`, `type`, `json`, `timestamp`

Example subscription template:

```

subscription Events($filter: SubscriptionEventFilter) {
events(filter: $filter) {
timestamp
type
data { json }
sender
}
}

```

3. Implement exponential reconnect logic if the WebSocket closes.  
4. Provide parsing helpers:
   - Parse JSON event payloads to TypeScript types
   - Filter events matching our smart contract (by Move type or module)

5. Expose an interface like:
```

subscribeToAnnualPartyEvents(callback: (event: ParsedEvent) => void)

```

6. Provide error handling and fallback detection:
- If connection fails, switch to polling mode (see B).

────────────────────────────────────
B) Polling fallback implementation using `client.queryEvents()`
────────────────────────────────────

Requirements:

1. Using the official IOTA TypeScript SDK or direct GraphQL query.
2. Poll every fixed interval (e.g., 3–5 seconds).
3. Maintain a cursor (timestamp or event ID) to avoid re-fetching same events.
4. Filter incoming events by:
- Move package ID
- Module or Move event struct types
5. Expose an interface like:
```

startPollingEvents(callback: (event: ParsedEvent) => void)
stopPollingEvents()

```

────────────────────────────────────
C) Provide example UI integration (React or Vanilla JS)
────────────────────────────────────

1. Example components/hooks to display latest events list.
2. Example filtering logic by event type.
3. Example reconnection indicator.

────────────────────────────────────
Extras:
- Logging + debug mode
- Option to filter events by Move event type names (string)
- Fallback from WebSocket → Polling automatically if subscription fails

Provide the full TypeScript code (with imports) implementing both subscription + polling, plus detailed comments.
```

---

## 📌 **前端 要準備的資料**

為了正確識別事件，你需要確定以下東西：

### ✔ 你的 package ID

每個 Move contract emit 事件時會帶入 Move packageId。你可以：

* 用 RPC 查詢出 package ID
* 也可以從 nodes 回傳的 events 裡抓一次 sample

event 物件裡的 fields 可以取出 `type` & `json` 去解析你 own event payloads ([IOTA 文件文件庫][2])

---

## 🧠 **注意事項 / 陷阱**

### 🚧 CORS / WebSocket endpoint 設定

如果你連到的 GraphQL WebSocket endpoint 不支援 GitHub Pages 的來源，瀏覽器可能會擋住連線。
對策：

* 使用 public node provider (e.g., `wss://api.testnet.iota.cafe/graphql`) 可能支援 CORS
* 若不支援，改用 **Polling** fallback

---

## 📌 **Event Type & Data 解析**

事件 payload 比較重要的欄位：

| Field       | Meaning                                       |
| ----------- | --------------------------------------------- |
| `sender`    | 觸發 event 的 address                            |
| `type`      | Move event type signature (包含 package/module) |
| `json`      | Struct fields parsed to JSON                  |
| `timestamp` | event time ([IOTA 文件文件庫][2])                  |

你可以用 `type` + `json` 來辨識你的各種 Event，例如：

* `ActivityCreatedEvent`
* `ParticipantJoinedEvent`
* …其他 event struct names

---

## 🏁 小結 & 推薦優先度

✅ **優先做 WebSocket subscription**
→ 有更好 UX / 即時更新

⚠️ **若有 CORS 問題**
→ 改 polling fallback

[1]: https://docs.iota.org/developer/references/iota-api/iota-graphql/reference/devnet/operations/subscriptions/events?utm_source=chatgpt.com "events"
[2]: https://docs.iota.org/developer/references/iota-api/iota-graphql/reference/devnet/types/objects/event?utm_source=chatgpt.com "Event"
[3]: https://docs.iota.org/developer/ts-sdk/api/client/classes/IotaClient?utm_source=chatgpt.com "Class: IotaClient"
