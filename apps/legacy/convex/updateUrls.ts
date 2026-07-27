import { mutation } from "./_generated/server";

// Client/Alliance website URLs from the legacy project
const CLIENT_URLS: Record<string, string> = {
  "Limansky": "https://www.limansky.com/",
  "Cibic": "https://www.cibic.com.ar/",
  "Mercado de Gafas": "https://www.mercadodegafas.com.ar/",
  "LABIN": "https://www.labinlab.com",
};

const ALLIANCE_URLS: Record<string, string> = {
  "Colectar": "https://www.instagram.com/colectar.ros/",
  "Fundación Rosario": "https://www.fundacionrosario.org.ar/",
  "Crowe": "https://www.crowe.com/",
};

export const updateClientUrls = mutation({
  args: {},
  handler: async (ctx) => {
    const clients = await ctx.db.query("clients").collect();
    let updated = 0;

    for (const client of clients) {
      const url = CLIENT_URLS[client.name];
      if (url && client.websiteUrl !== url) {
        await ctx.db.patch(client._id, { websiteUrl: url });
        updated++;
      }
    }

    return { updated, total: clients.length };
  },
});

export const updateAllianceUrls = mutation({
  args: {},
  handler: async (ctx) => {
    const alliances = await ctx.db.query("alliances").collect();
    let updated = 0;

    for (const alliance of alliances) {
      const url = ALLIANCE_URLS[alliance.name];
      if (url && alliance.websiteUrl !== url) {
        await ctx.db.patch(alliance._id, { websiteUrl: url });
        updated++;
      }
    }

    return { updated, total: alliances.length };
  },
});

export const updateAllUrls = mutation({
  args: {},
  handler: async (ctx) => {
    // Update clients
    const clients = await ctx.db.query("clients").collect();
    let clientsUpdated = 0;

    for (const client of clients) {
      const url = CLIENT_URLS[client.name];
      if (url && client.websiteUrl !== url) {
        await ctx.db.patch(client._id, { websiteUrl: url });
        clientsUpdated++;
      }
    }

    // Update alliances
    const alliances = await ctx.db.query("alliances").collect();
    let alliancesUpdated = 0;

    for (const alliance of alliances) {
      const url = ALLIANCE_URLS[alliance.name];
      if (url && alliance.websiteUrl !== url) {
        await ctx.db.patch(alliance._id, { websiteUrl: url });
        alliancesUpdated++;
      }
    }

    return {
      clients: { updated: clientsUpdated, total: clients.length },
      alliances: { updated: alliancesUpdated, total: alliances.length },
    };
  },
});
