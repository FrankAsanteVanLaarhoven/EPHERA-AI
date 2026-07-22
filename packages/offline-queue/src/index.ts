/**
 * Offline pending queue for authorised operations.
 * Items stay pending until the server revalidates — never treat local as settled.
 */

export type QueueItemStatus = "pending" | "syncing" | "synced" | "failed" | "rejected";

export interface PendingTransfer {
  id: string;
  kind: "domestic_transfer" | "airtime" | "freeze_wallet";
  payload: Record<string, unknown>;
  authorisationRef: string;
  createdAt: string;
  status: QueueItemStatus;
  lastError?: string;
}

export interface QueueStorage {
  load(): PendingTransfer[];
  save(items: PendingTransfer[]): void;
}

export class MemoryStorage implements QueueStorage {
  private items: PendingTransfer[] = [];
  load() {
    return [...this.items];
  }
  save(items: PendingTransfer[]) {
    this.items = [...items];
  }
}

/** A permanent rejection is terminal and must never be retried; a non-permanent
 * failure (a network error, a 5xx) is retryable. Distinguishing them is what
 * stops the queue retrying a payment the server has definitively refused. */
export interface SendResult {
  ok: boolean;
  permanent?: boolean;
  error?: string;
}

export class OfflineQueue {
  constructor(private readonly storage: QueueStorage = new MemoryStorage()) {}

  private flushing = false;

  list(): PendingTransfer[] {
    return this.storage.load();
  }

  enqueue(
    item: Omit<PendingTransfer, "status" | "createdAt"> & { createdAt?: string },
  ): PendingTransfer {
    if (!item.authorisationRef) {
      throw new Error("Cannot enqueue money operation without authorisationRef");
    }
    const full: PendingTransfer = {
      ...item,
      createdAt: item.createdAt ?? new Date().toISOString(),
      status: "pending",
    };
    const items = this.storage.load();
    items.push(full);
    this.storage.save(items);
    return full;
  }

  async flush(
    sender: (item: PendingTransfer) => Promise<SendResult>,
  ): Promise<{ synced: number; failed: number; skipped: number }> {
    // Reentrancy guard. Two overlapping flushes would each load the items and
    // re-send anything the other left in "syncing", double-submitting a payment
    // that only server idempotency would then catch. One flush at a time.
    if (this.flushing) {
      return { synced: 0, failed: 0, skipped: 0 };
    }
    this.flushing = true;
    try {
      const items = this.storage.load();
      let synced = 0;
      let failed = 0;
      let skipped = 0;
      for (const item of items) {
        // synced and rejected are terminal. Retrying a rejected payment resends
        // one the server has definitively refused; retrying a synced one
        // double-submits. Only pending/failed/syncing are retryable (syncing
        // meaning a previous flush crashed mid-send).
        if (item.status === "synced" || item.status === "rejected") {
          skipped += 1;
          continue;
        }
        item.status = "syncing";
        this.storage.save(items);
        try {
          const res = await sender(item);
          if (res.ok) {
            item.status = "synced";
            synced += 1;
          } else if (res.permanent) {
            // Terminal: the server refused it for good. Do not retry.
            item.status = "rejected";
            item.lastError = res.error ?? "rejected";
            failed += 1;
          } else {
            item.status = "failed";
            item.lastError = res.error ?? "unknown";
            failed += 1;
          }
        } catch (e) {
          item.status = "failed";
          item.lastError = e instanceof Error ? e.message : String(e);
          failed += 1;
        }
        this.storage.save(items);
      }
      return { synced, failed, skipped };
    } finally {
      this.flushing = false;
    }
  }
}
