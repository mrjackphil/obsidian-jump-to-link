/**
 * Obsidian extends a handful of built-in prototypes at runtime. The plugin only
 * relies on `Array.prototype.contains`, so that is all the pure-logic tests need
 * to stand in for the app.
 *
 * See https://docs.obsidian.md - the helpers live in obsidian.d.ts as ambient
 * declarations, which means TypeScript accepts them but Node does not provide them.
 */
if (!Array.prototype.contains) {
    Object.defineProperty(Array.prototype, "contains", {
        value: function <T>(this: T[], target: T): boolean {
            return this.includes(target);
        },
        writable: true,
        configurable: true,
        enumerable: false,
    });
}

// Makes this file a module, which `--isolatedModules` requires.
export {};
