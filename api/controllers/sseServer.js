import http from "http";
import EventSource from "event-source";
import Product from "../models/product.model.js";

const clients = new Set();

const reorderPoint = 3;

// Function to fetch product stock data from your model

// Function to send SSE messages to all connected clients
const sendStockUpdate = (lowStockProducts) => {
  clients.forEach((res) => {
    res.write(`data: ${JSON.stringify({ lowStockProducts })}\n\n`);
  });
};

// Function to check stock levels and broadcast updates periodically
const checkStockLevels = async () => {
  const products = await Product.find({ quantity: { $lt: reorderPoint } });
  const reducedProducts = products.reduce((acc, product) => {
    acc[product.name] = product.quantity;
    return acc;
  }, {});
  const lowStockProducts = Object.entries(reducedProducts).map(
    (productName) => productName[0]
  );

  if (lowStockProducts.length > 0) {
    sendStockUpdate(lowStockProducts);
  }
};

const init = async (app) => {
  const server = http.createServer(app);

  app.get("/stock-updates", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    clients.add(res); // Add client to connected set

    req.on("close", () => {
      clients.delete(res); // Remove client on connection close
    });

    res.write(":\n\n");

    const intervalId = setInterval(checkStockLevels, 2 * 60 * 60 * 1000); // Check stock levels every 5 seconds (adjust as needed)
    (async () => {
      checkStockLevels(); // Check stock levels initially
    })();
    res.on("close", () => {
      clearInterval(intervalId);
    });
  });

  server.listen(5000, () => console.log("SSE server listening"));
};

export default init;
