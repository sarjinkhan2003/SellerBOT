import Fuse from "fuse.js"

export function createProductMatcher(products = []) {
  return new Fuse(products, {
    keys: ["name", "sku", "aliases"],
    threshold: 0.35,
    ignoreLocation: true,
  })
}
