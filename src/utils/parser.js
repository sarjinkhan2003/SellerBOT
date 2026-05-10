export function parseOrderMessage(message = "") {
  return {
    rawMessage: message.trim(),
    items: [],
    customer: null,
    deliveryZone: null,
  }
}
