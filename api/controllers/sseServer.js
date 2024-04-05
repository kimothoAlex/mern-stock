import http from "http";
import EventSource from "event-source";
import Product from "../models/product.model.js";

const clients = new Set();
const productStock = {}; 
const reorderPoint = 3; 

// Function to fetch product stock data from your model
const fetchProductStock = async () => {
  try {
    
    const products = await Product.find({});
    productStock.data = products.reduce((acc, product) => {
      acc[product.name] = product.quantity;
      return acc;
    }, {});
    console.log(productStock);
  } catch (error) {
    console.error('Error fetching product stock:', error);
  }
};

// Function to send SSE messages to all connected clients
const sendStockUpdate = (lowStockProducts) => {
  clients.forEach((res) => {
    res.write(`data: ${JSON.stringify({ lowStockProducts })}\n\n`);
  });
};

// Function to check stock levels and broadcast updates periodically
const checkStockLevels = () => {
  const lowStockProducts = Object.entries(productStock.data || {}) // Handle potential empty data
    .filter(([productId, stock]) => stock <= reorderPoint)
    .map(([productId]) => productId); // Extract product IDs with low stock

  if (lowStockProducts.length > 0) {
    sendStockUpdate(lowStockProducts);
  }
};

const init = (app) => {
  const server = http.createServer(app);

  app.get('/stock-updates', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    clients.add(res); // Add client to connected set

    req.on('close', () => {
      clients.delete(res); // Remove client on connection close
    });

    // Send initial stock status on connection
    const initialStockStatus = Object.entries(productStock).map(([productId, stock]) => ({
      productId,
      lowStock: stock <= reorderPoint,
    }));
    res.write(`data: ${JSON.stringify({ initialStockStatus })}\n\n`);

    const intervalId = setInterval(checkStockLevels, 5000); // Check stock levels every 5 seconds (adjust as needed)

    res.on('close', () => {
      clearInterval(intervalId);
    });
  });

  (async () => {
    await fetchProductStock(); // Fetch product stock data on server initialization
    checkStockLevels(); // Check stock levels initially
  })();

  server.listen(5000, () => console.log('SSE server listening'));
};

export default init;