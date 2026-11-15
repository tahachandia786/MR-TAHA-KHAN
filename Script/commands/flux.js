const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const { pipeline } = require("stream/promises");

module.exports = {
  config: {
    name: "flux",
    aliases: ["imagine", "gen"],
    version: "4.0.0",
    author: "TAHA KHAN",
    role: 0,
    category: "ai",
    guide: { en: "{pn} <prompt>" }
  },

  async onStart({ api, event, args, message }) {
    const { threadID, messageID, senderID } = event;
    const prompt = args.join(" ").trim();

    if (!prompt) return message.reply("🎨 Misaal: `flux a cute cat`");

    api.setMessageReaction("🎨", messageID, () => {}, true);
    await message.reply(`🎨 **"${prompt}"** ki image bana raha hoon...\n⏳ Wait karo (10-20 sec)`);

    const cacheDir = path.join(__dirname, "cache");
    await fs.ensureDir(cacheDir);
    const filePath = path.join(cacheDir, `flux_${senderID}_${Date.now()}.jpg`);
    
    let downloaded = false;

    // ===== TRY 1: UZAIR API =====
    try {
      const { data } = await axios.post("https://uzairrajputapis.qzz.io/api/ai/flux", { prompt }, { timeout: 45000 });
      
      // Link extract karo
      const strData = JSON.stringify(data);
      const match = strData.match(/(https?:\/\/[^\s"'\\]+)/);
      
      if (match && match[0]) {
        const uzairUrl = match[0];
        console.log("[Uzair URL]", uzairUrl);
        
        // Download try karo (with headers)
        const res = await axios({ 
          url: uzairUrl, 
          method: "GET", 
          responseType: "stream", 
          timeout: 60000,
          headers: { 
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
          }
        });
        await pipeline(res.data, fs.createWriteStream(filePath));
        downloaded = true;
      }
    } catch (e) { 
      console.warn("[Uzair API Fail]", e.message); 
    }

    // ===== TRY 2: POLLINATIONS API (Fallback) =====
    if (!downloaded) {
      console.log("[Using Pollinations Fallback]");
      const pollUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?model=flux&nologo=true&width=1024&height=1024`;
      
      try {
        const res = await axios({ 
          url: pollUrl, 
          method: "GET", 
          responseType: "stream", 
          timeout: 90000, // Pollinations ko time lagta hai
          headers: { "User-Agent": "Mozilla/5.0" }
        });
        await pipeline(res.data, fs.createWriteStream(filePath));
        downloaded = true;
      } catch (e) {
        console.error("[Pollinations Fail]", e.message);
      }
    }

    // ===== SEND OR ERROR =====
    if (downloaded) {
      api.setMessageReaction("✅", messageID, () => {}, true);
      await message.reply({
        body: `🎨 **Prompt:** ${prompt}\n\n»» TAHA KHAN ««`,
        attachment: fs.createReadStream(filePath)
      });
      setTimeout(() => { fs.unlink(filePath).catch(() => {}); }, 5000);
    } else {
      api.setMessageReaction("❌", messageID, () => {}, true);
      return message.reply(`❌ Image download fail ho gayi. Dono APIs down hain.\n👉 Thodi der baad try karo.`);
    }
  }
};