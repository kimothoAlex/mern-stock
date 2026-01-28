const RECEIPT_CONFIG = {
  shopName: "Mavuno Stores",

  currency: "KES",
  locale: "en-KE",

  // QR options:
  // - "text": encodes compact text
  // - "json": encodes JSON payload
  // - "url": encodes a URL (set verifyBaseUrl)
  qrMode: "json",
  verifyBaseUrl: "https://yourshop.com/verify", // used only if qrMode = "url"

  // Thermal settings
  paperWidthMm: 80, // 80mm printer
  qrSizePx: 140,

  // Footer line
  footerText: "THANK YOU",
};

export default RECEIPT_CONFIG;
