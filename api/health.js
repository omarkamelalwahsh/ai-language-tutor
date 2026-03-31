export default function handler(req, res) {
  // Simple health check endpoint for Vercel
  res.status(200).json({
    healthy: true,
    model: "llama-3.1-8b-instant",
    circuitOpen: false,
    environment: "vercel",
  });
}
