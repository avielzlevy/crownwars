/**
 * Generic fixed-size object pool.
 * When the pool is exhausted, the oldest active item is forcibly recycled.
 */
export class ObjectPool<T> {
  private pool: T[] = [];
  private active: T[] = [];
  private head = 0; // ring-buffer index into active list

  constructor(
    private readonly size: number,
    private readonly factory: () => T,
    private readonly reset: (item: T) => void,
  ) {
    for (let i = 0; i < size; i++) {
      this.pool.push(factory());
    }
  }

  acquire(): T {
    if (this.pool.length > 0) {
      const item = this.pool.pop()!;
      this.active.push(item);
      return item;
    }
    // Pool exhausted — recycle oldest active item
    const recycled = this.active[this.head];
    this.reset(recycled);
    this.head = (this.head + 1) % this.active.length;
    return recycled;
  }

  release(item: T): void {
    const idx = this.active.indexOf(item);
    if (idx !== -1) {
      this.active.splice(idx, 1);
      if (this.head > 0) this.head = Math.max(0, this.head - 1);
    }
    this.reset(item);
    this.pool.push(item);
  }

  get activeItems(): readonly T[] {
    return this.active;
  }
}
