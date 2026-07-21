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

export class OfflineQueue {
  constructor(private readonly storage: QueueStorage = new MemoryStorage()) {}

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
    sender: (item: PendingTransfer) => Promise<{ ok: boolean; error?: string }>,
  ): Promise<{ synced: number; failed: number }> {
    const items = this.storage.load();
    let synced = 0;
    let failed = 0;
    for (const item of items) {
      if (item.status === "synced") continue;
      item.status = "syncing";
      this.storage.save(items);
      try {
        const res = await sender(item);
        if (res.ok) {
          item.status = "synced";
          synced += 1;
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
    return { synced, failed };
  }
}
