import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

const BOT_UA = /Twitterbot|facebookexternalhit|Discordbot|Slackbot|WhatsApp|TelegramBot|LinkedInBot|Googlebot|bingbot|iMessagebot/i;

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/eth-price", async (_req, res) => {
    try {
      const response = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
      );
      const data = await response.json();
      res.json(data);
    } catch {
      res.json({ ethereum: { usd: 3500 } });
    }
  });

  app.get("/lookup", (req, res, next) => {
    const ua = req.headers['user-agent'] || '';
    if (!BOT_UA.test(ua)) return next();

    const id = req.query.id as string || '';
    const q = req.query.q as string || '';
    const question = q ? decodeURIComponent(q) : '';

    const title = question
      ? `${question} - The Juice`
      : id
      ? `Bet #${id} - The Juice`
      : 'The Juice - P2P Betting on Base';

    const description = question
      ? `Join this bet: "${question}" on The Juice. Peer-to-peer prediction market on Base.`
      : id
      ? `View and join Bet #${id} on The Juice. Peer-to-peer prediction market on Base.`
      : 'Peer-to-peer betting and escrow on Base network.';

    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${escapeHtml(url)}" />
<meta property="og:image" content="${req.protocol}://${req.get('host')}/logo.png" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="The Juice" />
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${req.protocol}://${req.get('host')}/logo.png" />
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(description)}</p>
<a href="${escapeHtml(url)}">Open in The Juice</a>
</body>
</html>`;

    res.set('Content-Type', 'text/html');
    res.send(html);
  });

  return httpServer;
}
