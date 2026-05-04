/**
 * Tiny browser compatibility shims for client bundles and third-party embeds.
 * Keep this dependency-free and import it before analytics/embed libraries.
 */
if (typeof Array.prototype.findLast !== "function") {
  Object.defineProperty(Array.prototype, "findLast", {
    value: function findLast(predicate, thisArg) {
      if (this == null) {
        throw new TypeError("Array.prototype.findLast called on null or undefined");
      }
      if (typeof predicate !== "function") {
        throw new TypeError("predicate must be a function");
      }
      const array = Object(this);
      const length = array.length >>> 0;
      for (let index = length - 1; index >= 0; index -= 1) {
        const value = array[index];
        if (predicate.call(thisArg, value, index, array)) return value;
      }
      return undefined;
    },
    configurable: true,
    writable: true,
  });
}

if (typeof Array.prototype.findLastIndex !== "function") {
  Object.defineProperty(Array.prototype, "findLastIndex", {
    value: function findLastIndex(predicate, thisArg) {
      if (this == null) {
        throw new TypeError("Array.prototype.findLastIndex called on null or undefined");
      }
      if (typeof predicate !== "function") {
        throw new TypeError("predicate must be a function");
      }
      const array = Object(this);
      const length = array.length >>> 0;
      for (let index = length - 1; index >= 0; index -= 1) {
        if (predicate.call(thisArg, array[index], index, array)) return index;
      }
      return -1;
    },
    configurable: true,
    writable: true,
  });
}
